<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * NoteConnector model for HU-06 (conectores entre notas).
 *
 * Per `documents/HU-06-conectores.md`:
 * - A connector is an edge from a source note to a destination note.
 * - `style` is one of 6 canonical arrow styles (allow-list in DB CHECK + constant here).
 * - SoftDeletes: this app never hard-deletes; `deleted_at` is set on `$connector->delete()`.
 * - Cascade soft-delete: when a Note is soft-deleted, all connectors involving
 *   that note are also soft-deleted via the listener in `Note::booted()`.
 *
 * Constants mirror the DB CHECK constraints defined in the migration
 * `2026_09_27_180000_create_note_connectors_table.php` and the `in:` rules in
 * `StoreNoteConnectorRequest` / `UpdateNoteConnectorRequest`.
 *
 * Multiplicity cap (HU-06 decision #7): max 6 connectors between the same
 * unordered pair {A, B}. Enforced by `NoteConnectorService::create()` (next WU).
 * Defined here so the constant lives next to the model.
 */
class NoteConnector extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'source_note_id',
        'destination_note_id',
        'style',
    ];

    /**
     * Default attribute values for unsaved instances.
     *
     * Per HU-06 §3 + AC: when a client omits `style` the DB default
     * 'solid_arrow_end' applies; this `$attributes` entry guarantees the
     * same default on in-memory instances before save (tests / service-layer
     * construction), independent of the migration's DEFAULT clause.
     */
    protected $attributes = [
        'style' => self::DEFAULT_STYLE,
    ];

    /**
     * Allowed `style` values (HU-06 §6.1, mirror of
     * `note_connectors_style_check` CHECK constraint).
     */
    public const ALLOWED_STYLES = [
        'solid_arrow_end',
        'dashed_arrow_end',
        'solid_no_arrow',
        'dashed_no_arrow',
        'arrow_both_solid',
        'solid_arrow_start',
    ];

    /**
     * Default style. Centralised so the Resource, the migration default,
     * and the FormRequest defaults all reference the same constant.
     */
    public const DEFAULT_STYLE = 'solid_arrow_end';

    /**
     * Maximum connectors allowed between the same unordered pair {A, B}.
     * HU-06 decision #7: cap at 6 (upper bound of the 4–6 range the user
     * approved). Enforced by `NoteConnectorService::create()`. Self-connectors
     * (A == B) are forbidden at the DB CHECK level (`note_connectors_no_self_check`)
     * AND by the FormRequest validation (separate defensive layer).
     */
    public const MULTIPLICITY_CAP = 6;

    /**
     * Source note this connector points FROM.
     */
    public function sourceNote()
    {
        return $this->belongsTo(Note::class, 'source_note_id');
    }

    /**
     * Destination note this connector points TO.
     */
    public function destinationNote()
    {
        return $this->belongsTo(Note::class, 'destination_note_id');
    }
}
