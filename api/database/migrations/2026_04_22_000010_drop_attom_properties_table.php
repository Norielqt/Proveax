<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('attom_properties');
    }

    public function down(): void
    {
        // Attom has been replaced by Rentcast; no rollback.
    }
};
