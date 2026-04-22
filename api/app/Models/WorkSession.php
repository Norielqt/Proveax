<?php
namespace App\Models;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;

class WorkSession extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id',
        'started_at', 'ended_at',
        'active_seconds', 'idle_seconds',
        'last_heartbeat_at',
        'screenshots_enabled',
        'end_reason',
    ];

    protected $casts = [
        'started_at'          => 'datetime',
        'ended_at'            => 'datetime',
        'last_heartbeat_at'   => 'datetime',
        'screenshots_enabled' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function user()        { return $this->belongsTo(User::class); }
    public function screenshots() { return $this->hasMany(Screenshot::class); }

    public function isActive(): bool
    {
        return $this->ended_at === null;
    }
}
