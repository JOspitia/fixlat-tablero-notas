<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when an action would leave 0 active admins in the system (HU-04).
 * Single literal message per project decision: anti-enumeration pattern applied
 * here too — same response regardless of which specific action triggered the violation.
 */
class LastAdminInvariantException extends RuntimeException
{
    public function __construct(string $message = 'No se puede desactivar al último administrador activo.')
    {
        parent::__construct($message);
    }
}
