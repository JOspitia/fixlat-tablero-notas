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
     * Update content with optimistic locking on updated_at.
     * Throws OptimisticLockException on stale write (caller converts to 409).
     */
    public function update(User $actor, Note $note, array $data): Note
    {
        $clientUpdatedAt = $data['updated_at'];
        $serverUpdatedAt = $note->updated_at?->toIso8601String();

        if ($clientUpdatedAt !== $serverUpdatedAt) {
            throw new OptimisticLockException(
                $note->fresh(),
                'La nota fue modificada por otro usuario. Recarga e intenta de nuevo.'
            );
        }

        // HU-05: whitelist extended with shape/font_family/text_align so PUT
        // persists the visual-enrichment fields (AC21-AC34). Per HU-02 §B7 + E2,
        // `array_intersect_key` silently drops fields not present in the body,
        // so the 3 enrichment fields keep their existing values when omitted.
        $old = $note->only([
            'title', 'text', 'status', 'position_x', 'position_y',
            'shape', 'font_family', 'text_align',
        ]);
        $note->fill(array_intersect_key(
            $data,
            array_flip([
                'title', 'text', 'status', 'position_x', 'position_y',
                'shape', 'font_family', 'text_align',
            ])
        ));
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
