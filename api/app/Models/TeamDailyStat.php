<?php
namespace App\Models;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;

class TeamDailyStat extends Model
{
    protected $table = 'team_daily_stats';

    protected $fillable = [
        'tenant_id', 'user_id', 'day',
        'active_seconds', 'idle_seconds', 'sessions_count',
        'screenshots_count', 'rentcast_requests_count', 'activity_events_count',
    ];

    protected $casts = [
        'day' => 'date',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function user() { return $this->belongsTo(User::class); }
}
