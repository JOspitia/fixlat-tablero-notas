# HU-04 — Administración de Usuarios

## Description

Construir el módulo de **administración de usuarios** para el portal *fixlat-tablero-notas*, accesible únicamente por usuarios con `role = 'admin'`. Permite listar, crear, editar y desactivar (sin eliminar) cuentas del sistema, manteniendo como **invariante crítica** la existencia de, al menos, un administrador activo en todo momento (`prueba-tecnica.md §1`).

Este módulo es el cierre operativo del producto: sin él no se pueden gestionar cuentas nuevas ni revocar accesos de usuarios no administradores. La invariante del último administrador activo es una restricción de negocio no negociable: la UI, el backend y los logs deben cooperar para impedir cualquier acción que la vulnere, devolviendo **HTTP 422** con el mensaje literal `"No se puede desactivar al último administrador activo."` en todos los casos (sea vía `PATCH /active`, `PUT /api/admin/users/{id}` o combinaciones que conduzcan al mismo estado final).

El scope de HU-04 se limita estrictamente a lo definido en `prueba-tecnica.md §1`. No se introduce borrado físico de usuarios, flujos de recuperación de contraseña, ni operaciones masivas.

## Dependencies and Blockers

> ⚠️ **Invariante crítica del proyecto (`prueba-tecnica.md §1`)**
>
> Debe conservarse siempre **al menos un administrador activo**. El backend **debe rechazar** cualquier acción que vulnere esta condición — incluyendo:
>
> - `PATCH /api/admin/users/{id}/active` con `is_active: false` cuando el target es el único admin activo.
> - `PUT /api/admin/users/{id}` cambiando `role` de `admin` a `user` cuando el target es el único admin activo.
> - `PUT /api/admin/users/{id}` cambiando `is_active` de `true` a `false` cuando el target es el único admin activo.
> - Combinaciones de cambios en un único PUT cuyo estado final deje 0 admins activos.
>
> En todos los casos el backend responde **HTTP 422** con el mensaje literal `"No se puede desactivar al último administrador activo."`. El administrador puede editarse a sí mismo, pero el backend bloquea cualquier auto-edición que reduzca el conteo a 0 (también con 422 y el mismo mensaje).
> La invariante se documenta adicionalmente en §3 *Assumptions* (IV1–IV6), §6 *Sad Paths* y §9 *Acceptance Criteria* (AC19–AC23).

- [ ] HU-01 (`HU-01-auth.md`) implementada: sesión Sanctum y middleware `EnsureUserIsActive` operativos.
- [ ] HU-02 (`HU-02-tablero-notas.md`) implementada: patrón de sidebar y axios interceptor disponibles.
- [ ] HU-03 (`HU-03-dashboard-metrics.md`) implementada: sin dependencia directa con HU-04, pero asegura coherencia visual del layout.
- [ ] Nuevo middleware `EnsureUserIsAdmin` en `backend/app/Http/Middleware/EnsureUserIsAdmin.php`: verifica `$request->user()->role === 'admin'` y responde **403** con `"No tienes permisos para acceder a este módulo"` cuando falla.
- [ ] Rutas backend nuevas bajo el prefijo `/api/admin/users/*`, todas protegidas por la cadena `auth:sanctum` → `EnsureUserIsActive` → `EnsureUserIsAdmin`.
- [ ] Ruta frontend nueva `/admin/usuarios`, protegida por validación de rol en frontend; redirige a `/tablero` con toast si el usuario no es admin.
- [ ] Modificación del sidebar (creado en HU-02) para añadir el enlace "Administración de usuarios", visible únicamente cuando `user.role === 'admin'`.
- [ ] Extender `database/factories/UserFactory.php::definition()` con `role` (default `'user'`) e `is_active` (default `true`), manteniendo paridad con los defaults del modelo `User` (mencionado en HU-01 pero aún no ejecutado al cierre de este HU).

## Assumptions

### Backend

- [ ] **B1.** El middleware `EnsureUserIsAdmin` se aplica a `/api/admin/users/*` y comprueba `$request->user()->role === 'admin'`. Si la condición no se cumple responde **403** con `"No tienes permisos para acceder a este módulo"`. La cadena completa de middleware es `auth:sanctum` → `EnsureUserIsActive` → `EnsureUserIsAdmin`.
- [ ] **B2.** Endpoints a exponer (todos protegidos por la cadena indicada en B1):
  - `GET /api/admin/users` — lista todos los usuarios.
  - `GET /api/admin/users/{id}` — detalle de un usuario.
  - `POST /api/admin/users` — crea con password inicial.
  - `PUT /api/admin/users/{id}` — edita `name`, `email`, `role`, `is_active`.
  - `PATCH /api/admin/users/{id}/active` — alterna `is_active` (desactivar / reactivar).
- [ ] **B3.** Arquitectura en capas: `Request → Controller → Service → Model → Resource`. La lógica de la invariante del último admin vive en `App\Services\UserService`.
- [ ] **B4.** `App\Services\UserService::canModifyAdmin(User $target, array $changes): bool` evalúa si los cambios propuestos dejarían 0 admins activos. Devuelve `false` ⇒ el controller responde **422** con `"No se puede desactivar al último administrador activo."`. La evaluación se hace contra el **estado final** tras aplicar los cambios, no contra el estado actual aislado.
- [ ] **B5.** Email único validado con `Rule::unique('users', 'email')->ignore($userId)` en `UpdateUserRequest`.
- [ ] **B6.** Validación de password en `StoreUserRequest`: `required|string|min:8|max:64`. Al crear, se hashea con `Hash::make()`.
- [ ] **B7.** El password **no** se incluye en `PUT /api/admin/users/{id}` (no hay endpoint para cambiar contraseña en este HU).
- [ ] **B8.** Eventos registrados en el log (canal por defecto `laravel.log`): `users.created`, `users.updated` (con `fields_changed`), `users.role_changed`, `users.deactivated`, `users.reactivated`, `users.list_viewed`. Cada evento registra `actor_user_id` y `target_user_id`.
- [ ] **B9.** Respuestas HTTP: 200/201 con `UserResource`; **422** validación fallida (incluye violación de invariante); 404 usuario no encontrado; 403 no admin; 401 sin auth.
- [ ] **B10.** Header `Cache-Control: no-store` presente en respuestas de `GET /api/admin/users` y `GET /api/admin/users/{id}`.
- [ ] **B11.** `database/factories/UserFactory.php::definition()` extendido con `role => 'user'` e `is_active => true`, replicando los defaults del modelo `User`.
- [ ] **B12.** `last_activity_at` se refresca en cada request autenticada (comportamiento heredado de HU-01; no se redefine aquí).

### Frontend

- [ ] **F1.** La ruta `/admin/usuarios` está protegida: si `user.role !== 'admin'` redirige a `/tablero` con toast `"No tienes permisos para acceder a este módulo"`.
- [ ] **F2.** La página muestra la lista de usuarios en una tabla (columnas: nombre, email, rol, estado, acciones).
- [ ] **F3.** El botón "Nuevo usuario" abre un formulario con los campos `name`, `email`, `role` (dropdown) y `password`.
- [ ] **F4.** Al hacer click en una fila se abre el modo edición con los campos editables: `name`, `email`, `role` (dropdown) e `is_active` (toggle).
- [ ] **F5.** El botón "Guardar" en modo edición dispara `PUT /api/admin/users/{id}` con los campos modificados.
- [ ] **F6.** El botón "Activar" / "Desactivar" por fila dispara `PATCH /api/admin/users/{id}/active`.
- [ ] **F7.** Confirmación previa a desactivar: `window.confirm("¿Desactivar este usuario?")` (consistente con HU-02).
- [ ] **F8.** El sidebar muestra "Administración de usuarios" **únicamente** si `user.role === 'admin'`. Los enlaces a Tablero y Dashboard son visibles para todos los usuarios.
- [ ] **F9.** Indicador visual (badge `"Tú"`) sobre la fila del administrador actualmente autenticado.
- [ ] **F10.** Errores 422 con detalle por campo se muestran de forma inline en el formulario.
- [ ] **F11.** Orden de la lista: administradores primero, luego por `created_at` DESC dentro de cada grupo.
- [ ] **F12.** Spinner visible durante el fetch inicial de la lista.
- [ ] **F13.** El botón "Cancelar" en modo edición descarta los cambios locales y restaura los valores del último snapshot del servidor.

### Invariante (debe destacarse)

- [ ] **IV1.** Desactivar (`is_active: false`) al único admin activo — incluido el propio admin editándose — ⇒ **422** con `"No se puede desactivar al último administrador activo."`.
- [ ] **IV2.** Cambiar el `role` del único admin activo a `user` ⇒ **422** con el mismo mensaje.
- [ ] **IV3.** Cambiar `is_active: false` sobre el único admin activo vía PUT combinado ⇒ **422** con el mismo mensaje.
- [ ] **IV4.** Auto-edición del admin que resultaría en 0 admins activos (desactivarse a sí mismo, cambiarse el rol a `user`) ⇒ **422** con el mismo mensaje.
- [ ] **IV5.** Crear un usuario con `role = admin` e `is_active = false` ⇒ **201 OK** (no afecta el conteo de admins activos: el nuevo admin nace inactivo).
- [ ] **IV6.** Combinación de cambios en un único PUT cuyo estado final dejaría 0 admins ⇒ **422** (evaluar estado final, no estado actual aislado).

## Out of Scope

- [ ] Eliminación de usuarios (`prueba-tecnica.md §1` dice "desactivar"; la invariante implica que no hay borrado físico).
- [ ] Cambio o reset de contraseña (ni por admin ni por el propio usuario).
- [ ] Flujo "Forgot password" / recuperación de contraseña.
- [ ] Perfil extendido de usuario (foto, biografía, etc.).
- [ ] Verificación de email al cambiar email (no hay servicio de email dentro del scope).
- [ ] Notificaciones (por email o in-app) al crear / modificar / desactivar un usuario.
- [ ] Roles distintos a `admin` y `user`.
- [ ] Permisos granulares por acción.
- [ ] Búsqueda, filtrado, paginación y ordenamiento configurable de la lista.
- [ ] Exportación CSV / PDF de la lista de usuarios.
- [ ] Historial detallado por usuario o audit log exhaustivo (solo logging básico de eventos).
- [ ] Restricciones del estilo "máximo N administradores".
- [ ] Aprobación de dos factores para acciones críticas.
- [ ] Soft delete de usuarios (no aplica: `is_active = false` ya codifica el estado inactivo).
- [ ] Papelera de reciclaje / restauración tras N días.
- [ ] Operaciones masivas (desactivar / activar varios usuarios a la vez).
- [ ] Tests automatizados (decisión de proyecto).
- [ ] i18n (solo español).
- [ ] Dark mode.

## Variables and Configuration

| Variable | Type | Environments | Default value | Description |
|----------|------|--------------|---------------|-------------|
| `user.role` | `string` | dev / staging / prod | `'user'` | Rol del usuario. Valores canónicos: `'admin'`, `'user'`. |
| `user.is_active` | `boolean` | dev / staging / prod | `true` | Estado activo del usuario. Solo el admin puede modificarlo vía `PATCH /api/admin/users/{id}/active` o `PUT /api/admin/users/{id}`. |
| `user.password` (longitud mínima) | `int` | dev / staging / prod | `8` | Validación al crear (no editable en este HU). |
| `user.password` (longitud máxima) | `int` | dev / staging / prod | `64` | Validación al crear (no editable en este HU). |
| HTTP client timeout (frontend) | `int (s)` | dev / staging / prod | `10` | Axios cancela el request tras 10 s sin respuesta; toast al usuario. |
| backend → Lambda timeout | `int (s)` | dev / staging / prod | `5` | Heredado; no aplica a este HU. |
| Header `Cache-Control` en listados | `string` | dev / staging / prod | `no-store` | Presente en respuestas de `GET /api/admin/users` y `GET /api/admin/users/{id}`. |

### Esquema de la tabla `users` (referencia — no se modifica en este HU)

```sql
CREATE TABLE users (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at   TIMESTAMP NULL,
    password            VARCHAR(255) NOT NULL,
    role                VARCHAR(255) NOT NULL DEFAULT 'user',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    remember_token      VARCHAR(100),
    created_at          TIMESTAMP NULL,
    updated_at          TIMESTAMP NULL
);
```

> **No existe** columna `deleted_at`. Los usuarios se desactivan (`is_active = false`), **nunca se eliminan**.

## Happy Path

> Los flujos se numeran como `F<n>` para referencia cruzada dentro de este HU.

### Flow 1 — Listar usuarios

**Backend**

1. Admin navega a `/admin/usuarios`.
2. Frontend valida `user.role === 'admin'`; si no, redirige a `/tablero` con toast.
3. Frontend → `GET /api/admin/users` con header `Cache-Control: no-store`.
4. Middleware: `auth:sanctum` → `EnsureUserIsActive` → `EnsureUserIsAdmin` pasan.
5. `UserController@index` consulta todos los usuarios con `UserService` y ordena: admins primero, luego `created_at` DESC dentro de cada grupo.
6. Backend registra `users.list_viewed` con `actor_user_id` en el log.
7. Backend responde **200** con `UserResource[]` y header `Cache-Control: no-store`.

**Frontend**

8. Spinner visible durante el fetch.
9. Renderiza la tabla con columnas: nombre, email, rol, estado, acciones.
10. La fila del admin logueado muestra el badge `"Tú"`.

### Flow 2 — Crear usuario

**Frontend**

1. Admin hace click en "Nuevo usuario" → se abre el formulario.
2. Admin completa `name`, `email`, `role` (dropdown) y `password`.

**Backend**

3. Frontend → `POST /api/admin/users` con `{name, email, role, password}`.
4. `StoreUserRequest` valida: email RFC + único, password 8–64, `role ∈ {admin, user}`.
5. `UserService::create` hashea el password con `Hash::make()` y crea el usuario.
6. Backend registra `users.created` con `actor_user_id` y `target_user_id`.
7. Backend responde **201** con `UserResource`.

**Frontend**

8. Cierra el formulario, añade el nuevo usuario a la lista, muestra toast `"Usuario creado"`.

### Flow 3 — Editar usuario

**Frontend**

1. Admin hace click sobre una fila → modo edición con campos editables.
2. Admin modifica los campos deseados.
3. Admin hace click en "Guardar".

**Backend**

4. Frontend → `PUT /api/admin/users/{id}` con los campos modificados.
5. `UpdateUserRequest` valida (email único con `Rule::ignore($id)`).
6. Si los cambios tocan `role` o `is_active` de un admin activo ⇒ `UserService::canModifyAdmin()` evalúa el estado final.
7. Si viola la invariante ⇒ **422** con `"No se puede desactivar al último administrador activo."`; toast, formulario se mantiene.
8. Si todo es OK ⇒ actualiza; registra `users.updated` con `actor_user_id`, `target_user_id`, `fields_changed: [{field, old, new}, ...]`.
9. Backend responde **200** con `UserResource`.

**Frontend**

10. Actualiza la fila con los nuevos valores.

### Flow 4 — Desactivar usuario

**Frontend**

1. Admin hace click en "Desactivar" sobre una fila.
2. `window.confirm("¿Desactivar este usuario?")`.

**Backend**

3. Si cancela ⇒ no se ejecuta ningún request.
4. Si confirma ⇒ `PATCH /api/admin/users/{id}/active` con `{is_active: false}`.
5. `UserService::canModifyAdmin()` valida (si el target es admin activo y quedaría 0 ⇒ viola).
6. Si viola ⇒ **422** con `"No se puede desactivar al último administrador activo."`; toast, la fila no se actualiza.
7. Si OK ⇒ `is_active = false`; registra `users.deactivated` con `actor_user_id`, `target_user_id`.
8. Backend responde **200** con `UserResource`.

**Frontend**

9. Actualiza la fila; toast `"Usuario desactivado"`.

### Flow 5 — Reactivar usuario

Igual que Flow 4, pero con `{is_active: true}`. **No** se evalúa la invariante (reactivar nunca reduce el conteo de admins activos). Backend registra `users.reactivated`.

### Flow 6 — Cancelar edición

1. Admin está en modo edición con cambios locales pendientes.
2. Click en "Cancelar" ⇒ el frontend descarta el estado local, restaura los valores del último snapshot del servidor y vuelve al modo lista.

## Sad Paths

### Lista — `GET /api/admin/users`

#### 401 (sin token)

- **Condition**: request sin `Authorization: Bearer <token>`.
- **Expected behavior**: el backend responde 401; el frontend limpia la sesión y redirige a `/login`.
- **Message/UI**: toast genérico del HU-01 (sesión expirada / no autenticado).

#### 403 (usuario con `is_active = false`)

- **Condition**: request con token válido pero el usuario fue desactivado en otra pestaña.
- **Expected behavior**: el backend responde 403; el frontend limpia la sesión y redirige a `/login` con mensaje de inactividad.
- **Message/UI**: toast `"Tu cuenta está desactivada. Contacta a un administrador."`.

#### 403 (usuario no admin)

- **Condition**: request de un usuario con `role = 'user'`.
- **Expected behavior**: el backend responde 403; el frontend redirige a `/tablero` con toast.
- **Message/UI**: toast `"No tienes permisos para acceder a este módulo"`.

#### 500 / timeout 10s / red caída

- **Condition**: el backend no responde, responde 500 o el fetch supera los 10 s.
- **Expected behavior**: el axios interceptor trata el error igual que en HU-01/02/03.
- **Message/UI**: toast `"Error inesperado"`.

### Crear — `POST /api/admin/users`

#### 422 nombre vacío

- **Condition**: `name` llega como `""` o `null`.
- **Expected behavior**: el backend responde 422 con `errors.name`.
- **Message/UI**: error inline bajo el campo `name`.

#### 422 email con formato inválido

- **Condition**: `email` no cumple formato RFC 5322.
- **Expected behavior**: el backend responde 422 con `errors.email`.
- **Message/UI**: error inline bajo el campo `email`.

#### 422 email duplicado al crear

- **Condition**: `email` ya existe en `users.email`.
- **Expected behavior**: el backend responde 422.
- **Message/UI**: error inline `"El email ya está registrado"`.

#### 422 rol inválido

- **Condition**: `role` no está en `{admin, user}`.
- **Expected behavior**: el backend responde 422.
- **Message/UI**: error inline `"El rol debe ser admin o user"`.

#### 422 password fuera de rango

- **Condition**: password menor a 8 o mayor a 64 caracteres.
- **Expected behavior**: el backend responde 422.
- **Message/UI**: `"El password debe tener al menos 8 caracteres"` o `"El password no puede tener más de 64 caracteres"`.

#### 401 / 403 / 500 / timeout / red caída

- **Condition**: idéntico a la sección "Lista".
- **Expected behavior**: tratamiento estándar.
- **Message/UI**: toast correspondiente.

### Editar — `PUT /api/admin/users/{id}`

#### 404 usuario no existe

- **Condition**: `:id` no corresponde a ningún registro.
- **Expected behavior**: el backend responde 404.
- **Message/UI**: toast `"Este usuario ya no existe."`; el frontend recarga la lista.

#### 422 email duplicado al editar

- **Condition**: el nuevo `email` ya está en uso por otro usuario.
- **Expected behavior**: el backend responde 422.
- **Message/UI**: error inline `"El email ya está registrado"`.

#### 422 violación de invariante — desactivar al último admin activo

- **Condition**: el target es el único admin activo y la operación lo desactivaría (`is_active: false` vía PUT combinado).
- **Expected behavior**: el backend responde 422.
- **Message/UI**: toast `"No se puede desactivar al último administrador activo."`. La fila no cambia; el formulario se mantiene.

#### 422 violación de invariante — cambiar el rol del último admin activo

- **Condition**: el target es el único admin activo y la operación cambia `role` a `user`.
- **Expected behavior**: el backend responde 422.
- **Message/UI**: mismo mensaje que arriba.

#### 422 violación de invariante — combinación en un único PUT

- **Condition**: el estado final tras aplicar todos los cambios dejaría 0 admins activos.
- **Expected behavior**: el backend evalúa el estado final, no el estado actual aislado.
- **Message/UI**: mismo mensaje.

#### 422 otras validaciones

- **Condition**: nombre vacío, email malformado, rol inválido, etc.
- **Expected behavior**: el backend responde 422 con `errors.*`.
- **Message/UI**: error inline en el campo correspondiente.

#### 401 / 403 / 500 / timeout / red caída

- **Condition**: idéntico a la sección "Lista".
- **Expected behavior**: tratamiento estándar.
- **Message/UI**: toast correspondiente.

### Toggle activo — `PATCH /api/admin/users/{id}/active`

#### 404 usuario no existe

- **Condition**: `:id` no corresponde a ningún registro.
- **Expected behavior**: el backend responde 404.
- **Message/UI**: toast `"Este usuario ya no existe."`; el frontend recarga la lista.

#### 422 desactivar al último admin activo

- **Condition**: el target es el único admin activo; body `{is_active: false}`.
- **Expected behavior**: el backend responde 422.
- **Message/UI**: toast `"No se puede desactivar al último administrador activo."`.

#### 401 / 403 / 500 / timeout / red caída

- **Condition**: idéntico a la sección "Lista".
- **Expected behavior**: tratamiento estándar.
- **Message/UI**: toast correspondiente.

### Cancelar edición

#### Click en "Cancelar" con cambios locales pendientes

- **Condition**: el usuario editó campos en el formulario y aún no guardó.
- **Expected behavior**: el frontend descarta el estado local; restaura los valores del último snapshot del servidor; vuelve al modo lista (o vista normal).
- **Message/UI**: sin toast (operación silenciosa).

## Edge Cases

- [ ] **E1.** Email con mayúsculas o espacios al crear / editar ⇒ el backend hace `trim + lowercase` antes de validar y almacenar.
- [ ] **E2.** Email duplicado con diferencia de mayúsculas (`Admin@Test.com` vs `admin@test.com`) ⇒ **422** (unicidad case-insensitive).
- [ ] **E3.** Crear un usuario con `role = admin` e `is_active = false` ⇒ **201 OK** (no afecta el conteo de admins activos).
- [ ] **E4.** El admin edita su propio `name` siendo el único admin activo ⇒ **200 OK** (únicamente cambia `name`; la invariante queda intacta).
- [ ] **E5.** El admin edita su propio `email` siendo el único admin activo ⇒ **200 OK** (únicamente cambia `email`; la invariante queda intacta).
- [ ] **E6.** El admin intenta desactivarse a sí mismo siendo el único admin activo ⇒ **422**.
- [ ] **E7.** El admin intenta cambiar su propio `role` a `user` siendo el único admin activo ⇒ **422**.
- [ ] **E8.** El admin desactiva a otro admin cuando hay 2+ admins activos ⇒ **200 OK** (queda ≥1 admin activo).
- [ ] **E9.** Reactivar un usuario ya activo ⇒ **200 OK** idempotente; no se duplica el log `users.reactivated`.
- [ ] **E10.** Editar un usuario recién desactivado por otro admin ⇒ **200 OK**; el backend no bloquea `PUT` sobre usuarios inactivos.
- [ ] **E11.** Desactivar un usuario ya inactivo ⇒ **200 OK** idempotente; no se duplica el log `users.deactivated`.
- [ ] **E12.** Lista con una única fila (el admin actual) ⇒ render normal con el badge `"Tú"`.
- [ ] **E13.** Lista con muchos usuarios (100+) ⇒ render normal sin paginación.
- [ ] **E14.** Nombres con emojis o caracteres Unicode ⇒ aceptados (VARCHAR UTF-8).
- [ ] **E15.** Email con subaddressing (`user+tag@test.com`) ⇒ aceptado (RFC 5322 válido).

## Stupid Cases

### Crear / Editar

- [ ] **S1.** Doble click en "Guardar" ⇒ el botón queda deshabilitado durante la petición POST/PUT para evitar envíos duplicados.
- [ ] **S2.** Pegar HTML / `<script>` en `name` o `email` ⇒ React escapa en el render; `email` se valida por RFC y `name` queda como VARCHAR libre.
- [ ] **S3.** Cambiar `role` varias veces antes de Guardar ⇒ solo se envía el último valor seleccionado en el `PUT`.
- [ ] **S4.** Crear 50 usuarios seguidos ⇒ todos se crean correctamente (no hay rate limit en este HU; fuera de scope).
- [ ] **S5.** Pegar un password de 10 MB ⇒ `maxLength={64}` en el cliente impide el pegado completo; el servidor vuelve a validar.

### Desactivar / Reactivar

- [ ] **S6.** Doble click en "Desactivar" ⇒ se disparan dos `window.confirm`; si ambos se confirman, el segundo es idempotente.
- [ ] **S7.** Pulsar Enter sobre `window.confirm` ⇒ acepta (default del navegador).
- [ ] **S8.** Desactivar y reactivar inmediatamente al mismo admin ⇒ dos PATCH consecutivos; ambos **200 OK** mientras la invariante no se viole con un tercero.

### Concurrencia

- [ ] **S9.** Dos admins editan al mismo usuario ⇒ last-write-wins (no hay optimistic locking en este HU; trabajo futuro).
- [ ] **S10.** Admin A desactiva a admin B mientras B edita su propio perfil ⇒ A gana en el toggle; el `PUT` posterior de B aún termina en **200 OK** (el backend no bloquea PUT sobre usuarios inactivos).
- [ ] **S11.** 50 pestañas abiertas en `/admin/usuarios` ⇒ cada una ejecuta su propio fetch; cada una muestra su propia lista.
- [ ] **S12.** Pulsar F5 mientras se edita ⇒ cambios locales perdidos (no hay persistencia de borrador en este HU).

### Seguridad

- [ ] **S13.** Inyección SQL en `email` / `name` ⇒ Eloquent usa prepared statements.
- [ ] **S14.** XSS en respuestas ⇒ React escapa al renderizar; el backend nunca devuelve HTML.
- [ ] **S15.** Inspeccionar la lista en DevTools ⇒ `UserResource` oculta `password` y `remember_token`.

### Routing / Sesión

- [ ] **S16.** URL inválida (`/admin/usuarios-xyz`) ⇒ catch-all `<NotFound />`.
- [ ] **S17.** Token expira durante crear / editar ⇒ **401** ⇒ sesión limpiada; redirige a `/login`.
- [ ] **S18.** Usuario desactivado en otra pestaña mientras edita ⇒ siguiente request **403** ⇒ sesión limpiada; redirige a `/login` con mensaje de inactividad.

## Acceptance Criteria

### Setup / Pre-requisitos

- [ ] **AC1.** **Given** HU-01 + HU-02 + HU-03 implementadas, **when** un admin hace login, **then** `/admin/usuarios` es accesible desde el sidebar.   PASS / FAIL
- [ ] **AC2.** **Given** un usuario no admin autenticado, **when** intenta acceder a `/admin/usuarios`, **then** redirige a `/tablero` con toast `"No tienes permisos para acceder a este módulo"`.   PASS / FAIL

### Sidebar

- [ ] **AC3.** **Given** un usuario admin, **when** carga cualquier ruta, **then** el sidebar muestra el enlace "Administración de usuarios".   PASS / FAIL
- [ ] **AC4.** **Given** un usuario no admin, **when** carga cualquier ruta, **then** el sidebar **no** muestra el enlace "Administración de usuarios".   PASS / FAIL

### Listar — `GET /api/admin/users`

- [ ] **AC5.** **Given** admin autenticado, **when** `GET /api/admin/users`, **then** **200** con array JSON.   PASS / FAIL
- [ ] **AC6.** **Given** la respuesta, **when** el frontend renderiza, **then** cada usuario expone `id, name, email, role, is_active` (**no** `password`, **no** `remember_token`).   PASS / FAIL
- [ ] **AC7.** **Given** la respuesta, **when** se aplica el orden, **then** los admins aparecen primero, luego por `created_at` DESC dentro de cada grupo.   PASS / FAIL
- [ ] **AC8.** **Given** admin logueado en la lista, **when** se renderiza la tabla, **then** su fila muestra el badge `"Tú"`.   PASS / FAIL
- [ ] **AC9.** **Given** un request, **when** el backend responde, **then** el log contiene `users.list_viewed` con `actor_user_id`.   PASS / FAIL
- [ ] **AC10.** **Given** la respuesta, **when** el backend responde, **then** el header `Cache-Control: no-store` está presente.   PASS / FAIL

### Crear — `POST /api/admin/users`

- [ ] **AC11.** **Given** un formulario completo, **when** POST con datos válidos, **then** **201** con `UserResource`; el nuevo usuario aparece en la lista.   PASS / FAIL
- [ ] **AC12.** **Given** POST exitoso, **when** el backend responde, **then** el log contiene `users.created` con `actor_user_id` y `target_user_id`.   PASS / FAIL

### Editar — `PUT /api/admin/users/{id}`

- [ ] **AC13.** **Given** un formulario con cambios, **when** PUT con datos válidos, **then** **200** con `UserResource` actualizado; la fila se actualiza.   PASS / FAIL
- [ ] **AC14.** **Given** un PUT con cambios, **when** el backend responde, **then** el log contiene `users.updated` con `actor_user_id`, `target_user_id` y `fields_changed`.   PASS / FAIL

### Desactivar / Reactivar

- [ ] **AC15.** **Given** un usuario activo, **when** PATCH con `{is_active: false}` y `window.confirm` confirmado, **then** **200** con `is_active: false`; la fila se actualiza.   PASS / FAIL
- [ ] **AC16.** **Given** un usuario activo, **when** PATCH cancelado por `window.confirm`, **then** no se ejecuta ningún request.   PASS / FAIL
- [ ] **AC17.** **Given** desactivación exitosa, **when** el backend responde, **then** el log contiene `users.deactivated`.   PASS / FAIL
- [ ] **AC18.** **Given** un usuario inactivo, **when** PATCH con `{is_active: true}`, **then** **200** con `is_active: true`; log `users.reactivated`.   PASS / FAIL

### Invariante del último admin activo

- [ ] **AC19.** **Given** el único admin activo, **when** intenta desactivarse a sí mismo, **then** **422** con `"No se puede desactivar al último administrador activo."`.   PASS / FAIL
- [ ] **AC20.** **Given** el único admin activo, **when** intenta cambiar su rol a `user`, **then** **422** con el mismo mensaje.   PASS / FAIL
- [ ] **AC21.** **Given** el único admin activo, **when** intenta desactivar a otro admin (que en realidad es él mismo), **then** **422**.   PASS / FAIL
- [ ] **AC22.** **Given** 2+ admins activos, **when** desactiva a uno, **then** **200 OK** (queda ≥1 admin).   PASS / FAIL
- [ ] **AC23.** **Given** crear con `role = admin` e `is_active = false`, **when** POST, **then** **201 OK** (no afecta el conteo de admins activos).   PASS / FAIL

### Cancelar edición

- [ ] **AC24.** **Given** cambios locales pendientes, **when** el admin hace click en Cancelar, **then** el frontend descarta los cambios y restaura los valores del servidor.   PASS / FAIL

### Validaciones FormRequest

- [ ] **AC25.** **Given** nombre vacío, **when** POST, **then** **422** con error en el campo `name`.   PASS / FAIL
- [ ] **AC26.** **Given** email con formato inválido, **when** POST, **then** **422** con error en el campo `email`.   PASS / FAIL
- [ ] **AC27.** **Given** email duplicado con un usuario existente, **when** POST, **then** **422** con `"El email ya está registrado"`.   PASS / FAIL
- [ ] **AC28.** **Given** rol inválido, **when** POST, **then** **422** con `"El rol debe ser admin o user"`.   PASS / FAIL
- [ ] **AC29.** **Given** password menor a 8 caracteres, **when** POST, **then** **422** con `"El password debe tener al menos 8 caracteres"`.   PASS / FAIL
- [ ] **AC30.** **Given** password mayor a 64 caracteres, **when** POST, **then** **422** con `"El password no puede tener más de 64 caracteres"`.   PASS / FAIL
- [ ] **AC31.** **Given** email con mayúsculas y espacios al crear, **when** POST, **then** el backend trimea + lowercase antes de validar.   PASS / FAIL
- [ ] **AC32.** **Given** email duplicado insensible a mayúsculas (`Admin@Test.com` vs `admin@test.com`), **when** POST, **then** **422**.   PASS / FAIL

### Sad paths de red

- [ ] **AC33.** **Given** timeout de 10 s, **when** el frontend aborta, **then** muestra un toast.   PASS / FAIL
- [ ] **AC34.** **Given** el backend caído, **when** el frontend intenta, **then** muestra un toast.   PASS / FAIL
- [ ] **AC35.** **Given** el backend responde 500, **when** el frontend recibe la respuesta, **then** muestra el toast `"Error inesperado"`.   PASS / FAIL

### Auth transversal

- [ ] **AC36.** **Given** un request sin token, **when** cualquier endpoint de admin, **then** **401**.   PASS / FAIL
- [ ] **AC37.** **Given** un request con token de un usuario con `is_active = false`, **when** cualquier endpoint, **then** **403** con mensaje de inactividad.   PASS / FAIL
- [ ] **AC38.** **Given** un request de un usuario no admin, **when** cualquier endpoint de admin, **then** **403** con `"No tienes permisos para acceder a este módulo"`.   PASS / FAIL

### Usuario no existe

- [ ] **AC39.** **Given** el usuario objetivo no existe, **when** PUT, **then** **404** con `"Este usuario ya no existe."`.   PASS / FAIL
- [ ] **AC40.** **Given** el usuario objetivo no existe, **when** PATCH `/active`, **then** **404** con el mismo mensaje.   PASS / FAIL

### Seguridad

- [ ] **AC41.** **Given** cualquier `UserResource` en una respuesta, **then** **no** contiene `password` ni `remember_token`.   PASS / FAIL
- [ ] **AC42.** **Given** un email con mayúsculas, **when** el backend lo guarda, **then** el email almacenado está en minúsculas.   PASS / FAIL

### Persistencia

- [ ] **AC43.** **Given** el admin crea un usuario, **when** se hace F5 en `/admin/usuarios`, **then** el nuevo usuario aparece en la lista.   PASS / FAIL
- [ ] **AC44.** **Given** cambios en la lista de admins, **when** se ejecuta `docker compose down && up` **sin** `-v`, **then** los cambios persisten en la DB.   PASS / FAIL

### Schema

- [ ] **AC45.** **Given** la tabla `users` migrada, **when** se inspecciona el schema, **then** las columnas son `id, name, email, email_verified_at, password, role, is_active, remember_token, created_at, updated_at`, con `email` UNIQUE.   PASS / FAIL
- [ ] **AC46.** **Given** el modelo `User`, **when** se inspecciona `$hidden`, **then** incluye `password` y `remember_token`.   PASS / FAIL
