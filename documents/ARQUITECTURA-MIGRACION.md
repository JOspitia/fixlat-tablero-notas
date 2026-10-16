# Arquitectura del proyecto — Guía de migración

> Documento generado a partir del snapshot de `fixlat-tablero-notas` para servir como plantilla al migrar esta estructura a otros proyectos.
>
> **Stack base:** Laravel 12 (PHP 8.2) · React 19.2 + Vite 8.3 + Tailwind v4 · Node 20 + TypeScript 5.4 (Lambda) · PostgreSQL 16 · Sanctum 4.3 (Bearer).
>
> **Idioma canónico del dominio:** español (mensajes de error, etiquetas, nombres de estado). Esto es **contrato**, no cosmético: mensajes idénticos son parte de mecanismos de anti-enumeración y de UX.

---

## Índice

1. [Visión general del monorepo](#1-visión-general-del-monorepo)
2. [Backend (Laravel)](#2-backend-laravel)
3. [Frontend (React)](#3-frontend-react)
4. [Lambda (workers serverless)](#4-lambda-workers-serverless)
5. [Infraestructura y entorno](#5-infraestructura-y-entorno)
6. [Convenciones transversales](#6-convenciones-transversales)
7. [Trampas conocidas (lecciones aprendidas)](#7-trampas-conocidas-lecciones-aprendidas)
8. [Checklist de migración a un proyecto nuevo](#8-checklist-de-migración-a-un-proyecto-nuevo)

---

## 1. Visión general del monorepo

```
proyecto/
├── backend/          # Laravel 12 API
├── frontend/         # React 19 SPA (Vite + Tailwind v4)
├── lambda/           # AWS Lambda (TS) — workers/eventuales endpoints extra
├── docker-compose.yml
├── .env.example
└── README.md
```

**Reglas de oro del monorepo:**

- `backend/` y `frontend/` se ejecutan como contenedores separados en `docker-compose`. El frontend NO se sirve desde Laravel.
- `lambda/` es opcional y desacoplado: el backend la consume por HTTP (no comparte schema, no comparte ORM).
- La comunicación entre `backend` y `lambda` es **siempre vía HTTP JSON** con shape explícito (ver §6).
- Cualquier texto de UI / mensajes de error / nombres de estado canónicos van en **español**. Los identificadores de código van en **inglés**.

---

## 2. Backend (Laravel)

### 2.1. Estructura de carpetas

```
backend/
├── app/
│   ├── Exceptions/           # Excepciones de dominio custom + Handler (Laravel 11/12 stock)
│   ├── Http/
│   │   ├── Controllers/      # 1 controller por recurso, delgados
│   │   ├── Requests/         # FormRequests (validación + autorización)
│   │   ├── Resources/        # API Resources (formato de respuesta uniforme)
│   │   └── Middleware/       # Aliases: EnsureUserIsActive, EnsureUserIsAdmin
│   ├── Models/               # Eloquent, traits mínimos
│   ├── Providers/            # Solo AppServiceProvider (Laravel 11/12 style)
│   └── Services/             # Reglas de negocio (clases concretas, sin interfaces)
├── bootstrap/
│   ├── app.php               # withRouting, middleware aliases, exceptions JSON
│   ├── providers.php         # Lista de providers cargados
│   └── cache/                # (generado por Laravel)
├── config/                   # Stock Laravel + cors.php modificado
├── database/
│   ├── factories/            # UserFactory (mínimo; ver §2.8)
│   ├── migrations/           # Stock Laravel + custom idempotentes
│   └── seeders/              # DatabaseSeeder (solo demo users con updateOrCreate)
├── public/                   # index.php (entrypoint web)
├── resources/                # css/js/views (stock Laravel, sin uso real)
├── routes/
│   ├── api.php               # Todas las rutas de API
│   └── web.php               # Mínimo (return view welcome)
├── storage/                  # logs, framework cache
├── tests/
│   ├── Feature/              # Placeholders (no hay suite real por decisión del proyecto)
│   └── Unit/                 # Placeholders
├── composer.json
└── .env.example
```

### 2.2. Modelos (`app/Models/`)

**Propósito:** representación Eloquent de tablas + invariantes de dominio.

**Convención:**

- Una clase por tabla, sufijo singular (`Note`, `NoteConnector`, `User`).
- Traits mínimos según necesidad:
  - `HasFactory` para modelos con factory (por ahora solo `User`).
  - `HasApiTokens` (Sanctum) si el modelo se autentica (`User`).
  - `Notifiable` si recibe notificaciones.
  - `SoftDeletes` si la tabla lo requiere (`Note`, `NoteConnector`).
- **NO usar** `Spatie\Permission\HasRoles` salvo que el proyecto lo justifique: este proyecto maneja rol como string plano (`role: 'admin' | 'user'`) más `is_active: boolean`. Es más simple y suficiente.
- `casts()` para tipos no nativos (`datetime`, `float`, `integer`, `boolean`).
- **Allow-list como constantes en la clase** que espejan CHECK constraints de la DB:
  ```php
  public const ALLOWED_STATUSES = ['Pendiente', 'En curso', 'Hecho'];
  ```
- **Listeners en `booted()`** para invariantes de modelo:
  - `saving` → autoincremento de `version` en UPDATE dirty (optimistic locking).
  - `deleting` → cascada soft-delete dentro de transacción.
- **Relaciones siempre con nombre explícito** y FKs declaradas (no confiar en convención cuando la columna no es estándar).

### 2.3. Controladores (`app/Http/Controllers/`)

**Propósito:** HTTP plumbing (parsing, response shape, status codes). **No reglas de negocio.**

**Convención:**

- Una clase por recurso (`AuthController`, `NoteController`, etc.).
- Constructor con **Service inyectado como `readonly` promoted property**.
- Métodos finos: `index`, `show`, `store`, `update`, `destroy`. CRUD puro.
- **Sin route model binding** por defecto: reciben `int $id`, hacen `Model::find($id)` y 404 manual con mensaje en español literal (`'Esta nota ya no existe.'`).
- Excepciones de dominio se **atrapan en el controller** para traducir a HTTP:
  - `OptimisticLockException` → `409 Conflict` con payload `{ current: <serverState> }`.
  - `LastAdminInvariantException` → `422 Unprocessable Entity`.
  - `MetricsUnavailableException` → `503 Service Unavailable`.
- **Sin versionado de URL** (`/api`, no `/api/v1`). Versionado se hace via header `Accept` si se necesita.

### 2.4. Form Requests (`app/Http/Requests/`)

**Propósito:** validación + mensajes de error consistentes.

**Convención:**

- Una clase por endpoint con datos: `Store*Request`, `Update*Request` (a veces combinadas).
- `authorize(): true` siempre (la autorización real va por middleware `auth.*`).
- `rules()` declarativo, sin lógica condicional compleja.
- `messages()` en **español literal**. Los mensajes son contrato: idénticos para inputs idénticos = anti-enumeración.

### 2.5. API Resources (`app/Http/Resources/`)

**Propósito:** shape de respuesta uniforme.

**Convención:**

- Una clase por modelo expuesto (`UserResource`, `NoteResource`).
- `toArray($request)` con **whitelist explícita** (no `return $this->resource`).
- **Formato de envoltura uniforme** (clave singular/plural):
  - Colección: `{ "notes": [...] }`
  - Recurso único: `{ "note": {...} }`
- **Excepción:** endpoints de acción (`update` con optimistic lock) pueden devolver `{ "ok": true, ... }` o `{ "ok": false, "current": ... }` para distinguir 409 sin reventar.

### 2.6. Servicios (`app/Services/`)

**Propósito:** reglas de negocio, invariantes de dominio, orquestación de modelos.

**Convención:**

- **Clases concretas, sin interfaces** (no se gana nada hasta que haya un segundo driver).
- Naming con sufijo `Service` por recurso (`AuthService`, `NoteService`).
- Inyección por **constructor**, `readonly` promoted property. Laravel resuelve automáticamente (no declarar bindings en el provider salvo que haya ambigüedad).
- **Logs gated por `config('app.debug')`** para evitar ruido en producción.
- Servicios típicos en este proyecto:
  - `AuthService` — login con anti-enumeración (mismo mensaje para email inexistente / password mala; rechazo separado de `is_active=false`).
  - `NoteService` — optimistic locking sobre `version`, no-op success cuando no hay cambios.
  - `AdminUserService` — invariante "último admin activo": simula estado final antes de aplicar cambios, bloquea si quedaría 0 admins activos.
  - `MetricsService` — proxy HTTP a la Lambda con timeout, traduce shape externo a shape español del dominio.

### 2.7. Middleware (`app/Http/Middleware/`)

**Aliases registrados en `bootstrap/app.php`:**

| Alias         | Clase                  | Uso                              |
|---------------|------------------------|----------------------------------|
| `auth.active` | `EnsureUserIsActive`   | Tras `auth:sanctum`, verifica `is_active=true` |
| `auth.admin`  | `EnsureUserIsAdmin`    | Tras `auth.active`, verifica `role=admin` |

**Otros middleware globales importantes:**

- `HandleCors::class` **prepended** en `$middleware` (workaround para `php artisan serve` — ver §7).

### 2.8. Proveedores (`app/Providers/`)

**Solo `AppServiceProvider`** (estilo Laravel 11/12 — no hay más providers salvo necesidad real).

Tareas registradas típicamente:

- `RateLimiter::for('login', ...)` — throttling por IP en endpoints sensibles.
- `URL::forceScheme('https')` solo en entorno `production`.
- **Bindings del container solo si hay ambigüedad** (no por defecto).

### 2.9. Excepciones (`app/Exceptions/`)

**No hay `Handler.php` custom.** Todo se configura en `bootstrap/app.php`:

```php
->withExceptions(function (Exceptions $exceptions) {
    $exceptions->shouldRenderJsonWhen(
        fn ($request) => $request->is('api/*') || $request->expectsJson()
    );
})
```

**Excepciones de dominio custom** (extends `Exception` o `RuntimeException`):

| Excepción                    | HTTP | Cuándo                                                    |
|------------------------------|------|-----------------------------------------------------------|
| `OptimisticLockException`    | 409  | Conflicto de versión en UPDATE (lleva `currentServerState`) |
| `LastAdminInvariantException`| 422  | Operación dejaría al sistema sin admins activos           |
| `MetricsUnavailableException`| 503  | Fallo del upstream (Lambda caída o timeout)               |

Mensajes en español, literales y estables (parte del contrato).

### 2.10. Migraciones (`database/migrations/`)

**Convención:**

- Naming mixto aceptable: stock Laravel + custom con timestamp `YYYY_MM_DD_HHMMSS_<slug>.php`.
- **Patrón aditivo + idempotente** para migraciones custom (porque el proyecto evoluciona sobre la misma DB compartida):
  ```php
  if (! Schema::hasColumn('notes', 'version')) {
      $table->unsignedInteger('version')->default(1);
  }
  ```
- **CHECK constraints de PostgreSQL** envueltos en:
  ```php
  if (config('database.default') === 'pgsql' && ! pgsqlConstraintExists(...)) {
      DB::statement('ALTER TABLE notes ADD CONSTRAINT ...');
  }
  ```
  SQLite (test env) no soporta CHECK constraints — la condicionalidad es obligatoria.
- **Soft deletes** en tablas que lo necesiten (`$table->softDeletes()`).
- **FKs reales** con `cascadeOnDelete()` cuando aplique.
- **Índices explícitos** en columnas usadas para filtros (`status`, `deleted_at`, FKs).

### 2.11. Seeders (`database/seeders/`)

**Convención:**

- Un único `DatabaseSeeder` (no proliferar seeders).
- **Siempre `Model::updateOrCreate`** en reinicios — el proyecto no borra datos demo.
- Solo seeders de **datos canónicos de demo** (cuentas admin/user de prueba). No seedear notas/conectores.

### 2.12. Factories (`database/factories/`)

**Convención:**

- Solo factories para modelos con tests automatizados (en este proyecto, solo `UserFactory`).
- Convención estándar Laravel: `definition()` con `fake()`, un state `unverified()`.
- **No invertir en factories hasta que haya tests reales** que las usen.

### 2.13. Rutas (`routes/`)

**`api.php`** estructura:

```
/api
├── POST /auth/login                    throttle:login
├── GET  /auth/me                       auth:sanctum + auth.active
├── POST /auth/logout                   auth:sanctum + auth.active
├── GET  /notes                         auth:sanctum + auth.active
├── POST /notes                         auth:sanctum + auth.active
├── GET  /notes/{id}                    auth:sanctum + auth.active + whereNumber('id')
├── PUT  /notes/{id}                    auth:sanctum + auth.active + whereNumber('id')
├── DELETE /notes/{id}                  auth:sanctum + auth.active + whereNumber('id')
├── GET  /notes/{id}/connectors         auth:sanctum + auth.active
├── POST /notes/{id}/connectors         auth:sanctum + auth.active
├── GET  /connectors/{id}               auth:sanctum + auth.active
├── PUT  /connectors/{id}               auth:sanctum + auth.active
├── DELETE /connectors/{id}             auth:sanctum + auth.active
├── GET  /metrics                       auth:sanctum + auth.active
└── /admin/users/*                      auth:sanctum + auth.active + auth.admin
```

**Convenciones:**

- `->name('recurso.accion')` en cada ruta.
- `->whereNumber('id')` para forzar constraint numérico.
- `web.php` mínimo, casi nunca usado.

### 2.14. Tests (`tests/`)

**Decisión del proyecto:** no hay suite automatizada. Los acceptance criteria son binarios y verificables manualmente con `curl` / `docker exec`.

**Estructura mantenida** (para futuro):

```
tests/
├── Feature/        # End-to-end por endpoint (uno por HU relevante)
└── Unit/           # Servicios, helpers puros
```

PHPUnit 11.5 (no Pest). `phpunit.xml` con SQLite `:memory:` + `BCRYPT_ROUNDS=4` para velocidad.

---

## 3. Frontend (React)

### 3.1. Estructura de carpetas

```
frontend/
├── src/
│   ├── assets/              # Imágenes, fuentes, SVG estáticos
│   ├── components/          # Componentes de UI (ver §3.3)
│   ├── contexts/            # Providers React (Auth, Toast)
│   ├── hooks/               # Hooks custom (carpeta reservada, ver §3.4)
│   ├── lib/                 # Constantes y helpers puros del dominio
│   ├── pages/               # Una carpeta por ruta (componente top-level)
│   ├── services/            # Capa de I/O HTTP (axios)
│   ├── App.jsx              # Router + providers
│   ├── main.jsx             # Entry point
│   └── index.css            # Tailwind v4 + variantes custom
├── public/                  # index.html, favicon, etc.
├── index.html
├── vite.config.js
├── eslint.config.js
├── package.json
└── .env.example             # VITE_API_URL
```

### 3.2. Páginas (`src/pages/`)

**Propósito:** una página por ruta de React Router.

**Convención:**

- Una carpeta por página con su componente principal (`LoginPage.jsx`, `TableroPage.jsx`, `DashboardPage.jsx`, `AdminPage.jsx`, `NotFoundPage.jsx`).
- Componentes top-level: contenedor de estado + composición de componentes.
- **Container-presentational relajado:** la página es container (state, effects, handlers) y pasa props/callbacks a componentes presentational.

### 3.3. Componentes (`src/components/`)

**Convención funcional** (no es atomic design formal):

| Sub-categoría       | Ejemplos                                          | Rol                                      |
|---------------------|---------------------------------------------------|------------------------------------------|
| Layout / nav        | `Layout`, `Sidebar`, `ProtectedRoute`            | Estructura global, guards de ruta        |
| Modales / portales  | `NoteEditor`, `UserFormModal`, `ConnectorMiniToolbar` | `createPortal` para escapar stacking contexts |
| Canvas / dominio    | `NoteCard`, `ConnectorLayer`, `ConnectorFab`      | UI específica del tablero               |
| Cross-cutting       | `ToastViewport`                                   | UI transversal (notificaciones)         |

**Reglas:**

- **Portales React** (`createPortal`) para modales y tooltips que deban escapar de contenedores con `overflow: hidden` o `transform`.
- `NoteCard` / `NoteEditor` mantienen **allow-lists duplicadas localmente** para no importar de `lib/` (autocontención > DRY cuando son catálogos cortos).
- Sin separación container-presentational estricta: el patrón se respeta a nivel página, no a nivel componente.

### 3.4. Hooks (`src/hooks/`)

**Carpeta reservada**, actualmente vacía. La lógica reutilizable vive en `lib/` (funciones puras) y en los contextos.

**Cuándo crear un hook:**

- Cuando una lógica con estado (`useState`/`useEffect`) se repite en 2+ páginas/componentes.
- Cuando se quiere aislar un side effect complejo del componente visual.

### 3.5. Contextos (`src/contexts/`)

**Dos providers, ambos con hook asociado:**

| Contexto      | Estado                                | Hook        |
|---------------|---------------------------------------|-------------|
| `AuthContext` | `user`, `token`, `loading`, `error`, `inactivityMessage` | `useAuth()`  |
| `ToastContext`| array de toasts, API `success/error/info`              | `useToast()` |

**Reglas:**

- **Token en `sessionStorage`** bajo key `auth.token` (no localStorage: se cierra con la pestaña).
- **No usar** state global externo (Zustand, Redux, Jotai). Solo contextos + estado local.
- `AuthContext.login()` mapea errores HTTP a mensajes de UI: 422 → primer validation, 429 → rate limit, otros → genérico.

### 3.6. Servicios (`src/services/`)

**Propósito:** única capa de I/O HTTP. Nunca `fetch`/`axios` sueltos en componentes.

**Estructura:**

```
services/
├── api.js                # Instancia Axios con interceptores
├── auth.js               # login, logout, me
├── notes.js              # CRUD notas
├── connectors.js         # CRUD conectores
├── adminUsers.js         # CRUD admin de usuarios
└── metrics.js            # GET /metrics
```

**Convención:**

- **Instancia Axios única** (`api.js`) con:
  - `baseURL` desde `import.meta.env.VITE_API_URL` (fallback dev).
  - `timeout: 10000`.
  - Headers `Accept` y `Content-Type: application/json`.
  - **Request interceptor:** inyecta `Bearer <token>` desde `sessionStorage`.
  - **Response interceptor:** en `401` limpia token + redirige a `/login` (con guard anti-loop).
- **Named exports por dominio**, funciones puras que envuelven la llamada y devuelven `response.data` (sin envoltorios `{data}` redundantes).
- **DELETE → 204** se devuelve vacío, el caller no espera body.
- **Excepciones documentadas** (ej: `notes.js::updateNote` devuelve `{ok, note}` o `{ok, current}` para distinguir 409).

### 3.7. Lib (`src/lib/`)

**Propósito:** constantes y funciones puras del dominio. **Sin estado, sin I/O, sin React.**

**Convención de frontera:**

| Carpeta     | Contiene                                                            |
|-------------|---------------------------------------------------------------------|
| `lib/`      | Constantes, catálogos, geometría, helpers puros                     |
| `services/` | I/O HTTP                                                            |
| `hooks/`    | (reservado) lógica con estado reutilizable                          |

**Contenido típico:**

- Catálogos/allow-lists (`NOTE_CONNECTOR_STYLE_LIST`, `ALLOWED_SHAPES`).
- Constantes numéricas (`MAX_PER_PAIR = 6`, `BOUNDING_BOX_SIZE = 220`).
- Geometría pura (`bezierPath`, `getNoteCenter`, `getAnchorPoint`).

### 3.8. Configuración frontend

- **`vite.config.js`** mínimo: `react()` + `tailwindcss()` (vía `@tailwindcss/vite`, no PostCSS).
- **Tailwind v4:** no hay `tailwind.config.js`. Se configura vía CSS (`@import "tailwindcss";` en `index.css`). Variantes custom (`.note-shape-*`, `.canvas-dot-grid`, animaciones) viven en `index.css`.
- **`eslint.config.js`** flat config: plugins `js`, `react-hooks`, `react-refresh`. Sin Prettier (decisión del proyecto).
- **`package.json` scripts:** `dev`, `build`, `lint`, `preview`. No hay test runner (Vitest no instalado).

### 3.9. Variables de entorno

- Acceso: `import.meta.env.VITE_*` (estándar Vite).
- Única env var usada: `VITE_API_URL` (con fallback `http://localhost:8000/api`).
- **`.env.example`** debe existir siempre, aunque tenga una sola variable.

---

## 4. Lambda (workers serverless)

**Cuándo incluir:** cuando hay al menos un endpoint/evento que necesita aislamiento, cómputo distinto (Node/TS) o ciclo de vida independiente.

```
lambda/
├── app.ts                   # Handler único
├── template.yaml            # AWS SAM
├── init-localstack.sh       # Bootstrap para LocalStack
├── tsconfig.json
├── package.json
└── dist/                    # Output de tsc (generado)
```

**Convención:**

- **Handler único por archivo** (`app.ts`).
- Conexión a DB con `pg.Client` (no pool, salvo necesidad justificada).
- **Env vars para config DB** con defaults dev: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- **CORS headers en TODAS las respuestas** (éxito y error): `Access-Control-Allow-Origin: *`, `Content-Type: application/json`.
- **Shape de respuesta desacoplado** del backend (snake_case, idioma inglés). El backend hace la traducción al shape español del dominio.
- **Filtrar `deleted_at IS NULL`** explícitamente en queries a tablas con soft delete (este bug ya mordió una vez, ver §7).
- **SAM template:** `nodejs20.x`, timeout 10s, handler `dist/app.handler`, API Gateway HTTP o REST.

---

## 5. Infraestructura y entorno

### 5.1. Docker Compose

Servicios típicos:

| Servicio       | Imagen                    | Puerto host | Notas                          |
|----------------|---------------------------|-------------|--------------------------------|
| `db`           | `postgres:16-alpine`      | 5432        | Volumen persistente, healthcheck con `pg_isready` |
| `backend`      | PHP 8.2 + composer        | 8000        | `php artisan serve`            |
| `frontend`     | nginx (con build estático)| 3000        | Sirve `dist/`                  |
| `localstack`   | localstack/localstack     | 4566        | Para emular Lambda en dev      |
| `lambda_local` | node:20-alpine            | 3001        | HTTP server custom para la Lambda en dev |

### 5.2. `.env.example` del backend

Debe incluir (como mínimo):

```
APP_NAME=
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=

FRONTEND_ORIGIN=http://localhost:3000
SANCTUM_STATEFUL_DOMAINS=localhost:3000

LAMBDA_METRICS_URL=http://lambda_local:3001/metrics
```

### 5.3. Entry point del backend

`entrypoint.sh` debe ser **idempotente**:

1. Esperar DB (`wait-for` o loop con `pg_isready`).
2. `php artisan migrate --force`.
3. `php artisan db:seed --force` (usa `updateOrCreate`, seguro re-correr).
4. `php artisan serve --host=0.0.0.0`.

---

## 6. Convenciones transversales

### 6.1. Idioma

| Capa              | Idioma                                    |
|-------------------|-------------------------------------------|
| Mensajes de error | **Español literal** (parte del contrato)  |
| Etiquetas UI      | **Español** (parte del contrato UX)       |
| Nombres de estado | **Español** (`Pendiente`, `En curso`, `Hecho`) |
| Identificadores de código | **Inglés** (`NoteController`, `ALLOWED_STATUSES`) |
| Comentarios       | **Español** o inglés según audiencia     |

### 6.2. Contrato HTTP

**Request:**
- `Content-Type: application/json` (excepto login que usa `application/x-www-form-urlencoded` por quirk de `php artisan serve`).
- `Authorization: Bearer <token>` cuando aplique.

**Response:**
- **Éxito GET colección:** `{ "<pluralKey>": [...] }`
- **Éxito GET/PUT/POST singular:** `{ "<singularKey>": {...} }`
- **Éxito DELETE:** `204 No Content` (vacío).
- **Error de validación:** `422` con `{ "message": "<primer mensaje>", "errors": { "<campo>": ["..."] } }`.
- **Error de conflicto (optimistic lock):** `409` con `{ "ok": false, "current": {...} }`.
- **Error de invariante de negocio:** `422` con `{ "message": "<mensaje en español>" }`.

### 6.3. Naming

| Concepto              | Convención                                |
|-----------------------|-------------------------------------------|
| Tablas DB             | plural snake_case (`notes`, `note_connectors`) |
| Columnas DB           | snake_case (`status`, `created_at`, `is_active`) |
| Modelos Eloquent      | singular PascalCase (`Note`, `User`)      |
| Controllers           | `<Recurso>Controller`                     |
| Services              | `<Recurso>Service`                        |
| Form Requests         | `Store<Recurso>Request`, `Update<Recurso>Request` |
| Resources             | `<Recurso>Resource`                       |
| Middleware            | `Ensure<Condición>`                       |
| Excepciones           | `<Condición>Exception`                    |
| Rutas                 | `<recurso>.<acción>` (`notes.index`)      |
| Variables de entorno  | UPPER_SNAKE_CASE (`VITE_API_URL`)         |

---

## 7. Trampas conocidas (lecciones aprendidas)

### 7.1. CORS con `php artisan serve`

**Problema:** el dev server de PHP no procesa preflight `OPTIONS` para `/api/*`, devuelve 404.

**Workaround:** prepender `HandleCors::class` en `$middleware` global + shim en `public/index.php`.

**Importante:** este workaround NO es necesario en producción con nginx + php-fpm. Quitarlo cuando se vaya a prod.

### 7.2. CHECK constraints y SQLite

**Problema:** SQLite (entorno test) no soporta `ALTER TABLE ... ADD CONSTRAINT CHECK`.

**Solución:** envolver toda creación de CHECK constraint en:

```php
if (config('database.default') === 'pgsql' && ! pgsqlConstraintExists(...)) {
    DB::statement('ALTER TABLE ... ADD CONSTRAINT ...');
}
```

### 7.3. Soft delete + queries de agregado

**Problema:** olvidar `WHERE deleted_at IS NULL` en queries de la Lambda da totales incorrectos (incluye notas borradas).

**Solución:** siempre `WHERE deleted_at IS NULL` explícito en cualquier query que toque tablas con soft delete. **Esto ya mordió una vez — documentado en AGENTS.md.**

### 7.4. Optimistic locking con `no-op`

**Problema:** el cliente envía un PUT con exactamente los valores actuales → el sistema bumpa `version` igual → la próxima edición desde otro cliente falla con 409 falso.

**Solución:** en `NoteService::update()`, comparar `getDirty()` antes de bumpear. Si no hay cambios efectivos, devolver success sin tocar `version`.

### 7.5. Token en `sessionStorage` vs `localStorage`

**Decisión:** `sessionStorage` para que el token muera con la pestaña. Más seguro contra XSS persistente. Trade-off: el usuario tiene que re-loguear al cerrar la pestaña.

### 7.6. Idioma de los mensajes de error

**Decisión:** mensajes literales en español, parte del contrato. Cambiar un mensaje rompe tests manuales y puede romper mecanismos de anti-enumeración.

---

## 8. Checklist de migración a un proyecto nuevo

### Antes de empezar

- [ ] Definir el **stack base** (Laravel + React + DB + auth strategy).
- [ ] Decidir **idioma canónico** del dominio (este proyecto: español).
- [ ] Definir **modelo de auth** (Sanctum Bearer vs SPA stateful vs otro).
- [ ] Definir **forma del equipo**: roles + permisos + flag `is_active` o equivalente.

### Backend (Laravel)

- [ ] Crear proyecto Laravel 12 con `composer create-project`.
- [ ] Instalar Sanctum: `composer require laravel/sanctum`.
- [ ] Configurar `config/cors.php` con orígenes del frontend.
- [ ] Crear estructura `app/Http/{Controllers,Requests,Resources,Middleware}`.
- [ ] Definir modelos con traits mínimos y constantes allow-list.
- [ ] Crear FormRequests con mensajes en español.
- [ ] Crear Resources con envoltura uniforme `{ "<key>": ... }`.
- [ ] Crear Services concretos (sin interfaces) con `readonly` promoted properties.
- [ ] Registrar middleware aliases en `bootstrap/app.php`.
- [ ] Crear migraciones con patrón idempotente + CHECK constraints condicionales a pgsql.
- [ ] `DatabaseSeeder` con `updateOrCreate` para datos demo.
- [ ] Configurar `routes/api.php` con grupos de middleware (`auth:sanctum`, `auth.active`, `auth.admin`).
- [ ] `.env.example` completo.
- [ ] `phpunit.xml` con SQLite `:memory:` para tests rápidos.

### Frontend (React)

- [ ] Crear proyecto con `npm create vite@latest -- --template react`.
- [ ] Instalar Tailwind v4 (`@tailwindcss/vite`) — **NO PostCSS**.
- [ ] Instalar `axios`, `react-router-dom`, deps de UI necesarias.
- [ ] Crear estructura `src/{pages,components,contexts,hooks,lib,services}`.
- [ ] Crear `services/api.js` con interceptores (`baseURL`, timeout, Bearer token, 401 handler).
- [ ] Crear módulos por dominio en `services/`.
- [ ] Crear `AuthContext` + `ToastContext` con hooks asociados.
- [ ] Configurar `ProtectedRoute` como HOC para rutas con auth.
- [ ] `.env.example` con `VITE_API_URL`.
- [ ] `eslint.config.js` flat config (js, react-hooks, react-refresh).

### Lambda (si aplica)

- [ ] Crear `template.yaml` SAM con `nodejs20.x` y handler correcto.
- [ ] Conexión a DB con env vars + defaults dev.
- [ ] CORS headers en TODAS las respuestas (éxito y error).
- [ ] Shape snake_case (el backend traduce al español).
- [ ] `WHERE deleted_at IS NULL` en queries a tablas con soft delete.
- [ ] `init-localstack.sh` para dev local.

### Infraestructura

- [ ] `docker-compose.yml` con servicios `db`, `backend`, `frontend` (+ `localstack`, `lambda_local` si aplica).
- [ ] Healthcheck en DB con `pg_isready`.
- [ ] Volumen persistente para Postgres.
- [ ] `entrypoint.sh` idempotente (migrate + seed + serve).
- [ ] `.gitignore` que cubra `vendor/`, `node_modules/`, `dist/`, `.env`, `storage/`, `bootstrap/cache/`.

### Documentación

- [ ] `README.md` raíz con: prerequisites, setup (`docker compose up`), credenciales demo, comandos útiles.
- [ ] `documents/ARQUITECTURA-MIGRACION.md` (este documento, adaptado al nuevo proyecto).
- [ ] `AGENTS.md` con: convenciones del proyecto, decisiones arquitectónicas, trampas conocidas, idioma canónico.

### Verificación final

- [ ] `docker compose up` levanta todo sin errores.
- [ ] Login con usuario demo funciona end-to-end.
- [ ] CRUD principal del dominio funciona (happy path + al menos un sad path).
- [ ] Frontend se conecta al backend y al backend a la Lambda (si aplica).
- [ ] CORS funciona en dev (`HandleCors` prependido).
- [ ] Migraciones son re-ejecutables sin error (idempotencia).

---

> **Mantenimiento:** este documento es vivo. Cada vez que se descubra una nueva trampa, se cambie una convención o se agregue un nuevo patrón, actualizarlo y referenciarlo desde el `README.md` del proyecto.
