<?php

namespace App\Http\Requests;

use App\Models\NoteConnector;
use Illuminate\Foundation\Http\FormRequest;

class UpdateNoteConnectorRequest extends FormRequest
{
    /**
     * Per HU-06: all active authenticated users can edit any connector
     * (no ownership). Auth middleware handles the active check.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules for PUT /api/note-connectors/{id}.
     *
     * Per HU-06 §3: only `style` is editable. `source_note_id` and
     * `destination_note_id` are immutable once a connector exists — to
     * change direction, delete and recreate (this matches the US
     * decision #2 where the connector is an A→B edge, not a symmetric
     * relationship that can be flipped in place).
     *
     * `style` is required because the only thing PUT does is change it.
     * `required` (not `sometimes`) here matches the wire semantics: PUT
     * without a style is a malformed request.
     */
    public function rules(): array
    {
        return [
            'style' => [
                'required',
                'string',
                'in:'.implode(',', NoteConnector::ALLOWED_STYLES),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'style.required' => 'El estilo es obligatorio.',
            'style.in' => 'El estilo debe ser uno de los 6 estilos canónicos del catálogo.',
        ];
    }
}
