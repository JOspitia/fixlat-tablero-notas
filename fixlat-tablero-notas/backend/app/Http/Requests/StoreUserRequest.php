<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Admin route already enforces auth.admin
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email:rfc', 'max:255', Rule::unique('users', 'email')],
            'role' => ['required', 'string', 'in:admin,user'],
            'password' => ['required', 'string', 'min:8', 'max:64'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio',
            'email.required' => 'El email es obligatorio',
            'email.email' => 'El email no es válido',
            'email.unique' => 'El email ya está registrado',
            'role.required' => 'El rol es obligatorio',
            'role.in' => 'El rol debe ser admin o user',
            'password.required' => 'El password es obligatorio',
            'password.min' => 'El password debe tener al menos 8 caracteres',
            'password.max' => 'El password no puede tener más de 64 caracteres',
        ];
    }
}
