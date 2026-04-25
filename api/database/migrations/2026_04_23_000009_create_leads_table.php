<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $t->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();

            $t->string('name', 200)->nullable();
            $t->string('address', 500)->nullable();
            $t->string('phone', 50)->nullable();
            $t->string('lead_type', 40)->nullable();   // cold|warm|hot|qualified|closed
            $t->string('source_type', 40)->nullable(); // absentee_owner|out_of_state_owner|etc
            $t->bigInteger('home_price_cents')->nullable(); // store as cents; rendered as $ on client
            $t->string('email', 200)->nullable();
            $t->text('notes')->nullable();

            $t->timestamps();

            $t->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
