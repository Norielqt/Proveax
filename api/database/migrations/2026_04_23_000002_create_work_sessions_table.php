<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            // seconds of active time (excludes paused time)
            $table->unsignedInteger('active_seconds')->default(0);
            // seconds paused via idle detection
            $table->unsignedInteger('idle_seconds')->default(0);
            // last client heartbeat (for orphaned-session cleanup)
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->boolean('screenshots_enabled')->default(false);
            $table->string('end_reason', 40)->nullable(); // manual, idle_timeout, orphaned, share_stopped
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'started_at']);
            $table->index(['tenant_id', 'started_at']);
            $table->index(['user_id', 'ended_at']); // fast lookup of "active session"
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_sessions');
    }
};
