<?php
namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\WelcomeNotification;
use App\Services\ActivityLogger;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(
        private SubscriptionService $subscriptions,
        private ActivityLogger $logger,
    ) {}

    public function registerAdmin(Request $request)
    {
        $data = $request->validate([
            'name'         => ['required', 'string', 'max:120'],
            'email'        => ['required', 'email', 'unique:users,email'],
            'password'     => ['required', 'string', 'min:8', 'confirmed'],
            'company_name' => ['required', 'string', 'max:160'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $tenant = Tenant::create([
                'name' => $data['company_name'],
                'slug' => Str::slug($data['company_name']) . '-' . Str::random(6),
            ]);

            $this->subscriptions->startTrial($tenant);

            return User::create([
                'tenant_id' => $tenant->id,
                'name'      => $data['name'],
                'email'     => $data['email'],
                'password'  => $data['password'],
                'role'      => Role::Admin,
            ]);
        });

        $this->logger->log($user, 'admin.registered');
        $user->load('tenant');
        try {
            $user->notify(new WelcomeNotification($user));
        } catch (\Throwable $e) {
            Log::error('Welcome email failed', [
                'user_id'   => $user->id,
                'email'     => $user->email,
                'error'     => $e->getMessage(),
                'exception' => get_class($e),
            ]);
        }
        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user'   => $user->fresh(),
            'tenant' => $user->tenant,
            'token'  => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::withoutGlobalScopes()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 422);
        }

        if ($user->is_paused) {
            return response()->json(['message' => 'Your account is paused. Contact your administrator.'], 403);
        }

        $user->load('tenant');
        $this->logger->log($user, 'user.login');
        $token = $user->createToken('api')->plainTextToken;

        return response()->json(['user' => $user, 'tenant' => $user->tenant, 'token' => $token]);
    }

    public function logout(Request $request)
    {
        $this->logger->log($request->user(), 'user.logout');
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);

        $user = $request->user();
        $user->update(['name' => $data['name']]);

        return response()->json(['user' => $user->fresh()]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user'   => $request->user(),
            'tenant' => $request->user()->tenant,
        ]);
    }

    public function consent(Request $request)
    {
        $user = $request->user();
        $user->update(['monitoring_consent_at' => now()]);
        $this->logger->log($user, 'monitoring.consent_given');

        return response()->json(['user' => $user->fresh()]);
    }
}
