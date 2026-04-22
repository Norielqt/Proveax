<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TeamSetting;
use Illuminate\Http\Request;

class TeamSettingsController extends Controller
{
    private const DEFAULT_CONSENT = "Your employer uses this tool to monitor work activity, including:\n\n• Your work session time (when you start/end)\n• Screenshots of your shared screen every 10 minutes while you are in a work session\n• Activity logs (actions you take in the app)\n\nYou control when a session starts and ends. Screen sharing requires your explicit consent via the browser each session. You may view your own data at any time. Data is retained according to your workspace settings and then deleted.";

    /** GET /api/team/settings */
    public function show(Request $request)
    {
        return response()->json($this->getOrCreate($request->user()->tenant_id));
    }

    /** PATCH /api/team/settings */
    public function update(Request $request)
    {
        $data = $request->validate([
            'screenshot_retention_days'   => ['sometimes', 'integer', 'min:1', 'max:90'],
            'screenshot_interval_minutes' => ['sometimes', 'integer', 'min:5', 'max:60'],
            'idle_timeout_minutes'        => ['sometimes', 'integer', 'min:1', 'max:30'],
            'screenshots_required'        => ['sometimes', 'boolean'],
            'consent_text'                => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        $settings = $this->getOrCreate($request->user()->tenant_id);
        $settings->update($data);

        return response()->json($settings->fresh());
    }

    private function getOrCreate(int $tenantId): TeamSetting
    {
        return TeamSetting::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['consent_text' => self::DEFAULT_CONSENT]
        );
    }
}
