<?php
namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PropertyResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'              => $this->id,
            'address'         => $this->address,
            'city'            => $this->city,
            'state'           => $this->state,
            'zip'             => $this->zip,
            'lat'             => $this->latitude,
            'lng'             => $this->longitude,
            'property_type'   => $this->property_type,
            'bedrooms'        => $this->bedrooms,
            'bathrooms'       => $this->bathrooms,
            'square_feet'     => $this->square_feet,
            'lot_size'        => $this->lot_size,
            'year_built'      => $this->year_built,
            'estimated_value' => $this->estimated_value,
            'owner_name'      => $this->owner_name,
            'owner_mailing_address' => $this->when($request->routeIs('*.show'), $this->owner_mailing_address),
            'ownership_history'     => $this->when($request->routeIs('*.show'), $this->ownership_history),
            'metadata'              => $this->when($request->routeIs('*.show'), $this->metadata),
        ];
    }
}
