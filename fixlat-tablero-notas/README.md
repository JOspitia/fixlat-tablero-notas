# Portal de Equipo con Tablero de Notas y Métricas Serverless

Aplicación web full-stack para la gestión de usuarios, lienzo libre de notas adhesivas (post-its) y visualización de métricas consolidadas del sistema.

---

## Stack Tecnológico y Arquitectura

El proyecto sigue una arquitectura desacoplada y contenedorizada para garantizar paridad entre el entorno local y el despliegue en la nube AWS:

* **Backend (API REST):** Laravel 11 (PHP 8.2) con extensión `pdo_pgsql`. Responsable de la autenticación JWT/Sanctum, gestión de usuarios (roles Admin/Usuario) y CRUD del tablero de notas.
* **Frontend (SPA):** React 18 + Vite + Tailwind CSS v4. Utiliza `@dnd-kit` para la interacción de arrastrar y soltar (drag-and-drop) libre de post-its con persistencia de coordenadas $(X, Y)$. Servido mediante Nginx optimizado para rutas SPA (`try_files $uri $uri/ /index.html`).
* **Métricas (Función Serverless):** Node.js 20 (AWS Lambda) con el driver nativo `pg`. Calcula y entrega el total de notas y su desglose por estado (`Pendiente`, `En curso`, `Hecho`).
* **Base de Datos:** PostgreSQL 16 Alpine con almacenamiento persistente en volumen Docker.
* **Orquestación Local:** Docker Compose con emulador autónomo para la función Lambda en el puerto `3001`.
* **IaC (Infraestructura como Código):** AWS SAM (`template.yaml`) para el empaquetado y despliegue de los recursos serverless.

---

## Cuentas de Demostración y Acceso

### Cuentas Preconfiguradas (Seeders)

El sistema se inicializa con los siguientes usuarios de prueba preconfigurados:

| Rol | Correo Electrónico | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@test.com` | `admin123` | Tablero, Dashboard y Gestión de usuarios |
| **Usuario** | `user@test.com` | `user123` | Acceso a Tablero y Dashboard |

### Inicio de Sesión de Usuarios Creados desde la Aplicación

1. Un **Administrador** autenticado puede crear nuevos usuarios desde el módulo de *Administración de Usuarios*, definiendo su nombre, correo electrónico, rol (**Administrador** o **Usuario**) y una contraseña inicial.
2. El nuevo usuario podrá iniciar sesión inmediatamente en la pantalla de login (`http://localhost:3000`) utilizando su correo y la contraseña asignada.
3. **Condición de acceso:** Únicamente los usuarios con estado **Activo** pueden iniciar sesión o continuar operando dentro de la aplicación. Si un usuario es desactivado por un administrador, su sesión se invalidará y se bloqueará su acceso.
4. **Regla de integridad:** El sistema garantiza y restringe que siempre exista al menos un administrador activo en el sistema.

---

## Instrucciones de Ejecución Local

### Requisitos Previos
* Docker Desktop instalado y corriendo (versión 20.10+).
* Git.

### 1. Clonar el repositorio y levantar servicios
```bash
git clone https://github.com/JOspitia/fixlat-tablero-notas.git
cd fixlat-tablero-notas

# Construir y levantar los contenedores en segundo plano
docker compose up --build -d
```

### 2. Puertos y Servicios Disponibles

* **Frontend (React/Nginx):** `http://localhost:3000`
* **API Backend (Laravel):** `http://localhost:8000`
* **Lambda Métricas (Emulador Local):** `http://localhost:3001`
* **Base de Datos (PostgreSQL):** `localhost:5432`

### 3. Mecanismo de Persistencia y Reinicio

* **Persistencia:** Todos los datos de la base de datos se almacenan en el volumen de Docker nombrado `postgres_data`.
* **Seguridad en Reinicios:** El script `backend/entrypoint.sh` ejecuta `php artisan migrate --force` sin flags destructivos (`migrate:fresh`), garantizando que las notas, estados, coordenadas $(X, Y)$ y usuarios creados se conserven intactos al detener (`docker compose down`), reiniciar o reiniciar la máquina.

---

## Arquitectura y Despliegue en AWS (IaC)

### Componentes de Nube

1. **EC2:** Ejecución de la API REST de Laravel dentro del contenedor Docker.
2. **Lambda + API Gateway:** Función Node.js para el cálculo y entrega directa de métricas desde la base de datos PostgreSQL.
3. **S3 + CloudFront:** Almacenamiento y distribución global del build estático del frontend.

### Despliegue mediante AWS SAM CLI

```bash
cd lambda

# Compilar e inicializar el empaquetado SAM
sam build

# Desplegar en la cuenta de AWS de forma guiada
sam deploy --guided
```

### Comandos de Retirada (Teardown)

Para eliminar los recursos creados en AWS y evitar costos posteriores:

```bash
sam delete --stack-name fixlat-dashboard-metrics
```

---

## Decisiones de Diseño y Limitaciones Conocidas

* **CORS & Robustez en Lambda:** La función Lambda incluye cabeceras `Access-Control-Allow-Origin: *` tanto en respuestas exitosas como en bloques de captura de excepciones, previniendo bloqueos del cliente frontend y caídas por desconexión en base de datos.
* **Manejo de Roles:** La restricción de conservar siempre al menos un administrador activo se valida tanto a nivel de reglas de negocio en el backend como en la interfaz.
* **Limitaciones Conocidas:** En el entorno emulado local no se requiere ni emula CloudFront ni EC2 de forma remota; el frontend es servido de manera análoga mediante Nginx en contenedor y el backend en su propio contenedor cli/serve.