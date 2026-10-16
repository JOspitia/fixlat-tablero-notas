Implementa el backend completo de HU-06 (conectores entre notas): nueva tabla `note_connectors`, modelo Eloquent, FormRequests, Resource, controller con los 5 endpoints, service layer y listener de cascade soft-delete en `Note::booted()`. Sigue la convención del proyecto (Request → Controller → Service → Model → Resource) y mantiene soft delete como política única (regla del AGENTS.md del proyecto).

## ⚠️ Size exception

Este PR suma **+678 líneas en 9 archivos**. Supera el budget de revisión de 400 líneas por PR que aplica por defecto en el flujo de implementación de HUs del proyecto. Se aprueba **size:exception** explícitamente porque:

- Los 5 commits son work-units cohesivos (migration; model+resource; formrequests; service+controller; routes+cascade listener). Cada uno cuenta su historia por separado.
- El frontend de HU-06 depende del 100% de este contrato (5 endpoints + cascade), así que splitear en chained PRs no aporta valor de revisión independiente — sería PRs incompletos.
- El backend de HU-05 ya usó el mismo size:exception con tu OK explícito; mantenemos el mismo patrón.

## Cambios

| Archivo | Cambio |
|---|---|
| `backend/database/migrations/2026_09_27_180000_create_note_connectors_table.php` | Nueva tabla con FKs `ON DELETE CASCADE`, soft deletes, CHECKs de style (6 valores) y no-self (`source_note_id <> destination_note_id`) en pgsql, índices sobre source/destination. |
| `backend/app/Models/NoteConnector.php` | Modelo con `SoftDeletes`, fillable, `$attributes` default, constantes `ALLOWED_STYLES` (6), `DEFAULT_STYLE`, `MULTIPLICITY_CAP=6`. Relaciones `sourceNote()` y `destinationNote()`. |
| `backend/app/Http/Resources/NoteConnectorResource.php` | Expone columnas planas (id, source_note_id, destination_note_id, style, created_at, updated_at). Sin objetos anidados para evitar drift con el payload de notas. |
| `backend/app/Http/Requests/StoreNoteConnectorRequest.php` | Valida `destination_note_id` (exists, different de route_note) y `style` (sometimes, in ALLOWED_STYLES). Override `validationData()` inyecta `route_note` para resolver el gotcha de Laravel con `different:`. |
| `backend/app/Http/Requests/UpdateNoteConnectorRequest.php` | Valida `style` (required, in ALLOWED_STYLES). Único campo editable. |
| `backend/app/Services/NoteConnectorService.php` | `list()`, `listForNote()`, `create()` con cap de multiplicidad sobre par no-ordenado, `update()`, `delete()`, `cascadingDeleteForNote()`. Logs lifecycle gated por `config('app.debug')`. |
| `backend/app/Http/Controllers/NoteConnectorController.php` | 5 endpoints. 404 canónicos en español neutro. Manejo de `ModelNotFoundException` (TOCTOU entre validación y creación) y `DomainException::MULTIPLICITY_CAP_EXCEEDED` → 422. |
| `backend/routes/api.php` | 5 rutas nuevas bajo `auth:sanctum + auth.active`. Orden de declaración explícito: top-level `GET /notes/connectors` ANTES de `GET /notes/{note}/connectors`. |
| `backend/app/Models/Note.php` | Listener `deleting` agregado al `booted()` existente. Cascade soft-delete con `DB::transaction()` explícito y guard `isForceDeleting()`. Referencia FQCN a `NoteConnector` para no invertir dependencias. |

## Commits

- `dde36f3` feat(hu-06/backend): registrar 5 rutas de conectores y cascade soft-delete en Note::booted
- `619ec06` feat(hu-06/backend): service NoteConnector + controller con los 5 endpoints
- `39729dd` feat(hu-06/backend): FormRequests StoreNoteConnector y UpdateNoteConnector con validación
- `5d9a7af` feat(hu-06/backend): modelo NoteConnector + Resource + constantes de estilo y cap de multiplicidad
- `2268e9e` feat(hu-06/backend): crear tabla note_connectors con FKs cascade, soft delete y CHECKs de style y no-self

## Endpoints

| Método | Ruta | Nombre |
|---|---|---|
| GET | `/api/notes/connectors` | `note-connectors.index` |
| GET | `/api/notes/{note}/connectors` | `notes.connectors.index` |
| POST | `/api/notes/{note}/connectors` | `notes.connectors.store` |
| PUT | `/api/note-connectors/{id}` | `note-connectors.update` |
| DELETE | `/api/note-connectors/{id}` | `note-connectors.destroy` |

## Decisiones locked (HU-06 obs #210)

Todas reflejadas en código:

1. UI FAB redondo azul — frontend, fuera de scope de este PR.
2. Creación click-to-click — frontend.
3. Flecha curva bezier — frontend.
4. Anclaje automático — frontend.
5. Catálogo de 6 estilos (`ALLOWED_STYLES`).
6. Color/grosor único — frontend.
7. **Cap de multiplicidad = 6** sobre par no-ordenado `{A, B}` (`MULTIPLICITY_CAP`). Auto-conector `A == B` prohibido a 3 capas: FormRequest `different:route_note`, `NoteConnectorService::create`, DB CHECK `note_connectors_no_self_check`.
8. Entidad propia en DB con tabla nueva.
9. **Cascade soft-delete** vía listener en `Note::booted()` con `DB::transaction()` explícito.

## Validación por WU (resumen)

| WU | Validación ejecutada |
|---|---|
| B1 | `php -l` OK + `php artisan migrate --pretend` genera SQL completo (tabla + FKs + índices + 2 CHECKs). |
| B2 | `php -l` OK + tinker: `DEFAULT_STYLE\|MULTIPLICITY_CAP\|count(ALLOWED_STYLES)` = `solid_arrow_end\|6\|6`. |
| B3 | `php -l` OK + tinker confirma `class_exists` de ambos FormRequests. |
| B4 | `php -l` OK + tinker confirma autoload de service y controller. 300 líneas combinadas. |
| B5 | `php -l` OK + `route:list` muestra las 5 rutas en el orden correcto. |

## Cómo probarlo (después de merge + `docker compose up --build`)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'email=admin@test.com&password=admin123' | jq -r '.token')

# Crear conector N1 → N2 (asumiendo N1.id=1, N2.id=2)
curl -X POST http://localhost:8000/api/notes/1/connectors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination_note_id": 2, "style": "solid_arrow_end"}'
# Expected: 201 con {connector: {...}}

# Listar todos
curl http://localhost:8000/api/notes/connectors \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 con {connectors: [...]}

# Cambiar estilo
curl -X PUT http://localhost:8000/api/note-connectors/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"style": "arrow_both_solid"}'
# Expected: 200 con {connector: {...}}

# Borrar conector
curl -X DELETE http://localhost:8000/api/note-connectors/1 \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 sin body

# Cascade: borrar N1 → sus conectores también soft-deleted
curl -X DELETE http://localhost:8000/api/notes/1 \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204
curl http://localhost:8000/api/notes/connectors \
  -H "Authorization: Bearer $TOKEN"
# Expected: {connectors: []} (los conectores que involucraban N1 ya no aparecen)
```

Sad paths a verificar:

```bash
# Self-connector (A == B) → 422
curl -X POST http://localhost:8000/api/notes/1/connectors \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"destination_note_id": 1}'
# Expected: 422 con mensaje "Una nota no puede tener un conector hacia sí misma."

# Style inválido → 422
curl -X POST http://localhost:8000/api/notes/1/connectors \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"destination_note_id": 2, "style": "rainbow"}'
# Expected: 422 con mensaje de style.in

# Cap excedido (crear 6 conectores entre N1 y N2; el 7mo → 422)
# (repetir POST 6 veces, el 7mo debe fallar)
```

## Notas

- Sin tests automatizados (decisión del proyecto, los ACs del US son la fuente de verdad).
- Sin cambios en frontend. La rama `feature/hu-06-conectores-frontend` se abrirá desde `main` después de que este PR esté mergeado, siguiendo el patrón split backend/frontend del proyecto (recordado en AGENTS.md).
- Sin nuevas dependencias de composer.
- Logs lifecycle (`note_connectors.created|updated|deleted`) gated por `config('app.debug')` — production silenciosa. Mismo patrón que `notes.*` (HU-05 WU-3a).
- Review nativo Gentle AI deshabilitado (switch global OFF, proyecto por defecto). Validación manual del diff antes de merge.