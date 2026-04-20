<?php
namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class TenantScope implements Scope
{
    /**
     * Guard against infinite recursion: Auth::user() → User::find() → TenantScope::apply() → …
     * During initial user resolution the inner query runs unscoped, then the outer query
     * adds the tenant filter once Auth has a cached user.
     */
    private static bool $resolving = false;

    public function apply(Builder $builder, Model $model): void
    {
        if (self::$resolving) {
            return;
        }

        self::$resolving = true;
        $user = Auth::user();
        self::$resolving = false;

        if ($user && $user->tenant_id) {
            $builder->where($model->getTable() . '.tenant_id', $user->tenant_id);
        }
    }
}
