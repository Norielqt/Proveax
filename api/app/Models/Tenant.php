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
        'subscription_plan',
        'subscription_ends_at',
        'subscription_canceled_at',
        'stripe_customer_id', 'stripe_subscription_id',
    ];

    protected $casts = [
        'trial_ends_at'            => 'datetime',
        'subscription_ends_at'     => 'datetime',
        'subscription_canceled_at' => 'datetime',
        'subscription_status'      => SubscriptionStatus::class,
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

    public function isCanceled(): bool
    {
        return $this->subscription_status === SubscriptionStatus::Canceled
            && $this->subscription_ends_at?->isFuture();
    }

    public function hasFeatureAccess(): bool
    {
        return $this->isOnTrial() || $this->hasActiveSubscription() || $this->isCanceled();
    }

    /**
     * Max users (including owner) allowed for this tenant based on plan.
     * Trial defaults to starter tier. Null means unlimited.
     */
    public function seatLimit(): ?int
    {
        return match ($this->subscription_plan) {
            'team'     => 10,
            'business' => null, // unlimited
            default    => 5,    // starter or unknown/trial
        };
    }

    /**
     * Seats currently consumed: active users + pending (unaccepted, unrevoked) invites.
     */
    public function seatsUsed(): int
    {
        $users = $this->users()->count();
        $pending = $this->invites()
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->count();
        return $users + $pending;
    }

    public function seatsRemaining(): ?int
    {
        $limit = $this->seatLimit();
        return $limit === null ? null : max(0, $limit - $this->seatsUsed());
    }

    public function isSeatAvailable(): bool
    {
        $remaining = $this->seatsRemaining();
        return $remaining === null || $remaining > 0;
    }
}
