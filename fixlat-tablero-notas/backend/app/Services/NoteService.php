<?php

namespace App\Services;

use App\Models\Note;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class NoteService
{
    public function __construct(private readonly Request $request)
    {
    }

    /**
     * List all active notes (soft-deleted excluded by default).
     */
    public function list(): \Illuminate\Database\Eloquent\Collection
    {
        return Note::orderBy('created_at', 'desc')->get();
    }

    /**
     * Create a new note.
     */
    public function create(User $actor, array $data): Note
    {
        $note = Note::create([
            'title' => $data['title'],
            'text' => $data['text'] ?? null,
            'status' => $data['status'],
            'position_x' => $data['position_x'],
            'position_y' => $data['position_y'],
        ]);

        Log::info('notes.created', [
            'user_id' => $actor->id,
            'note_id' => $note->id,
            'ip' => $this->request->ip(),
        ]);

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
            throw new \App\Exceptions\OptimisticLockException(
                $note->fresh(),
                'La nota fue modificada por otro usuario. Recarga e intenta de nuevo.'
            );
        }

        $old = $note->only(['title', 'text', 'status', 'position_x', 'position_y']);
        $note->fill(array_intersect_key($data, array_flip(['title', 'text', 'status', 'position_x', 'position_y'])));
        $note->save();

        $changed = [];
        foreach ($old as $key => $before) {
            $after = $note->{$key};
            if ($before != $after) {
                $changed[] = ['field' => $key, 'old' => $before, 'new' => $after];
            }
        }

        Log::info('notes.updated', [
            'user_id' => $actor->id,
            'note_id' => $note->id,
            'fields_changed' => $changed,
            'ip' => $this->request->ip(),
        ]);

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

        Log::info('notes.deleted', [
            'user_id' => $actor->id,
            'note_id' => $note->id,
            'ip' => $this->request->ip(),
        ]);
    }
}
