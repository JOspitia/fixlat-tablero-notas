<?php

namespace App\Services;

use App\Exceptions\OptimisticLockException;
use App\Models\Note;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NoteService
{
    public function __construct(private readonly Request $request) {}

    /**
     * List all active notes (soft-deleted excluded by default).
     */
    public function list(): Collection
    {
        return Note::orderBy('created_at', 'desc')->get();
    }

    /**
     * Create a new note.
     */
    public function create(User $actor, array $data): Note
    {
        // HU-05: enrich-fields flow through `array_intersect_key` against the
        // same whitelist used by `update()`. When the client omits them, the
        // Note model's `$attributes` defaults apply (AC15). When the client
        // sends them, FormRequest validation (StoreNoteRequest) has already
        // enforced the allow-list before reaching this method.
        $note = new Note;
        $note->fill(array_intersect_key(
            $data,
            array_flip([
                'title', 'text', 'status', 'position_x', 'position_y',
                'shape', 'font_family', 'text_align',
            ])
        ));
        $note->save();

        // HU-05 WU-3a: lifecycle log guarded behind APP_DEBUG for consistency
        // with notes.updated. Low-frequency today, but future bulk imports or
        // batch operations could amplify volume — keep all notes.* logs at the
        // same level to avoid surprise noise in production.
        if (config('app.debug')) {
            Log::debug('notes.created', [
                'user_id' => $actor->id,
                'note_id' => $note->id,
                'ip' => $this->request->ip(),
            ]);
        }

        return $note;
    }

    /**
     * Update content with optimistic locking on the monotonic `version` counter.
     *
     * HU-05 WU-3c: replaced the previous `updated_at` timestamp comparison
     * (which produced false positives under client/server clock skew) with a
     * monotonic integer `version` (HU-05 WU-3b). The client must echo back the
     * version it last observed; mismatch → 409.
     *
     * No-op success semantics: when the client's `version` is stale but the
     * candidate values (input ∪ current note) match the persisted attributes
     * exactly, the save is a true no-op — no state diverged, the user just
     * re-submitted the same payload. Return the current note unchanged
     * (skipping the model's `saving` listener so `version` is NOT bumped),
     * producing a 200 with the existing NoteResource. This closes the
     * "user clicked save twice" false-positive 409 from the old timestamp
     * check.
     *
     * Throws OptimisticLockException when stale + values differ (caller
     * converts to 409 with the current server state so the client can reload).
     */
    public function update(User $actor, Note $note, array $data): Note
    {
        $clientVersion = (int) $data['version'];
        $serverVersion = (int) $note->version;

        // HU-05 WU-3c: shared whitelist for the no-op comparison and the
        // `array_intersect_key` filter. Includes the 3 enrichment fields
        // (shape/font_family/text_align) — closes the WU-2 deferred bug that
        // silently dropped them from the persisted payload.
        $fillableFields = [
            'title', 'text', 'status', 'position_x', 'position_y',
            'shape', 'font_family', 'text_align',
        ];

        if ($clientVersion !== $serverVersion) {
            // Compute the would-be merged values WITHOUT saving, so we can
            // decide whether this is a true no-op (same data, stale version
            // because the user just resubmitted) or a real conflict.
            // Loose-equality compare per field so request-side `0` (int) and
            // model-side `0.0` (float, per `casts()`) collapse to the same
            // semantic value — strict `===` would falsely flag the type
            // mismatch on every numeric field.
            $candidate = [];
            $currentComparable = [];
            foreach ($fillableFields as $key) {
                $candidate[$key] = array_key_exists($key, $data) ? $data[$key] : $note->{$key};
                $currentComparable[$key] = $note->{$key};
            }
            $isNoOp = true;
            foreach ($fillableFields as $key) {
                if ($candidate[$key] != $currentComparable[$key]) {
                    $isNoOp = false;
                    break;
                }
            }

            if ($isNoOp) {
                // No-op success: no actual state change. Skip the save so the
                // model's `saving` listener does NOT bump `version`, and
                // return the persisted note as-is.
                return $note;
            }

            // Real conflict — values differ, so another writer is in play.
            // Spanish message + current payload preserve the anti-enumeration
            // posture of the previous 409 response.
            throw new OptimisticLockException(
                $note->fresh(),
                'La nota fue modificada por otro usuario. Recarga e intenta de nuevo.'
            );
        }

        // Version matches → proceed with the save. The model's `saving`
        // listener in `Note::booted()` will auto-increment `version` on this
        // dirty UPDATE.
        $old = $note->only($fillableFields);
        $note->fill(array_intersect_key($data, array_flip($fillableFields)));
        $note->save();

        $changed = [];
        foreach ($old as $key => $before) {
            $after = $note->{$key};
            if ($before != $after) {
                $changed[] = ['field' => $key, 'old' => $before, 'new' => $after];
            }
        }

        // HU-05 WU-3a: per-update log is high-frequency (one entry per PUT),
        // which is risky under concurrent load (one I/O op per request).
        // Guard behind Laravel's standard APP_DEBUG switch — silently no-op
        // in production. All notes.* lifecycle logs (created/updated/deleted)
        // share the same guard for consistency.
        if (config('app.debug')) {
            Log::debug('notes.updated', [
                'user_id' => $actor->id,
                'note_id' => $note->id,
                'fields_changed' => $changed,
                'ip' => $this->request->ip(),
            ]);
        }

        return $note;
    }

    /**
     * Update only position (used by drag&drop onDragEnd).
     */
    public function updatePosition(User $actor, Note $note, float $x, float $y): Note
    {
        $note->position_x = $x;
        $note->position_y = $y;
        $note->save();

        Log::info('notes.position_updated', [
            'user_id' => $actor->id,
            'note_id' => $note->id,
            'position_x' => $x,
            'position_y' => $y,
            'ip' => $this->request->ip(),
        ]);

        return $note;
    }

    /**
     * Soft-delete (HU-02 §B6).
     */
    public function delete(User $actor, Note $note): void
    {
        $note->delete();

        // HU-05 WU-3a: lifecycle log guarded behind APP_DEBUG for consistency
        // with notes.updated and notes.created. Low-frequency today, but future
        // bulk operations (mass delete, cleanup jobs) could amplify volume —
        // keep all notes.* logs at the same level to avoid surprise noise.
        if (config('app.debug')) {
            Log::debug('notes.deleted', [
                'user_id' => $actor->id,
                'note_id' => $note->id,
                'ip' => $this->request->ip(),
            ]);
        }
    }
}
