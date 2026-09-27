<?php

namespace App\Http\Requests;

use App\Models\Note;
use App\Models\NoteConnector;
use Illuminate\Foundation\Http\FormRequest;

class StoreNoteConnectorRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Per HU-02 §3 A6: all active authenticated users can create connectors
     * on any note (no ownership). The auth middleware guarantees an
     * authenticated user; the user-activity check (is_active=true) is the
     * route middleware's responsibility, not this FormRequest's.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Per HU-06 §3 B6 + AC:
     * - destination_note_id: required, exists in notes, distinct from source
     *   (the URL {note} param). `different:route_note` enforces A != B at the
     *   request boundary (defence in depth — the DB CHECK
     *   `note_connectors_no_self_check` is the source of truth, but failing
     *   early at the FormRequest gives a 422 instead of a 500 from a CHECK
     *   violation).
     * - style: sometimes, in the 6-value allow-list, default
     *   `NoteConnector::DEFAULT_STYLE` if omitted.
     */
    public function rules(): array
    {
        return [
            'destination_note_id' => [
                'required',
                'integer',
                'exists:notes,id',
                'different:route_note',
            ],
            'style' => [
                'sometimes',
                'string',
                'in:'.implode(',', NoteConnector::ALLOWED_STYLES),
            ],
        ];
    }

    /**
     * Spanish error messages. Mirror the neutral professional tone used by
     * StoreNoteRequest / UpdateNoteRequest.
     */
    public function messages(): array
    {
        return [
            'destination_note_id.required' => 'La nota de destino es obligatoria.',
            'destination_note_id.exists' => 'La nota de destino no existe.',
            'destination_note_id.different' => 'Una nota no puede tener un conector hacia sí misma.',
            'style.in' => 'El estilo debe ser uno de los 6 estilos canónicos del catálogo.',
        ];
    }

    /**
     * Inject the route param into the request data so the `different:`
     * validator can read it. Without this, `different:route_note` resolves
     * against `request('route_note')` which is null (Laravel doesn't
     * auto-merge route params into the validator's data bag for this rule).
     *
     * See https://laravel.com/docs/12.x/validation#comparing-fields and the
     * well-known gotcha that route params are NOT in `request()->all()`.
     */
    public function validationData(): array
    {
        return array_merge($this->all(), [
            'route_note' => $this->route('note'),
        ]);
    }
}
