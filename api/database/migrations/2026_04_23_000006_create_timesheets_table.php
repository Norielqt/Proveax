<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timesheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // ISO week bounds (Monday..Sunday)
            $table->date('week_start');
            $table->date('week_end');
            $table->unsignedInteger('total_active_seconds')->default(0);
            $table->string('status', 20)->default('draft'); // draft, submitted, approved, rejected
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reviewer_note')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'week_start']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'week_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timesheets');
    }
};
