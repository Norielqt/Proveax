<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function __construct(
        private SubscriptionService $subscriptions,
        private ActivityLogger $logger,
    ) {}

    /**
     * Return a Google OAuth redirect URL.
     * We store the caller's frontend origin in a short-lived cache entry and
     * pass the cache key as the OAuth `state`. Google returns the state unchanged
     * in the callback, so we can look up the correct frontend host to redirect to.
     * This means desktop (localhost:5173) and phone (192.168.x.x:5173) both
     * land back on the host they started from.
     */
    public function redirectUrl(Request $request): \Illuminate\Http\JsonResponse
    {
        // Determine the frontend origin from the Origin header (most reliable).
        // Falls back to FRONTEND_URL for non-browser callers.
        $rawOrigin = $request->header('Origin') ?? env('FRONTEND_URL', 'http://localhost:5173');
        $parsed    = parse_url(rtrim($rawOrigin, '/'));
        $frontendOrigin = ($parsed['scheme'] ?? 'http') . '://' . ($parsed['host'] ?? 'localhost')
            . (isset($parsed['port']) ? ':' . $parsed['port'] : '');

        // Store origin in cache; pass the opaque key as the OAuth state.
        $stateKey = Str::random(40);
        Cache::put('google_origin:' . $stateKey, $frontendOrigin, now()->addMinutes(15));

        $url = Socialite::driver('google')
            ->stateless()
            ->with(['state' => $stateKey])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['url' => $url]);
    }

    /**
     * Google redirects here after the user consents.
     * We authenticate or stage the user, then redirect back to the frontend
     * callback page. This works for both desktop and mobile (no popup needed).
     */
    public function callback(Request $request)
    {
        // Recover the frontend origin from cache using the state key Google
        // passes back unchanged. Falls back to FRONTEND_URL if missing.
        $stateKey      = $request->query('state', '');
        $frontendOrigin = rtrim(
            Cache::pull('google_origin:' . $stateKey) ?? env('FRONTEND_URL', 'http://localhost:5173'),
            '/'
        );

        try {
            $driver = Socialite::driver('google')->stateless();

            // On local dev, PHP's bundled CA bundle can't verify Google's cert.
            // Skip SSL verification outside of production.
            if (! app()->isProduction()) {
                $driver->setHttpClient(new \GuzzleHttp\Client(['verify' => false]));
            }

            $googleUser = $driver->user();
        } catch (\Throwable $e) {
            Log::error('Google OAuth callback failed', [
                'error'   => $e->getMessage(),
                'class'   => get_class($e),
            ]);
            return $this->popupClose('google_error', 'OAuth failed.', $frontendOrigin);
        }

        // --- Existing user: login immediately ---
        $user = User::withoutGlobalScopes()->where('google_id', $googleUser->getId())->first()
            ?? User::withoutGlobalScopes()->where('email', $googleUser->getEmail())->first();

        if ($user) {
            // Link google_id if they previously registered with email
            if (!$user->google_id) {
                $user->update(['google_id' => $googleUser->getId()]);
            }

            $this->logger->log($user, 'user.login.google');
            $token = $user->createToken('api')->plainTextToken;
            return $this->popupClose('google_login_ok', $token, $frontendOrigin);
        }

        // --- New user: issue a short-lived staging token ---
        // We can't create a tenant yet because we need company_name.
        $stagingToken = Str::random(40);
        Cache::put("google_stage:{$stagingToken}", [
            'google_id' => $googleUser->getId(),
            'name'      => $googleUser->getName(),
            'email'     => $googleUser->getEmail(),
            'avatar'    => $googleUser->getAvatar(),
        ], now()->addMinutes(15));

        return $this->popupClose('google_onboard', $stagingToken, $frontendOrigin);
    }

    /**
     * Called by the onboarding form to complete account creation.
     */
    public function complete(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate([
            'staging_token' => ['required', 'string'],
            'company_name'  => ['required', 'string', 'max:160'],
        ]);

        $cacheKey = "google_stage:{$request->staging_token}";
        $staged   = Cache::get($cacheKey);

        if (!$staged) {
            return response()->json(['message' => 'Session expired. Please try Google sign-in again.'], 422);
        }

        // Guard: email taken by a different tenant after the staging token was issued
        if (User::withoutGlobalScopes()->where('email', $staged['email'])->exists()) {
            Cache::forget($cacheKey);
            return response()->json(['message' => 'An account with this email already exists.'], 409);
        }

        $user = DB::transaction(function () use ($staged, $request) {
            $tenant = Tenant::create([
                'name' => $request->company_name,
                'slug' => Str::slug($request->company_name) . '-' . Str::random(6),
            ]);

            // NOTE: Trial is no longer auto-started here. The admin must pick
            // a plan and enter a card via /onboarding/plan, which then creates
            // a real Stripe Subscription with trial_period_days=7.

            return User::create([
                'tenant_id' => $tenant->id,
                'name'      => $staged['name'],
                'email'     => $staged['email'],
                'google_id' => $staged['google_id'],
                'password'  => null,
                'role'      => Role::Admin,
            ]);
        });

        Cache::forget($cacheKey);

        $this->logger->log($user, 'admin.registered.google');
        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user'   => $user->fresh(),
            'tenant' => $user->tenant,
            'token'  => $token,
        ], 201);
    }

    // -------------------------------------------------------------------------

    /**
     * Redirect the browser back to the frontend callback page with the result
     * encoded as query parameters. Works for both desktop and mobile — no popup.
     */
    private function popupClose(string $status, string $payload = '', string $frontendOrigin = '')
    {
        if (!$frontendOrigin) {
            $frontendOrigin = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
        }
        $url = $frontendOrigin . '/auth/google/callback?' . http_build_query([
            'type'    => $status,
            'payload' => $payload,
        ]);
        return redirect()->away($url);
    }
}
