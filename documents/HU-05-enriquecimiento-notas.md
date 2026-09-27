# HU-05 — Enriquecimiento visual de notas (estilo Miro)

## Disclaimer de scope (mejora deliberada — fuera de `prueba-tecnica.md`)

> **Esta HU es una MEJORA DELIBERADA respecto del documento técnico `prueba-tecnica.md`.**
>
> Por decisión de proyecto registrada en Engram (`hu/scope-rule`), la regla "explicit-only per `prueba-tecnica.md`" queda **exceptuada** a partir de HU-05. `prueba-tecnica.md` sigue siendo el piso mínimo inicial, pero las HU nuevas (HU-05 en adelante) pueden declarar funcionalidades que el doc técnico NO pide, siempre que (1) cada bloque lo declare explícitamente como mejora y (2) se documente el disclaimer como hace esta HU.
>
> `prueba-tecnica.md` no menciona **forma** (shape), **familia tipográfica** (font family) ni **alineación de texto** para las notas. Esta HU las introduce como capacidades de enriquecimiento visual estilo Miro para mejorar la expresividad del tablero. Todo lo que esta HU declara —catálogos, defaults, validaciones, migración aditiva, persistencia en el mismo `PUT /api/notes/{id}`— es decisión de esta HU y NO proviene del doc técnico.
>
> Si el validador busca trazabilidad `prueba-tecnica.md → HU-05`: no la va a encontrar para shape/font/alignment. Esa ausencia es intencional y está aprobada.
>
> **Trazabilidad**: regla exceptuada por el usuario en sesión [2026-09-27], registrada en memoria persistente del proyecto (topic_key: hu/scope-rule).
>
> **Reglas derivadas de este disclaimer**:
> - HU-02 sigue siendo la fuente de verdad para CRUD, soft delete, lock optimista, anti-enumeración, sin ownership, anti-persistencia de borradores, sin auto-save, sin rate limit, sin pan/zoom, sin realtime, sin i18n, sin dark mode, sin tests automatizados. Esta HU NO contradice ninguna de esas reglas; las extiende donde es estrictamente necesario (migration aditiva, expansión de `PUT /api/notes/{id}`, expansión de `NoteResource`, expansión de `NoteEditor`).
> - Cualquier futura HU que trabaje contra una forma específica (por ejemplo: "conectar formas con flechas", "rotar formas", "agrupar formas") debe declarar su propio disclaimer de mejora y referenciar esta HU como base, porque esos features NO están ni en `prueba-tecnica.md` ni en HU-05.

## Descripción

HU-05 extiende HU-02 (Tablero de Notas) con tres ejes de enriquecimiento visual **estilo Miro**, persistidos en la misma entidad `Note`:

1. **Variedad de formas** (`shape`): cada nota puede renderizarse como una forma distinta del catálogo completo de Miro (rectangle, rounded_rectangle, diamond, triangle, circle, ellipse, star, hexagon, pentagon, octagon, arrow, parallelogram, trapezoid, message_bubble, cloud, cylinder y otros — ver catálogo completo en §6).
2. **Familia tipográfica** (`font_family`): el usuario puede cambiar la tipografía del texto de la nota entre un conjunto curado de 6–8 familias (Inter como default, más serif, mono, handwriting, display y otras — ver catálogo en §6).
3. **Alineación de texto** (`text_align`): el usuario puede alinear el texto interior entre `left`, `center`, `right` y `justify`.

Esta HU **NO introduce endpoint nuevo**. La persistencia se bundlea en el `PUT /api/notes/{id}` existente (mismo botón "Guardar" del `NoteEditor`), reusando el patrón de HU-02 de optimistic locking vía `updated_at` (mismatch → 409, frontend recarga del servidor).

Modelo de interacción recomendado: cuando una nota está en modo edición (`NoteEditor` abierto), aparece un **toolbar flotante interno** con tres selectores (forma / fuente / alineación) justo encima o debajo de los campos actuales (título, texto, status). Los cambios en esos selectores son solo locales hasta que el usuario pulsa **Guardar**; ahí viajan como parte del `PUT /api/notes/{id}`. La elección se mantiene visible en preview dentro del editor antes de guardar.

Constraints duros heredados de HU-02 (no se rompen):
- No ownership, todos los usuarios activos pueden editar cualquier nota.
- Soft delete vía `deleted_at`; CHECK de DB para `status` (HU-02 §B5).
- Lock optimista via `updated_at` para TODO el `PUT` (no se relaja porque ahora haya más campos).
- Sin auto-save, sin realtime, sin pan/zoom, sin tests automatizados.
- Status canónicos en español: `Pendiente`, `En curso`, `Hecho` (NO se traducen).
- El color de fondo de la nota sigue dependiendo **solo** del status (HU-02 §F4 + AC33-35). La forma NO afecta el color.

Migración aditiva: tres columnas nuevas en `notes` (`shape`, `font_family`, `text_align`) con defaults hardcoded en la migración (`shape='rectangle'`, `font_family='Inter'`, `text_align='left'`) y NO nullables (filas existentes reciben defaults al migrar). El `CHECK` de DB se replica para `shape` y `text_align`; `font_family` se valida como VARCHAR con allow-list server-side en el `FormRequest` (un CHECK con 6–8 literales también es válido, decisión: VARCHAR + allow-list en Request, ver §4 A13).

## Dependencias y bloqueantes

- [ ] HU-02 implementada y operativa: CRUD de notas, soft delete, `PUT /api/notes/{id}` con optimistic locking via `updated_at`, `NoteEditor` con campos título/texto/status y botón Guardar, `NoteService::update` con lock, `NoteResource` con shape actual.
- [ ] HU-01 implementada y operativa: Sanctum Bearer + `EnsureUserIsActive` aplican a `/api/notes/*`.
- [ ] Nueva migración aditiva `add_visual_enrichment_to_notes_table` (no destructiva — usar `ALTER TABLE`/`Schema::table`, no recrear tabla).
- [ ] Columnas nuevas: `shape VARCHAR(30) NOT NULL DEFAULT 'rectangle'`, `font_family VARCHAR(40) NOT NULL DEFAULT 'Inter'`, `text_align VARCHAR(10) NOT NULL DEFAULT 'left'`.
- [ ] `CHECK` constraints de DB: `shape` con allow-list (catálogo en §6.1); `text_align IN ('left','center','right','justify')`. `font_family` se valida en `FormRequest` (allow-list, no CHECK en DB por decisión A13).
- [ ] Modelo `Note` extiende `$fillable` con `shape`, `font_family`, `text_align`.
- [ ] Modelo `Note` declara constantes públicas para cada forma del catálogo, para alineación y para fuentes (mirror de CHECK + allow-list).
- [ ] `NoteResource` agrega los tres campos nuevos al payload JSON (no se quita ningún campo existente).
- [ ] `StoreNoteRequest` y `UpdateNoteRequest` aceptan los tres campos nuevos con allow-list server-side; mensajes en español.
- [ ] `NoteService::create` y `NoteService::update` propagan los tres campos; el log `notes.updated` registra `fields_changed` con shape/font_family/text_align cuando corresponda.
- [ ] `NoteController::update` mantiene el lock optimista vía `updated_at` para TODO el body (no se introduce lock parcial por subcampo).
- [ ] `frontend/src/components/NoteEditor.jsx` extendido con los tres selectores (shape, font_family, text_align) dentro del modal existente; preview visible.
- [ ] `frontend/src/services/notes.js` no requiere endpoint nuevo; `updateNote` y `createNote` propagan los nuevos campos en el payload.
- [ ] `frontend/src/components/NoteCard.jsx` aplica la `shape`, `font_family` y `text_align` al render del texto (CSS via `data-shape`, `font-family` inline, `text-align`).
- [ ] Google Fonts (o servicio equivalente) carga las fuentes web declaradas en el catálogo; `<link rel="preconnect">` y `display=swap`.
- [ ] `App.css` / `index.css` define los estilos `.note-shape-rectangle`, `.note-shape-rounded_rectangle`, etc., y aplica `border-radius`, `clip-path` o `border-style` por forma.

## Supuestos

### Backend

- [ ] **B1.** HU-02 funciona y `PUT /api/notes/{id}` está implementado con lock optimista sobre `updated_at` (mismatch → 409 + payload con estado actual del servidor).
- [ ] **B2.** Sanctum Bearer tokens y middleware `auth:sanctum` + `EnsureUserIsActive` aplican a las rutas `/api/notes/*` (heredado de HU-02).
- [ ] **B3.** Migración aditiva: `ALTER TABLE notes ADD COLUMN shape/...`; los defaults se aplican a filas existentes en el mismo `up()`. La migración NO recrea la tabla, NO borra datos.
- [ ] **B4.** No hay endpoint nuevo. Todo el flujo de shape/font/alignment viaja por `PUT /api/notes/{id}` (o `POST /api/notes` en creación).
- [ ] **B5.** Lock optimista se mantiene sobre el `updated_at` global de la nota. NO se introduce lock por subcampo. Editar solo `shape` (sin tocar título/texto/status) sigue exigiendo el `updated_at` correcto.
- [ ] **B6.** Validación: `shape` ∈ catálogo §6.1; `font_family` ∈ catálogo §6.2; `text_align` ∈ {`left`,`center`,`right`,`justify`}. Cualquier valor fuera del catálogo → 422 con mensaje en español.
- [ ] **B7.** `NoteService::update` no exige que se envíen los tres campos en cada PUT; si no se envían, conservan el valor actual (`array_intersect_key` del estilo de HU-02 sobre el `$fillable`).
- [ ] **B8.** Defaults persistidos en migración: `shape='rectangle'`, `font_family='Inter'`, `text_align='left'`. NO nullable.
- [ ] **B9.** `NoteResource` retorna los tres campos como string; sin transformación adicional.
- [ ] **B10.** Logging: el evento `notes.updated` ya registra `fields_changed` (HU-02 §B10); la propagación de `shape`/`font_family`/`text_align` queda cubierta automáticamente por el diff existente. NO se agrega un nuevo evento.

### Frontend

- [ ] **F1.** Los tres nuevos controles se renderizan **dentro del `NoteEditor`** (modal existente), NO en un toolbar flotante separado fuera del modal. Decisión adoptada para minimizar superficie nueva y mantener el botón "Guardar" único.
- [ ] **F2.** Selector de forma: `<select>` o grid de botones (recomendado grid de 4 columnas para ver preview del nombre); muestra el nombre literal en inglés (`Rectangle`, `Rounded rectangle`, etc.).
- [ ] **F3.** Selector de fuente: `<select>` con el nombre de la familia; al cambiar, el preview del `<textarea>` y del `<input>` aplica la nueva `font-family` en caliente (solo local, hasta Guardar).
- [ ] **F4.** Selector de alineación: tres o cuatro botones (`Left`, `Center`, `Right`, `Justify`) con íconos representativos; al cambiar, el preview del `<textarea>` aplica `text-align` en caliente.
- [ ] **F5.** El preview del `NoteEditor` muestra arriba (o al costado) una pequeña tarjeta muestra renderizada con la `shape`/`font_family`/`text_align` elegidas, replicando el estilo que tendrá la `NoteCard` final.
- [ ] **F6.** `NoteCard` lee `note.shape`, `note.font_family`, `note.text_align` y aplica los estilos correspondientes. Si el backend no retorna alguno de los campos (registros previos a la migración en runtime degradado), se usan los defaults de la migración.
- [ ] **F7.** El color de fondo de la nota **sigue dependiendo solo del `status`** (HU-02). La `shape` NO altera el color.
- [ ] **F8.** Carga de Google Fonts en `index.html` (`<link>` con `display=swap`) para todas las familias del catálogo §6.2. Sin lazy loading por nota.
- [ ] **F9.** Anti-enumeración se mantiene: `NoteResource` no expone IDs internos extra ni filtra por autor; los campos nuevos son strings planos.
- [ ] **F10.** NO hay preview de "qué forma tiene esta nota" en `NoteCard` antes de abrir el editor; el usuario ve la forma aplicada directamente sobre la tarjeta renderizada.

### Decisiones explícitas tomadas por el autor de esta HU (revisar)

- [ ] **A1.** `shape` y `text_align` se persisten con `CHECK` constraint de DB (mirroring HU-02 status). `font_family` se valida solo en `FormRequest` (sin CHECK de DB) por dos razones: (a) el catálogo puede crecer a futuro y un CHECK requiere migración nueva; (b) `font_family` se renderiza con CSS `font-family` y un valor inválido solo degrada visualmente, no corrompe datos.
- [ ] **A2.** El `NoteEditor` agrega los tres selectores entre el campo "Texto" y el selector de status (orden vertical: Título → Texto → Forma → Fuente → Alineación → Estado → Acciones). Es decisión estética, no funcional.
- [ ] **A3.** Para `text_align=justify`, el efecto visual en `NoteEditor` se aplica al `<textarea>`; sin embargo, los `<textarea>` de HTML NO soportan `text-align: justify` visualmente en Chromium/Firefox. Decisión: al aplicar `justify`, el preview usa un `<div>` paralelo que muestra el texto con `text-align: justify`; el `<textarea>` mantiene `text-align` ignorado por el navegador (limitación conocida, no bug).
- [ ] **A4.** Las formas no polígonos regulares (`message_bubble`, `cloud`, `arrow`, `cylinder`) se renderizan con `clip-path: polygon(...)` CSS con paths precalculados por forma — incluyendo geometrías complejas. Decisión: usar `clip-path` para TODAS las formas (uniformidad, sin ramas SVG). Justificación: simplifica el árbol de componentes, evita mantener dos sistemas de render, y CSS `clip-path` soporta polígonos arbitrarios. `arrow`, `message_bubble`, `cloud` y `cylinder` se modelan con `clip-path` poligonal aproximado (no perfecto, pero reconocible — ver AC40a-AC40p). Si el navegador no soporta `clip-path`, E12/E13/S13 cubren el fallback a rectangle.
- [ ] **A5.** El catálogo de formas es el **catálogo completo de Miro al 2026-09** (lo más cercano publicly documentado). Si Miro agrega una forma nueva a futuro, agregarla a esta HU requiere nueva migration (CHECK constraint).
- [ ] **A6.** Las fuentes son 7 familias curadas (ver §6.2). NO se exponen las 1500+ de Google Fonts; es una decisión de UX curada.
- [ ] **A7.** El tamaño (220x220 px de bounding box, HU-02 AC39) NO cambia con la forma: cada forma cabe dentro de 220x220, algunas con clipping visible si el texto excede. NO hay auto-resize.
- [ ] **A8.** NO hay selector de color de fuente ni color de fondo custom por nota (decisión deliberada; ver Out of Scope §5).
- [ ] **A9.** NO hay preview en tiempo real del cambio de `font_family`/`text_align` aplicado a OTROS usuarios que tengan la nota abierta en otro tab. (No hay realtime, HU-02.)
- [ ] **A10.** El "apply immediately" sugerido en el brief original **se adopta como apply-on-Guardar**: los cambios son locales hasta que el usuario pulsa Guardar. Esto preserva el principio "no auto-save" de HU-02 y mantiene un único botón de commit. (Si el producto requiere apply inmediato en el futuro, será otra HU con su propio disclaimer.)
- [ ] **A11.** El orden de los campos en el payload `PUT /api/notes/{id}` es libre; el backend los acepta en cualquier orden. El cliente envía: `title, text, shape, font_family, text_align, status, updated_at`.
- [ ] **A12.** Cuando un usuario crea una nota nueva, el `POST /api/notes` recibe `shape`, `font_family`, `text_align` **opcionales** (los defaults de DB aplican si no se envían). Esto simplifica el frontend en el flow "crear".
- [ ] **A13.** Decisión técnica sobre validación de `font_family`: el catálogo tiene 7 strings. Mantener la allow-list en `FormRequest` con `in:` rule es lo más simple y permite extender sin migration. Un CHECK en DB agregaría fricción sin beneficio (un valor inválido en DB se renderiza feo, no rompe nada). Si en el futuro se quiere CHECK de DB, se agrega en una HU posterior.
- [ ] **A14.** Para `shape`, el CHECK de DB SÍ se justifica porque un valor inválido en DB impediría renderizar la nota correctamente (la `NoteCard` aplicaría `data-shape="desconocido"` y caería a default, pero el default sería rectangle y perderíamos trazabilidad). CHECK garantiza invariante a nivel dato.

## Out of Scope

> Las siguientes funcionalidades **NO se incluyen en esta HU** aunque el catálogo de formas/fuentes las haría naturales. Se listan explícitamente para que futuras HU las pidan con su propio disclaimer:

- [ ] Conectar notas con flechas/líneas (Miro connectors).
- [ ] Agrupar notas (Miro groups/frames).
- [ ] Rotar formas.
- [ ] Redimensionar notas (cambiar bounding box).
- [ ] Color de fuente custom (foreground color).
- [ ] Tamaño de fuente custom (HU-02 fija el tamaño vía CSS).
- [ ] Negrita, itálica, subrayado, tachado inline (rich text).
- [ ] Listas (bullets, ordered).
- [ ] Imágenes embebidas, adjuntos, archivos.
- [ ] Emojis picker / iconos.
- [ ] Sticky notes de colores custom.
- [ ] Plantillas (templates) de notas pre-armadas.
- [ ] Catálogo de fuentes expandible por el usuario.
- [ ] Catálogo de formas expandible por el usuario.
- [ ] Catálogo de formas 3D, líneas, conectores, sticky notes de otros colores, swimlanes, mind maps.
- [ ] Atajos de teclado para cambiar shape/font/alignment.
- [ ] Aplicar la misma `shape`/`font_family`/`text_align` a múltiples notas seleccionadas (multi-select no existe en HU-02).
- [ ] Drag de una forma a otra posición diferente (no aplica; la forma es geometría interna, no posición en el canvas).
- [ ] Animaciones al cambiar de forma.
- [ ] Persistir preferencias por usuario (el catálogo es global; un usuario no puede "favoritear" fuentes).
- [ ] Snap-to-grid o alineación automática entre notas.
- [ ] Comentarios, anotaciones, marcas sobre la nota.
- [ ] Versionado / historial de cambios visuales.
- [ ] Exportar nota como imagen.
- [ ] Imprimir/exportar el tablero respetando las formas.
- [ ] Internacionalización de los nombres de formas/fuentes/alineaciones (siguen en inglés).
- [ ] Tests automatizados para los nuevos endpoints (regla de proyecto, ver AGENTS.md §3).

## Variables y configuración

### 6.1 Catálogo de formas (`shape`)

Catálogo completo estilo Miro. Cada valor es el string literal que viaja en el JSON, se persiste en DB y se usa como selector. El `clip-path` y/o estilos CSS asociados se documentan; la implementación exacta puede ajustar el path.

| `shape` value | Nombre visible | Descripción visual | Renderizado sugerido |
|---------------|----------------|--------------------|-----------------------|
| `rectangle` | Rectangle | Cuadrado/rectángulo clásico. La base por default en HU-02. | `border-radius: 8px`, sin clip-path. |
| `rounded_rectangle` | Rounded rectangle | Rectángulo con esquinas muy redondeadas. | `border-radius: 24px`. |
| `diamond` | Diamond | Rombo (cuadrado rotado 45°). | `clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);` |
| `triangle` | Triangle | Triángulo equilátero apuntando arriba. | `clip-path: polygon(50% 0%, 0% 100%, 100% 100%);` |
| `circle` | Circle | Círculo perfecto (inscribe en 220x220 → diámetro 220). | `border-radius: 50%;` |
| `ellipse` | Ellipse | Elipse horizontal (más ancha que alta). | `border-radius: 50% / 40%;` |
| `star` | Star | Estrella de 5 puntas. | `clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);` |
| `hexagon` | Hexagon | Hexágono regular con lados planos arriba/abajo. | `clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);` |
| `pentagon` | Pentagon | Pentágono regular con punta arriba. | `clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);` |
| `octagon` | Octagon | Octágono regular. | `clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);` |
| `arrow` | Arrow | Flecha horizontal apuntando a la derecha. | `clip-path: polygon(0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%);` |
| `parallelogram` | Parallelogram | Paralelogramo inclinado a la derecha. | `clip-path: polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%);` |
| `trapezoid` | Trapezoid | Trapezoide con base más ancha abajo. | `clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);` |
| `message_bubble` | Message bubble | Globo de cómic con colita abajo a la izquierda. | `clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 70% 70%, 60% 100%, 50% 70%, 0% 70%);` |
| `cloud` | Cloud | Nube con cuatro lóbulos. | `clip-path: polygon(...lóbulos...);` (path aproximado en implementación). |
| `cylinder` | Cylinder | Cilindro visto de frente (más alto que ancho). | `clip-path` con elipses superior/inferior + lados rectos. |

> **Nota para implementación**: los `clip-path` exactos pueden afinarse. Lo importante es: la forma es **reconocible visualmente** dentro de 220x220 px; el texto se centra dentro de la forma visible; si el texto excede, hace overflow oculto (`overflow: hidden`) — no se agranda la nota.

### 6.2 Catálogo de fuentes (`font_family`)

7 familias curadas, cargadas vía Google Fonts con `display=swap`. Cada valor es el nombre canónico de la familia CSS que viaja en JSON y se persiste en DB.

| `font_family` value | Familia CSS | Vibe / descripción | Peso Google Fonts |
|--------------------|-------------|--------------------|--------------------|
| `Inter` | `Inter, sans-serif` | Sans-serif moderna, neutra. **Default**. | 400, 500, 700 |
| `Merriweather` | `Merriweather, serif` | Serif elegante, legible para lectura larga. | 400, 700 |
| `JetBrains Mono` | `JetBrains Mono, monospace` | Monospace técnica, ideal para código o IDs. | 400, 700 |
| `Caveat` | `Caveat, cursive` | Handwriting, manuscrita. Casual, rápida. | 400, 700 |
| `Lobster` | `Lobster, cursive` | Display decorativa, llamativa (títulos, acentos). | 400 |
| `Playfair Display` | `Playfair Display, serif` | Serif display elegante (titulares editoriales). | 400, 700 |
| `Poppins` | `Poppins, sans-serif` | Sans-serif geométrica, amigable. | 400, 500, 700 |

### 6.3 Catálogo de alineación (`text_align`)

| `text_align` value | CSS equivalente | Descripción |
|--------------------|------------------|-------------|
| `left` | `text-align: left;` | Alineado a la izquierda. **Default**. |
| `center` | `text-align: center;` | Centrado. |
| `right` | `text-align: right;` | Alineado a la derecha. |
| `justify` | `text-align: justify;` | Justificado (mecanografía). |

### 6.4 Tabla de variables de configuración

| Variable | Type | Environments | Default value | Description |
|----------|------|--------------|---------------|-------------|
| `NOTE_SHAPE_DEFAULT` | string (literal canónico) | dev, staging, prod | `rectangle` | Forma por default. Hardcodeado en migración. NO traducir. |
| `NOTE_FONT_FAMILY_DEFAULT` | string (literal canónico) | dev, staging, prod | `Inter` | Familia tipográfica por default. Hardcodeado en migración. |
| `NOTE_TEXT_ALIGN_DEFAULT` | string (literal canónico) | dev, staging, prod | `left` | Alineación por default. Hardcodeado en migración. |
| `NOTE_CARD_WIDTH_PX` | integer (px) | dev, staging, prod | `220` | (Heredado de HU-02) Bounding box. No cambia. |
| `NOTE_CARD_HEIGHT_PX` | integer (px) | dev, staging, prod | `220` | (Heredado de HU-02) Bounding box. No cambia. |
| `GOOGLE_FONTS_HREF` | URL (hardcoded) | dev, staging, prod | `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Merriweather:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Caveat:wght@400;700&family=Lobster&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;500;700&display=swap` | URL del loader de Google Fonts. **No es env var**: está hardcodeada en `frontend/index.html` como `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link rel="stylesheet" href="...">` con `display=swap`. NO se configura por entorno. |
| `NOTE_REQUEST_TIMEOUT_MS` | integer (ms) | dev, staging, prod | `10000` | (Heredado de HU-02) Timeout axios. No cambia. |

### 6.5 Sketch de migración aditiva

```sql
-- Nueva migración: add_visual_enrichment_to_notes_table
ALTER TABLE notes
    ADD COLUMN shape       VARCHAR(30) NOT NULL DEFAULT 'rectangle',
    ADD COLUMN font_family VARCHAR(40) NOT NULL DEFAULT 'Inter',
    ADD COLUMN text_align  VARCHAR(10) NOT NULL DEFAULT 'left';

-- CHECK en shape (catálogo Miro, ver §6.1)
ALTER TABLE notes ADD CONSTRAINT notes_shape_check
    CHECK (shape IN (
        'rectangle',
        'rounded_rectangle',
        'diamond',
        'triangle',
        'circle',
        'ellipse',
        'star',
        'hexagon',
        'pentagon',
        'octagon',
        'arrow',
        'parallelogram',
        'trapezoid',
        'message_bubble',
        'cloud',
        'cylinder'
    ));

-- CHECK en text_align
ALTER TABLE notes ADD CONSTRAINT notes_text_align_check
    CHECK (text_align IN ('left', 'center', 'right', 'justify'));

-- font_family NO lleva CHECK (decisión A13, ver §4); se valida en FormRequest.
```

> **Nota**: los catálogos de `shape`, `font_family` y `text_align` NO son variables de runtime: viven como **constantes PHP** en el modelo `Note.php` (mirror del CHECK de DB) y como **reglas `in:`** en los `FormRequest` (`StoreNoteRequest`, `UpdateNoteRequest`). No se exponen vía `.env` ni se leen de config. Mantener las constantes y el CHECK de DB en sincronía es responsabilidad del PR que toque esta HU.

Equivalente Laravel (`up()`):

```php
public function up(): void
{
    Schema::table('notes', function (Blueprint $table) {
        $table->string('shape', 30)->default('rectangle');
        $table->string('font_family', 40)->default('Inter');
        $table->string('text_align', 10)->default('left');
    });

    if (config('database.default') === 'pgsql') {
        $shapes = "'rectangle','rounded_rectangle','diamond','triangle',"
                . "'circle','ellipse','star','hexagon','pentagon','octagon',"
                . "'arrow','parallelogram','trapezoid','message_bubble','cloud','cylinder'";
        \DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_shape_check CHECK (shape IN ({$shapes}))");
        \DB::statement("ALTER TABLE notes ADD CONSTRAINT notes_text_align_check CHECK (text_align IN ('left','center','right','justify'))");
    }
}

public function down(): void
{
    if (config('database.default') === 'pgsql') {
        \DB::statement('ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_shape_check');
        \DB::statement('ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_text_align_check');
    }
    Schema::table('notes', function (Blueprint $table) {
        $table->dropColumn(['shape', 'font_family', 'text_align']);
    });
}
```

### 6.6 Sketch de payload `PUT /api/notes/{id}`

Request:
```json
{
  "title": "Mi nota enriquecida",
  "text": "Contenido de la nota con estilo Miro.",
  "shape": "rounded_rectangle",
  "font_family": "Merriweather",
  "text_align": "center",
  "status": "En curso",
  "updated_at": "2026-09-27T18:42:11+00:00"
}
```

Response 200:
```json
{
  "note": {
    "id": 42,
    "title": "Mi nota enriquecida",
    "text": "Contenido de la nota con estilo Miro.",
    "status": "En curso",
    "shape": "rounded_rectangle",
    "font_family": "Merriweather",
    "text_align": "center",
    "position_x": 120.0,
    "position_y": 240.0,
    "created_at": "2026-09-26T10:00:00+00:00",
    "updated_at": "2026-09-27T18:42:13+00:00"
  }
}
```

## Happy Path

### Flow 1 — Crear nota con valores de enriquecimiento (Frontend → Backend)

1. Usuario autenticado hace click en FAB "+" en `/tablero`.
2. Frontend abre `NoteEditor` con `id: null`. Campos: `title=""`, `text=""`, `shape="rectangle"` (default local), `font_family="Inter"` (default local), `text_align="left"` (default local), `status="Pendiente"`.
3. Usuario escribe título y texto. Usuario cambia `shape` a `rounded_rectangle` (selector dentro del modal). Usuario cambia `font_family` a `Merriweather`. Usuario cambia `text_align` a `center`. **Todos los cambios son locales, no se persiste ninguno todavía.**
4. El preview dentro del `NoteEditor` (mini tarjeta muestra arriba del textarea) refleja en vivo: bordes redondeados, fuente serif, texto centrado.
5. Usuario click "Guardar".
6. Frontend → `POST /api/notes` con `{title, text, shape: "rounded_rectangle", font_family: "Merriweather", text_align: "center", status: "Pendiente", position_x, position_y}`.
7. Backend: `StoreNoteRequest` valida `shape`, `font_family`, `text_align` contra allow-lists.
8. Backend: `NoteService::create` persiste los seis campos en `notes`.
9. Backend loguea `notes.created` con `user_id`, `note_id` (HU-02 §B10).
10. Backend responde **201** con `NoteResource` (incluye los tres campos nuevos).
11. Frontend reemplaza nota temporal por la real; cierra el modal; toast `"Nota creada"`.

### Flow 2 — Editar shape de una nota existente (Frontend → Backend)

1. Usuario hace click en "Editar" sobre una `NoteCard` (HU-02 mantiene el flujo).
2. `NoteEditor` se abre con los valores persistidos de la nota (incluyendo `shape="rectangle"`, `font_family="Inter"`, `text_align="left"` si fueron los defaults de la migración).
3. Usuario cambia `shape` de `rectangle` a `diamond` vía el selector. El preview dentro del modal muestra la forma `diamond` (clip-path) con el texto actual.
4. Usuario NO modifica otros campos. Click "Guardar".
5. Frontend → `PUT /api/notes/{id}` con `{title, text, shape: "diamond", font_family: "Inter", text_align: "left", status, updated_at}` (todos los campos, porque HU-02 ya envía el body completo).
6. Backend: `UpdateNoteRequest` valida `shape="diamond"` ∈ catálogo §6.1; pasa validación.
7. Backend: lock optimista OK (sin cambios de terceros entre GET y PUT).
8. Backend: `NoteService::update` aplica el cambio; log `notes.updated` con `fields_changed=[{field:"shape", old:"rectangle", new:"diamond"}]`.
9. Backend responde **200** con `NoteResource`.
10. Frontend reemplaza el estado local; cierra modal; toast `"Nota actualizada"`.
11. La `NoteCard` ahora se renderiza con `clip-path: polygon(...)` de `diamond`.

### Flow 3 — Editar font_family y text_align simultáneamente (Frontend → Backend)

1. Usuario abre `NoteEditor` de una nota.
2. Cambia `font_family` a `JetBrains Mono` y `text_align` a `justify` en distintas interacciones.
3. El preview interno del modal refleja ambas elecciones en caliente (CSS aplica inline sobre un `<div>` paralelo por la limitación de `<textarea>` con `justify`).
4. Click "Guardar" → `PUT /api/notes/{id}` con los tres campos (shape sin cambios) y `updated_at`.
5. Backend valida, aplica lock, persiste.
6. Backend responde 200 con `NoteResource` que ahora tiene `font_family="JetBrains Mono"`, `text_align="justify"`, `shape="rectangle"`.
7. Frontend cierra modal; toast `"Nota actualizada"`.
8. La `NoteCard` renderiza con `font-family: "JetBrains Mono", monospace;` y `text-align: justify;`.

### Flow 4 — Cancelar selección de shape/font/alignment (solo Frontend)

1. Usuario abre `NoteEditor`.
2. Cambia `shape`, `font_family` y `text_align` libremente (solo local).
3. Click "Cancelar".
4. Frontend descarta el estado local del modal; restaura los valores de la última respuesta del servidor (los tres campos vuelven a sus valores persistidos). NO se hace request.

### Flow 5 — Defaults aplicados al migrar (Backend)

1. Antes de la migración: tabla `notes` con 10 notas existentes sin columnas `shape`/`font_family`/`text_align`.
2. Se corre `php artisan migrate`.
3. La migración aditiva agrega las tres columnas con defaults; cada nota existente recibe `shape="rectangle"`, `font_family="Inter"`, `text_align="left"`.
4. Un `GET /api/notes` posterior a la migración retorna las 10 notas con los tres campos en cada `NoteResource`.
5. Las `NoteCard` en frontend renderizan con los defaults sin error (los campos llegan, no son `undefined`).

### Flow 6 — Crear nota sin enviar shape/font/alignment (Frontend → Backend)

1. Frontend crea nota nueva con `POST /api/notes` que envía solo `{title, text, status, position_x, position_y}` (cliente desactualizado o flujo viejo).
2. Backend: `StoreNoteRequest` trata los tres campos como `sometimes` (no exigidos); aplica defaults de DB.
3. Backend responde 201 con `NoteResource` que incluye `shape="rectangle"`, `font_family="Inter"`, `text_align="left"`.
4. Frontend, al renderizar la `NoteCard`, recibe los tres campos y aplica los defaults sin error.

## Sad Paths

### POST /api/notes — Validación 422 (shape inválido)

- **Condition**: Usuario (o un cliente desactualizado) envía `shape="custom_shape"` que no está en el catálogo §6.1.
- **Expected behavior**: Backend rechaza via `StoreNoteRequest` (rule `in:<catálogo>`).
- **Message/UI**: Toast con `"La forma debe ser una de las formas válidas del catálogo."`.

### POST /api/notes — Validación 422 (font_family inválido)

- **Condition**: `font_family="Comic Sans MS"` (no está en el catálogo §6.2).
- **Expected behavior**: Backend rechaza via `StoreNoteRequest`.
- **Message/UI**: Toast con `"La familia tipográfica debe ser una de las fuentes permitidas."`.

### POST /api/notes — Validación 422 (text_align inválido)

- **Condition**: `text_align="middle"` (no está en `{left,center,right,justify}`).
- **Expected behavior**: Backend rechaza via `StoreNoteRequest`.
- **Message/UI**: Toast con `"La alineación debe ser left, center, right o justify."`.

### PUT /api/notes/{id} — Validación 422 (shape inválido)

- **Condition**: Usuario cambia shape a un valor fuera del catálogo desde el editor.
- **Expected behavior**: Backend rechaza via `UpdateNoteRequest`; lock NO se evalúa (falla antes).
- **Message/UI**: Banner rojo en el editor con mensaje del backend; la nota mantiene los valores previos en el editor.

### PUT /api/notes/{id} — Validación 422 (font_family inválido)

- **Condition**: `font_family="Arial"` (no en catálogo).
- **Expected behavior**: Backend rechaza.
- **Message/UI**: Banner rojo; nota no se persiste.

### PUT /api/notes/{id} — Validación 422 (text_align inválido)

- **Condition**: `text_align="justify-left"`.
- **Expected behavior**: Backend rechaza.
- **Message/UI**: Banner rojo.

### PUT /api/notes/{id} — Lock optimista stale (409) tras cambio de shape por otro usuario

- **Condition**: Usuario A tiene la nota abierta con `updated_at=T1`. Usuario B cambia `shape` y guarda → `updated_at=T2`. Usuario A pulsa Guardar con `updated_at=T1`.
- **Expected behavior**: Backend responde 409 con `current` en el payload (incluye la `shape` nueva de B).
- **Message/UI**: Banner ámbar `"Alguien más editó esta nota. Se recargó la versión más reciente."` con botón "Cargar versión del servidor" (HU-02 §F9 + AC25). Si el usuario lo pulsa, los campos del editor se sobreescriben con los del servidor (incluyendo `shape`).

### PUT /api/notes/{id} — 404 (nota soft-deleted)

- **Condition**: Otro usuario eliminó la nota entre el GET y el PUT.
- **Expected behavior**: 404 con mensaje `"Esta nota ya no existe."`.
- **Message/UI**: Toast; frontend remueve la nota del estado local; cierra el editor.

### PUT /api/notes/{id} — 401 / 403 (token expirado / usuario inactivo)

- **Condition**: Token expirado o `is_active=false`.
- **Expected behavior**: Middleware transversal rechaza.
- **Message/UI**: Frontend limpia sesión, redirige a `/login` con mensaje de expiración o inactividad (HU-01).

### PUT /api/notes/{id} — 500 (DB down u otro error)

- **Condition**: Backend responde 500.
- **Expected behavior**: `updateNote` lanza; frontend atrapa en `catch` de `handleSave`.
- **Message/UI**: Toast `"Error inesperado. Intenta nuevamente."`; editor queda abierto con los datos del usuario.

### PUT /api/notes/{id} — Timeout 10s

- **Condition**: Request tarda más de 10s.
- **Expected behavior**: Axios aborta.
- **Message/UI**: Toast `"La solicitud tardó demasiado. Intenta nuevamente."`; editor queda abierto.

### POST /api/notes — Backend no alcanzable (red caída)

- **Condition**: `ERR_CONNECTION_REFUSED`.
- **Expected behavior**: Axios rechaza.
- **Message/UI**: Toast `"No se pudo contactar al servidor. Verifica tu conexión."`; nota temporal queda visible.

### POST /api/notes — Sin token (401)

- **Condition**: Request sin Bearer token.
- **Expected behavior**: `auth:sanctum` rechaza.
- **Message/UI**: Redirect a `/login` con `"Tu sesión expiró"`.

### POST /api/notes — Usuario inactivo (403)

- **Condition**: Token válido, `is_active=false`.
- **Expected behavior**: `EnsureUserIsActive` rechaza.
- **Message/UI**: Redirect a `/login` con mensaje de inactividad.

### GET /api/notes — 200 con registros pre-migración

- **Condition**: Hay notas en DB creadas antes de la migración (sin columnas nuevas).
- **Expected behavior**: La migración aplica defaults; GET retorna las notas con `shape="rectangle"`, `font_family="Inter"`, `text_align="left"`.
- **Message/UI**: Render normal de `NoteCard` con defaults.

### GET /api/notes — Backend caído

- **Condition**: `ERR_CONNECTION_REFUSED` al cargar el tablero.
- **Expected behavior**: Axios rechaza.
- **Message/UI**: Toast `"No se pudo contactar al servidor. Verifica tu conexión."`; canvas vacío.

### GET /api/notes — 500

- **Condition**: Backend responde 500.
- **Expected behavior**: Frontend no puede pintar el tablero.
- **Message/UI**: Toast `"Error inesperado. Intenta nuevamente."`; canvas vacío.

### GET /api/notes/{id} — 404 tras soft-delete

- **Condition**: Nota soft-deleted entre dos llamadas.
- **Expected behavior**: Backend responde 404.
- **Message/UI**: Toast `"Esta nota ya no existe."`.

### Frontend — `note.shape` o `note.font_family` o `note.text_align` undefined

- **Condition**: Un payload malformado (cliente desactualizado o proxy que recorta el body) omite los tres campos.
- **Expected behavior**: Frontend usa defaults locales (`rectangle`, `Inter`, `left`) y no rompe render.
- **Message/UI**: Sin error visible para el usuario; la nota se ve "como siempre".

## Edge Cases

- [ ] **E1.** `shape`, `font_family` y `text_align` no se envían en `POST /api/notes` → backend aplica defaults de DB; `NoteResource` los retorna en la respuesta.
- [ ] **E2.** `shape`, `font_family` y `text_align` no se envían en `PUT /api/notes/{id}` → backend usa `array_intersect_key` y los campos no se modifican (HU-02 §B7).
- [ ] **E3.** Enviar `shape=null` → `FormRequest` rechaza con 422 (`string` rule). NO se permite null en DB (columna NOT NULL).
- [ ] **E4.** Enviar `shape=""` (string vacío) → `FormRequest` rechaza (no está en el `in:` allow-list).
- [ ] **E5.** Enviar `font_family="inter"` (minúsculas) → el catálogo usa `Inter` con mayúscula. `FormRequest` rechaza por `in:` rule. **Decisión deliberada**: nombres de fuente son case-sensitive.
- [ ] **E6.** Cambio de `shape` múltiples veces antes de Guardar → solo el último valor se persiste; los intermedios nunca llegan al backend.
- [ ] **E7.** Cambio de `font_family` y `text_align` independientes (sin tocar shape) → todos se persisten en el mismo PUT (HU-02 ya envía el body completo).
- [ ] **E8.** Usuario abre `NoteEditor` pero no toca los selectores nuevos y pulsa Guardar sin cambios → backend rechaza 409 si el `updated_at` cambió, pero si está en sync, persiste el body completo (con los mismos valores de shape/font/alignment que ya tenía). El PUT puede no ser idempotente a nivel "no-op" porque `updated_at` se actualiza.
- [ ] **E9.** Migración corre dos veces por error → la segunda vez falla porque las columnas ya existen. La migración debe ser idempotente o, al menos, detectar y no romper (decisión de implementación: usar `Schema::hasColumn` antes de `addColumn`).
- [ ] **E10.** `down()` de la migración dropea las columnas → si hay notas existentes con shape/font/alignment no-default, se pierden los datos. Aceptable por ser rollback; documentado en el `down()`.
- [ ] **E11.** `font_family` con valor válido pero NO presente en Google Fonts (decisión futura de remover una fuente) → frontend no carga esa fuente; CSS fallback a `serif`/`sans-serif`/`monospace`/`cursive`. La nota sigue visible.
- [ ] **E12.** `shape` con `clip-path` no soportado por el navegador del usuario (ej. navegador antiguo) → la nota renderiza como rectangle (fallback visual). Aplica el default CSS sin romper layout.
- [ ] **E13.** `text_align="justify"` sobre un `<textarea>` (en el preview del editor) → `<textarea>` ignora `text-align: justify` en Chromium/Firefox (limitación de plataforma). El preview usa un `<div>` paralelo para mostrar el efecto; el `<textarea>` mantiene su valor.
- [ ] **E14.** Texto de la nota excede los 220x220 px → overflow oculto (`overflow: hidden`); la forma (clip-path) recorta el texto sobrante. NO hay scroll interno; NO hay auto-grow.
- [ ] **E15.** Nota con `shape="circle"` o `shape="ellipse"` y texto largo → el texto puede quedar visualmente apretado por la curvatura. Decisión: aceptar la degradación visual; el usuario puede elegir otra forma si quiere más espacio.
- [ ] **E16.** `NoteCard` recibe `note.shape="unknown_shape"` (caso nunca debería pasar por CHECK de DB, pero defensa en profundidad) → frontend cae a `rectangle` (default de JS).
- [ ] **E17.** Carga de Google Fonts falla (red bloqueada, CSP) → la nota renderiza con la fuente fallback declarada en CSS (`sans-serif`, `serif`, `monospace`, `cursive`); no rompe layout.
- [ ] **E18.** Backend en `pgsql` vs `sqlite` (test) → la migración aplica el CHECK solo si `pgsql`; en `sqlite` la validación rely entirely en el `FormRequest`. Documentado en el código de la migración.
- [ ] **E19.** `updated_at` cambia entre GET y PUT por cualquier razón (otro usuario guardó, otro usuario draggeó la nota) → 409 (HU-02 §B8). El body del PUT incluye shape/font/alignment pero el lock los descarta.
- [ ] **E20.** Usuario edita solo `shape` y pulsa Guardar → el PUT envía los seis campos con los valores actuales (frontend re-envía el body completo). Es válido.
- [ ] **E21.** Drag (position-only) de una nota con `shape=circle` → el `PATCH /api/notes/{id}/position` no toca `shape`/`font_family`/`text_align` (endpoint separado, sigue siendo position-only). Estos campos quedan intactos.
- [ ] **E22.** Soft-delete de una nota con `shape=star` → `DELETE /api/notes/{id}` funciona igual; el `shape` queda persistido en el registro soft-deleted pero no se muestra en `GET /api/notes`.

## Stupid Cases

### Catálogo y allow-list

- [ ] **S1.** Enviar `shape="Rectangle"` con mayúscula inicial → rechazado por `in:` rule case-sensitive. Decisión documentada (lower_snake_case).
- [ ] **S2.** Enviar `shape="rectangle "` con espacio al final → rechazado (no trim en `in:`).
- [ ] **S3.** Enviar `shape="rectangle; DROP TABLE notes;--"` (SQL injection via JSON) → Eloquent parametriza; el valor llega como string al CHECK, falla el constraint. NO se ejecuta SQL.
- [ ] **S4.** Enviar `font_family="<script>alert(1)</script>"` → `FormRequest` rechaza por `in:` rule. Si pasara (no debería), React escapa por defecto al renderizar (HU-02 §S2).
- [ ] **S5.** Pegar un font-family con `expression()` o CSS hack → se rechaza en allow-list.
- [ ] **S6.** Enviar `text_align` con valor numérico (`42`) → `FormRequest` rechaza (no es string del allow-list).

### Persistencia y migración

- [ ] **S7.** Correr `php artisan migrate` con la DB ya en la nueva versión → la migración es no-op (o falla si no es idempotente; decisión: implementar idempotencia con `hasColumn`).
- [ ] **S8.** Rollback (`migrate:rollback`) dropea las tres columnas → HU-05 visual se rompe; pero al re-aplicar (`migrate`) todo vuelve. Aceptable.
- [ ] **S9.** Migración a mano en `psql` que inserta `shape="invalid"` → el CHECK de DB rechaza. El frontend nunca debería ver ese valor.
- [ ] **S10.** DB local con `sqlite` (test) sin CHECKs → si el `FormRequest` está bien, no hay problema; si el `FormRequest` se saltea, valor inválido llega al frontend. Defensa en profundidad: cliente valida con la misma allow-list antes de enviar.

### Frontend visual

- [ ] **S11.** Usuario cambia `shape` a `circle` y la nota se vuelve visualmente más pequeña (clip-path recorta esquinas) → esperado; usuario confundido puede volver a `rectangle`.
- [ ] **S12.** Texto en `Caveat` (handwriting) más alto que en `Inter` → puede exceder el bounding box 220x220; se recorta (overflow:hidden). Esperado.
- [ ] **S13.** Navegador del usuario sin soporte para `clip-path` (navegador muy viejo) → la forma no se aplica; nota renderiza como rectangle. Aceptable; documentado en E12.
- [ ] **S14.** Usuario con `prefers-reduced-motion` y CSS de transición al cambiar forma → las animaciones se desactivan (regla CSS `@media`); cambio de forma es instantáneo.
- [ ] **S15.** Click derecho sobre el selector de forma → menú contextual nativo del navegador (no se intercepta). Esperado.
- [ ] **S16.** Doble click en el selector de fuente → no abre nada raro (es `<select>` nativo).
- [ ] **S17.** Tabla de fonts no carga porque la red bloquea fonts.googleapis.com → fallback a fuentes del sistema; nota legible; sin error visible.

### Concurrencia y multi-tab

- [ ] **S19.** Usuario A abre editor y elige `shape=diamond`. Usuario B abre la misma nota y elige `shape=star`. A guarda primero (200). B guarda con `updated_at` viejo → 409; toast de recarga; al recargar, B ve `shape=diamond` (la de A). El cambio de B se pierde (last-write-wins + reload).
- [ ] **S20.** Usuario A cambia `font_family`, Usuario B cambia `text_align` en paralelo. A guarda con `updated_at=T1`. B guarda con `updated_at=T1` después → 409 para B (lock global). Al recargar, B ve el `font_family` de A y el `text_align` (que B nunca llegó a guardar) — el cambio de B se pierde. Esto es lock optimista global; cada edición es atómica.
- [ ] **S21.** Usuario A arrastra la nota (position-only PATCH) mientras Usuario B abre el editor. El PATCH de A actualiza `updated_at`. Cuando B guarda el shape, B manda `updated_at` viejo → 409; B recarga; ve la nueva posición + el shape que B tenía localmente. (Nota: B nunca había enviado shape antes, así que se mantiene el actual.)
- [ ] **S22.** Token expira mid-edit (mientras el usuario elige shape) → próximo request (Guardar) → 401 → limpia sesión, redirige a `/login`. Los cambios locales de shape se pierden.

### Extremos de datos

- [ ] **S23.** `shape="star"` + texto de 2000 chars → overflow oculto en la forma de estrella; el texto se recorta por el `clip-path`. Esperado.
- [ ] **S24.** `font_family="Lobster"` + `text_align="justify"` + texto corto (1 línea) → `justify` se ve igual que `left` (sin espacio para justificar). Decisión: comportamiento CSS estándar.
- [ ] **S25.** Crear 50 notas con shapes distintas en rápida sucesión → sin rate limit (HU-02 §S4); todas se crean.
- [ ] **S26.** Cambiar la misma `shape` 5 veces antes de Guardar → solo el último valor viaja al backend (HU-02 §E4).

### Routing y casos cruzados

- [ ] **S27.** PATCH `/api/notes/{id}/position` con un body que incluye `shape` → `UpdateNotePositionRequest` (HU-02) NO valida `shape`; el campo extra se ignora silenciosamente. Decisión documentada.
- [ ] **S28.** URL `/tablero` cargada con un payload de nota que tiene `shape="oval"` (no en el catálogo — nota creada con un cliente desactualizado antes de HU-05) → si se logra pasar el CHECK, frontend renderiza como rectangle (fallback). Si el CHECK falla, backend rechaza el POST.
- [ ] **S29.** Cliente desactualizado que no envía los tres campos en POST → backend aplica defaults; respuesta 201 los incluye; cliente desactualizado los ignora silenciosamente.
- [ ] **S30.** F5 durante la selección de shape en el editor → el estado local se pierde; al reabrir, los selectores muestran los valores persistidos.

## Criterios de Aceptación

### Schema (DB) y migración

- [ ] **AC1.** Given `php artisan migrate` después de HU-05, when se inspecciona `notes`, then existen columnas `shape VARCHAR(30) NOT NULL DEFAULT 'rectangle'`, `font_family VARCHAR(40) NOT NULL DEFAULT 'Inter'`, `text_align VARCHAR(10) NOT NULL DEFAULT 'left'`.   PASS / FAIL
- [ ] **AC2.** Given migración aplicada, when se inspecciona constraints, then existe `notes_shape_check` con los 16 valores del catálogo §6.1.   PASS / FAIL
- [ ] **AC3.** Given migración aplicada, when se inspecciona constraints, then existe `notes_text_align_check` con `('left','center','right','justify')`.   PASS / FAIL
- [ ] **AC4.** Given 10 notas existentes antes de la migración, when se corre la migración aditiva, then las 10 notas reciben `shape='rectangle'`, `font_family='Inter'`, `text_align='left'` (no quedan NULL).   PASS / FAIL
- [ ] **AC5.** Given migración aplicada, when se inspecciona `notes`, then NO existen columnas adicionales más allá de las declaradas en HU-02 + estas tres.   PASS / FAIL
- [ ] **AC6.** Given `migrate:fresh` NO se ha corrido, when se ejecuta `php artisan migrate` dos veces en secuencia, then ambas corridas completan sin error y la segunda corrida es no-op para las columnas nuevas (uso de `Schema::hasColumn` antes de `addColumn`).   PASS / FAIL
- [ ] **AC7.** Given la migración `add_visual_enrichment_to_notes_table` aplicada, when se ejecuta `php artisan migrate:rollback`, then las tres columnas nuevas (`shape`, `font_family`, `text_align`) se eliminan y los CHECK constraints (`notes_shape_check`, `notes_text_align_check`) se dropean sin error.   PASS / FAIL

### Modelo y backend setup

- [ ] **AC8.** Given `Note.php`, when se inspecciona `$fillable`, then incluye `shape`, `font_family`, `text_align`.   PASS / FAIL
- [ ] **AC9.** Given `Note.php`, when se inspecciona, then declara constantes públicas para los 16 valores de `shape`, los 7 de `font_family` y los 4 de `text_align`.   PASS / FAIL
- [ ] **AC10.** Given `NoteResource`, when se serializa, then cada nota incluye `shape`, `font_family`, `text_align` en el JSON.   PASS / FAIL

### GET /api/notes

- [ ] **AC11.** Given sesión activa + N notas en DB, when `GET /api/notes`, then respuesta 200 con `notes: [...]` y cada nota incluye `shape`, `font_family`, `text_align`.   PASS / FAIL
- [ ] **AC12.** Given nota con `shape='star'`, when `GET /api/notes`, then el JSON incluye `"shape": "star"`.   PASS / FAIL
- [ ] **AC13.** Given notas soft-deleted, when `GET /api/notes`, then NO aparecen (HU-02 AC6 sigue aplicando).   PASS / FAIL

### POST /api/notes con enrichment

- [ ] **AC14.** Given sesión activa, when `POST /api/notes` con `{title, text, status, position_x, position_y, shape: "diamond", font_family: "Merriweather", text_align: "center"}`, then 201 con `NoteResource` que incluye los tres campos.   PASS / FAIL
- [ ] **AC15.** Given `POST /api/notes` sin enviar los tres campos nuevos, when backend responde, then 201 con `shape="rectangle"`, `font_family="Inter"`, `text_align="left"` (defaults de DB).   PASS / FAIL
- [ ] **AC16.** Given `POST /api/notes` con `shape="invalid_shape"`, when backend responde, then 422 con `{"errors": {"shape": ["La forma debe ser una de las formas válidas del catálogo."]}}`.   PASS / FAIL
- [ ] **AC17.** Given `POST /api/notes` con `font_family="Arial"`, when backend responde, then 422 con mensaje en español.   PASS / FAIL
- [ ] **AC18.** Given `POST /api/notes` con `text_align="middle"`, when backend responde, then 422 con `{"errors": {"text_align": ["La alineación debe ser left, center, right o justify."]}}`.   PASS / FAIL
- [ ] **AC19.** Given `POST /api/notes` con `shape=null`, when backend responde, then 422 (string required, NOT NULL).   PASS / FAIL
- [ ] **AC20.** Given `POST /api/notes` con `shape=""`, when backend responde, then 422 (no en allow-list).   PASS / FAIL
- [ ] **AC21.** Given `POST /api/notes` con body conteniendo `title, text, status, shape, font_family, text_align` todos presentes y válidos, when `StoreNoteRequest` valida, then 201 con `NoteResource` que incluye los 6 campos (title, text, status, shape, font_family, text_align).   PASS / FAIL
- [ ] **AC22.** Given `POST /api/notes` body omitting shape, font_family, and/or text_align, when validated, then 201 is returned with DB defaults applied (shape='rectangle', font_family='Inter', text_align='left').   PASS / FAIL

### PUT /api/notes/{id} con enrichment

- [ ] **AC23.** Given nota persistida con `shape='rectangle'`, when `PUT /api/notes/{id}` con `shape='star'` y `updated_at` en sync, then 200 con `NoteResource` que retorna `shape='star'`.   PASS / FAIL
- [ ] **AC24.** Given nota persistida con `font_family='Inter'`, when `PUT /api/notes/{id}` con `font_family='Caveat'` y resto en sync, then 200 con `font_family='Caveat'`.   PASS / FAIL
- [ ] **AC25.** Given nota persistida con `text_align='left'`, when `PUT /api/notes/{id}` con `text_align='justify'`, then 200 con `text_align='justify'`.   PASS / FAIL
- [ ] **AC26.** Given nota persistida, when `PUT /api/notes/{id}` cambia shape, font_family y text_align simultáneamente, then 200 con los tres campos actualizados.   PASS / FAIL
- [ ] **AC27.** Given `PUT /api/notes/{id}` sin enviar los tres campos nuevos, when backend responde, then los campos existentes NO se modifican (array_intersect_key, HU-02 §B7).   PASS / FAIL
- [ ] **AC28.** Given `PUT /api/notes/{id}` con `shape='custom'`, when backend responde, then 422 con `{"errors": {"shape": [...]}}`.   PASS / FAIL
- [ ] **AC29.** Given `PUT /api/notes/{id}` con `font_family='invalid'`, when backend responde, then 422.   PASS / FAIL
- [ ] **AC30.** Given `PUT /api/notes/{id}` con `font_family` conteniendo tags `<script>alert(1)</script>` o cualquier HTML/JS, when `UpdateNoteRequest` valida, then 422 y el valor NO se persiste en DB ni se retorna en la respuesta.   PASS / FAIL
- [ ] **AC31.** Given `PUT /api/notes/{id}` con `text_align='start'`, when backend responde, then 422.   PASS / FAIL
- [ ] **AC32.** Given nota N con `updated_at=T1`, when A hace PUT sin cambios reales (no field changes) y `If-Match=T1`, then el backend responde 409 con el estado actual de N y `updated_at=T2` refrescado.   PASS / FAIL
- [ ] **AC33.** Given nota N con `updated_at=T1`, when A hace PUT cambiando `shape='star'` con `If-Match=T1` mientras B ya cambió `font_family='Caveat'` a `T2`, then A recibe 409 con `current={shape: rectangle, font_family: Caveat, updated_at: T2}`, A descarta los cambios locales (incluyendo `shape='star'`) y debe refrescar antes de reintentar.   PASS / FAIL
- [ ] **AC34.** Given frontend recibe 409, when procesa, then descarta cambios locales (incluyendo selección de shape/font/alignment de B), recarga del servidor, muestra toast `"Alguien más editó esta nota. Se recargó la versión más reciente."` (mismo mensaje que HU-02 AC25).   PASS / FAIL
- [ ] **AC35.** Given nota soft-deleted por otro, when frontend intenta PUT, then 404 + remoción local (HU-02 AC26 sigue aplicando).   PASS / FAIL

### PATCH /api/notes/{id}/position (no debe tocar enrichment)

- [ ] **AC36.** Given nota con `shape='star'`, when `PATCH /api/notes/{id}/position` con `{position_x, position_y}`, then 204; el `shape` queda intacto (`shape='star'` después del PATCH).   PASS / FAIL
- [ ] **AC37.** Given nota con `font_family='Caveat'`, when `PATCH /api/notes/{id}/position`, then el `font_family` queda intacto.   PASS / FAIL

### DELETE /api/notes/{id} (HU-02 + soft delete)

- [ ] **AC38.** Given nota con enrichment, when `DELETE /api/notes/{id}`, then 204; la nota se soft-deleted con sus campos `shape`/`font_family`/`text_align` preservados en la fila.   PASS / FAIL
- [ ] **AC39.** Given nota eliminada, when `GET /api/notes`, then NO aparece (HU-02 AC18 sigue aplicando).   PASS / FAIL

### Catálogo de formas (frontend rendering)

- [ ] **AC40.** Given nota con `shape='diamond'`, when `NoteCard` renderiza, then la silueta visible es inequívocamente identificada como diamante (verificable por bounding rect del DOM o screenshot visual).   PASS / FAIL
- [ ] **AC41.** Given nota con `shape='star'`, when `NoteCard` renderiza, then la silueta visible es inequívocamente identificada como estrella de 5 puntas.   PASS / FAIL
- [ ] **AC42.** Given nota con `shape='circle'`, when `NoteCard` renderiza, then la silueta visible es un círculo perfecto.   PASS / FAIL
- [ ] **AC43.** Given nota con `shape='rounded_rectangle'`, when `NoteCard` renderiza, then la silueta visible es un rectángulo con esquinas claramente redondeadas.   PASS / FAIL
- [ ] **AC44.** Given nota con `shape='arrow'`, when `NoteCard` renderiza, then la silueta visible es una flecha apuntando a la derecha con cuerpo rectangular + punta triangular.   PASS / FAIL
- [ ] **AC45.** Given nota con `shape='cylinder'`, when `NoteCard` renderiza, then la silueta visible se identifica como cilindro visto de frente (más alto que ancho).   PASS / FAIL
- [ ] **AC46.** Given nota con `shape='rectangle'`, when `NoteCard` renderiza, then la silueta visible es un rectángulo de esquinas rectas (default HU-02).   PASS / FAIL
- [ ] **AC47.** Given nota con `shape='rounded_rectangle'`, when `NoteCard` renderiza, then la silueta visible es un rectángulo de esquinas redondeadas (más pronunciadas que AC43).   PASS / FAIL
- [ ] **AC48.** Given nota con `shape='diamond'`, when `NoteCard` renderiza, then la silueta visible es un rombo (cuadrado rotado 45°).   PASS / FAIL
- [ ] **AC49.** Given nota con `shape='triangle'`, when `NoteCard` renderiza, then la silueta visible es un triángulo apuntando hacia arriba.   PASS / FAIL
- [ ] **AC50.** Given nota con `shape='circle'`, when `NoteCard` renderiza, then la silueta visible es un círculo que inscribe en 220x220 (igual a AC42).   PASS / FAIL
- [ ] **AC51.** Given nota con `shape='ellipse'`, when `NoteCard` renderiza, then la silueta visible es una elipse horizontal (más ancha que alta).   PASS / FAIL
- [ ] **AC52.** Given nota con `shape='star'`, when `NoteCard` renderiza, then la silueta visible es una estrella de 5 puntas (igual a AC41).   PASS / FAIL
- [ ] **AC53.** Given nota con `shape='hexagon'`, when `NoteCard` renderiza, then la silueta visible es un hexágono regular con lados planos arriba y abajo.   PASS / FAIL
- [ ] **AC54.** Given nota con `shape='pentagon'`, when `NoteCard` renderiza, then la silueta visible es un pentágono regular con punta hacia arriba.   PASS / FAIL
- [ ] **AC55.** Given nota con `shape='octagon'`, when `NoteCard` renderiza, then la silueta visible es un octágono regular.   PASS / FAIL
- [ ] **AC56.** Given nota con `shape='arrow'`, when `NoteCard` renderiza, then la silueta visible es una flecha apuntando a la derecha (igual a AC44).   PASS / FAIL
- [ ] **AC57.** Given nota con `shape='parallelogram'`, when `NoteCard` renderiza, then la silueta visible es un paralelogramo inclinado a la derecha.   PASS / FAIL
- [ ] **AC58.** Given nota con `shape='trapezoid'`, when `NoteCard` renderiza, then la silueta visible es un trapezoide con base más ancha abajo.   PASS / FAIL
- [ ] **AC59.** Given nota con `shape='message_bubble'`, when `NoteCard` renderiza, then la silueta visible es un globo de cómic con colita inferior.   PASS / FAIL
- [ ] **AC60.** Given nota con `shape='cloud'`, when `NoteCard` renderiza, then la silueta visible es una nube con lóbulos irregulares.   PASS / FAIL
- [ ] **AC61.** Given nota con `shape='cylinder'`, when `NoteCard` renderiza, then la silueta visible se identifica como cilindro visto de frente (igual a AC45).   PASS / FAIL
- [ ] **AC62.** Given nota con cualquier `shape`, when se renderiza, then el color de fondo sigue dependiendo del `status` (HU-02 AC33-35) — la forma NO altera el color.   PASS / FAIL

### Catálogo de fuentes (frontend rendering)

- [ ] **AC63.** Given `index.html` carga Google Fonts con las 7 familias del §6.2, when frontend renderiza, then las familias están disponibles vía `font-family` CSS.   PASS / FAIL
- [ ] **AC64.** Given nota con `font_family='Merriweather'`, when `NoteCard` renderiza, then el texto se ve en serif Merriweather (no en sans-serif Inter).   PASS / FAIL
- [ ] **AC65.** Given nota con `font_family='JetBrains Mono'`, when `NoteCard` renderiza, then el texto se ve monoespaciado.   PASS / FAIL
- [ ] **AC66.** Given nota con `font_family='Caveat'`, when `NoteCard` renderiza, then el texto se ve manuscrito (handwriting).   PASS / FAIL
- [ ] **AC67.** Given Google Fonts no carga (red bloqueada), when `NoteCard` renderiza, then el texto usa el fallback de CSS (`sans-serif`, `serif`, `monospace`, `cursive`) y la nota es legible.   PASS / FAIL

### Catálogo de alineación (frontend rendering)

- [ ] **AC68.** Given nota con `text_align='center'`, when `NoteCard` renderiza, then el texto está centrado horizontalmente dentro de la forma.   PASS / FAIL
- [ ] **AC69.** Given nota con `text_align='right'`, when `NoteCard` renderiza, then el texto está alineado a la derecha dentro de la forma.   PASS / FAIL
- [ ] **AC70.** Given nota con `text_align='justify'`, when `NoteCard` renderiza, then el texto se justifica (espaciado entre palabras, no entre letras, en líneas múltiples).   PASS / FAIL
- [ ] **AC71.** Given nota con `text_align='left'` (default), when `NoteCard` renderiza, then el texto se alinea a la izquierda (igual que antes de HU-05).   PASS / FAIL

### NoteEditor (interacción)

- [ ] **AC72.** Given `NoteEditor` abierto para una nota, when renderiza, then muestra tres controles: selector de `shape`, selector de `font_family`, selector de `text_align`.   PASS / FAIL
- [ ] **AC73.** Given `NoteEditor` abierto, when usuario cambia el selector de `shape`, then el preview interno (mini-tarjeta muestra) refleja la nueva forma inmediatamente (sin Guardar).   PASS / FAIL
- [ ] **AC74.** Given `NoteEditor` abierto, when usuario cambia el selector de `font_family`, then el preview aplica la nueva fuente inmediatamente.   PASS / FAIL
- [ ] **AC75.** Given `NoteEditor` abierto, when usuario cambia el selector de `text_align`, then el preview aplica la nueva alineación inmediatamente.   PASS / FAIL
- [ ] **AC76.** Given usuario selecciona `text_align='justify'` en el editor, when se muestra el preview del editor, then un `<div>` paralelo que espeja el contenido del `<textarea>` se muestra con `text-align: justify` aunque el `<textarea>` mismo no justifique visualmente (limitación de plataforma Chromium/Firefox documentada en A3).   PASS / FAIL
- [ ] **AC77.** Given `NoteEditor` abierto con cambios locales de shape/font/alignment, when usuario pulsa Guardar, then `PUT /api/notes/{id}` incluye los tres campos con sus valores locales.   PASS / FAIL
- [ ] **AC78.** Given usuario abre `NoteEditor` sobre nota existente, cambia `shape`/`font_family`/`text_align`, then cierra el modal sin pulsar Guardar, then NO se hace HTTP request al backend y la nota en el tablero mantiene los valores persistidos previos.   PASS / FAIL
- [ ] **AC79.** Given usuario abre `NoteEditor` para nota nueva (FAB), escribe título, elige `shape='diamond'`, then cierra el modal sin pulsar Guardar, then NO se hace HTTP request y NO se crea ninguna nota nueva en el canvas.   PASS / FAIL

### Concurrencia y lock (extendido)

- [ ] **AC80.** Given dos usuarios editan la misma nota, when A cambia shape y guarda, then B recibe 409 al intentar guardar (lock global HU-02 AC24 sigue aplicando).   PASS / FAIL
- [ ] **AC81.** Given 409 al guardar `shape`/`font_family`/`text_align`, when el frontend maneja la respuesta, then todos los cambios locales del usuario actual (`title`, `text`, `status`, `shape`, `font_family`, `text_align`) son descartados y reemplazados por los valores del servidor, y se recarga el estado desde el payload `current` del 409.   PASS / FAIL
- [ ] **AC82.** Given Usuario A abre nota y elige shape, when Usuario B elimina la nota antes que A guarde, then A recibe 404 al guardar; toast; nota removida del estado local.   PASS / FAIL

### Persistencia y restart

- [ ] **AC83.** Given nota guardada con `shape='star'`, when F5 en `/tablero`, then la nota sigue visible con `shape='star'`.   PASS / FAIL
- [ ] **AC84.** Given dev environment corriendo con nota persistida con `font_family='Caveat'`, when el operador ejecuta manualmente `docker compose down && docker compose up -d` (sin `-v`) y luego `php artisan migrate`, then la nota sigue en DB con `font_family='Caveat'` (operador verifica manualmente con `docker compose exec postgres psql -U ... -c "SELECT font_family FROM notes;"`).   PASS / FAIL
- [ ] **AC85.** Given dev environment corriendo, when el operador ejecuta manualmente `docker compose down -v && docker compose up -d` y luego `php artisan migrate --seed`, then la DB queda vacía de notas; los seeders crean solo usuarios demo; ninguna nota de HU-05 sobrevive al `-v` (operador verifica manualmente con `GET /api/notes`).   PASS / FAIL
- [ ] **AC86.** Given nota con enrichment, when `GET /api/notes` con F5, then la respuesta incluye los tres campos para esa nota.   PASS / FAIL

### Auth transversal (heredado de HU-02)

- [ ] **AC87.** Given request sin token, when `POST /api/notes` con enrichment o `PUT /api/notes/{id}` con enrichment, then 401.   PASS / FAIL
- [ ] **AC88.** Given request con token pero `is_active=false`, when cualquier endpoint de notas con enrichment, then 403 con mensaje de inactividad.   PASS / FAIL
- [ ] **AC89.** Given 401/403 en endpoints de notas, when frontend procesa, then limpia `sessionStorage` y redirige a `/login`.   PASS / FAIL

### Logging (heredado de HU-02)

- [ ] **AC90.** Given edición de `shape`, when backend responde 200, then log `notes.updated` contiene `fields_changed` con `{field: "shape", old: "rectangle", new: "star"}`.   PASS / FAIL
- [ ] **AC91.** Given edición de `font_family`, when backend responde 200, then log `notes.updated` contiene `fields_changed` con `field: "font_family"`.   PASS / FAIL
- [ ] **AC92.** Given edición de `text_align`, when backend responde 200, then log `notes.updated` contiene `fields_changed` con `field: "text_align"`.   PASS / FAIL

### UI / estética (extendido)

- [ ] **AC93.** Given `NoteCard` con cualquier `shape`, when mide el bounding box, then sigue siendo 220x220 px (±1) — la forma se inscribe dentro.   PASS / FAIL
- [ ] **AC94.** Given dos notas con `shape=circle` adyacentes en el canvas, when se renderizan, then los hitboxes de drag-and-drop permanecen rectangulares (bounding box 220x220) y las esquinas transparentes del círculo NO afectan z-ordering ni hit-testing de notas adyacentes.   PASS / FAIL
- [ ] **AC95.** Given `NoteCard` con `font_family='Caveat'` y texto largo, when se renderiza, then el texto puede exceder el bounding box; se recorta con `overflow: hidden`.   PASS / FAIL
- [ ] **AC96.** Given dos notas en el tablero con distinta `font_family` y mismo `status`, when renderizan, then el color de fondo es el mismo (del status); solo la tipografía difiere.   PASS / FAIL
- [ ] **AC97.** Given usuario tiene `prefers-reduced-motion: reduce` activo en OS, when las notas se renderizan o cuando cambia `shape`/`font_family`/`text_align`, then NO se reproduce ninguna animación de transición (CSS `@media (prefers-reduced-motion: reduce)` cubre el caso).   PASS / FAIL

### Anti-enumeración y privacy (heredado)

- [ ] **AC98.** Given `NoteResource` con enrichment, when serializa, then no expone IDs internos extra ni filtra por autor; los tres campos son strings planos.   PASS / FAIL
- [ ] **AC99.** Given `NoteResource` con enrichment, when serializa, then el campo `shape` se incluye como string que matchea exactamente uno de los 16 valores del catálogo §6.1 (no enum numérico, no objeto, no null).   PASS / FAIL

### Multi-tab y consistencia

- [ ] **AC100.** Given usuario tiene la misma nota abierta en dos tabs, when en tab 1 cambia shape a 'star' y guarda, then al refrescar tab 2 ve la nota con `shape='star'`.   PASS / FAIL
- [ ] **AC101.** Given tab 2 tiene el `NoteEditor` abierto con `shape='diamond'` local, when en tab 1 guardó `shape='star'`, then al guardar tab 2 recibe 409; recarga; ve `shape='star'`, regardless of which field (`title`, `text`, `status`, `shape`, `font_family`, `text_align`) caused the 409.   PASS / FAIL

### Defaults y robustez

- [ ] **AC102.** Given `NoteCard` recibe `note.shape === undefined` (payload malformado en runtime degradado), when renderiza, then usa `rectangle` como fallback y no rompe.   PASS / FAIL
- [ ] **AC103.** Given `NoteCard` recibe `note.font_family === undefined`, when renderiza, then usa `Inter, sans-serif` como fallback.   PASS / FAIL
- [ ] **AC104.** Given `NoteCard` recibe `note.text_align === undefined`, when renderiza, then usa `left` como fallback.   PASS / FAIL
