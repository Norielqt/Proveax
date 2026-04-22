<?php
namespace App\Console\Commands;

use App\Models\RentcastRequest;
use App\Models\Screenshot;
use App\Models\TeamDailyStat;
use App\Models\Tenant;
use App\Models\WorkSession;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AggregateDailyStats extends Command
{
    protected $signature   = 'team:aggregate-daily {--date=}';
    protected $description = 'Aggregate per-user daily counters from raw tables into team_daily_stats.';

    public function handle(): int
    {
        $date = $this->option('date') ? Carbon::parse($this->option('date'))->toDateString() : now()->subDay()->toDateString();
        $this->info("Aggregating stats for $date");

        $start = Carbon::parse($date)->startOfDay();
        $end   = Carbon::parse($date)->endOfDay();

        foreach (Tenant::all() as $tenant) {
            // Sessions + active/idle
            $rows = WorkSession::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->whereBetween('started_at', [$start, $end])
                ->selectRaw('user_id, SUM(active_seconds) as active, SUM(idle_seconds) as idle, COUNT(*) as sessions')
                ->groupBy('user_id')->get();

            foreach ($rows as $r) {
                $screenshots = Screenshot::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('user_id', $r->user_id)
                    ->whereBetween('captured_at', [$start, $end])
                    ->count();

                $rentcast = RentcastRequest::where('tenant_id', $tenant->id)
                    ->where('user_id', $r->user_id)
                    ->whereBetween('requested_at', [$start, $end])
                    ->count();

                $activity = DB::table('activity_logs')
                    ->where('tenant_id', $tenant->id)
                    ->where('user_id', $r->user_id)
                    ->whereBetween('created_at', [$start, $end])
                    ->count();

                TeamDailyStat::withoutGlobalScopes()->updateOrCreate(
                    ['tenant_id' => $tenant->id, 'user_id' => $r->user_id, 'day' => $date],
                    [
                        'active_seconds'          => (int) $r->active,
                        'idle_seconds'            => (int) $r->idle,
                        'sessions_count'          => (int) $r->sessions,
                        'screenshots_count'       => $screenshots,
                        'rentcast_requests_count' => $rentcast,
                        'activity_events_count'   => $activity,
                    ]
                );
            }
        }

        $this->info('Done.');
        return self::SUCCESS;
    }
}
