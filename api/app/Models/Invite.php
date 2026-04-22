<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Invite extends Model
{
    protected $fillable = [
        'tenant_id', 'invited_by_user_id', 'email', 'role',
        'token', 'expires_at', 'accepted_at', 'revoked_at',
    ];

    protected $casts = [
        'expires_at'  => 'datetime',
        'accepted_at' => 'datetime',
        'revoked_at'  => 'datetime',
    ];

    protected $appends = ['status'];

    public static function generate(int $tenantId, int $invitedByUserId, string $email, string $role = 'employee'): self
    {
        return self::create([
            'tenant_id'          => $tenantId,
            'invited_by_user_id' => $invitedByUserId,
            'email'              => $email,
            'role'               => $role,
            'token'              => Str::random(48),
            'expires_at'         => now()->addDays(7),
        ]);
    }

    public function regenerate(): self
    {
        $this->update([
            'token'       => Str::random(48),
            'expires_at'  => now()->addDays(7),
            'accepted_at' => null,
            'revoked_at'  => null,
        ]);
        return $this;
    }

    public function isValid(): bool
    {
        return !$this->accepted_at
            && !$this->revoked_at
            && $this->expires_at && $this->expires_at->isFuture();
    }

    public function getStatusAttribute(): string
    {
        if ($this->accepted_at)                                 return 'accepted';
        if ($this->revoked_at)                                  return 'revoked';
        if ($this->expires_at && $this->expires_at->isPast())   return 'expired';
        return 'pending';
    }

    public function tenant()    { return $this->belongsTo(Tenant::class); }
    public function invitedBy() { return $this->belongsTo(User::class, 'invited_by_user_id'); }
}
