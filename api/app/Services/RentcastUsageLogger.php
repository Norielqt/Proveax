<?php
namespace App\Services;

use App\Models\RentcastRequest;
use Illuminate\Support\Facades\Auth;

/**
 * Lightweight logger for Rentcast API calls.
 * Billable=true means we hit the paid API; false means served from local cache.
 */
class RentcastUsageLogger
{
    public static function log(
        string $endpoint,
        ?int $statusCode,
        bool $billable,
        ?int $durationMs = null,
        ?string $error = null,
    ): void {
        $user = Auth::user();

        RentcastRequest::create([
            'tenant_id'    => $user?->tenant_id,
            'user_id'      => $user?->id,
            'endpoint'     => substr($endpoint, 0, 80),
            'status_code'  => $statusCode,
            'billable'     => $billable,
            'duration_ms'  => $durationMs,
            'error'        => $error ? substr($error, 0, 255) : null,
            'requested_at' => now(),
        ]);
    }
}
