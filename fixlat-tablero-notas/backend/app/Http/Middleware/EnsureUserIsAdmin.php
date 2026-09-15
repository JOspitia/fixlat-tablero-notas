<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Per HU-04: only `admin` role can access admin endpoints.
 * Must run AFTER `auth:sanctum` so `$request->user()` is populated.
 */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->role !== 'admin') {
            return response()->json([
                'message' => 'No tienes permisos para acceder a este módulo.',
            ], 403);
        }

        return $next($request);
    }
}
