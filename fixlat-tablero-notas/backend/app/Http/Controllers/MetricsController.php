<?php

namespace App\Http\Controllers;

use App\Exceptions\MetricsUnavailableException;
use App\Services\MetricsService;
use Illuminate\Http\JsonResponse;

class MetricsController extends Controller
{
    public function __construct(private readonly MetricsService $metrics)
    {
    }

    /**
     * GET /api/metrics
     */
    public function show(): JsonResponse
    {
        try {
            $payload = $this->metrics->fetch();
        } catch (MetricsUnavailableException $e) {
            return response()->json([
                'message' => 'No se pudieron cargar las métricas.',
            ], 503);
        }

        return response()->json($payload, 200);
    }
}
