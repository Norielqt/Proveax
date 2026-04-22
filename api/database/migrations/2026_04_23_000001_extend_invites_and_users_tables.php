<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invites', function (Blueprint $table) {
            $table->foreignId('invited_by_user_id')->nullable()->after('tenant_id')
                ->constrained('users')->nullOnDelete();
            $table->string('role', 20)->default('employee')->after('email');
            $table->timestamp('revoked_at')->nullable()->after('accepted_at');

            $table->index(['tenant_id', 'email']);
            $table->index('invited_by_user_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('invited_by_user_id')->nullable()->after('tenant_id')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['invited_by_user_id']);
            $table->dropColumn('invited_by_user_id');
        });

        Schema::table('invites', function (Blueprint $table) {
            $table->dropForeign(['invited_by_user_id']);
            $table->dropIndex(['tenant_id', 'email']);
            $table->dropIndex(['invited_by_user_id']);
            $table->dropColumn(['invited_by_user_id', 'role', 'revoked_at']);
        });
    }
};
