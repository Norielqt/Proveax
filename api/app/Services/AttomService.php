<?php
namespace App\Services;

use App\Models\AttomProperty;
use Illuminate\Support\Facades\Http;

class AttomService
{
    private const BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

    private function client()
    {
        return Http::withHeaders([
            'apikey' => config('services.attom.key'),
            'Accept' => 'application/json',
        ])->baseUrl(self::BASE)->timeout(30)->withOptions([
            'verify' => app()->isProduction(),
        ]);
    }

    /**
     * Search properties by ZIP / city / state / lat-lng using the basicprofile endpoint.
     * basicprofile returns assessment + sale data that snapshot does not.
     * Returns ['data' => [...], 'total' => int] or ['error' => string]
     */
    public function snapshot(array $params): array
    {
        $baseParams = array_filter(array_merge($params, ['pagesize' => 1000]), fn($v) => $v !== null && $v !== '');
        $first      = $this->client()->get('/property/basicprofile', array_merge($baseParams, ['page' => 1]));

        if ($first->failed()) {
            return ['data' => [], 'total' => 0, 'error' => $first->json('status.msg') ?? 'ATTOM API error'];
        }

        $page1      = $first->json('property', []);
        $total      = (int) $first->json('status.total', count($page1));
        $allRows    = $page1;

        // Fetch all remaining pages in parallel, capped at 5,000 total.
        $totalCapped    = min($total, 3000);
        $remainingPages = (int) ceil($totalCapped / 1000) - 1; // pages 2..N
        if ($remainingPages > 0) {
            $apiKey = config('services.attom.key');
            $opts   = ['verify' => app()->isProduction()];

            $poolRequests = [];
            for ($page = 2; $page <= $remainingPages + 1; $page++) {
                $poolRequests[] = array_merge($baseParams, ['page' => $page]);
            }

            $responses = Http::pool(function ($pool) use ($poolRequests, $apiKey, $opts) {
                return array_map(
                    fn($p) => $pool->withHeaders(['apikey' => $apiKey, 'Accept' => 'application/json'])
                                   ->timeout(30)->withOptions($opts)
                                   ->get(self::BASE . '/property/basicprofile', $p),
                    $poolRequests
                );
            });

            foreach ($responses as $resp) {
                if (!$resp->failed()) {
                    $allRows = array_merge($allRows, $resp->json('property', []));
                }
            }
        }

        $rows = array_map([$this, 'normaliseSnapshot'], $allRows);

        // Save everything to local DB — subsequent searches are instant.
        AttomProperty::upsertBatch($rows);

        return [
            'data'  => $rows,
            'total' => $total,
        ];
    }

    /**
     * Full property detail by address OR by ATTOM ID.
     * address1 = street e.g. "123 Ocean Dr"
     * address2 = "City ST ZIP" e.g. "Miami FL 33139"
     * attomId  = numeric ATTOM property ID (alternative to address lookup)
     */
    public function detail(string $address1 = '', string $address2 = '', ?int $attomId = null): array
    {
        $params = $attomId
            ? ['id' => $attomId]
            : ['address1' => $address1, 'address2' => $address2];

        // Fetch property detail and owner data concurrently.
        [$detailResp, $ownerResp] = \Illuminate\Support\Facades\Http::pool(fn ($pool) => [
            $pool->withHeaders(['apikey' => config('services.attom.key'), 'Accept' => 'application/json'])
                 ->timeout(15)->withOptions(['verify' => app()->isProduction()])
                 ->get(self::BASE . '/property/basicprofile', $params),
            $pool->withHeaders(['apikey' => config('services.attom.key'), 'Accept' => 'application/json'])
                 ->timeout(15)->withOptions(['verify' => app()->isProduction()])
                 ->get(self::BASE . '/property/detailowner', $params),
        ]);

        if ($detailResp->failed()) {
            return ['data' => null, 'error' => $detailResp->json('status.msg') ?? 'ATTOM API error'];
        }

        $raw   = $detailResp->json('property.0');
        $owner = (!$ownerResp->failed()) ? ($ownerResp->json('property.0.owner') ?? []) : [];

        return ['data' => $raw ? $this->normaliseDetail($raw, $owner) : null];
    }

    /**
     * Comprehensive property report — fires 6 ATTOM endpoints concurrently.
     * Returns every section needed for the full PropertyDetail page.
     */
    public function fullDetail(string $address1 = '', string $address2 = '', ?int $attomId = null): array
    {
        $idParams   = $attomId ? ['id' => $attomId] : ['address1' => $address1, 'address2' => $address2];
        $avmParams  = ($address1 && $address2)
            ? ['address1' => $address1, 'address2' => $address2]
            : $idParams; // fallback — ATTOM AVM also accepts id

        $h = ['apikey' => config('services.attom.key'), 'Accept' => 'application/json'];
        $o = ['verify' => app()->isProduction()];

        [
            $basic, $ownerResp, $mortgResp,
            $salesResp, $permResp, $assessResp, $avmResp,
        ] = Http::pool(fn ($pool) => [
            $pool->withHeaders($h)->timeout(15)->withOptions($o)->get(self::BASE . '/property/basicprofile',  $idParams),
            $pool->withHeaders($h)->timeout(15)->withOptions($o)->get(self::BASE . '/property/detailowner',   $idParams),
            $pool->withHeaders($h)->timeout(15)->withOptions($o)->get(self::BASE . '/property/detailmortgage',$idParams),
            $pool->withHeaders($h)->timeout(15)->withOptions($o)->get(self::BASE . '/saleshistory/snapshot',  $idParams),
            $pool->withHeaders($h)->timeout(15)->withOptions($o)->get(self::BASE . '/property/buildingpermits',$idParams),
            $pool->withHeaders($h)->timeout(15)->withOptions($o)->get(self::BASE . '/assessment/detail',      $idParams),
            $pool->withHeaders($h)->timeout(15)->withOptions($o)->get(self::BASE . '/attomavm/detail',        $avmParams),
        ]);

        if ($basic->failed()) {
            return ['data' => null, 'error' => $basic->json('status.msg') ?? 'ATTOM API error'];
        }

        $p       = $basic->json('property.0')     ?? [];
        $owner   = (!$ownerResp->failed())  ? ($ownerResp->json('property.0.owner')        ?? []) : [];
        $mortg   = (!$mortgResp->failed())  ? ($mortgResp->json('property.0.mortgage')     ?? []) : [];
        $bldgExt = (!$mortgResp->failed())  ? ($mortgResp->json('property.0.building')     ?? []) : [];
        $lotExt  = (!$mortgResp->failed())  ? ($mortgResp->json('property.0.lot')          ?? []) : [];
        $sales   = (!$salesResp->failed())  ? ($salesResp->json('property.0.salehistory')  ?? []) : [];
        $permits = (!$permResp->failed())   ? ($permResp->json('property.0.buildingPermits') ?? []) : [];
        $assess  = (!$assessResp->failed()) ? ($assessResp->json('property.0.assessment')  ?? []) : [];
        $avmRaw  = (!$avmResp->failed())    ? ($avmResp->json('property.0')                ?? []) : [];

        // Normalise sales — ensure it's always an array of records
        if (isset($sales['saleSearchDate'])) $sales = [$sales]; // single record

        return ['data' => [
            'location'       => $this->normLocation($p),
            'characteristics'=> $this->normCharacteristics($p, $bldgExt, $lotExt),
            'owner'          => $this->normOwner($owner),
            'valuation'      => $this->normValuation($p, $assess, $avmRaw),
            'transactions'   => $this->normTransactions($sales),
            'mortgage'       => $this->normMortgage($mortg),
            'permits'        => $this->normPermits($permits),
        ]];
    }

    // ─── fullDetail Normalisers ──────────────────────────────────────────────

    private function normLocation(array $p): array
    {
        $id   = $p['identifier'] ?? [];
        $addr = $p['address']    ?? [];
        $loc  = $p['location']   ?? [];
        $area = $p['area']       ?? [];
        return [
            'address_full'   => $addr['oneLine']         ?? null,
            'line1'          => $addr['line1']            ?? null,
            'city'           => $addr['locality']         ?? null,
            'state'          => $addr['countrySubd']      ?? null,
            'zip'            => $addr['postal1']          ?? null,
            'zip4'           => $addr['postal2']          ?? null,
            'lat'            => isset($loc['latitude'])   ? (float) $loc['latitude']  : null,
            'lng'            => isset($loc['longitude'])  ? (float) $loc['longitude'] : null,
            'accuracy'       => $loc['accuracy']          ?? null,
            'fips'           => $id['fips']               ?? null,
            'apn'            => $id['apn']                ?? null,
            'attom_id'       => $id['attomId']            ?? null,
            'county'         => $area['countrySecSubd']   ?? null,
            'municipality'   => $area['munName']          ?? null,
            'subdivision'    => $area['subdName']         ?? null,
            'school_dist'    => $area['schoolTaxDistrict']?? null,
            'elevation'      => isset($loc['elevation']) && $loc['elevation'] !== ''
                                ? (float) $loc['elevation'] : null,
        ];
    }

    private function normCharacteristics(array $p, array $bldg, array $lot): array
    {
        // Prefer richer detailmortgage building; fall back to basicprofile
        $bldgBase = $p['building']  ?? [];
        $sumBase  = $p['summary']   ?? [];
        $lotBase  = $p['lot']       ?? $lot;

        $size   = $bldg['size']         ?? $bldgBase['size']         ?? [];
        $rooms  = $bldg['rooms']        ?? $bldgBase['rooms']        ?? [];
        $constr = $bldg['construction'] ?? [];
        $park   = $bldg['parking']      ?? [];
        $intr   = $bldg['interior']     ?? [];
        $bsum   = $bldg['summary']      ?? [];

        return [
            'property_type'   => ($p['summary']['propclass'] ?? null) ?: ($p['summary']['propertyType'] ?? null),
            'prop_subtype'    => $p['summary']['propsubtype'] ?? null,
            'beds'            => $rooms['beds']           ?? null,
            'baths_full'      => $rooms['bathsfull']      ?? null,
            'baths_half'      => $rooms['bathshalf']      ?? null,
            'baths_total'     => $rooms['bathstotal']     ?? null,
            'rooms_total'     => $rooms['roomsTotal']     ?? null,
            'sqft_universal'  => $size['universalsize']   ?? null,
            'sqft_living'     => $size['livingsize']      ?? null,
            'sqft_gross'      => $size['grosssizeadjusted'] ?? null,
            'lot_acres'       => $lotBase['lotsize1']     ?? null,
            'lot_sqft'        => $lotBase['lotsize2']     ?? null,
            'year_built'      => $p['summary']['yearbuilt'] ?? null,
            'year_built_eff'  => $bsum['yearbuilteffective'] ?? null,
            'stories'         => $bsum['levels']          ?? null,
            'arch_style'      => $bsum['archStyle']       ?? null,
            'quality'         => $bsum['quality']         ?? null,
            'construction'    => $constr['constructiontype'] ?? null,
            'frame_type'      => $constr['frameType']     ?? null,
            'roof_cover'      => $constr['roofcover']     ?? null,
            'roof_shape'      => $constr['roofShape']     ?? null,
            'wall_type'       => $constr['wallType']      ?? null,
            'garage_type'     => $park['prkgType']        ?? null,
            'garage_spaces'   => $park['prkgSpaces']      ?? null,
            'pool'            => $intr['pool']            ?? null,
            'pool_type'       => $intr['poolType']        ?? null,
            'fireplace_count' => $intr['fplccount']       ?? null,
            'fireplace_type'  => $intr['fplcType']        ?? null,
            'heating'         => $intr['HVACtype'] ?? $intr['hvactype'] ?? null,
            'cooling'         => $intr['cooltype'] ?? null,
            'fuel_type'       => $intr['fuelType'] ?? $intr['fueltype'] ?? null,
            'basement'        => $intr['bsmtType'] ?? $intr['bsmttype'] ?? null,
            'patio_type'      => $intr['patioType'] ?? null,
            'deck_ind'        => $intr['deckInd'] ?? null,
        ];
    }

    private function normOwner(array $own): array
    {
        return [
            'owner1_name'    => $this->formatOwnerName($own['owner1'] ?? []),
            'owner2_name'    => $this->formatOwnerName($own['owner2'] ?? []),
            'owner_type'     => $this->ownershipTypeLabel($own['ownerrelationshiptype'] ?? null),
            'absentee'       => $this->absenteeLabel($own['absenteeownerstatus'] ?? null),
            'corporate'      => match(strtoupper((string)($own['corporateindicator'] ?? ''))) {
                                    'Y' => 'Yes (LLC/Corp/Trust)', 'N' => 'No', default => null,
                                },
            'mail_addr'      => ($own['mailingaddressoneline'] ?? '') !== ''
                                ? $own['mailingaddressoneline'] : null,
        ];
    }

    private function normValuation(array $p, array $assess, array $avmRaw): array
    {
        $tax    = $assess['tax']      ?? ($p['assessment']['tax']      ?? []);
        $assd   = $assess['assessed'] ?? ($p['assessment']['assessed'] ?? []);
        $mkt    = $assess['market']   ?? ($p['assessment']['market']   ?? []);
        $appr   = $assess['appraised']?? [];
        $calcA  = $assess['calculations'] ?? [];
        $avmA   = $avmRaw['avm']     ?? [];

        // Estimate equity: AVM - mortgage balance is complex; just return market/assessed total
        $valueBase = $avmA['amount']['value']
                  ?? $mkt['mktTtlValue']
                  ?? $assd['assdttlvalue']
                  ?? null;

        return [
            'avm_value'       => $avmA['amount']['value'] ?? null,
            'avm_low'         => $avmA['amount']['low']   ?? null,
            'avm_high'        => $avmA['amount']['high']  ?? null,
            'avm_confidence'  => $avmA['eventDetail']['confidence'] ?? null,
            'avm_date'        => $avmA['eventDate']       ?? null,
            'assessed_land'   => $assd['assdlandvalue']   ?? null,
            'assessed_total'  => $assd['assdttlvalue']    ?? null,
            'market_land'     => $mkt['mktLandValue']     ?? null,
            'market_impr'     => $mkt['mktImprValue']     ?? null,
            'market_total'    => $mkt['mktTtlValue']      ?? null,
            'appraised_land'  => $appr['apprlandvalue']   ?? null,
            'appraised_impr'  => $appr['apprimprvalue']   ?? null,
            'appraised_total' => $appr['apprttlvalue']    ?? null,
            'tax_amount'      => $tax['taxamt']           ?? null,
            'tax_year'        => $tax['taxyear']          ?? null,
        ];
    }

    private function normTransactions(array $sales): array
    {
        return array_map(function ($s) {
            $amt = $s['amount'] ?? [];
            return [
                'sale_date'    => $s['saleSearchDate']      ?? $s['saleTransDate'] ?? null,
                'trans_date'   => $s['saleTransDate']       ?? null,
                'sale_price'   => $amt['saleamt']           ?? null,
                'doc_num'      => $amt['saledocnum']        ?? null,
                'trans_type'   => $amt['saletranstype']     ?? null,
                'deed_type'    => $s['deedType']            ?? $amt['deedtype']    ?? null,
                'seller'       => $s['sellerName']          ?? null,
            ];
        }, $sales);
    }

    private function normMortgage(array $m): array
    {
        if (empty($m)) return [];
        $loanTypes = [
            'CNV' => 'Conventional', 'FHA' => 'FHA', 'VA' => 'VA',
            'CON' => 'Conventional', 'AGR' => 'Agricultural',
            'SBA' => 'SBA', 'COM' => 'Commercial',
        ];
        $deedTypes = ['GD' => 'Grant Deed', 'WD' => 'Warranty Deed', 'QC' => 'Quitclaim Deed', 'TD' => 'Trust Deed'];
        return [
            'amount'          => $m['amount']       ?? null,
            'lender'          => $m['lender']['lastname'] ?? null,
            'date'            => $m['date']         ?? null,
            'loan_type'       => $loanTypes[$m['loantypecode'] ?? ''] ?? ($m['loantypecode'] ?? null),
            'deed_type'       => $deedTypes[$m['deedtype'] ?? ''] ?? ($m['deedtype'] ?? null),
            'interest_rate'   => $m['interestrate'] ?? null,
            'rate_type'       => $m['interestratetype'] ?? null,
            'term_months'     => $m['term']         ?? null,
            'due_date'        => $m['duedate']      ?? null,
            'title_company'   => $m['title']['companyname'] ?? null,
        ];
    }

    private function normPermits(array $permits): array
    {
        return array_map(fn ($permit) => [
            'date'        => $permit['effectiveDate'] ?? null,
            'number'      => $permit['permitNumber']  ?? null,
            'type'        => $permit['type']          ?? null,
            'description' => $permit['description']   ?? null,
            'value'       => $permit['jobValue']      ?? null,
            'contractor'  => $permit['businessName']  ?? null,
            'status'      => $permit['status']        ?? null,
            'tags'        => $permit['classifiers']   ?? [],
        ], $permits);
    }

    /**
     * Automated Valuation Model (AVM) for a property.
     */
    public function avm(string $address1, string $address2): array
    {
        $response = $this->client()->get('/attomavm/detail', [
            'address1' => $address1,
            'address2' => $address2,
        ]);

        if ($response->failed()) {
            return ['data' => null, 'error' => $response->json('status.msg') ?? 'ATTOM API error'];
        }

        $raw = $response->json('property.0');
        if (!$raw) return ['data' => null];

        return ['data' => [
            'attom_id'        => $raw['identifier']['attomId'] ?? null,
            'avm_value'       => $raw['avm']['amount']['value'] ?? null,
            'avm_low'         => $raw['avm']['amount']['low']   ?? null,
            'avm_high'        => $raw['avm']['amount']['high']  ?? null,
            'avm_date'        => $raw['avm']['eventDate']       ?? null,
            'confidence'      => $raw['avm']['eventDetail']['confidence'] ?? null,
        ]];
    }

    // ─── Normalisers ─────────────────────────────────────────────────────────

    private function normaliseSnapshot(array $p): array
    {
        $id     = $p['identifier']  ?? [];
        $addr   = $p['address']     ?? [];
        $loc    = $p['location']    ?? [];
        $lot    = $p['lot']         ?? [];
        $bldg   = $p['building']    ?? [];
        $sum    = $p['summary']     ?? [];
        $assess = $p['assessment']  ?? [];

        return [
            'attom_id'        => $id['attomId']                     ?? null,
            'street'          => $addr['line1']                      ?? null,
            'address'         => trim(($addr['line1'] ?? '') . ' ' . ($addr['line2'] ?? '')),
            'city'            => $addr['locality']                   ?? null,
            'state'           => $addr['countrySubd']                ?? null,
            'zip'             => $addr['postal1']                    ?? null,
            'lat'             => isset($loc['latitude'])  ? (float) $loc['latitude']  : null,
            'lng'             => isset($loc['longitude']) ? (float) $loc['longitude'] : null,
            'property_type'   => $sum['propclass']                   ?? null,
            'bedrooms'        => $bldg['rooms']['beds']              ?? null,
            'bathrooms'       => $bldg['rooms']['bathstotal'] ?? $bldg['rooms']['bathsTotal'] ?? null,
            'square_feet'     => $bldg['size']['universalSize']      ?? null,
            'lot_size'        => $lot['lotsize2']                    ?? null,
            'year_built'      => $sum['yearbuilt']                   ?? null,
            'estimated_value' => $assess['market']['mktTtlValue']
                              ?? $assess['assessed']['assdTtlValue']
                              ?? ($p['sale']['saleAmountData']['saleAmt'] ?? null),
            'owner_name'      => ($p['owner']['owner1']['lastName'] ?? '') !== ''
                ? trim(($p['owner']['owner1']['firstName'] ?? '') . ' ' . ($p['owner']['owner1']['lastName'] ?? ''))
                : null,
        ];
    }

    private function formatOwnerName(array $o): ?string
    {
        // detailowner uses lowercase 'fullname' directly.
        if (!empty($o['fullname'])) return $o['fullname'];
        // Fallback: compose from parts (used by basicprofile owner1 if ever present).
        $parts = array_filter([
            $o['firstName']  ?? $o['firstname']  ?? '',
            $o['middleName'] ?? $o['middlename'] ?? '',
            $o['lastName']   ?? $o['lastname']   ?? '',
        ], fn($v) => $v !== '');
        return $parts ? implode(' ', $parts) : null;
    }

    private function absenteeLabel(?string $code): ?string
    {
        return match(strtoupper((string) $code)) {
            'O' => 'Owner-occupied',
            'A' => 'Absentee owner',
            'R' => 'Renter-occupied',
            default => null,
        };
    }

    private function ownershipTypeLabel(?string $code): ?string
    {
        if (!$code) return null;
        $map = [
            'JT' => 'Joint Tenants',
            'TC' => 'Tenants in Common',
            'SP' => 'Sole & Separate',
            'TR' => 'Trust',
            'CP' => 'Corporation',
            'HW' => 'Husband & Wife',
            'CO' => 'Community Property',
            'LF' => 'Life Estate',
            'IN' => 'Individual',
        ];
        return $map[strtoupper($code)] ?? $code;
    }

    private function normaliseDetail(array $p, array $owner = []): array
    {
        $base  = $this->normaliseSnapshot($p);
        $sale  = $p['sale']          ?? [];
        $tax   = $p['assessment']    ?? [];
        $legal = $p['lot']           ?? [];
        $area  = $p['area']          ?? [];
        $id    = $p['identifier']    ?? [];
        $addr  = $p['address']       ?? [];
        $loc   = $p['location']      ?? [];
        // $owner is from /property/detailowner (all-lowercase keys)

        return array_merge($base, [
            'last_sale_date'   => $sale['saleSearchDate']                        ?? $sale['salesearchdate']                      ?? null,
            'last_sale_price'  => $sale['saleAmountData']['saleAmt']             ?? $sale['amount']['saleamt']                   ?? null,
            'tax_year'         => $tax['tax']['taxYear']                         ?? null,
            'tax_amount'       => $tax['tax']['taxAmt']                          ?? $tax['tax']['taxamt']                        ?? null,
            'lot_acres'        => $legal['lotsize1']                             ?? null,
            'legal_desc'       => $legal['legal1']                               ?? null,
            // ── Location data ─────────────────────────────────────────────
            'address_full'     => $addr['oneLine']                               ?? null,
            'zip_plus4'        => $addr['postal1plus4']                          ?? null,
            'fips'             => $id['fips']                                    ?? null,
            'apn'              => $id['apn']                                     ?? null,
            'county'           => $area['countrySecSubd']                        ?? null,
            'municipality'     => $area['munName']                               ?? null,
            'subdivision'      => $area['subdName']                              ?? null,
            'school_district'  => $area['schoolTaxDistrict']                     ?? null,
            'elevation'        => isset($loc['elevation']) && $loc['elevation'] !== ''
                                  ? (float) $loc['elevation'] : null,
            // ── Owner info (from /property/detailowner, all lowercase) ────
            'owner1_name'      => $this->formatOwnerName($owner['owner1'] ?? []),
            'owner2_name'      => $this->formatOwnerName($owner['owner2'] ?? []),
            'owner_type'       => $this->ownershipTypeLabel($owner['ownerrelationshiptype'] ?? null),
            'absentee_ind'     => $this->absenteeLabel($owner['absenteeownerstatus']  ?? null),
            'corporate_ind'    => match(strtoupper((string)($owner['corporateindicator'] ?? ''))) {
                                      'Y' => 'Yes (LLC/Corp/Trust)',
                                      'N' => 'No',
                                      default => null,
                                  },
            'owner_mail_addr'  => ($owner['mailingaddressoneline'] ?? '') !== ''
                                  ? $owner['mailingaddressoneline'] : null,
        ]);
    }
}
