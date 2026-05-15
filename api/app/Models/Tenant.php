<?php
namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    protected $fillable = [
        'name', 'slug', 'industry', 'phone', 'address',
        'trial_ends_at',
        'trial_used_at',
        'subscription_status',
        'subscription_plan',
        'subscription_ends_at',
        'subscription_canceled_at',
        'stripe_customer_id', 'stripe_subscription_id',
        'card_brand', 'card_last4', 'card_exp_month', 'card_exp_year',
    ];

    protected $casts = [
        'trial_ends_at'            => 'datetime',
        'trial_used_at'            => 'datetime',
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
     * True for any tenant that does not currently have access. Fresh signups
     * (no Stripe sub) AND tenants whose subscription has expired both need to
     * pick a plan before getting access. The 7-day trial is only granted on
     * the FIRST subscription — see Tenant::canStartTrial().
     */
    public function needsBillingOnboarding(): bool
    {
        if ($this->stripe_subscription_id === null) {
            return true;
        }
        // Has a stripe sub but it's already expired — must resubscribe.
        return $this->subscription_status === SubscriptionStatus::Expired;
    }

    /**
     * A tenant is eligible for the 7-day free trial only on their FIRST paid
     * subscription. Once trial_used_at is set, every future subscription
     * (after expiration / re-signup) starts billing immediately.
     */
    public function canStartTrial(): bool
    {
        return $this->trial_used_at === null;
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
