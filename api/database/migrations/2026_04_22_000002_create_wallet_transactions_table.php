<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            // 'top_up'  = money added to wallet (positive amount)
            // 'charge'  = money spent (negative amount). e.g. skip_trace
            // 'refund'  = reversal of a charge (positive)
            $table->string('type', 20)->index();

            // Signed amount: top_up/refund > 0, charge < 0
            $table->decimal('amount', 10, 2);

            // Resulting balance after this tx (for audit)
            $table->decimal('balance_after', 10, 2);

            $table->string('description')->nullable();
            $table->string('stripe_payment_intent_id')->nullable()->unique();

            // 'pending', 'succeeded', 'failed'
            $table->string('status', 20)->default('succeeded')->index();

            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};
