<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->json('skip_trace_phones')->nullable()->after('owner_mailing_address');
            $table->json('skip_trace_emails')->nullable()->after('skip_trace_phones');
            $table->timestamp('skip_traced_at')->nullable()->after('skip_trace_emails');
        });
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn(['skip_trace_phones', 'skip_trace_emails', 'skip_traced_at']);
        });
    }
};
