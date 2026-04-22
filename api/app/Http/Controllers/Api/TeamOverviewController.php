<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TeamDailyStat;
use App\Models\User;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Http\Request;

class TeamOverviewController extends Controller
{
    /**
     * GET /api/admin/team/overview
     * Returns: member counts, live sessions, today totals, 14-day series.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        abort_if($user->role->value !== 'admin', 403);

        $today  = now()->startOfDay();
        $from14 = now()->subDays(13)->startOfDay();

        $members = User::query()
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN is_paused THEN 1 ELSE 0 END) as paused')
            ->first();

        $live = WorkSession::whereNull('ended_at')
            ->with('user:id,name,email')
            ->latest('started_at')
            ->limit(50)
            ->get(['id','user_id','started_at','active_seconds','idle_seconds','last_heartbeat_at'])
            ->map(fn ($s) => [
                'id'             => $s->id,
                'user_id'        => $s->user_id,
                'name'           => $s->user?->name,
                'email'          => $s->user?->email,
                'started_at'     => $s->started_at,
                'active_seconds' => (int) $s->active_seconds,
                'idle_seconds'   => (int) $s->idle_seconds,
                'heartbeat'      => $s->last_heartbeat_at,
            ]);

        $todayTotal = (int) WorkSession::whereBetween('started_at', [$today, now()])->sum('active_seconds');

        $series = TeamDailyStat::where('day', '>=', $from14->toDateString())
            ->selectRaw('day, SUM(active_seconds) as active, SUM(idle_seconds) as idle, SUM(screenshots_count) as screenshots, SUM(rentcast_requests_count) as rentcast')
            ->groupBy('day')->orderBy('day')->get();

        $topUsers = TeamDailyStat::where('day', '>=', $from14->toDateString())
            ->selectRaw('user_id, SUM(active_seconds) as active')
            ->groupBy('user_id')->orderByDesc('active')->limit(5)
            ->with('user:id,name,email')->get()
            ->map(fn ($r) => [
                'user_id' => $r->user_id,
                'name'    => $r->user?->name,
                'email'   => $r->user?->email,
                'active_seconds' => (int) $r->active,
            ]);

        return response()->json([
            'members'     => [
                'total'   => (int) ($members->total ?? 0),
                'paused'  => (int) ($members->paused ?? 0),
            ],
            'live'        => $live,
            'today_active_seconds' => $todayTotal,
            'series'      => $series,
            'top_users'   => $topUsers,
        ]);
    }
}
