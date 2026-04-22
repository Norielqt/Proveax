<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Timesheet;
use App\Models\WorkSession;
use App\Services\ActivityLogger;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    /**
     * GET /api/timesheets
     * Admin: all users. Non-admin: self only.
     * Filters: user_id, from, to, status.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $q = Timesheet::query()->with('user:id,name,email')->orderByDesc('week_start');

        if ($user->role->value !== 'admin') {
            $q->where('user_id', $user->id);
        } elseif ($request->filled('user_id')) {
            $q->where('user_id', (int) $request->user_id);
        }
        if ($request->filled('from'))   $q->where('week_start', '>=', $request->from);
        if ($request->filled('to'))     $q->where('week_start', '<=', $request->to);
        if ($request->filled('status')) $q->where('status', $request->status);

        return response()->json($q->limit(200)->get());
    }

    /**
     * POST /api/timesheets/generate
     * Body: { week_start: 'YYYY-MM-DD' }  (Monday; will be normalised)
     * Admin can pass user_id; otherwise generates for caller.
     * Aggregates work_sessions active_seconds for the week into one row.
     */
    public function generate(Request $request)
    {
        $v = $request->validate([
            'week_start' => 'required|date',
            'user_id'    => 'nullable|integer|exists:users,id',
        ]);

        $actor  = $request->user();
        $userId = (int) ($v['user_id'] ?? $actor->id);
        abort_if($actor->role->value !== 'admin' && $userId !== $actor->id, 403);

        $monday = Carbon::parse($v['week_start'])->startOfWeek();
        $sunday = (clone $monday)->endOfWeek();

        $totalSeconds = (int) WorkSession::where('user_id', $userId)
            ->whereBetween('started_at', [$monday, $sunday])
            ->sum('active_seconds');

        $sheet = Timesheet::firstOrNew(
            [
                'tenant_id'  => $actor->tenant_id,
                'user_id'    => $userId,
                'week_start' => $monday->toDateString(),
            ]
        );

        $sheet->week_end = $sunday->toDateString();
        // Refresh totals only when still a draft (don't overwrite submitted/approved numbers)
        if (!$sheet->exists || $sheet->status === 'draft') {
            $sheet->total_active_seconds = $totalSeconds;
            if (!$sheet->exists) $sheet->status = 'draft';
        }
        $sheet->save();

        return response()->json($sheet->load('user:id,name,email'));
    }

    /** POST /api/timesheets/{id}/submit */
    public function submit(Request $request, int $id)
    {
        $sheet = Timesheet::findOrFail($id);
        $user  = $request->user();
        abort_if($sheet->user_id !== $user->id, 403, 'Only the owner can submit.');
        abort_if($sheet->status !== 'draft', 422, 'Already submitted.');

        $sheet->update(['status' => 'submitted', 'submitted_at' => now()]);
        $this->logger->log($user, 'timesheet.submitted', $sheet);

        return response()->json($sheet->fresh()->load('user:id,name,email'));
    }

    /** POST /api/timesheets/{id}/approve */
    public function approve(Request $request, int $id)
    {
        return $this->review($request, $id, 'approved');
    }

    /** POST /api/timesheets/{id}/reject */
    public function reject(Request $request, int $id)
    {
        return $this->review($request, $id, 'rejected');
    }

    private function review(Request $request, int $id, string $decision)
    {
        $user = $request->user();
        abort_if($user->role->value !== 'admin', 403);

        $v = $request->validate(['note' => 'nullable|string|max:1000']);
        $sheet = Timesheet::findOrFail($id);
        abort_if($sheet->status !== 'submitted', 422, 'Not in submitted state.');
        abort_if($sheet->user_id === $user->id, 422, 'Cannot review your own timesheet.');

        $sheet->update([
            'status'              => $decision,
            'reviewed_at'         => now(),
            'reviewed_by_user_id' => $user->id,
            'reviewer_note'       => $v['note'] ?? null,
        ]);
        $this->logger->log($user, "timesheet.$decision", $sheet);

        return response()->json($sheet->fresh()->load(['user:id,name,email', 'reviewer:id,name']));
    }

    /**
     * GET /api/timesheets/export.csv
     * Admin-only. Same filters as index.
     */
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        abort_if($user->role->value !== 'admin', 403);

        $q = Timesheet::query()->with('user:id,name,email')->orderBy('week_start');
        if ($request->filled('user_id')) $q->where('user_id', (int) $request->user_id);
        if ($request->filled('from'))    $q->where('week_start', '>=', $request->from);
        if ($request->filled('to'))      $q->where('week_start', '<=', $request->to);
        if ($request->filled('status'))  $q->where('status', $request->status);

        $filename = 'timesheets_' . now()->format('Ymd_His') . '.csv';

        return response()->stream(function () use ($q) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Week start', 'Week end', 'User', 'Email', 'Active hours', 'Status', 'Submitted at', 'Reviewed at', 'Reviewer note']);
            $q->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $r) {
                    fputcsv($out, [
                        $r->week_start->toDateString(),
                        $r->week_end->toDateString(),
                        $r->user?->name ?? '',
                        $r->user?->email ?? '',
                        number_format($r->total_active_seconds / 3600, 2),
                        $r->status,
                        optional($r->submitted_at)->toDateTimeString(),
                        optional($r->reviewed_at)->toDateTimeString(),
                        $r->reviewer_note,
                    ]);
                }
            });
            fclose($out);
        }, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ]);
    }
}
