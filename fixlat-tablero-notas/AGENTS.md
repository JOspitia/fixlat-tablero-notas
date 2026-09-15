# AGENTS.md — fixlat-tablero-notas

> Reglas operativas para agentes que trabajan en este proyecto.
> El contexto completo del producto vive en `README.md`; acá solo van
> convenciones, restricciones y trampas conocidas que la IA debe respetar.

---

## 1. Identidad del proyecto

Portal full-stack desacoplado con tres runtimes independientes:

| Capa | Stack | Rol |
|---|---|---|
| Backend | Laravel 12 + PHP 8.2 + `pdo_pgsql` | API REST, auth Sanctum, usuarios, CRUD notas |
| Frontend | React 18 + Vite + Tailwind v4 + `@dnd-kit` | SPA con tablero de post-its (drag & drop libre, X/Y persistidos) |
| Métricas | Node 20 + TypeScript + `pg` (Lambda) | Conteo total + desglose por estado del tablero |
| Datos | PostgreSQL 16 (volumen Docker) | Persistencia |
| Local | Docker Compose + LocalStack 3 | Emulación Lambda + API GW sin cuenta AWS |

`README.md` tiene el detalle de despliegue y los diagramas AWS. No lo duplicar.

---

## 2. Convenciones

- **Idiomas de UI y datos de dominio:** español. Los valores canónicos de `status` son literales en español — no traducir, no renombrar:
  - `Pendiente`
  - `En curso`
  - `Hecho`
- **CORS en Lambda:** todas las respuestas (éxito y error) llevan `Access-Control-Allow-Origin: *`. Mantener esta política salvo decisión explícita en contrario.
- **Variables de entorno en Lambda:** conexión a DB siempre por env (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). Defaults solo para dev local; nunca hardcodear secretos.
- **Build Lambda:** `tsc` produce `dist/app.js`; el handler SAM es `dist/app.handler`. No cambiar `main` ni `Handler` sin actualizar `template.yaml`.
- **Emulación local:** `lambda_local` (puerto `3001`) es el runner rápido para iterar; LocalStack (4566) es para validar API Gateway. Ambos deben coexistir.
- **Persistencia:** `backend/entrypoint.sh` corre `migrate --force` + `db:seed --force`. El seeder usa `updateOrCreate` — no agrega lógica que borre datos en reinicios.

---

## 3. Restricciones críticas (no romper)

1. **Siempre debe existir al menos un administrador activo.** La UI y el backend validan esto. Si una migración o cambio toca `users.active` o el rol `admin`, garantizar la invariante con un check o un seeder compensatorio.
2. **Solo usuarios con `active = true` pueden autenticarse.** Cualquier cambio en Sanctum / middleware de auth debe respetar esta condición.
3. **El frontend se sirve como SPA:** Nginx usa `try_files $uri $uri/ /index.html`. No introducir rutas servidor-side que asuman archivos físicos por ruta.
4. **Lambda comparte Postgres con la API Laravel.** Las queries que asumes "solo la Lambda las lee" son falsas; coordiná migraciones con el backend.
5. **Demo accounts** (`admin@test.com` / `admin123`, `user@test.com` / `user123`) son sembradas automáticamente y no se eliminan en reinicio. No las borres ni cambies sus passwords en código de producción.

---

## 4. Estado actual (al 2026-09-15)

- ✅ Estructura base, Docker, LocalStack, seeders, migraciones, docs iniciales.
- 🔲 Funcionalidades principales pendientes según `README.md`:
  - Autenticación completa
  - Tablero de notas (CRUD + drag & drop con persistencia)
  - Dashboard (consumo de métricas de Lambda)
  - Administración de usuarios desde la UI

Si vas a implementar cualquiera de estos pendientes, tratá el cambio como una feature autocontenida y proponé un approach antes de tocar archivos.

---

## 5. Reglas globales (heredadas)

Las reglas de persona, protocolo Engram y protocolo CodeGraph viven en el
`AGENTS.md` global del usuario (`~/.config/opencode/AGENTS.md`). Este archivo
**agrega** reglas específicas del proyecto; nunca las contradice en silencio —
si hay tensión, preguntar antes de avanzar.

---

## 6. Comandos útiles

```bash
# Backend + Frontend + DB + Lambda local
docker compose up --build -d
docker compose logs -f localstack   # esperar "Ready."

# Lambda local sin LocalStack (iteración rápida en :3001)
cd lambda && npm run build && npm start

# Build + deploy serverless a AWS
cd lambda && sam build && sam deploy --guided

# CodeGraph (index estructural)
codegraph status
codegraph explore "<query>"
```

---

## 7. IA Usage

Este proyecto se construyó con asistencia de IA para **validación y seguimiento en la implementación del proyecto**.

### Herramientas

- **Asistente**: opencode con modelos intercambiables según la fase (revisión, generación, búsqueda).
- **MCPs**:
  - `engram` — memoria persistente entre sesiones (decisiones de scope, invariantes, patrones arquitectónicos).
  - `codegraph` — análisis estructural del código (preguntas sobre archivos, call paths, blast radius).
  - `context7` — consulta de documentación actualizada de librerías.
- **Skills SDD** (Spec-Driven Development): `sdd-init`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`.
- **Skill `tolkien`**: redacción de las HUs a partir de contenido aprobado por el humano.

### Metodología aplicada

- Lectura de `prueba-tecnica.md` para extraer 4 features: `auth`, `tablero-notas`, `dashboard-metrics`, `admin-usuarios`.
- Por cada feature, walkthrough guiado de **9 secciones** con el humano: Bloqueos y dependencias, Variables y configuración, Assumptions, Out of Scope, Happy Path, Sad Paths, Edge Cases, Stupid Cases, Criterios de aceptación.
- **Validación humana en cada decisión**: nada se agregó al scope sin confirmación explícita del usuario.
- **Regla "explicit-only"**: solo lo que el documento técnico pide literalmente; cualquier adición (rate limit, logging, timeouts, 404 page, soft deletes, etc.) fue propuesta y aprobada por el usuario explícitamente antes de incluirse.
- **Push back documentado**: dos veces la IA rechazó cambios del usuario por contradecir el doc literal:
  - Mensajes distintos de error en login (romperían anti-enumeración).
  - Ownership en notas (contradice `prueba-tecnica.md §2`).

### Output verificable

Cuatro HUs escritas en `documents/` (fuente de verdad funcional):

| HU | Archivo | Tamaño | Criterios de aceptación |
|---|---|---|---|
| HU-01 auth | `documents/HU-01-auth.md` | 26 KB | 37 ACs |
| HU-02 tablero-notas | `documents/HU-02-tablero-notas.md` | 33 KB | 52 ACs |
| HU-03 dashboard-metrics | `documents/HU-03-dashboard-metrics.md` | 21 KB | 33 ACs |
| HU-04 admin-usuarios | `documents/HU-04-admin-usuarios.md` | 33 KB | 46 ACs |
| **Total** | | **~113 KB** | **168 ACs** |

Todos los ACs son binarios y verificables manualmente (no se agregaron tests automatizados por decisión del proyecto).

### Verificación de código implementado contra las HUs generadas

La IA también acompañó la **implementación del código** (backend + frontend) posterior a la documentación. Patrón usado:

1. **Una rama feature por HU-backend + frontend** desde `main`:
   ```
   feature/hu-01-auth-backend          → 5 commits atómicos
   feature/hu-02-tablero-backend      → 1 commit (deps HU-01)
   feature/hu-03-dashboard-metrics-backend → 1 commit (incluye fix de soft-delete en Lambda)
   feature/hu-04-admin-usuarios-backend → 2 commits (incluye fix de validación)
   feature/hu-01-auth-frontend        → 4 commits
   feature/hu-02-tablero-frontend     → 3 commits (incluye 2 fixes de bugs)
   feature/hu-03-dashboard-frontend   → 1 commit
   feature/hu-04-admin-frontend       → 1 commit
   ```

2. **Cada commit atómico** mapea a un paso discreto del proposal (sanctum install, middleware, controllers, etc.). Esto permite rollback selectivo si una parte rompe.

3. **Smoke tests contra el backend** después de cada cambio, vía `docker exec fixlat_backend curl ...`. Casos cubiertos:
   - HU-01: login OK con ambos demos, /me con token, logout, rate limit
   - HU-02: CRUD notas, lock optimista con `updated_at` stale (→ 409), soft delete
   - HU-03: Lambda fix verificado con conteo de notas reales (`{"total":4,"by_status":{"Pendiente":1,"En curso":2,"Hecho":1}}`)
   - HU-04: 3 vectores de la invariante del último admin cubiertos (desactivarse, cambiar rol, ambos)

4. **Bugs encontrados y corregidos durante la implementación**:
   - `.env` del backend ignoraba env vars de `docker-compose.yml` (sqlite por default). Fix: cambiar `DB_CONNECTION=pgsql` directo en `.env` local (no se commitea, es local).
   - PHP built-in server (`php artisan serve`) no procesa `HandleCors` para OPTIONS pre-flight en `/api/*`. Fix: shim manual en `public/index.php` + defaults hardcoded en `config/cors.php`. Ver `hu/cors-php-artisan-serve-gotcha` en Engram.
   - `App\Services\MetricsUnavailableException` no se encontraba — faltaba `use` en `MetricsService.php`. Fix: agregar import.
   - `ToggleActive` de HU-04 usaba `Request` en lugar de `FormRequest`, `validated()` no existía. Fix: usar `validate()` inline.
   - Seed demo `user123` (7 chars) violaba `min:8` que HU-01 agregó. Fix: cambiar a `user1234`.
   - `NoteEditor.handleSubmit` no preservaba `note.id` al construir el objeto a guardar → PUT a `/api/notes/undefined`. Fix: spread del `note` original.

5. **Validación final contra `prueba-tecnica.md`** (auditoría): las 4 features requeridas por el doc técnico están implementadas y operativas. Cobertura:
   - §1 Acceso y usuarios: ✅ login/logout, 2 roles, admin CRUD usuarios, estado activo/inactivo, ≥1 admin activo
   - §2 Tablero de notas: ✅ tablero único, sin columnas, todos pueden operar todas, atributos completos, soft delete, persistencia
   - §3 Dashboard: ✅ total + breakdown por estado, vía AWS Lambda
   - §4 Ejecución local y AWS: ✅ Docker Compose, LocalStack, sin cuenta AWS, template.yaml de SAM

### Decisiones arquitectónicas derivadas del walkthrough

- **Backend en capas**: `Request → Controller → Service → Model → Resource` por feature. Los Service concentran reglas de negocio (incluida la invariante del último admin activo).
- **Anti-enumeración firme en login**: mensaje genérico único para "email no existe" y "contraseña incorrecta"; distinción solo en logs internos.
- **Optimistic locking en edición de notas**: `PUT /api/notes/{id}` valida `updated_at`; mismatch → 409 con estado actual del servidor.
- **Invariante del último admin activo**: validada en backend con un único mensaje literal `"No se puede desactivar al último administrador activo."` aplicado a los 4 vectores de violación (auto-desactivación, cambio de rol, combinación, otros admins que afecten el conteo).
- **Bug fix de Lambda**: la query de `lambda/app.ts` no filtraba soft-deleted; se corrigió a `WHERE deleted_at IS NULL` (consistencia con HU-02 que sí usa `SoftDeletes`).
- **Timeouts HTTP transversales**: frontend 10s, backend → Lambda 5s.
- **CORS workaround para dev**: shim en `public/index.php` + defaults en `config/cors.php` para `php artisan serve`. En producción con nginx+php-fpm esto no es necesario.
- **Paginación, búsqueda, filtros, ownership, Realtime**: explícitamente descartados en cada HU por no estar en el doc.

### Persistencia de decisiones

Las decisiones de scope, las reglas del proyecto (scope estricto, sin tests, sin persistencia post-cierre), las invariantes y las excepciones aprobadas están guardadas en Engram con `topic_key`s estructurados (`hu/auth/*`, `hu/project-rules`, `hu/tablero-notes-ownership`, etc.). Futuras sesiones pueden consultar este historial sin repetir las discusiones.
