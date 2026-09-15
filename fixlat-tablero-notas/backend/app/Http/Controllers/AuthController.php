<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AuthController extends Controller
{
    /**
     * Inject the AuthService.
     */
    public function __construct(private readonly AuthService $auth)
    {
    }

    /**
     * POST /api/auth/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->auth->login($request->validated());

        return response()->json([
            'user' => new UserResource($result['user']),
            'token' => $result['token'],
        ], 200);
    }

    /**
     * POST /api/auth/logout
     */
    public function logout(Request $request): Response
    {
        $this->auth->logout($request->user());

        return response()->noContent(); // 204
    }

    /**
     * GET /api/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => new UserResource($request->user()),
        ], 200);
    }
}
