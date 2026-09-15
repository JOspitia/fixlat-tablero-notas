<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// --- CORS shim (runs BEFORE Laravel bootstrap to ensure headers are emitted
// before any other middleware can flush them) ---
$allowedOrigins = array_values(array_unique(array_filter([
    $_SERVER['FRONTEND_ORIGIN'] ?? getenv('FRONTEND_ORIGIN') ?: null,
    $_SERVER['FRONTEND_ORIGIN_PROD'] ?? getenv('FRONTEND_ORIGIN_PROD') ?: null,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
])));

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
error_log('[cors-shim] origin=' . $origin . ' allowed=' . json_encode($allowedOrigins) . ' method=' . ($_SERVER['REQUEST_METHOD'] ?? ''));

if ($allowedOrigins && in_array($origin, $allowedOrigins, true)) {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept, X-Requested-With');
        error_log('[cors-shim] short-circuit OPTIONS');
        http_response_code(204);
        exit;
    }
}

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
