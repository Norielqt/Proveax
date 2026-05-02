<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // Marks the moment a tenant first received the 7-day free trial.
            // Once set, the tenant can never receive another free trial — any
            // future subscription created via /onboarding/plan will skip the
            // trial period and start billing immediately.
            $table->timestamp('trial_used_at')->nullable()->after('trial_ends_at');
        });

        // Backfill: any tenant that already has a trial_ends_at OR a Stripe
        // subscription should be considered to have already used their trial.
        \DB::table('tenants')
            ->whereNull('trial_used_at')
            ->where(function ($q) {
                $q->whereNotNull('trial_ends_at')
                  ->orWhereNotNull('stripe_subscription_id');
            })
            ->update(['trial_used_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('trial_used_at');
        });
    }
};
