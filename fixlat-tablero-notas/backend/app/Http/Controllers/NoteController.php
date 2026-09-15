<?php

namespace App\Http\Controllers;

use App\Exceptions\OptimisticLockException;
use App\Http\Requests\StoreNoteRequest;
use App\Http\Requests\UpdateNotePositionRequest;
use App\Http\Requests\UpdateNoteRequest;
use App\Http\Resources\NoteResource;
use App\Models\Note;
use App\Services\NoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class NoteController extends Controller
{
    public function __construct(private readonly NoteService $notes)
    {
    }

    /**
     * GET /api/notes
     */
    public function index(): JsonResponse
    {
        $notes = $this->notes->list();

        return response()->json([
            'notes' => NoteResource::collection($notes),
        ], 200);
    }

    /**
     * POST /api/notes
     */
    public function store(StoreNoteRequest $request): JsonResponse
    {
        $note = $this->notes->create($request->user(), $request->validated());

        return response()->json([
            'note' => new NoteResource($note),
        ], 201);
    }

    /**
     * GET /api/notes/{id}
     */
    public function show(int $id): JsonResponse
    {
        $note = Note::find($id);

        if (! $note) {
            return response()->json([
                'message' => 'Esta nota ya no existe.',
            ], 404);
        }

        return response()->json([
            'note' => new NoteResource($note),
        ], 200);
    }

    /**
     * PUT /api/notes/{id}
     */
    public function update(UpdateNoteRequest $request, int $id): JsonResponse
    {
        $note = Note::find($id);

        if (! $note) {
            return response()->json([
                'message' => 'Esta nota ya no existe.',
            ], 404);
        }

        try {
            $note = $this->notes->update($request->user(), $note, $request->validated());
        } catch (OptimisticLockException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'current' => new NoteResource($e->currentServerState),
            ], 409);
        }

        return response()->json([
            'note' => new NoteResource($note),
        ], 200);
    }

    /**
     * PATCH /api/notes/{id}/position
     */
    public function updatePosition(UpdateNotePositionRequest $request, int $id): Response
    {
        $note = Note::find($id);

        if (! $note) {
            return response()->json([
                'message' => 'Esta nota ya no existe.',
            ], 404);
        }

        $this->notes->updatePosition(
            $request->user(),
            $note,
            (float) $request->validated()['position_x'],
            (float) $request->validated()['position_y'],
        );

        return response()->noContent(); // 204
    }

    /**
     * DELETE /api/notes/{id}
     */
    public function destroy(int $id): Response
    {
        $note = Note::find($id);

        if (! $note) {
            return response()->json([
                'message' => 'Esta nota ya no existe.',
            ], 404);
        }

        $this->notes->delete(request()->user(), $note);

        return response()->noContent(); // 204
    }
}
