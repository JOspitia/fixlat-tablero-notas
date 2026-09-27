<?php

namespace App\Services;

use App\Models\Note;
use App\Models\NoteConnector;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NoteConnectorService
{
    public function __construct(private readonly Request $request) {}

    /**
     * List all active connectors (excludes soft-deleted via the default
     * SoftDeletes scope). Ordered by id desc for stable frontend hydration.
     */
    public function list(): \Illuminate\Database\Eloquent\Collection
    {
        return NoteConnector::orderBy('id', 'desc')->get();
    }

    /**
     * List active connectors involving a single note (either as source or
     * as destination). Excludes soft-deleted via the default SoftDeletes
     * scope. Returns empty collection if the note doesn't exist or is
     * soft-deleted — the controller maps that to a 404 before calling
     * here, so this method assumes the note exists.
     */
    public function listForNote(Note $note): \Illuminate\Database\Eloquent\Collection
    {
        return NoteConnector::where('source_note_id', $note->id)
            ->orWhere('destination_note_id', $note->id)
            ->orderBy('id', 'desc')
            ->get();
    }

    /**
     * Create a new connector from $source to $destination with the given style.
     *
     * Validation is layered:
     *   - StoreNoteConnectorRequest validated destination exists and A != B.
     *   - DB CHECK note_connectors_no_self_check is the source of truth.
     *   - This method adds the multiplicity cap (HU-06 decision #7) and
     *     the soft-delete destination check (sad path in the US).
     *
     * The multiplicity cap is computed on the UNORDERED pair {A, B}: 6
     * connectors total between the same two notes regardless of direction.
     * This means (A→B)x6 plus (B→A)x0 = 6, or (A→B)x3 plus (B→A)x3 = 6.
     * Same pair ordering doesn't matter; we count all connectors where
     * the endpoints match in either order.
     *
     * Throws ModelNotFoundException if the destination note doesn't exist
     * or is soft-deleted (controller maps to 404 with the canonical
     * 'Esta nota ya no existe.' message).
     * Throws \DomainException('MULTIPLICITY_CAP_EXCEEDED') when the cap
     * is reached (controller maps to 422 with a Spanish message).
     */
    public function create(User $actor, Note $source, array $data): NoteConnector
    {
        $destinationId = (int) $data['destination_note_id'];
        $style = $data['style'] ?? NoteConnector::DEFAULT_STYLE;

        $destination = Note::find($destinationId);
        if (! $destination) {
            throw (new ModelNotFoundException())->setModel(Note::class, [$destinationId]);
        }

        // Multiplicity cap check (unordered pair {source, destination}).
        $existingCount = NoteConnector::where(function ($q) use ($source, $destinationId) {
            $q->where(function ($q2) use ($source, $destinationId) {
                $q2->where('source_note_id', $source->id)
                    ->where('destination_note_id', $destinationId);
            })->orWhere(function ($q2) use ($source, $destinationId) {
                $q2->where('source_note_id', $destinationId)
                    ->where('destination_note_id', $source->id);
            });
        })->count();

        if ($existingCount >= NoteConnector::MULTIPLICITY_CAP) {
            throw new \DomainException('MULTIPLICITY_CAP_EXCEEDED');
        }

        $connector = new NoteConnector;
        $connector->source_note_id = $source->id;
        $connector->destination_note_id = $destinationId;
        $connector->style = $style;
        $connector->save();

        if (config('app.debug')) {
            Log::debug('note_connectors.created', [
                'user_id' => $actor->id,
                'connector_id' => $connector->id,
                'source_note_id' => $source->id,
                'destination_note_id' => $destinationId,
                'style' => $style,
                'ip' => $this->request->ip(),
            ]);
        }

        return $connector;
    }

    /**
     * Update the style of an existing connector.
     *
     * Throws ModelNotFoundException if the connector was soft-deleted
     * between the controller's find() and this call (race window;
     * controller maps to 404).
     */
    public function update(User $actor, NoteConnector $connector, array $data): NoteConnector
    {
        $oldStyle = $connector->style;
        $connector->style = $data['style'];
        $connector->save();

        if (config('app.debug')) {
            Log::debug('note_connectors.updated', [
                'user_id' => $actor->id,
                'connector_id' => $connector->id,
                'source_note_id' => $connector->source_note_id,
                'destination_note_id' => $connector->destination_note_id,
                'fields_changed' => [
                    ['field' => 'style', 'old' => $oldStyle, 'new' => $connector->style],
                ],
                'ip' => $this->request->ip(),
            ]);
        }

        return $connector;
    }

    /**
     * Soft-delete a connector.
     */
    public function delete(User $actor, NoteConnector $connector): void
    {
        $connector->delete();

        if (config('app.debug')) {
            Log::debug('note_connectors.deleted', [
                'user_id' => $actor->id,
                'connector_id' => $connector->id,
                'source_note_id' => $connector->source_note_id,
                'destination_note_id' => $connector->destination_note_id,
                'ip' => $this->request->ip(),
            ]);
        }
    }

    /**
     * Soft-delete all connectors involving a note. Called by the
     * Note::deleting listener (HU-06 §6.5) inside DB::transaction().
     *
     * Returns the count of connectors soft-deleted (for logging/tests).
     */
    public function cascadingDeleteForNote(Note $note): int
    {
        $connectors = NoteConnector::where('source_note_id', $note->id)
            ->orWhere('destination_note_id', $note->id)
            ->get();

        $count = 0;
        foreach ($connectors as $connector) {
            $connector->delete();
            $count++;
        }

        return $count;
    }
}