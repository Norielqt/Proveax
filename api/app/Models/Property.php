<?php
namespace App\Models;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;

class Property extends Model
{
    protected $fillable = [
        'tenant_id', 'address', 'city', 'state', 'zip',
        'latitude', 'longitude', 'property_type',
        'bedrooms', 'bathrooms', 'square_feet', 'lot_size',
        'year_built', 'estimated_value',
        'owner_name', 'owner_mailing_address',
        'skip_trace_phones', 'skip_trace_emails', 'skip_traced_at',
        'ownership_history', 'metadata',
    ];

    protected $casts = [
        'latitude'           => 'float',
        'longitude'          => 'float',
        'estimated_value'    => 'decimal:2',
        'ownership_history'  => 'array',
        'metadata'           => 'array',
        'skip_trace_phones'  => 'array',
        'skip_trace_emails'  => 'array',
        'skip_traced_at'     => 'datetime',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
