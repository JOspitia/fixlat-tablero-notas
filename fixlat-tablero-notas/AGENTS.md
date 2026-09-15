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
