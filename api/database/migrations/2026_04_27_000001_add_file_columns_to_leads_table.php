<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $t) {
            $t->string('file_name', 500)->nullable()->after('notes');
            $t->string('file_dropbox_path', 1000)->nullable()->after('file_name');
            $t->string('file_url', 2000)->nullable()->after('file_dropbox_path');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $t) {
            $t->dropColumn(['file_name', 'file_dropbox_path', 'file_url']);
        });
    }
};
