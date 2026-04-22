<?php

namespace App\Models;

use App\Enums\Role;
use App\Scopes\TenantScope;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = ['tenant_id', 'invited_by_user_id', 'name', 'email', 'password', 'role', 'google_id', 'balance', 'is_paused', 'monitoring_consent_at'];
    protected $hidden   = ['password', 'remember_token'];
    protected $casts    = [
        'email_verified_at'     => 'datetime',
        'password'              => 'hashed',
        'role'                  => Role::class,
        'balance'               => 'decimal:2',
        'is_paused'             => 'boolean',
        'monitoring_consent_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function tenant() { return $this->belongsTo(Tenant::class); }

    public function invitedBy() { return $this->belongsTo(User::class, 'invited_by_user_id'); }
    public function invitees()  { return $this->hasMany(User::class, 'invited_by_user_id'); }

    public function walletTransactions()
    {
        return $this->hasMany(WalletTransaction::class)->latest();
    }

    public function isAdmin(): bool    { return $this->role === Role::Admin; }
    public function isEmployee(): bool { return $this->role === Role::Employee; }
}
