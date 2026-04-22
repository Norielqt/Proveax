<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'user_id'  => ['nullable', 'integer'],
            'action'   => ['nullable', 'string'],
            'from'     => ['nullable', 'date'],
            'to'       => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = ActivityLog::query()
            ->with('user:id,name,email')
            ->when($data['user_id'] ?? null, fn($q, $v) => $q->where('user_id', $v))
            ->when($data['action']  ?? null, fn($q, $v) => $q->where('action', $v))
            ->when($data['from']    ?? null, fn($q, $v) => $q->where('created_at', '>=', $v))
            ->when($data['to']      ?? null, fn($q, $v) => $q->where('created_at', '<=', $v . ' 23:59:59'))
            ->latest()
            ->paginate((int) ($data['per_page'] ?? 50));

        // Append distinct action list so the frontend can build a filter dropdown
        $actions = ActivityLog::selectRaw('DISTINCT action')->orderBy('action')->pluck('action');

        return response()->json(array_merge($logs->toArray(), ['actions' => $actions]));
    }

    public function summary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $q = ActivityLog::query()
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subDays(30));

        if ($request->filled('user_id')) {
            $q->where('user_id', (int) $request->user_id);
        }

        $counts = (clone $q)
            ->selectRaw('action, COUNT(*) as total')
            ->groupBy('action')
            ->orderByDesc('total')
            ->pluck('total', 'action');

        $daily = (clone $q)
            ->selectRaw('DATE(created_at) AS day, COUNT(*) AS total')
            ->groupBy('day')->orderBy('day')->get();

        return response()->json(['last_30_days' => $counts, 'daily' => $daily]);
    }
}
