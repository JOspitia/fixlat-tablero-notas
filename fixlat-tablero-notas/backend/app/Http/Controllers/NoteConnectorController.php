<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreNoteConnectorRequest;
use App\Http\Requests\UpdateNoteConnectorRequest;
use App\Http\Resources\NoteConnectorResource;
use App\Models\Note;
use App\Models\NoteConnector;
use App\Services\NoteConnectorService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class NoteConnectorController extends Controller
{
    public function __construct(private readonly NoteConnectorService $connectors) {}

    /**
     * GET /api/notes/connectors — list all active connectors.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'connectors' => NoteConnectorResource::collection($this->connectors->list()),
        ], 200);
    }

    /**
     * GET /api/notes/{note}/connectors — list connectors involving this note.
     */
    public function indexForNote(int $note): JsonResponse
    {
        $noteModel = Note::find($note);
        if (! $noteModel) {
            return response()->json([
                'message' => 'Esta nota ya no existe.',
            ], 404);
        }

        return response()->json([
            'connectors' => NoteConnectorResource::collection(
                $this->connectors->listForNote($noteModel)
            ),
        ], 200);
    }

    /**
     * POST /api/notes/{note}/connectors — create a new connector.
     */
    public function store(StoreNoteConnectorRequest $request, int $note): JsonResponse
    {
        $source = Note::find($note);
        if (! $source) {
            return response()->json([
                'message' => 'Esta nota ya no existe.',
            ], 404);
        }

        try {
            $connector = $this->connectors->create(
                $request->user(),
                $source,
                $request->validated(),
            );
        } catch (ModelNotFoundException $e) {
            // Destination note was soft-deleted between FormRequest validation
            // and service execution (TOCTOU race window).
            return response()->json([
                'message' => 'Esta nota ya no existe.',
            ], 404);
        } catch (\DomainException $e) {
            if ($e->getMessage() === 'MULTIPLICITY_CAP_EXCEEDED') {
                return response()->json([
                    'message' => 'Has alcanzado el máximo de '.NoteConnector::MULTIPLICITY_CAP.' conectores entre estas dos notas.',
                ], 422);
            }
            throw $e;
        }

        return response()->json([
            'connector' => new NoteConnectorResource($connector),
        ], 201);
    }

    /**
     * PUT /api/note-connectors/{id} — update connector style.
     */
    public function update(UpdateNoteConnectorRequest $request, int $id): JsonResponse
    {
        $connector = NoteConnector::find($id);
        if (! $connector) {
            return response()->json([
                'message' => 'Este conector ya no existe.',
            ], 404);
        }

        $connector = $this->connectors->update(
            $request->user(),
            $connector,
            $request->validated(),
        );

        return response()->json([
            'connector' => new NoteConnectorResource($connector),
        ], 200);
    }

    /**
     * DELETE /api/note-connectors/{id} — soft-delete a connector.
     */
    public function destroy(Request $request, int $id): Response
    {
        $connector = NoteConnector::find($id);
        if (! $connector) {
            return response()->json([
                'message' => 'Este conector ya no existe.',
            ], 404);
        }

        $this->connectors->delete($request->user(), $connector);

        return response()->noContent(); // 204
    }
}