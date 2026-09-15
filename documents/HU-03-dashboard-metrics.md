# HU-03 — Dashboard de Métricas

## Description

Construir la pantalla `/dashboard` que muestra el total de notas del tablero y su distribución por los tres estados canónicos (`Pendiente`, `En curso`, `Hecho`). Las métricas se computan en AWS Lambda (requisito explícito de la prueba técnica §3) y el backend Laravel actúa como proxy que valida sesión, centraliza CORS y homogeneiza el formato de respuesta. El frontend renderiza conteos absolutos + porcentajes + colores consistentes con el tablero, sin auto-refresh: el usuario recarga con F5 o navegando fuera y volviendo. El alcance de esta HU también corrige el bug de la query de Lambda que actualmente cuenta notas soft-deleted (debe agregar `WHERE deleted_at IS NULL`).

## Dependencies and Blockers

- [ ] HU-01 implementada (autenticación con Sanctum Bearer + middleware `EnsureUserIsActive` + axios interceptor con timeout 10s).
- [ ] HU-02 implementada (CRUD de notas + endpoint `GET /api/notes` que usa `SoftDeletes` trait + ruta `/tablero` + sidebar con estado activo).
- [ ] `lambda/app.ts` existe y es funcional (60 líneas, handler `DashboardMetricsFunction` con query a Postgres). **Único cambio requerido en Lambda:** agregar `WHERE deleted_at IS NULL` al query.
- [ ] `lambda/template.yaml` expone `GET /metrics` vía API Gateway (ya configurado, no requiere cambios).
- [ ] `docker-compose.yml` incluye el servicio `lambda_local` en puerto `3001` con env vars de DB (ya configurado).
- [ ] Nuevo endpoint backend `GET /api/metrics` (controlador + ruta + validación de Sanctum + log de auditoría).
- [ ] Nueva ruta frontend `/dashboard` (page component + entrada en `react-router-dom` 7 + estado activo del sidebar).
- [ ] Variable de entorno backend `LAMBDA_METRICS_URL` configurable:
  - Local (Docker): `http://lambda_local:3001` (nombre del servicio docker).
  - AWS: URL del API Gateway Stage.

## Assumptions

### Backend

- [ ] **B1.** Laravel hace de proxy: recibe `GET /api/metrics`, valida sesión Sanctum, llama a Lambda por HTTP y devuelve la respuesta transformada al frontend.
- [ ] **B2.** La Lambda queda como cómputo puro, sin auth (la responsabilidad de autenticación vive en el backend).
- [ ] **B3.** La Lambda responde `{total, pendiente, en_curso, hecho}` (verificado en `lambda/app.ts`).
- [ ] **B4.** El backend usa `Http::timeout(5)->get(env('LAMBDA_METRICS_URL'))` del HTTP client de Laravel.
- [ ] **B5.** `LAMBDA_METRICS_URL`: local → `http://lambda_local:3001`; AWS → URL de API Gateway.
- [ ] **B6.** El backend transforma el payload de Lambda a `{total: N, by_status: {"Pendiente": N, "En curso": N, "Hecho": N}, last_updated: ISO8601}`.
- [ ] **B7.** El backend emite log info `metrics.fetched` con `user_id` y `duration_ms` en cada fetch exitoso.
- [ ] **B8.** El backend maneja errores de Lambda (timeout, connection refused, 4xx/5xx, JSON malformado) y responde **503 Service Unavailable** con `{message: "No se pudieron cargar las métricas"}`.
- [ ] **B9.** El query de Lambda se modifica a `FROM notes WHERE deleted_at IS NULL` (1 línea, alineado con HU-02).
- [ ] **B10.** `last_activity_at` se actualiza en cada request autenticado (heredado de HU-01).

### Frontend

- [ ] **F1.** Ruta `/dashboard` protegida; redirige a `/login` si no hay sesión válida (chequeo de `/api/auth/me` en `useEffect` de mount).
- [ ] **F2.** En mount se dispara `GET /api/metrics` con `Authorization: Bearer <token>` y `Accept: application/json`.
- [ ] **F3.** Spinner visible durante el fetch.
- [ ] **F4.** En respuesta 200: render del total (número grande) + 3 cards (uno por estado) con conteo absoluto + porcentaje + color de estado.
- [ ] **F5.** Indicador `"Última actualización: HH:MM:SS"` debajo del grid de cards.
- [ ] **F6.** Sin auto-refresh. Refresh = F5 del navegador o navegar a otra ruta y volver.
- [ ] **F7.** Sidebar muestra "Dashboard" como activo cuando la ruta es `/dashboard`. Link "Tablero" apunta a `/tablero`.
- [ ] **F8.** Requests en vuelo cancelados si el usuario dispara F5 antes de que termine (Axios cancel token).
- [ ] **F9.** Si `total === 0`, se renderiza `"No hay notas todavía"` (empty state en lugar de cards en cero).
- [ ] **F10.** En respuesta 503: toast `"No se pudieron cargar las métricas. Reintenta."` + botón "Reintentar".

## Out of Scope

None identified — user explicitly confirmed the following related items are in-scope after guided prompting: HU-01 (autenticación), HU-02 (tablero de notas con SoftDeletes), fix de la query de Lambda para soft-deleted, endpoint proxy `GET /api/metrics` en Laravel, ruta frontend `/dashboard`, manejo de errores completo (timeout, Lambda caída, errores 5xx), estados vacíos, indicadores de última actualización y spinner. **Fuera del alcance explícito de HU-03:**

- [ ] Auto-refresh (decisión explícita del doc: "al volver a abrir o recargar").
- [ ] Charts (pie, bar, tendencias).
- [ ] Métricas históricas en el tiempo.
- [ ] Comparaciones entre períodos (ayer vs hoy).
- [ ] Filtros por rango de fechas.
- [ ] Notificaciones cuando N notas en algún estado.
- [ ] Métricas por usuario (no ownership).
- [ ] Métricas adicionales (creadas hoy, eliminadas, modificadas, etc.).
- [ ] Exportación de métricas (CSV/PDF).
- [ ] WebSockets / SSE push.
- [ ] Caché (backend o frontend) — refetch en cada mount.
- [ ] Caché en Lambda.
- [ ] Auth en Lambda.
- [ ] Dark mode.
- [ ] Personalización de layout / drag-and-drop de widgets.
- [ ] Modo fullscreen.
- [ ] Tabs / secciones dentro del dashboard.
- [ ] Tests (decisión del proyecto).
- [ ] i18n (solo español).

## Variables and Configuration

| Variable | Type | Environments | Default value | Description |
|----------|------|--------------|---------------|-------------|
| `LAMBDA_METRICS_URL` | string (URL) | backend (Laravel) | `http://lambda_local:3001` local / API Gateway URL en AWS | URL completa del endpoint de métricas. Local usa el nombre del servicio docker `lambda_local:3001`. AWS usa la URL del API Gateway Stage (output `DashboardApiUrl` del SAM template). |
| `DB_HOST` | string | lambda | `db` (AWS: parámetro SAM) | Host de Postgres para la Lambda. |
| `DB_PORT` | integer | lambda | `5432` | Puerto de Postgres. |
| `DB_USER` | string | lambda | `fixlat_user` | Usuario de DB para la Lambda. |
| `DB_PASSWORD` | string | lambda | `fixlat_password` (dev) | Password de DB. En producción viene de Secrets Manager / env seguro, nunca hardcodeado. |
| `DB_NAME` | string | lambda | `fixlat_db` | Nombre de la DB. |
| Status colors (frontend) | hex color | frontend | `#FFF275` (Pendiente) / `#90E0EF` (En curso) / `#80ED99` (Hecho) | Colores de fondo de cada card de estado, consistentes con el tablero de HU-02. |
| Frontend timeout | integer (ms) | frontend | `10000` | Timeout axios (axios interceptor, heredado de HU-01). Cubre 5s backend + 5s Lambda + margen. |
| Backend → Lambda timeout | integer (s) | backend | `5` | `Http::timeout(5)` en el HTTP client de Laravel. |

## Happy Path

### Flujo 1 — Cargar dashboard `/dashboard`

1. Usuario autenticado navega a `/dashboard` (por sidebar, link directo, o F5).
2. Frontend monta el componente → dispara `GET /api/metrics` con `Authorization: Bearer <token>` y `Accept: application/json`.
3. Backend: middleware `auth:sanctum` valida el token y carga el usuario.
4. Backend: middleware `EnsureUserIsActive` verifica `users.active === true`.
5. Backend: controlador llama a `Http::timeout(5)->get(env('LAMBDA_METRICS_URL'))`.
6. Lambda: query `SELECT COUNT(*) AS total, COUNT(CASE WHEN status='Pendiente' THEN 1 END) AS pendiente, ... FROM notes WHERE deleted_at IS NULL;` ejecuta contra Postgres.
7. Lambda: responde **200** con `{total, pendiente, en_curso, hecho}` + `Access-Control-Allow-Origin: *`.
8. Backend: transforma payload a `{total, by_status: {"Pendiente": N, "En curso": N, "Hecho": N}, last_updated: ISO8601}`.
9. Backend: emite log `metrics.fetched` con `user_id` y `duration_ms`.
10. Backend responde **200** con JSON transformado al frontend.
11. Frontend: oculta spinner, renderiza:
    - Número grande con el total.
    - 3 cards (una por estado) con conteo + porcentaje (1 decimal) + color de estado.
    - Indicador `"Última actualización: HH:MM:SS"` debajo del grid.

### Flujo 2 — Refrescar dashboard

1. Usuario presiona F5 O navega a `/tablero` y vuelve a `/dashboard`.
2. El componente se desmonta/remonta → se vuelve a ejecutar el Flujo 1 completo.
3. No hay caché: cada mount dispara un nuevo `GET /api/metrics`.

### Flujo 3 — Empty state

1. Si `total === 0`, el frontend renderiza `"No hay notas todavía"` en lugar del grid de cards (no se muestran cards con conteo cero).

## Sad Paths

### #1 — Lambda timeout (5s en backend)

- **Condition**: La Lambda excede 5s de respuesta (cold start lento, query pesada, deadlock de DB).
- **Expected behavior**: El HTTP client de Laravel aborta la conexión; el backend responde **503 Service Unavailable** con `{message: "No se pudieron cargar las métricas"}`.
- **Message/UI**: Frontend muestra toast `"No se pudieron cargar las métricas. Reintenta."` + botón "Reintentar".

### #2 — Lambda caída (connection refused)

- **Condition**: El servicio `lambda_local` (local) o la función Lambda (AWS) no responde — DNS resuelve pero conexión rechazada.
- **Expected behavior**: El HTTP client de Laravel lanza `ConnectionException`; el backend lo captura y responde **503** con el mismo payload.
- **Message/UI**: Mismo toast y botón "Reintentar" que #1.

### #3 — Lambda responde con error (4xx/5xx)

- **Condition**: API Gateway o la propia Lambda responde con status no-2xx (ej. 500 por error de query, 403 por IAM).
- **Expected behavior**: El backend responde **503** (homogeneiza cualquier error upstream como indisponibilidad).
- **Message/UI**: Mismo toast y botón "Reintentar".

### #4 — Lambda responde con formato inválido

- **Condition**: El JSON de Lambda no se puede parsear o no tiene las claves esperadas (`total`, `pendiente`, `en_curso`, `hecho`).
- **Expected behavior**: El backend captura la excepción de parse, emite log warn con el payload recibido y responde **503**.
- **Message/UI**: Mismo toast + backend loguea el error de parse para diagnóstico.

### #5 — Backend 500 inesperado

- **Condition**: Error no controlado en el backend (bug, NullPointerException, DB local caída).
- **Expected behavior**: Laravel renderiza la página de error 500 estándar.
- **Message/UI**: Frontend muestra toast `"Error inesperado. Intenta nuevamente."` + botón "Reintentar".

### #6 — Backend 401 (token inválido o expirado)

- **Condition**: El token Sanctum expiró, fue revocado, o nunca fue válido.
- **Expected behavior**: Frontend limpia `sessionStorage` (token + user), redirige a `/login`.
- **Message/UI**: Banner en `/login` con `"Tu sesión expiró. Inicia sesión nuevamente."`.

### #7 — Backend 403 (usuario `is_active=false`)

- **Condition**: El token es válido pero el usuario fue desactivado después del login.
- **Expected behavior**: Middleware `EnsureUserIsActive` rechaza la request.
- **Message/UI**: Frontend limpia `sessionStorage`, redirige a `/login` con `"Tu cuenta está inactiva. Contacta al administrador del sistema."`.

### #8 — Timeout total en frontend (10s)

- **Condition**: Backend (5s) + Lambda (5s) + overhead de red → excede el timeout configurado en el axios interceptor.
- **Expected behavior**: Axios aborta la request con error de timeout.
- **Message/UI**: Toast `"La solicitud tardó demasiado. Intenta nuevamente."` + botón "Reintentar".

### #9 — Backend completamente caído

- **Condition**: Nginx no responde, backend colgado, o red caída (frontend no puede ni llegar al proxy).
- **Expected behavior**: Axios recibe error de red (`ERR_NETWORK`).
- **Message/UI**: Toast `"No se pudo contactar al servidor. Verifica tu conexión."` + botón "Reintentar".

### #10 — Click en "Reintentar" después de error

- **Condition**: Usuario hace click en el botón tras ver un toast de error.
- **Expected behavior**: El frontend dispara de nuevo `GET /api/metrics` con un cancel token fresco; spinner visible durante el reintento; botón deshabilitado mientras hay request en vuelo.
- **Message/UI**: Spinner reemplaza el grid durante el reintento; al resolver éxito render normal; al volver a fallar mismo toast.

## Edge Cases

- [ ] **E1.** Total grande (ej. 10.000 notas) → renderiza con separadores de miles vía `Intl.NumberFormat('es-ES')`.
- [ ] **E2.** Reload mientras un fetch está en progreso → request anterior cancelado (Axios cancel token); solo se procesa el último.
- [ ] **E3.** 50 pestañas abiertas en `/dashboard` → cada una hace su propio fetch (no hay caché compartida); cada una muestra sus propias métricas según su token.
- [ ] **E4.** Clicks rápidos en "Reintentar" → botón deshabilitado durante el retry en vuelo (evita requests duplicados).
- [ ] **E5.** `total === 0` → empty state `"No hay notas todavía"` (no se muestran cards con conteo cero).
- [ ] **E6.** Una sola nota en un estado → esa card muestra `1 (100%)`; las otras `0 (0%)`.
- [ ] **E7.** Todas las notas en un solo estado → esa card muestra `N (100%)`; las otras `0 (0%)`.
- [ ] **E8.** Lambda cold start (primera invocación en AWS tras deploy / inactividad) → puede tardar 1-3s; el spinner absorbe y los 5s de timeout del backend lo cubren.
- [ ] **E9.** Lambda devuelve `by_status` cuya suma no coincide con `total` (inconsistencia upstream) → el frontend usa el campo `total` de Lambda como autoritativo para el número grande; los porcentajes se calculan sobre la suma de `by_status` (puede diferir levemente del total mostrado).
- [ ] **E10.** Lambda devuelve números negativos → inesperado; frontend los muestra tal cual; backend loguea la inconsistencia como warning.

### Bug fix en scope (Lambda)

- [ ] **E11.** **Bug actual:** el query de `lambda/app.ts` NO filtra notas soft-deleted (`FROM notes;` cuenta filas con `deleted_at` no nulo). **Fix en scope de HU-03:** modificar a `FROM notes WHERE deleted_at IS NULL;` (cambio de 1 línea). Esto alinea el conteo del dashboard con el comportamiento de `GET /api/notes` de HU-02 que usa el trait Eloquent `SoftDeletes` para excluir soft-deleted.

## Stupid Cases

- [ ] **S1.** Doble F5 muy rápido → request anterior cancelado; solo se procesa el último (Axios cancel token).
- [ ] **S2.** Clicks rápidos en "Reintentar" → botón deshabilitado durante retry en vuelo; no se disparan requests duplicados.
- [ ] **S3.** Lambda devuelve HTML por error de configuración (ej. path mal apuntado, proxy en medio responde página de error) → backend intenta parsear JSON, falla → responde **503** + toast.
- [ ] **S4.** Backend devuelve HTML por error de routing (ej. Nginx sirve 404 page) → frontend muestra `"Error inesperado. Intenta nuevamente."`.
- [ ] **S5.** Token expira mid-fetch → frontend recibe 401 → limpia `sessionStorage` → redirige a `/login` con mensaje de sesión expirada.
- [ ] **S6.** 100 pestañas en `/dashboard` → 100 fetches simultáneos (en local no hay problema; en AWS real podría agotar concurrencia de Lambda si la cuenta tiene límites bajos — fuera de scope).
- [ ] **S7.** Usuario navega a `/tablero` mientras se cargan métricas → route change cancela el request en vuelo; no se muestra error; al volver se reintenta automáticamente.
- [ ] **S8.** Minimizar ventana y volver horas después → métricas quedan con los valores del último fetch exitoso (no hay auto-refresh, decisión explícita del doc).
- [ ] **S9.** Deshabilitar JavaScript del navegador → la página no carga métricas; queda en empty state; no es objetivo de esta HU.
- [ ] **S10.** Inspeccionar tráfico de red → se ve el call a `/api/metrics` y (vía logs del backend) la llamada a Lambda — comportamiento esperado y correcto.
- [ ] **S11.** Pegar `/dashboard` en ventana de incognito sin sesión → `useEffect` de mount llama a `/api/auth/me` → falla → redirige a `/login`.
- [ ] **S12.** Bypass del frontend (consumir `/api/metrics` directamente con Postman) → funciona con token Sanctum válido; sin token → 401; usuario inactivo → 403 (auth transversal honrada).

## Acceptance Criteria

- [ ] **AC1.** **Given** HU-01 y HU-02 implementadas, **when** login OK, **then** `/dashboard` accesible.   PASS / FAIL
- [ ] **AC2.** **Given** `docker compose up`, **when** backend y `lambda_local` healthy, **then** `GET /api/metrics` responde 200.   PASS / FAIL
- [ ] **AC3.** **Given** sesión activa + DB con N notas, **when** navega a `/dashboard`, **then** muestra total grande + 3 cards por estado (con conteo y porcentaje) + `"Última actualización: HH:MM:SS"`.   PASS / FAIL
- [ ] **AC4.** **Given** `total > 0`, **when** renderiza, **then** cada card muestra conteo absoluto + porcentaje (redondeado a 1 decimal).   PASS / FAIL
- [ ] **AC5.** **Given** `total === 0`, **when** renderiza, **then** muestra `"No hay notas todavía"` (no conteos en cero).   PASS / FAIL
- [ ] **AC6.** **Given** estado `Pendiente`, **when** renderiza su card, **then** fondo amarillo `#FFF275`.   PASS / FAIL
- [ ] **AC7.** **Given** estado `En curso`, **when** renderiza su card, **then** fondo azul `#90E0EF`.   PASS / FAIL
- [ ] **AC8.** **Given** estado `Hecho`, **when** renderiza su card, **then** fondo verde `#80ED99`.   PASS / FAIL
- [ ] **AC9.** **Given** sesión activa, **when** `GET /api/metrics`, **then** backend responde 200 con `{total, by_status: {"Pendiente", "En curso", "Hecho"}, last_updated}`.   PASS / FAIL
- [ ] **AC10.** **Given** request, **when** backend llama a Lambda, **then** log info contiene `metrics.fetched` con `user_id` y `duration_ms`.   PASS / FAIL
- [ ] **AC11.** **Given** Lambda responde, **when** backend transforma, **then** formato es el del AC9 (frontend no depende del formato de Lambda).   PASS / FAIL
- [ ] **AC12.** **Given** backend llama a Lambda, **then** la llamada HTTP tiene timeout 5s (`Http::timeout(5)`).   PASS / FAIL
- [ ] **AC13.** **Given** Lambda timeout (5s), **when** backend aborta, **then** responde 503 al frontend.   PASS / FAIL
- [ ] **AC14.** **Given** Lambda caída, **when** backend intenta llamar, **then** responde 503.   PASS / FAIL
- [ ] **AC15.** **Given** Lambda responde con error (4xx/5xx), **when** backend recibe, **then** responde 503.   PASS / FAIL
- [ ] **AC16.** **Given** Lambda responde con formato inválido, **when** backend parsea, **then** responde 503.   PASS / FAIL
- [ ] **AC17.** **Given** frontend recibe 503, **when** muestra, **then** toast `"No se pudieron cargar las métricas. Reintenta."` + botón "Reintentar".   PASS / FAIL
- [ ] **AC18.** **Given** frontend configurado con timeout 10s (cubre el timeout interno del backend), **then** el total visible para el usuario no excede 10s.   PASS / FAIL
- [ ] **AC19.** **Given** backend caído, **when** frontend intenta, **then** toast `"No se pudo contactar al servidor. Verifica tu conexión."`.   PASS / FAIL
- [ ] **AC20.** **Given** backend 500, **when** frontend recibe, **then** toast `"Error inesperado. Intenta nuevamente."`.   PASS / FAIL
- [ ] **AC21.** **Given** 401, **when** frontend recibe, **then** limpia `sessionStorage`, redirige a `/login` con `"Tu sesión expiró. Inicia sesión nuevamente."`.   PASS / FAIL
- [ ] **AC22.** **Given** 403 con mensaje de inactividad, **when** frontend recibe, **then** limpia y redirige con ese mensaje.   PASS / FAIL
- [ ] **AC23.** **Given** click en "Reintentar" tras error, **when** frontend procesa, **then** repite `GET /api/metrics`.   PASS / FAIL
- [ ] **AC24.** **Given** nota soft-deleted en DB, **when** Lambda ejecuta query, **then** esa nota NO se cuenta (total y breakdown correctos).   PASS / FAIL
- [ ] **AC25.** **Given** tabla `notes`, **when** se inspecciona la query de `lambda/app.ts`, **then** contiene `WHERE deleted_at IS NULL`.   PASS / FAIL
- [ ] **AC26.** **Given** request sin token a `/api/metrics`, **when** backend recibe, **then** 401.   PASS / FAIL
- [ ] **AC27.** **Given** request con token de usuario `is_active=false`, **when** backend recibe, **then** 403.   PASS / FAIL
- [ ] **AC28.** **Given** dashboard cargado, **when** usuario navega a `/tablero` y vuelve a `/dashboard`, **then** métricas se re-fetchan (sin caché).   PASS / FAIL
- [ ] **AC29.** **Given** dashboard cargado, **when** F5, **then** métricas se re-fetchan.   PASS / FAIL
- [ ] **AC30.** **Given** ruta `/dashboard`, **when** renderiza sidebar, **then** "Dashboard" se muestra como activo.   PASS / FAIL
- [ ] **AC31.** **Given** click en "Tablero" del sidebar, **when** navega, **then** redirige a `/tablero`.   PASS / FAIL
- [ ] **AC32.** **Given** 10 pestañas en `/dashboard`, **when** cada una monta, **then** cada una hace su propio `GET /api/metrics` con su token.   PASS / FAIL
- [ ] **AC33.** **Given** F5 muy rápido, **when** frontend aborta el request anterior, **then** solo se procesa el último.   PASS / FAIL