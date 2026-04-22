<?php
namespace App\Models;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;

class Timesheet extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'week_start', 'week_end',
        'total_active_seconds', 'status',
        'submitted_at', 'reviewed_at', 'reviewed_by_user_id', 'reviewer_note',
    ];

    protected $casts = [
        'week_start'   => 'date',
        'week_end'     => 'date',
        'submitted_at' => 'datetime',
        'reviewed_at'  => 'datetime',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function user()     { return $this->belongsTo(User::class); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewed_by_user_id'); }
}
