<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\LeadFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LeadFileController extends Controller
{
    // ── List ──────────────────────────────────────────────────────────────

    public function index(int $id): JsonResponse
    {
        $lead = Lead::findOrFail($id);
        return response()->json($lead->files->map(fn ($f) => $this->toRow($f)));
    }

    // ── Upload ────────────────────────────────────────────────────────────

    public function upload(Request $request, int $id): JsonResponse
    {
        $lead = Lead::findOrFail($id);

        $request->validate([
            'file' => ['required', 'file', 'max:20480'], // 20 MB in kilobytes
        ]);

        $file         = $request->file('file');
        $originalName = $file->getClientOriginalName();

        // Sanitise filename + make unique per upload to allow same-name files
        $safeName    = preg_replace('/[^\w.\-]/', '_', $originalName);
        $unique      = uniqid('', true);
        $dropboxPath = "/proveax/leads/{$lead->tenant_id}/{$id}/{$unique}_{$safeName}";

        $token = $this->getAccessToken();

        // ── 1. Upload file to Dropbox ─────────────────────────────────────
        $uploadResponse = $this->dropboxHttp()->withToken($token)
            ->withHeaders([
                'Dropbox-API-Arg' => json_encode([
                    'path'       => $dropboxPath,
                    'mode'       => 'add',        // never overwrite; each file is unique
                    'autorename' => false,
                    'mute'       => true,
                ]),
                'Content-Type' => 'application/octet-stream',
            ])
            ->withBody(file_get_contents($file->getRealPath()), 'application/octet-stream')
            ->post('https://content.dropboxapi.com/2/files/upload');

        if (! $uploadResponse->successful()) {
            Log::error('Dropbox upload failed', [
                'status'   => $uploadResponse->status(),
                'response' => $uploadResponse->body(),
            ]);
            return response()->json(['error' => 'File upload to Dropbox failed.'], 500);
        }

        // ── 2. Get or create a shared link ────────────────────────────────
        $viewUrl = $this->getOrCreateSharedLink($token, $dropboxPath);

        // ── 3. Persist metadata ───────────────────────────────────────────
        $leadFile = LeadFile::create([
            'lead_id'             => $lead->id,
            'uploaded_by_user_id' => $request->user()->id,
            'file_name'           => $originalName,
            'dropbox_path'        => $dropboxPath,
            'file_url'            => $viewUrl,
        ]);

        return response()->json($this->toRow($leadFile), 201);
    }

    // ── Delete ────────────────────────────────────────────────────────────

    public function destroy(Request $request, int $leadId, int $fileId): Response
    {
        $leadFile = LeadFile::where('lead_id', $leadId)->findOrFail($fileId);

        $deleted = $this->dropboxDelete($this->getAccessToken(), $leadFile->dropbox_path);

        if (! $deleted) {
            return response('Failed to delete file from Dropbox. Please try again.', 500);
        }

        $leadFile->delete();

        return response()->noContent();
    }

    // ── Serialiser ────────────────────────────────────────────────────────

    private function toRow(LeadFile $f): array
    {
        return [
            'id'         => $f->id,
            'file_name'  => $f->file_name,
            'file_url'   => $f->file_url,
            'created_at' => $f->created_at?->toIso8601String(),
        ];
    }

    // ── Dropbox helpers ───────────────────────────────────────────────────
    /** Returns a pre-configured Http client (SSL verify disabled on local). */
    private function dropboxHttp(): \Illuminate\Http\Client\PendingRequest
    {
        $client = Http::withOptions(['verify' => app()->isProduction()]);
        return $client;
    }
    /**
     * Returns a valid Dropbox access token.
     *
     * Priority:
     *  1. DROPBOX_ACCESS_TOKEN in .env  → used directly (good for local dev / generated tokens)
     *  2. DROPBOX_REFRESH_TOKEN         → OAuth2 refresh-token flow, result cached ~4 hours
     */
    private function getAccessToken(): string
    {
        // Direct access token takes priority (local dev / generated token from App Console)
        $direct = config('services.dropbox.access_token');
        if ($direct) {
            return $direct;
        }

        // Production: use refresh-token flow and cache the result
        return Cache::remember('dropbox_access_token', now()->addHours(3)->addMinutes(50), function () {
            $response = $this->dropboxHttp()->asForm()->post('https://api.dropbox.com/oauth2/token', [
                'grant_type'    => 'refresh_token',
                'refresh_token' => config('services.dropbox.refresh_token'),
                'client_id'     => config('services.dropbox.app_key'),
                'client_secret' => config('services.dropbox.app_secret'),
            ]);

            if (! $response->successful()) {
                Log::error('Dropbox token refresh failed', ['body' => $response->body()]);
                abort(500, 'Could not authenticate with Dropbox.');
            }

            return $response->json('access_token');
        });
    }

    /**
     * Creates a shared link for $path, or retrieves the existing one.
     * Returns the URL string, or null on failure.
     */
    private function getOrCreateSharedLink(string $token, string $path): ?string
    {
        $response = $this->dropboxHttp()->withToken($token)
            ->post('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', [
                'path'     => $path,
                'settings' => ['requested_visibility' => 'public'],
            ]);

        if ($response->successful()) {
            return $response->json('url');
        }

        // 409 = shared link already exists — extract URL from error payload
        if ($response->status() === 409) {
            return $response->json('error.shared_link_already_exists.metadata.url');
        }

        Log::warning('Could not create Dropbox shared link', [
            'status'   => $response->status(),
            'response' => $response->body(),
        ]);

        return null;
    }

    private function dropboxDelete(string $token, ?string $path): bool
    {
        if (! $path) {
            return true; // nothing to delete
        }

        $response = $this->dropboxHttp()->withToken($token)
            ->post('https://api.dropboxapi.com/2/files/delete_v2', ['path' => $path]);

        if (! $response->successful()) {
            Log::warning('Dropbox delete failed', [
                'path'     => $path,
                'status'   => $response->status(),
                'response' => $response->body(),
            ]);
            return false;
        }

        return true;
    }
}
