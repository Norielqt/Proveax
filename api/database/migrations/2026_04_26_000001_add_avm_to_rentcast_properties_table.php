<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $t) {
            $t->json('avm_json')->nullable()->after('raw_json');
            $t->timestamp('avm_fetched_at')->nullable()->after('avm_json');
        });
    }

    public function down(): void
    {
        Schema::table('rentcast_properties', function (Blueprint $t) {
            $t->dropColumn(['avm_json', 'avm_fetched_at']);
        });
    }
};
