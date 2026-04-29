<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions) {}

    /**
     * POST /api/webhooks/stripe
     * Verifies the Stripe signature, then dispatches by event type.
     */
    public function handle(Request $request)
    {
        $secret  = config('services.stripe.webhook_secret');
        $payload = $request->getContent();
        $sig     = $request->header('Stripe-Signature');

        if (! $secret) {
            Log::warning('Stripe webhook hit without STRIPE_WEBHOOK_SECRET');
            return response()->json(['ok' => true]);
        }

        try {
            $event = Webhook::constructEvent($payload, $sig, $secret);
        } catch (\Throwable $e) {
            Log::warning('Stripe webhook signature failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'invalid signature'], 400);
        }

        try {
            $this->dispatch($event);
        } catch (\Throwable $e) {
            // Log and return 200 so Stripe doesn't infinitely retry on app bugs;
            // we want failed events queued in our logs for inspection.
            Log::error('Stripe webhook handler failed', [
                'event' => $event->type,
                'id'    => $event->id,
                'error' => $e->getMessage(),
            ]);
        }

        return response()->json(['ok' => true]);
    }

    private function dispatch(\Stripe\Event $event): void
    {
        switch ($event->type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.trial_will_end':
                $this->subscriptions->syncFromStripeSubscription($event->data->object);
                break;

            case 'customer.subscription.deleted':
                $sub    = $event->data->object;
                $tenant = Tenant::where('stripe_subscription_id', $sub->id)->first();
                if ($tenant) {
                    $tenant->forceFill([
                        'subscription_status' => SubscriptionStatus::Expired->value,
                    ])->save();
                }
                break;

            case 'invoice.payment_failed':
                $invoice = $event->data->object;
                $tenant  = Tenant::where('stripe_customer_id', $invoice->customer)->first();
                if ($tenant) {
                    $tenant->forceFill([
                        'subscription_status' => SubscriptionStatus::PastDue->value,
                    ])->save();
                    Log::warning('Stripe invoice payment failed', [
                        'tenant_id'  => $tenant->id,
                        'invoice_id' => $invoice->id,
                    ]);
                }
                break;

            case 'invoice.paid':
                $invoice = $event->data->object;
                $tenant  = Tenant::where('stripe_customer_id', $invoice->customer)->first();
                if ($tenant) {
                    $endsAt = $invoice->lines->data[0]->period->end ?? null;
                    $tenant->forceFill([
                        'subscription_status'  => SubscriptionStatus::Active->value,
                        'subscription_ends_at' => $endsAt ? Carbon::createFromTimestamp($endsAt) : $tenant->subscription_ends_at,
                    ])->save();
                }
                break;

            case 'payment_method.attached':
            case 'payment_method.updated':
                $pm     = $event->data->object;
                $tenant = Tenant::where('stripe_customer_id', $pm->customer)->first();
                if ($tenant && ! empty($pm->card)) {
                    $tenant->forceFill([
                        'card_brand'     => $pm->card->brand,
                        'card_last4'     => $pm->card->last4,
                        'card_exp_month' => $pm->card->exp_month,
                        'card_exp_year'  => $pm->card->exp_year,
                    ])->save();
                }
                break;
        }
    }
}
