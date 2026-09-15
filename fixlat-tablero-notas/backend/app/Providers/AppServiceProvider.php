<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rate limiter for the login endpoint (5 attempts/minute/IP).
        // HU-01 §3 A11: anti-bruteforce on POST /api/auth/login.
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // Force HTTPS scheme in production. Local/staging keep http:// for DX.
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
