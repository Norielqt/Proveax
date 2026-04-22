<?php
namespace App\Models;

use App\Scopes\TenantScope;
use Illuminate\Database\Eloquent\Model;

class Screenshot extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'work_session_id',
        'disk', 'path', 'bytes', 'width', 'height', 'captured_at',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function user()    { return $this->belongsTo(User::class); }
    public function session() { return $this->belongsTo(WorkSession::class, 'work_session_id'); }
}
