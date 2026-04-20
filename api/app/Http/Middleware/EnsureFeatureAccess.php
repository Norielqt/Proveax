<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFeatureAccess
{
    public function handle(Request $request, Closure $next, string $level = 'any'): Response
    {
        $tenant = $request->user()?->tenant;

        if (!$tenant) {
            return response()->json(['message' => 'Tenant not found.'], 403);
        }

        $ok = match ($level) {
            'paid'  => $tenant->hasActiveSubscription(),
            default => $tenant->hasFeatureAccess(),
        };

        if (!$ok) {
            return response()->json([
                'message' => $level === 'paid'
                    ? 'This feature requires a paid subscription.'
                    : 'Your trial has expired. Please subscribe to continue.',
                'code'           => $level === 'paid' ? 'UPGRADE_REQUIRED' : 'TRIAL_EXPIRED',
                'trial_ends_at'  => $tenant->trial_ends_at,
                'status'         => $tenant->subscription_status?->value,
            ], 402);
        }

        return $next($request);
    }
}
