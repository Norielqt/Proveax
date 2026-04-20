<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $table->string('address');
            $table->string('city', 120)->index();
            $table->string('state', 2)->index();
            $table->string('zip', 10)->index();

            $table->decimal('latitude',  10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->enum('property_type', [
                'single_family', 'multi_family', 'condo', 'townhouse', 'land', 'commercial'
            ])->nullable()->index();
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->decimal('bathrooms', 4, 1)->nullable();
            $table->unsignedInteger('square_feet')->nullable();
            $table->unsignedInteger('lot_size')->nullable();
            $table->unsignedSmallInteger('year_built')->nullable();
            $table->decimal('estimated_value', 14, 2)->nullable();

            $table->string('owner_name')->nullable();
            $table->string('owner_mailing_address')->nullable();
            $table->json('ownership_history')->nullable();
            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->index(['tenant_id', 'city', 'state']);
            $table->index(['tenant_id', 'latitude', 'longitude']);
            $table->index(['tenant_id', 'estimated_value']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
