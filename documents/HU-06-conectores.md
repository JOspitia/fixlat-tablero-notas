# HU-06 — Conectores entre notas (estilo Miro)

## Disclaimer de scope (mejora deliberada — fuera de `prueba-tecnica.md`)

> **Esta HU es una MEJORA DELIBERADA respecto del documento técnico `prueba-tecnica.md`.**
>
> Por decisión de proyecto registrada en Engram (`hu/scope-rule`), la regla "explicit-only per `prueba-tecnica.md`" queda **exceptuada** a partir de HU-05. `prueba-tecnica.md` sigue siendo el piso mínimo inicial, pero las HU nuevas (HU-05 en adelante) pueden declarar funcionalidades que el doc técnico NO pide, siempre que (1) cada bloque lo declare explícitamente como mejora y (2) se documente el disclaimer como hace esta HU.
>
> `prueba-tecnica.md` no menciona **conectores entre notas** (flechas, líneas, curvas, relaciones). Esta HU los introduce como una nueva entidad (`note_connectors`) y un nuevo modo de interacción sobre el canvas, permitiendo enlazar dos notas con una flecha curva bezier cuyo estilo visual es editable. Todo lo que esta HU declara —catálogo de estilos, geometría, persistencia, endpoints nuevos, FAB de activación, cascade delete— es decisión de esta HU y NO proviene del doc técnico.
>
> Si el validador busca trazabilidad `prueba-tecnica.md → HU-06`: no la va a encontrar para conectores. Esa ausencia es intencional y está aprobada.
>
> **Trazabilidad**: regla exceptuada por el usuario en sesión [2026-09-27], registrada en memoria persistente del proyecto (topic_key: hu/scope-rule).
>
> **Reglas derivadas de este disclaimer**:
> - HU-02 sigue siendo la fuente de verdad para CRUD de notas, soft delete vía `deleted_at`, lock optimista sobre `updated_at`, anti-enumeración, sin ownership, sin auto-save, sin realtime, sin rate limit, sin pan/zoom, sin i18n, sin dark mode, sin tests automatizados. HU-05 sigue siendo la fuente de verdad para shape / font_family / text_align de las notas. Esta HU NO contradice ninguna de esas reglas; las extiende solo donde es estrictamente necesario (nueva tabla `note_connectors`, migración aditiva, endpoints nuevos bajo `/api/notes/{note}/connectors` y `/api/note-connectors/{id}`).
> - El cascade delete soft se implementa con un `deleting` event en el modelo `Note` (framework-native, testeable), no con `ON DELETE CASCADE` de DB, para mantener el soft delete simétrico con notas.
> - Esta HU NO introduce optimistic lock sobre los conectores en V1 (ver Out of Scope §5 y A6 en §4). El lock optimista de HU-02 sigue aplicando a las notas; los conectores confían en la última escritura. Se documenta como decisión deliberada para V2.
> - Cualquier futura HU que extienda conectores (etiquetas, colores custom, drag-to-reshape, animaciones, undo/redo de conectores) debe declarar su propio disclaimer y referenciar esta HU como base, porque esos features NO están ni en `prueba-tecnica.md` ni en HU-06.

## Descripción

HU-06 introduce la capacidad de **conectar dos notas con una flecha curva estilo Miro**. Es una **MEJORA DELIBERADA** por sobre HU-02 (CRUD de notas) y HU-05 (enriquecimiento visual de notas).

HU-06 entrega:

1. **Una nueva entidad `note_connectors`**, persistida en una nueva tabla con FK a `notes`, soft delete (`deleted_at`), columna `style` con CHECK, y timestamps.
2. **Tres endpoints nuevos** bajo `/api/notes/{note}/connectors` y `/api/note-connectors/{id}`, todos detrás de Sanctum + `EnsureUserIsActive` (transversal HU-01).
3. **Un nuevo modo de interacción** en el frontend, activado por un FAB redondo azul flotante sobre el canvas. En este modo el usuario hace dos clicks sobre dos notas para crear el conector; el sistema elige automáticamente los anchor points óptimos sobre la silueta de cada nota (no exige clicks extra).
4. **Geometría bezier**: la flecha es una curva bezier cuadrática cuyo control point se calcula a partir del segmento source→destination. Las anclas (puntos de inicio y fin) se calculan automáticamente intersectando el segmento con la silueta de cada nota — incluyendo las 16 formas de HU-05 (rectangle, rounded_rectangle, diamond, triangle, circle, ellipse, star, hexagon, pentagon, octagon, arrow, parallelogram, trapezoid, message_bubble, cloud, cylinder).
5. **Catálogo de 6 estilos** (`style`) para la flecha: `solid_arrow_end`, `dashed_arrow_end`, `solid_no_arrow`, `dashed_no_arrow`, `arrow_both_solid`, `solid_arrow_start`. Todos con `CHECK` de DB. Default: `solid_arrow_end`. Default visual único: color azul (`#2563EB`), stroke 2px (sin personalización por conector en V1).
6. **Cascade delete soft**: soft-deleting una nota → soft-delete en cascada de todos los conectores donde participa (source o destination). Sin huérfanos.
7. **Multiplicidad A↔B permitida con cap de 6** conectores entre el mismo par ordenado. **A→A (self-connector) prohibido** en V1.

Heradado de HU-02 (no se rompe):
- No hay ownership. Todos los usuarios activos pueden crear/editar/eliminar todos los conectores.
- Soft delete vía `deleted_at`.
- `EnsureUserIsActive` aplica a los endpoints nuevos (transversal HU-01).
- Lock optimista sobre `updated_at` aplica a las notas (HU-02 AC24); **NO** aplica a los conectores en V1 (decisión documentada, ver §4 A6 y §5).
- Sin auto-save, sin realtime, sin pan/zoom, sin tests automatizados, sin i18n, sin dark mode.

Modelo de interacción recomendado:

- El FAB de "+ Nota" de HU-02 sigue existiendo. **Se agrega un nuevo FAB redondo azul** (recomendado: 56px de diámetro, color `#2563EB`, fixed bottom-right a 24px del borde) con ícono de "enlace" (link / chain).
- Click en el FAB de conectores → el frontend entra en **"add connector mode"**. En este modo: el cursor cambia a `crosshair`, un banner superior muestra `"Selecciona la nota de origen y luego la nota de destino. ESC para cancelar."`, los clicks sobre notas NO abren el `NoteEditor` (interceptor), y un highlight visual identifica la nota seleccionada como origen.
- Primer click sobre una nota → highlight + small badge "Origen". Segundo click sobre otra nota → se calcula geometry, se persiste vía `POST /api/notes/{sourceNote}/connectors`, se dibuja la flecha con el estilo default (`solid_arrow_end`).
- Segundo click sobre la **misma** nota → se rechaza con toast `"No puedes conectar una nota consigo misma"`. NO se hace request.
- Click sobre el **canvas vacío** durante el modo → ignora el click (no hace nada).
- Tecla **ESC** durante el modo → sale del modo sin crear nada.
- Click sobre una **flecha existente** → abre un **mini-toolbar flotante** con: selector de `style` (los 6 valores) y botón "Eliminar conector".

## Dependencias y bloqueantes

- [ ] HU-02 implementada y operativa: CRUD de notas, soft delete vía `deleted_at`, `Note` model con shape/font_family/text_align (HU-05), `PATCH /api/notes/{id}/position` con lock optimista, `NoteService::update` con lock, `NoteResource`.
- [ ] HU-05 implementada y operativa: las 16 formas (`shape`) están persistidas y se renderizan en `NoteCard`. Esta HU usa `shape` para calcular los anchor points del bezier.
- [ ] HU-01 implementada y operativa: Sanctum Bearer + `EnsureUserIsActive` aplican transversalmente.
- [ ] Nueva migración aditiva `create_note_connectors_table` (tabla nueva, no es `ALTER TABLE`). NO destructiva — no toca tablas existentes.
- [ ] Tabla nueva `note_connectors` con columnas: `id` (BIGSERIAL), `source_note_id` (BIGINT NOT NULL, FK a `notes.id` ON DELETE CASCADE a nivel lógica — ver §4 A4), `destination_note_id` (BIGINT NOT NULL, FK a `notes.id` ON DELETE CASCADE a nivel lógica), `style` (VARCHAR(30) NOT NULL DEFAULT 'solid_arrow_end'), `created_at`, `updated_at`, `deleted_at`. **NO** se incluye `updated_at` para optimistic lock en V1 (decisión A6).
- [ ] `CHECK` constraint de DB: `style IN ('solid_arrow_end','dashed_arrow_end','solid_no_arrow','dashed_no_arrow','arrow_both_solid','solid_arrow_start')`.
- [ ] Constraint de DB: `source_note_id <> destination_note_id` (auto-conector prohibido a nivel dato, defensa en profundidad además del check de aplicación).
- [ ] Modelo Eloquent `NoteConnector` con `$fillable` (`source_note_id`, `destination_note_id`, `style`), `SoftDeletes`, constantes públicas para los 6 valores de `style`, y las relaciones Eloquent:
    - `public function sourceNote(): BelongsTo { return $this->belongsTo(Note::class, 'source_note_id'); }`
    - `public function destinationNote(): BelongsTo { return $this->belongsTo(Note::class, 'destination_note_id'); }`
    - Estas relaciones son necesarias para que el `NoteResource` (HU-02) y futuras HU (HU-07+) puedan eager-loadear las notas relacionadas sin queries N+1.
- [ ] Modelo `Note` agrega `deleting` event (o equivalente Laravel) para soft-delete en cascada de los conectores donde la nota es source o destination. **No** se usa `ON DELETE CASCADE` de DB porque las notas son soft-deleted, no hard-deleted.
- [ ] `NoteConnectorResource` con campos `id`, `source_note_id`, `destination_note_id`, `style`, `created_at`, `updated_at`.
- [ ] `StoreNoteConnectorRequest` valida `destination_note_id` (required, integer, exists en `notes` activas — sin soft-delete), `style` (sometimes, in catálogo §6.1).
- [ ] `UpdateNoteConnectorRequest` valida `style` (sometimes, in catálogo §6.1).
- [ ] `NoteConnectorService::create(sourceNote, destinationNote, style)` persiste el conector; valida que source y destination sean notas distintas (A8).
- [ ] `NoteConnectorService::update(connector, style)` actualiza el estilo.
- [ ] `NoteConnectorService::delete(connector)` soft-delete.
- [ ] `NoteConnectorService::cascadingDeleteForNote(note)` soft-delete de todos los conectores donde `note` es source o destination.
- [ ] Endpoints nuevos (rutas en `routes/api.php`, todas detrás de `auth:sanctum` + `EnsureUserIsActive`):
  - `POST /api/notes/{note}/connectors` — crea conector; `{note}` es la source. Body: `{destination_note_id, style?}`. 201 + `NoteConnectorResource`.
  - `GET /api/notes/{note}/connectors` — lista conectores donde `{note}` es source O destination. 200 + `{connectors: [...]}`.
  - `PUT /api/note-connectors/{id}` — actualiza `style`. Body: `{style}`. 200 + `NoteConnectorResource`.
  - `DELETE /api/note-connectors/{id}` — soft-delete. 204.
- [ ] Endpoint transversal (helper) para el frontend: `GET /api/notes/connectors` — lista TODOS los conectores activos del tablero (HU-02 style). 200 + `{connectors: [...]}`.
- [ ] Frontend: `frontend/src/components/Canvas.jsx` extendido con un nuevo FAB redondo azul de 56px (`ConnectorFab.jsx`) y un nuevo modo de interacción (`ConnectorModeContext` o equivalente).
- [ ] Frontend: `frontend/src/components/ConnectorLayer.jsx` (capa SVG sobre el canvas) renderiza todos los conectores como `<path>` con bezier. Z-index superior a las notas pero inferior al `NoteEditor`.
- [ ] Frontend: `frontend/src/components/NoteCard.jsx` agrega un callback `onClickInConnectorMode(noteId)` que se activa cuando el modo está activo y la nota es clickable.
- [ ] Frontend: `frontend/src/components/ConnectorMiniToolbar.jsx` aparece al hacer click sobre una flecha; tiene selector de `style` y botón "Eliminar conector". Se cierra al click fuera o al ESC.
- [ ] Frontend: `frontend/src/services/noteConnectors.js` con `createConnector(sourceNoteId, destinationNoteId, style)`, `listAllConnectors()`, `updateConnectorStyle(id, style)`, `deleteConnector(id)`.
- [ ] Función helper de geometry (frontend) `getAnchorPoint(note, otherNoteCenter)` que intersecta el segmento `note.center → otherNote.center` con la silueta de `note` (rectangular para rectangle/rounded_rectangle, poligonal para el resto). Devuelve `{x, y}`.
- [ ] Función helper de bezier (frontend) `bezierPath(anchorSource, anchorDestination)` que genera el `d` de un `<path>` SVG con bezier cuadrática.

## Supuestos

### Backend

- [ ] **B1.** HU-02 + HU-05 funcionan y `notes` tiene las 16 formas persistidas. La geometría de los conectores se calcula en el frontend usando `note.shape` + `note.position_x` + `note.position_y`. El backend NO calcula geometría (es presentación pura).
- [ ] **B2.** Sanctum Bearer tokens y middleware `auth:sanctum` + `EnsureUserIsActive` aplican a las rutas nuevas (`/api/notes/{note}/connectors/*`, `/api/note-connectors/*`, `/api/notes/connectors`). Heredado de HU-02/HU-01.
- [ ] **B3.** No hay tabla `notes` alterada. La tabla `note_connectors` es completamente nueva. La migración `create_note_connectors_table` la crea de cero; `down()` la dropea (con pérdida de datos si hay filas activas, aceptable para rollback).
- [ ] **B4.** FKs de `note_connectors` a `notes`: `source_note_id` y `destination_note_id` referencian `notes.id` con `ON DELETE CASCADE` declarado a nivel SQL — pero como `Note` hace soft delete (no hard delete), este CASCADE nunca se dispara por el flujo normal. Se declara por defensa (si en algún futuro se hace hard delete de notas, los conectores se limpian).
- [ ] **B5.** Lock optimista: **NO se implementa** en V1 sobre `note_connectors` (ver §5 Out of Scope y §4 A6). El último PUT gana sin chequeo de `updated_at`. Los PUT sí actualizan `updated_at` para auditoría. Si en el futuro se requiere lock, se agrega en HU-07 (HU explícita de lock de conectores).
- [ ] **B6.** Validación de `style`: `in: solid_arrow_end, dashed_arrow_end, solid_no_arrow, dashed_no_arrow, arrow_both_solid, solid_arrow_start` (FormRequest) **y** `CHECK` de DB (defensa en profundidad).
- [ ] **B7.** Validación de `destination_note_id`: `required`, `integer`, `exists:notes,id` con scope global (no soft-deleted) — vía regla custom o `Rule::exists` con where `deleted_at IS NULL`. El backend debe rechazar si el destino está soft-deleted.
- [ ] **B8.** Validación de `source_note_id`: el source es la nota del path (`{note}`); debe ser una nota activa (no soft-deleted). Si está soft-deleted, el endpoint devuelve 404 (NotFoundException / Route Model Binding con scope).
- [ ] **B9.** Self-connector (`source_note_id === destination_note_id`) se rechaza con **422** y mensaje en español. El constraint `CHECK (source_note_id <> destination_note_id)` en DB es defensa en profundidad (debería ser unreachable si el check de aplicación funciona).
- [ ] **B10.** Cap de multiplicidad: **máximo 6 conectores entre el mismo par no-ordenado (A y B, contando ambas direcciones)**. Si se excede, **422** con mensaje en español. Decisión A2. La validación en `StoreNoteConnectorRequest` cuenta los conectores activos donde `(source_note_id=A AND destination_note_id=B) OR (source_note_id=B AND destination_note_id=A)` — un único query cubre ambas direcciones.
- [ ] **B11.** Validación de duplicado exacto: si ya existe un conector activo (no soft-deleted) entre el mismo par con el mismo `style`, **NO** se rechaza — la multiplicidad cuenta el número de conectores, no de estilos. Permitir duplicados exactos es decisión A3 (ver §4). El cap de 6 sigue aplicando.
- [ ] **B12.** Endpoint `GET /api/notes/{note}/connectors`: retorna conectores activos donde la nota es **source o destination**. El frontend lo usa como helper de UI (puede también llamar a `GET /api/notes/connectors` para todos).
- [ ] **B13.** Endpoint `GET /api/notes/connectors` (sin `{note}`): retorna **todos** los conectores activos del tablero. Es el helper principal que el frontend usa al cargar `/tablero` para hidratar `ConnectorLayer`.
- [ ] **B14.** Cascade delete soft: implementado en el modelo `Note` con un listener del evento `deleting` que llama a `NoteConnectorService::cascadingDeleteForNote($note)`. El loop de soft-delete de conectores va envuelto en un `DB::transaction(function () { ... })` explícito (§6.5) — el listener NO depende del comportamiento default de Laravel. Los conectores quedan soft-deleted atómicamente con la nota.
- [ ] **B15.** Logging: el evento `note_connectors.created` registra `{user_id, connector_id, source_note_id, destination_note_id, style}`. `note_connectors.updated` registra `{user_id, connector_id, old_style, new_style}`. `note_connectors.deleted` registra `{user_id, connector_id}`. `notes.deleted` (de HU-02) registra `{cascade_connectors_count}` adicional cuando hay cascada.
- [ ] **B16.** `NoteConnectorResource` retorna `id, source_note_id, destination_note_id, style, created_at, updated_at`. NO expone `deleted_at` (campo interno). NO expone IDs internos extra (anti-enumeración, hereda patrón HU-02).
- [ ] **B17.** `NoteResource` se mantiene sin cambios: NO agrega `connectors` (es responsabilidad del frontend armar la lista cruzando IDs). Si en una HU futura se requiere incluir conectores en `NoteResource`, se discute aparte.
- [ ] **B18.** Mensajes de error de validación en HU-06 están hardcodeados en español en el backend, sin sistema i18n. Consistente con HU-02 y HU-05. Cualquier mensaje citado textualmente en un AC está sujeto a ese acuerdo — el implementador no debe agregar locale ni traducción, y el validador no debe exigir i18n sobre estos strings.
- [ ] **B19.** El cap de 6 por par no-ordenado (A2, B10) se valida en el `StoreNoteConnectorRequest` al momento del INSERT. **NO** se usa `SELECT ... FOR UPDATE` ni lock transaccional. Bajo concurrencia extrema (race entre 2 requests simultáneos creando el 7º conector entre el mismo par), es posible que ambos pasen la validación de `< 6` y creen el 7º y 8º conector. Esto es una decisión V1 aceptada; si el comportamiento se vuelve un problema, se migrará a lock transaccional en V2 (HU-07 o similar).

### Frontend

- [ ] **F1.** El FAB de conectores es un **botón flotante** separado del FAB "+" de HU-02. Recomendado: fixed `bottom: 24px; right: 24px;` (al lado del FAB de notas que está en `bottom: 24px; right: 24px;` — el de conectores se coloca arriba de él a 24px de gap), 56px de diámetro, color `#2563EB` (azul Tailwind `blue-600`), ícono de link/chain. Click activa el modo.
- [ ] **F2.** Cuando el modo está activo, el cursor del canvas cambia a `crosshair`. Un banner superior (`position: absolute; top: 16px; left: 50%; transform: translateX(-50%);`) muestra el mensaje `"Selecciona la nota de origen y luego la de destino. ESC para cancelar."`.
- [ ] **F3.** El modo se desactiva con: (a) tecla `ESC`, (b) creación exitosa de un conector (vuelve al modo normal tras un breve delay de 300ms), (c) click en un botón "Cancelar" del banner.
- [ ] **F4.** En modo conector, los clicks sobre `NoteCard` NO abren el `NoteEditor`. Se agrega un `onClick` interceptor: si el modo está activo, marca la nota como source (primer click) o destination (segundo click).
- [ ] **F5.** Click sobre canvas vacío durante el modo: ignora el click. NO cancela el modo. NO hace nada.
- [ ] **F6.** Click sobre la misma nota dos veces → el frontend intercepta con toast `"No puedes conectar una nota consigo misma"`. NO se hace request. El modo sigue activo (la nota sigue marcada como origen). Defensa adicional: si un cliente malicioso bypassa el frontend y envía el POST de todos modos, el backend lo rechaza con 422 y el mismo mensaje (ver AC56).
- [ ] **F7.** El mini-toolbar de edición (`ConnectorMiniToolbar`) aparece al hacer click sobre una flecha existente. Posicionamiento: cerca del punto medio del bezier (calculado en JS), con offset para no tapar la flecha. Contiene: selector de `style` (los 6 valores) y botón "Eliminar conector".
- [ ] **F8.** El selector de estilo del mini-toolbar usa los **nombres canónicos en inglés** (`Solid arrow end`, `Dashed arrow end`, etc.) como labels visibles. El valor que viaja al backend es el literal en `snake_case`.
- [ ] **F9.** Click fuera del mini-toolbar lo cierra. ESC al esc lo cierra. Edición de estilo via el selector dispara `PUT /api/note-connectors/{id}` inmediatamente (sin botón "Guardar" — apply-on-change). Confirmado en A7.
- [ ] **F10.** Botón "Eliminar conector" del mini-toolbar: pide confirmación con un `window.confirm("¿Eliminar este conector?")` y luego llama a `DELETE /api/note-connectors/{id}`. Tras éxito, el conector desaparece del `ConnectorLayer`.
- [ ] **F11.** El `ConnectorLayer` es una capa SVG (`<svg>` absoluto) sobre el canvas pero por debajo del `NoteEditor`. Las flechas se renderizan como `<path>` con bezier cuadrática. Stroke azul `#2563EB`, stroke-width `2`, fill `none`.
- [ ] **F12.** El color y stroke-width son **constantes CSS** en el módulo, no variables por conector. Cualquier customización por conector está **explícitamente fuera de scope** (§5).
- [ ] **F13.** Geometry helper `getAnchorPoint(note, otherNote)`: si la silueta es rectangular (`rectangle`, `rounded_rectangle`), se intersecta con el rectángulo 220x220. Si es poligonal (`diamond`, `triangle`, `star`, `hexagon`, `pentagon`, `octagon`, `arrow`, `parallelogram`, `trapezoid`, `message_bubble`, `cloud`, `cylinder`), se intersecta con el polígono del `clip-path`. Si es elíptica (`circle`, `ellipse`), se intersecta con elipse. Si falla la intersección, fallback al borde del bounding box.
- [ ] **F14.** Geometry helper `bezierPath(source, destination)`: bezier cuadrática con control point a la mitad del segmento perpendicular, offset perpendicular de ~80px para dar curvatura. La dirección del offset (izquierda vs derecha del segmento dirigido) es **determinista** — siempre el mismo lado para la misma orientación de A→B, sin aleatoriedad (ver AC86).
- [ ] **F15.** Marcadores de flecha (`marker-start`, `marker-end`) se renderizan como `<marker>` SVG. Tres marcadores: `arrow-end`, `arrow-start`, `arrow-both`. Se eligen según `style`.
- [ ] **F16.** Estilo dashed usa `stroke-dasharray: 6 4`. Estilo sólido no usa dasharray.
- [ ] **F17.** Al cargar `/tablero`, el frontend hace `GET /api/notes` + `GET /api/notes/connectors` en paralelo. Los conectores se hidratan en un `ConnectorContext` (o equivalente). Los `NoteCard` no son modificados; el `ConnectorLayer` lee del context.
- [ ] **F18.** Soft-delete de una nota (vía `DELETE /api/notes/{id}` o vía cascade de HU-02) → el frontend actualiza el estado removiendo esa nota y removiendo los conectores donde participaba. El backend ya cascade-elimina en DB; el frontend solo refleja.
- [ ] **F19.** Creación de un conector: el frontend hace `POST /api/notes/{sourceNoteId}/connectors` con `{destination_note_id, style: "solid_arrow_end"}`. Response 201 con `NoteConnectorResource`. El frontend agrega el conector al state y dibuja la flecha sin recargar.
- [ ] **F20.** Si el POST falla con 422 (self-connector, multiplicidad, style inválido, destino soft-deleted), el frontend muestra el mensaje del backend en un toast en español. NO entra el conector al state. El modo puede seguir activo para reintentar.
- [ ] **F21.** Si el POST falla con 401/403 (token expirado o usuario inactivo), el frontend limpia sesión y redirige a `/login` (transversal HU-01).

### Decisiones explícitas tomadas por el autor de esta HU (revisar)

- [ ] **A1.** El FAB de conectores se coloca **arriba del FAB de notas** (bottom-right, 24px del borde; el FAB de notas también está a 24px del borde pero el de conectores queda ~24px encima de él). Es decisión de layout — ambos FAB coexisten en la misma esquina sin solaparse.
- [ ] **A2.** Cap de multiplicidad = **6 conectores entre el mismo par no-ordenado (A y B, contando ambas direcciones)**. Razón: 6 cubre "muchas relaciones" entre dos nodos sin saturar el canvas visualmente. Si el usuario necesita más, puede crear otra nota intermedia. Es decisión ajustable: si el producto dice "hasta 10" o "sin cap", se cambia en A2.
- [ ] **A3.** Duplicados exactos (mismo `(source, destination, style)`) **SÍ se permiten** dentro del cap. Razón: el usuario podría querer dos flechas con el mismo estilo por claridad visual (no se solapan en el canvas si los anchor points son distintos — la curva bezier puede tener distintos control points si las notas se han movido entre creaciones). Decisión deliberada; alternativa sería "unique (source, destination, style)" pero se rechaza.
- [ ] **A4.** Self-connector (`source === destination`) **prohibido** en V1. Doble defensa: FormRequest + CHECK de DB. Razón: técnicamente posible (bucle en un grafo) pero rompe la metáfora visual de "conectar dos cosas distintas". Decisión:留给 el producto si quiere permitirlo en una HU futura.
- [ ] **A5.** Cap implementado **a nivel FormRequest** (cuenta los conectores activos entre el par ordenado y rechaza si `>= 6`). NO en DB (no hay UNIQUE con cap). Es decisión deliberada — la alternativa "UNIQUE(source, destination)" bloquearía duplicados exactos (rechazado en A3) y "trigger con COUNT" agrega complejidad innecesaria.
- [ ] **A6.** **NO optimistic lock** en `note_connectors` en V1. PUT gana sin chequeo. Decisión documentada en §5. Razón: el canvas no tiene realtime, los conflictos son raros en V1, y agregar lock exigiría propagar `updated_at` en todas las requests y manejar 409 en el `ConnectorMiniToolbar` (UX más compleja). Si en V2 hay reportes de "mi cambio se perdió", se agrega lock (HU-07).
- [ ] **A7.** Aplicación de cambio de estilo en el mini-toolbar: **apply-on-change** (sin botón Guardar). El selector dispara `PUT` al cambiar. Decisión: la operación es barata (un solo campo), el usuario espera feedback inmediato, y el mini-toolbar es efímero. Si la operación fuera más pesada, se pediría un botón Guardar.
- [ ] **A8.** Self-connector check en backend: **422** (validation error), no 400 (bad request). Razón: 422 es el status canónico para "request bien formado pero falla validación" (REST best practice). El cuerpo del error es `{"errors": {"destination_note_id": ["No puedes conectar una nota consigo misma."]}}`.
- [ ] **A9.** El endpoint `GET /api/notes/{note}/connectors` se mantiene **incluso** cuando existe `GET /api/notes/connectors` (helper transversal). Razón: es RESTful (sub-recurso de nota) y cubre el caso "ver qué conectores tiene una nota específica" sin pedir todo el tablero. Coste de implementación: bajo (mismo controller con filtro).
- [ ] **A10.** El mini-toolbar usa **`window.confirm`** para confirmar delete, no un modal custom. Decisión de implementación mínima — consistente con "sin tests automatizados, sin over-engineering" de HU-02. Si el producto quiere un modal bonito, es out of scope y se agrega en HU-07.
- [ ] **A11.** Color y stroke-width del conector son **constantes hardcoded** en CSS (`#2563EB`, `2px`). NO hay variables por entorno, NO hay admin para cambiarlos. Decisión deliberada: la customización por conector es explícitamente out of scope (§5).
- [ ] **A12.** La curva bezier usa **bezier cuadrática** (`Q` en SVG), no cúbica (`C`). Razón: cuadrática es suficiente para dar curvatura visual sin agregar complejidad; el control point único es más fácil de calcular y depurar.
- [ ] **A13.** El offset perpendicular del control point es **80px** (constante). Si las notas están muy juntas (<80px), el control point se acorta proporcionalmente para que la curva no exceda la línea recta. Implementación: `min(80px, distance / 2)`.
- [ ] **A14.** El color de los conectores **NO depende del status** de las notas (a diferencia del color de fondo de las notas que sí depende del status de HU-02). Razón: los conectores son relaciones, no entidades con status. Si en el futuro se quiere colorear por "tipo de relación", es una HU aparte.
- [ ] **A15.** El `ConnectorLayer` se redibuja **ante cada cambio de `notes` o `connectors`**. NO hay virtualización ni optimización para miles de conectores (HU-02 no escala a miles de notas, esta HU no escala a miles de conectores). Si la perf se vuelve un problema, es HU aparte.
- [ ] **A16.** Cuando se elimina una nota (soft delete) y cascade-elimina sus conectores, los usuarios que tengan el `ConnectorMiniToolbar` abierto sobre uno de esos conectores ven un **toast `"El conector fue eliminado porque una de sus notas fue eliminada"`** y el toolbar se cierra. No es 404 retroactivo: el frontend detecta la inconsistencia comparando IDs y muestra el toast.
- [ ] **A17.** El comportamiento ante drag de una nota: el connector se recalcula en vivo (los anchor points se recalculan y el bezier se redibuja). NO requiere persistencia (los anchor points no se guardan en DB — son geometría pura frontend). El endpoint `PATCH /api/notes/{id}/position` (HU-02) no necesita tocar conectores. Esto es por diseño (B1).

## Out of Scope

> Las siguientes funcionalidades **NO se incluyen en esta HU** aunque el concepto de conectores las haría naturales. Se listan explícitamente para que futuras HU las pidan con su propio disclaimer:

- [ ] Color de conector custom por conector (HU-06 fija azul `#2563EB` para todos).
- [ ] Stroke-width custom por conector (HU-06 fija 2px para todos).
- [ ] Estilos de flecha adicionales (HU-06 limita a los 6 valores del catálogo §6.1; no se agregan `dotted`, `double_line`, `thick`, etc.).
- [ ] Self-connectors (A→A) — explícitamente prohibido en V1.
- [ ] Conectores bidireccionales visuales con etiqueta "depends on" / "leads to" (no hay etiquetas).
- [ ] Etiquetas de texto en el medio de la flecha (`"causa"`, `"leadsto"`, custom).
- [ ] Animaciones al crear/eliminar una flecha (no hay fade-in/out).
- [ ] Animación continua de "flujo" sobre la flecha (estilo data flow diagrams).
- [ ] Drag-to-reshape del bezier (el usuario no puede editar la curvatura manualmente — A12 fija el algoritmo).
- [ ] Drag de un anchor point individual.
- [ ] Multi-fork: una nota source con varios destinations en un solo stroke (cada conector es source→destination 1 a 1).
- [ ] Optimistic lock sobre `note_connectors` (decisión A6, explícitamente fuera de V1).
- [ ] Historial / versiones de un conector (cuándo se creó, cuándo cambió de estilo).
- [ ] Undo/redo de creación/eliminación de un conector.
- [ ] Atajos de teclado para crear/eliminar conectores.
- [ ] Multi-select de conectores para aplicar el mismo estilo a varios a la vez.
- [ ] Marcar un conector como "favorito" o "anclado".
- [ ] Comentarios / anotaciones sobre un conector.
- [ ] Conectores entre una nota y un área del canvas (no target = nota).
- [ ] Conectores entre dos áreas del canvas sin notas.
- [ ] Conector a una posición fija del canvas (sin destination nota).
- [ ] Snap-to-grid de los conectores.
- [ ] Persistir el offset del control point del bezier (siempre es 80px, A13).
- [ ] Persistir los anchor points exactos (siempre se recalculan de `position_x/y` + `shape`, A17).
- [ ] Diferenciar visualmente conectores creados por distintos usuarios (no hay ownership, no hay color por autor).
- [ ] Conectores que cruzan otras notas con z-order visual "saltar" (no hay jump-arc ni jump-gap).
- [ ] Exportar el tablero con sus conectores como imagen.
- [ ] Imprimir el tablero respetando los conectores.
- [ ] Internacionalización de los nombres de estilos (siguen en inglés en el JSON; las labels visibles del mini-toolbar siguen en inglés en V1).
- [ ] Tooltip al hover sobre una flecha (no hay metadata extra para mostrar).
- [ ] Tests automatizados para los endpoints nuevos (regla de proyecto, AGENTS.md §3).
- [ ] Rate limit en los endpoints nuevos (heredado de HU-02: sin rate limit).
- [ ] Realtime: ver conectores que crea otro usuario sin refrescar (heredado de HU-02: sin realtime).
- [ ] Pan/zoom del canvas (heredado de HU-02: sin pan/zoom).
- [ ] Dark mode del ConnectorLayer (heredado de HU-02: sin dark mode).

## Variables y configuración

### 6.1 Catálogo de estilos de conector (`style`)

6 valores canónicos, todos DB CHECK-enforced. Default: `solid_arrow_end`.

| `style` value | Línea | Flecha(s) | Descripción visual |
|---------------|-------|-----------|---------------------|
| `solid_arrow_end` | continua | end | Línea continua con flecha al final (destination). **Default**. |
| `dashed_arrow_end` | discontinua (`stroke-dasharray: 6 4`) | end | Línea discontinua con flecha al final. |
| `solid_no_arrow` | continua | ninguna | Línea continua sin flechas. Indica relación sin dirección. |
| `dashed_no_arrow` | discontinua | ninguna | Línea discontinua sin flechas. |
| `arrow_both_solid` | continua | start + end | Línea continua con flechas en AMBOS extremos (bidireccional). |
| `solid_arrow_start` | continua | start | Línea continua con flecha al inicio (apunta al origen). |

> **Nota**: las labels visibles en el mini-toolbar usan los nombres en inglés (`Solid arrow end`, `Dashed arrow end`, etc.) como strings amigables. El valor que viaja al backend es el literal en `snake_case`.

### 6.2 Geometry helpers (frontend)

| Helper | Input | Output | Descripción |
|--------|-------|--------|-------------|
| `getNoteCenter(note)` | `note` | `{x, y}` | Centro del bounding box: `x = position_x + 110`, `y = position_y + 110` (HU-02 fija 220x220, centro a 110). |
| `getAnchorPoint(note, otherCenter)` | `note`, `{x, y}` destino | `{x, y}` anchor | Intersecta el segmento `note.center → otherCenter` con la silueta de `note`. Retorna el primer punto de intersección. Para formas rectangulares (`rectangle`, `rounded_rectangle`), es trivial. Para formas poligonales, requiere resolver contra el `clip-path` exacto. Para `circle`/`ellipse`, usa fórmula de intersección rayo-elipse. Fallback: borde del bounding box. |
| `bezierPath(source, destination)` | `{x, y} source`, `{x, y} destination` | SVG `d` string | Bezier cuadrática con control point en el punto medio perpendicular. Offset perpendicular = `min(80px, distance/2)`. |
| `markerFor(style)` | `style` string | `'start'` \| `'end'` \| `'both'` \| `null` | Decide qué marcador de flecha usar. |

### 6.3 Tabla de variables de configuración

#### Constants (no env var — hardcoded in code)

| Variable | Type | Default value | Description |
|----------|------|---------------|-------------|
| `NOTE_CONNECTOR_DEFAULT_STYLE` | string (literal canónico) | `solid_arrow_end` | Estilo por default al crear un conector. Hardcodeado en backend (migración) y frontend. NO traducir. NO es env var. |
| `NOTE_CONNECTOR_COLOR` | string hex color | `#2563EB` | Color único para TODOS los conectores. Hardcodeado en CSS (`ConnectorLayer.css`). NO se personaliza por conector. NO es env var. |
| `NOTE_CONNECTOR_STROKE_WIDTH_PX` | integer (px) | `2` | Grosor único para TODOS los conectores. Hardcodeado en CSS. NO es env var. |
| `NOTE_CONNECTOR_BEZIER_OFFSET_PX` | integer (px) | `80` | Offset perpendicular del control point del bezier. Hardcodeado en `bezierPath()`. Si `distance/2 < 80`, se usa `distance/2` (A13). NO es env var. |
| `NOTE_CONNECTOR_MAX_PER_PAIR` | integer | `6` | Cap de multiplicidad por par no-ordenado (A y B, contando ambas direcciones). Hardcodeado en `StoreNoteConnectorRequest` (A2, A5). NO es env var. |
| `NOTE_CONNECTOR_STYLE_LIST` | array<string> (literal canónico) | `['solid_arrow_end','dashed_arrow_end','solid_no_arrow','dashed_no_arrow','arrow_both_solid','solid_arrow_start']` | Lista de estilos permitidos. Mirror de CHECK de DB. Hardcodeado en modelo `NoteConnector`, en `StoreNoteConnectorRequest`, en `UpdateNoteConnectorRequest`, y en frontend. NO es env var. |
| `CONNECTOR_FAB_BG_COLOR` | string hex color | `#2563EB` | Color del FAB de conectores. Hardcodeado en CSS. NO es env var. |
| `CONNECTOR_FAB_DIAMETER_PX` | integer (px) | `56` | Diámetro del FAB de conectores. Hardcodeado en CSS. NO es env var. |
| `CONNECTOR_FAB_OFFSET_PX` | integer (px) | `24` | Distancia del FAB a los bordes inferior/derecho del viewport. Hardcodeado en CSS. NO es env var. |

#### Env vars (configurable per environment)

Ninguno. **HU-06 no introduce ninguna variable de entorno nueva**. Todos los valores configurables son constantes hardcoded (sección anterior). Si en el futuro se requiere configurar el cap, color, o cualquier otro valor por entorno, se introduce como env var aquí y se lee vía `config/note_connectors.php` o `env()`.

### 6.4 Sketch de migración de tabla nueva

```sql
-- Nueva migración: create_note_connectors_table
CREATE TABLE note_connectors (
    id                    BIGSERIAL PRIMARY KEY,
    source_note_id        BIGINT NOT NULL,
    destination_note_id   BIGINT NOT NULL,
    style                 VARCHAR(30) NOT NULL DEFAULT 'solid_arrow_end',
    created_at            TIMESTAMP NULL,
    updated_at            TIMESTAMP NULL,
    deleted_at            TIMESTAMP NULL,
    CONSTRAINT note_connectors_style_check
        CHECK (style IN (
            'solid_arrow_end',
            'dashed_arrow_end',
            'solid_no_arrow',
            'dashed_no_arrow',
            'arrow_both_solid',
            'solid_arrow_start'
        )),
    CONSTRAINT note_connectors_no_self_check
        CHECK (source_note_id <> destination_note_id),
    CONSTRAINT note_connectors_source_fk
        FOREIGN KEY (source_note_id)
        REFERENCES notes(id)
        ON DELETE CASCADE,
    CONSTRAINT note_connectors_destination_fk
        FOREIGN KEY (destination_note_id)
        REFERENCES notes(id)
        ON DELETE CASCADE
);

-- Índices para queries frecuentes
CREATE INDEX note_connectors_source_idx ON note_connectors (source_note_id) WHERE deleted_at IS NULL;
CREATE INDEX note_connectors_destination_idx ON note_connectors (destination_note_id) WHERE deleted_at IS NULL;
```

Equivalente Laravel (`up()`):

```php
public function up(): void
{
    Schema::create('note_connectors', function (Blueprint $table) {
        $table->id();
        $table->foreignId('source_note_id')
            ->constrained('notes')
            ->cascadeOnDelete();
        $table->foreignId('destination_note_id')
            ->constrained('notes')
            ->cascadeOnDelete();
        $table->string('style', 30)->default('solid_arrow_end');
        $table->timestamps();
        $table->softDeletes();
    });

    if (config('database.default') === 'pgsql') {
        \DB::statement("ALTER TABLE note_connectors ADD CONSTRAINT note_connectors_style_check CHECK (style IN ('solid_arrow_end','dashed_arrow_end','solid_no_arrow','dashed_no_arrow','arrow_both_solid','solid_arrow_start'))");
        \DB::statement("ALTER TABLE note_connectors ADD CONSTRAINT note_connectors_no_self_check CHECK (source_note_id <> destination_note_id)");
    }
}

public function down(): void
{
    if (config('database.default') === 'pgsql') {
        \DB::statement('ALTER TABLE note_connectors DROP CONSTRAINT IF EXISTS note_connectors_style_check');
        \DB::statement('ALTER TABLE note_connectors DROP CONSTRAINT IF EXISTS note_connectors_no_self_check');
    }
    Schema::dropIfExists('note_connectors');
}
```

### 6.5 Cascade soft-delete (model boot)

```php
// app/Models/Note.php (extracto)
protected static function booted(): void
{
    // ... HU-02 listeners existentes ...

    static::deleting(function (Note $note) {
        if (! $note->isForceDeleting()) {
            // Soft delete cascade para conectores.
            // Se envuelve explícitamente en DB::transaction() para garantizar atomicidad:
            // si el loop falla a mitad, los conectores ya soft-deleted se revierten
            // junto con la nota (que tampoco quedará soft-deleted). El listener confía
            // en este wrapper transaccional explícito — NO depende del comportamiento
            // default de Laravel (que no garantiza transacción en eventos de modelo).
            DB::transaction(function () use ($note) {
                NoteConnector::where('source_note_id', $note->id)
                    ->orWhere('destination_note_id', $note->id)
                    ->get()
                ->each(function (NoteConnector $connector) {
                    $connector->delete(); // soft delete
                });
            });
        }
    });
}
```

> **Nota**: el listener se registra dentro de `booted()` y solo se dispara en soft delete (`isForceDeleting() === false`). En hard delete, las FKs con `ON DELETE CASCADE` (declaradas en DB) harían el trabajo, pero como esta app no hace hard delete, el listener es la única vía real. El `DB::transaction(function () { ... })` es **explícito y obligatorio** — el listener NO depende de la transacción default de Laravel (que no se garantiza automáticamente dentro de un evento `deleting`).

### 6.6 Sketch de payloads

> **Convención global de wrapping** (aplica a todos los endpoints de HU-06):
> - **Single-resource responses** (`POST 201`, `PUT 200`, `GET by id`): envuelven en `{connector: {...}}`.
> - **Collection responses** (`GET list`): envuelven en `{connectors: [...]}`.
> - **`DELETE 204`**: sin body, status 204.
> Esta convención es consistente con HU-02 (`{note: {...}}` / `{notes: [...]}`) y se respeta en todos los ACs.

**POST /api/notes/{note}/connectors** (request):
```json
{
  "destination_note_id": 17,
  "style": "solid_arrow_end"
}
```

**POST /api/notes/{note}/connectors** (response 201):
```json
{
  "connector": {
    "id": 42,
    "source_note_id": 12,
    "destination_note_id": 17,
    "style": "solid_arrow_end",
    "created_at": "2026-09-27T20:14:02+00:00",
    "updated_at": "2026-09-27T20:14:02+00:00"
  }
}
```

**GET /api/notes/connectors** (response 200):
```json
{
  "connectors": [
    {
      "id": 42,
      "source_note_id": 12,
      "destination_note_id": 17,
      "style": "solid_arrow_end",
      "created_at": "2026-09-27T20:14:02+00:00",
      "updated_at": "2026-09-27T20:14:02+00:00"
    },
    {
      "id": 43,
      "source_note_id": 12,
      "destination_note_id": 18,
      "style": "dashed_arrow_end",
      "created_at": "2026-09-27T20:15:11+00:00",
      "updated_at": "2026-09-27T20:15:11+00:00"
    }
  ]
}
```

**PUT /api/note-connectors/{id}** (request):
```json
{
  "style": "arrow_both_solid"
}
```

**PUT /api/note-connectors/{id}** (response 200):
```json
{
  "connector": {
    "id": 42,
    "source_note_id": 12,
    "destination_note_id": 17,
    "style": "arrow_both_solid",
    "created_at": "2026-09-27T20:14:02+00:00",
    "updated_at": "2026-09-27T20:16:33+00:00"
  }
}
```

**DELETE /api/note-connectors/{id}** (response 204, vacío).

## Happy Path

### Flow 1 — Crear conector básico (Frontend → Backend)

1. Usuario autenticado está en `/tablero` con N notas en el canvas.
2. Usuario hace click en el **FAB redondo azul de conectores** (bottom-right, encima del FAB de notas).
3. Frontend entra en **"add connector mode"**: cursor `crosshair`, banner superior `"Selecciona la nota de origen y luego la de destino. ESC para cancelar."`, `ConnectorFab` queda con un ligero cambio visual (sombra más intensa o color más claro para indicar "activo").
4. Usuario hace click sobre la `NoteCard` A (source). Frontend marca A como origen: aplica `outline: 3px solid #2563EB` + un small badge "Origen" flotante en una esquina de A.
5. Usuario hace click sobre la `NoteCard` B (destination), B ≠ A.
6. Frontend calcula `sourceAnchor = getAnchorPoint(A, center(B))` y `destAnchor = getAnchorPoint(B, center(A))`. Genera `pathD = bezierPath(sourceAnchor, destAnchor)`.
7. Frontend → `POST /api/notes/{A.id}/connectors` con `{destination_note_id: B.id, style: "solid_arrow_end"}`.
8. Backend: `StoreNoteConnectorRequest` valida `destination_note_id` (existe y no soft-deleted), `style` (in allow-list). Pasa validación.
9. Backend: `NoteConnectorService::create(A, B, "solid_arrow_end")` chequea que `A !== B` (B12), chequea que el cap de 6 entre el par no-ordenado (A, B) no se excede (B10), persiste el conector con `style='solid_arrow_end'` y `deleted_at=null`.
10. Backend loguea `note_connectors.created` con `{user_id, connector_id, source_note_id: A.id, destination_note_id: B.id, style}`.
11. Backend responde **201** con `NoteConnectorResource`.
12. Frontend agrega el conector al state; dibuja la flecha en el `ConnectorLayer` con stroke azul `#2563EB`, stroke-width `2`, marker-end de flecha (default `solid_arrow_end`).
13. Frontend **sale del modo conector** tras 300ms (UX decisión; evita creación accidental de varios conectores en rápida sucesión).
14. Toast `"Conector creado"`.

### Flow 2 — Ver conectores tras refresh del tablero

1. Usuario refresca `/tablero` (F5).
2. Frontend hace `GET /api/notes` + `GET /api/notes/connectors` en paralelo.
3. Backend retorna todas las notas activas (HU-02) y todos los conectores activos (HU-06).
4. Frontend hidrata `NoteContext` y `ConnectorContext`. Dibuja notas y `ConnectorLayer`.
5. Cada conector en el `ConnectorLayer` se renderiza como `<path>` con su bezier y marcadores según `style`. Color `#2563EB`, stroke `2`.

### Flow 3 — Editar estilo de un conector via mini-toolbar

1. Usuario tiene N conectores en el canvas.
2. Usuario hace click sobre una flecha (`<path>` con hit-area ampliada para fácil click).
3. Frontend abre `ConnectorMiniToolbar` cerca del midpoint del bezier (con offset). El toolbar muestra: selector con los 6 estilos (default = el `style` actual del conector), botón "Eliminar conector".
4. Usuario cambia el selector de `solid_arrow_end` a `arrow_both_solid`. **Al cambiar el valor, el frontend dispara inmediatamente** `PUT /api/note-connectors/{id}` con `{style: "arrow_both_solid"}`. NO hay botón Guardar (apply-on-change, A7).
5. Backend: `UpdateNoteConnectorRequest` valida `style`. Pasa. `NoteConnectorService::update` actualiza `style` y `updated_at`. Loguea `note_connectors.updated`.
6. Backend responde **200** con `NoteConnectorResource`.
7. Frontend actualiza el state del conector; redibuja la flecha con el nuevo estilo (markers `start` + `end`, línea continua).
8. El `ConnectorMiniToolbar` sigue abierto hasta que el usuario click fuera, pulse ESC o cierre la pestaña.

### Flow 4 — Eliminar conector via mini-toolbar

1. Usuario click sobre una flecha → abre `ConnectorMiniToolbar`.
2. Usuario click en "Eliminar conector".
3. Frontend muestra `window.confirm("¿Eliminar este conector?")`.
5. Usuario confirma. Frontend → `DELETE /api/note-connectors/{id}`.
6. Backend: `NoteConnectorService::delete(connector)` hace `softDelete`. Loguea `note_connectors.deleted`.
7. Backend responde **204**.
8. Frontend remueve el conector del state; el `ConnectorLayer` redibuja sin esa flecha. Toast `"Conector eliminado"`. El `ConnectorMiniToolbar` se cierra.

### Flow 5 — Soft-delete de una nota cascade-elimina sus conectores

1. Usuario A soft-deleta la nota N1 vía `DELETE /api/notes/{N1.id}` (HU-02 flow).
2. Backend: `NoteService::delete(N1)` setea `deleted_at` en `N1`.
3. Listener de `Note::deleting` se dispara; llama a `NoteConnectorService::cascadingDeleteForNote(N1)`.
4. El listener hace `NoteConnector::where('source_note_id', N1.id)->orWhere('destination_note_id', N1.id)->get()->each(fn($c) => $c->delete())` dentro de la misma transacción.
5. Backend loguea `notes.deleted` con `cascade_connectors_count: 3` (si N1 tenía 3 conectores).
6. Backend responde **204**.
7. Frontend recibe respuesta del DELETE; actualiza state removiendo N1; hace un `GET /api/notes/connectors` (o usa el response si incluye info de cascada) para actualizar conectores; redibuja.
8. Las 3 flechas que salían o llegaban a N1 ya no aparecen en el canvas.
9. Un `GET /api/notes/connectors` confirma que esos conectores están con `deleted_at` set (no se retornan al frontend).

### Flow 6 — Cancelar modo conector con ESC

1. Usuario click FAB de conectores → modo activo.
2. Banner visible, cursor `crosshair`.
3. Usuario pulsa **ESC**.
4. Frontend sale del modo: cursor vuelve a `default`, banner desaparece, `ConnectorFab` vuelve a su estilo normal. NO se hizo ningún request. NO se creó ningún conector.

### Flow 7 — Drag de una nota recalcula sus conectores en vivo

1. Usuario arrastra la nota N1 a una nueva posición (`PATCH /api/notes/{N1.id}/position`, HU-02 flow).
2. Backend actualiza `position_x`, `position_y`, `updated_at` de N1.
3. Frontend recibe 204; reposiciona N1 en el canvas.
4. El `ConnectorLayer` recalcula automáticamente los anchor points y bezier paths para todos los conectores donde N1 es source o destination. NO requiere persistencia adicional. La animación es suave (re-render en cada frame de drag, usando `requestAnimationFrame` o similar).
5. Al soltar el drag, el `PATCH /api/notes/{N1.id}/position` ya se hizo con la posición final; los conectores quedan visualmente consistentes con la nueva posición de N1.

### Flow 8 — Crear nota con conector a nota existente

1. Usuario tiene N2 en el canvas. Usuario crea N3 vía FAB de notas (HU-02).
2. `POST /api/notes` con la posición. Backend crea N3.
3. Frontend recibe N3; la dibuja en el canvas.
4. Usuario click en FAB de conectores → modo activo.
5. Usuario click sobre N2 (origen) → highlight.
6. Usuario click sobre N3 (destination). Frontend → `POST /api/notes/{N2.id}/connectors` con `{destination_note_id: N3.id, style: "solid_arrow_end"}`.
7. Backend persiste; responde 201.
8. Frontend dibuja la flecha N2 → N3. Modo se desactiva tras 300ms.

## Sad Paths

### POST /api/notes/{note}/connectors — Self-connector rechazado

- **Condition**: Usuario click dos veces sobre la misma nota (source == destination).
- **Expected behavior**: Doble defensa. (1) El frontend intercepta antes del POST y muestra el toast; NO se envía HTTP request. (2) Si un cliente malicioso bypassa el frontend y envía el POST, el `StoreNoteConnectorRequest` lo rechaza con 422 via FormRequest (B9). El `CHECK (source_note_id <> destination_note_id)` de DB es defensa en profundidad.
- **Message/UI**: Toast `"No puedes conectar una nota consigo misma."` (A8). NO se hace persistencia. El modo conector sigue activo (la nota sigue marcada como source).

### POST /api/notes/{note}/connectors — Cap de multiplicidad excedido

- **Condition**: Ya hay 6 conectores activos entre la nota source y la destination. El usuario intenta crear un séptimo.
- **Expected behavior**: Backend rechaza con 422.
- **Message/UI**: Toast `"Máximo 6 conectores entre el mismo par de notas."` (A2). NO se persiste.

### POST /api/notes/{note}/connectors — destination_note_id soft-deleted

- **Condition**: La nota destino fue soft-deleted por otro usuario entre el GET inicial y el POST.
- **Expected behavior**: Backend rechaza con 422 (`destination_note_id must reference an active note`).
- **Message/UI**: Toast con el mensaje del backend en español. Frontend no persiste.

### POST /api/notes/{note}/connectors — destination_note_id no existe

- **Condition**: `destination_note_id` no corresponde a ninguna nota (ni siquiera soft-deleted).
- **Expected behavior**: Backend rechaza con 422 (`exists` rule).
- **Message/UI**: Toast `"La nota destino no existe."`.

### POST /api/notes/{note}/connectors — style inválido

- **Condition**: Cliente envía `style="custom_style"` (no en catálogo §6.1).
- **Expected behavior**: Backend rechaza con 422 (`in:` rule).
- **Message/UI**: Toast con mensaje del backend.

### POST /api/notes/{note}/connectors — source_note_id soft-deleted (404)

- **Condition**: El usuario intenta crear un conector desde una nota que fue soft-deleted (path `{note}` es soft-deleted).
- **Expected behavior**: Backend resuelve con Route Model Binding + scope global; la nota no se encuentra; 404.
- **Message/UI**: Toast `"Esta nota ya no existe."`.

### POST /api/notes/{note}/connectors — 401 (sin token)

- **Condition**: Request sin Bearer token.
- **Expected behavior**: Middleware `auth:sanctum` rechaza.
- **Message/UI**: Frontend limpia sesión y redirige a `/login` (transversal HU-01).

### POST /api/notes/{note}/connectors — 403 (usuario inactivo)

- **Condition**: Token válido, `is_active=false`.
- **Expected behavior**: Middleware `EnsureUserIsActive` rechaza.
- **Message/UI**: Redirect a `/login` con mensaje de inactividad.

### POST /api/notes/{note}/connectors — Network failure (ERR_CONNECTION_REFUSED)

- **Condition**: Backend no alcanzable al crear conector.
- **Expected behavior**: Axios rechaza. Frontend captura.
- **Message/UI**: Toast `"No se pudo contactar al servidor. Verifica tu conexión."`. NO se agrega el conector al state. El modo conector puede seguir activo.

### POST /api/notes/{note}/connectors — Timeout 10s

- **Condition**: Request tarda más de 10s.
- **Expected behavior**: Axios aborta.
- **Message/UI**: Toast `"La solicitud tardó demasiado. Intenta nuevamente."`.

### PUT /api/note-connectors/{id} — style inválido

- **Condition**: Cliente envía `style="invalid"` desde el selector.
- **Expected behavior**: Backend rechaza con 422.
- **Message/UI**: El mini-toolbar revierte el selector al valor previo (último persistido); toast con mensaje del backend.

### PUT /api/note-connectors/{id} — connector soft-deleted (404)

- **Condition**: Otro usuario eliminó el conector entre la apertura del mini-toolbar y el PUT.
- **Expected behavior**: Backend responde 404.
- **Message/UI**: Toast `"Este conector ya no existe."`. Frontend remueve el conector del state y cierra el mini-toolbar.

### PUT /api/note-connectors/{id} — 401/403 (token expirado / inactivo)

- **Condition**: Token expirado o `is_active=false`.
- **Expected behavior**: Middleware rechaza.
- **Message/UI**: Frontend limpia sesión y redirige a `/login`.

### DELETE /api/note-connectors/{id} — 404 (ya eliminado)

- **Condition**: Otro usuario eliminó el conector antes.
- **Expected behavior**: Backend responde 404.
- **Message/UI**: Toast `"Este conector ya no existe."`. Frontend remueve el state (puede ser redundante, es OK).

### GET /api/notes/connectors — Backend caído

- **Condition**: `ERR_CONNECTION_REFUSED` al cargar el tablero.
- **Expected behavior**: Axios rechaza.
- **Message/UI**: Toast `"No se pudo contactar al servidor."`. Canvas sin notas ni conectores.

### GET /api/notes/connectors — 500 (error inesperado)

- **Condition**: Backend responde 500.
- **Expected behavior**: Frontend no puede hidratar el `ConnectorLayer`.
- **Message/UI**: Toast `"Error inesperado. Intenta nuevamente."`.

### Frontend — Click sobre flecha que ya no existe (race)

- **Condition**: Usuario click sobre una flecha que fue soft-deleted por otro usuario entre el render y el click.
- **Expected behavior**: El hit-test del SVG puede fallar. Frontend no abre mini-toolbar. Si lo abre (defensa), el PUT subsecuente responde 404 (sad path anterior).
- **Message/UI**: Sin error visible, o toast `"Este conector ya no existe."`.

### Frontend — Mini-toolbar abierto y una nota relacionada se elimina

- **Condition**: Usuario tiene mini-toolbar abierto sobre conector C (entre N1 y N2). Otro usuario soft-deleta N1. Cascade elimina C.
- **Expected behavior**: Frontend (al refrescar state desde el próximo GET) detecta que N1 y/o C ya no existen. El mini-toolbar se cierra automáticamente (A16).
- **Message/UI**: Toast `"El conector fue eliminado porque una de sus notas fue eliminada"`. Mini-toolbar se cierra.

### Frontend — POST falla y modo conector queda activo

- **Condition**: Cualquier sad path de POST que no sea 401/403.
- **Expected behavior**: Modo conector sigue activo. La nota source sigue marcada. El usuario puede intentar otra destination o pulsar ESC.
- **Message/UI**: Toast con el mensaje del error. NO se desactiva el modo.

## Edge Cases

- [ ] **E1.** Modo conector activo, usuario click sobre el canvas vacío (no sobre una nota) → ignora el click. NO cancela el modo. Banner sigue visible.
- [ ] **E2.** Modo conector activo, usuario click sobre el FAB de "+ Nota" de HU-02 → sale del modo conector Y abre el editor de nueva nota. Comportamiento: el FAB de notas tiene prioridad; el modo conector se cancela silenciosamente.
- [ ] **E3.** Modo conector activo, usuario pulsa TAB → foco va al banner superior; el modo NO se cancela. ESC sigue siendo la única tecla de salida.
- [ ] **E4.** Nota source marcada, usuario click sobre una nota que está siendo arrastrada (drag en curso) → no se puede: el drag absorbe el evento. Para marcar la nota como source, el usuario debe soltar el drag primero.
- [ ] **E5.** Nota source marcada, usuario click sobre la nota que está marcada como source → sad path self-connector (no se rechaza en frontend, va al backend, 422).
- [ ] **E6.** Las dos notas (source y destination) están en la misma posición exacta (position_x y position_y idénticos) → el segmento source→destination tiene longitud 0; el bezier degenera a un punto. Decisión: renderizar el bezier degenerado como un círculo pequeño (o no renderizar). Documentado: edge case visual; el connector igual se persiste.
- [ ] **E7.** Las dos notas están superpuestas (overlapping) → el bezier pasa por dentro de las dos notas. Decisión: aceptable; el usuario puede mover las notas si quiere verlas mejor.
- [ ] **E8.** Las dos notas están a >1000px de distancia → el bezier es muy ancho. Decisión: aceptable; el offset perpendicular es `min(80, distance/2) = 80`, lo que da una curvatura proporcional al lienzo.
- [ ] **E9.** Una nota tiene `shape=cloud` (silueta muy irregular) → el `getAnchorPoint` intersecta con el polígono del `clip-path`. Decisión: fallback al bounding box si la intersección falla. La flecha puede entrar a la nube por una esquina del bounding box en vez de por un lóbulo. Aceptable.
- [ ] **E10.** Una nota tiene `shape=arrow` apuntando a la derecha y el destino está a la izquierda → la flecha del conector sale por la cola del `arrow` de la nota (no por la punta), que es la decisión correcta de anchor (cola del arrow apunta away from the destination si destination está a la izquierda).
- [ ] **E11.** Una nota tiene `shape=circle` y otra tiene `shape=ellipse` → el anchor de cada uno se calcula contra su propia silueta. El bezier es continuo entre los dos anchors.
- [ ] **E12.** El usuario crea 6 conectores entre A y B en cualquier dirección (cap unordered) → al intentar un séptimo (en cualquier dirección), backend 422. UI muestra el mensaje. Decisión A2.
- [ ] **E13.** El usuario elimina un conector que está en el medio de los 6 entre A y B → ahora hay 5 conectores; puede crear uno más (queda 6, todavía bajo el cap).
- [ ] **E14.** El usuario crea un conector A→B con style `solid_arrow_end`. Después crea otro conector A→B con style `dashed_arrow_end`. Ambos coexisten (A3: duplicados exactos prohibidos, distintos estilos permitidos).
- [ ] **E15.** Multi-tab: Usuario A en tab 1 crea conector A↔B. Usuario A en tab 2 hace F5 → ve el conector (porque `GET /api/notes/connectors` retorna los activos).
- [ ] **E16.** Multi-tab: Usuario A en tab 1 está en modo conector (no ha hecho segundo click). Usuario A en tab 2 está en modo normal. Los modos son independientes por tab (cada tab tiene su propio `ConnectorModeContext`). El canvas de cada tab es su propia vista del backend.
- [ ] **E17.** Multi-user concurrente: Usuario 1 crea conector A→B; Usuario 2 al mismo tiempo crea conector A→B. Ambos requests pasan validación (cap de 6); ambos se crean. Decisión A3: multiplicidad permitida.
- [ ] **E18.** Multi-user concurrente: Usuario 1 elimina nota A (cascade). Usuario 2 está creando conector X→A. El POST de Usuario 2 llega después del cascade: `destination_note_id=A.id` ahora está soft-deleted; backend rechaza con 422 (`destination_note_id must reference an active note`). El frontend muestra toast.
- [ ] **E19.** Multi-user concurrente: Usuario 1 está editando estilo de conector C en su mini-toolbar. Usuario 2 elimina conector C. El PUT de Usuario 1 llega después del DELETE: 404 (sad path).
- [ ] **E20.** El usuario hace F5 a media creación (POST enviado pero respuesta no recibida) → al volver a cargar, `GET /api/notes/connectors` muestra el conector si se persistió. Si no se persistió (request falló), no aparece. Sin estado intermedio visible.
- [ ] **E21.** Cascade delete de una nota que tiene 50 conectores → el listener hace 50 `delete()` en un loop. Decisión: aceptar el costo. Si en el futuro hay notas con miles de conectores, se cambia a un `update` con `WHERE` (single SQL statement).
- [ ] **E22.** Una nota soft-deleted (cascade-eliminó sus conectores) es restaurada (futuro undo, no implementado en HU-02) → sus conectores NO se restauran porque ya fueron soft-deleted por separado. Decisión: aceptar. Undo restore de notas no está en HU-02.
- [ ] **E23.** El usuario hace click sobre una flecha pero la flecha está exactamente debajo de una nota (overlap) → el `z-index` del `ConnectorLayer` está por debajo de las notas, por lo que el hit-test va a la nota, no a la flecha. Decisión: el usuario debe mover la nota o arrastrar el canvas para acceder a la flecha. (No hay pan/zoom en HU-02, así que "arrastrar el canvas" no aplica; el usuario tiene que mover la nota.)
- [ ] **E24.** El `ConnectorLayer` SVG no carga (error JS, CSP) → las notas se siguen viendo, los conectores no. Sin error visible al usuario. Decisión: degradación aceptable; si el navegador no soporta SVG, el tablero es inusable de todos modos.
- [ ] **E25.** El usuario cambia el `style` desde el mini-toolbar, recibe 200, pero la respuesta no se refleja en el canvas (bug visual) → frontend debe re-renderizar el `ConnectorLayer` con el nuevo `style` del state. Es un test de regresión, no un edge case esperado.

## Stupid Cases

### Validación e input malicioso

- [ ] **S1.** Enviar `destination_note_id` con valor negativo (`-1`) → FormRequest rechaza (`exists` rule, no match).
- [ ] **S2.** Enviar `destination_note_id` con valor de string (`"foo"`) → FormRequest rechaza (`integer` rule).
- [ ] **S3.** Enviar `destination_note_id` con valor `null` → FormRequest rechaza (`required` rule).
- [ ] **S4.** Enviar `destination_note_id` con valor de la nota source (`source_note_id === destination_note_id`) → 422 con mensaje `"No puedes conectar una nota consigo misma."`.
- [ ] **S5.** Enviar `style="solid_arrow_end; DROP TABLE notes;--"` (SQL injection via JSON) → Eloquent parametriza; el valor llega como string al CHECK de DB, falla el constraint. NO se ejecuta SQL.
- [ ] **S6.** Enviar `style="<script>alert(1)</script>"` → FormRequest rechaza por `in:` rule. Si pasara (no debería), React escapa por defecto al renderizar.
- [ ] **S7.** Enviar `style=""` (string vacío) → FormRequest rechaza por `in:` rule.
- [ ] **S8.** Enviar `style="SOLID_ARROW_END"` (mayúsculas) → FormRequest rechaza por `in:` rule (case-sensitive).
- [ ] **S9.** Enviar `style="solid_arrow_end "` (espacio al final) → FormRequest rechaza por `in:` rule.
- [ ] **S10.** Enviar `style` como número (`42`) → FormRequest rechaza (no string del allow-list).
- [ ] **S11.** Enviar `style` como array (`["solid_arrow_end"]`) → FormRequest rechaza (`string` rule).
- [ ] **S12.** Enviar body completamente vacío al POST → 422 (`destination_note_id required`).
- [ ] **S13.** Enviar body con `destination_note_id` válido pero con `style: null` → el `style` es opcional (`sometimes`); backend aplica default de DB.
- [ ] **S14.** Enviar `PUT /api/note-connectors/{id}` con body vacío → 422 (`style required`).
- [ ] **S15.** Enviar `PUT /api/note-connectors/{id}` con body que NO incluye `style` → 422.
- [ ] **S16.** `PUT /api/note-connectors/{id}` con `style: null` explícito → 422 (`string` rule).
- [ ] **S17.** `PUT /api/note-connectors/{id}` con `style` y otros campos extra (`source_note_id`, `destination_note_id`) → FormRequest ignora silenciosamente los campos extra (Laravel default behavior); solo `style` se persiste.

### Multiplicidad y cap

- [ ] **S18.** Intentar crear 7 conectores A→B (o una mezcla A→B / B→A totalizando 7) en rápida sucesión → el 7º recibe 422 (cap unordered).
- [ ] **S19.** Crear 6 conectores A→B, eliminar 1, crear otro → el último se crea (queda 6).
- [ ] **S20.** Crear 6 conectores A→B, intentar cambiar el estilo de uno de ellos → el PUT cambia el estilo sin tocar el cap (el cap cuenta cantidad, no estilo).
- [ ] **S21.** Crear 3 conectores A→B y 3 conectores B→A (total 6 entre el par no-ordenado, cap unordered) → intentar crear un séptimo (en cualquier dirección) → 422. El cap cuenta ambas direcciones juntas, no cada dirección por separado.

### Persistencia y migration

- [ ] **S22.** Correr `php artisan migrate` con la tabla ya creada → la migración falla porque `CREATE TABLE` no es idempotente. Decisión: implementar `Schema::dropIfExists` + recreate, o detectar con `Schema::hasTable` antes de crear. Documentado.
- [ ] **S23.** Rollback (`migrate:rollback`) dropea la tabla → si hay conectores activos, se pierden. Aceptable (rollback).
- [ ] **S24.** DB local con `sqlite` (test) sin CHECKs → la validación depende enteramente del FormRequest. Defensa en profundidad: el `NoteConnectorService::create` también valida.
- [ ] **S25.** INSERT manual en `psql` con `source_note_id=destination_note_id` → el CHECK de DB rechaza.
- [ ] **S26.** INSERT manual en `psql` con `style='invalid'` → el CHECK de DB rechaza.

### Frontend / UI

- [ ] **S27.** Doble-click rápido sobre el FAB de conectores → el modo entra y sale (no se crea conector). Sin error visible.
- [ ] **S28.** Spam-click sobre el FAB de conectores (10 clicks en 2 segundos) → el modo queda activo (el toggle es idempotente). Sin error visible.
- [ ] **S29.** Click sobre el FAB de conectores mientras se está editando una nota en `NoteEditor` → ¿qué pasa? Decisión: el FAB no es alcanzable porque el `NoteEditor` está en modal con overlay; el click sobre el overlay no llega al FAB. Sin error visible.
- [ ] **S30.** Modo conector activo, usuario abre DevTools y hace `ConnectorFab.click()` programáticamente → el modo entra/sale según el toggle. Sin error.
- [ ] **S31.** Modo conector activo, usuario hace `document.dispatchEvent(new KeyboardEvent('Escape'))` → ESC sale del modo (mismo handler).
- [ ] **S32.** Click sobre el banner superior mientras está en modo conector → el banner no tiene handlers de click (es solo informativo). Sin error.
- [ ] **S33.** Click derecho sobre una flecha → menú contextual nativo del navegador (no se intercepta). Sin error.
- [ ] **S34.** Doble click sobre una flecha → abre el mini-toolbar (idempotente: si ya está abierto, lo deja). Sin error.
- [ ] **S35.** Click sobre el botón "Eliminar conector" del mini-toolbar, luego click "Cancelar" en el `window.confirm` → no se hace DELETE; mini-toolbar sigue abierto; conector sigue visible.
- [ ] **S36.** Cambio rápido de estilo en el mini-toolbar (5 cambios en 2 segundos) → cada cambio dispara un PUT. Decisión: aceptar (PUTs idempotentes en estilo, no hay lock). El backend no implementa rate limiting en V1; bajo flood legítimo, los PUTs se procesan en orden de llegada.
- [ ] **S37.** Cambio de estilo, GET lento de respuesta → el mini-toolbar muestra el valor optimista (el último valor seleccionado) y revierte si llega un 4xx. Si llega 200, el state queda consistente.
- [ ] **S38.** `prefers-reduced-motion: reduce` activo en OS → la re-renderización del bezier durante el drag de una nota es instantánea (no hay transición animada). Aceptable.
- [ ] **S39.** Navegador sin soporte para SVG (`<path>`) → el `ConnectorLayer` no se renderiza; notas siguen visibles. Decisión: no romper el tablero; documentar como limitación.

### Concurrencia y multi-tab

- [ ] **S40.** Usuario A en tab 1 crea conector X→Y. Usuario A en tab 2 hace F5 → ve X→Y.
- [ ] **S41.** Usuario A en tab 1 está en modo conector (sin haber hecho segundo click). Usuario A en tab 2 está en modo normal. Cierra tab 1. Modo en tab 1 se descarta (al cerrar el tab). Tab 2 sigue normal.
- [ ] **S42.** Usuario A en tab 1 y tab 2. En tab 1 elimina la nota A1. En tab 2 tenía un mini-toolbar abierto sobre conector C (entre A1 y B1). Tab 2: el cascade-elimina C en el backend; tab 2 no se entera hasta el próximo GET. Mientras tanto, el mini-toolbar sigue abierto sobre C. Si el usuario click "Eliminar", el PUT devuelve 404. Si hace F5, ve la nueva realidad.
- [ ] **S43.** Dos usuarios crean conector entre las mismas A y B al mismo tiempo → ambos requests pasan el cap check (race condition window muy chico). Decisión: aceptar la posibilidad de tener 7+ conectores en este edge case. El cap se valida "at the moment del query"; no es transaccionalmente estricto.
- [ ] **S44.** Usuario A crea nota N. Usuario B crea conector A→N antes de que el GET de N se propague al cliente de A → el POST de B usa `destination_note_id=N.id` (válido en backend); el GET de A retorna el conector + N. Sin error.
- [ ] **S45.** Token de Usuario A expira mid-drag de una nota → el siguiente PATCH de posición responde 401; frontend limpia sesión, redirige a `/login`. El drag queda a medias; el `ConnectorLayer` recalculó durante el drag pero la nueva posición no se persistió; al volver a `/tablero` después de re-login, la nota está en la posición vieja.

### Extremos de datos

- [ ] **S46.** Tablero con 200 notas y 0 conectores → no hay overhead visible. `ConnectorLayer` está vacío.
- [ ] **S47.** Tablero con 2 notas y 6 conectores entre ellas (cap) → 6 flechas visible. Edge of visual clutter; decisión A2.
- [ ] **S48.** Tablero con 2 notas y 50 notas más con conectores a esas 2 → 50 flechas visibles; performance OK (50 `<path>` es trivial).
- [ ] **S49.** Tablero con 0 notas → no se puede crear conectores (no hay source). Sin error visible.
- [ ] **S50.** Eliminar todas las notas (soft delete en masa) → cascade elimina todos los conectores. Tablero vacío. `GET /api/notes/connectors` retorna `[]`.

### Routing y casos cruzados

- [ ] **S51.** `POST /api/notes/99999/connectors` (nota inexistente) → 404 (Route Model Binding falla).
- [ ] **S52.** `POST /api/notes/{softDeletedNote}/connectors` → 404 (Route Model Binding con scope global).
- [ ] **S53.** `GET /api/notes/{softDeletedNote}/connectors` → 404.
- [ ] **S54.** `PUT /api/note-connectors/{softDeletedConnectorId}` → 404.
- [ ] **S55.** `DELETE /api/note-connectors/{softDeletedConnectorId}` → 404.
- [ ] **S56.** `PUT /api/note-connectors/abc` (id no numérico) → 404 (Route Model Binding falla).
- [ ] **S57.** Cliente desactualizado que NO incluye los nuevos endpoints en su bundle → cualquier request a esos endpoints responde 404 de la API (no existe el handler). El frontend desactualizado no intenta usarlos.
- [ ] **S58.** `GET /api/notes` (HU-02) NO incluye `connectors` en el payload de cada nota. Si el cliente espera ese campo (cliente desactualizado de una HU futura), recibe `undefined`. Decisión documentada en B17.

## Criterios de Aceptación

### Schema (DB) y migración

- [ ] **AC1.** Given HU-05 implementada, when se corre `php artisan migrate`, then existe la tabla `note_connectors` con columnas `id` (PK), `source_note_id` (FK), `destination_note_id` (FK), `style` (VARCHAR 30 NOT NULL DEFAULT 'solid_arrow_end'), `created_at`, `updated_at`, `deleted_at`.   PASS / FAIL
- [ ] **AC2.** Given migración aplicada, when se inspeccionan constraints, then existe `note_connectors_style_check` con los 6 valores del catálogo §6.1.   PASS / FAIL
- [ ] **AC3.** Given migración aplicada, when se inspeccionan constraints, then existe `note_connectors_no_self_check` con `source_note_id <> destination_note_id`.   PASS / FAIL
- [ ] **AC4.** Given migración aplicada, when se inspeccionan FKs, then `source_note_id` y `destination_note_id` referencian `notes.id` con `ON DELETE CASCADE` declarado.   PASS / FAIL
- [ ] **AC5.** Given migración aplicada, when se inspeccionan índices, then existen `note_connectors_source_idx` y `note_connectors_destination_idx` (sobre `deleted_at IS NULL`).   PASS / FAIL
- [ ] **AC6.** Given `migrate:rollback`, when se ejecuta, then la tabla `note_connectors` se dropea con pérdida de datos (aceptable para rollback).   PASS / FAIL
- [ ] **AC7.** Given DB con 10 conectores pre-existentes, when se corre `migrate:fresh` + `migrate` + `seed`, then la tabla `note_connectors` queda vacía.   PASS / FAIL

### Modelo y backend setup

- [ ] **AC8.** Given `NoteConnector.php`, when se inspecciona `$fillable`, then incluye `source_note_id`, `destination_note_id`, `style`.   PASS / FAIL
- [ ] **AC9.** Given `NoteConnector.php`, when se inspecciona, then usa el trait `SoftDeletes` (`deleted_at`).   PASS / FAIL
- [ ] **AC10.** Given `NoteConnector.php`, when se inspecciona, then declara constantes públicas para los 6 valores de `style` (§6.1).   PASS / FAIL
- [ ] **AC10a.** Given `NoteConnector.php`, when se inspecciona, then declara el método público `sourceNote(): BelongsTo` que retorna `$this->belongsTo(Note::class, 'source_note_id')`. AND declara el método público `destinationNote(): BelongsTo` que retorna `$this->belongsTo(Note::class, 'destination_note_id')`.   PASS / FAIL
- [ ] **AC11.** Given `NoteConnectorResource`, when serializa, then retorna `id, source_note_id, destination_note_id, style, created_at, updated_at` (sin `deleted_at`).   PASS / FAIL
- [ ] **AC12.** Given `Note.php`, when se inspecciona `booted()`, then hay un listener `deleting` que soft-deleta todos los `NoteConnector` donde la nota es source o destination.   PASS / FAIL
- [ ] **AC12a.** Given el modelo `NoteConnector` en V1, when se inspecciona, then NO hay un listener `booted()` registrado en `NoteConnector` (no se disparan eventos de cascade-delete cuando un conector mismo es eliminado). Esto previene loops futuros si una V2 HU agrega listeners a `NoteConnector`.   PASS / FAIL
- [ ] **AC13.** Given nota N con 3 conectores activos, when se soft-deleta N, then los 3 conectores quedan con `deleted_at` set (cascade aplicado).   PASS / FAIL
- [ ] **AC14.** Given nota N con 0 conectores, when se soft-deleta N, then no hay cambios en `note_connectors` (cascade no-op).   PASS / FAIL
- [ ] **AC15.** Given nota N soft-deleted, when se intenta `POST /api/notes/{N.id}/connectors`, then 404 (Route Model Binding con scope).   PASS / FAIL

### POST /api/notes/{note}/connectors

- [ ] **AC16.** Given sesión activa + nota A + nota B activas, when `POST /api/notes/{A.id}/connectors` con `{destination_note_id: B.id, style: "solid_arrow_end"}`, then 201 con body envuelto en `{connector: {...}}` donde `connector` tiene `source_note_id=A.id`, `destination_note_id=B.id`, `style="solid_arrow_end"` (convención §6.6 single-resource).   PASS / FAIL
- [ ] **AC17.** Given sesión activa + notas A y B, when `POST /api/notes/{A.id}/connectors` sin enviar `style`, then 201 con `style="solid_arrow_end"` (default de DB).   PASS / FAIL
- [ ] **AC18.** Given sesión activa + notas A y B, when `POST /api/notes/{A.id}/connectors` con `destination_note_id=A.id` (self-connector), then 422 con `{"errors": {"destination_note_id": ["No puedes conectar una nota consigo misma."]}}`.   PASS / FAIL
- [ ] **AC19.** Given 6 conectores activos entre A y B en cualquier dirección (cap unordered), when `POST /api/notes/{A.id}/connectors` con `destination_note_id=B.id`, then 422 con `{"errors": {"destination_note_id": ["Máximo 6 conectores entre el mismo par de notas."]}}`.   PASS / FAIL
- [ ] **AC20.** Given sesión activa + nota B soft-deleted, when `POST /api/notes/{A.id}/connectors` con `destination_note_id=B.id`, then 422 (exists rule con scope activo).   PASS / FAIL
- [ ] **AC21.** Given sesión activa, when `POST /api/notes/{A.id}/connectors` con `destination_note_id=99999` (no existe), then 422 (exists rule).   PASS / FAIL
- [ ] **AC22.** Given sesión activa, when `POST /api/notes/{A.id}/connectors` con `style="invalid"`, then 422 con `{"errors": {"style": [...]}}`.   PASS / FAIL
- [ ] **AC23.** Given sesión activa, when `POST /api/notes/{A.id}/connectors` con `style="<script>alert(1)</script>"`, then 422 y no se persiste.   PASS / FAIL
- [ ] **AC24.** Given 5 conectores activos entre A y B en cualquier dirección (cap unordered), when `POST /api/notes/{A.id}/connectors` con `destination_note_id=B.id`, then 201 (queda en 6, bajo el cap).   PASS / FAIL
- [ ] **AC25.** Given 5 conectores activos entre A y B en cualquier dirección (cap unordered), when `POST /api/notes/{A.id}/connectors` con `destination_note_id=B.id` dos veces seguidas, then el primero 201 (queda en 6), el segundo 422 (cap excedido).   PASS / FAIL

### GET /api/notes/connectors

- [ ] **AC26.** Given sesión activa + 3 conectores activos en el tablero, when `GET /api/notes/connectors`, then 200 con body envuelto en `{connectors: [...]}` con 3 elementos (convención §6.6 collection).   PASS / FAIL
- [ ] **AC27.** Given sesión activa + 1 conector soft-deleted entre 2 activas, when `GET /api/notes/connectors`, then 200 con `{connectors: [...]}` con 0 elementos.   PASS / FAIL
- [ ] **AC28.** Given sesión activa, when `GET /api/notes/connectors`, then el body es `{connectors: [...]}` (collection wrap, §6.6) y cada conector tiene `id, source_note_id, destination_note_id, style, created_at, updated_at`.   PASS / FAIL
- [ ] **AC29.** Given sesión activa, when `GET /api/notes/connectors`, then NO expone `deleted_at` en el payload.   PASS / FAIL

### GET /api/notes/{note}/connectors

- [ ] **AC30.** Given nota A con 2 conectores donde A es source + 1 conector donde A es destination, when `GET /api/notes/{A.id}/connectors`, then 200 con 3 conectores (source + destination, todos).   PASS / FAIL
- [ ] **AC31.** Given nota A con 1 conector soft-deleted donde A era source, when `GET /api/notes/{A.id}/connectors`, then 200 con 0 conectores (no incluye soft-deleted).   PASS / FAIL
- [ ] **AC32.** Given nota soft-deleted, when `GET /api/notes/{id}/connectors`, then 404 (Route Model Binding).   PASS / FAIL

### PUT /api/note-connectors/{id}

- [ ] **AC33.** Given conector C con `style="solid_arrow_end"`, when `PUT /api/note-connectors/{C.id}` con `{style: "dashed_arrow_end"}`, then 200 con body envuelto en `{connector: {...}}` (convención §6.6 single-resource) donde `connector` tiene `style="dashed_arrow_end"` y `updated_at` refrescado.   PASS / FAIL
- [ ] **AC34.** Given conector C, when `PUT /api/note-connectors/{C.id}` con `{style: "invalid"}`, then 422.   PASS / FAIL
- [ ] **AC35.** Given conector C soft-deleted, when `PUT /api/note-connectors/{C.id}` con `{style: "arrow_both_solid"}`, then 404.   PASS / FAIL
- [ ] **AC35a.** Given conector C involucrando notas A y B soft-deleted (vía cascade), when usuario envía `PUT /api/note-connectors/{C.id}` (escenario de admin recovery / undo), then 404 es retornado (Route Model Binding + global scope). El conector NO se restaura silenciosamente.   PASS / FAIL
- [ ] **AC36.** Given conector C, when `PUT /api/note-connectors/{C.id}` con body que incluye `source_note_id` (campo extra), then se ignora silenciosamente; solo `style` se actualiza.   PASS / FAIL
- [ ] **AC37.** Given conector C, when `PUT /api/note-connectors/{C.id}` con body `{}` (sin `style`), then 422 con `{"errors": {"style": ["The style field is required."]}}` (la regla `UpdateNoteConnectorRequest` define `style` como `required|string|in:<6 estilos>` porque `style` es el único campo actualizable — el body es esencialmente `{style: ...}`). AND Given `PUT` con body `{style: "solid_arrow_end"}`, when validado, then 200 con `NoteConnectorResource` actualizado.   PASS / FAIL

### DELETE /api/note-connectors/{id}

- [ ] **AC38.** Given conector C activo, when `DELETE /api/note-connectors/{C.id}`, then 204; C queda con `deleted_at` set.   PASS / FAIL
- [ ] **AC39.** Given conector C soft-deleted, when `GET /api/notes/connectors`, then NO aparece en la respuesta.   PASS / FAIL
- [ ] **AC40.** Given conector C soft-deleted, when `DELETE /api/note-connectors/{C.id}` de nuevo, then 404 (Route Model Binding con global scope de `SoftDeletes` filtra el registro soft-deleted y el binding falla).   PASS / FAIL

### Cascade delete (soft)

- [ ] **AC41.** Given nota N con 3 conectores activos, when `DELETE /api/notes/{N.id}`, then 204; los 3 conectores quedan con `deleted_at` set en la misma transacción.   PASS / FAIL
- [ ] **AC41a.** Given nota A siendo soft-deleted por usuario 1 (transacción T1 en progreso), when usuario 2 envía `POST /api/notes/A/connectors` con `destination_note_id=B` en el instante exacto en que T1 está confirmando, then el backend EITHER responde 422 `"La nota de origen ya no existe"` (si T1 confirmó primero) OR acepta el POST y cascadea el nuevo conector dentro de milisegundos (si T1 confirma después). En cualquier caso, ningún conector queda apuntando a una nota soft-deleted después de que ambas transacciones se asienten.   PASS / FAIL
- [ ] **AC42.** Given nota N soft-deleted (con cascade), when `GET /api/notes/connectors`, then los conectores de N NO aparecen.   PASS / FAIL
- [ ] **AC43.** Given nota N1 con 5 conectores y nota N2 con 5 conectores, hay 1 conector N1↔N2; when `DELETE /api/notes/{N1.id}`, then N1 queda soft-deleted; los 5 conectores de N1 + el N1↔N2 quedan soft-deleted; los 5 conectores de N2 quedan activos.   PASS / FAIL
- [ ] **AC44.** Given cascade eliminado 3 conectores, when se inspecciona el log `notes.deleted`, then contiene `cascade_connectors_count: 3`.   PASS / FAIL

### Auth transversal (heredado de HU-01)

- [ ] **AC45.** Given request sin token, when `POST /api/notes/{note}/connectors`, then 401.   PASS / FAIL
- [ ] **AC46.** Given request sin token, when `GET /api/notes/connectors`, then 401.   PASS / FAIL
- [ ] **AC47.** Given request sin token, when `PUT /api/note-connectors/{id}`, then 401.   PASS / FAIL
- [ ] **AC48.** Given request sin token, when `DELETE /api/note-connectors/{id}`, then 401.   PASS / FAIL
- [ ] **AC49.** Given request con token pero `is_active=false`, when cualquier endpoint de conectores, then 403 con mensaje de inactividad.   PASS / FAIL
- [ ] **AC50.** Given 401/403 en endpoints de conectores, when frontend procesa, then limpia `sessionStorage` y redirige a `/login` (transversal HU-01).   PASS / FAIL

### FAB y modo conector (frontend)

- [ ] **AC51.** Given usuario en `/tablero`, when renderiza el canvas, then existe un FAB redondo azul de 56px en bottom-right (encima del FAB de notas) con ícono de link/chain.   PASS / FAIL
- [ ] **AC52.** Given usuario en `/tablero`, when click en el FAB de conectores, then entra en "add connector mode": cursor `crosshair`, banner superior visible con el mensaje "Selecciona la nota de origen y luego la de destino. ESC para cancelar.".   PASS / FAIL
- [ ] **AC53.** Given modo conector activo, when usuario pulsa ESC, then modo se desactiva; cursor vuelve a `default`; banner desaparece.   PASS / FAIL
- [ ] **AC54.** Given modo conector activo, when usuario click sobre canvas vacío, then no pasa nada (modo sigue activo).   PASS / FAIL
- [ ] **AC55.** Given modo conector activo, when usuario click sobre la nota A, then A se marca como origen: outline azul 3px + badge "Origen" en una esquina.   PASS / FAIL
- [ ] **AC56.** Given nota A marcada como origen, when usuario click sobre la nota A de nuevo (misma), then el frontend intercepta con toast `"No puedes conectar una nota consigo misma."` y NO se envía HTTP request. AND Given un cliente malicioso que bypasa el frontend y envía `POST /api/notes/{A.id}/connectors` con `{destination_note_id: A.id}`, when backend valida, then 422 con `{"errors": {"destination_note_id": ["No puedes conectar una nota consigo misma."]}}`.   PASS / FAIL
- [ ] **AC57.** Given nota A marcada como origen, when usuario click sobre nota B (distinta), then se dispara `POST /api/notes/{A.id}/connectors` con `{destination_note_id: B.id, style: "solid_arrow_end"}`; backend responde 201; frontend dibuja la flecha; modo se desactiva tras 300ms.   PASS / FAIL
- [ ] **AC58.** Given conector recién creado, when frontend lo renderiza, then aparece como `<path>` SVG con stroke `#2563EB`, stroke-width `2`, marker-end de flecha (default `solid_arrow_end`).   PASS / FAIL
- [ ] **AC59.** Given modo conector activo, when usuario abre el `NoteEditor` de una nota (vía doble-click), then el modo se cancela (el editor tiene prioridad).   PASS / FAIL
- [ ] **AC59a.** Given `NoteEditor` modal abierto (editor de HU-02/HU-05), when usuario intenta click sobre el FAB de conectores, then el click es interceptado por el overlay del modal y NO se activa el modo conector.   PASS / FAIL
- [ ] **AC60.** Given modo conector inactivo, when usuario click sobre una flecha existente, then se abre el `ConnectorMiniToolbar` cerca del midpoint del bezier.   PASS / FAIL

### Mini-toolbar (frontend)

- [ ] **AC61.** Given mini-toolbar abierto, when renderiza, then tiene un selector con los 6 valores del catálogo §6.1 + un botón "Eliminar conector".   PASS / FAIL
- [ ] **AC62.** Given mini-toolbar abierto con conector de `style="solid_arrow_end"`, when usuario cambia el selector a `dashed_arrow_end`, then se dispara inmediatamente `PUT /api/note-connectors/{id}` con `{style: "dashed_arrow_end"}` (apply-on-change, A7); backend responde 200; frontend redibuja la flecha con el nuevo estilo.   PASS / FAIL
- [ ] **AC63.** Given mini-toolbar abierto, when usuario click en "Eliminar conector", then aparece `window.confirm("¿Eliminar este conector?")`.   PASS / FAIL
- [ ] **AC64.** Given confirmación de delete, when usuario confirma, then se dispara `DELETE /api/note-connectors/{id}`; backend responde 204; frontend remueve la flecha; toast "Conector eliminado"; mini-toolbar se cierra.   PASS / FAIL
- [ ] **AC65.** Given `window.confirm`, when usuario cancela, then no se hace DELETE; mini-toolbar sigue abierto; conector sigue visible.   PASS / FAIL
- [ ] **AC66.** Given mini-toolbar abierto, when usuario click fuera del toolbar, then el toolbar se cierra.   PASS / FAIL
- [ ] **AC67.** Given mini-toolbar abierto, when usuario pulsa ESC, then el toolbar se cierra.   PASS / FAIL

### Geometry — anchor points por forma

- [ ] **AC68.** Given nota A con `shape="rectangle"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está en el borde derecho del bounding box de A (recto, no en la esquina).   PASS / FAIL
- [ ] **AC69.** Given nota A con `shape="rectangle"` y nota B arriba, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está en el borde superior del bounding box de A.   PASS / FAIL
- [ ] **AC70.** Given nota A con `shape="diamond"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está en el vértice derecho del rombo (no en el bounding box).   PASS / FAIL
- [ ] **AC71.** Given nota A con `shape="triangle"` (apuntando arriba) y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está en el vértice inferior derecho del triángulo (sobre la hipotenusa).   PASS / FAIL
- [ ] **AC72.** Given nota A con `shape="circle"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre la circunferencia de A (no en el bounding box cuadrado).   PASS / FAIL
- [ ] **AC73.** Given nota A con `shape="ellipse"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre la elipse de A.   PASS / FAIL
- [ ] **AC74.** Given nota A con `shape="star"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre la silueta de la estrella (probablemente en una punta).   PASS / FAIL
- [ ] **AC75.** Given nota A con `shape="hexagon"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el lado derecho del hexágono (entre dos vértices).   PASS / FAIL
- [ ] **AC76.** Given nota A con `shape="pentagon"` (punta arriba) y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el lado derecho del pentágono.   PASS / FAIL
- [ ] **AC77.** Given nota A con `shape="octagon"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el lado derecho del octágono.   PASS / FAIL
- [ ] **AC78.** Given nota A con `shape="arrow"` (apuntando a la derecha) y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre la punta del arrow de A.   PASS / FAIL
- [ ] **AC79.** Given nota A con `shape="arrow"` (apuntando a la derecha) y nota B a la izquierda, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre la cola del arrow de A (extremo izquierdo).   PASS / FAIL
- [ ] **AC80.** Given nota A con `shape="parallelogram"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el lado derecho del paralelogramo.   PASS / FAIL
- [ ] **AC81.** Given nota A con `shape="trapezoid"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el lado derecho del trapezoide.   PASS / FAIL
- [ ] **AC82.** Given nota A con `shape="message_bubble"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el borde derecho del globo (no en la colita).   PASS / FAIL
- [ ] **AC82a.** Given nota B con `shape="message_bubble"` cuya colita apunta hacia la nota A, when usuario crea conector A→B, then el anchor de destino cae sobre la PUNTA de la colita (no sobre el borde del bounding box), dentro de ±4px del ápice visual de la colita.   PASS / FAIL
- [ ] **AC83.** Given nota A con `shape="cloud"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre la silueta de la nube (lóbulo derecho probable; fallback aceptable al bounding box si la intersección falla).   PASS / FAIL
- [ ] **AC84.** Given nota A con `shape="cylinder"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el borde derecho del cilindro.   PASS / FAIL
- [ ] **AC85.** Given nota A con `shape="rounded_rectangle"` y nota B a la derecha, when se calcula `getAnchorPoint(A, center(B))`, then el anchor está sobre el borde derecho del rectángulo redondeado (la curvatura se ignora para el anchor; el anchor cae en el lado recto del bounding box).   PASS / FAIL
- [ ] **AC85a.** Given nota A y nota B con `position_x` y `position_y` idénticos (distance=0), when usuario intenta crear el conector, then el frontend detecta `distance < 4px` y muestra toast `"Mueve una de las notas para poder conectarlas."` y NO se envía HTTP request.   PASS / FAIL

### Geometry — bezier

- [ ] **AC86.** Given notas A y B sin solapamiento y A arriba de B, when el conector se renderiza, then el control point de la bezier cuadrática está offset perpendicular al segmento A→B, específicamente en el lado IZQUIERDO del segmento dirigido (determinista, no aleatorio). La elección se mantiene estable entre re-renders: misma entrada → misma curvatura.   PASS / FAIL
- [ ] **AC87.** Given dos anchors a menos de 80px de distancia, when `bezierPath`, then el offset perpendicular del control point es `distance/2` (no 80) (A13).   PASS / FAIL
- [ ] **AC88.** Given dos anchors a 1000px de distancia, when `bezierPath`, then el offset perpendicular del control point es exactamente 80px (A13).   PASS / FAIL
- [ ] **AC89.** Given un bezier con control point desplazado hacia arriba, when se renderiza, then la curva pasa por encima de la línea recta entre source y destination.   PASS / FAIL
- [ ] **AC90.** Given source y destination en el mismo punto (distance=0), when `bezierPath`, then el `pathD` degenera a un círculo pequeño (E6) o no se renderiza. Aceptable.

### Geometry — markers (flechas)

- [ ] **AC91.** Given conector con `style="solid_arrow_end"`, when se renderiza, then el SVG tiene `<marker-end>` con una flecha apuntando al destination; sin `<marker-start>`.   PASS / FAIL
- [ ] **AC92.** Given conector con `style="dashed_arrow_end"`, when se renderiza, then el SVG tiene `stroke-dasharray="6 4"` y `<marker-end>`.   PASS / FAIL
- [ ] **AC93.** Given conector con `style="solid_no_arrow"`, when se renderiza, then el SVG NO tiene marcadores (ni `start` ni `end`); solo línea continua.   PASS / FAIL
- [ ] **AC94.** Given conector con `style="dashed_no_arrow"`, when se renderiza, then el SVG tiene `stroke-dasharray="6 4"` y sin marcadores.   PASS / FAIL
- [ ] **AC95.** Given conector con `style="arrow_both_solid"`, when se renderiza, then el SVG tiene `<marker-start>` + `<marker-end>` (flechas en ambos extremos).   PASS / FAIL
- [ ] **AC96.** Given conector con `style="solid_arrow_start"`, when se renderiza, then el SVG tiene `<marker-start>` (flecha al source); sin `<marker-end>`.   PASS / FAIL

### Persistencia y restart

- [ ] **AC97.** Given conector creado y persistido, when F5 en `/tablero`, then el conector sigue visible con su `style` correcto.   PASS / FAIL
- [ ] **AC98.** Given dev environment con conector persistido, when operador ejecuta `docker compose down && docker compose up -d` (sin `-v`) + `php artisan migrate`, then el conector sigue en DB (verificable con `psql -c "SELECT * FROM note_connectors"`).   PASS / FAIL
- [ ] **AC99.** Given dev environment, when operador ejecuta `docker compose down -v && docker compose up -d` + `php artisan migrate --seed`, then la tabla `note_connectors` queda vacía; ninguna nota/conector sobrevive al `-v`.   PASS / FAIL
- [ ] **AC100.** Given conector con `style="arrow_both_solid"`, when `GET /api/notes/connectors`, then el JSON incluye `"style": "arrow_both_solid"`.   PASS / FAIL

### Drag y re-render

- [ ] **AC101.** Given nota A con 2 conectores, when se arrastra A a una nueva posición (`PATCH /api/notes/{A.id}/position`), then el `ConnectorLayer` recalcula automáticamente los bezier paths de los 2 conectores en cada frame del drag.   PASS / FAIL
- [ ] **AC102.** Given drag de A, when se completa el drag, then la nueva posición se persiste vía PATCH (HU-02) y los conectores quedan visualmente consistentes. NO se hace un PATCH separado para los conectores (A17).   PASS / FAIL
- [ ] **AC103.** Given drag de A y B simultáneamente (race), when se sueltan ambos, then ambos PATCH de posición se completan (no hay conflicto entre drag de notas). Los conectores recalculan al final.   PASS / FAIL
- [ ] **AC103a.** Given notas A y B conectadas, when usuario arrastra ambas simultáneamente, then el `ConnectorLayer` renderiza la curva desde la posición visual ACTUAL de cada nota (no desde la última posición conocida del servidor). AND los PATCH `/api/notes/{id}/position` se envían independientemente por nota; el backend almacena la posición que llega en cada request sin chequear la geometría del conector.   PASS / FAIL

### Logging

- [ ] **AC104.** Given conector creado, when backend responde 201, then log `note_connectors.created` contiene `{user_id, connector_id, source_note_id, destination_note_id, style}`.   PASS / FAIL
- [ ] **AC105.** Given estilo de conector actualizado, when backend responde 200, then log `note_connectors.updated` contiene `{user_id, connector_id, old_style, new_style}`.   PASS / FAIL
- [ ] **AC106.** Given conector eliminado, when backend responde 204, then log `note_connectors.deleted` contiene `{user_id, connector_id}`.   PASS / FAIL
- [ ] **AC107.** Given nota eliminada con cascade, when backend responde 204, then log `notes.deleted` (HU-02) contiene `cascade_connectors_count` con el número correcto.   PASS / FAIL

### Anti-enumeración y privacy

- [ ] **AC108.** Given `NoteConnectorResource`, when serializa, then no expone IDs internos extra ni filtra por autor; los campos son strings/integers planos.   PASS / FAIL
- [ ] **AC109.** Given `NoteConnectorResource`, when serializa, then el campo `style` se incluye como string que matchea exactamente uno de los 6 valores del catálogo §6.1 (no enum numérico, no objeto, no null).   PASS / FAIL
- [ ] **AC110.** Given `NoteConnectorResource`, when serializa, then NO incluye el campo `deleted_at` (campo interno, no se expone).   PASS / FAIL

### Multi-tab y consistencia

- [ ] **AC111.** Given usuario tiene `/tablero` abierto en dos tabs, when en tab 1 crea conector A→B y refresca tab 2, then tab 2 ve el conector A→B.   PASS / FAIL
- [ ] **AC112.** Given usuario en tab 1 elimina conector C y refresca tab 2, then tab 2 NO ve C.   PASS / FAIL
- [ ] **AC113.** Given usuario en tab 1 elimina nota N (cascade) y refresca tab 2, then tab 2 NO ve N ni los conectores donde N participaba.   PASS / FAIL

### UI / estética

- [ ] **AC114.** Given `ConnectorLayer`, when se renderiza, then TODOS los conectores tienen stroke `#2563EB` y stroke-width `2` (sin variación por conector, A11).   PASS / FAIL
- [ ] **AC115.** Given dos conectores entre A y B con estilos distintos (`solid_arrow_end` y `dashed_arrow_end`), when se renderizan, then ambas flechas son visibles (superposibles; pueden cruzarse).   PASS / FAIL
- [ ] **AC116.** Given 6 conectores entre A y B en cualquier dirección (cap unordered), when se renderizan, then las 6 flechas son visibles. Intentar un 7º → 422.   PASS / FAIL
- [ ] **AC117.** Given `prefers-reduced-motion: reduce` activo, when se arrastra una nota con conectores, then el re-render del bezier es instantáneo (sin animación).   PASS / FAIL

### Hardening visual y rendering

- [ ] **AC118.** Given el `ConnectorLayer` SVG, when mide su z-index, then está por encima del `NoteCard` (las flechas se ven sobre las notas) pero por debajo del `NoteEditor` modal.   PASS / FAIL
- [ ] **AC119.** Given una flecha clickeable, when se mide el hit-area, then tiene un padding invisible de ~6px para facilitar el click (no es exacto al stroke).   PASS / FAIL
- [ ] **AC120.** Given un navegador sin soporte SVG, when se carga `/tablero`, then las notas se ven pero los conectores no; sin error visible.   PASS / FAIL
- [ ] **AC121.** Given canvas con zoom del navegador al 200%, when se renderizan los conectores, then el bezier se escala proporcionalmente (SVG vectorial).   PASS / FAIL