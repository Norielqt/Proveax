<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        $schedule->call(fn () => app(\App\Services\SubscriptionService::class)->expireEndedTrials())
            ->hourly()
            ->name('expire-trials')
            ->withoutOverlapping();

        $schedule->call(fn () => app(\App\Services\SubscriptionService::class)->expireEndedCancellations())
            ->hourly()
            ->name('expire-cancellations')
            ->withoutOverlapping();

        $schedule->command('team:aggregate-daily')
            ->dailyAt('00:15')
            ->name('aggregate-daily-stats')
            ->withoutOverlapping();

        $schedule->command('team:purge-screenshots')
            ->dailyAt('02:00')
            ->name('purge-old-screenshots')
            ->withoutOverlapping();

        $schedule->command('sessions:close-stale')
            ->everyMinute()
            ->name('close-stale-sessions')
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
