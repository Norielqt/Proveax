<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions) {}

    public function status(Request $request)
    {
        $tenant = $request->user()->tenant;

        return response()->json([
            'status'                   => $tenant->subscription_status?->value,
            'plan'                     => $tenant->subscription_plan,
            'trial_ends_at'            => $tenant->trial_ends_at,
            'subscription_ends_at'     => $tenant->subscription_ends_at,
            'subscription_canceled_at' => $tenant->subscription_canceled_at,
            'is_on_trial'              => $tenant->isOnTrial(),
            'is_active'                => $tenant->hasActiveSubscription(),
            'is_canceled'              => $tenant->isCanceled(),
            'has_access'               => $tenant->hasFeatureAccess(),
            'needs_onboarding'         => $tenant->needsBillingOnboarding(),
            'days_left'                => $tenant->trial_ends_at
                ? max(0, (int) now()->diffInDays($tenant->trial_ends_at, false))
                : null,
            'seat_limit'               => $tenant->seatLimit(),
            'seats_used'               => $tenant->seatsUsed(),
            'seats_remaining'          => $tenant->seatsRemaining(),
            'card' => $tenant->card_last4 ? [
                'brand'     => $tenant->card_brand,
                'last4'     => $tenant->card_last4,
                'exp_month' => $tenant->card_exp_month,
                'exp_year'  => $tenant->card_exp_year,
            ] : null,
        ]);
    }

    public function createCheckout(Request $request)
    {
        return response()->json([
            'url' => $this->subscriptions->createCheckoutUrl($request->user()->tenant),
        ]);
    }

    public function createSubscriptionIntent(Request $request)
    {
        // Legacy endpoint — replaced by /api/billing/onboarding/* flow.
        abort(410, 'This endpoint is no longer supported. Please use the onboarding flow.');
    }

    public function confirmSubscription(Request $request)
    {
        abort(410, 'This endpoint is no longer supported. Please use the onboarding flow.');
    }

    public function cancel(Request $request)
    {
        $tenant = $request->user()->tenant;

        if (! $tenant->hasActiveSubscription() && ! $tenant->isOnTrial()) {
            abort(422, 'No active subscription to cancel.');
        }

        $this->subscriptions->cancelSubscription($tenant);

        return response()->json(['ok' => true]);
    }
}
