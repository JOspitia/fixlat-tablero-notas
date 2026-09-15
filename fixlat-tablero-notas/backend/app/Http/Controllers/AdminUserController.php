<?php

namespace App\Http\Controllers;

use App\Exceptions\LastAdminInvariantException;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AdminUserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AdminUserController extends Controller
{
    public function __construct(private readonly AdminUserService $users)
    {
    }

    /**
     * GET /api/admin/users — list all users, ordered admins-first then by created_at desc.
     */
    public function index(): JsonResponse
    {
        $users = User::orderByRaw("CASE WHEN role = 'admin' THEN 0 ELSE 1 END")
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'users' => UserResource::collection($users),
        ], 200);
    }

    /**
     * GET /api/admin/users/{id}
     */
    public function show(int $id): JsonResponse
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'message' => 'Este usuario ya no existe.',
            ], 404);
        }

        return response()->json([
            'user' => new UserResource($user),
        ], 200);
    }

    /**
     * POST /api/admin/users
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->users->create($request->user(), $request->validated());

        return response()->json([
            'user' => new UserResource($user),
        ], 201);
    }

    /**
     * PUT /api/admin/users/{id}
     */
    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'message' => 'Este usuario ya no existe.',
            ], 404);
        }

        try {
            $user = $this->users->update($request->user(), $user, $request->validated());
        } catch (LastAdminInvariantException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'user' => new UserResource($user),
        ], 200);
    }

    /**
     * PATCH /api/admin/users/{id}/active
     */
    public function toggleActive(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $user = User::find($id);

        if (! $user) {
            return response()->json([
                'message' => 'Este usuario ya no existe.',
            ], 404);
        }

        try {
            $user = $this->users->toggleActive(
                $request->user(),
                $user,
                (bool) $request->validated()['is_active'],
            );
        } catch (LastAdminInvariantException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'user' => new UserResource($user),
        ], 200);
    }
}
