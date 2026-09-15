<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Handle an incoming request.
     *
     * Validates that the authenticated user has `is_active=true`. If false,
     * returns 403 with the standard inactivation message.
     *
     * On successful authenticated requests, refreshes `users.last_activity_at`
     * for diagnostic/observability purposes.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            // Should never happen if `auth:sanctum` ran before this middleware.
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->is_active) {
            Log::info('auth.session.rejected.inactive', [
                'user_id' => $user->id,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'Tu cuenta está inactiva. Contacta al administrador del sistema.',
            ], 403);
        }

        // Refresh last_activity_at (single UPDATE, fire-and-forget diagnostic).
        DB::table('users')
            ->where('id', $user->id)
            ->update(['last_activity_at' => now()]);

        return $next($request);
    }
}
