<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttomProperty;
use App\Services\AttomService;
use Illuminate\Http\Request;

class AttomController extends Controller
{
    public function __construct(private AttomService $attom) {}

    /**
     * Search the national ATTOM database.
     * Requires at least postalcode OR (city + state).
     * GET /api/attom/search?postalcode=33139&pagesize=25&page=1
     */
    public function search(Request $request)
    {
        $v = $request->validate([
            'postalcode'   => 'nullable|string|max:10',
            'city'         => 'nullable|string|max:100',
            'state'        => 'nullable|string|size:2',
            'latitude'     => 'nullable|numeric|between:-90,90',
            'longitude'    => 'nullable|numeric|between:-180,180',
            'radius'       => 'nullable|numeric|min:0.1|max:25',
            'propertytype' => 'nullable|string|max:50',
        ]);

        $hasZip    = !empty($v['postalcode']);
        $hasCity   = !empty($v['city']) && !empty($v['state']);
        $hasLatLng = !empty($v['latitude']) && !empty($v['longitude']);

        if (!$hasZip && !$hasCity && !$hasLatLng) {
            return response()->json(['error' => 'Provide postalcode, city + state, or latitude + longitude.'], 422);
        }

        $typeFilter = $v['propertytype'] ?? null;

        // ── DB-first: serve from local cache when we have enough rows ─────────
        $local = AttomProperty::query();

        if ($hasZip) {
            $local->where('zip', $v['postalcode']);
        } elseif ($hasCity) {
            $local->where('city', $v['city'])->where('state', $v['state']);
        } elseif ($hasLatLng) {
            // Approximate bounding box: radius in miles → degrees (1° lat ≈ 69 mi)
            $radiusMiles = (float) ($v['radius'] ?? 5);
            $latDelta = $radiusMiles / 69;
            $lngDelta = $radiusMiles / (69 * cos(deg2rad((float) $v['latitude'])));
            $local->whereBetween('lat', [$v['latitude'] - $latDelta, $v['latitude'] + $latDelta])
                  ->whereBetween('lng', [$v['longitude'] - $lngDelta, $v['longitude'] + $lngDelta]);
        }

        if ($typeFilter) {
            $local->where('property_type', $typeFilter);
        }

        $localCount = $local->count();

        // If we already have ≥ 50 rows locally, return all of them instantly without hitting ATTOM
        if ($localCount >= 50) {
            $rows = $local->orderByDesc('estimated_value')
                          ->get()
                          ->map(fn ($p) => $p->toSearchRow())
                          ->values()
                          ->all();
            return response()->json(['data' => $rows, 'total' => $localCount, 'source' => 'cache']);
        }

        // ── Fallback: call ATTOM, which will upsert results into the DB ───────
        $result = $this->attom->snapshot([
            'postalcode'   => $v['postalcode']   ?? null,
            'city'         => $v['city']          ?? null,
            'state'        => $v['state']         ?? null,
            'latitude'     => $v['latitude']      ?? null,
            'longitude'    => $v['longitude']     ?? null,
            'radius'       => $v['radius']        ?? null,
            'propertytype' => $v['propertytype']  ?? null,
        ]);

        return response()->json($result);
    }

    /**
     * Full property detail from ATTOM.
     * GET /api/attom/detail?address1=123+Ocean+Dr&address2=Miami+FL+33139
     */
    public function detail(Request $request)
    {
        $v = $request->validate([
            'address1' => 'nullable|string|max:200',
            'address2' => 'nullable|string|max:200',
            'attomId'  => 'nullable|integer',
        ]);

        if (empty($v['attomId']) && (empty($v['address1']) || empty($v['address2']))) {
            return response()->json(['error' => 'Provide attomId or address1 + address2.'], 422);
        }

        return response()->json($this->attom->detail(
            $v['address1'] ?? '',
            $v['address2'] ?? '',
            isset($v['attomId']) ? (int) $v['attomId'] : null,
        ));
    }

    /**
     * Automated valuation model for a property.
     * GET /api/attom/avm?address1=123+Ocean+Dr&address2=Miami+FL+33139
     */
    public function avm(Request $request)
    {
        $v = $request->validate([
            'address1' => 'required|string|max:200',
            'address2' => 'required|string|max:200',
        ]);

        return response()->json($this->attom->avm($v['address1'], $v['address2']));
    }

    /**
     * Full property report — all sections in one shot.
     * GET /api/attom/fulldetail?attomId=111904
     * GET /api/attom/fulldetail?address1=123+Main+St&address2=Miami+FL+33139
     */
    public function fullDetail(Request $request)
    {
        $v = $request->validate([
            'address1' => 'nullable|string|max:200',
            'address2' => 'nullable|string|max:200',
            'attomId'  => 'nullable|integer',
        ]);

        if (empty($v['attomId']) && (empty($v['address1']) || empty($v['address2']))) {
            return response()->json(['error' => 'Provide attomId or address1 + address2.'], 422);
        }

        return response()->json($this->attom->fullDetail(
            $v['address1'] ?? '',
            $v['address2'] ?? '',
            isset($v['attomId']) ? (int) $v['attomId'] : null,
        ));
    }
}
