<?php

namespace App\Http\Requests;

use App\Models\Note;
use Illuminate\Foundation\Http\FormRequest;

class UpdateNoteRequest extends FormRequest
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
     * Per HU-02 §3 B5 + AC13/AC14: full content update with optimistic
     * locking via `updated_at`.
     *
     * Per HU-05 §4 B6 + AC23-AC34: the three visual-enrichment fields are
     * `sometimes` (HU-02 §B7 keeps untouched fields via array_intersect_key in
     * the service layer) and validated when present against their allow-lists.
     * `font_family` also carries a `not_regex` rule that rejects any `<` or `>`
     * characters to neutralize HTML/JS payloads at the request boundary
     * (AC30).
     *
     * Note: the optimistic-lock `updated_at` validation lives here on the
     * incoming request payload, while the actual lock comparison is enforced
     * in `NoteService::update` (which throws `OptimisticLockException` on
     * mismatch → 409). Do NOT move that check into this FormRequest — it would
     * require loading the server-side note before validation runs and would
     * couple the Request to the Model for no benefit.
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'text' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'required', 'string', 'in:'.implode(',', Note::ALLOWED_STATUSES)],
            'position_x' => ['sometimes', 'numeric'],
            'position_y' => ['sometimes', 'numeric'],
            'shape' => ['sometimes', 'string', 'in:'.implode(',', Note::ALLOWED_SHAPES)],
            'font_family' => [
                'sometimes',
                'string',
                'max:60',
                'in:'.implode(',', Note::ALLOWED_FONT_FAMILIES),
                'not_regex:/[<>]/',
            ],
            'text_align' => ['sometimes', 'string', 'in:'.implode(',', Note::ALLOWED_TEXT_ALIGNS)],
            'updated_at' => ['required', 'date'],
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
            'updated_at.required' => 'El campo updated_at es requerido para validar concurrencia',
        ];
    }
}
