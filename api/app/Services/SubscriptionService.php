<?php
namespace App\Services;

use App\Enums\SubscriptionStatus;
use App\Models\Tenant;
use Stripe\StripeClient;

class SubscriptionService
{
    public const TRIAL_DAYS = 7;

    // Plan price mapping — set real Stripe Price IDs in .env or replace these
    private const PLAN_PRICES = [
        'starter'  => ['amount' => 9999,  'name' => 'Starter'],   // $99.99
        'team'     => ['amount' => 18999, 'name' => 'Team'],       // $189.99
        'business' => ['amount' => 24999, 'name' => 'Business'],   // $249.99
    ];

    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

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

    /**
     * Transition canceled subscriptions to Expired once their paid period ends.
     * Runs hourly via scheduler.
     */
    public function expireEndedCancellations(): int
    {
        return Tenant::query()
            ->where('subscription_status', SubscriptionStatus::Canceled->value)
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<=', now())
            ->update(['subscription_status' => SubscriptionStatus::Expired->value]);
    }

    public function createCheckoutUrl(Tenant $tenant): string
    {
        // TODO: Stripe integration
        return config('app.frontend_url') . '/billing/stripe-not-configured';
    }

    public function createSubscriptionIntent(Tenant $tenant, string $plan): array
    {
        $planData = self::PLAN_PRICES[$plan] ?? self::PLAN_PRICES['starter'];

        $intent = $this->stripe()->paymentIntents->create([
            'amount'   => $planData['amount'],
            'currency' => 'usd',
            'metadata' => [
                'tenant_id' => $tenant->id,
                'plan'      => $plan,
            ],
            'description' => "Proviaxx {$planData['name']} plan — monthly",
        ]);

        return ['client_secret' => $intent->client_secret];
    }

    public function confirmSubscription(Tenant $tenant, string $paymentIntentId, string $plan): void
    {
        $intent = $this->stripe()->paymentIntents->retrieve($paymentIntentId);

        if ($intent->status !== 'succeeded') {
            abort(422, 'Payment has not succeeded.');
        }

        $tenant->update([
            'subscription_status'      => SubscriptionStatus::Active,
            'subscription_plan'        => $plan,
            'subscription_ends_at'     => now()->addMonth(),
            'subscription_canceled_at' => null,
        ]);
    }

    public function cancelSubscription(Tenant $tenant): void
    {
        // Keep access until period end (cancel at period end, standard SaaS behavior)
        $tenant->update([
            'subscription_status'      => SubscriptionStatus::Canceled,
            'subscription_canceled_at' => now(),
        ]);
    }

    public function markActive(Tenant $tenant, ?string $stripeSubId = null): void
    {
        $tenant->update([
            'subscription_status'    => SubscriptionStatus::Active,
            'stripe_subscription_id' => $stripeSubId,
        ]);
    }
}
