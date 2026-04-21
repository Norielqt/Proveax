<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RentcastProperty extends Model
{
    public $primaryKey   = 'rentcast_id';
    public $incrementing = false;
    protected $keyType   = 'string';
    public $timestamps   = false;

    protected $fillable = [
        'rentcast_id', 'street', 'address', 'city', 'state', 'zip',
        'lat', 'lng', 'property_type', 'bedrooms', 'bathrooms',
        'square_feet', 'lot_size', 'year_built', 'estimated_value',
        'owner_name', 'owner_occupied', 'fetched_at', 'raw_json',
    ];

    protected $casts = [
        'lat'             => 'float',
        'lng'             => 'float',
        'estimated_value' => 'float',
        'owner_occupied'  => 'boolean',
        'fetched_at'      => 'datetime',
    ];

    /**
     * Upsert a batch of normalised snapshot rows.
     */
    public static function upsertBatch(array $rows): void
    {
        if (empty($rows)) return;

        $now = now()->toDateTimeString();

        $records = array_values(array_filter(
            array_map(fn ($r) => empty($r['attom_id']) ? null : [
                'rentcast_id'     => (string) $r['attom_id'],
                'street'          => $r['street']          ?? '',
                'address'         => $r['address']         ?? '',
                'city'            => $r['city']             ?? '',
                'state'           => $r['state']            ?? '',
                'zip'             => $r['zip']              ?? '',
                'lat'             => $r['lat']              ?? null,
                'lng'             => $r['lng']              ?? null,
                'property_type'   => $r['property_type']   ?? null,
                'bedrooms'        => $r['bedrooms']        ?? null,
                'bathrooms'       => $r['bathrooms']       ?? null,
                'square_feet'     => $r['square_feet']     ?? null,
                'lot_size'        => $r['lot_size']        ?? null,
                'year_built'      => $r['year_built']      ?? null,
                'estimated_value' => $r['estimated_value'] ?? null,
                'owner_name'      => $r['owner_name']      ?? null,
                'owner_occupied'  => $r['owner_occupied']  ?? null,
                'raw_json'        => $r['raw_json']        ?? null,
                'fetched_at'      => $now,
            ], $rows)
        ));

        if (empty($records)) return;

        $updateCols = [
            'street', 'address', 'city', 'state', 'zip', 'lat', 'lng',
            'property_type', 'bedrooms', 'bathrooms', 'square_feet',
            'lot_size', 'year_built', 'estimated_value', 'owner_name',
            'owner_occupied', 'raw_json', 'fetched_at',
        ];

        foreach (array_chunk($records, 400) as $chunk) {
            static::upsert($chunk, ['rentcast_id'], $updateCols);
        }
    }

    public function toSearchRow(): array
    {
        return [
            'attom_id'        => $this->rentcast_id, // compat alias for frontend
            'street'          => $this->street ?: $this->address,
            'address'         => $this->address,
            'city'            => $this->city,
            'state'           => $this->state,
            'zip'             => $this->zip,
            'lat'             => $this->lat,
            'lng'             => $this->lng,
            'property_type'   => $this->property_type,
            'bedrooms'        => $this->bedrooms,
            'bathrooms'       => $this->bathrooms,
            'square_feet'     => $this->square_feet,
            'lot_size'        => $this->lot_size,
            'year_built'      => $this->year_built,
            'estimated_value' => $this->estimated_value,
            'owner_name'      => $this->owner_name,
            'owner_occupied'  => $this->owner_occupied,
        ];
    }
}
