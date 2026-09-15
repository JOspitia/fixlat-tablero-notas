#!/bin/sh
set -e

# Generar APP_KEY sólo si no está configurada
if [ -z "$APP_KEY" ]; then
    php artisan key:generate --force
fi

# Limpiar y preparar cachés
php artisan config:clear
php artisan route:clear

# Ejecutar migraciones sin destruir datos existentes (requisito de persistencia)
php artisan migrate --force

# Asegurar la existencia de las cuentas demo preconfiguradas
php artisan db:seed --force

# Iniciar servidor local
exec php artisan serve --host=0.0.0.0 --port=8000