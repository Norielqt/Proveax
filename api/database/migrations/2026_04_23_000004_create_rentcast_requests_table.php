<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rentcast_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('endpoint', 80);
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->boolean('billable')->default(true); // false if served from cache
            $table->unsignedInteger('duration_ms')->nullable();
            $table->string('error', 255)->nullable();
            $table->timestamp('requested_at');
            $table->timestamps();

            $table->index(['tenant_id', 'requested_at']);
            $table->index(['tenant_id', 'user_id', 'requested_at']);
            $table->index(['tenant_id', 'billable', 'requested_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rentcast_requests');
    }
};
