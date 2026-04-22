<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RentcastRequest extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'endpoint',
        'status_code', 'billable', 'duration_ms', 'error',
        'requested_at',
    ];

    protected $casts = [
        'billable'     => 'boolean',
        'requested_at' => 'datetime',
    ];

    public function user() { return $this->belongsTo(User::class); }
}
