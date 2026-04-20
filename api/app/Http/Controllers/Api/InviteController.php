<?php
namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Invite;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\InviteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class InviteController extends Controller
{
    public function __construct(
        private InviteService $invites,
        private ActivityLogger $logger,
    ) {}

    public function create(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
        ]);

        $invite = $this->invites->createFor($request->user()->tenant_id, $data['email']);

        $this->logger->log($request->user(), 'invite.created', metadata: ['email' => $data['email']]);

        return response()->json([
            'invite_url' => $this->invites->buildAcceptUrl($invite),
            'email'      => $invite->email,
            'expires_at' => $invite->expires_at,
        ]);
    }

    public function index(Request $request)
    {
        return response()->json(
            Invite::where('tenant_id', $request->user()->tenant_id)
                ->latest()->limit(100)->get()
        );
    }

    public function accept(Request $request)
    {
        $data = $request->validate([
            'token'    => ['required', 'string'],
            'name'     => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $invite = Invite::where('token', $data['token'])->firstOrFail();
        abort_unless($invite->isValid(), 410, 'Invite has expired or already been used.');

        $user = DB::transaction(function () use ($data, $invite) {
            $user = User::create([
                'tenant_id' => $invite->tenant_id,
                'name'      => $data['name'],
                'email'     => $invite->email,
                'password'  => $data['password'],
                'role'      => Role::Employee,
            ]);
            $invite->update(['accepted_at' => now()]);
            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['user' => $user->fresh(['tenant'])]);
    }
}
