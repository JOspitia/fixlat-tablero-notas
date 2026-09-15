# Etapa 1: Construir
FROM php:8.2-cli-alpine

# Instalar dependencias del sistema y extensiones de PHP
RUN apk add --no-cache \
    postgresql-dev \
    dos2unix \
    bash

RUN docker-php-ext-install pdo pdo_pgsql bcmath pcntl

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copiar el resto de archivos del proyecto
COPY . .

# Instalar dependencias de PHP
RUN composer install --no-interaction --optimize-autoloader

# Asegurar directorios de almacenamiento y permisos para Laravel
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chmod -R 777 storage bootstrap/cache

# Convertir el script de entrada a formato Linux y darle permisos de ejecución
RUN dos2unix entrypoint.sh && chmod +x entrypoint.sh

# Exponer el puerto en el que escucha el servidor de Laravel
EXPOSE 8000

# Comando de inicio
ENTRYPOINT ["/app/entrypoint.sh"]