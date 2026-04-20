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
use Illuminate\Support\Facades\DB;
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

        Auth::login($user);
        $request->session()->regenerate();

        $this->logger->log($user, 'admin.registered');

        return response()->json([
            'user'   => $user->fresh(),
            'tenant' => $user->tenant,
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($data, remember: true)) {
            return response()->json(['message' => 'Invalid credentials.'], 422);
        }

        $request->session()->regenerate();
        $user = $request->user()->load('tenant');

        $this->logger->log($user, 'user.login');

        return response()->json(['user' => $user, 'tenant' => $user->tenant]);
    }

    public function logout(Request $request)
    {
        $this->logger->log($request->user(), 'user.logout');
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user'   => $request->user(),
            'tenant' => $request->user()->tenant,
        ]);
    }
}
