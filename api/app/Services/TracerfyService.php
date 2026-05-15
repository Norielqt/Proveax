<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Tracerfy skip-tracing API client.
 *
 * Docs: https://tracerfy.com/skip-tracing-api-documentation/
 *
 * We use the Instant Trace Lookup endpoint (synchronous, single-address).
 * 5 credits per hit, 0 on miss. Returns owner contact info immediately.
 */
class TracerfyService
{
    /** Tracerfy returns these fields per person — we only need phones + emails. */
    public function lookupOwner(string $address, string $city, string $state, ?string $zip = null): array
    {
        $key = config('services.tracerfy.key');
        if (empty($key)) {
            return [
                'ok'      => false,
                'reason'  => 'Tracerfy API key not configured',
                'phones'  => [],
                'emails'  => [],
                'owners'  => [],
            ];
        }

        $base = rtrim((string) config('services.tracerfy.base'), '/');

        $payload = array_filter([
            'address'    => $address,
            'city'       => $city,
            'state'      => $state,
            'zip'        => $zip,
            'find_owner' => true,
        ], fn ($v) => $v !== null && $v !== '');

        try {
            $resp = Http::withToken($key)
                ->acceptJson()
                ->asJson()
                ->timeout(20)
                ->withOptions(['verify' => app()->isProduction()])
                ->post("{$base}/trace/lookup/", $payload);
        } catch (\Throwable $e) {
            Log::warning('Tracerfy request failed', ['error' => $e->getMessage()]);
            return [
                'ok'     => false,
                'reason' => 'Skip-trace provider unreachable',
                'phones' => [],
                'emails' => [],
                'owners' => [],
            ];
        }

        if (! $resp->successful()) {
            Log::warning('Tracerfy non-200 response', [
                'status' => $resp->status(),
                'body'   => $resp->body(),
            ]);
            return [
                'ok'     => false,
                'reason' => $resp->json('error') ?? 'Skip-trace provider error',
                'phones' => [],
                'emails' => [],
                'owners' => [],
            ];
        }

        $data    = $resp->json() ?? [];
        $hit     = (bool) ($data['hit'] ?? false);
        $persons = $data['persons'] ?? [];

        $phones = [];
        $emails = [];
        $owners = [];

        foreach ($persons as $person) {
            $name = trim(($person['first_name'] ?? '') . ' ' . ($person['last_name'] ?? ''));
            if ($name !== '') {
                $owners[] = $name;
            }

            foreach (($person['phones'] ?? []) as $phone) {
                $number = $phone['number'] ?? null;
                if (! $number) continue;
                $phones[] = [
                    'number'  => (string) $number,
                    'type'    => $phone['type']    ?? null,
                    'dnc'     => (bool) ($phone['dnc'] ?? false),
                    'carrier' => $phone['carrier'] ?? null,
                ];
            }

            foreach (($person['emails'] ?? []) as $email) {
                $addr = $email['email'] ?? null;
                if ($addr) $emails[] = (string) $addr;
            }
        }

        // Deduplicate
        $phones = collect($phones)->unique('number')->values()->all();
        $emails = array_values(array_unique($emails));
        $owners = array_values(array_unique($owners));

        return [
            'ok'                => true,
            'hit'               => $hit,
            'phones'            => $phones,
            'emails'            => $emails,
            'owners'            => $owners,
            'credits_deducted'  => (int) ($data['credits_deducted'] ?? 0),
        ];
    }
}
