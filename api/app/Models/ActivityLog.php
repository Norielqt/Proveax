<?php
namespace App\Models;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'action',
        'subject_type', 'subject_id', 'metadata', 'ip',
    ];
    protected $casts = ['metadata' => 'array'];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function user() { return $this->belongsTo(User::class); }
}
