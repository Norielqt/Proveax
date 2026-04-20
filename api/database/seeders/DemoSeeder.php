<?php
namespace Database\Seeders;

use App\Enums\Role;
use App\Enums\SubscriptionStatus;
use App\Models\Property;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::create([
            'name'                => 'Acme Realty',
            'slug'                => 'acme-realty',
            'trial_ends_at'       => now()->addDays(7),
            'subscription_status' => SubscriptionStatus::Trialing,
        ]);

        User::create([
            'tenant_id' => $tenant->id,
            'name'      => 'Admin User',
            'email'     => 'admin@acme.test',
            'password'  => 'password', // hashed automatically by cast
            'role'      => Role::Admin,
        ]);

        foreach (range(1, 100) as $i) {
            Property::create([
                'tenant_id'       => $tenant->id,
                'address'         => "$i Ocean Drive",
                'city'            => 'Miami',
                'state'           => 'FL',
                'zip'             => '33139',
                'latitude'        => 25.7617 + (mt_rand(-500, 500) / 10000),
                'longitude'       => -80.1918 + (mt_rand(-500, 500) / 10000),
                'property_type'   => 'single_family',
                'bedrooms'        => mt_rand(2, 5),
                'bathrooms'       => mt_rand(1, 4),
                'square_feet'     => mt_rand(900, 4200),
                'year_built'      => mt_rand(1950, 2024),
                'estimated_value' => mt_rand(350_000, 2_800_000),
                'owner_name'      => "Owner #$i",
            ]);
        }
    }
}
