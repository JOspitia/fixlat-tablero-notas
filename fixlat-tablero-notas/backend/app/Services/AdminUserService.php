<?php

namespace App\Services;

use App\Exceptions\LastAdminInvariantException;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class AdminUserService
{
    /**
     * Count active admins excluding the given user id.
     * Used by the invariant check.
     */
    private function countActiveAdminsExcluding(?int $excludeId): int
    {
        $query = User::where('role', 'admin')->where('is_active', true);
        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->count();
    }

    /**
     * Throws LastAdminInvariantException if the proposed changes would leave 0 active admins.
     *
     * Logic: simulate the final state of $target after $changes are applied,
     * then count active admins (target + others) in that final state.
     * If 0 → reject.
     */
    private function assertInvariantNotViolated(User $target, array $changes): void
    {
        // Determine target's final state.
        $targetFinalRole = array_key_exists('role', $changes) ? $changes['role'] : $target->role;
        $targetFinalActive = array_key_exists('is_active', $changes) ? (bool) $changes['is_active'] : (bool) $target->is_active;

        // If target is not currently active+admin, no constraint violation possible
        // (you can't deactivate someone who's already inactive, or demote a non-admin).
        if ($target->role !== 'admin' || ! $target->is_active) {
            return;
        }

        // Now check: after the change, is target still active+admin?
        if ($targetFinalRole === 'admin' && $targetFinalActive) {
            return; // target stays active+admin, no impact
        }

        // Target would no longer be active+admin. Count OTHER active admins.
        // (target is excluded from count since it will leave the active-admin set)
        $others = $this->countActiveAdminsExcluding($target->id);

        if ($others < 1) {
            throw new LastAdminInvariantException();
        }
    }

    /**
     * Create a new user (admin or regular).
     */
    public function create(User $actor, array $data): User
    {
        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower(trim($data['email'])),
            'role' => $data['role'],
            'password' => Hash::make($data['password']),
            'is_active' => $data['is_active'] ?? true,
        ]);

        Log::info('users.created', [
            'actor_user_id' => $actor->id,
            'target_user_id' => $user->id,
            'ip' => request()->ip(),
        ]);

        return $user;
    }

    /**
     * Update user fields. Enforces invariant.
     */
    public function update(User $actor, User $target, array $data): User
    {
        $this->assertInvariantNotViolated($target, $data);

        $old = $target->only(['name', 'email', 'role', 'is_active']);

        if (isset($data['email'])) {
            $data['email'] = strtolower(trim($data['email']));
        }

        $target->fill(array_intersect_key($data, array_flip(['name', 'email', 'role', 'is_active'])));
        $target->save();

        $changed = [];
        foreach ($old as $key => $before) {
            $after = $target->{$key};
            if ($before != $after) {
                $changed[] = ['field' => $key, 'old' => $before, 'new' => $after];
            }
        }

        Log::info('users.updated', [
            'actor_user_id' => $actor->id,
            'target_user_id' => $target->id,
            'fields_changed' => $changed,
            'ip' => request()->ip(),
        ]);

        return $target;
    }

    /**
     * Toggle is_active (activate/deactivate). Enforces invariant on deactivation.
     */
    public function toggleActive(User $actor, User $target, bool $isActive): User
    {
        $this->assertInvariantNotViolated($target, ['is_active' => $isActive]);

        $target->is_active = $isActive;
        $target->save();

        Log::info($isActive ? 'users.reactivated' : 'users.deactivated', [
            'actor_user_id' => $actor->id,
            'target_user_id' => $target->id,
            'ip' => request()->ip(),
        ]);

        return $target;
    }
}
