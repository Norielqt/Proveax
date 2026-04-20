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

    protected $fillable = ['tenant_id', 'name', 'email', 'password', 'role'];
    protected $hidden   = ['password', 'remember_token'];
    protected $casts    = [
        'email_verified_at' => 'datetime',
        'password'          => 'hashed',
        'role'              => Role::class,
    ];

    protected static function booted(): void
    {
        static::addGlobalScope(new TenantScope);
    }

    public function tenant() { return $this->belongsTo(Tenant::class); }

    public function isAdmin(): bool    { return $this->role === Role::Admin; }
    public function isEmployee(): bool { return $this->role === Role::Employee; }
}
