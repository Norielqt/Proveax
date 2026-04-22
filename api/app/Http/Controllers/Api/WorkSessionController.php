<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TeamSetting;
use App\Models\WorkSession;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class WorkSessionController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    /**
     * GET /api/work-sessions/current
     * Returns the active session for the current user (or null).
     * Also returns team settings needed by the client (interval, idle timeout).
     */
    public function current(Request $request)
    {
        $user = $request->user();

        // Auto-close any session whose heartbeat is older than 2x idle timeout
        $settings = TeamSetting::firstOrCreate(
            ['tenant_id' => $user->tenant_id],
            []
        );
        $idleMinutes = (int) ($settings->idle_timeout_minutes ?? 5);
        $staleBefore = now()->subMinutes($idleMinutes * 2);

        WorkSession::where('user_id', $user->id)
            ->whereNull('ended_at')
            ->where(function ($q) use ($staleBefore) {
                $q->where('last_heartbeat_at', '<', $staleBefore)
                  ->orWhereNull('last_heartbeat_at');
            })
            ->where('started_at', '<', $staleBefore)
            ->update([
                'ended_at'   => now(),
                'end_reason' => 'orphaned',
            ]);

        $session = WorkSession::where('user_id', $user->id)
            ->whereNull('ended_at')
            ->latest('started_at')
            ->first();

        return response()->json([
            'session'  => $session,
            'settings' => [
                'screenshot_interval_minutes' => (int) $settings->screenshot_interval_minutes,
                'idle_timeout_minutes'        => $idleMinutes,
                'screenshots_required'        => (bool) $settings->screenshots_required,
            ],
        ]);
    }

    /**
     * POST /api/work-sessions
     * { screenshots_enabled: bool }
     */
    public function start(Request $request)
    {
        $data = $request->validate([
            'screenshots_enabled' => ['required', 'boolean'],
        ]);

        $user = $request->user();

        if ($user->is_paused) {
            throw ValidationException::withMessages(['user' => 'Account is paused.']);
        }
        if (!$user->monitoring_consent_at) {
            throw ValidationException::withMessages(['consent' => 'You must accept the monitoring notice first.']);
        }

        // Refuse if one is already active
        $existing = WorkSession::where('user_id', $user->id)->whereNull('ended_at')->first();
        if ($existing) {
            return response()->json(['session' => $existing], 200);
        }

        $settings = TeamSetting::firstOrCreate(['tenant_id' => $user->tenant_id], []);
        if ($settings->screenshots_required && !$data['screenshots_enabled']) {
            throw ValidationException::withMessages([
                'screenshots_enabled' => 'Your workspace requires screen sharing during work sessions.',
            ]);
        }

        $session = WorkSession::create([
            'tenant_id'           => $user->tenant_id,
            'user_id'             => $user->id,
            'started_at'          => now(),
            'last_heartbeat_at'   => now(),
            'screenshots_enabled' => $data['screenshots_enabled'],
        ]);

        $this->logger->log($user, 'session.started', $session, [
            'screenshots_enabled' => (bool) $data['screenshots_enabled'],
        ]);

        return response()->json(['session' => $session], 201);
    }

    /**
     * POST /api/work-sessions/{id}/heartbeat
     * { active_seconds: int, idle_seconds: int }
     *
     * Client posts absolute cumulative counters every ~30s.
     * Server takes max() to prevent regression.
     */
    public function heartbeat(Request $request, int $id)
    {
        $data = $request->validate([
            'active_seconds' => ['required', 'integer', 'min:0'],
            'idle_seconds'   => ['required', 'integer', 'min:0'],
        ]);

        $user    = $request->user();
        $session = WorkSession::where('user_id', $user->id)->findOrFail($id);

        if (!$session->isActive()) {
            return response()->json(['message' => 'Session already ended.'], 409);
        }

        $session->update([
            'active_seconds'    => max($session->active_seconds, $data['active_seconds']),
            'idle_seconds'      => max($session->idle_seconds, $data['idle_seconds']),
            'last_heartbeat_at' => now(),
        ]);

        return response()->json(['ok' => true, 'session' => $session->fresh()]);
    }

    /**
     * POST /api/work-sessions/{id}/end
     * { active_seconds?: int, idle_seconds?: int, reason?: string }
     */
    public function end(Request $request, int $id)
    {
        $data = $request->validate([
            'active_seconds' => ['nullable', 'integer', 'min:0'],
            'idle_seconds'   => ['nullable', 'integer', 'min:0'],
            'reason'         => ['nullable', 'in:manual,idle_timeout,share_stopped'],
        ]);

        $user    = $request->user();
        $session = WorkSession::where('user_id', $user->id)->findOrFail($id);

        if (!$session->isActive()) {
            return response()->json(['session' => $session]);
        }

        $session->update([
            'ended_at'       => now(),
            'active_seconds' => max($session->active_seconds, (int) ($data['active_seconds'] ?? 0)),
            'idle_seconds'   => max($session->idle_seconds,   (int) ($data['idle_seconds']   ?? 0)),
            'end_reason'     => $data['reason'] ?? 'manual',
        ]);

        $this->logger->log($user, 'session.ended', $session, [
            'reason'         => $session->end_reason,
            'active_seconds' => $session->active_seconds,
        ]);

        return response()->json(['session' => $session->fresh()]);
    }

    /**
     * GET /api/work-sessions?user_id=&from=&to=
     * Admin: any member. Non-admin: only own sessions.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $q = WorkSession::query()->with('user:id,name,email')->latest('started_at');

        if ($user->role->value !== 'admin') {
            $q->where('user_id', $user->id);
        } elseif ($request->filled('user_id')) {
            $q->where('user_id', (int) $request->user_id);
        }

        if ($request->filled('from')) $q->where('started_at', '>=', Carbon::parse($request->from)->startOfDay());
        if ($request->filled('to'))   $q->where('started_at', '<=', Carbon::parse($request->to)->endOfDay());

        return response()->json($q->limit(200)->get());
    }

    /**
     * GET /api/work-sessions/today-summary
     * For the current user: total active seconds today + current live session.
     */
    public function todaySummary(Request $request)
    {
        $user = $request->user();
        $today = now()->startOfDay();

        $active = (int) WorkSession::where('user_id', $user->id)
            ->where('started_at', '>=', $today)
            ->sum('active_seconds');

        $live = WorkSession::where('user_id', $user->id)
            ->whereNull('ended_at')
            ->latest('started_at')
            ->first();

        return response()->json([
            'today_active_seconds' => $active,
            'live_session'         => $live,
        ]);
    }
}
