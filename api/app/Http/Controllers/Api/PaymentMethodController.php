<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;

class PaymentMethodController extends Controller
{
    private function stripe(): ?StripeClient
    {
        $secret = config('services.stripe.secret');
        return $secret ? new StripeClient($secret) : null;
    }

    /**
     * Lazy-create a Stripe customer for this tenant if missing, return its id.
     */
    private function ensureCustomer(Tenant $tenant, $user, StripeClient $stripe): string
    {
        if ($tenant->stripe_customer_id) {
            return $tenant->stripe_customer_id;
        }

        $customer = $stripe->customers->create([
            'email' => $user->email,
            'name'  => $tenant->name ?: $user->name,
            'metadata' => [
                'tenant_id' => (string) $tenant->id,
            ],
        ]);

        $tenant->forceFill(['stripe_customer_id' => $customer->id])->save();
        return $customer->id;
    }

    /**
     * GET /api/payment-methods — list saved cards for the tenant.
     */
    public function index(Request $request)
    {
        $stripe = $this->stripe();
        if (!$stripe) {
            return response()->json(['data' => [], 'default_id' => null]);
        }

        $user   = $request->user();
        $tenant = $user->tenant;

        // No customer yet → no cards
        if (!$tenant->stripe_customer_id) {
            return response()->json(['data' => [], 'default_id' => null]);
        }

        try {
            $customer = $stripe->customers->retrieve($tenant->stripe_customer_id);
            $defaultId = $customer->invoice_settings->default_payment_method ?? null;

            $methods = $stripe->paymentMethods->all([
                'customer' => $tenant->stripe_customer_id,
                'type'     => 'card',
                'limit'    => 20,
            ]);

            $data = collect($methods->data)->map(fn ($pm) => [
                'id'         => $pm->id,
                'brand'      => $pm->card->brand ?? 'card',
                'last4'      => $pm->card->last4 ?? '••••',
                'exp_month'  => $pm->card->exp_month ?? null,
                'exp_year'   => $pm->card->exp_year ?? null,
                'is_default' => $pm->id === $defaultId,
            ])->values();

            return response()->json(['data' => $data, 'default_id' => $defaultId]);
        } catch (\Throwable $e) {
            Log::error('Stripe paymentMethods.index failed', ['error' => $e->getMessage()]);
            return response()->json(['data' => [], 'default_id' => null]);
        }
    }

    /**
     * POST /api/payment-methods/setup-intent — create a SetupIntent for adding a new card.
     */
    public function createSetupIntent(Request $request)
    {
        $stripe = $this->stripe();
        if (!$stripe) {
            return response()->json(['message' => 'Payments are not configured.'], 503);
        }

        $user   = $request->user();
        $tenant = $user->tenant;
        $customerId = $this->ensureCustomer($tenant, $user, $stripe);

        $intent = $stripe->setupIntents->create([
            'customer'             => $customerId,
            'payment_method_types' => ['card'],
            'usage'                => 'off_session',
            'metadata' => [
                'tenant_id' => (string) $tenant->id,
                'user_id'   => (string) $user->id,
                'purpose'   => 'add_payment_method',
            ],
        ]);

        return response()->json([
            'client_secret' => $intent->client_secret,
        ]);
    }

    /**
     * POST /api/payment-methods/{id}/default — make a card the default.
     */
    public function setDefault(Request $request, string $id)
    {
        $stripe = $this->stripe();
        if (!$stripe) {
            return response()->json(['message' => 'Payments are not configured.'], 503);
        }

        $tenant = $request->user()->tenant;
        if (!$tenant->stripe_customer_id) {
            return response()->json(['message' => 'No customer.'], 404);
        }

        // Security: confirm this PM belongs to the tenant's customer
        $pm = $stripe->paymentMethods->retrieve($id);
        if ($pm->customer !== $tenant->stripe_customer_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $stripe->customers->update($tenant->stripe_customer_id, [
            'invoice_settings' => ['default_payment_method' => $id],
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * DELETE /api/payment-methods/{id} — detach a card.
     */
    public function destroy(Request $request, string $id)
    {
        $stripe = $this->stripe();
        if (!$stripe) {
            return response()->json(['message' => 'Payments are not configured.'], 503);
        }

        $tenant = $request->user()->tenant;
        if (!$tenant->stripe_customer_id) {
            return response()->json(['message' => 'No customer.'], 404);
        }

        $pm = $stripe->paymentMethods->retrieve($id);
        if ($pm->customer !== $tenant->stripe_customer_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $stripe->paymentMethods->detach($id);
        return response()->noContent();
    }
}
