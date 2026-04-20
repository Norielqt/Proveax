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
            'status'          => $tenant->subscription_status?->value,
            'trial_ends_at'   => $tenant->trial_ends_at,
            'is_on_trial'     => $tenant->isOnTrial(),
            'is_active'       => $tenant->hasActiveSubscription(),
            'has_access'      => $tenant->hasFeatureAccess(),
            'days_left'       => $tenant->trial_ends_at
                ? max(0, (int) now()->diffInDays($tenant->trial_ends_at, false))
                : null,
        ]);
    }

    public function createCheckout(Request $request)
    {
        return response()->json([
            'url' => $this->subscriptions->createCheckoutUrl($request->user()->tenant),
        ]);
    }
}
