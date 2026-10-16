# Portal de Equipo — Tablero de Notas y Métricas Serverless

![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange?logo=aws-lambda)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)

Aplicación web full-stack para gestión de usuarios, lienzo libre de notas adhesivas y visualización de métricas serverless.

---

## Tabla de Contenidos

1. [Stack Tecnológico](#stack-tecnológico)
2. [Démo Rápida](#démo-rápida)
3. [Cuentas de Acceso](#cuentas-de-acceso)
4. [Ejecución Local](#ejecución-local)
5. [Arquitectura AWS](#arquitectura-aws)
6. [Despliegue SAM](#despliegue-sam)
7. [Decisiones de Diseño](#decisiones-de-diseño)
8. [Estado de Funcionalidades](#estado-de-funcionalidades)

---

## Stack Tecnológico

| Componente | Tecnología | Puerto |
|------------|-------------|--------|
| **Backend API** | Laravel 12 (PHP 8.2) + Sanctum | `8000` |
| **Frontend SPA** | React 18 + Vite + Tailwind v4 + @dnd-kit | `3000` |
| **Lambda Metrics** | Node.js 20 + TypeScript | `3001` |
| **Base de Datos** | PostgreSQL 16 Alpine | `5432` |
| **Emulación AWS** | LocalStack 3 Community | `4566` |

**Arquitectura:** Desacoplada y contenedorizada (paridad local/cloud AWS).

---

## Démo Rápida

```bash
git clone https://github.com/JOspitia/fixlat-tablero-notas.git
cd fixlat-tablero-notas
docker compose up --build -d
# Abrir http://localhost:3000 → admin@test.com / admin123
```

> ⏱️ LocalStack tarda ~30-60s en estar listo. Verificar con: `docker compose logs -f localstack`

---

## Cuentas de Acceso

| Rol | Email | Contraseña |
|-----|-------|------------|
| **Admin** | `admin@test.com` | `admin123` |
| **Usuario** | `user@test.com` | `user123` |

Los usuarios creados en la app pueden iniciar sesión inmediatamente. Solo usuarios **Activos** tienen acceso; el sistema garantiza al menos un admin activo.

---

## Ejecución Local

### Requisitos
- Docker Desktop 20.10+
- Git

### Puertos y Servicios

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API Backend | http://localhost:8000 |
| Lambda (dev) | http://localhost:3001 |
| LocalStack | http://localhost:4566 |
| PostgreSQL | localhost:5432 |

### Persistencia
- Datos en volumen Docker `postgres_data`
- `docker compose down` conserva datos
- `docker compose down -v` borra todo

---

## Arquitectura AWS

```
Usuarios
   │
   ▼
[CloudFront] ──► [S3: React SPA Build]
   │
   ▼
[EC2: Docker] ──► [Laravel API :8000]
   │                      │
   │               [PostgreSQL RDS]
   │
   ▼
[API Gateway] ──► [Lambda: DashboardMetricsFunction]
                          │
                   [PostgreSQL RDS]
```

---

## Despliegue SAM

```bash
cd lambda
sam build
sam deploy --guided

# Parámetros:
#   Stack Name:  fixlat-dashboard-metrics
#   DBHost:      <IP RDS/EC2>
#   DBUser:      fixlat_user
#   DBPassword:  <tu contraseña>
#   DBName:      fixlat_db

# Eliminar recursos:
sam delete --stack-name fixlat-dashboard-metrics
```

---

## Decisiones de Diseño

- **TypeScript en Lambda:** Tipado con `@types/aws-lambda` y `@types/pg`
- **LocalStack Community:** Emulación Lambda/Gateway sin costo AWS
- **Runner HTTP liviano:** Puerto `3001` para iteración rápida sin LocalStack
- **Migrate + updateOrCreate:** Nunca borra datos existentes en reinicios
- **CORS en Lambda:** `Access-Control-Allow-Origin: *` en todas las respuestas
- **Clean UI / Flat Design:** Colores sólidos por estado (amarillo→Pendiente, azul→En curso, verde→Hecho), sin transparencias

---

## Estado de Funcionalidades

| HU | Descripción | Backend | Frontend |
|----|-------------|---------|----------|
| HU-01 | Auth (Sanctum Bearer, rate limit, anti-enumeración) | ✅ | ✅ |
| HU-02 | Tablero de notas (CRUD, soft deletes, drag&drop @dnd-kit) | ✅ | ✅ |
| HU-03 | Dashboard métricas (proxy → Lambda, cards, retry) | ✅ | ✅ |
| HU-04 | Admin usuarios (CRUD, activar/desactivar, invariante admin) | ✅ | ✅ |

### Limitaciones Conocidas
- Local: CloudFront y EC2 no emulados (Nginx + `php artisan serve` en su lugar)
- CORS pre-flight OPTIONS: mitigado con shim en `public/index.php`
- Login usa `application/x-www-form-urlencoded` por compatibilidad

---

**Repo:** https://github.com/JOspitia/fixlat-tablero-notas.git
