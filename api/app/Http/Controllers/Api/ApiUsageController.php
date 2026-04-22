<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RentcastRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ApiUsageController extends Controller
{
    /**
     * GET /api/admin/api-usage
     * Query: from=YYYY-MM-DD, to=YYYY-MM-DD, user_id=int
     * Returns: summary + daily series + per-user breakdown + recent errors.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        abort_if($user->role->value !== 'admin', 403);

        $from = $request->filled('from') ? Carbon::parse($request->from)->startOfDay() : now()->subDays(29)->startOfDay();
        $to   = $request->filled('to')   ? Carbon::parse($request->to)->endOfDay()     : now()->endOfDay();

        $base = RentcastRequest::query()
            ->whereBetween('requested_at', [$from, $to]);

        if ($request->filled('user_id')) {
            $base->where('user_id', (int) $request->user_id);
        }

        $summary = [
            'total'       => (clone $base)->count(),
            'billable'    => (clone $base)->where('billable', true)->count(),
            'errors'      => (clone $base)->where('status_code', '>=', 400)->count(),
            'avg_ms'      => (int) ((clone $base)->avg('duration_ms') ?? 0),
            'from'        => $from->toDateString(),
            'to'          => $to->toDateString(),
        ];

        $daily = (clone $base)
            ->selectRaw('DATE(requested_at) AS day, COUNT(*) AS total, SUM(billable) AS billable')
            ->groupBy('day')->orderBy('day')->get();

        $perUser = (clone $base)
            ->selectRaw('user_id, COUNT(*) AS total, SUM(billable) AS billable')
            ->groupBy('user_id')->with('user:id,name,email')->get()
            ->map(fn ($r) => [
                'user_id'  => $r->user_id,
                'name'     => $r->user?->name ?? 'Deleted',
                'email'    => $r->user?->email,
                'total'    => (int) $r->total,
                'billable' => (int) $r->billable,
            ]);

        $recentErrors = (clone $base)
            ->where('status_code', '>=', 400)
            ->orderByDesc('requested_at')
            ->limit(20)
            ->with('user:id,name')
            ->get(['id','user_id','endpoint','status_code','error','requested_at']);

        return response()->json([
            'summary'        => $summary,
            'daily'          => $daily,
            'per_user'       => $perUser,
            'recent_errors'  => $recentErrors,
        ]);
    }
}
