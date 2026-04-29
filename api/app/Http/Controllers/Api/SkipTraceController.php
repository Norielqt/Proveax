<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Services\ActivityLogger;
use App\Services\WalletService;
use Illuminate\Http\Request;

class SkipTraceController extends Controller
{
    public const COST = 0.20;

    public function __construct(
        private ActivityLogger $logger,
        private WalletService $wallet,
    ) {}

    public function run(Request $request, int $id)
    {
        $property = Property::findOrFail($id);
        $user     = $request->user();

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

        // TODO: call real skip-trace provider (BatchData, ReiSift, etc.)
        $result = [
            'owner_name' => $property->owner_name,
            'phones'     => ['+1-555-0100', '+1-555-0101'],
            'emails'     => ['owner@example.com'],
            'traced_at'  => now()->toIso8601String(),
        ];

        $this->logger->log($user, 'skip_trace.run', subject: $property);

        return response()->json($result);
    }
}
