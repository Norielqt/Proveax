<?php
namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class MemberController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    /**
     * GET /api/team/members
     */
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $members = User::where('tenant_id', $tenantId)
            ->select('id', 'name', 'email', 'role', 'is_paused', 'monitoring_consent_at', 'created_at')
            ->orderBy('name')
            ->get();

        return response()->json($members);
    }

    /**
     * PATCH /api/team/members/{id}/role  { role: admin|employee }
     */
    public function updateRole(Request $request, int $id)
    {
        $data = $request->validate([
            'role' => ['required', 'in:admin,employee'],
        ]);

        $me     = $request->user();
        $member = $this->findMember($id, $me->tenant_id);

        if ($member->id === $me->id) {
            throw ValidationException::withMessages(['role' => 'You cannot change your own role.']);
        }

        $member->update(['role' => $data['role']]);
        $this->logger->log($me, 'member.role_changed', $member, ['role' => $data['role']]);

        return response()->json($member->fresh());
    }

    /**
     * POST /api/team/members/{id}/pause
     */
    public function pause(Request $request, int $id)
    {
        $me     = $request->user();
        $member = $this->findMember($id, $me->tenant_id);

        if ($member->id === $me->id) {
            throw ValidationException::withMessages(['user' => 'You cannot pause yourself.']);
        }

        $member->update(['is_paused' => true]);
        $member->tokens()->delete();
        $this->logger->log($me, 'member.paused', $member);

        return response()->json($member->fresh());
    }

    /**
     * POST /api/team/members/{id}/unpause
     */
    public function unpause(Request $request, int $id)
    {
        $me     = $request->user();
        $member = $this->findMember($id, $me->tenant_id);

        $member->update(['is_paused' => false]);
        $this->logger->log($me, 'member.unpaused', $member);

        return response()->json($member->fresh());
    }

    /**
     * DELETE /api/team/members/{id}
     * Hard-deletes the user. Related work_sessions / screenshots / activity_logs
     * cascade via FK rules where appropriate; activity_logs keep user_id=null.
     */
    public function destroy(Request $request, int $id)
    {
        $me     = $request->user();
        $member = $this->findMember($id, $me->tenant_id);

        if ($member->id === $me->id) {
            throw ValidationException::withMessages(['user' => 'You cannot remove yourself.']);
        }

        // Prevent removing the last admin
        if ($member->role === Role::Admin) {
            $adminCount = User::where('tenant_id', $me->tenant_id)
                ->where('role', Role::Admin->value)
                ->count();
            if ($adminCount <= 1) {
                throw ValidationException::withMessages(['user' => 'Cannot remove the last admin.']);
            }
        }

        $this->logger->log($me, 'member.removed', $member, [
            'email' => $member->email,
            'name'  => $member->name,
        ]);

        // Invalidate tokens then delete
        $member->tokens()->delete();
        $member->delete();

        return response()->json(['ok' => true]);
    }

    private function findMember(int $id, int $tenantId): User
    {
        return User::where('tenant_id', $tenantId)->findOrFail($id);
    }
}
