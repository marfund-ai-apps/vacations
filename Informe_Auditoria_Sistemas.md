# Informe de Auditoría de Sistemas
## Sistema de Solicitud de Vacaciones — MAR Fund

> **Documento base para el equipo de Auditoría de Sistemas.**
> Describe la arquitectura, infraestructura, hosting, base de datos, automatización y repositorio de la aplicación de gestión de solicitudes de vacaciones/permisos de MAR Fund.
>
> **Versión del documento:** 1.0 · **Fecha:** 2026-09-06 · **Ámbito:** Producción en Easypanel (VPS Hostinger)
>
> ⚠️ **Confidencialidad:** Este documento describe topología e infraestructura. **No contiene contraseñas, secretos ni tokens.** Las credenciales viven exclusivamente en variables de entorno (`.env`) dentro de Easypanel y **no deben** copiarse aquí. Cuando se requiera un valor sensible, consultar el panel directamente con las personas autorizadas.

---

## 1. Resumen ejecutivo

| Concepto | Detalle |
|----------|---------|
| **Nombre** | Sistema de Solicitud de Vacaciones MAR Fund |
| **Tipo** | Aplicación web full-stack (SPA + API REST) |
| **Propósito** | Gestión de solicitudes de vacaciones, permisos, ausencias justificadas y bono por antigüedad, con aprobación por supervisor y automatización de correos |
| **Autenticación** | Google OAuth 2.0 (solo cuentas `@marfund.org`) |
| **Hosting** | VPS (Hostinger) administrado con **Easypanel** |
| **Orquestación** | Easypanel (proyecto `marfund-ia`) — 4 servicios |
| **Automatización de correos** | N8N (webhooks) |
| **Repositorio** | GitHub — `marfund-ai-apps/vacations` (rama `main`) |
| **Base de datos** | MySQL 8.0+ (`marfund-vacations-ai`) |
| **Zona horaria operativa** | `America/Guatemala` (UTC-6) |

---

## 2. Arquitectura general

```
                        Internet (usuarios @marfund.org)
                                   │
                                   ▼
                   ┌─────────────────────────────────┐
                   │   Easypanel (reverse proxy /     │
                   │   Traefik + TLS Let's Encrypt)   │
                   │        VPS Hostinger             │
                   └───────────────┬─────────────────┘
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                            ▼
┌───────────────┐        ┌──────────────────┐          ┌───────────────┐
│  FRONTEND     │  API   │   BACKEND        │   SQL     │   MySQL 8.0   │
│ vacations-app │──────► │  vacations-app   │─────────► │ marfund-      │
│ -frontend     │        │  (Express :3001) │          │ vacations-ai  │
│ (static :3000)│        └────────┬─────────┘          │  :3306        │
└───────────────┘                 │ webhooks           └───────────────┘
                                   ▼
                          ┌──────────────────┐
                          │       N8N        │  ──► Gmail (envío de correos)
                          │ (automatización) │
                          └──────────────────┘
```

**Flujo de una solicitud:**
1. El colaborador crea una solicitud en el frontend → el backend genera `VAC-YYYY-NNNN`, guarda en MySQL y dispara el webhook `N8N_WEBHOOK_NEW_REQUEST`.
2. N8N envía un correo combinado a colaborador + supervisor (+ RRHH) con un botón hacia `/pending-approvals`.
3. El supervisor aprueba/rechaza desde el portal → el backend dispara `N8N_WEBHOOK_DECISION` → N8N notifica la decisión.

---

## 3. Infraestructura de hosting — Easypanel

- **Panel:** Easypanel sobre el VPS.
- **Host del panel / apps:** subdominio `*.9867lv.easypanel.host` (ej. N8N publicado en `marfund-ia-n8n.9867lv.easypanel.host`).
- **Proyecto:** `marfund-ia`.
- **Reverse proxy:** Easypanel usa Traefik internamente; termina TLS (Let's Encrypt) y enruta por dominio a cada servicio. El backend confía en el proxy (`app.set('trust proxy', 1)`) para que las cookies de sesión `Secure` funcionen detrás de HTTPS.

### 3.1 Servicios en el proyecto `marfund-ia`

| Servicio (Easypanel) | Rol | Puerto interno | Notas |
|----------------------|-----|----------------|-------|
| **vacations-app** | Backend API (Node/Express) | `3001` | Escucha en `0.0.0.0`. Corre los cron jobs. |
| **vacations-app-frontend** | Frontend estático (build de Vite) | `3000` | Sirve `dist/`; en logs: *"Accepting connections at http://localhost:3000"*. |
| **n8n** | Automatización de correos | `5678` | Publicado en `marfund-ia-n8n.9867lv.easypanel.host`. |
| **gestion_vacaciones_ai** | Servicio de base de datos MySQL *(a confirmar en el panel)* | `3306` | Contenedor de datos / MySQL del proyecto. **Verificar en Easypanel → Service → tipo.** |

> **Acción de auditoría:** confirmar en Easypanel el tipo exacto y la imagen de cada servicio (App vs. Database vs. Compose), los dominios asignados en cada pestaña **Domains**, y las variables en **Environment**.

### 3.2 Dominios (verificar en Easypanel → cada servicio → Domains)

| Componente | Dominio conocido | Estado |
|------------|------------------|--------|
| Frontend (app) | `https://app-vacations.marfund.org` | Confirmado (usado en links de correo N8N) |
| Backend API | `VITE_API_URL` del frontend en producción | **Confirmar** (probable subdominio API o `…/api` vía proxy) |
| N8N | `https://marfund-ia-n8n.9867lv.easypanel.host` | Confirmado |

---

## 4. Infraestructura Backend

| Atributo | Valor |
|----------|-------|
| **Runtime** | Node.js (CommonJS) |
| **Framework** | Express.js 5 |
| **Puerto** | `3001` (`process.env.PORT`) |
| **Entry point** | `backend/server.js` |
| **Base de datos** | MySQL vía `mysql2` (pool, máx. 10 conexiones) — `backend/config/db.js` |
| **Sesiones** | `express-session` con store en MySQL (`express-mysql-session` / `connect-mysql2`); cookies |
| **Auth** | `passport` + `passport-google-oauth20` (`backend/config/passport.js`) |
| **Seguridad** | `helmet`, `cors` (con `credentials`) |
| **Uploads** | `multer` (carga CSV de saldos) |
| **Excel** | `xlsx` (SheetJS) — lectura de CSV/XLSX en importación |
| **Cron** | `node-cron` (zona `America/Guatemala`) |

### 4.1 Dependencias backend (`backend/package.json`)
`axios`, `connect-mysql2`, `cors`, `dotenv`, `express`, `express-mysql-session`, `express-session`, `helmet`, `multer`, `mysql2`, `node-cron`, `passport`, `passport-google-oauth20`, `xlsx`. Dev: `nodemon`.

### 4.2 Scripts
- `npm start` → `node server.js` (producción)
- `npm run dev` → `nodemon server.js` (desarrollo)

### 4.3 Variables de entorno (backend `.env`) — **solo nombres**
`NODE_ENV`, `PORT`, `APP_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET`, `N8N_BASE_URL`, `N8N_WEBHOOK_NEW_REQUEST`, `N8N_WEBHOOK_DECISION`.

> ⚠️ **Hallazgo:** en producción, `APP_URL` y `GOOGLE_CALLBACK_URL` deben apuntar a los dominios HTTPS reales (no `localhost`). El `.env` de desarrollo del repo trae `localhost`; **verificar los valores efectivos en Easypanel → vacations-app → Environment.**

### 4.4 Cron jobs (todos en `America/Guatemala`)

| Job | Archivo | Schedule | Acción |
|-----|---------|----------|--------|
| Incremento mensual | `jobs/monthlyVacationIncrement.js` | `0 1 1 * *` (día 1, 01:00) | Inserta `monthly_auto` (1.25 días) por usuario activo. **No** toca `base_vacation_days`. |
| Reset anual bono antigüedad | `jobs/annualBenefitReset.js` | `5 6 1 1 *` (1 ene) | `benefit_extra_day_used = 0` a elegibles. |
| Recalcular días beneficio (años laborales) | `jobs/recalcBeneficioAnios.js` | `0 2 1 1 *` (1 ene, 02:00) | Recalcula `dias_beneficio_anno_laboral`. |

### 4.5 Rutas API principales

| Prefijo | Archivo | Descripción |
|---------|---------|-------------|
| `/api/auth` | `routes/authRoutes.js` | Flujo Google OAuth, logout, `GET /me` |
| `/api/requests` | `routes/requestRoutes.js` | Crear/listar/aprobar/rechazar/anular; token público |
| `/api/users` | `routes/userRoutes.js` | CRUD usuarios, ajustes de días, importación CSV |
| `/api/reports` | `routes/reportRoutes.js` | Reportes individual, general y detalle de colaborador |

---

## 5. Infraestructura Frontend

| Atributo | Valor |
|----------|-------|
| **Framework** | React 19 |
| **Bundler** | Vite 7 |
| **Estilos** | Tailwind CSS 4 (`@tailwindcss/postcss`, `@tailwindcss/vite`) |
| **Ruteo** | React Router 7 |
| **HTTP** | Axios (instancia con `VITE_API_URL`, `withCredentials`) |
| **Exportar Excel** | `xlsx` (SheetJS) cargado por **dynamic import** (chunk aparte) |
| **Servido** | Estático (`dist/`) en puerto `3000` dentro de Easypanel |

### 5.1 Scripts
- `npm run dev` → servidor Vite (puerto 5173 en local)
- `npm run build` → genera `dist/` (producción)
- `npm run preview` → previsualiza el build
- `npm run lint` → ESLint

### 5.2 Variables de entorno (frontend `.env`)
- `VITE_API_URL` → base URL de la API (ej. `https://<backend>/api`). **Confirmar valor de producción.**

> ⚠️ **Nota de despliegue:** el frontend se compila (`npm run build`) y se sirve el `dist/`. Al **agregar dependencias** (ej. `xlsx`) es obligatorio `npm install` antes del build, o el build falla.

---

## 6. Base de datos

| Atributo | Valor |
|----------|-------|
| **Motor** | MySQL 8.0+ |
| **Host** | `147.93.46.144` |
| **Puerto** | `3306` |
| **Base** | `marfund-vacations-ai` |
| **Usuario app** | `dbmarfund` |
| **Acceso** | Sin ORM — SQL crudo vía `mysql2` |
| **sql_mode** | `ONLY_FULL_GROUP_BY` **activo** en producción |
| **Zona horaria** | Pool con `timezone: 'Z'` (interpreta TIMESTAMP como UTC) y `dateStrings: ['DATE']` (evita corrimiento en fechas DATE) |

### 6.1 Tablas principales

| Tabla | Rol |
|-------|-----|
| `users` | Colaboradores; `manager_id` auto-referenciado; `base_vacation_days`, `employee_number`, `fecha_ingreso`, `dias_beneficio_anno_laboral` |
| `vacation_requests` | Solicitudes; `status` (pending/approved/rejected/cancelled/annulled), `request_type` (vacation/permission/justified_absence/seniority_benefit), `split_group_id` (auto-split base+bono), campos de anulación |
| `request_date_ranges` | Rangos de fechas; `business_days DECIMAL(5,2)` (soporta medio día) |
| `request_history` | Auditoría de solicitudes |
| `user_day_adjustments` | Movimientos de días; `adjustment_type` (manual/monthly_auto/initial_balance); numeración `VAC-YYYY-NNNN` |
| `approval_tokens` | Links de aprobación (7 días); `action` = approve/reject |
| *(session store)* | Tabla de sesiones de `express-mysql-session` |

- **Vista:** `v_employee_days_summary` — agrega días aprobados por colaborador/año.
- **DDL de referencia:** `database/schema.sql`. Respaldos/exportes: `database/marfund-vacations-ai-*.sql`.
- **Regla de negocio clave:** solo `vacation` aprobada descuenta saldo; `permission`, `justified_absence` y `seniority_benefit` son informativas (no descuentan la base).

### 6.2 Respaldos
> **Acción de auditoría:** verificar si existe respaldo automático de MySQL (cron/dump) o snapshots del VPS. Documentar frecuencia, retención y ubicación. **Actualmente los dumps `.sql` en `/database` son manuales.**

---

## 7. Automatización — N8N

| Atributo | Valor |
|----------|-------|
| **Servicio** | `n8n` (Easypanel), puerto `5678` |
| **URL** | `https://marfund-ia-n8n.9867lv.easypanel.host` |
| **Webhooks** | `nueva-solicitud`, `decision-aprobacion` |
| **Salida** | Nodos Gmail (correo a colaborador, supervisor, RRHH) |

- Los workflows exportados están versionados en el repo (`backend/` / carpeta de workflows N8N).
- El backend envía **todos los datos** en el payload (correo de empleado, supervisor y RRHH). **Ya no** depende de Google Sheets.
- El workflow "Decisión Final" agrega CC a `recursoshumanos@marfund.org` solo cuando la decisión es `approved`.

> ⚠️ **Hallazgo importante:** en el `.env` los webhooks apuntan a rutas `/webhook-test/...` (modo **test** de N8N, que solo escucha con el editor abierto). En **producción** deben ser `/webhook/...` (modo *Active*). **Verificar y corregir en Easypanel → vacations-app → Environment.**

---

## 8. Repositorio — GitHub

| Atributo | Valor |
|----------|-------|
| **Repositorio** | `github.com/marfund-ai-apps/vacations` |
| **Rama de despliegue** | `main` |
| **Estructura** | `backend/`, `frontend/`, `database/`, `plans/` |
| **CI/CD** | **No hay pipeline automatizado** (sin GitHub Actions). Despliegue manual: `git pull` en el servidor + reinicio del backend + `npm install`/`npm run build` del frontend. |

> ⚠️ **Hallazgo de seguridad:** el remoto de git incluía un **Personal Access Token (PAT) embebido en la URL** (`https://<token>@github.com/...`). Recomendación: rotar ese token y migrar a **Deploy Key SSH** o a la **integración Git nativa de Easypanel**, para no exponer credenciales en la config local de git.

---

## 9. Seguridad y control de acceso

- **Autenticación:** Google OAuth 2.0. Solo `@marfund.org` se auto-registran. Sin contraseñas locales.
- **Sesiones:** cookies con store en MySQL (permiten invalidación inmediata); `Secure` detrás del proxy TLS.
- **Roles (4):** `employee`, `manager`, `hr_admin`, `super_admin`. Middlewares `authMiddleware.js` (isAuthenticated) y `roleMiddleware.js` (requireRole).
- **Headers:** `helmet` activo.
- **Aprobación por link:** tokens de 7 días para aprobar/rechazar sin login (endpoint público `/api/requests/token/:token`).

### 9.1 Resumen de hallazgos (para seguimiento)

| # | Hallazgo | Severidad | Recomendación |
|---|----------|-----------|---------------|
| H1 | Webhooks N8N en modo `/webhook-test/` | Alta | Cambiar a `/webhook/` (Active) en producción |
| H2 | PAT de GitHub embebido en la URL del remoto | Alta | Rotar token; usar Deploy Key SSH / Git de Easypanel |
| H3 | MySQL accesible por IP pública `147.93.46.144:3306` | Media/Alta | Restringir por firewall a la red interna de Easypanel; evitar exposición pública |
| H4 | Sin CI/CD ni respaldos automáticos documentados | Media | Automatizar dumps MySQL + pipeline de despliegue |
| H5 | `.env` de repo con valores `localhost` | Baja | Confirmar que producción usa dominios HTTPS reales (no confundir con dev) |

---

## 10. Matriz de checklist para el auditor

- [ ] Confirmar tipo/imagen de cada servicio en Easypanel (`marfund-ia`).
- [ ] Verificar dominios y certificados TLS de frontend, backend y N8N.
- [ ] Revisar `Environment` de cada servicio (webhooks Active, URLs HTTPS, callback OAuth).
- [ ] Validar política de respaldos de MySQL y del VPS (frecuencia/retención).
- [ ] Rotar el PAT de GitHub y migrar a Deploy Key / Git de Easypanel.
- [ ] Confirmar reglas de firewall del puerto 3306 (no exposición pública).
- [ ] Revisar logs y consumo (CPU/memoria/IO) por servicio.
- [ ] Documentar responsables/accesos (quién administra Easypanel, DNS de `marfund.org`, cuenta de Google Cloud del OAuth).

---

## 11. Nota extensa — Recomendaciones para migrar la aplicación a otro VPS

> Esta sección es una **guía de contingencia** para trasladar toda la aplicación a un VPS distinto (por costo, rendimiento, proveedor o continuidad del negocio). Está pensada para minimizar tiempo de inactividad y evitar pérdida de datos.

### 11.1 Antes de empezar — inventario y prerequisitos

Reunir y documentar (idealmente en un gestor de secretos, **no** en texto plano):

1. **Accesos:** credenciales del panel Easypanel actual y del nuevo VPS (SSH root), acceso al DNS de `marfund.org`, acceso a la consola de **Google Cloud** (proyecto del OAuth), y acceso al repositorio GitHub.
2. **Variables de entorno completas** de los 3 servicios de aplicación (backend, frontend, n8n). Exportarlas del Easypanel actual (**Environment** de cada servicio).
3. **Dump reciente de la base de datos** (`mysqldump`).
4. **Export de los workflows de N8N** (JSON) y sus **credenciales** (las credenciales de N8N están cifradas con una clave; ver 11.5).
5. **Registro de dominios y TLS** actuales.

**Requisitos del nuevo VPS:** recursos iguales o mayores (CPU/RAM/disco), Docker + Easypanel instalados (o el orquestador elegido), y puertos 80/443 abiertos. Recomendado: mismo esquema Easypanel para reducir fricción.

### 11.2 Estrategia general (blue-green / cutover con DNS)

Migrar **sin apagar** el entorno viejo hasta validar el nuevo:

1. Montar el nuevo VPS **en paralelo** con toda la stack.
2. Restaurar datos y configurar servicios en el nuevo entorno.
3. Probar el nuevo entorno con dominios temporales (`*.easypanel.host` del nuevo panel).
4. **Bajar el TTL del DNS** de `app-vacations.marfund.org` (y demás) a 300s **24–48 h antes** del cutover.
5. Poner el sistema viejo en **modo mantenimiento** (breve) para un dump final consistente.
6. Restaurar el dump final en el nuevo VPS.
7. **Apuntar el DNS** al nuevo VPS. Esperar propagación.
8. Validar. Mantener el VPS viejo **en espera** unos días como rollback.

### 11.3 Migración de la base de datos (paso crítico)

En el VPS **origen**:
```bash
# Dump completo con rutinas, triggers y eventos
mysqldump -u dbmarfund -p \
  --single-transaction --routines --triggers --events \
  marfund-vacations-ai > marfund_vacations_ai_$(date +%Y%m%d).sql
```
En el VPS **destino** (tras crear la base y el usuario):
```bash
mysql -u root -p -e "CREATE DATABASE \`marfund-vacations-ai\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'dbmarfund'@'%' IDENTIFIED BY '<nueva_password>'; \
  GRANT ALL PRIVILEGES ON \`marfund-vacations-ai\`.* TO 'dbmarfund'@'%'; FLUSH PRIVILEGES;"
mysql -u dbmarfund -p marfund-vacations-ai < marfund_vacations_ai_YYYYMMDD.sql
```
**Verificaciones post-restauración:**
- Confirmar `sql_mode` con `ONLY_FULL_GROUP_BY` (mantener consistencia con producción).
- Confirmar versión **MySQL 8.0+** (evitar downgrade).
- Revisar zona horaria del servidor MySQL; la app ya normaliza con `timezone:'Z'` y `dateStrings:['DATE']`, así que **no cambiar** esos flags del pool.
- Validar la vista `v_employee_days_summary` y los conteos de filas por tabla (comparar origen vs. destino).
- **Seguridad:** en el nuevo VPS, **no** exponer 3306 públicamente. Usar red interna de Easypanel o firewall que solo permita al backend.

### 11.4 Migración del Backend

1. Crear el servicio (App) en el nuevo Easypanel, apuntando al repo `marfund-ai-apps/vacations` (carpeta `backend/`) o a una imagen.
2. Copiar **todas** las variables de entorno. **Actualizar las que cambian:**
   - `DB_HOST` → host de MySQL en el nuevo entorno (nombre del servicio interno, no la IP pública).
   - `APP_URL` → dominio HTTPS del frontend nuevo.
   - `GOOGLE_CALLBACK_URL` → nuevo dominio del backend (**y registrarlo en Google Cloud**, ver 11.6).
   - `N8N_BASE_URL`, `N8N_WEBHOOK_*` → nuevas URLs de N8N (en modo **Active**, no test).
   - `SESSION_SECRET` → puede conservarse; si se cambia, se invalidan las sesiones activas (los usuarios re-inician sesión).
3. Mantener `app.set('trust proxy', 1)` (Easypanel sigue usando proxy TLS).
4. Arrancar y revisar logs: conexión a MySQL OK y arranque de los 3 cron jobs.

### 11.5 Migración de N8N (¡cuidado con las credenciales!)

- Exportar workflows (JSON) y **credenciales** desde el N8N origen.
- **Clave de cifrado:** N8N cifra las credenciales con `N8N_ENCRYPTION_KEY`. Para que las credenciales exportadas funcionen en el destino, **el nuevo N8N debe usar la MISMA `N8N_ENCRYPTION_KEY`** que el origen. Copiarla de las variables del N8N viejo. Si no se conserva, habrá que **volver a crear** las credenciales de Gmail manualmente.
- Reconectar la cuenta de Gmail (OAuth de Google) si el consentimiento estaba atado al dominio anterior.
- Reactivar los webhooks en modo **Active** y actualizar sus URLs en el `.env` del backend.
- Probar un envío real de correo de punta a punta.

### 11.6 Google OAuth (autenticación)

En **Google Cloud Console → Credentials → OAuth client**:
- Agregar a **Authorized redirect URIs** el nuevo `GOOGLE_CALLBACK_URL` (`https://<nuevo-backend>/api/auth/google/callback`).
- Agregar el nuevo dominio del frontend a **Authorized JavaScript origins** si aplica.
- Mantener ambos (viejo y nuevo) durante la transición y quitar el viejo tras el cutover.

### 11.7 Migración del Frontend

1. Crear el servicio estático en el nuevo Easypanel (repo `frontend/`).
2. Ajustar `VITE_API_URL` al **nuevo dominio del backend** (recordar que es una variable de **build-time**: hay que **reconstruir** `dist/` tras cambiarla).
3. `npm install` (incluye `xlsx`) + `npm run build` + servir `dist/`.

### 11.8 DNS, dominios y TLS

- Actualizar los registros A/CNAME de `app-vacations.marfund.org` (y del backend/N8N si tienen subdominio propio) hacia la IP del nuevo VPS.
- Dejar que Easypanel emita los **certificados Let's Encrypt** en el nuevo entorno (requiere que el DNS ya apunte al nuevo servidor y los puertos 80/443 abiertos).
- Bajar el TTL antes del cambio (11.2) para acelerar la propagación.

### 11.9 Validación post-migración (checklist)

- [ ] Login con Google (`@marfund.org`) funciona y crea sesión.
- [ ] Crear una solicitud de prueba → llega el **correo** (N8N Active).
- [ ] Aprobar/rechazar desde el portal → llega el correo de decisión (CC RRHH en approved).
- [ ] Dashboard y reportes muestran cifras correctas (saldos base y bono).
- [ ] Exportar Excel del historial de un colaborador.
- [ ] Cron jobs registrados en logs al arrancar el backend.
- [ ] Importación masiva de saldos (CSV) responde.
- [ ] Anulación de solicitud (super_admin) devuelve días correctamente.
- [ ] Zonas horarias correctas (fechas en UTC-6 en UI y correos).

### 11.10 Plan de rollback

- No borrar el VPS viejo hasta **5–7 días** después del cutover y con validación completa.
- Si algo falla críticamente: **revertir el DNS** al VPS viejo (por eso se bajó el TTL). Como el viejo siguió activo, el retorno es inmediato.
- Conservar el **dump final** en al menos dos ubicaciones (nuevo VPS + almacenamiento externo).

### 11.11 Riesgos comunes a vigilar

| Riesgo | Mitigación |
|--------|-----------|
| Pérdida de credenciales N8N | Conservar `N8N_ENCRYPTION_KEY`; si no, recrear credenciales Gmail |
| OAuth roto tras migrar | Registrar nuevo `redirect_uri` en Google Cloud **antes** del cutover |
| `VITE_API_URL` viejo cacheado | Reconstruir `dist/` y forzar recarga (Ctrl+Shift+R) |
| Webhooks en modo test | Poner N8N en **Active** y actualizar `.env` |
| MySQL expuesto | Firewall / red interna; nunca 3306 público |
| Diferencia de versión MySQL | Usar 8.0+ en destino; nunca downgrade |
| Desfase de datos en el cutover | Modo mantenimiento breve + dump final consistente |

---

*Fin del informe. Mantener este documento actualizado ante cualquier cambio de infraestructura, dominios o proveedor.*
