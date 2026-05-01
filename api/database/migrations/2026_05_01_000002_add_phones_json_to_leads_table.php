<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $t) {
            // Stores all skip-trace phones with metadata: [{number, type, dnc, carrier}]
            // The legacy `phone` string column is kept for manual edits / backward compat.
            $t->json('phones')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $t) {
            $t->dropColumn('phones');
        });
    }
};
