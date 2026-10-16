Implementa el frontend completo de HU-06 (conectores entre notas): FAB de modo conector, banner superior, state machine click-to-click, SVG overlay con bezier por conector, mini-toolbar para editar/eliminar, integración con drag de notas y cascade del backend. Sigue el patrón del proyecto (split backend/frontend separados por rama, conventional commits en español neutro).

## ⚠️ Size exception

Este PR suma **+1335 líneas en 9 archivos**. Supera el budget de revisión de 400 líneas por PR que aplica por defecto en el flujo de HUs del proyecto. Se aprueba **size:exception** explícitamente porque:

- Los 6 commits son work-units cohesivos (geometry; service; layer; FAB+banner; toolbar; drag/cascade). Cada uno cuenta su historia por separado.
- Geometry (16 shapes) + state machine + 4 componentes + integración en TableroPage es indivisible — splitear produciría PRs incompletos que no se pueden probar end-to-end.
- El backend de HU-06 (PR #12) y el frontend de HU-05 ya usaron el mismo `size:exception` con tu OK explícito; mantenemos el patrón.

## Cambios

| Archivo | Cambio |
|---|---|
| `frontend/src/lib/noteConnectorConstants.js` | 14 exports: STYLE_LIST (6), STYLE_LABELS (ES), DEFAULT_STYLE, MAX_PER_PAIR=6, color #2563EB, stroke 2px, bezier offset 80px, FAB specs, bbox 220×220, hit-area 12px, exit delay 300ms. |
| `frontend/src/lib/noteConnectorGeometry.js` | 5 funciones puras: `getNoteCenter`, `getAnchorPoint` (16 shapes: rectangle, rounded_rectangle, circle, ellipse, diamond, triangle, star, hexagon, pentagon, octagon, arrow, parallelogram, trapezoid, message_bubble, cloud, cylinder), `bezierPath`, `markerFor`, `isDashed`. |
| `frontend/src/services/connectors.js` | Cliente API: `listConnectors`, `listConnectorsForNote`, `createConnector`, `updateConnector`, `deleteConnector`. |
| `frontend/src/components/ConnectorLayer.jsx` | SVG overlay con `<defs>` marker arrowhead, render por connector de visible path + transparent hit-area (12px), cascade-race defense (skip si source/dest no existe). |
| `frontend/src/components/ConnectorFab.jsx` | FAB redondo azul 56px fixed bottom-right, encima del FAB de notas (offset 12px). Estados active/inactive/disabled. Icono chain inline SVG. |
| `frontend/src/components/ConnectorModeBanner.jsx` | Banner superior fixed con mensaje US AC52 + kbd ESC visible. |
| `frontend/src/components/ConnectorMiniToolbar.jsx` | Toolbar flotante (portal a document.body) con `<select>` de 6 estilos + botón eliminar. ESC cierra, click-outside cierra via `pointerdown`. |
| `frontend/src/components/NoteCard.jsx` | Soporte para props `isConnectorSource` (outline azul 3px + z-30 + badge "Origen") e `isConnectorModeActive` (cursor crosshair). |
| `frontend/src/pages/TableroPage.jsx` | State machine de 3 estados (`null`, `pick-source`, `pick-destination`), handlers de creación con self-connector guard y distance guard < 4px, carga paralela notes+connectors en mount, cascade filter local en `handleDelete` (success + 404 branches), render de todos los nuevos componentes. |

## Commits

- `c4b6a4c` feat(hu-06/frontend): outline + badge Origen en NoteCard + cascade filter local en delete
- `8e2fb32` feat(hu-06/frontend): ConnectorMiniToolbar con selector de estilo y delete + handlers
- `ad19ce8` feat(hu-06/frontend): FAB de modo conector + banner + state machine
- `f44588e` feat(hu-06/frontend): ConnectorLayer SVG con paths, markers y hit-area para click
- `f298f81` feat(hu-06/frontend): service de conectores + carga paralela notes+connectors en mount
- `fd42a0e` feat(hu-06/frontend): geometry helpers para anclas + bezier + constantes de los conectores

## ACs cubiertos (US §3 + §4)

### FAB y modo conector (frontend)

- **AC51**: FAB redondo azul 56px bottom-right, encima del FAB de notas. ✓
- **AC52**: Click FAB → mode activo → cursor `crosshair` + banner superior. ✓
- **AC53**: ESC → modo desactiva, cursor vuelve a default, banner desaparece. ✓
- **AC54**: Click en canvas vacío no pasa nada. ✓ (no hay handler de canvas-level click).
- **AC55**: Click sobre nota A → A se marca con outline azul 3px + badge "Origen". ✓
- **AC56**: Self-connector (A == B) → toast `"No puedes conectar una nota consigo misma."`, sin HTTP. ✓
- **AC57**: Click sobre B (distinto) → POST 201 → dibuja flecha → modo se desactiva tras 300ms. ✓
- **AC58**: Conector renderiza como `<path>` SVG con stroke `#2563EB`, stroke-width `2`, marker-end default. ✓
- **AC59**: Click sobre FAB de notas con mode activo → mode cancela, editor toma prioridad. ✓ (`handleEnterConnectorMode` guardea `editingId !== null`).
- **AC59a**: Click sobre FAB de conectores con editor abierto → click interceptado por overlay del modal. ✓ (FAB disabled cuando `editingId !== null`).

### Mini-toolbar (frontend)

- **AC60**: Click sobre flecha → mini-toolbar cerca del midpoint del bezier. ✓
- **AC61**: Selector con 6 estilos + botón "Eliminar conector". ✓
- **AC62**: Cambio en selector → PUT inmediato (apply-on-change, A7). ✓
- **AC63**: Click "Eliminar conector" → `window.confirm("¿Eliminar este conector?")`. ✓
- **AC64**: Confirmación → DELETE 204 + frontend remueve + toast + toolbar cierra. ✓
- **AC65**: Cancel del confirm → no DELETE, toolbar sigue abierto. ✓ (`window.confirm` retorna `false` → early return).
- **AC66**: Click fuera del toolbar → cierra. ✓ (listener `pointerdown` global).
- **AC67**: ESC → toolbar cierra. ✓ (listener `keydown` global en el toolbar).

### Geometry — anchor points por forma

- **AC68-AC85a**: Implementadas las 16 formas. ✓ (ver commit `fd42a0e` para detalle de cada shape).

### Geometry — bezier

- **AC86**: Control point perpendicular izquierdo, determinista (no aleatorio). ✓
- **AC87**: Si distance < 80px, offset clamped a `distance/2`. ✓
- **AC88**: Self-connector toast cuando `distance < 4px` (AC85a también aplica acá, mismo guard). ✓

### Drag de nota recalcula conectores en vivo (Flow 7)

✓ Verificado por lectura: `handleDragEnd` → `setNotes` → TableroPage re-render → `ConnectorLayer` recibe `notes` actualizado → `useMemo([notes])` rebuilds `notesById` → `getAnchorPoint` re-computa anchors con las nuevas posiciones → `bezierPath` genera nueva string `d` → SVG repaint. El chain está completo desde WU-F3.

### Cascade delete (visual)

✓ `handleDelete` filtra localmente los conectores que involucran la nota borrada en ambos branches (success + 404-recovery).

## Cómo probarlo (después de merge + `docker compose up --build`)

```bash
# 1. Login + crear 2 notas con el FAB de notas (admin@test.com / admin123).

# 2. Click en el FAB azul de conectores (el de la cadena, encima del FAB de notas).
#    Verificar: banner azul arriba, FAB más brillante, cursor crosshair sobre notas.

# 3. Click en la nota A. Verificar: A tiene outline azul 3px + badge "Origen".

# 4. Click en la nota B. Verificar: flecha azul aparece entre A y B, toast "Conector creado",
#    banner desaparece tras 300ms.

# 5. ESC durante el modo conector → modo se cancela.

# 6. Click sobre la flecha. Verificar: mini-toolbar aparece cerca del midpoint.
#    Cambiar el selector de "Flecha continua al final" a "Bidireccional continua".
#    Verificar: la flecha cambia inmediatamente (apply-on-change), toolbar queda abierta.

# 7. Click "Eliminar conector" en el toolbar → confirm → flecha desaparece.

# 8. Drag la nota A. Verificar: la flecha sigue a A en tiempo real durante el drag.

# 9. Borrar la nota A (botón Eliminar en NoteCard). Verificar: la flecha también
#    desaparece (cascade).

# 10. Intentar self-connector (mismo flujo pero click A, click A de nuevo).
#     Verificar: toast "No puedes conectar una nota consigo misma.", sin HTTP request.

# 11. Si A y B están a menos de 4px (apenas separadas), intentar conectarlas.
#     Verificar: toast "Mueve una de las notas para poder conectarlas.", sin HTTP.
```

## Decisiones / desviaciones del brief inicial

1. **3 bugs detectados en el brief original del WU-F1** (corregidos por el writer antes de commitear):
   - Star vertices usaban conversión CSS→local incorrecta (sin restar 50%).
   - `t` formula tenía una negación espuria que rompía la intersección con polígonos.
   - `s` denominator chequeaba `ray.x` en vez de `ex` (delta del edge).
2. **Vertices en CW** (mismo orden que CSS source-of-truth), no CCW. La math es agnóstica porque filtra por `s ∈ [0,1]` y `t > 0`.
3. **Cascade-filter duplicado** en ambos branches de `handleDelete` (success + 404-recovery) — defense in depth.
4. **`className="cursor-pointer"`** en el `<select>` del mini-toolbar (corrección a brief que tenía `cursor`).
5. **`bezierPath` omitido del import** en TableroPage — no se usa en `handleConnectorClick`.
6. **El FAB conector está 12px encima del FAB de notas** (no junto), para evitar overlap visual.

## Notas

- Sin tests automatizados (decisión del proyecto, los ACs del US son la fuente de verdad).
- Sin nuevas dependencias de `npm`. Todo lo usado ya estaba en el proyecto (axios, react, react-dom, @dnd-kit, Tailwind).
- Cambia el comportamiento de drag de notas: ahora `TableroPage` re-renderiza más durante drag (porque `notes` cambia → `ConnectorLayer` re-memoiza). No medido en performance todavía; si nota lag con muchas notas + conectores, optimizar en WU futuro con `React.memo` en NoteCard.
- Review nativo Gentle AI deshabilitado (switch global OFF, proyecto por defecto). Validación manual del diff antes de merge.
- Sin cambios en backend. La rama `feature/hu-06-conectores-backend` (PR #12) ya está mergeada en main.