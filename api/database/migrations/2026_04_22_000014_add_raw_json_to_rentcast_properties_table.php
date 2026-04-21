<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $table) {
            $table->longText('raw_json')->nullable()->after('owner_occupied');
        });
    }

    public function down(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $table) {
            $table->dropColumn('raw_json');
        });
    }
};
