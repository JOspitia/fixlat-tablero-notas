<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * HU-05 WU-3b — introduces a monotonic `version` column on `notes` as the
     * foundation for swapping the optimistic-lock check from `updated_at` (which
     * suffered from clock skew, internal observers bumping `updated_at`, and
     * sub-second edit races) to a simple integer compare.
     *
     * Scope of WU-3b is DATA ONLY:
     *   - Add `version UNSIGNED INTEGER NOT NULL DEFAULT 1` to `notes`.
     *   - Idempotent: Schema::hasColumn guard before addColumn (matches the
     *     pattern from `2026_09_27_154611_add_shape_font_align_to_notes.php`).
     *   - Place the column after `text_align` for visual neighbor-grouping with
     *     the other HU-05 enrichment columns.
     *
     * NOT in scope of WU-3b (will land in WU-3c):
     *   - Swapping the optimistic lock logic in NoteService / UpdateNoteRequest.
     *   - Exposing `version` in the FormRequests' validation rules.
     *   - Bumping `version` from internal Observers (out of scope entirely; the
     *     Eloquent `saving` listener in Note::booted() handles dirty UPDATE; no
     *     external observer should bump version).
     */
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            if (! Schema::hasColumn('notes', 'version')) {
                $table->unsignedInteger('version')->default(1)->after('text_align');
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * Drops `version` cleanly. Guarded by hasColumn so partial-state rollback
     * (column already gone, e.g. accidental manual drop) is a no-op rather than
     * an error.
     */
    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            if (Schema::hasColumn('notes', 'version')) {
                $table->dropColumn('version');
            }
        });
    }
};
