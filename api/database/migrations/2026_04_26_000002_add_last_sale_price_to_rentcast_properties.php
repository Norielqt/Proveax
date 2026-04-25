<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $t) {
            $t->decimal('last_sale_price', 15, 2)->nullable()->after('estimated_value');
        });

        // Backfill from raw_json for rows that already have it
        DB::statement("
            UPDATE rentcast_properties
            SET last_sale_price = JSON_UNQUOTE(JSON_EXTRACT(raw_json, '$.lastSalePrice'))
            WHERE raw_json IS NOT NULL
              AND JSON_EXTRACT(raw_json, '$.lastSalePrice') IS NOT NULL
              AND last_sale_price IS NULL
        ");

        // Purge the query cache so all searches re-fetch from live API and
        // populate the new column for properties that have null raw_json.
        DB::table('rentcast_fetched_queries')->truncate();
    }

    public function down(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $t) {
            $t->dropColumn('last_sale_price');
        });
    }
};
