<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('subscription_plan', 32)->nullable()->after('subscription_status');
            $table->timestamp('subscription_ends_at')->nullable()->after('subscription_plan');
            $table->timestamp('subscription_canceled_at')->nullable()->after('subscription_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['subscription_plan', 'subscription_ends_at', 'subscription_canceled_at']);
        });
    }
};
