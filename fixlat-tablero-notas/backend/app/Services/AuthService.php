<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /**
     * Attempt login. Returns the user and a freshly-issued Sanctum Bearer token.
     *
     * Anti-enumeration (HU-01 §A7): the public-facing error message is
     * IDENTICAL for "email not found" and "wrong password". The internal
     * log distinguishes them for diagnostics, but the client never sees
     * which one occurred.
     */
    public function login(array $data): array
    {
        $user = User::where('email', $data['email'])->first();

        // A) Email not found
        if (! $user) {
            Log::info('auth.login.failed.email_not_found', [
                'ip' => request()->ip(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Las credenciales de acceso son incorrectas.'],
            ]);
        }

        // B) Wrong password
        if (! Hash::check($data['password'], $user->password)) {
            Log::info('auth.login.failed.bad_password', [
                'user_id' => $user->id,
                'ip' => request()->ip(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Las credenciales de acceso son incorrectas.'],
            ]);
        }

        // C) Inactive user
        if (! $user->is_active) {
            Log::info('auth.login.failed.inactive', [
                'user_id' => $user->id,
                'ip' => request()->ip(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Tu cuenta está inactiva. Contacta al administrador del sistema.'],
            ]);
        }

        // D) Success
        $token = $user->createToken('auth_token')->plainTextToken;

        Log::info('auth.login.ok', [
            'user_id' => $user->id,
            'ip' => request()->ip(),
        ]);

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    /**
     * Logout: revoke the current access token (server-side invalidation).
     */
    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();

        Log::info('auth.logout.ok', [
            'user_id' => $user->id,
            'ip' => request()->ip(),
        ]);
    }
}
