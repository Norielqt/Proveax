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
            'user_id' => ['nullable', 'integer'],
            'action'  => ['nullable', 'string'],
            'from'    => ['nullable', 'date'],
            'to'      => ['nullable', 'date'],
        ]);

        $logs = ActivityLog::query()
            ->with('user:id,name,email')
            ->when($data['user_id'] ?? null, fn($q, $v) => $q->where('user_id', $v))
            ->when($data['action']  ?? null, fn($q, $v) => $q->where('action', $v))
            ->when($data['from']    ?? null, fn($q, $v) => $q->where('created_at', '>=', $v))
            ->when($data['to']      ?? null, fn($q, $v) => $q->where('created_at', '<=', $v))
            ->latest()
            ->paginate(50);

        return response()->json($logs);
    }

    public function summary(Request $request)
    {
        $tenantId = $request->user()->tenant_id;

        $counts = ActivityLog::query()
            ->where('tenant_id', $tenantId)
            ->where('created_at', '>=', now()->subDays(30))
            ->selectRaw('action, COUNT(*) as total')
            ->groupBy('action')
            ->pluck('total', 'action');

        return response()->json(['last_30_days' => $counts]);
    }
}
