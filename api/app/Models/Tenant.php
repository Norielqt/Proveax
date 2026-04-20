<?php
namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    protected $fillable = [
        'name', 'slug', 'industry', 'phone', 'address',
        'trial_ends_at',
        'subscription_status',
        'stripe_customer_id', 'stripe_subscription_id',
    ];

    protected $casts = [
        'trial_ends_at'       => 'datetime',
        'subscription_status' => SubscriptionStatus::class,
    ];

    public function users()        { return $this->hasMany(User::class); }
    public function properties()   { return $this->hasMany(Property::class); }
    public function invites()      { return $this->hasMany(Invite::class); }
    public function activityLogs() { return $this->hasMany(ActivityLog::class); }

    public function isOnTrial(): bool
    {
        return $this->subscription_status === SubscriptionStatus::Trialing
            && $this->trial_ends_at?->isFuture();
    }

    public function hasActiveSubscription(): bool
    {
        return $this->subscription_status === SubscriptionStatus::Active;
    }

    public function hasFeatureAccess(): bool
    {
        return $this->isOnTrial() || $this->hasActiveSubscription();
    }
}
