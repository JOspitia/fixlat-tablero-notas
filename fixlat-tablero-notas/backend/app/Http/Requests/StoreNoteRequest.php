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
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'text' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', 'string', 'in:' . implode(',', Note::ALLOWED_STATUSES)],
            'position_x' => ['required', 'numeric'],
            'position_y' => ['required', 'numeric'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'El título es obligatorio',
            'title.max' => 'El título no puede tener más de 120 caracteres',
            'text.max' => 'El texto no puede tener más de 2000 caracteres',
            'status.in' => 'El estado debe ser Pendiente, En curso o Hecho',
        ];
    }
}
