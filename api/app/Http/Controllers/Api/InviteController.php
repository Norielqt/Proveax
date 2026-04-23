<?php
namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Invite;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\InviteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;

class InviteController extends Controller
{
    public function __construct(
        private InviteService $invites,
        private ActivityLogger $logger,
    ) {}

    public function create(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc'],
            'role'  => ['nullable', Rule::in(['admin', 'employee'])],
        ]);

        $tenantId = $request->user()->tenant_id;
        $tenant   = $request->user()->tenant;

        // Seat limit enforcement based on subscription plan
        if (!$tenant->isSeatAvailable()) {
            return response()->json([
                'message' => 'Seat limit reached for your current plan. Upgrade to invite more team members.',
                'seats_used'  => $tenant->seatsUsed(),
                'seat_limit'  => $tenant->seatLimit(),
            ], 422);
        }

        // Reject if an active user with this email already exists in ANY tenant
        if (User::withoutGlobalScope(\App\Scopes\TenantScope::class)
                ->where('email', $data['email'])->exists()) {
            return response()->json(['message' => 'A user with this email already exists.'], 422);
        }

        // Rate limit: max 20 invite creates per tenant per hour
        $key = 'invites:create:' . $tenantId;
        if (RateLimiter::tooManyAttempts($key, 20)) {
            return response()->json([
                'message' => 'Too many invites sent. Please try again later.',
            ], 429);
        }
        RateLimiter::hit($key, 3600);

        $invite = $this->invites->createFor(
            $tenantId,
            $request->user()->id,
            $data['email'],
            $data['role'] ?? 'employee',
        );

        $emailSent = $this->invites->sendEmail($invite, $request->user());

        $this->logger->log($request->user(), 'invite.created', metadata: [
            'email'      => $data['email'],
            'invite_id'  => $invite->id,
            'email_sent' => $emailSent,
        ]);

        return response()->json([
            'invite'     => $invite->fresh()->append('status'),
            'invite_url' => $this->invites->buildAcceptUrl($invite),
            'email_sent' => $emailSent,
        ], 201);
    }

    public function index(Request $request)
    {
        $invites = Invite::where('tenant_id', $request->user()->tenant_id)
            ->with('invitedBy:id,name,email')
            ->latest()
            ->limit(200)
            ->get()
            ->append('status');

        return response()->json($invites);
    }

    public function resend(Request $request, int $id)
    {
        $invite = Invite::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        if ($invite->accepted_at) {
            return response()->json(['message' => 'Invite already accepted.'], 422);
        }

        $invite->regenerate();
        $emailSent = $this->invites->sendEmail($invite, $request->user());

        $this->logger->log($request->user(), 'invite.resent', metadata: [
            'invite_id'  => $invite->id,
            'email'      => $invite->email,
            'email_sent' => $emailSent,
        ]);

        return response()->json([
            'invite'     => $invite->fresh()->append('status'),
            'invite_url' => $this->invites->buildAcceptUrl($invite),
            'email_sent' => $emailSent,
        ]);
    }

    public function revoke(Request $request, int $id)
    {
        $invite = Invite::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        if ($invite->accepted_at) {
            return response()->json(['message' => 'Cannot revoke an accepted invite.'], 422);
        }

        $invite->update(['revoked_at' => now()]);

        $this->logger->log($request->user(), 'invite.revoked', metadata: [
            'invite_id' => $invite->id,
            'email'     => $invite->email,
        ]);

        return response()->json(['invite' => $invite->fresh()->append('status')]);
    }

    public function accept(Request $request)
    {
        $data = $request->validate([
            'token'    => ['required', 'string'],
            'name'     => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = DB::transaction(function () use ($data) {
            // Lock the invite row so a double-submit can't create two users
            $invite = Invite::where('token', $data['token'])
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($invite->isValid(), 410, 'Invite has expired or already been used.');

            // Seat limit check (plan may have downgraded since invite was sent).
            // Exclude this pending invite from the count since it will be consumed.
            $tenant = \App\Models\Tenant::find($invite->tenant_id);
            if ($tenant) {
                $limit = $tenant->seatLimit();
                if ($limit !== null) {
                    $users = $tenant->users()->count();
                    if ($users >= $limit) {
                        abort(422, 'This workspace has reached its seat limit. Please contact the admin.');
                    }
                }
            }

            // Final safety: email must not already exist
            $exists = User::withoutGlobalScope(\App\Scopes\TenantScope::class)
                ->where('email', $invite->email)->exists();
            abort_if($exists, 409, 'A user with this email already exists.');

            $role = $invite->role === 'admin' ? Role::Admin : Role::Employee;

            $user = User::create([
                'tenant_id'          => $invite->tenant_id,
                'invited_by_user_id' => $invite->invited_by_user_id,
                'name'               => $data['name'],
                'email'              => $invite->email,
                'password'           => $data['password'],
                'role'               => $role,
            ]);

            $invite->update(['accepted_at' => now()]);
            return $user;
        });

        $token = $user->createToken('api')->plainTextToken;
        return response()->json(['user' => $user->fresh(['tenant']), 'token' => $token]);
    }
}
