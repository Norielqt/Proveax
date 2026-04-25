<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RentcastProperty;
use App\Services\RentcastService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RentcastController extends Controller
{
    // Cache TTL: re-fetch from API after this many days
    private const CACHE_TTL_DAYS = 30;

    public function __construct(private RentcastService $rentcast) {}

    /**
     * Search the national Rentcast database.
     * GET /api/rentcast/search?zipCode=33139&propertyType=Single+Family
     * GET /api/rentcast/search?city=Miami&state=FL
     * GET /api/rentcast/search?latitude=25.77&longitude=-80.19&radius=5
     * GET /api/rentcast/search?zipCode=33139&loadMore=true   ← fetch next 500
     */
    public function search(Request $request)
    {
        $v = $request->validate([
            'zipCode'      => 'nullable|string|max:10',
            'postalcode'   => 'nullable|string|max:10',
            'city'         => 'nullable|string|max:100',
            'state'        => 'nullable|string|size:2',
            'latitude'     => 'nullable|numeric|between:-90,90',
            'longitude'    => 'nullable|numeric|between:-180,180',
            'radius'       => 'nullable|numeric|min:0.1|max:25',
            'propertyType' => 'nullable|string|in:Single Family,Multi-Family,Apartment,Condo,Townhouse,Manufactured,Land',
            'propertytype' => 'nullable|string|in:Single Family,Multi-Family,Apartment,Condo,Townhouse,Manufactured,Land',
            'loadMore'     => 'nullable|boolean',
            // Advanced attribute filters
            'bedroomsMin'  => 'nullable|integer|min:0|max:20',
            'bedroomsMax'  => 'nullable|integer|min:0|max:20',
            'bathroomsMin' => 'nullable|numeric|min:0|max:20',
            'bathroomsMax' => 'nullable|numeric|min:0|max:20',
            'sqftMin'      => 'nullable|integer|min:0',
            'sqftMax'      => 'nullable|integer|min:0',
            'yearBuiltMin' => 'nullable|integer|min:1800|max:2030',
            'yearBuiltMax' => 'nullable|integer|min:1800|max:2030',
            'lotSizeMin'   => 'nullable|integer|min:0',
            'lotSizeMax'   => 'nullable|integer|min:0',
            'ownerOccupied' => 'nullable|in:absentee,owner',
            'strategy'      => 'nullable|string|in:out_of_state_owner,high_equity,cash_buyers',
            'address'       => 'nullable|string|max:200',
        ]);

        // Map frontend strategy values to backend filter params where possible
        $strategy = $v['strategy'] ?? null;

        $address    = isset($v['address']) ? trim($v['address']) : null;
        $hasAddress = !empty($address);
        $zip        = $v['zipCode']  ?? $v['postalcode'] ?? null;
        $hasZip     = !empty($zip);
        $hasCity    = !empty($v['city']) && !empty($v['state']);
        $hasLL      = !empty($v['latitude']) && !empty($v['longitude']);
        $loadMore   = !empty($v['loadMore']);
        $typeFilter = $v['propertyType'] ?? $v['propertytype'] ?? null;

        if (!$hasZip && !$hasCity && !$hasLL && !$hasAddress) {
            return response()->json(['error' => 'Provide zipCode, city + state, latitude + longitude, or a street address.'], 422);
        }

        // ── Address-specific search: try DB first, then live API ──────────
        if ($hasAddress) {
            $rows = $this->queryToRows($v, $zip, $hasZip, $hasCity, $typeFilter, $strategy);
            if (!empty($rows)) {
                return response()->json(['data' => $rows, 'total' => count($rows), 'has_more' => false, 'source' => 'cache']);
            }
            // Not cached yet — hit RentCast directly for this address
            set_time_limit(0);
            $result = $this->rentcast->snapshot([
                'address'      => $address,
                'zipCode'      => $zip,
                'city'         => $v['city']  ?? null,
                'state'        => $v['state'] ?? null,
                'propertyType' => $typeFilter,
            ]);
            $result['data']     = $this->stripRawJson($result['data'] ?? []);
            $result['has_more'] = false;
            return response()->json($result);
        }

        // Build canonical cache key (ZIP and city searches only)
        $queryKey = null;
        if ($hasZip)       $queryKey = 'zip:'  . strtolower($zip);
        elseif ($hasCity)  $queryKey = 'city:' . strtolower($v['city']) . ':' . strtolower($v['state']);

        // ── LOAD MORE: fetch next page from API and append to DB cache ────
        if ($loadMore && $queryKey) {
            $record = DB::table('rentcast_fetched_queries')->where('query_key', $queryKey)->first();

            // Already have everything — just return DB rows
            if ($record && $record->is_complete) {
                $rows = $this->queryToRows($v, $zip, $hasZip, $hasCity, $typeFilter, $strategy);
                return response()->json(['data' => $rows, 'total' => count($rows), 'has_more' => false, 'source' => 'cache']);
            }

            $offset = $record ? (int) $record->last_offset : 500;
            set_time_limit(0);
            $result = $this->rentcast->snapshot([
                'zipCode'      => $zip,
                'city'         => $v['city']      ?? null,
                'state'        => $v['state']     ?? null,
                'propertyType' => $typeFilter,
                'offset'       => $offset,
                'bedroomsMin'  => $v['bedroomsMin']  ?? null,
                'bedroomsMax'  => $v['bedroomsMax']  ?? null,
                'bathroomsMin' => $v['bathroomsMin'] ?? null,
                'bathroomsMax' => $v['bathroomsMax'] ?? null,
                'sqftMin'      => $v['sqftMin']      ?? null,
                'sqftMax'      => $v['sqftMax']      ?? null,
                'yearBuiltMin' => $v['yearBuiltMin'] ?? null,
                'yearBuiltMax' => $v['yearBuiltMax'] ?? null,
                'lotSizeMin'   => $v['lotSizeMin']   ?? null,
                'lotSizeMax'   => $v['lotSizeMax']   ?? null,
            ]);

            $newCount   = count($result['data'] ?? []);
            $isComplete = $newCount < 500;
            $newOffset  = $offset + $newCount;

            DB::table('rentcast_fetched_queries')->upsert([[
                'query_key'    => $queryKey,
                'result_count' => ($record ? (int) $record->result_count : 0) + $newCount,
                'last_offset'  => $newOffset,
                'is_complete'  => $isComplete,
                'fetched_at'   => now(),
            ]], ['query_key'], ['result_count', 'last_offset', 'is_complete', 'fetched_at']);

            // Return ALL cached rows (including the new batch just inserted)
            $rows = $this->queryToRows($v, $zip, $hasZip, $hasCity, $typeFilter, $strategy);
            return response()->json(['data' => $rows, 'total' => count($rows), 'has_more' => !$isComplete, 'source' => 'api']);
        }

        // ── Serve from DB cache if this query was fetched before ──────────
        if ($queryKey) {
            $cached = DB::table('rentcast_fetched_queries')
                ->where('query_key', $queryKey)
                ->where('fetched_at', '>=', now()->subDays(self::CACHE_TTL_DAYS))
                ->first();

            if ($cached) {
                // Bust cache if properties are missing raw_json (pre-migration records) —
                // re-fetch from live API so raw_json and last_sale_price are populated.
                $hasStaleRows = $this->localQuery($v, $zip, $hasZip, $hasCity, $typeFilter)
                    ->whereNull('raw_json')
                    ->exists();

                if (!$hasStaleRows) {
                    $rows    = $this->queryToRows($v, $zip, $hasZip, $hasCity, $typeFilter, $strategy);
                    $hasMore = !(bool) $cached->is_complete;
                    return response()->json(['data' => $rows, 'total' => count($rows), 'has_more' => $hasMore, 'source' => 'cache']);
                }

                // Stale rows detected — delete the query key so the live API path re-fetches below
                DB::table('rentcast_fetched_queries')->where('query_key', $queryKey)->delete();
            }
        }

        // ── Lat/lng pan: serve from DB if enough local rows ───────────────
        if (!$queryKey) {
            $count = $this->localQuery($v, $zip, $hasZip, $hasCity, $typeFilter)->count();
            if ($count >= 500) {
                $rows = $this->queryToRows($v, $zip, $hasZip, $hasCity, $typeFilter, $strategy);
                return response()->json(['data' => $rows, 'total' => count($rows), 'has_more' => false, 'source' => 'cache']);
            }
        }

        // ── First-time live API call (1 request) ──────────────────────────
        set_time_limit(0);
        $result = $this->rentcast->snapshot([
            'zipCode'      => $zip,
            'city'         => $v['city']      ?? null,
            'state'        => $v['state']     ?? null,
            'latitude'     => $v['latitude']  ?? null,
            'longitude'    => $v['longitude'] ?? null,
            'radius'       => $v['radius']    ?? null,
            'propertyType' => $typeFilter,
            'bedroomsMin'  => $v['bedroomsMin']  ?? null,
            'bedroomsMax'  => $v['bedroomsMax']  ?? null,
            'bathroomsMin' => $v['bathroomsMin'] ?? null,
            'bathroomsMax' => $v['bathroomsMax'] ?? null,
            'sqftMin'      => $v['sqftMin']      ?? null,
            'sqftMax'      => $v['sqftMax']      ?? null,
            'yearBuiltMin' => $v['yearBuiltMin'] ?? null,
            'yearBuiltMax' => $v['yearBuiltMax'] ?? null,
            'lotSizeMin'   => $v['lotSizeMin']   ?? null,
            'lotSizeMax'   => $v['lotSizeMax']   ?? null,
        ]);

        $fetched    = count($result['data'] ?? []);
        $isComplete = $fetched < 500;

        if ($queryKey && empty($result['error'])) {
            DB::table('rentcast_fetched_queries')->upsert([[
                'query_key'    => $queryKey,
                'result_count' => $fetched,
                'last_offset'  => $fetched,
                'is_complete'  => $isComplete,
                'fetched_at'   => now(),
            ]], ['query_key'], ['result_count', 'last_offset', 'is_complete', 'fetched_at']);
        }

        if ($strategy && !empty($result['data'])) {
            $result['data'] = $this->filterRowsByStrategy($result['data'], $strategy);
            $result['total'] = count($result['data']);
        }

        // Strip raw_json — it is stored in DB only, never sent to the client
        $result['data'] = $this->stripRawJson($result['data'] ?? []);
        $result['has_more'] = !$isComplete;
        return response()->json($result);
    }

    /**
     * GET /api/rentcast/listings — fetch MLS sale listings from Rentcast.
     * GET /api/rentcast/listings?zipCode=33139&status=Active
     * GET /api/rentcast/listings?zipCode=33139&status=Inactive&listingType=Pending
     */
    public function listings(Request $request)
    {
        $v = $request->validate([
            'zipCode'     => 'nullable|string|max:10',
            'postalcode'  => 'nullable|string|max:10',
            'city'        => 'nullable|string|max:100',
            'state'       => 'nullable|string|size:2',
            'latitude'    => 'nullable|numeric|between:-90,90',
            'longitude'   => 'nullable|numeric|between:-180,180',
            'radius'      => 'nullable|numeric|min:0.1|max:25',
            'status'      => 'nullable|string|in:Active,Inactive',
            'listingType' => 'nullable|string|in:Active,Pending,Withdrawn,Sold,ForSale',
        ]);

        $zip    = $v['zipCode'] ?? $v['postalcode'] ?? null;
        $hasZip = !empty($zip);
        $hasCity = !empty($v['city']) && !empty($v['state']);
        $hasLL   = !empty($v['latitude']) && !empty($v['longitude']);

        if (!$hasZip && !$hasCity && !$hasLL) {
            return response()->json(['error' => 'Provide zipCode, city + state, or latitude + longitude.'], 422);
        }

        set_time_limit(0);
        $result = $this->rentcast->listings([
            'zipCode'     => $zip,
            'city'        => $v['city']        ?? null,
            'state'       => $v['state']       ?? null,
            'latitude'    => $v['latitude']    ?? null,
            'longitude'   => $v['longitude']   ?? null,
            'radius'      => $v['radius']      ?? null,
            'status'      => $v['status']      ?? 'Active',
            'listingType' => $v['listingType'] ?? null,
        ]);

        // Strip raw_json before sending to client
        $result['data'] = $this->stripRawJson($result['data'] ?? []);
        return response()->json($result);
    }

    /**
     * Reusable local DB query builder for search filters.
     */
    private function localQuery(array $v, ?string $zip, bool $hasZip, bool $hasCity, ?string $typeFilter)
    {
        $q = RentcastProperty::query();

        if ($hasZip) {
            $q->where('zip', $zip);
        } elseif ($hasCity) {
            $q->where('city', $v['city'])->where('state', $v['state']);
        } elseif (!empty($v['latitude']) && !empty($v['longitude'])) {
            $radiusMiles = (float) ($v['radius'] ?? 5);
            $latDelta    = $radiusMiles / 69;
            $lngDelta    = $radiusMiles / (69 * cos(deg2rad((float) $v['latitude'])));
            $q->whereBetween('lat', [$v['latitude'] - $latDelta, $v['latitude'] + $latDelta])
              ->whereBetween('lng', [$v['longitude'] - $lngDelta, $v['longitude'] + $lngDelta]);
        }

        if ($typeFilter) $q->where('property_type', $typeFilter);

        // Address filter — narrow to matching street (combined with zip/city for speed)
        if (!empty($v['address'])) {
            $q->whereRaw('LOWER(street) LIKE ?', ['%' . strtolower(trim($v['address'])) . '%']);
        }

        // Only return properties that have coordinates — ensures list count matches map pins
        $q->whereNotNull('lat')->whereNotNull('lng');

        if (!empty($v['bedroomsMin']))  $q->where('bedrooms',    '>=', (int)   $v['bedroomsMin']);
        if (!empty($v['bedroomsMax']))  $q->where('bedrooms',    '<=', (int)   $v['bedroomsMax']);
        if (!empty($v['bathroomsMin'])) $q->where('bathrooms',   '>=', (float) $v['bathroomsMin']);
        if (!empty($v['bathroomsMax'])) $q->where('bathrooms',   '<=', (float) $v['bathroomsMax']);
        if (!empty($v['sqftMin']))      $q->where('square_feet', '>=', (int)   $v['sqftMin']);
        if (!empty($v['sqftMax']))      $q->where('square_feet', '<=', (int)   $v['sqftMax']);
        if (!empty($v['yearBuiltMin'])) $q->where('year_built',  '>=', (int)   $v['yearBuiltMin']);
        if (!empty($v['yearBuiltMax'])) $q->where('year_built',  '<=', (int)   $v['yearBuiltMax']);
        if (!empty($v['lotSizeMin']))   $q->where('lot_size',    '>=', (int)   $v['lotSizeMin']);
        if (!empty($v['lotSizeMax']))   $q->where('lot_size',    '<=', (int)   $v['lotSizeMax']);

        $leadType = $v['ownerOccupied'] ?? null;
        if ($leadType === 'absentee') $q->where('owner_occupied', false);
        if ($leadType === 'owner')    $q->where('owner_occupied', true);

        return $q->orderByDesc('estimated_value');
    }

    /**
     * Run a local DB query and apply PHP-level strategy post-filtering,
     * returning plain search-row arrays ready for JSON output.
     */
    private function queryToRows(array $v, ?string $zip, bool $hasZip, bool $hasCity, ?string $typeFilter, ?string $strategy): array
    {
        $collection = $this->localQuery($v, $zip, $hasZip, $hasCity, $typeFilter)->get();

        if ($strategy) {
            $collection = $collection->filter(fn (RentcastProperty $p) => $this->matchesStrategy($p, $strategy));
        }

        return $collection->map(function (RentcastProperty $p) {
            $row = $p->toSearchRow();
            // Attach pre-computed detail so the frontend needs zero follow-up API calls
            $detail = $this->rentcast->detailFromRaw($p->raw_json);
            if ($detail) $row['detail'] = $detail;
            return $row;
        })->values()->all();
    }

    /**
     * Strip raw_json from response rows — it is persisted in the DB only, never sent to clients.
     * This also significantly reduces response payload size (raw_json is 2–5 KB per property).
     */
    private function stripRawJson(array $rows): array
    {
        return array_map(static function (array $row): array {
            unset($row['raw_json']);
            return $row;
        }, $rows);
    }

    /**
     * Check whether an Eloquent RentcastProperty model matches a given strategy
     * by inspecting its stored raw_json.
     */
    private function matchesStrategy(RentcastProperty $p, string $strategy): bool
    {
        $raw = is_string($p->raw_json) ? (json_decode($p->raw_json, true) ?? []) : [];

        return match ($strategy) {
            'out_of_state_owner' => (function () use ($p, $raw): bool {
                $ownerState = strtoupper($raw['owner']['mailingAddress']['state'] ?? '');
                $propState  = strtoupper($p->state ?? '');
                return $ownerState !== '' && $propState !== '' && $ownerState !== $propState;
            })(),
            'high_equity' => (function () use ($raw): bool {
                // Use tax-assessed value as the estimated value
                $taxAssessments = $raw['taxAssessments'] ?? [];
                if (!empty($taxAssessments)) {
                    $latestYear = max(array_keys($taxAssessments));
                    $ev = (float) ($taxAssessments[$latestYear]['value'] ?? 0);
                } else {
                    $ev = 0;
                }
                $lp = (float) ($raw['lastSalePrice'] ?? 0);
                return $ev > 0 && $lp > 0 && (($ev - $lp) / $ev) > 0.40;
            })(),
            'cash_buyers' => (float) ($raw['lastSalePrice'] ?? 0) > 0,
            default       => true,
        };
    }

    /**
     * Apply strategy filtering to an array of already-normalised snapshot rows
     * (from a live API call, before they are cached).
     */
    private function filterRowsByStrategy(array $rows, string $strategy): array
    {
        return array_values(array_filter($rows, function (array $row) use ($strategy): bool {
            $rawStr = $row['raw_json'] ?? null;
            $raw    = $rawStr ? (json_decode($rawStr, true) ?? []) : [];

            return match ($strategy) {
                'out_of_state_owner' => (function () use ($row, $raw): bool {
                    $ownerState = strtoupper($raw['owner']['mailingAddress']['state'] ?? '');
                    $propState  = strtoupper($raw['state'] ?? $row['state'] ?? '');
                    return $ownerState !== '' && $propState !== '' && $ownerState !== $propState;
                })(),
                'high_equity' => (function () use ($raw): bool {
                    $taxAssessments = $raw['taxAssessments'] ?? [];
                    if (!empty($taxAssessments)) {
                        $latestYear = max(array_keys($taxAssessments));
                        $ev = (float) ($taxAssessments[$latestYear]['value'] ?? 0);
                    } else {
                        $ev = 0;
                    }
                    $lp = (float) ($raw['lastSalePrice'] ?? 0);
                    return $ev > 0 && $lp > 0 && (($ev - $lp) / $ev) > 0.40;
                })(),
                'cash_buyers' => (float) ($raw['lastSalePrice'] ?? 0) > 0,
                default       => true,
            };
        }));
    }

    /**
     * Full property detail (location + characteristics + owner + valuation + transactions).
     * GET /api/rentcast/fulldetail?rentcastId=123-Main-St-Miami-FL-33139
     * GET /api/rentcast/fulldetail?address=123+Main+St&zipCode=33139
     *
     * If the property was previously fetched via search, raw_json is already cached
     * in the DB and this returns a full response with ZERO extra API calls.
     * AVM estimate fields will be null for cached properties (load via /avm if needed).
     */
    public function fullDetail(Request $request)
    {
        $v = $request->validate([
            'rentcastId' => 'nullable|string|max:300',
            'address'    => 'nullable|string|max:300',
            'zipCode'    => 'nullable|string|max:10',
            // legacy attom compat params
            'attomId'    => 'nullable|string|max:300',
            'address1'   => 'nullable|string|max:300',
            'address2'   => 'nullable|string|max:300',
        ]);

        $rentcastId = $v['rentcastId'] ?? $v['attomId'] ?? null;
        $address    = $v['address']    ?? $v['address1'] ?? null;
        $zipCode    = $v['zipCode']    ?? null;

        // Parse zipCode out of legacy "City ST ZIP" address2 format
        if (!$zipCode && !empty($v['address2'])) {
            if (preg_match('/\b(\d{5})\b/', $v['address2'], $m)) {
                $zipCode = $m[1];
            }
        }

        if (!$rentcastId && !$address) {
            return response()->json(['error' => 'Provide rentcastId or address + zipCode.'], 422);
        }

        // ── Serve from DB cache (zero extra API calls) ────────────────────
        if ($rentcastId) {
            $cached = RentcastProperty::where('rentcast_id', $rentcastId)
                ->whereNotNull('raw_json')
                ->first();

            if ($cached && $cached->raw_json) {
                $rawData = json_decode($cached->raw_json, true);
                if (!empty($rawData)) {
                    return response()->json(
                        $this->rentcast->fullDetailFromCache($rawData)
                    );
                }
            }
        }

        // ── Fall back: live API call (3 concurrent requests) ──────────────
        return response()->json($this->rentcast->fullDetail(
            rentcastId: (string) ($rentcastId ?? ''),
            address:    (string) ($address    ?? ''),
            zipCode:    (string) ($zipCode    ?? ''),
        ));
    }

    /**
     * Automated valuation model only.
     * GET /api/rentcast/avm?address=123+Main+St&zipCode=33139
     *
     * Cached in DB on rentcast_properties.avm_json — once fetched, all subsequent
     * requests for the same property are served from cache (zero API calls, zero cost).
     * Pass refresh=1 to force a re-fetch.
     */
    public function avm(Request $request)
    {
        $v = $request->validate([
            'address' => 'required|string|max:300',
            'zipCode' => 'required|string|max:10',
            'refresh' => 'nullable|boolean',
        ]);

        $refresh = (bool) ($v['refresh'] ?? false);

        // Try cache first — match by formatted address + zip
        if (!$refresh) {
            $cached = RentcastProperty::query()
                ->where('zip', $v['zipCode'])
                ->whereNotNull('avm_json')
                ->where(function ($q) use ($v) {
                    $q->where('address', $v['address'])
                      ->orWhere('street', $v['address']);
                })
                ->first();

            if ($cached && $cached->avm_json) {
                $data = is_string($cached->avm_json)
                    ? (json_decode($cached->avm_json, true) ?? null)
                    : $cached->avm_json;
                if ($data) {
                    return response()->json(['data' => $data, 'source' => 'cache']);
                }
            }
        }

        $result = $this->rentcast->avm($v['address'], $v['zipCode']);

        // Persist on success — keyed by rentcast_id when available, else by address+zip
        if (!empty($result['data'])) {
            $rid = $result['data']['rentcast_id'] ?? null;
            $row = $rid
                ? RentcastProperty::query()->where('rentcast_id', $rid)->first()
                : RentcastProperty::query()->where('zip', $v['zipCode'])
                    ->where(function ($q) use ($v) {
                        $q->where('address', $v['address'])->orWhere('street', $v['address']);
                    })->first();

            if ($row) {
                $row->avm_json       = json_encode($result['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $row->avm_fetched_at = now();
                $row->save();
            }
        }

        return response()->json($result + ['source' => 'live']);
    }
}
