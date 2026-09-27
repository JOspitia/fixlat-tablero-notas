<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NoteResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Per HU-05 §4 B9 + AC10/AC11/AC86/AC98: the three visual-enrichment fields
     * (`shape`, `font_family`, `text_align`) are exposed as plain strings
     * alongside the existing payload — no extra IDs, no author metadata, no
     * nested objects. Defaults applied by the DB migration / model `$attributes`
     * flow through unchanged when a pre-migration row is read.
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'text' => $this->text,
            'status' => $this->status,
            'position_x' => (float) $this->position_x,
            'position_y' => (float) $this->position_y,
            'shape' => $this->shape,
            'font_family' => $this->font_family,
            'text_align' => $this->text_align,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
