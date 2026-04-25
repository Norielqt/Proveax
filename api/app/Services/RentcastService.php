<?php

namespace App\Services;

use App\Models\RentcastProperty;
use Illuminate\Support\Facades\Http;

class RentcastService
{
    private const BASE = 'https://api.rentcast.io/v1';

    private function client()
    {
        return Http::withHeaders([
            'X-Api-Key' => config('services.rentcast.key'),
            'Accept'    => 'application/json',
        ])->withoutVerifying()->baseUrl(self::BASE)->timeout(120);
    }

    /**
     * Wrap a GET call with usage logging (billable = API hit).
     */
    private function apiGet(string $endpoint, array $query = [])
    {
        $start = microtime(true);
        $resp  = $this->client()->get($endpoint, $query);
        $ms    = (int) round((microtime(true) - $start) * 1000);
        RentcastUsageLogger::log(
            endpoint:   $endpoint,
            statusCode: $resp->status(),
            billable:   true,
            durationMs: $ms,
            error:      $resp->failed() ? ($resp->json('error') ?? 'HTTP ' . $resp->status()) : null,
        );
        return $resp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Search / snapshot
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Search properties and return a normalised snapshot array.
     * Accepted $params keys: zipCode, city, state, latitude, longitude, radius, propertyType, limit
     */
    public function snapshot(array $params): array
    {
        $baseQuery = array_filter([
            'address'       => $params['address']      ?? null,
            'zipCode'       => $params['zipCode']      ?? $params['postalcode'] ?? null,
            'city'          => $params['city']          ?? null,
            'state'         => $params['state']         ?? null,
            'latitude'      => $params['latitude']      ?? null,
            'longitude'     => $params['longitude']     ?? null,
            'radius'        => $params['radius']        ?? null,
            'propertyType'  => $params['propertyType']  ?? $params['propertytype'] ?? null,
            'bedrooms'      => $this->rangeParam($params, 'bedroomsMin',  'bedroomsMax'),
            'bathrooms'     => $this->rangeParam($params, 'bathroomsMin', 'bathroomsMax'),
            'squareFootage' => $this->rangeParam($params, 'sqftMin',      'sqftMax'),
            'yearBuilt'     => $this->rangeParam($params, 'yearBuiltMin', 'yearBuiltMax'),
            'lotSize'       => $this->rangeParam($params, 'lotSizeMin',   'lotSizeMax'),
            'limit'         => 500,
        ], fn($v) => $v !== null && $v !== '');

        $startOffset = isset($params['offset']) ? (int) $params['offset'] : 0;
        $pages       = 1; // 1 × 500 = 500 per call
        $allRows     = [];

        for ($i = 0; $i < $pages; $i++) {
            $query = $baseQuery;
            $offset = $startOffset + ($i * 500);
            if ($offset > 0) $query['offset'] = $offset;

            $resp = $this->apiGet('/properties', $query);

            if ($resp->failed()) {
                if ($i === 0) {
                    return ['data' => [], 'total' => 0, 'error' => $resp->json('error') ?? 'Rentcast API error'];
                }
                break;
            }

            $raw = $resp->json() ?? [];
            if (empty($raw)) break;

            $allRows = array_merge($allRows, array_map([$this, 'normaliseSnapshot'], $raw));

            if (count($raw) < 500) break; // no more pages
        }

        if (!empty($allRows)) {
            RentcastProperty::upsertBatch($allRows);
        }

        return [
            'data'  => $allRows,
            'total' => count($allRows),
        ];
    }

    /**
     * Build a Rentcast range string (e.g. "2:4", "3:*", "*:5") from min/max params.
     * Returns null when both are absent.
     */
    private function rangeParam(array $params, string $minKey, string $maxKey): ?string
    {
        $min = ($params[$minKey] ?? null) !== null && ($params[$minKey] ?? '') !== '' ? $params[$minKey] : null;
        $max = ($params[$maxKey] ?? null) !== null && ($params[$maxKey] ?? '') !== '' ? $params[$maxKey] : null;
        if ($min === null && $max === null) return null;
        if ($min !== null && $max !== null) return "{$min}:{$max}";
        if ($min !== null) return "{$min}:*";
        return "*:{$max}";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Full detail — 3 concurrent requests
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch a complete property report.
     *
     * @param  string  $rentcastId  Rentcast property ID (preferred)
     * @param  string  $address     Street address (fallback lookup)
     * @param  string  $zipCode     ZIP code (used with address)
     */
    public function fullDetail(string $rentcastId = '', string $address = '', string $zipCode = ''): array
    {
        $key  = config('services.rentcast.key');
        $hdrs = ['X-Api-Key' => $key, 'Accept' => 'application/json'];
        $opts = [];

        // Build lookup params
        if ($rentcastId) {
            $propUrl  = self::BASE . '/properties/' . $rentcastId;
            $avmQuery = ['address' => $address, 'zipCode' => $zipCode]; // needs address for AVM
        } else {
            // Search by address to find the property ID first
            $searchResp = $this->apiGet('/properties', array_filter([
                'address' => $address,
                'zipCode' => $zipCode,
                'limit'   => 1,
            ]));

            if ($searchResp->failed() || empty($searchResp->json())) {
                return ['data' => null, 'error' => 'Property not found.'];
            }

            $found      = $searchResp->json()[0];
            $rentcastId = $found['id'] ?? '';
            $propUrl    = self::BASE . '/properties/' . $rentcastId;
            $avmQuery   = ['address' => $address ?: ($found['addressLine1'] ?? ''), 'zipCode' => $zipCode ?: ($found['zipCode'] ?? '')];
        }

        // Fetch property detail + AVM + rental estimate concurrently
        $poolStart = microtime(true);
        [$propResp, $avmResp, $rentResp] = Http::pool(fn ($pool) => [
            $pool->withHeaders($hdrs)->withoutVerifying()->timeout(15)->get($propUrl),
            $pool->withHeaders($hdrs)->withoutVerifying()->timeout(15)->get(self::BASE . '/avm/value',          $avmQuery),
            $pool->withHeaders($hdrs)->withoutVerifying()->timeout(15)->get(self::BASE . '/avm/rent/long-term',  $avmQuery),
        ]);
        $poolMs = (int) round((microtime(true) - $poolStart) * 1000);
        RentcastUsageLogger::log('/properties/{id}',    $propResp->status(), true, $poolMs, $propResp->failed() ? 'HTTP ' . $propResp->status() : null);
        RentcastUsageLogger::log('/avm/value',          $avmResp->status(),  true, $poolMs, $avmResp->failed()  ? 'HTTP ' . $avmResp->status()  : null);
        RentcastUsageLogger::log('/avm/rent/long-term', $rentResp->status(), true, $poolMs, $rentResp->failed() ? 'HTTP ' . $rentResp->status() : null);

        if ($propResp->failed()) {
            return ['data' => null, 'error' => $propResp->json('error') ?? 'Rentcast API error'];
        }

        $p    = $propResp->json()  ?? [];
        $avm  = (!$avmResp->failed())  ? ($avmResp->json()  ?? []) : [];
        $rent = (!$rentResp->failed()) ? ($rentResp->json() ?? []) : [];

        return ['data' => $this->normDetail($p, $avm, $rent)];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sale Listings (MLS)  — GET /v1/listings/sale
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch sale listings from the Rentcast /listings/sale endpoint.
     * Accepted $params keys: zipCode, city, state, latitude, longitude, radius,
     *   propertyType, status (Active|Inactive), listingType (Pending|Withdrawn|Sold|Active)
     *
     * Note: listingType is a response field in Rentcast — NOT a query param.
     * We filter by it server-side after the API call.
     */
    public function listings(array $params): array
    {
        $query = array_filter([
            'zipCode'      => $params['zipCode']      ?? null,
            'city'         => $params['city']         ?? null,
            'state'        => $params['state']        ?? null,
            'latitude'     => $params['latitude']     ?? null,
            'longitude'    => $params['longitude']    ?? null,
            'radius'       => $params['radius']       ?? null,
            'propertyType' => $params['propertyType'] ?? null,
            'status'       => $params['status']       ?? 'Active',
            'limit'        => 500,
        ], fn($v) => $v !== null && $v !== '');

        $resp = $this->apiGet('/listings/sale', $query);

        if ($resp->failed()) {
            return ['data' => [], 'total' => 0, 'error' => $resp->json('error') ?? 'Rentcast listings API error'];
        }

        $raw = $resp->json() ?? [];

        // listingType is NOT a Rentcast query param — filter on our side
        $listingType = $params['listingType'] ?? null;
        if ($listingType) {
            $raw = array_values(array_filter($raw, fn($l) => ($l['listingType'] ?? '') === $listingType));
        }

        $rows = array_map([$this, 'normaliseListing'], $raw);

        return ['data' => $rows, 'total' => count($rows)];
    }

    /**
     * Normalise a single /listings/sale record into a shape compatible with
     * the property search rows (so the frontend can render it identically).
     */
    private function normaliseListing(array $l): array
    {
        return [
            'attom_id'       => $l['id']              ?? null,
            'street'         => $l['addressLine1']    ?? null,
            'address'        => $l['formattedAddress'] ?? trim(($l['addressLine1'] ?? '') . ' ' . ($l['city'] ?? '')),
            'city'           => $l['city']            ?? null,
            'state'          => $l['state']           ?? null,
            'zip'            => $l['zipCode']         ?? null,
            'lat'            => isset($l['latitude'])  ? (float) $l['latitude']  : null,
            'lng'            => isset($l['longitude']) ? (float) $l['longitude'] : null,
            'property_type'  => $l['propertyType']    ?? null,
            'bedrooms'       => $l['bedrooms']        ?? null,
            'bathrooms'      => $l['bathrooms']       ?? null,
            'square_feet'    => $l['squareFootage']   ?? null,
            'lot_size'       => $l['lotSize']         ?? null,
            'year_built'     => $l['yearBuilt']       ?? null,
            'estimated_value'=> $l['price']           ?? null,
            'owner_name'     => null,
            'owner_occupied' => null,
            // Listing-specific extras
            'list_price'     => $l['price']           ?? null,
            'listing_type'   => $l['listingType']     ?? null,
            'listing_status' => $l['status']          ?? null,
            'listed_date'    => $l['listedDate']      ?? null,
            'days_on_market' => $l['daysOnMarket']    ?? null,
            'mls_number'     => $l['mlsNumber']       ?? null,
            // Pre-computed detail (raw_json stripped by controller before response)
            'detail'         => $this->normDetail($l),
            'raw_json'       => json_encode($l, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AVM only
    // ─────────────────────────────────────────────────────────────────────────

    public function avm(string $address, string $zipCode): array
    {
        $resp = $this->apiGet('/avm/value', ['address' => $address, 'zipCode' => $zipCode]);

        if ($resp->failed()) {
            return ['data' => null, 'error' => $resp->json('error') ?? 'Rentcast API error'];
        }

        $raw = $resp->json() ?? [];

        $comps = array_map(static function (array $c): array {
            return [
                'id'                => $c['id']                ?? null,
                'address'           => $c['formattedAddress']  ?? null,
                'city'              => $c['city']              ?? null,
                'state'             => $c['state']             ?? null,
                'zip'               => $c['zipCode']           ?? null,
                'lat'               => isset($c['latitude'])   ? (float) $c['latitude']  : null,
                'lng'               => isset($c['longitude'])  ? (float) $c['longitude'] : null,
                'property_type'     => $c['propertyType']      ?? null,
                'bedrooms'          => $c['bedrooms']          ?? null,
                'bathrooms'         => $c['bathrooms']         ?? null,
                'square_feet'       => $c['squareFootage']     ?? null,
                'lot_size'          => $c['lotSize']           ?? null,
                'year_built'        => $c['yearBuilt']         ?? null,
                'price'             => $c['price']             ?? null,
                'status'            => $c['status']            ?? null,
                'listing_type'      => $c['listingType']       ?? null,
                'listed_date'       => $c['listedDate']        ?? null,
                'days_on_market'    => $c['daysOnMarket']      ?? null,
                'distance'          => $c['distance']          ?? null,
                'correlation'       => $c['correlation']       ?? null,
            ];
        }, $raw['comparables'] ?? []);

        $subject = $raw['subjectProperty'] ?? [];

        return ['data' => [
            'rentcast_id'     => $raw['id']             ?? null,
            'avm_value'       => $raw['price']          ?? null,
            'avm_low'         => $raw['priceRangeLow']  ?? null,
            'avm_high'        => $raw['priceRangeHigh'] ?? null,
            'avm_date'        => null,
            'confidence'      => null,
            'last_sale_price' => isset($subject['lastSalePrice']) ? (float) $subject['lastSalePrice'] : null,
            'last_sale_date'  => $subject['lastSaleDate'] ?? null,
            'comparables'     => $comps,
        ]];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Normalisers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Normalise a single Rentcast property object into the standard search row shape.
     * Keeps 'attom_id' as the field name for backward compatibility with the frontend.
     * Also stores the full raw API response as 'raw_json' so property detail views
     * can be served from the DB without extra API calls.
     */
    public function normaliseSnapshot(array $p): array
    {
        return [
            'attom_id'        => $p['id']              ?? null, // using attom_id key for compat
            'street'          => $p['addressLine1']    ?? null,
            'address'         => $p['formattedAddress'] ?? trim(($p['addressLine1'] ?? '') . ' ' . ($p['city'] ?? '')),
            'city'            => $p['city']             ?? null,
            'state'           => $p['state']            ?? null,
            'zip'             => $p['zipCode']          ?? null,
            'lat'             => isset($p['latitude'])  ? (float) $p['latitude']  : null,
            'lng'             => isset($p['longitude']) ? (float) $p['longitude'] : null,
            'property_type'   => $p['propertyType']    ?? null,
            'bedrooms'        => $p['bedrooms']         ?? null,
            'bathrooms'       => $p['bathrooms']        ?? null,
            'square_feet'     => $p['squareFootage']    ?? null,
            'lot_size'        => $p['lotSize']          ?? null,
            'year_built'      => $p['yearBuilt']        ?? null,
            'estimated_value' => $this->latestAssessedValue($p),
            'last_sale_price' => isset($p['lastSalePrice']) ? (float) $p['lastSalePrice'] : null,
            'owner_name'      => $this->extractOwnerName($p),
            'owner_occupied'  => isset($p['ownerOccupied']) ? (bool) $p['ownerOccupied'] : null,
            // Pre-computed detail — lets the frontend skip a follow-up /fulldetail call
            'detail'          => $this->normDetail($p),
            // raw_json is stored in DB (never returned in API responses — stripped by controller)
            'raw_json'        => json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }

    /**
     * Build a full property detail response entirely from a cached raw Rentcast property
     * object (stored in the DB from a previous search).  Makes ZERO additional API calls.
     * AVM fields will be null — load them separately via the /avm endpoint if needed.
     */
    public function fullDetailFromCache(array $rawProp): array
    {
        return ['data' => $this->normDetail($rawProp)];
    }

    /**
     * Compute the standard detail object from a decoded raw property array.
     * Used when serving from DB cache (zero API calls).
     */
    public function detailFromRaw(?string $rawJson): ?array
    {
        if (!$rawJson) return null;
        $p = json_decode($rawJson, true) ?? [];
        return empty($p) ? null : $this->normDetail($p);
    }

    /**
     * Build the unified detail object from a raw Rentcast property / listing array.
     * Called inline during normalisation and from the cache path.
     */
    private function normDetail(array $p, array $avm = [], array $rent = []): array
    {
        return [
            'location'        => $this->normLocation($p),
            'characteristics' => $this->normCharacteristics($p),
            'owner'           => $this->normOwner($p),
            'valuation'       => $this->normValuation($p, $avm, $rent),
            'transactions'    => $this->normTransactions($p),
            'mortgage'        => [],
            'permits'         => [],
        ];
    }

    private function normLocation(array $p): array
    {
        return [
            'rentcast_id'       => $p['id']               ?? null,
            'attom_id'          => $p['id']               ?? null,
            'address_full'      => $p['formattedAddress']  ?? null,
            'line1'             => $p['addressLine1']      ?? null,
            'city'              => $p['city']              ?? null,
            'state'             => $p['state']             ?? null,
            'zip'               => $p['zipCode']           ?? null,
            'county'            => $p['county']            ?? null,
            'lat'               => isset($p['latitude'])   ? (float) $p['latitude']  : null,
            'lng'               => isset($p['longitude'])  ? (float) $p['longitude'] : null,
            'apn'               => $p['assessorID']        ?? null,
            'legal_description' => $p['legalDescription']  ?? null,
            'subdivision'       => $p['subdivision']       ?? null,
            'zoning'            => $p['zoning']            ?? null,
        ];
    }

    private function normCharacteristics(array $p): array
    {
        $feat = $p['features'] ?? [];
        return [
            'property_type'   => $p['propertyType']                          ?? null,
            'beds'            => $p['bedrooms']                              ?? null,
            'baths_total'     => $p['bathrooms']                             ?? null,
            'sqft'            => $p['squareFootage']                         ?? null,
            'lot_sqft'        => $p['lotSize']                               ?? null,
            'year_built'      => $p['yearBuilt']                             ?? null,
            'stories'         => $feat['floorCount']                         ?? null,
            'rooms_total'     => $feat['roomCount']                          ?? null,
            'unit_count'      => $feat['unitCount']                          ?? null,
            'arch_style'      => $feat['architectureType']                   ?? null,
            'exterior_type'   => $feat['exteriorType']                       ?? null,
            'foundation_type' => $feat['foundationType']                     ?? null,
            'roof_type'       => $feat['roofType']                           ?? null,
            'view_type'       => $feat['viewType']                           ?? null,
            'garage'          => isset($feat['garage'])    ? (bool) $feat['garage']    : null,
            'garage_type'     => $feat['garageType']                         ?? null,
            'garage_spaces'   => $feat['garageSpaces']                       ?? null,
            'pool'            => isset($feat['pool'])      ? (bool) $feat['pool']      : null,
            'pool_type'       => $feat['poolType']                           ?? null,
            'fireplace'       => isset($feat['fireplace']) ? (bool) $feat['fireplace'] : null,
            'fireplace_type'  => $feat['fireplaceType']                      ?? null,
            'heating'         => isset($feat['heating'])   ? (bool) $feat['heating']   : null,
            'heating_type'    => $feat['heatingType']                        ?? null,
            'cooling'         => isset($feat['cooling'])   ? (bool) $feat['cooling']   : null,
            'cooling_type'    => $feat['coolingType']                        ?? null,
        ];
    }

    private function normOwner(array $p): array
    {
        $owner = $p['owner'] ?? [];
        $names = $owner['names'] ?? [];
        $mail  = $owner['mailingAddress'] ?? [];

        return [
            'owner1_name'    => $names[0]         ?? null,
            'owner2_name'    => $names[1]         ?? null,
            'owner_type'     => $owner['type']    ?? null,
            'owner_occupied' => $p['ownerOccupied'] ?? null,
            'absentee'       => isset($p['ownerOccupied'])
                                ? ($p['ownerOccupied'] ? 'Owner-occupied' : 'Absentee owner')
                                : null,
            'mail_state'     => $mail['state'] ?? null,
            'mail_addr'      => $mail
                                ? trim(implode(', ', array_filter([
                                    $mail['addressLine1'] ?? '',
                                    $mail['city']         ?? '',
                                    $mail['state']        ?? '',
                                    $mail['zipCode']      ?? '',
                                  ])))
                                : null,
        ];
    }

    private function normValuation(array $p, array $avm, array $rent): array
    {
        $taxAssessments = $p['taxAssessments'] ?? [];
        $propertyTaxes  = $p['propertyTaxes']  ?? [];

        $assessYear   = empty($taxAssessments) ? null : max(array_keys($taxAssessments));
        $latestAssess = $assessYear ? ($taxAssessments[$assessYear] ?? []) : [];

        $taxYear  = empty($propertyTaxes) ? null : max(array_keys($propertyTaxes));
        $taxData  = $taxYear ? ($propertyTaxes[$taxYear] ?? []) : [];

        return [
            // AVM — only populated when a live /avm/value call was made
            'avm_value'      => $avm['price']           ?? null,
            'avm_low'        => $avm['priceRangeLow']   ?? null,
            'avm_high'       => $avm['priceRangeHigh']  ?? null,
            // Rent estimate — only populated when a live /avm/rent call was made
            'rent_estimate'  => $rent['rent']           ?? null,
            'rent_low'       => $rent['rentRangeLow']   ?? null,
            'rent_high'      => $rent['rentRangeHigh']  ?? null,
            // Tax assessment (from property record)
            'assessed_year'  => $assessYear,
            'assessed_land'  => $latestAssess['land']          ?? null,
            'assessed_impr'  => $latestAssess['improvements']  ?? null,
            'assessed_total' => $latestAssess['value']         ?? null,
            // Property tax
            'tax_year'       => $taxYear,
            'tax_amount'     => $taxData['total']  ?? null,
            // HOA
            'hoa_fee'        => $p['hoa']['fee']   ?? null,
        ];
    }

    private function normTransactions(array $p): array
    {
        $txns = [];

        // Full history object is keyed by date string 'YYYY-MM-DD'
        if (!empty($p['history'])) {
            foreach ($p['history'] as $dateKey => $entry) {
                $txns[] = [
                    'sale_date'  => $entry['date']  ?? $dateKey,
                    'sale_price' => $entry['price'] ?? null,
                    'event'      => $entry['event'] ?? 'Sale',
                ];
            }
            // Most recent first
            usort($txns, fn ($a, $b) => strcmp((string)($b['sale_date'] ?? ''), (string)($a['sale_date'] ?? '')));
        } elseif (!empty($p['lastSaleDate']) || !empty($p['lastSalePrice'])) {
            $txns[] = [
                'sale_date'  => $p['lastSaleDate']  ?? null,
                'sale_price' => $p['lastSalePrice'] ?? null,
                'event'      => 'Sale',
            ];
        }

        return $txns;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function latestAssessedValue(array $p): ?float
    {
        if (!empty($p['taxAssessments'])) {
            $latestYear = max(array_keys($p['taxAssessments']));
            $val = $p['taxAssessments'][$latestYear]['value'] ?? null;
            if ($val !== null) return (float) $val;
        }
        if (!empty($p['lastSalePrice'])) return (float) $p['lastSalePrice'];
        return null;
    }

    private function extractOwnerName(array $p): ?string
    {
        $names = $p['owner']['names'] ?? [];
        return $names[0] ?? null;
    }
}
