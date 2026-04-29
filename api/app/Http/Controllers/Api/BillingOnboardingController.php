<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

class BillingOnboardingController extends Controller
{
    public function __construct(
        private SubscriptionService $subscriptions,
        private ActivityLogger $logger,
    ) {}

    /**
     * GET /api/billing/onboarding/state
     * Tells the client whether the user must complete plan + card.
     */
    public function state(Request $request)
    {
        $user   = $request->user();
        $tenant = $user->tenant;

        return response()->json([
            'needs_onboarding' => $tenant->needsBillingOnboarding(),
            'is_admin'         => $user->isAdmin(),
        ]);
    }

    /**
     * POST /api/billing/onboarding/setup-intent
     * Returns client_secret for Stripe Elements (SetupIntent — no charge).
     */
    public function setupIntent(Request $request)
    {
        $this->ensureAdmin($request);

        return response()->json(
            $this->subscriptions->createOnboardingSetupIntent(
                $request->user()->tenant,
                $request->user(),
            )
        );
    }

    /**
     * POST /api/billing/onboarding/subscribe
     * { plan: 'starter|team|business', payment_method_id: 'pm_xxx' }
     *
     * Creates the Stripe Subscription with a 7-day trial. Stripe will
     * automatically charge the saved card on day 7.
     */
    public function subscribe(Request $request)
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'plan'              => ['required', 'string', 'in:starter,team,business'],
            'payment_method_id' => ['required', 'string', 'starts_with:pm_'],
        ]);

        $result = $this->subscriptions->startTrialingSubscription(
            $request->user()->tenant,
            $request->user(),
            $data['plan'],
            $data['payment_method_id'],
        );

        $this->logger->log($request->user(), 'billing.onboarded', null, [
            'plan' => $data['plan'],
        ]);

        return response()->json([
            'ok'     => true,
            'tenant' => $request->user()->tenant->fresh(),
            'stripe' => $result,
        ]);
    }

    private function ensureAdmin(Request $request): void
    {
        if (! $request->user()->isAdmin()) {
            abort(403, 'Only the workspace admin can manage billing.');
        }
    }
}
