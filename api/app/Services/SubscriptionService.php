<?php
namespace App\Services;

use App\Enums\SubscriptionStatus;
use App\Models\Tenant;

class SubscriptionService
{
    public const TRIAL_DAYS = 7;

    public function startTrial(Tenant $tenant): void
    {
        $tenant->update([
            'trial_ends_at'       => now()->addDays(self::TRIAL_DAYS),
            'subscription_status' => SubscriptionStatus::Trialing,
        ]);
    }

    public function expireEndedTrials(): int
    {
        return Tenant::query()
            ->where('subscription_status', SubscriptionStatus::Trialing->value)
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', now())
            ->update(['subscription_status' => SubscriptionStatus::Expired->value]);
    }

    public function createCheckoutUrl(Tenant $tenant): string
    {
        // TODO: Stripe integration
        return config('app.frontend_url') . '/billing/stripe-not-configured';
    }

    public function markActive(Tenant $tenant, ?string $stripeSubId = null): void
    {
        $tenant->update([
            'subscription_status'    => SubscriptionStatus::Active,
            'stripe_subscription_id' => $stripeSubId,
        ]);
    }
}
