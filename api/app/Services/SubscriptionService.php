<?php
namespace App\Services;

use App\Enums\SubscriptionStatus;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;

class SubscriptionService
{
    public const TRIAL_DAYS = 7;

    /** Display amounts (cents) — Stripe Price IDs are the source of truth. */
    public const PLAN_AMOUNTS = [
        'starter'  => 9999,
        'team'     => 18999,
        'business' => 24999,
    ];

    public const PLAN_NAMES = [
        'starter'  => 'Starter',
        'team'     => 'Team',
        'business' => 'Business',
    ];

    private function stripe(): StripeClient
    {
        $secret = config('services.stripe.secret');
        if (! $secret) {
            abort(503, 'Stripe is not configured. Set STRIPE_SECRET on the server.');
        }
        if (str_starts_with($secret, 'pk_')) {
            \Illuminate\Support\Facades\Log::error('STRIPE_SECRET is set to a publishable key (pk_...). Set it to the secret key (sk_...).');
            abort(503, 'Stripe secret key is misconfigured. Contact support.');
        }
        return new StripeClient($secret);
    }

    private function priceFor(string $plan): string
    {
        $price = config("services.stripe.prices.$plan");
        if (! $price) {
            abort(503, "Stripe price ID for plan [$plan] is not configured.");
        }
        return $price;
    }

    /**
     * Lazy-create a Stripe customer for this tenant.
     */
    public function ensureCustomer(Tenant $tenant, ?User $user = null): string
    {
        if ($tenant->stripe_customer_id) {
            // Verify the customer still exists in this Stripe account (guards
            // against test/live key mismatch where the stored ID is from the
            // other environment). If not found, fall through and recreate.
            try {
                $this->stripe()->customers->retrieve($tenant->stripe_customer_id);
                return $tenant->stripe_customer_id;
            } catch (\Stripe\Exception\InvalidRequestException $e) {
                // "No such customer" — stale ID from wrong Stripe env. Clear it.
                Log::warning('Stripe customer not found, recreating', [
                    'tenant_id'   => $tenant->id,
                    'old_cus_id'  => $tenant->stripe_customer_id,
                    'stripe_error' => $e->getMessage(),
                ]);
                $tenant->forceFill(['stripe_customer_id' => null])->save();
            }
        }

        $email = $user?->email ?? $tenant->users()->first()?->email;
        $name  = $tenant->name ?: ($user?->name ?? 'Tenant');

        $customer = $this->stripe()->customers->create([
            'email'    => $email,
            'name'     => $name,
            'metadata' => ['tenant_id' => (string) $tenant->id],
        ]);

        $tenant->forceFill(['stripe_customer_id' => $customer->id])->save();
        return $customer->id;
    }

    /**
     * GET /api/billing/onboarding/setup-intent
     * Returns a SetupIntent client_secret so the frontend can collect a card
     * via Stripe Elements without charging anything.
     */
    public function createOnboardingSetupIntent(Tenant $tenant, User $user): array
    {
        $customerId = $this->ensureCustomer($tenant, $user);

        $intent = $this->stripe()->setupIntents->create([
            'customer'             => $customerId,
            'payment_method_types' => ['card'],
            'usage'                => 'off_session',
            'metadata'             => [
                'tenant_id' => (string) $tenant->id,
                'user_id'   => (string) $user->id,
                'purpose'   => 'onboarding',
            ],
        ]);

        return ['client_secret' => $intent->client_secret];
    }

    /**
     * POST /api/billing/onboarding/subscribe
     * Attach the freshly-collected payment method, set it as the customer
     * default, and create a Stripe Subscription with a 7-day trial.
     */
    public function startTrialingSubscription(
        Tenant $tenant,
        User $user,
        string $plan,
        string $paymentMethodId,
    ): array {
        if (! array_key_exists($plan, self::PLAN_AMOUNTS)) {
            abort(422, 'Invalid plan.');
        }

        // Refuse if a live subscription is already attached. Expired subs are
        // OK to overwrite — that's a re-subscribe after cancellation/lapse.
        if ($tenant->stripe_subscription_id
            && $tenant->subscription_status !== SubscriptionStatus::Expired) {
            abort(409, 'A subscription is already attached to this workspace.');
        }

        $stripe     = $this->stripe();
        $customerId = $this->ensureCustomer($tenant, $user);
        $priceId    = $this->priceFor($plan);

        // Attach + set default
        $stripe->paymentMethods->attach($paymentMethodId, ['customer' => $customerId]);
        $stripe->customers->update($customerId, [
            'invoice_settings' => ['default_payment_method' => $paymentMethodId],
        ]);

        // Free trial is one-time per tenant. Returning customers (whose prior
        // subscription has expired) start billing immediately on resubscribe.
        $eligibleForTrial = $tenant->canStartTrial();

        $subParams = [
            'customer'           => $customerId,
            'items'              => [['price' => $priceId]],
            'default_payment_method' => $paymentMethodId,
            'payment_behavior'   => 'default_incomplete',
            'payment_settings'   => [
                'save_default_payment_method' => 'on_subscription',
                'payment_method_types'        => ['card'],
            ],
            'expand'             => ['latest_invoice.payment_intent'],
            'metadata'           => [
                'tenant_id' => (string) $tenant->id,
                'plan'      => $plan,
                'trial'     => $eligibleForTrial ? 'true' : 'false',
            ],
        ];
        if ($eligibleForTrial) {
            $subParams['trial_period_days'] = self::TRIAL_DAYS;
        }

        $subscription = $stripe->subscriptions->create($subParams);

        // Capture card details for /settings display
        $card = null;
        try {
            $pm = $stripe->paymentMethods->retrieve($paymentMethodId);
            $card = $pm->card ?? null;
        } catch (\Throwable $e) {
            Log::warning('Could not load payment method card', ['error' => $e->getMessage()]);
        }

        $trialEnd = $subscription->trial_end
            ? Carbon::createFromTimestamp($subscription->trial_end)
            : null;

        // Map Stripe's actual status into our enum. Trialing only when Stripe
        // confirms a trial_end was set (i.e. eligibleForTrial was true and
        // Stripe accepted it). Otherwise it's incomplete pending first payment
        // — webhook will flip to Active once the invoice is paid.
        $localStatus = match ($subscription->status) {
            'trialing' => SubscriptionStatus::Trialing,
            'active'   => SubscriptionStatus::Active,
            default    => SubscriptionStatus::Trialing, // incomplete -> shows as trialing until webhook
        };
        if (! $eligibleForTrial && $subscription->status !== 'active') {
            // Returning customer, no trial — surface as Active optimistically
            // (webhook will correct to PastDue if first invoice fails).
            $localStatus = SubscriptionStatus::Active;
        }

        $tenant->forceFill([
            'subscription_status'    => $localStatus->value,
            'subscription_plan'      => $plan,
            'trial_ends_at'          => $trialEnd,
            'trial_used_at'          => $tenant->trial_used_at ?? ($eligibleForTrial ? now() : null),
            'subscription_ends_at'   => $subscription->current_period_end
                ? Carbon::createFromTimestamp($subscription->current_period_end)
                : null,
            'subscription_canceled_at' => null,
            'stripe_subscription_id' => $subscription->id,
            'card_brand'     => $card->brand     ?? null,
            'card_last4'     => $card->last4     ?? null,
            'card_exp_month' => $card->exp_month ?? null,
            'card_exp_year'  => $card->exp_year  ?? null,
        ])->save();

        return [
            'subscription_id' => $subscription->id,
            'status'          => $subscription->status,
            'trial_end'       => $trialEnd?->toIso8601String(),
            'trial_granted'   => $eligibleForTrial,
        ];
    }

    /**
     * Replace the default card on the customer (used by /settings).
     */
    public function updateDefaultPaymentMethod(Tenant $tenant, string $paymentMethodId): void
    {
        if (! $tenant->stripe_customer_id) {
            abort(404, 'No customer.');
        }

        $stripe = $this->stripe();
        $stripe->paymentMethods->attach($paymentMethodId, ['customer' => $tenant->stripe_customer_id]);
        $stripe->customers->update($tenant->stripe_customer_id, [
            'invoice_settings' => ['default_payment_method' => $paymentMethodId],
        ]);

        if ($tenant->stripe_subscription_id) {
            $stripe->subscriptions->update($tenant->stripe_subscription_id, [
                'default_payment_method' => $paymentMethodId,
            ]);
        }

        try {
            $pm = $stripe->paymentMethods->retrieve($paymentMethodId);
            $tenant->forceFill([
                'card_brand'     => $pm->card->brand     ?? null,
                'card_last4'     => $pm->card->last4     ?? null,
                'card_exp_month' => $pm->card->exp_month ?? null,
                'card_exp_year'  => $pm->card->exp_year  ?? null,
            ])->save();
        } catch (\Throwable $e) {
            Log::warning('Could not refresh card metadata', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Cancel at period end (keeps access until current_period_end).
     */
    public function cancelSubscription(Tenant $tenant): void
    {
        if (! $tenant->stripe_subscription_id) {
            // Nothing to cancel on Stripe — local-only flag (legacy tenants)
            $tenant->update([
                'subscription_status'      => SubscriptionStatus::Canceled,
                'subscription_canceled_at' => now(),
            ]);
            return;
        }

        $this->stripe()->subscriptions->update($tenant->stripe_subscription_id, [
            'cancel_at_period_end' => true,
        ]);

        $tenant->update([
            'subscription_status'      => SubscriptionStatus::Canceled,
            'subscription_canceled_at' => now(),
        ]);
    }

    /**
     * Sync local tenant state from a Stripe Subscription object (called from
     * webhooks). Idempotent.
     */
    public function syncFromStripeSubscription(\Stripe\Subscription $sub): void
    {
        $tenant = Tenant::where('stripe_subscription_id', $sub->id)->first();
        if (! $tenant) {
            // Fall back to customer
            $tenant = Tenant::where('stripe_customer_id', $sub->customer)->first();
            if (! $tenant) return;
            $tenant->stripe_subscription_id = $sub->id;
        }

        $status = match ($sub->status) {
            'trialing'                                  => SubscriptionStatus::Trialing,
            'active'                                    => SubscriptionStatus::Active,
            'past_due', 'unpaid', 'incomplete'          => SubscriptionStatus::PastDue,
            'canceled', 'incomplete_expired'            => SubscriptionStatus::Expired,
            default                                     => $tenant->subscription_status,
        };

        // If the user requested cancel-at-period-end, keep "Canceled" label
        if (! empty($sub->cancel_at_period_end) && $status === SubscriptionStatus::Active) {
            $status = SubscriptionStatus::Canceled;
        }

        $tenant->forceFill([
            'subscription_status'  => $status->value ?? $status,
            'trial_ends_at'        => $sub->trial_end ? Carbon::createFromTimestamp($sub->trial_end) : $tenant->trial_ends_at,
            'subscription_ends_at' => $sub->current_period_end ? Carbon::createFromTimestamp($sub->current_period_end) : $tenant->subscription_ends_at,
        ])->save();
    }

    /**
     * Sweep trials whose end date has passed without an active subscription
     * (legacy tenants only — Stripe-managed trials transition automatically).
     */
    public function expireEndedTrials(): int
    {
        return Tenant::query()
            ->where('subscription_status', SubscriptionStatus::Trialing->value)
            ->whereNull('stripe_subscription_id')
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<=', now())
            ->update(['subscription_status' => SubscriptionStatus::Expired->value]);
    }

    public function expireEndedCancellations(): int
    {
        return Tenant::query()
            ->where('subscription_status', SubscriptionStatus::Canceled->value)
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<=', now())
            ->update(['subscription_status' => SubscriptionStatus::Expired->value]);
    }

    /* ------------------------------------------------------------------ */
    /* Legacy helpers kept for backwards compatibility with old controllers */
    /* ------------------------------------------------------------------ */

    public function startTrial(Tenant $tenant): void
    {
        $tenant->update([
            'trial_ends_at'       => now()->addDays(self::TRIAL_DAYS),
            'subscription_status' => SubscriptionStatus::Trialing,
        ]);
    }

    public function createCheckoutUrl(Tenant $tenant): string
    {
        return config('app.frontend_url') . '/onboarding/plan';
    }
}
