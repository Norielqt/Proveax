<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $table) {
            $table->boolean('owner_occupied')->nullable()->after('owner_name');
        });
    }

    public function down(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $table) {
            $table->dropColumn('owner_occupied');
        });
    }
};
