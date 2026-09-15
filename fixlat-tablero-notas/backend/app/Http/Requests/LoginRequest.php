<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
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
     * Per HU-01 §AC19-AC23 + A3-A5: email RFC + unique case-insensitive
     * lookup, password 8-64 chars (avoids silent bcrypt truncation at 72 bytes).
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:64'],
        ];
    }

    /**
     * Normalize email before validation: trim whitespace + lowercase.
     * A1 + A5 from HU-01 §3.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('email') && is_string($this->input('email'))) {
            $this->merge([
                'email' => strtolower(trim($this->input('email'))),
            ]);
        }
    }

    /**
     * Custom error messages in Spanish (consistent with the rest of the API).
     */
    public function messages(): array
    {
        return [
            'email.required' => 'El email es obligatorio',
            'email.email' => 'El email no es válido',
            'email.max' => 'El email no puede tener más de 255 caracteres',
            'password.required' => 'El password es obligatorio',
            'password.string' => 'El password debe ser una cadena de texto',
            'password.min' => 'El password debe tener al menos 8 caracteres',
            'password.max' => 'El password no puede tener más de 64 caracteres',
        ];
    }
}
