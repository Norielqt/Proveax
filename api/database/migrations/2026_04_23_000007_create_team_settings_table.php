<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('screenshot_retention_days')->default(30); // hard max 90 in app
            $table->unsignedSmallInteger('screenshot_interval_minutes')->default(10);
            $table->unsignedSmallInteger('idle_timeout_minutes')->default(5);
            $table->boolean('screenshots_required')->default(true);
            $table->text('consent_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_settings');
    }
};
