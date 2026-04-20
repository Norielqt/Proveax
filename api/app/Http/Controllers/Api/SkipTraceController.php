<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;

class SkipTraceController extends Controller
{
    public function __construct(private ActivityLogger $logger) {}

    public function run(Request $request, int $id)
    {
        $property = Property::findOrFail($id);

        // TODO: call real skip-trace provider (BatchData, ReiSift, etc.)
        $result = [
            'owner_name' => $property->owner_name,
            'phones'     => ['+1-555-0100', '+1-555-0101'],
            'emails'     => ['owner@example.com'],
            'traced_at'  => now()->toIso8601String(),
        ];

        $this->logger->log($request->user(), 'skip_trace.run', subject: $property);

        return response()->json($result);
    }
}
