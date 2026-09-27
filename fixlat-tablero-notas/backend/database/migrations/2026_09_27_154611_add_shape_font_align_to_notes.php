<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * HU-05 §6.5 — additive migration for `notes`. Adds three NOT NULL columns
     * with hardcoded defaults so existing rows backfill cleanly:
     *   - shape       VARCHAR(30) DEFAULT 'rectangle' (CHECK on pgsql, allow-list of 16 shapes)
     *   - font_family VARCHAR(60) DEFAULT 'Inter'     (no DB CHECK — validated at FormRequest, catalog may grow)
     *   - text_align  VARCHAR(10) DEFAULT 'left'      (CHECK on pgsql, {left,center,right,justify})
     *
     * Idempotent: each column guarded by Schema::hasColumn so a second `migrate`
     * run is a no-op (AC6). CHECK constraints guarded by pg_constraint lookup so
     * they aren't re-added on rerun.
     *
     * SQLite test env has no CHECK support (E18, AC2/AC3 env-aware): the CHECK
     * statements only execute when `database.default` is `pgsql`, mirroring the
     * pattern from `2026_09_15_200000_create_notes_table.php`.
     */
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            if (! Schema::hasColumn('notes', 'shape')) {
                $table->string('shape', 30)->default('rectangle');
            }
            if (! Schema::hasColumn('notes', 'font_family')) {
                $table->string('font_family', 60)->default('Inter');
            }
            if (! Schema::hasColumn('notes', 'text_align')) {
                $table->string('text_align', 10)->default('left');
            }
        });

        if (config('database.default') === 'pgsql') {
            $shapes = "'rectangle','rounded_rectangle','diamond','triangle',"
                ."'circle','ellipse','star','hexagon','pentagon','octagon',"
                ."'arrow','parallelogram','trapezoid','message_bubble','cloud','cylinder'";

            if (! $this->pgsqlConstraintExists('notes_shape_check')) {
                DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_shape_check CHECK (shape IN ({$shapes}))");
            }

            if (! $this->pgsqlConstraintExists('notes_text_align_check')) {
                DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_text_align_check CHECK (text_align IN ('left','center','right','justify'))");
            }
        }
    }

    /**
     * Reverse the migrations.
     *
     * Drops CHECK constraints first (pgsql requires the column to outlive its
     * CHECK; dropping the column while the constraint is attached errors out),
     * then drops the three columns. Each step is guarded so a partial-state
     * rollback still works.
     */
    public function down(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_shape_check');
            DB::statement('ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_text_align_check');
        }

        Schema::table('notes', function (Blueprint $table) {
            $columns = array_values(array_filter(
                ['shape', 'font_family', 'text_align'],
                fn (string $col) => Schema::hasColumn('notes', $col)
            ));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }

    /**
     * Check whether a constraint already exists on the `notes` table in pgsql.
     * Used to keep `up()` idempotent without relying on try/catch around the
     * ADD CONSTRAINT statement.
     */
    private function pgsqlConstraintExists(string $constraintName): bool
    {
        $row = DB::selectOne(
            'SELECT 1 FROM pg_constraint c
              JOIN pg_class t ON t.oid = c.conrelid
             WHERE t.relname = ? AND c.conname = ?',
            ['notes', $constraintName]
        );

        return $row !== null;
    }
};
