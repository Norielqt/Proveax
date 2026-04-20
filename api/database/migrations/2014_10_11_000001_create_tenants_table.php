<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            $table->string('slug', 180)->unique();
            $table->string('industry')->nullable();
            $table->string('phone')->nullable();
            $table->string('address')->nullable();

            $table->timestamp('trial_ends_at')->nullable()->index();
            $table->enum('subscription_status', [
                'trialing', 'active', 'past_due', 'canceled', 'expired'
            ])->nullable()->index();

            $table->string('stripe_customer_id')->nullable()->unique();
            $table->string('stripe_subscription_id')->nullable()->unique();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
