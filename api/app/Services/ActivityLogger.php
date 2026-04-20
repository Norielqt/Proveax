<?php
namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Request;

class ActivityLogger
{
    public function log(User $user, string $action, ?Model $subject = null, array $metadata = []): void
    {
        ActivityLog::create([
            'tenant_id'    => $user->tenant_id,
            'user_id'      => $user->id,
            'action'       => $action,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id'   => $subject?->getKey(),
            'metadata'     => $metadata,
            'ip'           => Request::ip(),
        ]);
    }
}
