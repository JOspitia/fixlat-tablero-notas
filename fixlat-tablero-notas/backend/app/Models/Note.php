<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Note model for HU-02 (tablero-notas).
 *
 * Per `documents/HU-02-tablero-notas.md`:
 * - No ownership: any active user can create/edit/move/delete any note.
 * - SoftDeletes: `$note->delete()` sets `deleted_at`; default queries exclude them.
 */
class Note extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'text',
        'status',
        'position_x',
        'position_y',
    ];

    /**
     * The attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'position_x' => 'float',
            'position_y' => 'float',
        ];
    }

    /**
     * Allowed status values (mirror DB CHECK constraint for in-PHP validation).
     */
    public const STATUS_PENDIENTE = 'Pendiente';
    public const STATUS_EN_CURSO = 'En curso';
    public const STATUS_HECHO = 'Hecho';

    public const ALLOWED_STATUSES = [
        self::STATUS_PENDIENTE,
        self::STATUS_EN_CURSO,
        self::STATUS_HECHO,
    ];
}
