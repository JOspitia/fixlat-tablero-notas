<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Usuario Administrador demo
        User::updateOrCreate(
            ['email' => 'admin@test.com'],
            [
                'name' => 'Administrador Demo',
                'password' => Hash::make('admin123'),
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        // Usuario estándar demo
        User::updateOrCreate(
            ['email' => 'user@test.com'],
            [
                'name' => 'Usuario Demo',
                'password' => Hash::make('user123'),
                'role' => 'user',
                'is_active' => true,
            ]
        );
    }
}
