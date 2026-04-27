<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Stripe\StripeClient;

class WalletController extends Controller
{
    public function __construct(private WalletService $wallet) {}

    private const MIN_TOPUP = 5.00;
    private const MAX_TOPUP = 2000.00;

    /**
     * Return current balance + summary.
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'balance' => (float) $user->balance,
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
     * Step 1 of top-up: create a Stripe PaymentIntent, return its client_secret.
     */
    public function createTopUpIntent(Request $request)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:' . self::MIN_TOPUP, 'max:' . self::MAX_TOPUP],
        ]);

        $secret = config('services.stripe.secret');
        if (!$secret) {
            return response()->json(['message' => 'Payments are not configured.'], 503);
        }

        $user   = $request->user();
        $stripe = new StripeClient($secret);

        // Lazy-create the tenant's Stripe customer so cards saved during
        // top-up are reusable from /settings.
        $tenant = $user->tenant;
        if (!$tenant->stripe_customer_id) {
            $customer = $stripe->customers->create([
                'email' => $user->email,
                'name'  => $tenant->name ?: $user->name,
                'metadata' => ['tenant_id' => (string) $tenant->id],
            ]);
            $tenant->forceFill(['stripe_customer_id' => $customer->id])->save();
        }

        $intent = $stripe->paymentIntents->create([
            'amount'               => (int) round($data['amount'] * 100), // Stripe uses cents
            'currency'             => 'usd',
            'customer'             => $tenant->stripe_customer_id,
            'payment_method_types' => ['card', 'link', 'us_bank_account'],
            'setup_future_usage'   => 'off_session',
            'metadata' => [
                'user_id'   => (string) $user->id,
                'tenant_id' => (string) $user->tenant_id,
                'purpose'   => 'wallet_topup',
            ],
        ]);

        return response()->json([
            'client_secret' => $intent->client_secret,
            'amount'        => $data['amount'],
        ]);
    }

    /**
     * Step 2: after the client-side confirmation succeeds, call this to verify
     * with Stripe and credit the wallet. Idempotent via unique payment_intent_id.
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

        // Idempotency: if we already credited this intent, return early.
        $existing = WalletTransaction::where('user_id', $user->id)
            ->where('stripe_payment_intent_id', $data['payment_intent_id'])
            ->first();

        if ($existing) {
            return response()->json([
                'balance'     => (float) $user->fresh()->balance,
                'transaction' => $existing,
            ]);
        }

        $stripe = new StripeClient($secret);
        $intent = $stripe->paymentIntents->retrieve($data['payment_intent_id']);

        // Security: verify the intent belongs to this user
        if (($intent->metadata->user_id ?? null) !== (string) $user->id) {
            return response()->json(['message' => 'Invalid payment.'], 403);
        }

        if ($intent->status !== 'succeeded') {
            return response()->json(['message' => 'Payment not completed.'], 422);
        }

        $amount = $intent->amount_received / 100;

        $tx = $this->wallet->credit(
            user: $user,
            amount: $amount,
            description: 'Wallet top-up',
            stripePaymentIntentId: $intent->id,
        );

        return response()->json([
            'balance'     => (float) $user->fresh()->balance,
            'transaction' => $tx,
        ]);
    }
}
