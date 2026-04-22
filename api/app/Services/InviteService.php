<?php
namespace App\Services;

use App\Models\Invite;
use App\Models\User;
use App\Notifications\InviteNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class InviteService
{
    /**
     * Create (or refresh) an invite for the given email within a tenant.
     * Deduplicates: if a pending invite already exists, regenerate its token
     * rather than producing a second row.
     */
    public function createFor(int $tenantId, int $invitedByUserId, string $email, string $role = 'employee'): Invite
    {
        $existing = Invite::where('tenant_id', $tenantId)
            ->where('email', $email)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->first();

        if ($existing) {
            $existing->fill(['invited_by_user_id' => $invitedByUserId, 'role' => $role])->save();
            $existing->regenerate();
            return $existing->fresh();
        }

        return Invite::generate($tenantId, $invitedByUserId, $email, $role);
    }

    public function buildAcceptUrl(Invite $invite): string
    {
        return rtrim(config('app.frontend_url'), '/') . '/invite/' . $invite->token;
    }

    /**
     * Send the invitation email. Failures are logged but do not throw,
     * so the admin still gets the copy-paste link as a fallback.
     */
    public function sendEmail(Invite $invite, ?User $inviter = null): bool
    {
        try {
            Notification::route('mail', $invite->email)
                ->notify(new InviteNotification(
                    $invite->loadMissing('tenant'),
                    $inviter,
                    $this->buildAcceptUrl($invite),
                ));
            return true;
        } catch (\Throwable $e) {
            Log::warning('Invite email failed to send', [
                'invite_id' => $invite->id,
                'email'     => $invite->email,
                'error'     => $e->getMessage(),
            ]);
            return false;
        }
    }
}
