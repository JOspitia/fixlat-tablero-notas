# HU-01 — Autenticación de Usuarios

## Description

El proyecto `fixlat-tablero-notas` es un portal full-stack desacoplado con tres runtimes (Laravel 12 API, React 19 SPA, Node 20 Lambda de métricas) que ofrece un tablero de notas tipo post-it con drag & drop libre, un dashboard de métricas agregado por estado y un panel de administración de usuarios, persistidos en PostgreSQL 16.

Esta HU implementa la autenticación base del sistema — **prerrequisito de HU-02 (tablero), HU-03 (dashboard) y HU-04 (administración de usuarios)** — cubriendo:

1. **Login** con `email` + `password` contra la tabla `users` con emisión de token Sanctum en modo **Bearer** (no cookies).
2. **Mantenimiento de sesión** basado en el header `Authorization: Bearer <token>`, validado en cada request por `auth:sanctum` + middleware `EnsureUserIsActive` (que re-valida `is_active=true` y refresca `last_activity_at`).
3. **Logout** con revocación server-side del token (`currentAccessToken()->delete()`).
4. **Verificación de sesión al cargar la app** vía `GET /api/auth/me`.

Decisiones técnicas clave:

- Los tokens **NO persisten al cerrar el navegador** (almacenados en `sessionStorage`, no `localStorage`).
- Credenciales inválidas devuelven **un único mensaje genérico anti-enumeración**; los logs internos sí diferencian el motivo.
- **Rate limit de 5 intentos/min/IP** en `POST /api/auth/login` (Laravel `throttle:5,1`).
- **Logging estructurado** de eventos auth sin incluir passwords ni emails completos (solo `user_id` cuando se conoce e IP truncada/hasheada).
- HTTPS forzado en producción vía trust-proxies + `URL::forceScheme('https')` cuando `APP_ENV=production`.

Patrón de arquitectura backend: `Request → Controller → Service → Model → Resource` (aplicado a `AuthController`, `AuthService`, `User`, `UserResource`).

## Dependencies and Blockers

- [ ] **Migration `0001_01_01_000000_create_users_table.php`** ya crea la tabla `users` con `role` (string, default `'user'`) e `is_active` (boolean, default `true`). **No requiere nueva migration.**
- [ ] **Seeder `DatabaseSeeder`** debe sembrar ambas cuentas demo vía `updateOrCreate` (idempotente):
  - `admin@test.com` / password `admin123` (role=`admin`, is_active=`true`)
  - `user@test.com` / password `user123` (role=`user`, is_active=`true`)
- [ ] **`UserFactory::definition()`** debe **extenderse** (no reemplazarse) para incluir `'role' => 'user'` e `'is_active' => true` como defaults de cualquier factory-created user.
- [ ] **Instalación de `laravel/sanctum`** vía Composer y publicación de su migration (`personal_access_tokens`).
- [ ] **Creación de `routes/api.php`** y registro en `bootstrap/app.php` mediante `withRouting(api: ...)`.
- [ ] **Configuración CORS** permitiendo `http://localhost:3000` (local) y el origen de producción en rutas `/api/*`.
- [ ] **Schema referenciada (no creada por HU-01)** — tabla `personal_access_tokens` creada por la migration publicada de Sanctum:
  - **Columnas**: `id` (bigint, PK), `tokenable_type` (string), `tokenable_id` (bigint), `name` (string), `token` (string, **único**, hash SHA-256 del token plano), `abilities` (text, nullable), `last_used_at` (timestamp, nullable), `expires_at` (timestamp, nullable), `created_at`, `updated_at`.
  - **Índices**: compuesto `(tokenable_type, tokenable_id)`; único sobre `token`.
  - **FK**: ninguna formal; relación **polimórfica** vía `tokenable_type` / `tokenable_id` hacia `users`.
- [ ] **Migración aditiva** sobre `users` para añadir columna `last_activity_at` (timestamp, nullable) — refresh por middleware `EnsureUserIsActive`. **NO** aplica soft-deletes a `users` (esa tabla usa `is_active`, no borrado lógico).

## Assumptions

- [ ] **A1.** Sanctum instalado y configurado en modo **Bearer tokens** (`createToken('auth_token')->plainTextToken`), NO cookies.
- [ ] **A2.** Frontend `:3000` y backend `:8000` son **orígenes distintos**. CORS estricto (orígenes específicos), sin wildcards en producción. Los tokens viven en `sessionStorage` (sin persistencia al cerrar el navegador).
- [ ] **A3.** Identificador de login es **email** (lowercased + trimmed antes de búsqueda). NO username.
- [ ] **A4.** Logout invalida el token server-side vía `$user->currentAccessToken()->delete()`.
- [ ] **A5.** Credenciales inválidas devuelven **UN mensaje genérico** `"Las credenciales de acceso son incorrectas"` (anti-enumeración). Solo los logs internos difieren.
- [ ] **A6.** Cada request autenticado re-valida `is_active=true` vía middleware `EnsureUserIsActive`. Si false → **403** con `"Tu cuenta está inactiva. Contacta al administrador del sistema"`.
- [ ] **A7.** El cliente axios/fetch del frontend usa un **interceptor global** que siempre envía `Accept: application/json` y `Authorization: Bearer <token>` cuando hay token.
- [ ] **A8.** Frontend almacena el token en `sessionStorage` bajo clave `auth.token`. **NO `localStorage`**. Sin persistencia al cerrar navegador.
- [ ] **A9.** Validación de password: **mínimo 8, máximo 64 caracteres**. Previene truncamiento silencioso de bcrypt a 72 bytes.
- [ ] **A10.** Timeout de request HTTP desde frontend: **10 segundos**. Al expirar, frontend muestra `"La solicitud tardó demasiado. Intenta nuevamente."` y aborta.
- [ ] **A11.** **Página 404 está en scope** (best practice cross-cutting): ruta catch-all en React Router muestra componente `<NotFound />` con texto `"Página no encontrada"` + link a `/tablero` (si autenticado) o `/login` (si no).
- [ ] **A12.** Ruta por defecto tras login exitoso: **`/tablero`**. El sidebar con selección Tablero / Dashboard pertenece a HU-02/HU-03 (NO HU-01).
- [ ] **A13.** Cuentas demo: `admin@test.com / admin123` (role=`admin`, is_active=`true`), `user@test.com / user123` (role=`user`, is_active=`true`). Passwords almacenados hasheados vía `Hash::make(...)`.
- [ ] **A14.** El frontend usa **React Router 7** (instalado pero no wired) con un `<AuthProvider>` que expone `user`, `token`, `login()`, `logout()` y `isAuthenticated`.

## Out of Scope

- [ ] Crear / editar / listar / eliminar usuarios — pertenece a **HU-04**.
- [ ] Activar / desactivar usuarios — pertenece a **HU-04**.
- [ ] Cambio de contraseña por parte del usuario.
- [ ] Flujo forgot-password / password-reset.
- [ ] Verificación de email.
- [ ] "Remember me" / persistencia tras cerrar el navegador.
- [ ] Idle timeout / auto-logout por inactividad.
- [ ] OAuth / social login.
- [ ] MFA / 2FA.
- [ ] Magic links / passwordless.
- [ ] Autorización específica por rol más allá de autenticación (forzada en HU-02/03/04).
- [ ] Lista de sesiones activas / forzar logout global.
- [ ] API keys / tokens de larga vida / servidor OAuth.

## Variables and Configuration

| Variable | Type | Environments | Default value | Description |
|----------|------|--------------|---------------|-------------|
| `APP_ENV` | string | local, production | `local` (Docker Compose), `production` (AWS) | Entorno de ejecución. Determina si se fuerza HTTPS. |
| `APP_URL` | string | local, production | `http://localhost:8000` (local), `https://api.<dominio>` (prod) | URL base del backend. |
| `FRONTEND_ORIGIN` | string | local, production | `http://localhost:3000` (local), `https://app.<dominio>` (prod) | Origen permitido en CORS para rutas `/api/*`. |
| `SANCTUM_STATEFUL_DOMAINS` | array | local, production | `["localhost:3000"]` (local), `["app.<dominio>"]` (prod) | Dominios stateful para Sanctum (reservado; HU-01 usa Bearer tokens, no cookies). |
| `SESSION_DRIVER` | string | all | `database` | Driver de sesión (sin uso directo en HU-01). |
| `SESSION_LIFETIME` | int (minutos) | all | `120` | Sin uso directo (HU-01 no usa sesiones server-side). |
| `DB_HOST` | string | local, production | `db` (Docker service), endpoint RDS (prod) | Host de Postgres 16. |
| `DB_PORT` | int | all | `5432` | Puerto de Postgres. |
| `DB_USER` | string | local, production | `postgres` (local), desde Secrets Manager (prod) | Usuario de DB. |
| `DB_PASSWORD` | string | local, production | `secret` (local), desde Secrets Manager (prod) | Password de DB. |
| `DB_NAME` | string | all | `tablero` | Nombre de la DB. |
| Token name (`createToken(...)` arg) | string | all | `auth_token` | Nombre del token Sanctum emitido en login. |
| Rate limit `POST /api/auth/login` | int (attempts / min / IP) | all | `5` | Laravel `throttle:5,1`. |
| Frontend HTTP request timeout | int (ms) | all | `10000` | Timeout HTTP global desde el cliente. |
| Logging fields permitidos (auth) | set | all | `{event, user_id?, ip_hash}` | Eventos auth loggeados: `auth.login.ok`, `auth.login.failed.email_not_found`, `auth.login.failed.bad_password`, `auth.login.failed.inactive`, `auth.login.throttled`, `auth.logout.ok`. |

## Happy Path

**Flow 1 — Login**

1. El usuario abre la app en `http://localhost:3000`. El frontend detecta que no hay token en `sessionStorage.auth.token` y redirige a `/login`.
2. El usuario completa `email` + `password` y envía el formulario.
3. Frontend ejecuta `POST /api/auth/login` con body `{email, password}`. Headers: `Accept: application/json`, `Content-Type: application/json`.
4. Backend: `LoginRequest` valida formato de email (`email:rfc`, `max:255`) y password (string, `required`, `min:8`, `max:64`).
5. Backend: `AuthService::login` busca al usuario por email normalizado (`trim` + `strtolower`).
6. Backend: `Hash::check($password, $user->password)`.
7. Backend: verifica `$user->is_active === true`.
8. Backend: `$user->createToken('auth_token')->plainTextToken`.
9. Backend: emite log `auth.login.ok` con `user_id` e `ip_hash`.
10. Backend: responde `200 OK` con `{user: UserResource, token: "<string>"}`.
11. Frontend: almacena `token` en `sessionStorage.auth.token` y `user` en el `AuthContext`.
12. Frontend: redirige a `/tablero`.

**Flow 2 — Mantenimiento de sesión (cada request autenticado)**

1. Frontend envía request a `/api/*` con `Authorization: Bearer <token>`.
2. Backend: middleware `auth:sanctum` valida el token. Si es inválido/expirado/revocado → `401`.
3. Backend: middleware `EnsureUserIsActive` valida `is_active=true`. Si es `false` → `403` con mensaje de desactivación.
4. Backend: actualiza `users.last_activity_at = now()`.
5. Backend: procesa el endpoint normalmente.

**Flow 3 — Logout**

1. El usuario hace click en "Cerrar sesión".
2. Frontend ejecuta `POST /api/auth/logout`.
3. Backend: `auth:sanctum` + `EnsureUserIsActive` pasan.
4. Backend: `AuthService::logout` invoca `$user->currentAccessToken()->delete()`.
5. Backend: emite log `auth.logout.ok` con `user_id`.
6. Backend: responde `204 No Content`.
7. Frontend: limpia `sessionStorage.auth.token` y vacía el `AuthContext`.
8. Frontend: redirige a `/login`.

**Flow 4 — Verificación de sesión al cargar la app**

1. El frontend monta en cualquier ruta. Lee `sessionStorage.auth.token`.
2. Si hay token: ejecuta `GET /api/auth/me` con `Authorization: Bearer <token>`.
3. Backend: valida token + `is_active=true`. Si ambos OK, responde con `UserResource`. Si 401/403, el frontend limpia el storage y redirige a `/login`.
4. Si NO hay token: el frontend redirige a `/login` (sin llamar a la API).

## Sad Paths

### Login fallido — credenciales inválidas (anti-enumeración)

- **Condition**: email no registrado OR password incorrecto. El mismo mensaje al usuario en ambos casos.
- **Expected behavior**: `422 Unprocessable Entity` con mensaje genérico; logs internos diferenciados.
- **Message/UI**: `{"errors":{"email":["Las credenciales de acceso son incorrectas"]}}`
- **Log interno**: `auth.login.failed.email_not_found` o `auth.login.failed.bad_password`.

### Login fallido — cuenta inactiva

- **Condition**: `$user->is_active === false` en `users`.
- **Expected behavior**: `422 Unprocessable Entity` con mensaje específico de desactivación.
- **Message/UI**: `{"errors":{"email":["Tu cuenta está inactiva. Contacta al administrador del sistema"]}}`
- **Log interno**: `auth.login.failed.inactive`.

### Login fallido — formato de email inválido

- **Condition**: email que no cumple `email:rfc` (ej: `"no-es-email"`).
- **Expected behavior**: `422` con error de validación estándar de Laravel en campo `email`.
- **Message/UI**: `{"errors":{"email":["..."]}}` (mensaje estándar de validación).

### Login fallido — password ausente o longitud inválida

- **Condition**: password vacío, ausente, <8 caracteres o >64 caracteres.
- **Expected behavior**: `422` con error de validación en campo `password`.
- **Message/UI**: `{"errors":{"password":["..."]}}` (mensaje estándar de validación; ej: "El password debe tener al menos 8 caracteres" / "El password no puede tener más de 64 caracteres").

### Login fallido — rate limit excedido

- **Condition**: ≥6 intentos fallidos desde la misma IP en ≤60s.
- **Expected behavior**: `429 Too Many Requests` con header `Retry-After`.
- **Message/UI**: `429` estándar Laravel; log `auth.login.throttled` con `ip_hash`.

### Login fallido — backend inalcanzable

- **Condition**: timeout de red, fallo de DNS o conexión rechazada hacia `:8000`.
- **Expected behavior**: el frontend muestra mensaje de conexión.
- **Message/UI**: `"No se pudo contactar al servidor. Verifica tu conexión."`

### Login fallido — error 500 del backend

- **Condition**: excepción no controlada en el backend durante `POST /api/auth/login`.
- **Expected behavior**: el frontend muestra mensaje genérico.
- **Message/UI**: `"Error inesperado. Intenta nuevamente."`

### Login fallido — timeout del request (10s)

- **Condition**: el backend no responde en 10 segundos.
- **Expected behavior**: el frontend aborta el request (axios `AbortController` o `timeout`).
- **Message/UI**: `"La solicitud tardó demasiado. Intenta nuevamente."`

### Sesión — token inválido / expirado / revocado

- **Condition**: token no presente en `personal_access_tokens`, expirado, o cuyo hash no coincide.
- **Expected behavior**: `401`; el frontend limpia `sessionStorage` y redirige a `/login`.
- **Message/UI**: `"Tu sesión expiró. Inicia sesión nuevamente."`

### Sesión — usuario desactivado mid-session

- **Condition**: `is_active` cambió a `false` entre dos requests (admin desactivó vía HU-04).
- **Expected behavior**: `403` con mensaje de desactivación; el frontend limpia y redirige.
- **Message/UI**: `"Tu cuenta está inactiva. Contacta al administrador del sistema"`

### Sesión — backend inalcanzable mid-session

- **Condition**: timeout o conexión rechazada en cualquier request autenticado (no en `/api/auth/login`).
- **Expected behavior**: toast persistente en el frontend (no logout automático).
- **Message/UI**: `"Sin conexión. Reintentando..."`

### Sesión — error 500 del backend

- **Condition**: excepción no controlada en un endpoint autenticado.
- **Expected behavior**: toast genérico; la sesión se mantiene.
- **Message/UI**: `"Error inesperado. Intenta nuevamente."`

### Logout — segundo logout con token ya revocado

- **Condition**: doble `POST /api/auth/logout` (token ausente en `personal_access_tokens`).
- **Expected behavior**: `401` en el backend; el frontend limpia localmente (idempotente).
- **Message/UI**: redirect a `/login` sin mensaje de error.

### Logout — backend inalcanzable

- **Condition**: timeout o conexión rechazada al ejecutar `POST /api/auth/logout`.
- **Expected behavior**: el frontend limpia localmente sin esperar respuesta del backend.
- **Message/UI**: redirect idempotente a `/login` (no se muestra error de red para logout).

## Edge Cases

- [ ] **E1.** Email con espacios al inicio/final + mayúsculas (`"  Admin@Test.COM  "`): el backend trimea + lowercases antes de buscar; el login funciona si el email registrado es `admin@test.com`.
- [ ] **E2.** Email con subaddressing (`user+tag@test.com`): aceptado por validación RFC 5322; rechaza solo si no está registrado.
- [ ] **E3.** Login concurrente + desactivación: el middleware `EnsureUserIsActive` captura la desactivación en el siguiente request y devuelve `403`.
- [ ] **E4.** Doble logout concurrente: uno gana (`204`), el otro recibe `401`; el frontend es idempotente en ambos casos.
- [ ] **E5.** Múltiples logins concurrentes del mismo usuario: ambos tokens son válidos e independientes; sin restricción.
- [ ] **E6.** F5 en `/tablero` con token válido en `sessionStorage`: la app monta, llama a `/api/auth/me`, recibe `200`, sesión restaurada.
- [ ] **E7.** F5 en `/tablero` sin token en `sessionStorage`: redirect a `/login` sin llamar a `/api/auth/me`.
- [ ] **E8.** Token en `sessionStorage` pero la tabla `personal_access_tokens` fue reseteada (ej: re-run de migrations): token ausente → `401` en el primer request → frontend limpia y redirige.
- [ ] **E9.** Sesión activa + admin desactiva al usuario desde la UI (HU-04): siguiente request → `403` → frontend limpia con mensaje de desactivación.
- [ ] **E10.** **404 cross-cutting** (best practice): React Router catch-all muestra `<NotFound />` con texto `"Página no encontrada"` + link a `/tablero` (si autenticado) o `/login` (si no).

## Stupid Cases

- [ ] **S1.** Doble click rápido en "Iniciar sesión": el botón queda `disabled={isSubmitting}` durante el loading y previene requests duplicados.
- [ ] **S2.** Pivot de campos (email en password, password en email): `FormRequest` rechaza con `422` field-specific.
- [ ] **S3.** JSON / HTML / binario pegado en los campos del formulario: rechazado por la validación de tipo string.
- [ ] **S4.** Email >255 caracteres: rechazado por `max:255`.
- [ ] **S5.** Email que es solo whitespace: `trim` → string vacío → rechazado por `required`.
- [ ] **S6.** 50 pestañas abiertas con el mismo token en `sessionStorage`: cada una monta, llama a `/api/auth/me`, todas reciben `200`.
- [ ] **S7.** Logout en pestaña A mientras pestaña B navega: el siguiente request en B → `401` → limpia y redirige.
- [ ] **S8.** Cierre de pestaña / cierre del navegador: el token se pierde (sin persistencia en `localStorage`); la próxima apertura requiere login fresco.
- [ ] **S9.** Emoji en password: bcrypt acepta UTF-8; el login funciona si el password coincide exactamente.
- [ ] **S10.** Emoji en email: `email:rfc` rechaza con `422`.
- [ ] **S11.** Password de 65 caracteres: rechazado por `max:64` (previene truncamiento silencioso de bcrypt a 72 bytes).
- [ ] **S12.** Token manipulado en `sessionStorage` (cambiar caracteres): la comparación de hash SHA-256 en Sanctum falla → `401`.
- [ ] **S13.** Request sin header `Accept: application/json`: el interceptor global de axios siempre lo setea antes de enviar.
- [ ] **S14.** SQL injection en el campo email: Eloquent usa prepared statements; no es vulnerable.
- [ ] **S15.** XSS en respuestas: React escapa por defecto; la API no usa Blade, solo JSON.
- [ ] **S16.** Homoglyph attack (`аdmin@test.com` con `а` cirílica en lugar de `a` ASCII): `email:rfc` rechaza local-part no-ASCII con `422`.
- [ ] **S17.** Brute force: cubierto por el rate limit de `throttle:5,1` (5 intentos/min/IP).

## Acceptance Criteria

- [ ] **AC1.** **Given** credenciales válidas (`admin@test.com` / `admin123`) y cuenta activa, **when** `POST /api/auth/login` con `{email, password}`, **then** responde 200 con `{user: UserResource, token: "<string>"}`.   PASS / FAIL
- [ ] **AC2.** **Given** respuesta de AC1, **when** frontend recibe el body, **then** guarda `token` en `sessionStorage` bajo clave `auth.token` y `user` en contexto de auth.   PASS / FAIL
- [ ] **AC3.** **Given** sesión activa, **when** navega a `/tablero`, **then** la página carga sin redirigir a `/login`.   PASS / FAIL
- [ ] **AC4.** **Given** sesión activa, **when** navega a `/dashboard`, **then** la página carga sin redirigir a `/login`.   PASS / FAIL
- [ ] **AC5.** **Given** email NO registrado, **when** `POST /api/auth/login`, **then** responde 422 con `{"errors": {"email": ["Las credenciales de acceso son incorrectas"]}}`.   PASS / FAIL
- [ ] **AC6.** **Given** email registrado pero password incorrecto, **when** `POST /api/auth/login`, **then** responde 422 con el mismo mensaje genérico del AC5 (anti-enumeración).   PASS / FAIL
- [ ] **AC7.** **Given** cuenta con `is_active=false`, **when** `POST /api/auth/login`, **then** responde 422 con `{"errors": {"email": ["Tu cuenta está inactiva. Contacta al administrador del sistema"]}}`.   PASS / FAIL
- [ ] **AC8.** **Given** email con formato inválido (`"no-es-email"`), **when** `POST`, **then** responde 422 con error de validación en campo `email`.   PASS / FAIL
- [ ] **AC9.** **Given** campo `password` vacío o ausente, **when** `POST`, **then** responde 422 con error en campo `password`.   PASS / FAIL
- [ ] **AC10.** **Given** ≥6 intentos de login fallidos desde misma IP en ≤60s, **when** `POST`, **then** responde 429 con header `Retry-After`.   PASS / FAIL
- [ ] **AC11.** **Given** token Bearer válido + `is_active=true`, **when** `GET /api/auth/me` con header `Authorization: Bearer <token>`, **then** responde 200 con `UserResource` del usuario actual.   PASS / FAIL
- [ ] **AC12.** **Given** request autenticado exitoso, **when** backend responde, **then** `users.last_activity_at` se actualizó a `now()` en la DB.   PASS / FAIL
- [ ] **AC13.** **Given** `GET /api/auth/me` con token inválido, **when** backend responde, **then** 401.   PASS / FAIL
- [ ] **AC14.** **Given** usuario autenticado pero `is_active=false` (desactivado en medio de sesión), **when** siguiente request autenticado, **then** responde 403 con `{"message": "Tu cuenta está inactiva. Contacta al administrador del sistema"}`.   PASS / FAIL
- [ ] **AC15.** **Given** token revocado en DB (logout previo), **when** request autenticado, **then** responde 401.   PASS / FAIL
- [ ] **AC16.** **Given** frontend recibe 401 en cualquier request autenticado, **when** se procesa la respuesta, **then** limpia `sessionStorage` y redirige a `/login` con mensaje `"Tu sesión expiró. Inicia sesión nuevamente."`.   PASS / FAIL
- [ ] **AC17.** **Given** frontend recibe 403 con mensaje de desactivación, **then** limpia `sessionStorage` y redirige a `/login` con ese mensaje.   PASS / FAIL
- [ ] **AC18.** **Given** sesión activa, **when** `POST /api/auth/logout`, **then** responde 204 y el token deja de existir en `personal_access_tokens`.   PASS / FAIL
- [ ] **AC19.** **Given** doble logout (token ya revocado), **when** segundo `POST /api/auth/logout`, **then** frontend limpia localmente y redirige a `/login` (idempotente).   PASS / FAIL
- [ ] **AC20.** **Given** email con espacios al inicio/final + mayúsculas (`"  Admin@Test.COM  "`), **when** `POST`, **then** backend trimea + lowercases antes de buscar (login funciona si el email registrado es `admin@test.com`).   PASS / FAIL
- [ ] **AC21.** **Given** password de 7 caracteres, **when** `POST`, **then** 422 con error `{"password": ["El password debe tener al menos 8 caracteres"]}`.   PASS / FAIL
- [ ] **AC22.** **Given** password de 65 caracteres, **when** `POST`, **then** 422 con error `{"password": ["El password no puede tener más de 64 caracteres"]}`.   PASS / FAIL
- [ ] **AC23.** **Given** email con subaddressing (`"admin+test@test.com"`), **when** `POST`, **then** se acepta el formato (rechaza solo si no está registrado).   PASS / FAIL
- [ ] **AC24.** **Given** F5 en `/tablero` con token válido en `sessionStorage`, **when** monta la app, **then** llama `GET /api/auth/me` → 200 → mantiene sesión.   PASS / FAIL
- [ ] **AC25.** **Given** F5 en `/tablero` SIN token en `sessionStorage`, **when** monta la app, **then** `/api/auth/me` no se llama (o devuelve 401) → redirige a `/login`.   PASS / FAIL
- [ ] **AC26.** **Given** URL inválida del frontend (ej: `/cualquier-cosa-que-no-existe`), **when** navega, **then** muestra componente `<NotFound />` con texto `"Página no encontrada"` + link a `/tablero` (si autenticado) o `/login` (si no).   PASS / FAIL
- [ ] **AC27.** **Given** cualquier request HTTP desde el frontend, **when** se envía, **then** incluye header `Accept: application/json`.   PASS / FAIL
- [ ] **AC28.** **Given** sesión activa, **when** cualquier request, **then** incluye `Authorization: Bearer <token>` en el header.   PASS / FAIL
- [ ] **AC29.** **Given** request HTTP del frontend, **when** pasan 10 segundos sin respuesta, **then** frontend aborta el request y muestra toast `"La solicitud tardó demasiado. Intenta nuevamente."`.   PASS / FAIL
- [ ] **AC30.** **Given** doble click rápido en botón "Iniciar sesión", **when** el primer request está en curso, **then** el botón queda `disabled` y no se envía un segundo request.   PASS / FAIL
- [ ] **AC31.** **Given** 50 pestañas abiertas con el mismo token en `sessionStorage`, **when** cada una monta, **then** cada una llama `/api/auth/me` y recibe 200.   PASS / FAIL
- [ ] **AC32.** **Given** logout en pestaña A, **when** pestaña B hace siguiente request, **then** recibe 401 y redirige a `/login`.   PASS / FAIL
- [ ] **AC33.** **Given** un login fallido, **when** se registra el evento en log, **then** el log NO contiene el password ni el email completo (solo `user_id` si existe, IP truncada o hasheada).   PASS / FAIL
- [ ] **AC34.** **Given** un login exitoso, **when** se registra el evento, **then** log contiene `auth.login.ok` con `user_id` e IP (sin token).   PASS / FAIL
- [ ] **AC35.** **Given** rate limit excedido, **when** se registra, **then** log contiene `auth.login.throttled` con IP truncada/hasheada.   PASS / FAIL
- [ ] **AC36.** **Given** `docker compose up backend`, **when** los contenedores están healthy, **then** `POST /api/auth/login` responde (no 404 de ruta).   PASS / FAIL
- [ ] **AC37.** **Given** seeders ejecutados, **when** consulta DB, **then** existen `admin@test.com` con `role=admin` + `is_active=true` y `user@test.com` con `role=user` + `is_active=true`, ambos con passwords hasheados.   PASS / FAIL
