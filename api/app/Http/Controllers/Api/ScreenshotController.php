<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Screenshot;
use App\Models\WorkSession;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class ScreenshotController extends Controller
{
    private const DISK = 'local';

    public function __construct(private ActivityLogger $logger) {}

    /**
     * POST /api/screenshots
     * multipart: session_id, captured_at (ISO), image (jpeg/png, <=5MB)
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'session_id'  => ['required', 'integer'],
            'captured_at' => ['required', 'date'],
            'image'       => ['required', 'file', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ]);

        $user    = $request->user();
        $session = WorkSession::where('user_id', $user->id)->findOrFail($data['session_id']);

        if (!$session->isActive()) {
            return response()->json(['message' => 'Session already ended.'], 409);
        }
        if (!$session->screenshots_enabled) {
            return response()->json(['message' => 'Screenshots are not enabled for this session.'], 403);
        }

        $file       = $request->file('image');
        $ext        = $file->getClientOriginalExtension() ?: 'jpg';
        $day        = Carbon::parse($data['captured_at'])->format('Y-m-d');
        $directory  = "screenshots/{$user->tenant_id}/{$user->id}/{$day}";
        $fileName   = $session->id . '_' . now()->format('His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $storedPath = $file->storeAs($directory, $fileName, self::DISK);

        [$w, $h] = @getimagesize($file->getRealPath()) ?: [null, null];

        $shot = Screenshot::create([
            'tenant_id'       => $user->tenant_id,
            'user_id'         => $user->id,
            'work_session_id' => $session->id,
            'disk'            => self::DISK,
            'path'            => $storedPath,
            'bytes'           => $file->getSize(),
            'width'           => $w,
            'height'          => $h,
            'captured_at'     => $data['captured_at'],
        ]);

        return response()->json(['screenshot' => $shot], 201);
    }

    /**
     * GET /api/screenshots?user_id=&from=&to=&session_id=
     * Admin: any user. Non-admin: only own.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $q = Screenshot::query()
            ->with('user:id,name,email')
            ->latest('captured_at');

        if ($user->role->value !== 'admin') {
            $q->where('user_id', $user->id);
        } elseif ($request->filled('user_id')) {
            $q->where('user_id', (int) $request->user_id);
        }

        if ($request->filled('session_id')) $q->where('work_session_id', (int) $request->session_id);
        if ($request->filled('from'))       $q->where('captured_at', '>=', Carbon::parse($request->from)->startOfDay());
        if ($request->filled('to'))         $q->where('captured_at', '<=', Carbon::parse($request->to)->endOfDay());

        $shots = $q->limit(500)->get()->map(function ($s) {
            // Signed URL valid for 1 hour — embeds the viewer's user_id so
            // authorization still applies when image is fetched.
            $s->url = URL::temporarySignedRoute(
                'screenshots.show',
                now()->addHour(),
                ['id' => $s->id, 'viewer' => auth()->id()]
            );
            return $s;
        });

        return response()->json($shots);
    }

    /**
     * GET /api/screenshots/{id}/image
     * Signed URL (valid 1 hour) embeds 'viewer' (user id) to scope authz.
     * Logs admin views (tamper-evident).
     */
    public function show(Request $request, int $id)
    {
        if (!$request->hasValidSignature()) {
            abort(403, 'Invalid or expired signature.');
        }

        $viewerId = (int) $request->query('viewer');
        $viewer   = \App\Models\User::find($viewerId);
        if (!$viewer) abort(403);

        $shot = Screenshot::withoutGlobalScopes()->findOrFail($id);

        // Scope check: viewer must belong to the same tenant as the screenshot
        if ($viewer->tenant_id !== $shot->tenant_id) abort(403);

        $isOwner = $shot->user_id === $viewer->id;
        $isAdmin = $viewer->role->value === 'admin';
        if (!$isOwner && !$isAdmin) abort(403);

        if ($isAdmin && !$isOwner) {
            $this->logger->log($viewer, 'screenshot.viewed', $shot, [
                'viewed_user_id' => $shot->user_id,
            ]);
        }

        $disk = Storage::disk($shot->disk);
        if (!$disk->exists($shot->path)) {
            abort(404, 'Screenshot file missing.');
        }

        return response()->file($disk->path($shot->path), [
            'Content-Type'  => $this->mimeFor($shot->path),
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    /**
     * DELETE /api/screenshots/{id}
     * Admin or owner may delete.
     */
    public function destroy(Request $request, int $id)
    {
        $user = $request->user();
        $shot = Screenshot::findOrFail($id);

        $isOwner = $shot->user_id === $user->id;
        $isAdmin = $user->role->value === 'admin';
        if (!$isOwner && !$isAdmin) {
            abort(403);
        }

        Storage::disk($shot->disk)->delete($shot->path);
        $this->logger->log($user, 'screenshot.deleted', $shot);
        $shot->delete();

        return response()->json(['ok' => true]);
    }

    private function mimeFor(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'png'  => 'image/png',
            'webp' => 'image/webp',
            default => 'image/jpeg',
        };
    }
}
