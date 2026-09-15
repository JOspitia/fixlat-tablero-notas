<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * HU-02 §2: notes table per `documents/HU-02-tablero-notas.md`.
     * No FK to users (no ownership per `prueba-tecnica.md §2`):
     * "Todos los usuarios activos pueden crear, editar, mover y eliminar todas las notas".
     * SoftDeletes: `deleted_at` for soft delete (HU-02 §B3).
     */
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->string('title', 120);
            $table->text('text')->nullable();
            $table->string('status', 20)->default('Pendiente');
            $table->double('position_x')->default(0);
            $table->double('position_y')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        // DB-level CHECK for status enum (HU-02 §B5).
        if (config('database.default') === 'pgsql') {
            \Illuminate\Support\Facades\DB::statement(
                "ALTER TABLE notes ADD CONSTRAINT notes_status_check CHECK (status IN ('Pendiente', 'En curso', 'Hecho'))"
            );
        }

        // Indexes for queries: filter by status, exclude soft-deleted.
        Schema::table('notes', function (Blueprint $table) {
            $table->index('status');
            $table->index('deleted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
