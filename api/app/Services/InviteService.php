<?php
namespace App\Services;

use App\Models\Invite;

class InviteService
{
    public function createFor(int $tenantId, string $email): Invite
    {
        return Invite::generate($tenantId, $email);
    }

    public function buildAcceptUrl(Invite $invite): string
    {
        return rtrim(config('app.frontend_url'), '/') . '/invite/' . $invite->token;
    }
}
