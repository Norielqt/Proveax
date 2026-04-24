<?php

namespace App\Models;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
    protected $fillable = [
        'tenant_id',
        'created_by_user_id',
        'updated_by_user_id',
        'name',
        'address',
        'phone',
        'lead_type',
        'source_type',
        'home_price_cents',
        'email',
        'notes',
    ];

    protected $casts = [
        'home_price_cents' => 'integer',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope());
    }

    public function createdBy(): BelongsTo { return $this->belongsTo(User::class, 'created_by_user_id'); }
    public function updatedBy(): BelongsTo { return $this->belongsTo(User::class, 'updated_by_user_id'); }
}
