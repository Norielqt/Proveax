<?php
namespace App\Console\Commands;

use App\Models\Screenshot;
use App\Models\TeamSetting;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PurgeOldScreenshots extends Command
{
    protected $signature   = 'team:purge-screenshots';
    protected $description = 'Delete screenshots older than each tenant\'s configured retention_days.';

    public function handle(): int
    {
        $deleted = 0;

        foreach (TeamSetting::withoutGlobalScopes()->get() as $setting) {
            $cutoff = Carbon::now()->subDays(max(1, (int) $setting->retention_days));
            $shots  = Screenshot::withoutGlobalScopes()
                ->where('tenant_id', $setting->tenant_id)
                ->where('captured_at', '<', $cutoff)
                ->limit(1000)
                ->get();

            foreach ($shots as $shot) {
                Storage::disk($shot->disk)->delete($shot->path);
                $shot->delete();
                $deleted++;
            }
        }

        $this->info("Purged $deleted screenshot(s).");
        return self::SUCCESS;
    }
}
