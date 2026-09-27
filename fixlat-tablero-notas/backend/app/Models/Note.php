<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Note model for HU-02 (tablero-notas).
 *
 * Per `documents/HU-02-tablero-notas.md`:
 * - No ownership: any active user can create/edit/move/delete any note.
 * - SoftDeletes: `$note->delete()` sets `deleted_at`; default queries exclude them.
 *
 * HU-05 extends the model with three visual-enrichment fields
 * (`shape`, `font_family`, `text_align`). See `documents/HU-05-enriquecimiento-notas.md`.
 * Constants below mirror the DB CHECK constraints defined in the additive migration
 * `2026_09_27_154611_add_shape_font_align_to_notes.php` and the `in:` rules in
 * `StoreNoteRequest` / `UpdateNoteRequest`.
 *
 * HU-06 extends `booted()` with a `deleting` listener that cascades soft-delete
 * to `note_connectors` where this note is source or destination. See
 * `documents/HU-06-conectores.md` §6.5 and `NoteConnectorService::cascadingDeleteForNote()`.
 */
class Note extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'text',
        'status',
        'position_x',
        'position_y',
        'shape',
        'font_family',
        'text_align',
        'version',
    ];

    /**
     * Default attribute values for unsaved instances.
     *
     * Per HU-05 §3 B8 + AC15/AC22: when a client omits `shape`/`font_family`/`text_align`
     * the database defaults apply; this `protected $attributes` guarantees the same
     * defaults on in-memory instances before save (e.g. for tests or service-layer
     * construction), independent of the migration's `DEFAULT` clauses.
     *
     * HU-05 WU-3b: `version` defaults to `1` here so freshly-constructed instances
     * already carry the starting value. The auto-increment on dirty UPDATE happens
     * in `booted()` below — INSERT keeps `1` because that is the seeded value.
     */
    protected $attributes = [
        'shape' => 'rectangle',
        'font_family' => 'Inter',
        'text_align' => 'left',
        'version' => 1,
    ];

    /**
     * The attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'position_x' => 'float',
            'position_y' => 'float',
            'version' => 'integer',
        ];
    }

    /**
     * Bootstrap model event listeners.
     *
     * HU-05 WU-3b — auto-increment `version` on every dirty UPDATE so it behaves as
     * a monotonic counter. INSERT is left untouched: `$attributes['version']` already
     * starts new rows at `1`, and the DB column default agrees, so a fresh
     * `Note::create([...])` lands at version 1 without needing a bump.
     *
     * WU-3c will replace the optimistic-lock check in `NoteService` / FormRequests
     * to compare this `version` (int) instead of `updated_at` (timestamp). Until
     * then, `version` is persisted but unused by the lock — existing behaviour
     * continues to apply.
     */
    protected static function booted(): void
    {
        static::saving(function (Note $note) {
            if ($note->exists && $note->isDirty()) {
                $note->version = (int) $note->version + 1;
            }
        });

        // HU-06 §6.5: cascade soft-delete for connectors. When a Note is soft-
        // deleted, every connector where this note is source OR destination
        // is also soft-deleted, inside the same DB::transaction() so the
        // cascade is atomic — if it fails halfway, the note is restored.
        //
        // The listener only fires on SOFT delete (Laravel's SoftDeletes trait
        // passes `isForceDeleting() === false` for `delete()`, true for
        // `forceDelete()`). The DB FKs declared with ON DELETE CASCADE are
        // defence in depth for the hard-delete path, which this app never
        // uses (project rule: soft delete only).
        //
        // DB::transaction() is **explicit and required** — Laravel does NOT
        // guarantee a transaction inside model events, so we own it here.
        static::deleting(function (Note $note) {
            if ($note->isForceDeleting()) {
                return;
            }
            DB::transaction(function () use ($note) {
                \App\Models\NoteConnector::where('source_note_id', $note->id)
                    ->orWhere('destination_note_id', $note->id)
                    ->get()
                    ->each(function (\App\Models\NoteConnector $connector) {
                        $connector->delete();
                    });
            });
        });
    }

    /**
     * Allowed status values (mirror DB CHECK constraint for in-PHP validation).
     */
    public const STATUS_PENDIENTE = 'Pendiente';

    public const STATUS_EN_CURSO = 'En curso';

    public const STATUS_HECHO = 'Hecho';

    public const ALLOWED_STATUSES = [
        self::STATUS_PENDIENTE,
        self::STATUS_EN_CURSO,
        self::STATUS_HECHO,
    ];

    /**
     * Allowed `shape` values (HU-05 §6.1, mirror of `notes_shape_check` CHECK).
     *
     * The canonical order matches the Miro-style catalog documented in HU-05 §6.1
     * (rectangle first as the default; cylinder last). Keep this list in sync with
     * the CHECK constraint emitted by the migration when adding a new shape — both
     * must move together.
     */
    public const ALLOWED_SHAPES = [
        'rectangle',
        'rounded_rectangle',
        'diamond',
        'triangle',
        'circle',
        'ellipse',
        'star',
        'hexagon',
        'pentagon',
        'octagon',
        'arrow',
        'parallelogram',
        'trapezoid',
        'message_bubble',
        'cloud',
        'cylinder',
    ];

    /**
     * Allowed `text_align` values (HU-05 §6.3, mirror of `notes_text_align_check`).
     */
    public const ALLOWED_TEXT_ALIGNS = [
        'left',
        'center',
        'right',
        'justify',
    ];

    /**
     * Documentation reference list for `font_family`.
     *
     * Per HU-05 decision A13: `font_family` has NO DB CHECK (catalog may grow without
     * migration) and is validated exclusively in the FormRequest via `in:` rule
     * (StoreNoteRequest / UpdateNoteRequest). This constant exists so the model
     * carries the canonical catalog for code that needs to enumerate it (e.g. tests,
     * future "list available fonts" endpoint) and to keep the migration/FormRequest
     * in sync with a single source of truth in PHP.
     */
    public const ALLOWED_FONT_FAMILIES = [
        'Inter',
        'Merriweather',
        'JetBrains Mono',
        'Caveat',
        'Lobster',
        'Playfair Display',
        'Poppins',
    ];
}
