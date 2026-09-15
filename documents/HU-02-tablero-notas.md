# HU-02: Tablero de Notas

## Description

Tablero único y compartido de post-its (`prueba-tecnica.md §5`), manipulable vía drag & drop libre, donde todos los usuarios activos pueden crear, editar, mover y eliminar notas sin distinción de autoría — `prueba-tecnica.md §2`: "Todos los usuarios activos pueden crear, editar, mover y eliminar todas las notas del tablero". No hay ownership, no hay filtro por autor, no hay diferenciación admin/user sobre notas. Los status canónicos son literales en español (`Pendiente`, `En curso`, `Hecho`) y NO se traducen ni renombran.

Esta HU depende de HU-01 (sesión Sanctum activa + middleware `EnsureUserIsActive`). El backend se construye en capas `Request → Controller → Service → Model → Resource` para la entidad `Note`, con un `FormRequest` por operación (`StoreNoteRequest`, `UpdateNoteRequest`, `UpdateNotePositionRequest`) y soft deletes vía el trait `SoftDeletes`. El frontend usa `@dnd-kit/core` para drag & drop libre (X/Y persistidos como `DOUBLE PRECISION`); la posición se envía al backend en `onDragEnd`, no durante el drag.

La estética referencia un canvas tipo Miro: tarjetas 220x220 px con `border-radius: 8px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`, paleta pastel por status (amarillo `#FFF275`, azul `#90E0EF`, verde `#80ED99`), fondo dot-grid `#F5F5F7`, cursor `grab` en hover y `grabbing` durante drag. La concurrencia se resuelve last-write-wins para posición; para contenido se aplica lock optimista vía `updated_at` con respuesta 409 al detectar edición sobre estado obsoleto. Eventos estructurados de logging (`notes.created`, `notes.updated`, `notes.deleted`, `notes.position_updated`) registran `user_id`, `note_id` y metadata operacional — nunca el contenido de las notas.

## Dependencies and Blockers

- [ ] HU-01 implementada y funcional (sesión activa es precondición para cualquier endpoint de notas).
- [ ] Nueva migración que crea la tabla `notes` (no existe aún — ver esquema completo abajo).
- [ ] Nuevo modelo Eloquent `App\Models\Note` con trait `SoftDeletes`.
- [ ] Rutas backend registradas: `GET /api/notes`, `POST /api/notes`, `GET /api/notes/{id}`, `PUT /api/notes/{id}`, `PATCH /api/notes/{id}/position`, `DELETE /api/notes/{id}`.
- [ ] Arquitectura backend en capas `Request → Controller → Service → Model → Resource` para `Note` (un `FormRequest` por operación: `StoreNoteRequest`, `UpdateNoteRequest`, `UpdateNotePositionRequest`).
- [ ] Ruta frontend `/tablero` con componente de página y componente de sidebar persistente.
- [ ] Interceptor axios de HU-01 aplica transparente a todos los endpoints de notas (token Bearer + manejo centralizado de 401/403).
- [ ] HU-03 (Dashboard) aún no implementada: el link "Dashboard" del sidebar navegará a `/dashboard` y mostrará una página placeholder hasta que se implemente esa HU.

Esquema esperado de la tabla `notes`:

```sql
CREATE TABLE notes (
    id              BIGSERIAL PRIMARY KEY,
    title           VARCHAR(120) NOT NULL,
    text            TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                       CHECK (status IN ('Pendiente', 'En curso', 'Hecho')),
    position_x      DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y      DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NULL,
    updated_at      TIMESTAMP NULL,
    deleted_at      TIMESTAMP NULL    -- soft delete
);

CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_notes_deleted_at ON notes(deleted_at);
```

## Assumptions

### Backend

- [ ] **B1.** Sanctum Bearer tokens (HU-01). Middleware `auth:sanctum` + `EnsureUserIsActive` aplican a todas las rutas `/api/notes`.
- [ ] **B2.** Nueva migración crea la tabla `notes` con el esquema documentado en la sección Dependencies.
- [ ] **B3.** Modelo `Note` usa el trait `SoftDeletes`; notas soft-deleted excluidas de queries por defecto (comportamiento de Laravel).
- [ ] **B4.** Las queries de listado NO filtran por usuario (sin ownership, sin per-author filtering).
- [ ] **B5.** Validaciones via `FormRequest`: `title` required string max:120; `text` nullable string max:2000; `status` required in:Pendiente,En curso,Hecho; `position_x`/`position_y` numeric (sin rango documentado, acepta negativos).
- [ ] **B6.** Soft delete vía `$note->delete()`. Backend NO provee endpoint de "restore".
- [ ] **B7.** Endpoints: `GET /api/notes`, `POST /api/notes`, `GET /api/notes/{id}`, `PUT /api/notes/{id}`, `PATCH /api/notes/{id}/position`, `DELETE /api/notes/{id}`.
- [ ] **B8.** Concurrencia: dos writes simultáneos → last-write-wins para posición; para edits de contenido, lock optimista vía `updated_at` (mismatch devuelve 409). NO realtime, NO CRDT.
- [ ] **B9.** `last_activity_at` se refresca en cada request autenticado (heredado de HU-01).
- [ ] **B10.** Eventos de log: `notes.created`, `notes.updated`, `notes.deleted`, `notes.position_updated`. Los logs NUNCA incluyen título/texto (solo `user_id`, `note_id` y metadata operacional).

### Frontend

- [ ] **F1.** Ruta `/tablero` es protegida; redirige a `/login` si no hay sesión válida (chequeo `/api/auth/me` on mount, establecido en HU-01).
- [ ] **F2.** Sidebar izquierdo persistente con "Tablero" (activo por defecto), "Dashboard" (link a `/dashboard` — placeholder hasta HU-03), nombre del usuario actual, botón "Cerrar sesión".
- [ ] **F3.** Canvas: container `position: relative` ocupando el área al costado del sidebar; fondo dot-grid sobre color base `#F5F5F7`.
- [ ] **F4.** Notas: `position: absolute`, tamaño 220x220 px, `border-radius: 8px`, sombra sutil, fondo pastel por status.
- [ ] **F5.** Drag con `@dnd-kit/core` (`useDraggable` por nota). UI actualiza posición durante drag; persistencia vía `PATCH /api/notes/{id}/position` solo en `onDragEnd`.
- [ ] **F6.** Edición directa e inline: cada nota siempre muestra campos editables (sin modo lectura/edición separado). El botón "Guardar" persiste los tres campos (título, texto, status) en un único PUT.
- [ ] **F7.** Cambio de status vía dropdown con tres opciones. Cambio de status es solo local; se persiste únicamente al click en Guardar. NO hay auto-save.
- [ ] **F8.** Posición inicial al crear: centro del viewport visible, calculado como `(window.innerWidth - 220) / 2`, `(window.innerHeight - 220) / 2`.
- [ ] **F9.** Ante respuesta 200, el frontend reemplaza estado local con la respuesta del servidor. Ante 4xx/5xx, mantiene modo edición con datos del usuario y muestra toast con mensaje del backend.
- [ ] **F10.** Cursor `grab` en hover sobre nota, `grabbing` durante drag, con elevación de sombra mientras se arrastra.
- [ ] **F11.** Botones "Guardar", "Cancelar" y "Eliminar" siempre visibles en cada nota (sin estados de modo lectura que los oculten).
- [ ] **F12.** NO hay snap-to-grid, NO hay debounce sobre drag, NO hay límite máximo de notas en el tablero (decisiones explícitas fuera del documento base).
- [ ] **F13.** Confirmación de borrado vía `window.confirm("¿Eliminar esta nota?")` antes de ejecutar `DELETE`.

## Out of Scope

- [ ] Tableros múltiples (un único tablero compartido por `prueba-tecnica.md §5`).
- [ ] Columnas, secciones, agrupamientos, ordenamientos.
- [ ] Ownership, vista "mis notas", filtro por autor.
- [ ] Diferenciación de roles sobre notas (admin vs user).
- [ ] Permisos granulares más allá de "autenticado y activo".
- [ ] Restaurar notas soft-deleted.
- [ ] Due dates, recordatorios, menciones.
- [ ] Comentarios, adjuntos, imágenes embebidas.
- [ ] Notificaciones, historial/versiones, categorías/tags/colores custom.
- [ ] Búsqueda, filtros, ordenamiento.
- [ ] Duplicar nota, archivar nota.
- [ ] Colaboración realtime (WebSockets, CRDT, OT).
- [ ] Cursores en vivo, locking optimista/pesimista más allá de `updated_at`.
- [ ] Undo/Redo.
- [ ] Atajos de teclado.
- [ ] Copiar/pegar notas.
- [ ] Multi-select.
- [ ] Pan/zoom de canvas, scroll infinito.
- [ ] Persistencia offline / Service Worker.
- [ ] Cache local (refetch en cada mount).
- [ ] i18n (solo español).
- [ ] Dark mode.
- [ ] Tests automatizados (decisión de proyecto).

## Variables and Configuration

| Variable | Type | Environments | Default value | Description |
|----------|------|--------------|---------------|-------------|
| `NOTE_STATUS_PENDIENTE` | string (literal canónico) | dev, staging, prod | `Pendiente` | Status canónico de nota. NO traducir, NO renombrar. |
| `NOTE_STATUS_EN_CURSO` | string (literal canónico) | dev, staging, prod | `En curso` | Status canónico de nota. NO traducir, NO renombrar. |
| `NOTE_STATUS_HECHO` | string (literal canónico) | dev, staging, prod | `Hecho` | Status canónico de nota. NO traducir, NO renombrar. |
| `NOTE_TITLE_MAX_LENGTH` | integer | dev, staging, prod | `120` | Máximo de caracteres para `title` (validación servidor + `maxLength` cliente). |
| `NOTE_TEXT_MAX_LENGTH` | integer | dev, staging, prod | `2000` | Máximo de caracteres para `text` (validación servidor). |
| `NOTE_CARD_WIDTH_PX` | integer (px) | dev, staging, prod | `220` | Ancho de tarjeta de nota. |
| `NOTE_CARD_HEIGHT_PX` | integer (px) | dev, staging, prod | `220` | Alto de tarjeta de nota. |
| `NOTE_CARD_BORDER_RADIUS` | string | dev, staging, prod | `8px` | Radio de borde de la tarjeta. |
| `NOTE_CARD_BOX_SHADOW` | string | dev, staging, prod | `0 2px 8px rgba(0,0,0,0.1)` | Sombra de tarjeta en estado normal. |
| `NOTE_CARD_PADDING` | string | dev, staging, prod | `12-16px` | Padding interno de la tarjeta. |
| `NOTE_COLOR_PENDIENTE` | hex | dev, staging, prod | `#FFF275` | Fondo de tarjeta para status `Pendiente`. |
| `NOTE_COLOR_EN_CURSO` | hex | dev, staging, prod | `#90E0EF` | Fondo de tarjeta para status `En curso`. |
| `NOTE_COLOR_HECHO` | hex | dev, staging, prod | `#80ED99` | Fondo de tarjeta para status `Hecho`. |
| `CANVAS_BG_COLOR` | hex | dev, staging, prod | `#F5F5F7` | Color de fondo del lienzo del tablero. |
| `CURSOR_ON_NOTE_HOVER` | string (CSS cursor) | dev, staging, prod | `grab` | Cursor sobre nota en estado hover (modo vista). |
| `CURSOR_ON_NOTE_DRAG` | string (CSS cursor) | dev, staging, prod | `grabbing` | Cursor durante drag de nota. |
| `NOTE_REQUEST_TIMEOUT_MS` | integer (ms) | dev, staging, prod | `10000` | Timeout de axios para endpoints de notas (10s). |
| `LOG_EVENT_NOTE_CREATED` | string | dev, staging, prod | `notes.created` | Nombre del evento de log al crear nota. |
| `LOG_EVENT_NOTE_UPDATED` | string | dev, staging, prod | `notes.updated` | Nombre del evento de log al editar contenido. |
| `LOG_EVENT_NOTE_DELETED` | string | dev, staging, prod | `notes.deleted` | Nombre del evento de log al soft-delete. |
| `LOG_EVENT_NOTE_POSITION_UPDATED` | string | dev, staging, prod | `notes.position_updated` | Nombre del evento de log al mover nota. |
| `LOG_EVENT_NOTE_LISTED` | string | dev, staging, prod | `notes.listed` | Nombre del evento de log al listar notas (opcional). |

## Happy Path

### Flow 1 — Cargar tablero `/tablero` (Frontend → Backend)

1. Usuario autenticado navega a `/tablero`.
2. Frontend monta el componente → dispara `GET /api/notes`.
3. Backend: middleware `auth:sanctum` + `EnsureUserIsActive` pasan → responde 200 con `[NoteResource, ...]`.
4. Backend loguea `notes.listed` con `user_id` (opcional).
5. Frontend renderiza cada nota con `position: absolute`, `top: position_y px, left: position_x px`.

### Flow 2 — Crear nota (Frontend → Backend)

1. Usuario click en "+" o "Nueva nota".
2. Frontend crea nota temporal en estado local con `id = temp-<uuid>`.
3. Frontend calcula posición inicial: `(window.innerWidth - 220) / 2`, `(window.innerHeight - 220) / 2`.
4. Valores iniciales: `title=""`, `text=""`, `status="Pendiente"`.
5. Frontend → `POST /api/notes` con `{title, text, status, position_x, position_y}`.
6. Backend: `StoreNoteRequest` valida campos.
7. Backend: `NoteService::create` crea la nota.
8. Backend loguea `notes.created` con `user_id`, `note_id`.
9. Backend responde **201** con `NoteResource`.
10. Frontend reemplaza la nota temporal por la real en el estado local.

### Flow 3 — Editar nota (título + texto + status) (Frontend → Backend)

1. La nota siempre muestra campos editables (sin modo lectura/edición separado).
2. Usuario escribe directo sobre la nota → estado local actualiza (NO se persiste).
3. Usuario cambia `status` vía dropdown → también solo local.
4. Usuario click "Guardar" → `PUT /api/notes/{id}` con `{title, text, status, updated_at}`.
5. Backend: `UpdateNoteRequest` valida campos.
6. Backend: verifica `$note->updated_at->timestamp === $request->updated_at`. **Mismatch → 409 Conflict** con estado actual del servidor en payload.
7. Backend: actualiza campos, setea `updated_at = now()`.
8. Backend loguea `notes.updated` con `user_id`, `note_id`, `fields_changed`.
9. Backend responde **200** con `NoteResource` actualizado.
10. Frontend actualiza estado local con la respuesta.

### Flow 4 — Mover nota (drag & drop) (Frontend → Backend)

1. Usuario hace `mousedown` sobre la nota → cursor `grabbing`, sombra elevada.
2. Usuario arrastra → la nota sigue el cursor en UI (estado local).
3. **NO se envía request durante el drag.**
4. Usuario suelta (`onDragEnd`) → frontend calcula nuevos `position_x`, `position_y`.
5. Frontend → `PATCH /api/notes/{id}/position` con `{position_x, position_y}`.
6. Backend: actualiza solo la posición.
7. Backend loguea `notes.position_updated` con `user_id`, `note_id`, `position_x`, `position_y`.
8. Backend responde **204**.

### Flow 5 — Eliminar nota (Frontend → Backend)

1. Usuario click "Eliminar".
2. `window.confirm("¿Eliminar esta nota?")`.
3. Si cancela → no se hace nada.
4. Si OK → `DELETE /api/notes/{id}`.
5. Backend: `$note->delete()` (soft delete) setea `deleted_at = now()`.
6. Backend loguea `notes.deleted` con `user_id`, `note_id`.
7. Backend responde **204**.
8. Frontend remueve la nota del estado local.

### Flow 6 — Cancelar edición (solo Frontend)

1. Usuario tiene cambios locales pendientes en una nota.
2. Click "Cancelar" → frontend descarta estado local, restaura valores de la última respuesta del servidor.

## Sad Paths

### POST /api/notes — Validación 422 (título vacío)

- **Condition**: Usuario crea nota sin título.
- **Expected behavior**: Backend rechaza via `StoreNoteRequest` (`title` required).
- **Message/UI**: Toast con `"El título es obligatorio"`.

### POST /api/notes — Validación 422 (título >120 chars)

- **Condition**: Usuario envía `title` con más de 120 caracteres.
- **Expected behavior**: Backend rechaza via `StoreNoteRequest`.
- **Message/UI**: Toast con `"El título no puede tener más de 120 caracteres"`.

### POST /api/notes — Validación 422 (texto >2000 chars)

- **Condition**: Usuario envía `text` con más de 2000 caracteres.
- **Expected behavior**: Backend rechaza via `StoreNoteRequest`.
- **Message/UI**: Toast con `"El texto no puede tener más de 2000 caracteres"`.

### POST /api/notes — Validación 422 (status inválido)

- **Condition**: Usuario envía `status` fuera de `Pendiente|En curso|Hecho`.
- **Expected behavior**: Backend rechaza via `StoreNoteRequest`.
- **Message/UI**: Toast con `"El estado debe ser Pendiente, En curso o Hecho"`.

### POST /api/notes — Validación 422 (posición no numérica)

- **Condition**: Usuario envía `position_x`/`position_y` con NaN o string.
- **Expected behavior**: Backend rechaza via `StoreNoteRequest` (`numeric`).
- **Message/UI**: Toast con `"La posición debe ser numérica"`.

### POST /api/notes — Timeout de request

- **Condition**: Request tarda más de 10s.
- **Expected behavior**: Axios aborta la promesa.
- **Message/UI**: Toast `"La solicitud tardó demasiado. Intenta nuevamente."`; nota temporal queda visible en UI hasta reintento.

### POST /api/notes — Backend no alcanzable

- **Condition**: `ERR_CONNECTION_REFUSED` o equivalente (backend caído).
- **Expected behavior**: Axios rechaza sin respuesta.
- **Message/UI**: Toast `"No se pudo contactar al servidor. Verifica tu conexión."`; nota temporal queda visible.

### POST /api/notes — Error 500 del servidor

- **Condition**: Backend responde 500.
- **Expected behavior**: Frontend no puede crear la nota.
- **Message/UI**: Toast `"Error inesperado. Intenta nuevamente."`; nota temporal queda visible.

### POST /api/notes — Sin token (401)

- **Condition**: Request sin Bearer token.
- **Expected behavior**: `auth:sanctum` rechaza.
- **Message/UI**: Frontend limpia `sessionStorage`, redirige a `/login` con mensaje "Tu sesión expiró".

### POST /api/notes — Usuario inactivo (403)

- **Condition**: Token válido pero `is_active=false`.
- **Expected behavior**: `EnsureUserIsActive` rechaza.
- **Message/UI**: Frontend limpia `sessionStorage`, redirige a `/login` con mensaje de inactividad.

### PUT /api/notes/{id} — Nota no existe (404)

- **Condition**: Nota fue soft-deleted por otro usuario entre render y submit.
- **Expected behavior**: Backend responde 404.
- **Message/UI**: Toast `"Esta nota ya no existe."`; frontend remueve la nota del estado local.

### PUT /api/notes/{id} — Lock optimista stale (409)

- **Condition**: Otro usuario guardó cambios después de que este cliente renderizó (mismatch en `updated_at`).
- **Expected behavior**: Backend responde 409 con estado actual del servidor en payload.
- **Message/UI**: Frontend descarta cambios locales, refetchea del servidor, muestra toast `"Alguien más editó esta nota. Se recargó la versión más reciente."`.

### PUT /api/notes/{id} — Validación 422

- **Condition**: Cambios locales rompen validación (e.g. título quedó vacío).
- **Expected behavior**: Backend rechaza via `UpdateNoteRequest`.
- **Message/UI**: Toast con mensaje del backend; nota queda en modo edición con datos del usuario.

### PUT /api/notes/{id} — 401/403/red

- **Condition**: Token expirado / usuario inactivo / red caída.
- **Expected behavior**: Mismo manejo transversal de auth; red → toast genérico.
- **Message/UI**: Redirect a `/login` (401/403) o toast de red.

### PATCH /api/notes/{id}/position — Nota eliminada mid-drag (404)

- **Condition**: Otro usuario eliminó la nota durante el drag.
- **Expected behavior**: Backend responde 404.
- **Message/UI**: Toast `"Esta nota ya no existe."`; frontend remueve la nota; UI revierte a última posición conocida.

### PATCH /api/notes/{id}/position — Posición inválida (422)

- **Condition**: Coordenadas NaN o string (no debería ocurrir en happy path).
- **Expected behavior**: Backend rechaza via `UpdateNotePositionRequest`.
- **Message/UI**: Toast con mensaje del backend; posición revierte a última posición persistida.

### PATCH /api/notes/{id}/position — 401/403/red

- **Condition**: Token expirado / usuario inactivo / red caída.
- **Expected behavior**: Request falla; sin rollback automático.
- **Message/UI**: Redirect a `/login` (401/403) o toast de red; posición revierte a última persistida al recargar.

### DELETE /api/notes/{id} — Nota ya eliminada (404)

- **Condition**: Otro usuario eliminó la nota antes que este DELETE llegara.
- **Expected behavior**: Backend responde 404.
- **Message/UI**: Toast `"Esta nota ya no existe."`; comportamiento idempotente: frontend remueve la nota del estado local de todos modos.

### DELETE /api/notes/{id} — 401/403

- **Condition**: Token expirado / usuario inactivo.
- **Expected behavior**: Request falla.
- **Message/UI**: Redirect a `/login`; la nota sigue visible en UI.

### DELETE /api/notes/{id} — Red caída

- **Condition**: `ERR_CONNECTION_REFUSED` o equivalente.
- **Expected behavior**: Axios rechaza.
- **Message/UI**: Toast de red; la nota sigue visible en UI.

### GET /api/notes — Red caída

- **Condition**: Backend no alcanzable al cargar el tablero.
- **Expected behavior**: Axios rechaza.
- **Message/UI**: Toast `"No se pudo contactar al servidor. Verifica tu conexión."`; canvas queda vacío.

### GET /api/notes — Error 500

- **Condition**: Backend responde 500.
- **Expected behavior**: Frontend no puede pintar el tablero.
- **Message/UI**: Toast `"Error inesperado. Intenta nuevamente."`; canvas vacío.

### GET /api/notes — 401/403

- **Condition**: Sin token / usuario inactivo.
- **Expected behavior**: Mismo manejo transversal de auth.
- **Message/UI**: Redirect a `/login`.

## Edge Cases

- [ ] **E1.** Título con solo espacios en blanco → backend aplica trim → queda vacío → 422 via `required`.
- [ ] **E2.** `text` ausente (no enviado) → aceptado; `text = null` en DB; UI renderiza como string vacío.
- [ ] **E3.** Cambio de status al mismo valor → botón "Guardar" queda `disabled`.
- [ ] **E4.** Cambio de status múltiples veces antes de Guardar → solo el último valor se envía al backend.
- [ ] **E5.** Mover nota +1px y soltar → PATCH se envía con nuevas coordenadas (no hay umbral mínimo).
- [ ] **E6.** Crear nota y eliminarla antes de que llegue el POST 201 → la nota temporal permanece visible hasta el 201; el DELETE posterior la elimina normalmente.
- [ ] **E7.** Drag finalizado fuera del viewport → PATCH se envía con coordenadas potencialmente negativas; backend acepta; UI renderiza la nota fuera de vista (NO se aplica clamp, por decisión).
- [ ] **E8.** Eliminar una nota que otro usuario está editando en paralelo → el editor recibe 404 al hacer Guardar; toast `"Esta nota ya no existe."`; se remueve del estado local.
- [ ] **E9.** Dos notas con títulos idénticos → aceptado (el doc no requiere unicidad de título).
- [ ] **E10.** Tablero vacío → canvas renderiza con dot grid visible y botón "+" visible.
- [ ] **E11.** Notas soft-deleted → excluidas de `GET /api/notes` (comportamiento default de Laravel con `SoftDeletes`).
- [ ] **E12.** Crear nota y luego el usuario se desactiva antes de que llegue el POST 201 → el POST fue procesado antes del próximo chequeo de inactividad; la nota queda creada.
- [ ] **E13.** Emojis en `title` → aceptado (UTF-8 en `VARCHAR`).
- [ ] **E14.** Saltos de línea en `text` → aceptados (TEXT preserva).
- [ ] **E15.** Posición X/Y negativa → aceptada; nota se renderiza fuera de vista.
- [ ] **E16.** Posición NaN → rechazada por validación `numeric` (422).

## Stupid Cases

### Crear / Guardar

- [ ] **S1.** Doble click en "+" → dos POST → se crean dos notas; el botón "+" queda `disabled` mientras hay POST en vuelo.
- [ ] **S2.** Pegar HTML/`<script>` en `title` o `text` → React escapa por defecto; XSS neutralizada en render.
- [ ] **S3.** Pegar 10MB en el input → `maxLength={120}` en cliente previene en `title`; servidor valida de todas formas para `text`.
- [ ] **S4.** Crear 50 notas rápidamente → no hay rate limit; todas se crean.

### Drag & drop

- [ ] **S5.** Arrastrar y soltar en exactamente la misma posición → PATCH se envía de todas formas (no hay umbral); idempotente a nivel lógico.
- [ ] **S6.** Soltar fuera del viewport → PATCH con coordenadas fuera de vista (sin clamp, ver E7).
- [ ] **S7.** Redimensionar ventana durante drag → el drag se calcula relativo al viewport actual; la posición persistida puede no coincidir con la nueva geometría al soltar.
- [ ] **S8.** Touch con dos dedos (móvil) → `@dnd-kit` con `touch-action: none` en el container del canvas.
- [ ] **S9.** Click derecho sobre nota → menú contextual nativo del navegador (no se intercepta).

### Editar

- [ ] **S10.** Escribir en nota A y click en nota B sin Guardar → los cambios locales de A PERSISTEN; indicador visual opcional (`·` al lado del título o `"Guardar ·"` en el botón). Al volver a A los cambios siguen pendientes.
- [ ] **S11.** Cambiar status y olvidar Guardar → el cambio es local; se pierde al cerrar la app (no hay persistencia de borradores).
- [ ] **S12.** Pegar texto >2000 caracteres → frontend acepta (no hay `maxLength` en textarea); servidor rechaza con 422 al Guardar; toast muestra el error.

### Eliminar

- [ ] **S13.** Doble click en "Eliminar" → dos `window.confirm()`. Si el usuario acepta ambos, el segundo recibe 404 (idempotente del lado cliente).
- [ ] **S14.** Enter sobre el modal `window.confirm` → acepta (default del navegador).

### Concurrencia y multi-tab

- [ ] **S15.** Dos usuarios editan la misma nota → 409 → frontend descarta cambios locales, refetchea del servidor, muestra toast.
- [ ] **S16.** Usuario A elimina nota mientras usuario B la mueve → B recibe 404, remueve la nota, muestra toast.
- [ ] **S17.** Token expira mid-drag → PATCH recibe 401 → limpia sesión, redirige a `/login`. La última posición de drag NO se persiste.
- [ ] **S18.** 500 notas en el tablero → no hay paginación; la carga inicial puede ser lenta. El drag sigue funcional pero el render puede sufrir.

### Extremos de datos

- [ ] **S19.** Título con 1 carácter → válido.
- [ ] **S20.** Título/texto solo emojis → válido (UTF-8).
- [ ] **S21.** Posición `0,0` o `999999,999999` → válido (no hay rango).
- [ ] **S22.** POST duplicado con el mismo body → crea DOS notas (no es idempotente; no hay `Idempotency-Key` por scope).

### Routing y casos cruzados

- [ ] **S23.** URL inválida en el tablero (e.g. `/tablero-xyz`) → catch-all `<NotFound />` con link de retorno.
- [ ] **S24.** Usuario desactivado en otro tab mientras edita → próximo request → 403 → limpia sesión y redirige con mensaje de inactividad.

## Acceptance Criteria

### Setup / pre-requisitos

- [ ] **AC1.** Given HU-01 implementada, when login OK, then sesión activa y `/tablero` accesible.   PASS / FAIL
- [ ] **AC2.** Given `docker compose up`, when backend healthy, then `GET /api/notes` responde 200.   PASS / FAIL

### Cargar tablero

- [ ] **AC3.** Given sesión activa + DB vacía, when navega a `/tablero`, then lienzo con dot grid, sin notas, botón "+" visible.   PASS / FAIL
- [ ] **AC4.** Given sesión activa + N notas en DB, when navega a `/tablero`, then todas las notas renderizadas en sus `position_x`, `position_y`.   PASS / FAIL
- [ ] **AC5.** Given sesión activa, when `GET /api/notes`, then 200 con array JSON; cada nota tiene `id, title, text, status, position_x, position_y, created_at, updated_at`.   PASS / FAIL
- [ ] **AC6.** Given nota soft-deleted en DB, when `GET /api/notes`, then respuesta NO la incluye.   PASS / FAIL

### Crear nota

- [ ] **AC7.** Given sesión activa + lienzo vacío, when click en "+", then `POST /api/notes` retorna 201 con valores por defecto; nota aparece en el centro del viewport visible.   PASS / FAIL
- [ ] **AC8.** Given respuesta 201, when frontend la recibe, then nota temporal se reemplaza por la real con el `id` del backend.   PASS / FAIL

### Editar nota

- [ ] **AC9.** Given nota con valores persistidos, when edita título/texto/status y click Guardar, then `PUT /api/notes/{id}` retorna 200; UI muestra valores actualizados.   PASS / FAIL
- [ ] **AC10.** Given nota con cambios locales pendientes, when click Cancelar, then valores locales descartados; nota vuelve a valores persistidos.   PASS / FAIL
- [ ] **AC11.** Given nota sin cambios, when renderiza, then botón Guardar `disabled`.   PASS / FAIL
- [ ] **AC12.** Given nota con cambios pendientes, when renderiza, then botón Guardar habilitado (con indicador visual opcional `"Guardar ·"`).   PASS / FAIL

### Mover nota

- [ ] **AC13.** Given nota existente, when arrastra y suelta, then `PATCH /api/notes/{id}/position` retorna 204; al recargar, nota aparece en nueva posición.   PASS / FAIL
- [ ] **AC14.** Given nota arrastrándose, when se mueve, then posición UI se actualiza durante drag, pero NO request hasta `onDragEnd`.   PASS / FAIL

### Eliminar nota

- [ ] **AC15.** Given nota existente, when click Eliminar + confirma `window.confirm`, then `DELETE /api/notes/{id}` retorna 204; nota desaparece del UI.   PASS / FAIL
- [ ] **AC16.** Given nota existente, when click Eliminar + cancela `window.confirm`, then no se hace request; nota sigue visible.   PASS / FAIL
- [ ] **AC17.** Given nota eliminada, when consulta DB directa, then registro existe con `deleted_at` no nulo.   PASS / FAIL
- [ ] **AC18.** Given nota eliminada, when `GET /api/notes`, then NO aparece.   PASS / FAIL

### Validaciones (FormRequest)

- [ ] **AC19.** Given título vacío al crear, when POST, then 422 con `{"errors": {"title": ["El título es obligatorio"]}}`.   PASS / FAIL
- [ ] **AC20.** Given título >120 chars, when POST, then 422 con `{"title": ["El título no puede tener más de 120 caracteres"]}`.   PASS / FAIL
- [ ] **AC21.** Given texto >2000 chars, when POST, then 422 con `{"text": ["El texto no puede tener más de 2000 caracteres"]}`.   PASS / FAIL
- [ ] **AC22.** Given status inválido, when POST, then 422 con `{"status": ["El estado debe ser Pendiente, En curso o Hecho"]}`.   PASS / FAIL
- [ ] **AC23.** Given título solo con espacios, when POST, then 422 (trim + required).   PASS / FAIL

### Concurrencia y lock optimista

- [ ] **AC24.** Given dos usuarios ven nota con `updated_at=T1`, when A hace PUT con `T1` y luego B hace PUT con `T1`, then A retorna 200 y B retorna **409 Conflict**.   PASS / FAIL
- [ ] **AC25.** Given frontend recibe 409, when procesa, then descarta cambios locales, recarga del servidor, muestra toast `"Alguien más editó esta nota. Se recargó la versión más reciente."`.   PASS / FAIL
- [ ] **AC26.** Given nota soft-deleted por otro, when frontend la referencia, then recibe 404 al intentar PUT/DELETE/PATCH; frontend la remueve del estado local.   PASS / FAIL

### Auth transversal

- [ ] **AC27.** Given request sin token, when cualquier endpoint de notas, then 401.   PASS / FAIL
- [ ] **AC28.** Given request con token pero usuario `is_active=false`, when cualquier endpoint, then 403 con mensaje de inactividad.   PASS / FAIL
- [ ] **AC29.** Given 401/403 en cualquier endpoint, when frontend procesa, then limpia `sessionStorage` y redirige a `/login`.   PASS / FAIL

### Sad paths de red

- [ ] **AC30.** Given request con timeout 10s, when frontend aborta, then toast `"La solicitud tardó demasiado. Intenta nuevamente."`.   PASS / FAIL
- [ ] **AC31.** Given backend caído, when cualquier endpoint, then toast `"No se pudo contactar al servidor. Verifica tu conexión."`.   PASS / FAIL
- [ ] **AC32.** Given backend 500, when frontend recibe, then toast `"Error inesperado. Intenta nuevamente."`.   PASS / FAIL

### UI / estética (Miro reference)

- [ ] **AC33.** Given nota con `status="Pendiente"`, when renderiza, then fondo amarillo `#FFF275`.   PASS / FAIL
- [ ] **AC34.** Given nota con `status="En curso"`, when renderiza, then fondo azul `#90E0EF`.   PASS / FAIL
- [ ] **AC35.** Given nota con `status="Hecho"`, when renderiza, then fondo verde `#80ED99`.   PASS / FAIL
- [ ] **AC36.** Given lienzo del tablero, when renderiza, then fondo `#F5F5F7` con dot grid pattern visible.   PASS / FAIL
- [ ] **AC37.** Given cursor sobre nota (hover), when en modo vista, then `cursor: grab`.   PASS / FAIL
- [ ] **AC38.** Given cursor durante drag, when se arrastra, then `cursor: grabbing` con sombra elevada.   PASS / FAIL
- [ ] **AC39.** Given nota renderizada, when mide el tamaño, then 220x220 px (±1).   PASS / FAIL

### Acciones y navegación

- [ ] **AC40.** Given nota renderizada, when visualiza, then muestra 3 campos editables (título, texto, selector estado) + 3 botones (Guardar, Cancelar, Eliminar).   PASS / FAIL
- [ ] **AC41.** Given click en Eliminar, when se dispara, then aparece `window.confirm("¿Eliminar esta nota?")`.   PASS / FAIL
- [ ] **AC42.** Given `/tablero` con sidebar, when renderiza, then sidebar muestra "Tablero" (activo) + "Dashboard" (link `/dashboard`) + nombre usuario + botón "Cerrar sesión".   PASS / FAIL
- [ ] **AC43.** Given click en "Dashboard" del sidebar, when navega, then redirige a `/dashboard`.   PASS / FAIL

### Persistencia

- [ ] **AC44.** Given nota guardada, when F5 en `/tablero`, then nota sigue visible con sus valores.   PASS / FAIL
- [ ] **AC45.** Given nota guardada, when `docker compose down && up` SIN `-v`, then nota sigue en DB.   PASS / FAIL
- [ ] **AC46.** Given `docker compose down -v`, when reinicia, then DB vacía; seeders solo crean usuarios demo, no notas.   PASS / FAIL

### Logging

- [ ] **AC47.** Given creación OK, when backend responde 201, then log contiene `notes.created` con `user_id`, `note_id`.   PASS / FAIL
- [ ] **AC48.** Given edición OK, when backend responde 200, then log contiene `notes.updated` con `user_id`, `note_id`, `fields_changed`.   PASS / FAIL
- [ ] **AC49.** Given eliminación OK, when backend responde 204, then log contiene `notes.deleted` con `user_id`, `note_id`.   PASS / FAIL
- [ ] **AC50.** Given movimiento OK, when backend responde 204, then log contiene `notes.position_updated` con `user_id`, `note_id`, `position_x`, `position_y`.   PASS / FAIL

### Schema (DB)

- [ ] **AC51.** Given tabla `notes` migrada, when se inspecciona schema, then tiene índices en `status` y en `deleted_at`.   PASS / FAIL
- [ ] **AC52.** Given tabla `notes` migrada, when se inspecciona schema, then columnas son `id, title, text, status, position_x, position_y, created_at, updated_at, deleted_at` con `status` restringido a `('Pendiente', 'En curso', 'Hecho')`.   PASS / FAIL