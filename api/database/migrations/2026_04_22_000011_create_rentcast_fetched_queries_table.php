<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rentcast_fetched_queries', function (Blueprint $table) {
            $table->string('query_key', 120)->primary(); // e.g. "zip:12110", "city:miami:fl"
            $table->unsignedInteger('result_count')->default(0);
            $table->timestamp('fetched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rentcast_fetched_queries');
    }
};
