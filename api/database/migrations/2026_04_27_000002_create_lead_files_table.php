<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // New relational table — one lead → many files
        Schema::create('lead_files', function (Blueprint $t) {
            $t->id();
            $t->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $t->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('file_name', 500);
            $t->string('dropbox_path', 1000);
            $t->string('file_url', 2000)->nullable();
            $t->timestamps();

            $t->index('lead_id');
        });

        // Drop the old single-file columns from leads
        Schema::table('leads', function (Blueprint $t) {
            $t->dropColumn(['file_name', 'file_dropbox_path', 'file_url']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_files');

        Schema::table('leads', function (Blueprint $t) {
            $t->string('file_name', 500)->nullable()->after('notes');
            $t->string('file_dropbox_path', 1000)->nullable()->after('file_name');
            $t->string('file_url', 2000)->nullable()->after('file_dropbox_path');
        });
    }
};
