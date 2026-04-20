<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function __construct(
        private SubscriptionService $subscriptions,
        private ActivityLogger $logger,
    ) {}

    /**
     * Return a Google OAuth redirect URL for the frontend to open in a popup.
     */
    public function redirectUrl(): \Illuminate\Http\JsonResponse
    {
        $url = Socialite::driver('google')
            ->stateless()
            ->redirect()
            ->getTargetUrl();

        return response()->json(['url' => $url]);
    }

    /**
     * Google redirects the popup here after the user consents.
     * We authenticate or stage the user, then close the popup with postMessage.
     */
    public function callback(Request $request): \Illuminate\Http\Response
    {
        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable) {
            return $this->popupClose('google_error', 'OAuth failed.');
        }

        // --- Existing user: login immediately ---
        $user = User::withoutGlobalScopes()->where('google_id', $googleUser->getId())->first()
            ?? User::withoutGlobalScopes()->where('email', $googleUser->getEmail())->first();

        if ($user) {
            // Link google_id if they previously registered with email
            if (!$user->google_id) {
                $user->update(['google_id' => $googleUser->getId()]);
            }

            Auth::login($user, remember: true);
            $request->session()->regenerate();
            $this->logger->log($user, 'user.login.google');

            return $this->popupClose('google_login_ok');
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

        return $this->popupClose('google_onboard', $stagingToken);
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

            $this->subscriptions->startTrial($tenant);

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

        Auth::login($user, remember: true);
        $request->session()->regenerate();
        $this->logger->log($user, 'admin.registered.google');

        return response()->json([
            'user'   => $user->fresh(),
            'tenant' => $user->tenant,
        ], 201);
    }

    // -------------------------------------------------------------------------

    private function popupClose(string $status, string $payload = ''): \Illuminate\Http\Response
    {
        $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173'));

        // Sanitise: only allow alphanumeric + basic punctuation in payload
        $safePayload = preg_replace('/[^a-zA-Z0-9_\-]/', '', $payload);
        $safeStatus  = preg_replace('/[^a-zA-Z0-9_]/', '', $status);

        $html = <<<HTML
        <!doctype html>
        <html>
        <head><meta charset="utf-8"></head>
        <body>
        <script>
          if (window.opener) {
            window.opener.postMessage(
              { type: '{$safeStatus}', payload: '{$safePayload}' },
              '{$frontendUrl}'
            );
          }
          window.close();
        </script>
        </body>
        </html>
        HTML;

        return response($html, 200)->header('Content-Type', 'text/html');
    }
}
