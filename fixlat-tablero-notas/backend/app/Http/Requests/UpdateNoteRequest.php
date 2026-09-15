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
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'text' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'required', 'string', 'in:' . implode(',', Note::ALLOWED_STATUSES)],
            'position_x' => ['sometimes', 'numeric'],
            'position_y' => ['sometimes', 'numeric'],
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
            'updated_at.required' => 'El campo updated_at es requerido para validar concurrencia',
        ];
    }
}
