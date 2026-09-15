<?php

namespace App\Services;

use App\Exceptions\MetricsUnavailableException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetricsService
{
    /**
     * Fetch dashboard metrics from the Lambda runner.
     *
     * Per HU-03 §3 B4-B9: HTTP client with 5s timeout, transform payload,
     * log latency, return 503 on Lambda failure.
     */
    public function fetch(): array
    {
        $url = env('LAMBDA_METRICS_URL', 'http://lambda_local:3001');
        $started = microtime(true);

        try {
            $response = Http::timeout(5)->acceptJson()->get($url);
        } catch (ConnectionException $e) {
            Log::error('metrics.fetch.connection_exception_detail', [
                'url' => $url,
                'message' => $e->getMessage(),
                'class' => get_class($e),
                'previous' => $e->getPrevious() ? get_class($e->getPrevious()) . ': ' . $e->getPrevious()->getMessage() : 'none',
            ]);
            $this->logFailure($started, 'connection_exception', $e->getMessage());
            throw new MetricsUnavailableException('Lambda no responde.');
        } catch (\Throwable $e) {
            Log::error('metrics.fetch.unexpected_exception', [
                'url' => $url,
                'class' => get_class($e),
                'message' => $e->getMessage(),
            ]);
            $this->logFailure($started, 'unexpected_exception', $e->getMessage());
            throw new MetricsUnavailableException('Lambda no responde.');
        }

        $durationMs = (int) ((microtime(true) - $started) * 1000);

        if (! $response->successful()) {
            $this->logFailure($started, 'http_' . $response->status(), $response->body());
            throw new MetricsUnavailableException('Lambda devolvió un error.');
        }

        $raw = $response->json();

        if (! is_array($raw) || ! isset($raw['total'], $raw['pendiente'], $raw['en_curso'], $raw['hecho'])) {
            $this->logFailure($started, 'invalid_format', $response->body());
            throw new MetricsUnavailableException('Lambda devolvió un formato inválido.');
        }

        Log::info('metrics.fetched', [
            'user_id' => auth()->id(),
            'duration_ms' => $durationMs,
            'ip' => request()->ip(),
        ]);

        return [
            'total' => (int) $raw['total'],
            'by_status' => [
                'Pendiente' => (int) $raw['pendiente'],
                'En curso' => (int) $raw['en_curso'],
                'Hecho' => (int) $raw['hecho'],
            ],
            'last_updated' => now()->toIso8601String(),
        ];
    }

    private function logFailure(float $started, string $reason, string $details): void
    {
        $durationMs = (int) ((microtime(true) - $started) * 1000);

        Log::warning('metrics.fetch.failed', [
            'user_id' => auth()->id(),
            'duration_ms' => $durationMs,
            'reason' => $reason,
            'ip' => request()->ip(),
            // Not logging details — could leak Lambda internals to logs.
        ]);
    }
}
