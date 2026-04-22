<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('screenshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_session_id')->constrained('work_sessions')->cascadeOnDelete();
            $table->string('disk', 40)->default('local');
            $table->string('path');
            $table->unsignedInteger('bytes')->nullable();
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->timestamp('captured_at');
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'captured_at']);
            $table->index(['tenant_id', 'captured_at']);
            $table->index(['work_session_id', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('screenshots');
    }
};
