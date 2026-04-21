<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rentcast_properties', function (Blueprint $table) {
            $table->string('rentcast_id', 300)->primary();

            $table->string('street', 200)->default('');
            $table->string('address', 300)->default('');
            $table->string('city', 120)->default('');
            $table->string('state', 2)->default('');
            $table->string('zip', 10)->index();

            $table->decimal('lat', 10, 7)->nullable()->index();
            $table->decimal('lng', 10, 7)->nullable();

            $table->string('property_type', 80)->nullable()->index();
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->decimal('bathrooms', 4, 1)->nullable();
            $table->unsignedInteger('square_feet')->nullable();
            $table->unsignedInteger('lot_size')->nullable();
            $table->unsignedSmallInteger('year_built')->nullable();
            $table->decimal('estimated_value', 14, 2)->nullable();
            $table->string('owner_name', 200)->nullable();

            $table->timestamp('fetched_at')->nullable()->index();

            $table->index(['city', 'state']);
            $table->index(['lat', 'lng']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rentcast_properties');
    }
};
