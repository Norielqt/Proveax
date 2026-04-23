<?php
namespace App\Console\Commands;

use App\Models\WorkSession;
use App\Services\ActivityLogger;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Close work sessions whose client has gone silent (browser crashed, laptop
 * slept for too long, network dropped, etc).
 *
 * A session is considered stale when its last heartbeat (or start time, if it
 * never sent one) is older than STALE_MINUTES. We end it with reason=stale.
 */
class AutoCloseStaleSessions extends Command
{
    protected $signature   = 'sessions:close-stale {--minutes=10 : Heartbeat silence threshold}';
    protected $description = 'Auto-end work sessions with no heartbeat for N minutes.';

    public function handle(ActivityLogger $logger): int
    {
        $minutes = max(2, (int) $this->option('minutes'));
        $cutoff  = Carbon::now()->subMinutes($minutes);

        $rows = WorkSession::withoutGlobalScopes()
            ->whereNull('ended_at')
            ->where(function ($q) use ($cutoff) {
                $q->where('last_heartbeat_at', '<', $cutoff)
                  ->orWhere(function ($q2) use ($cutoff) {
                      $q2->whereNull('last_heartbeat_at')
                         ->where('started_at', '<', $cutoff);
                  });
            })
            ->with('user')
            ->limit(500)
            ->get();

        $closed = 0;
        foreach ($rows as $session) {
            $session->update([
                'ended_at'   => now(),
                'end_reason' => 'stale',
            ]);

            if ($session->user) {
                $logger->log($session->user, 'session.auto_closed', $session, [
                    'reason'                => 'stale',
                    'last_heartbeat_at'     => optional($session->last_heartbeat_at)->toIso8601String(),
                    'silence_minutes'       => $minutes,
                    'active_seconds'        => $session->active_seconds,
                ]);
            }
            $closed++;
        }

        $this->info("Closed {$closed} stale session(s) (silent > {$minutes}m).");
        return self::SUCCESS;
    }
}
