<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeamSetting extends Model
{
    protected $fillable = [
        'tenant_id',
        'screenshot_retention_days',
        'screenshot_interval_minutes',
        'idle_timeout_minutes',
        'screenshots_required',
        'consent_text',
    ];

    protected $casts = [
        'screenshots_required' => 'boolean',
    ];

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
