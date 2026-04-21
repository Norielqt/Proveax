<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rentcast_fetched_queries', function (Blueprint $table) {
            $table->unsignedInteger('last_offset')->default(0)->after('result_count');
            $table->boolean('is_complete')->default(false)->after('last_offset');
        });
    }

    public function down(): void
    {
        Schema::table('rentcast_fetched_queries', function (Blueprint $table) {
            $table->dropColumn(['last_offset', 'is_complete']);
        });
    }
};
