<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Models\RentcastProperty;
use App\Models\WalletTransaction;
use App\Services\ActivityLogger;
use App\Services\TracerfyService;
use App\Services\WalletService;
use Illuminate\Http\Request;

class SkipTraceController extends Controller
{
    public const COST = 0.20;

    public function __construct(
        private ActivityLogger $logger,
        private WalletService $wallet,
        private TracerfyService $tracerfy,
    ) {}

    public function run(Request $request, string $id)
    {
        // The route param may be either:
        //   • A numeric CRM property ID  (from the /properties detail page)
        //   • A Rentcast slug string      (from the map search modal)
        if (ctype_digit($id)) {
            $property = Property::findOrFail((int) $id);
        } else {
            // Rentcast slug — look up the cached snapshot, then find-or-create a
            // thin CRM Property row so skip-trace results are always persisted.
            $rp = RentcastProperty::findOrFail($id);
            $property = Property::firstOrCreate(
                [
                    'tenant_id' => $request->user()->tenant_id,
                    'address'   => $rp->address ?: $rp->street,
                    'city'      => $rp->city,
                    'state'     => $rp->state,
                ],
                [
                    'zip'             => $rp->zip,
                    'latitude'        => $rp->lat,
                    'longitude'       => $rp->lng,
                    'property_type'   => self::normalizePropertyType($rp->property_type),
                    'bedrooms'        => $rp->bedrooms,
                    'bathrooms'       => $rp->bathrooms,
                    'square_feet'     => $rp->square_feet,
                    'lot_size'        => $rp->lot_size,
                    'year_built'      => $rp->year_built,
                    'estimated_value' => $rp->estimated_value,
                    'owner_name'      => $rp->owner_name,
                ]
            );
        }

        $user = $request->user();

        // 1. Reserve credit before calling provider so we never trace for free.
        $charge = $this->wallet->debit(
            user: $user,
            amount: self::COST,
            description: "Skip trace: {$property->address}",
        );

        if (!$charge) {
            return response()->json([
                'message' => 'Not enough skip traces. Please buy more.',
            ], 402);
        }

        // 2. Call Tracerfy.
        $result = $this->tracerfy->lookupOwner(
            address: (string) $property->address,
            city:    (string) $property->city,
            state:   (string) $property->state,
            zip:     $property->zip ? (string) $property->zip : null,
        );

        // 3. If the provider failed (network / config), refund the user.
        if (! ($result['ok'] ?? false)) {
            $this->wallet->credit(
                user: $user,
                amount: self::COST,
                type: WalletTransaction::TYPE_REFUND,
                description: "Refund — skip trace failed: {$property->address}",
            );

            return response()->json([
                'message' => $result['reason'] ?? 'Skip trace failed. Please try again.',
            ], 502);
        }

        // 4. If no match found, refund (Tracerfy doesn't charge us either).
        if (! ($result['hit'] ?? false) || (empty($result['phones']) && empty($result['emails']))) {
            $this->wallet->credit(
                user: $user,
                amount: self::COST,
                type: WalletTransaction::TYPE_REFUND,
                description: "Refund — no skip-trace match: {$property->address}",
            );

            return response()->json([
                'owner_name' => $property->owner_name,
                'phones'     => [],
                'emails'     => [],
                'hit'        => false,
                'message'    => 'No contact information found for this address.',
            ]);
        }

        // 5. Persist results.
        $phoneNumbers = collect($result['phones'])->pluck('number')->filter()->values()->all();
        $ownerName    = $property->owner_name ?: ($result['owners'][0] ?? null);

        $property->forceFill([
            'owner_name'         => $ownerName,
            'skip_trace_phones'  => $result['phones'],
            'skip_trace_emails'  => $result['emails'],
            'skip_traced_at'     => now(),
        ])->save();

        $this->logger->log($user, 'skip_trace.run', subject: $property);

        // 6. Return the shape the frontend already expects.
        return response()->json([
            'owner_name'  => $ownerName,
            'phones'      => $phoneNumbers,
            'emails'      => $result['emails'],
            'phones_meta' => $result['phones'],
            'hit'         => true,
            'traced_at'   => $property->skip_traced_at?->toIso8601String(),
        ]);
    }

    /**
     * GET /properties/{id}/skip-trace
     *
     * Returns previously-persisted skip trace data for the property without
     * charging the user. Returns null body (200) when no trace has been run yet.
     * Accepts the same {id} forms as run(): numeric CRM ID or Rentcast slug.
     */
    public function fetch(Request $request, string $id): \Illuminate\Http\JsonResponse
    {
        if (ctype_digit($id)) {
            $property = Property::find((int) $id);
        } else {
            $rp = RentcastProperty::find($id);
            if (! $rp) {
                return response()->json(null);
            }
            $property = Property::where([
                'tenant_id' => $request->user()->tenant_id,
                'address'   => $rp->address ?: $rp->street,
                'city'      => $rp->city,
                'state'     => $rp->state,
            ])->first();
        }

        if (! $property || ! $property->skip_traced_at) {
            return response()->json(null);
        }

        $phoneNumbers = collect($property->skip_trace_phones ?? [])
            ->pluck('number')->filter()->values()->all();

        return response()->json([
            'owner_name'  => $property->owner_name,
            'phones'      => $phoneNumbers,
            'emails'      => $property->skip_trace_emails ?? [],
            'phones_meta' => $property->skip_trace_phones ?? [],
            'hit'         => true,
            'traced_at'   => $property->skip_traced_at?->toIso8601String(),
        ]);
    }

    /**
     * Map Rentcast's human-readable property type strings to our ENUM values.
     * Returns null for anything unrecognised so MySQL doesn't reject the row.
     */
    private static function normalizePropertyType(?string $type): ?string
    {
        if ($type === null) return null;

        return match (strtolower(trim(str_replace([' ', '-'], '_', $type)))) {
            'single_family', 'single_family_residential' => 'single_family',
            'multi_family', 'multifamily'                => 'multi_family',
            'condo', 'condominium'                       => 'condo',
            'townhouse', 'townhome'                      => 'townhouse',
            'land', 'vacant_land', 'lot'                 => 'land',
            'commercial'                                 => 'commercial',
            default                                      => null,
        };
    }
}

