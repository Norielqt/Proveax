<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attom_properties', function (Blueprint $table) {
            $table->unsignedBigInteger('attom_id')->primary();

            $table->string('address');
            $table->string('city', 120);
            $table->string('state', 2);
            $table->string('zip', 10)->index();

            $table->decimal('lat', 10, 7)->nullable()->index();
            $table->decimal('lng', 10, 7)->nullable();

            $table->string('property_type', 60)->nullable()->index();
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->decimal('bathrooms', 4, 1)->nullable();
            $table->unsignedInteger('square_feet')->nullable();
            $table->unsignedInteger('lot_size')->nullable();
            $table->unsignedSmallInteger('year_built')->nullable();
            $table->decimal('estimated_value', 14, 2)->nullable();
            $table->string('owner_name', 200)->nullable();

            // Track when this row was last refreshed from ATTOM
            $table->timestamp('fetched_at')->nullable()->index();

            $table->index(['city', 'state']);
            $table->index(['lat', 'lng']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attom_properties');
    }
};
