<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PropertySearchRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;

class PropertyController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    public function search(PropertySearchRequest $request)
    {
        $f = $request->validated();

        $query = Property::query()
            ->when($f['q'] ?? null, fn($q, $v) =>
                $q->where(fn($w) =>
                    $w->where('address', 'like', "%$v%")
                      ->orWhere('city', 'like', "%$v%")
                      ->orWhere('owner_name', 'like', "%$v%")
                )
            )
            ->when($f['city']  ?? null, fn($q, $v) => $q->where('city', $v))
            ->when($f['state'] ?? null, fn($q, $v) => $q->where('state', strtoupper($v)))
            ->when($f['zip']   ?? null, fn($q, $v) => $q->where('zip', $v))
            ->when($f['property_type'] ?? null, fn($q, $v) => $q->where('property_type', $v))
            ->when(isset($f['beds_min']),  fn($q) => $q->where('bedrooms', '>=', $f['beds_min']))
            ->when(isset($f['beds_max']),  fn($q) => $q->where('bedrooms', '<=', $f['beds_max']))
            ->when(isset($f['baths_min']), fn($q) => $q->where('bathrooms', '>=', $f['baths_min']))
            ->when(isset($f['sqft_min']),  fn($q) => $q->where('square_feet', '>=', $f['sqft_min']))
            ->when(isset($f['sqft_max']),  fn($q) => $q->where('square_feet', '<=', $f['sqft_max']))
            ->when(isset($f['year_built_min']), fn($q) => $q->where('year_built', '>=', $f['year_built_min']))
            ->when(isset($f['year_built_max']), fn($q) => $q->where('year_built', '<=', $f['year_built_max']))
            ->when(isset($f['value_min']), fn($q) => $q->where('estimated_value', '>=', $f['value_min']))
            ->when(isset($f['value_max']), fn($q) => $q->where('estimated_value', '<=', $f['value_max']))
            ->when($f['bbox'] ?? null, function ($q, $v) {
                [$minLng, $minLat, $maxLng, $maxLat] = array_map('floatval', explode(',', $v));
                $q->whereBetween('latitude',  [$minLat, $maxLat])
                  ->whereBetween('longitude', [$minLng, $maxLng]);
            });

        $query = match ($f['sort'] ?? 'recent') {
            'value_asc'  => $query->orderBy('estimated_value'),
            'value_desc' => $query->orderByDesc('estimated_value'),
            'sqft_desc'  => $query->orderByDesc('square_feet'),
            default      => $query->latest(),
        };

        $this->logger->log($request->user(), 'property.search', metadata: $f);

        return PropertyResource::collection(
            $query->paginate($f['per_page'] ?? 25)
        );
    }

    public function show(Request $request, int $id)
    {
        $property = Property::findOrFail($id);
        $this->logger->log($request->user(), 'property.view', subject: $property);
        return new PropertyResource($property);
    }
}
