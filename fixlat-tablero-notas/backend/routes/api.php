<?php

use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\NoteController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    // Public: login with rate limiting (5/min/IP)
    Route::post('/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('auth.login');

    // Protected: requires Sanctum Bearer token + active user
    Route::middleware(['auth:sanctum', 'auth.active'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('/me', [AuthController::class, 'me'])->name('auth.me');
    });
});

// Notes (HU-02 tablero-notas) — all protected by Sanctum + active user
Route::middleware(['auth:sanctum', 'auth.active'])->prefix('notes')->group(function () {
    Route::get('/', [NoteController::class, 'index'])->name('notes.index');
    Route::post('/', [NoteController::class, 'store'])->name('notes.store');
    Route::get('/{id}', [NoteController::class, 'show'])->whereNumber('id')->name('notes.show');
    Route::put('/{id}', [NoteController::class, 'update'])->whereNumber('id')->name('notes.update');
    Route::patch('/{id}/position', [NoteController::class, 'updatePosition'])->whereNumber('id')->name('notes.updatePosition');
    Route::delete('/{id}', [NoteController::class, 'destroy'])->whereNumber('id')->name('notes.destroy');
});

// Dashboard metrics (HU-03) — protected by Sanctum + active user
Route::middleware(['auth:sanctum', 'auth.active'])->get('/metrics', [MetricsController::class, 'show'])->name('metrics.show');

// Admin users (HU-04) — protected by Sanctum + active user + admin role
Route::middleware(['auth:sanctum', 'auth.active', 'auth.admin'])->prefix('admin/users')->group(function () {
    Route::get('/', [AdminUserController::class, 'index'])->name('admin.users.index');
    Route::get('/{id}', [AdminUserController::class, 'show'])->whereNumber('id')->name('admin.users.show');
    Route::post('/', [AdminUserController::class, 'store'])->name('admin.users.store');
    Route::put('/{id}', [AdminUserController::class, 'update'])->whereNumber('id')->name('admin.users.update');
    Route::patch('/{id}/active', [AdminUserController::class, 'toggleActive'])->whereNumber('id')->name('admin.users.toggleActive');
});
