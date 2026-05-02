<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Stripe\Exception\CardException;
use Stripe\StripeClient;

class WalletController extends Controller
{
    public function __construct(private WalletService $wallet) {}

    /** Skip-trace economics. 100 traces = $20 minimum. */
    public const RATE_PER_TRACE = 0.20;
    public const MIN_TRACES     = 100;
    public const MAX_TRACES     = 10000; // $2,000 cap

    /**
     * Convert a USD balance into a whole number of skip traces.
     */
    private function tracesFromBalance(float $balance): int
    {
        return (int) floor($balance / self::RATE_PER_TRACE);
    }

    /**
     * Return current balance, traces remaining, and saved card (if any).
     * Always live-fetches the default payment method from Stripe so the
     * confirm-purchase screen never shows a stale card.
     */
    public function summary(Request $request)
    {
        $user   = $request->user();
        $tenant = $user->tenant;

        $card = null;

        // Live-fetch from Stripe when we have a customer ID, so the card
        // shown in "Confirm purchase" always matches what will be charged.
        if ($tenant && $tenant->stripe_customer_id) {
            $secret = config('services.stripe.secret');
            if ($secret && !str_starts_with($secret, 'pk_')) {
                try {
                    $stripe   = new StripeClient($secret);
                    $customer = $stripe->customers->retrieve($tenant->stripe_customer_id);
                    $defaultPmId = $customer->invoice_settings->default_payment_method ?? null;

                    if ($defaultPmId) {
                        $pm = $stripe->paymentMethods->retrieve($defaultPmId);
                        if (!empty($pm->card)) {
                            $card = [
                                'brand'     => $pm->card->brand,
                                'last4'     => $pm->card->last4,
                                'exp_month' => $pm->card->exp_month,
                                'exp_year'  => $pm->card->exp_year,
                            ];
                            // Write-through: keep tenant cache in sync.
                            $tenant->forceFill([
                                'card_brand'     => $pm->card->brand,
                                'card_last4'     => $pm->card->last4,
                                'card_exp_month' => $pm->card->exp_month,
                                'card_exp_year'  => $pm->card->exp_year,
                            ])->save();
                        }
                    } elseif ($tenant->card_last4) {
                        // No Stripe default set yet — fall back to cached value.
                        $card = [
                            'brand'     => $tenant->card_brand,
                            'last4'     => $tenant->card_last4,
                            'exp_month' => $tenant->card_exp_month,
                            'exp_year'  => $tenant->card_exp_year,
                        ];
                    }
                } catch (\Throwable $e) {
                    // Stripe unreachable — fall back to cached columns.
                    if ($tenant->card_last4) {
                        $card = [
                            'brand'     => $tenant->card_brand,
                            'last4'     => $tenant->card_last4,
                            'exp_month' => $tenant->card_exp_month,
                            'exp_year'  => $tenant->card_exp_year,
                        ];
                    }
                }
            }
        } elseif ($tenant && $tenant->card_last4) {
            $card = [
                'brand'     => $tenant->card_brand,
                'last4'     => $tenant->card_last4,
                'exp_month' => $tenant->card_exp_month,
                'exp_year'  => $tenant->card_exp_year,
            ];
        }

        return response()->json([
            'balance'        => (float) $user->balance,
            'skip_traces'    => $this->tracesFromBalance((float) $user->balance),
            'rate_per_trace' => self::RATE_PER_TRACE,
            'min_traces'     => self::MIN_TRACES,
            'max_traces'     => self::MAX_TRACES,
            'card'           => $card,
        ]);
    }

    /**
     * List the authenticated user's transactions.
     */
    public function transactions(Request $request)
    {
        $txs = $request->user()
            ->walletTransactions()
            ->limit(100)
            ->get(['id', 'type', 'amount', 'balance_after', 'description', 'status', 'created_at']);

        return response()->json(['data' => $txs]);
    }

    /**
     * Step 1 of top-up (Stripe Elements path): create a PaymentIntent for
     * `traces` skip traces and return its client_secret.
     */
    public function createTopUpIntent(Request $request)
    {
        $data = $request->validate([
            'traces' => ['required', 'integer', 'min:' . self::MIN_TRACES, 'max:' . self::MAX_TRACES],
        ]);

        $secret = config('services.stripe.secret');
        if (!$secret) {
            return response()->json(['message' => 'Payments are not configured.'], 503);
        }

        $user   = $request->user();
        $tenant = $user->tenant;
        $stripe = new StripeClient($secret);

        if (!$tenant->stripe_customer_id) {
            $customer = $stripe->customers->create([
                'email'    => $user->email,
                'name'     => $tenant->name ?: $user->name,
                'metadata' => ['tenant_id' => (string) $tenant->id],
            ]);
            $tenant->forceFill(['stripe_customer_id' => $customer->id])->save();
        }

        $traces = (int) $data['traces'];
        $amount = round($traces * self::RATE_PER_TRACE, 2);

        $intent = $stripe->paymentIntents->create([
            'amount'               => (int) round($amount * 100),
            'currency'             => 'usd',
            'customer'             => $tenant->stripe_customer_id,
            'payment_method_types' => ['card', 'link', 'us_bank_account'],
            'setup_future_usage'   => 'off_session',
            'metadata' => [
                'user_id'   => (string) $user->id,
                'tenant_id' => (string) $tenant->id,
                'purpose'   => 'wallet_topup',
                'traces'    => (string) $traces,
            ],
        ]);

        return response()->json([
            'client_secret' => $intent->client_secret,
            'amount'        => $amount,
            'traces'        => $traces,
        ]);
    }

    /**
     * One-click off-session charge using the customer's default payment method.
     *
     * Responses:
     *  - 200 status=succeeded         → wallet credited, returns balance + tx
     *  - 200 status=requires_action   → returns client_secret for 3DS
     *  - 402                          → declined
     *  - 422                          → no saved card / config error
     */
    public function chargeSavedCard(Request $request)
    {
        $data = $request->validate([
            'traces' => ['required', 'integer', 'min:' . self::MIN_TRACES, 'max:' . self::MAX_TRACES],
        ]);

        $secret = config('services.stripe.secret');
        if (!$secret) {
            return response()->json(['message' => 'Payments are not configured.'], 503);
        }

        $user   = $request->user();
        $tenant = $user->tenant;

        if (!$tenant->stripe_customer_id) {
            return response()->json(['message' => 'No saved payment method.'], 422);
        }

        $stripe = new StripeClient($secret);

        $customer  = $stripe->customers->retrieve($tenant->stripe_customer_id);
        $defaultPm = $customer->invoice_settings->default_payment_method ?? null;

        if (!$defaultPm) {
            // Fallback: pick the most recently attached card.
            $pms = $stripe->paymentMethods->all([
                'customer' => $tenant->stripe_customer_id,
                'type'     => 'card',
                'limit'    => 1,
            ]);
            $defaultPm = $pms->data[0]->id ?? null;
        }

        if (!$defaultPm) {
            return response()->json(['message' => 'No saved payment method.'], 422);
        }

        $traces = (int) $data['traces'];
        $amount = round($traces * self::RATE_PER_TRACE, 2);

        try {
            $intent = $stripe->paymentIntents->create([
                'amount'         => (int) round($amount * 100),
                'currency'       => 'usd',
                'customer'       => $tenant->stripe_customer_id,
                'payment_method' => $defaultPm,
                'off_session'    => true,
                'confirm'        => true,
                'metadata' => [
                    'user_id'   => (string) $user->id,
                    'tenant_id' => (string) $tenant->id,
                    'purpose'   => 'wallet_topup',
                    'traces'    => (string) $traces,
                ],
            ]);
        } catch (CardException $e) {
            $pi = $e->getError()->payment_intent ?? null;
            if ($pi && $pi->status === 'requires_action') {
                return response()->json([
                    'status'        => 'requires_action',
                    'client_secret' => $pi->client_secret,
                    'traces'        => $traces,
                    'amount'        => $amount,
                ]);
            }

            return response()->json([
                'message' => $e->getError()->message ?? 'Card was declined.',
            ], 402);
        }

        if ($intent->status === 'requires_action') {
            return response()->json([
                'status'        => 'requires_action',
                'client_secret' => $intent->client_secret,
                'traces'        => $traces,
                'amount'        => $amount,
            ]);
        }

        if ($intent->status !== 'succeeded') {
            return response()->json(['message' => 'Payment could not be completed.'], 402);
        }

        // Idempotent credit (in case the webhook arrives first).
        $existing = WalletTransaction::where('user_id', $user->id)
            ->where('stripe_payment_intent_id', $intent->id)
            ->first();

        $tx = $existing ?: $this->wallet->credit(
            user: $user,
            amount: $intent->amount_received / 100,
            description: "Skip traces top-up: {$traces} traces",
            stripePaymentIntentId: $intent->id,
        );

        $fresh = $user->fresh();

        return response()->json([
            'status'      => 'succeeded',
            'balance'     => (float) $fresh->balance,
            'skip_traces' => $this->tracesFromBalance((float) $fresh->balance),
            'transaction' => $tx,
        ]);
    }

    /**
     * Step 2 of the Elements flow: verify with Stripe and credit the wallet.
     * Idempotent via unique payment_intent_id.
     */
    public function confirmTopUp(Request $request)
    {
        $data = $request->validate([
            'payment_intent_id' => ['required', 'string'],
        ]);

        $secret = config('services.stripe.secret');
        if (!$secret) {
            return response()->json(['message' => 'Payments are not configured.'], 503);
        }

        $user = $request->user();

        $existing = WalletTransaction::where('user_id', $user->id)
            ->where('stripe_payment_intent_id', $data['payment_intent_id'])
            ->first();

        if ($existing) {
            $fresh = $user->fresh();
            return response()->json([
                'balance'     => (float) $fresh->balance,
                'skip_traces' => $this->tracesFromBalance((float) $fresh->balance),
                'transaction' => $existing,
            ]);
        }

        $stripe = new StripeClient($secret);
        $intent = $stripe->paymentIntents->retrieve($data['payment_intent_id']);

        if (($intent->metadata->user_id ?? null) !== (string) $user->id) {
            return response()->json(['message' => 'Invalid payment.'], 403);
        }

        if ($intent->status !== 'succeeded') {
            return response()->json(['message' => 'Payment not completed.'], 422);
        }

        $amount = $intent->amount_received / 100;
        $traces = (int) ($intent->metadata->traces ?? round($amount / self::RATE_PER_TRACE));

        $tx = $this->wallet->credit(
            user: $user,
            amount: $amount,
            description: "Skip traces top-up: {$traces} traces",
            stripePaymentIntentId: $intent->id,
        );

        $fresh = $user->fresh();

        return response()->json([
            'balance'     => (float) $fresh->balance,
            'skip_traces' => $this->tracesFromBalance((float) $fresh->balance),
            'transaction' => $tx,
        ]);
    }
}
