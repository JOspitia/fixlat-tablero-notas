<?php

namespace App\Http\Requests;

use App\Models\Note;
use Illuminate\Foundation\Http\FormRequest;

class StoreNoteRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * Per HU-02 §3 B5: title required max:120, text nullable max:2000,
     * status enum, position_x/y numeric.
     *
     * Per HU-05 §4 B6 + AC14-AC22: the three visual-enrichment fields are
     * `sometimes` (not required on creation — DB defaults fill them in) but
     * validated when present against their allow-lists. `font_family` also
     * carries a `not_regex` rule that rejects any `<` or `>` characters to
     * neutralize HTML/JS payloads at the request boundary (AC30).
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'text' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', 'string', 'in:'.implode(',', Note::ALLOWED_STATUSES)],
            'position_x' => ['required', 'numeric'],
            'position_y' => ['required', 'numeric'],
            'shape' => ['sometimes', 'string', 'in:'.implode(',', Note::ALLOWED_SHAPES)],
            'font_family' => [
                'sometimes',
                'string',
                'max:60',
                'in:'.implode(',', Note::ALLOWED_FONT_FAMILIES),
                'not_regex:/[<>]/',
            ],
            'text_align' => ['sometimes', 'string', 'in:'.implode(',', Note::ALLOWED_TEXT_ALIGNS)],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'El título es obligatorio',
            'title.max' => 'El título no puede tener más de 120 caracteres',
            'text.max' => 'El texto no puede tener más de 2000 caracteres',
            'status.in' => 'El estado debe ser Pendiente, En curso o Hecho',
            'shape.in' => 'La forma debe ser una de las formas válidas del catálogo.',
            'font_family.in' => 'La familia tipográfica debe ser una de las fuentes permitidas.',
            'font_family.not_regex' => 'La familia tipográfica no puede contener caracteres HTML.',
            'text_align.in' => 'La alineación debe ser left, center, right o justify.',
        ];
    }
}
