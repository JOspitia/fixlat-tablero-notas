<?php

namespace App\Exceptions;

use Exception;

/**
 * Thrown when optimistic locking fails on a note update (HTTP 409).
 * Carries the current server state so the client can react.
 */
class OptimisticLockException extends Exception
{
    public function __construct(public readonly mixed $currentServerState, string $message)
    {
        parent::__construct($message);
    }
}
