<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * HU-06 §6.4 — nueva tabla `note_connectors`. Crea de cero (no es ALTER):
     *   - source_note_id / destination_note_id  BIGINT FK -> notes.id ON DELETE CASCADE
     *   - style  VARCHAR(30) NOT NULL DEFAULT 'solid_arrow_end'
     *   - timestamps + softDeletes
     *
     * Los CHECKs (`note_connectors_style_check` y `note_connectors_no_self_check`)
     * viven solo en el bloque pgsql (mirroring pattern de `2026_09_27_154611_add_shape_font_align_to_notes.php`):
     * SQLite (test env, E18/AC2/AC3) no soporta CHECKs con la sintaxis usada acá,
     * así que la validación fuerte para tests queda cubierta por el FormRequest
     * y el `NoteConnectorService` (defensa en profundidad).
     *
     * Índices planos sobre `source_note_id` y `destination_note_id` al final del
     * Blueprint: mejoran el perf del cascade-delete cuando se borra una nota
     * (B14) y de los queries `WHERE source_note_id = ? OR destination_note_id = ?`
     * que el listener de cascade (HU-06 §6.5) y el endpoint de listado ejecutan.
     */
    public function up(): void
    {
        Schema::create('note_connectors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_note_id')
                ->constrained('notes')
                ->cascadeOnDelete();
            $table->foreignId('destination_note_id')
                ->constrained('notes')
                ->cascadeOnDelete();
            $table->string('style', 30)->default('solid_arrow_end');
            $table->timestamps();
            $table->softDeletes();

            // NOTE: do NOT add a table-level CHECK for source_note_id <>
            // destination_note_id inside the Blueprint. Laravel's MySQL/older
            // pgsql paths can't express it portably, and SQLite (test env)
            // doesn't honor CHECK the way we need it here. The constraint
            // lives in the pgsql-only block below.
            $table->index(['source_note_id']);
            $table->index(['destination_note_id']);
        });

        if (config('database.default') === 'pgsql') {
            DB::statement("ALTER TABLE note_connectors ADD CONSTRAINT note_connectors_style_check CHECK (style IN ('solid_arrow_end','dashed_arrow_end','solid_no_arrow','dashed_no_arrow','arrow_both_solid','solid_arrow_start'))");
            DB::statement("ALTER TABLE note_connectors ADD CONSTRAINT note_connectors_no_self_check CHECK (source_note_id <> destination_note_id)");
        }
    }

    public function down(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('ALTER TABLE note_connectors DROP CONSTRAINT IF EXISTS note_connectors_style_check');
            DB::statement('ALTER TABLE note_connectors DROP CONSTRAINT IF EXISTS note_connectors_no_self_check');
        }
        Schema::dropIfExists('note_connectors');
    }
};
