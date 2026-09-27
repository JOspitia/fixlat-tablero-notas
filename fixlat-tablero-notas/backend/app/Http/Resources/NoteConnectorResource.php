<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NoteConnectorResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Per HU-06 §6.6 + AC conventions:
     * - Single-resource responses wrap this as `{connector: {...}}`.
     * - Collection responses wrap as `{connectors: [...]}`.
     *
     * The exposed fields are exactly the columns of `note_connectors` (minus
     * `deleted_at` — soft-deleted rows are never returned, so clients don't
     * need to distinguish "deleted" from "active"). No extra IDs, no metadata,
     * no nested note objects (the frontend already has the notes payload from
     * `GET /api/notes`; denormalising them here would be redundant and risk
     * stale positions).
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'source_note_id' => $this->source_note_id,
            'destination_note_id' => $this->destination_note_id,
            'style' => $this->style,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
