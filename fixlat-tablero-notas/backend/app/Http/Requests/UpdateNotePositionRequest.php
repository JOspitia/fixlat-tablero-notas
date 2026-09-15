<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Used by PATCH /api/notes/{id}/position.
 * Per HU-02 §B5: position_x/y numeric.
 */
class UpdateNotePositionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'position_x' => ['required', 'numeric'],
            'position_y' => ['required', 'numeric'],
        ];
    }
}
