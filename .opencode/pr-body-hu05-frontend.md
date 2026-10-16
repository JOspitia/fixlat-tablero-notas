Implementa el editor del modal NoteEditor con los tres selectores de enriquecimiento visual (forma, fuente, alineación) que faltaban en la HU-05 frontend, más la carga de las seis fuentes de Google Fonts que faltaban en index.css. Cierra también un cable del optimistic lock que había quedado desfasado por el cambio del backend WU-3c (de `updated_at` a `version`).

## Cambios

| Archivo | Cambio |
|---|---|
| `frontend/src/components/NoteEditor.jsx` | Selectores de shape (16), font_family (7) y text_align (4) con preview en vivo de mini-tarjeta. `<div>` espejo paralelo al textarea para `text_align='justify'` (AC76). `handleSubmit` envía `version` en vez de `updated_at`. |
| `frontend/src/pages/TableroPage.jsx` | `handleSave` propaga `shape`/`font_family`/`text_align` en create y update; reemplaza `updated_at` por `version` en update. |
| `frontend/src/index.css` | Agrega 6 `@import` de Google Fonts (Merriweather, JetBrains Mono, Caveat, Lobster, Playfair Display, Poppins) con `display=swap`. Inter ya estaba. |
| `frontend/src/services/notes.js` | Comentario del lock optimista actualizado para reflejar WU-3c (version en lugar de updated_at). |

## Commits

- `89717af` feat(hu-05/frontend): editor toolbar con shape, font y alignment + 6 fuentes de Google Fonts
- `37274c7` docs(hu-05/hu-06): redactar US para enriquecimiento visual y conectores entre notas
- `4deea45` feat(hu-05/frontend): render de las 16 shapes, fuentes y alineación en NoteCard

## Criterios de aceptación cubiertos

- **AC72** tres selectores visibles en el modal (uno por enrichment axis).
- **AC73/74/75** preview refleja los cambios sin Guardar (lee directo de state local, sin debounce).
- **AC76** `<div aria-hidden>` espejo que espeja el contenido del textarea con `text-align: justify`; el textarea mismo queda intacto por limitación de plataforma Chromium/Firefox.
- **AC77** PUT `/api/notes/{id}` incluye los tres campos con sus valores locales.
- **AC78/79** cancelar sin Guardar no hace HTTP request (el editor solo invoca `onSave` en submit).

## Notas de scope

- Sin tests automatizados (decisión del proyecto, los ACs son la fuente de verdad).
- Sin cambios en backend.
- Bug fix colateral del lock: sin este cambio, cualquier edición contra el backend WU-3c devolvía 409 espurios por mismatch de `updated_at` vs `version`. Ahora el cable pasa `version` correctamente.
- Catalogo duplicado en NoteEditor (resolvers + SOLID_COLOR_BY_STATUS) por self-containment; trade-off documentado en Engram. Refactor natural cuando crezca: extraer a `src/lib/note-enrichment.js`.

## Cómo probarlo

1. `docker compose up --build -d` y esperar a que LocalStack diga "Ready.".
2. `npm run dev` en `frontend/`.
3. Login con `admin@test.com` / `admin123`.
4. Crear nota nueva y verificar que aparece con shape/font/align por defecto (rectangle / Inter / left).
5. Editar una nota: cambiar shape a "Diamante", font a "Caveat", align a "Justificado". El preview debe reflejar los cambios sin Guardar; el textarea en `justify` muestra el `<div>` espejo paralelo.
6. Guardar, refrescar con F5 y verificar que los tres campos persisten en la DB:
   ```
   docker exec -it fixlat_postgres psql -U postgres -d tablero -c "SELECT shape, font_family, text_align, version FROM notes LIMIT 5;"
   ```
7. Cerrar el modal sin Guardar: no debe haber request PUT en la pestaña Network del browser.