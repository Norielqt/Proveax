<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Invite extends Model
{
    protected $fillable = ['tenant_id', 'email', 'token', 'expires_at', 'accepted_at'];
    protected $casts    = ['expires_at' => 'datetime', 'accepted_at' => 'datetime'];

    public static function generate(int $tenantId, string $email): self
    {
        return self::create([
            'tenant_id'  => $tenantId,
            'email'      => $email,
            'token'      => Str::random(48),
            'expires_at' => now()->addDays(7),
        ]);
    }

    public function isValid(): bool
    {
        return !$this->accepted_at && $this->expires_at->isFuture();
    }

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
