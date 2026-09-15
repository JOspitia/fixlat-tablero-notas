# Portal de Equipo con Tablero de Notas y Métricas Serverless

Aplicación web full-stack para la gestión de usuarios, lienzo libre de notas adhesivas (post-its) y visualización de métricas consolidadas del sistema.

---

## Stack Tecnológico y Arquitectura

El proyecto sigue una arquitectura desacoplada y contenedorizada para garantizar paridad entre el entorno local y el despliegue en la nube AWS:

* **Backend (API REST):** Laravel 12 (PHP 8.2) con extensión `pdo_pgsql`. Responsable de la autenticación Sanctum, gestión de usuarios (roles Admin/Usuario) y CRUD del tablero de notas.
* **Frontend (SPA):** React 18 + Vite + Tailwind CSS v4. Utiliza `@dnd-kit` para la interacción de arrastrar y soltar (drag-and-drop) libre de post-its con persistencia de coordenadas (X, Y). Servido mediante Nginx optimizado para rutas SPA (`try_files $uri $uri/ /index.html`).
* **Métricas (Función Serverless):** Node.js 20 + TypeScript (AWS Lambda) con el driver nativo `pg`. Calcula y entrega el total de notas y su desglose por estado (`Pendiente`, `En curso`, `Hecho`).
* **Base de Datos:** PostgreSQL 16 Alpine con almacenamiento persistente en volumen Docker.
* **Orquestación y Emulación Local de AWS:** Docker Compose con **LocalStack 3** (puerto `4566`) para emular Lambda y API Gateway localmente sin costo ni cuenta AWS, y un runner HTTP liviano en el puerto `3001` para desarrollo.
* **IaC (Infraestructura como Código):** AWS SAM (`lambda/template.yaml`) para el empaquetado y despliegue serverless en AWS.

---

## Cuentas de Demostración y Acceso

### Cuentas Preconfiguradas (Seeders)

El sistema se inicializa automáticamente con los siguientes usuarios de prueba al levantar los contenedores:

| Rol | Correo Electrónico | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@test.com` | `admin123` | Tablero, Dashboard y Gestión de usuarios |
| **Usuario** | `user@test.com` | `user123` | Acceso a Tablero y Dashboard |

### Inicio de Sesión de Usuarios Creados desde la Aplicación

1. Un **Administrador** autenticado puede crear nuevos usuarios desde el módulo de *Administración de Usuarios*, definiendo su nombre, correo electrónico, rol (**Administrador** o **Usuario**) y una contraseña inicial.
2. El nuevo usuario puede iniciar sesión inmediatamente en `http://localhost:3000` con el correo y contraseña asignados.
3. **Condición de acceso:** Solo los usuarios con estado **Activo** pueden iniciar sesión. Si un administrador desactiva un usuario, su sesión se invalida y se bloquea el acceso.
4. **Regla de integridad:** El sistema garantiza que siempre exista al menos un administrador activo; no es posible desactivar al último administrador.

---

## Instrucciones de Ejecución Local

### Requisitos Previos
* Docker Desktop instalado y corriendo (versión 20.10+).
* Git.

### 1. Clonar el repositorio y levantar servicios

```bash
git clone https://github.com/JOspitia/fixlat-tablero-notas.git
cd fixlat-tablero-notas

# Construir imágenes y levantar todos los contenedores en segundo plano
docker compose up --build -d
```

> **Primera ejecución:** LocalStack tardará entre 30 y 60 segundos en estar listo.
> Puedes monitorear su estado con: `docker compose logs -f localstack`
> Cuando aparezca `Ready.` en los logs, todos los servicios están operativos.

### 2. Acceder a la aplicación

Abre tu navegador en: **`http://localhost:3000`**

Inicia sesión con cualquiera de las cuentas de demostración listadas arriba.

### 3. Puertos y Servicios Disponibles

| Servicio | URL | Descripción |
| :--- | :--- | :--- |
| **Frontend** | `http://localhost:3000` | React SPA servida por Nginx |
| **API Backend** | `http://localhost:8000` | Laravel REST API |
| **Lambda (dev)** | `http://localhost:3001` | Runner HTTP local de métricas |
| **LocalStack** | `http://localhost:4566` | Emulador de AWS (Lambda + API GW) |
| **PostgreSQL** | `localhost:5432` | Base de datos |

### 4. Mecanismo de Persistencia y Reinicio

* **Persistencia:** Todos los datos (notas, usuarios, posiciones) se almacenan en el volumen Docker nombrado `postgres_data`.
* **Seguridad en reinicios:** El script `backend/entrypoint.sh` ejecuta `php artisan migrate --force` seguido de `php artisan db:seed --force`. El seeder usa `updateOrCreate`, por lo que nunca borra datos existentes (notas, posiciones, usuarios creados en la app) y solo garantiza la existencia de las cuentas demo.
* **Para conservar los datos al detener:** `docker compose down` conserva el volumen. Para borrar todo: `docker compose down -v`.

### 5. Instrucciones de Uso Básico

1. **Login:** Acceder a `http://localhost:3000` e iniciar sesión.
2. **Tablero:** Crear post-its con título, texto y estado. Arrastrarlos libremente por el lienzo. Al soltar, su posición se guarda automáticamente.
3. **Dashboard:** Ver el conteo total de notas y distribución por estado, calculado por la función Lambda.
4. **Usuarios (solo Admin):** Crear, editar, activar/desactivar usuarios desde el módulo de administración.

---

## Arquitectura y Despliegue en AWS (IaC)

### Diagrama de Componentes

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

### Componentes de Nube

1. **EC2:** Contenedor Docker con la API REST de Laravel (mismo Dockerfile del repositorio).
2. **Lambda + API Gateway:** Función TypeScript/Node.js para el cálculo y entrega de métricas del dashboard.
3. **S3 + CloudFront:** Almacenamiento y distribución global del build estático del frontend React.

### Despliegue mediante AWS SAM CLI

```bash
# Instalar AWS CLI y SAM CLI previamente
cd lambda

# 1. Compilar TypeScript y empaquetar la función
sam build

# 2. Desplegar de forma guiada (configura región, nombre del stack, etc.)
sam deploy --guided

# Parámetros requeridos:
#   Stack Name:        fixlat-dashboard-metrics
#   AWS Region:        us-east-1 (o la región deseada)
#   DBHost:            <IP o DNS de tu RDS/EC2 PostgreSQL>
#   DBUser:            fixlat_user
#   DBPassword:        <tu contraseña>
#   DBName:            fixlat_db
```

### Comandos de Retirada (Teardown)

Para eliminar todos los recursos creados en AWS y evitar costos:

```bash
sam delete --stack-name fixlat-dashboard-metrics
```

---

## Decisiones de Diseño

* **Lambda en TypeScript:** La función de métricas se migró a TypeScript con tipos oficiales de `@types/aws-lambda` y `@types/pg` para mayor robustez, tipado explícito y mejor mantenibilidad.
* **LocalStack Community (sin costo):** Se usa `localstack/localstack:3` (Community Edition) para emular Lambda y API Gateway localmente sin requerir cuenta AWS ni suscripción de pago.
* **Emulador liviano paralelo:** El servicio `lambda_local` (puerto `3001`) actúa como runner HTTP directo durante el desarrollo, sin depender de LocalStack para iteración rápida.
* **Persistencia garantizada:** El uso de `migrate --force` + `updateOrCreate` en el seeder evita destrucción de datos al reiniciar los contenedores.
* **CORS en Lambda:** Todas las respuestas (éxito y error) incluyen `Access-Control-Allow-Origin: *` para permitir peticiones desde el frontend.
* **Manejo de Roles:** La restricción de conservar al menos un administrador activo se valida en el backend y en la interfaz.

---

## Tiempo Empleado y Limitaciones Conocidas

* **Tiempo empleado:** ~1h 30min en configuración inicial de estructura del proyecto (Docker, Laravel, React, TypeScript Lambda, LocalStack, seeders, migraciones y documentación base).
* **Pendientes:** Desarrollo de las funcionalidades principales de la aplicación (autenticación, tablero de notas, dashboard, administración de usuarios).
* **Limitaciones conocidas:** En el entorno local, CloudFront y EC2 no se emulan; el frontend se sirve mediante Nginx en contenedor y el backend mediante `php artisan serve` en contenedor. La función Lambda se emula con LocalStack Community y un runner HTTP de desarrollo.