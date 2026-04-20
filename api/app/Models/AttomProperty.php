<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AttomProperty extends Model
{
    public $primaryKey  = 'attom_id';
    public $incrementing = false;
    public $timestamps  = false;

    protected $fillable = [
        'attom_id', 'street', 'address', 'city', 'state', 'zip',
        'lat', 'lng', 'property_type', 'bedrooms', 'bathrooms',
        'square_feet', 'lot_size', 'year_built', 'estimated_value',
        'owner_name', 'fetched_at',
    ];

    protected $casts = [
        'attom_id'        => 'integer',
        'lat'             => 'float',
        'lng'             => 'float',
        'estimated_value' => 'float',
        'fetched_at'      => 'datetime',
    ];

    /**
     * Upsert a batch of normalised snapshot rows.
     * Rows with the same attom_id are updated; new ones are inserted.
     */
    public static function upsertBatch(array $rows): void
    {
        if (empty($rows)) return;

        $now = now()->toDateTimeString();

        $records = array_values(array_filter(
            array_map(fn ($r) => empty($r['attom_id']) ? null : [
                'attom_id'        => $r['attom_id'],
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
                'fetched_at'      => $now,
            ], $rows)
        ));

        if (empty($records)) return;

        $updateCols = [
            'street', 'address', 'city', 'state', 'zip', 'lat', 'lng',
            'property_type', 'bedrooms', 'bathrooms', 'square_feet',
            'lot_size', 'year_built', 'estimated_value', 'owner_name', 'fetched_at',
        ];

        // MySQL allows max 65,535 placeholders per statement.
        // 16 columns × 400 rows = 6,400 — well within the limit.
        foreach (array_chunk($records, 400) as $chunk) {
            static::upsert($chunk, ['attom_id'], $updateCols);
        }
    }

    /**
     * Return rows as the same shape as normaliseSnapshot() so the controller
     * can use either source transparently.
     */
    public function toSearchRow(): array
    {
        return [
            'attom_id'        => $this->attom_id,
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
        ];
    }
}
