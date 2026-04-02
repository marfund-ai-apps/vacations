# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sistema de Solicitud de Vacaciones MAR Fund** — A full-stack vacation/leave request management system with Google OAuth authentication, role-based access control, and email automation via N8N webhooks.

## Commands

### Backend (runs on port 3001)
```bash
cd backend
npm run dev      # Start with nodemon (hot reload)
npm start        # Start production server
```

### Frontend (runs on port 5173)
```bash
cd frontend
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### No test suite is configured. Backend has a placeholder test script; frontend has ESLint only.

## Architecture

### Stack
- **Backend**: Express.js 5 + MySQL 2 (promise pool, raw SQL — no ORM) + Passport.js (Google OAuth 2.0) + express-session (MySQL session store) + node-cron (scheduled jobs)
- **Frontend**: React 19 + Vite + Tailwind CSS 4 + React Router 7 + Axios
- **Automation**: N8N webhook workflows for email notifications

### Request Lifecycle
1. Employee submits request → backend generates `VAC-YYYY-NNNN` number, creates approval tokens, triggers `N8N_WEBHOOK_NEW_REQUEST`
2. Manager approves/rejects via portal or email link (public `/api/requests/token/:token` endpoint)
3. Decision triggers `N8N_WEBHOOK_DECISION` → N8N sends notification emails

### Authentication & Authorization
- Google OAuth 2.0 via Passport; session-based (cookies with MySQL store)
- 4 roles: `employee`, `manager`, `hr_admin`, `super_admin`
- Backend enforces roles via `middleware/authMiddleware.js` (isAuthenticated) + `middleware/roleMiddleware.js` (requireRole)
- Frontend uses `AuthContext` + `ProtectedRoute` wrapper; Axios interceptor auto-redirects to `/login` on 401

### API Routes
| Prefix | File | Notes |
|--------|------|-------|
| `/api/auth` | `routes/authRoutes.js` | Google OAuth flow, logout, `GET /me` |
| `/api/requests` | `routes/requestRoutes.js` | Create, list, approve/reject; public token endpoint |
| `/api/users` | `routes/userRoutes.js` | Manager list, user CRUD (admin only), day adjustments |
| `/api/reports` | `routes/reportRoutes.js` | Employee and aggregate reports |

### Day Adjustment Endpoints (Req 3 — 02/04/2026)
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `GET` | `/api/users/:id/day-adjustments` | any authenticated | Historial de ajustes del usuario |
| `POST` | `/api/users/:id/day-adjustments` | `manager`, `hr_admin`, `super_admin` | Agregar días manualmente |

### Database Schema (MySQL 8.0+)
Key tables:
- `users` — self-referencing `manager_id`; `base_vacation_days DECIMAL(5,2)` (soporta medios días y decimales)
- `vacation_requests` — status: pending/approved/rejected/cancelled
- `request_date_ranges` — `business_days DECIMAL(5,2)`, soporta 0.5 (medio día)
- `request_history` — audit trail ligado a solicitudes
- `user_day_adjustments` — registro de todos los movimientos de días (manuales y automáticos); campo `adjustment_number VARCHAR(20)` con formato `VAC-YYYY-NNNN` unificado con las solicitudes
- `approval_tokens` — 7-day email links; enum `action` usa `'approve'`/`'reject'` (NO `'approved'`/`'rejected'`)

View: `v_employee_days_summary` aggregates approved days per employee/year.

### Numeración unificada VAC-YYYY-NNNN
El contador `VAC-` es compartido entre `vacation_requests` y `user_day_adjustments`. La función `generateAdjustmentNumber()` en `userController.js` suma el COUNT de ambas tablas para obtener el siguiente número. Esto permite un tracking cronológico unificado de todos los movimientos.

### Cron Job — Incremento mensual automático
- Archivo: `backend/jobs/monthlyVacationIncrement.js`
- Schedule: `0 1 1 * *` (día 1 de cada mes a la 1:00am, zona horaria `America/Guatemala`)
- Acción: suma `1.25` días a `users.base_vacation_days` de todos los usuarios activos e inserta un registro en `user_day_adjustments` por cada usuario con `adjustment_type = 'monthly_auto'`
- Se registra en consola: `[CRON] Incremento mensual completado para N usuario(s)`
- Se inicia en `server.js` dentro del callback de `app.listen`

### Sistema de colores (movimientos de días)
| Color | Evento |
|-------|--------|
| **Verde** | Incremento automático mensual o ajuste manual — número `VAC-` en verde |
| **Rojo** | Solicitud de vacaciones/permiso aprobada — días descontados, número `VAC-` en rojo |

Aplica en: Dashboard (sección "Movimientos de Días"), `MyRequests.jsx`, `AllRequests.jsx`.

### Frontend State
- `AuthContext` / `useAuth()` hook — global user and auth state
- `src/services/api.js` — Axios instance con base URL desde `VITE_API_URL` y credentials enabled
- `src/utils/dateUtils.js` — utilitario centralizado de fechas: `formatDate()` (dd/mm/yyyy) y `formatDateTime()` (dd/mm/yyyy, HH:mm), ambos en locale `es-GT` y timezone `America/Guatemala` (UTC-6)

### Frontend Routes
All routes are implemented. Role-gated routes:
- Public (authenticated): `/dashboard`, `/new-request`, `/my-requests`, `/pending-approvals`, `/reports`, `/profile`
- `hr_admin` + `super_admin` only: `/admin`, `/all-requests`
- `super_admin` only: `/admin/inactive`

## Key Design Decisions

1. **Google OAuth only** — No passwords. Only `@marfund.org` accounts are auto-registered on first login.
2. **Sessions (cookies) over JWT** — Stateful sessions stored in MySQL allow immediate session invalidation. No refresh token complexity.
3. **Roles default to `employee`** — Higher roles must be granted manually via DB. No self-service role upgrade.
4. **Email via N8N, not Nodemailer** — Email logic fully delegated to N8N so HR staff can modify templates without touching code.
5. **Magic link approvals** — Managers receive email links with one-time tokens (`/api/requests/token/:token` is public).
6. **Day balance computed in Node.js** — `reportController.js` calcula el balance: `base_vacation_days + SUM(user_day_adjustments.days_added) - consumed_days`. La vista `v_employee_days_summary` existe pero el dashboard usa queries directas para mayor control.
7. **N8N reads manager email from Google Sheets** — `workflow_nueva_solicitud` looks up the manager's contact before sending approval email.
8. **Medio día (0.5)** — El checkbox "Solo medio día" en `NewRequest.jsx` resta 0.5 al último día del rango. `business_days` es `DECIMAL(5,2)` en DB y frontend.
9. **Fechas siempre en UTC-6** — Todo `toLocaleDateString`/`toLocaleString` pasa por `dateUtils.js` con `timeZone: 'America/Guatemala'`. Nunca llamar `toLocaleDateString()` sin locale directamente en los componentes.

## Known Issues & Gotchas

- **Tailwind v4 PostCSS**: Requiere `@tailwindcss/postcss` como plugin PostCSS — NOT the standard `tailwindcss` plugin. Verificar `postcss.config.js` e `index.css` si el CSS se rompe.
- **Remote DB firewall (Easypanel/Hostinger)**: Conexiones locales al MySQL remoto `147.93.46.144:3306` pueden dar `ETIMEDOUT`. Solución: abrir puerto 3306 en Hostinger o usar MySQL local para desarrollo.
- **Zombie nodemon processes**: Si el puerto está en uso tras un fallo, matar el proceso nodemon anterior.
- **approval_tokens.action enum**: Los valores válidos son `'approve'` y `'reject'` (sin `-d`). El campo `vacation_requests.status` sí usa `'approved'`/`'rejected'`. No confundirlos.
- **MySQL ONLY_FULL_GROUP_BY**: El servidor MySQL en producción tiene este modo activo. Nunca mezclar `SUM()` u otras funciones de agregación con columnas no agrupadas en la misma query SELECT.

## Environment Variables

**Backend** (`backend/.env`): `PORT`, `APP_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET`, `N8N_BASE_URL`, `N8N_WEBHOOK_NEW_REQUEST`, `N8N_WEBHOOK_DECISION`

**Frontend** (`frontend/.env`): `VITE_API_URL` (e.g. `http://localhost:3001/api`)

See `.env.example` (root) for the full template with Spanish comments.

## Key Files
- `backend/server.js` — Express app entry point; registra el cron job al arrancar
- `backend/config/db.js` — MySQL connection pool (max 10 connections)
- `backend/config/passport.js` — Google OAuth strategy with auto user creation
- `backend/services/n8nService.js` — N8N webhook integration
- `backend/jobs/monthlyVacationIncrement.js` — Cron job incremento 1.25 días mensual
- `backend/controllers/userController.js` — incluye `generateAdjustmentNumber()`, `addDayAdjustment()`, `getDayAdjustments()`
- `backend/controllers/reportController.js` — `getMyReport()` retorna `summary`, `history` y `adjustments`
- `frontend/src/App.jsx` — Route definitions
- `frontend/src/context/AuthContext.jsx` — Global auth state
- `frontend/src/utils/dateUtils.js` — Formateo centralizado de fechas (dd/mm/yyyy, UTC-6)
- `database/schema.sql` — Full DDL con todas las tablas incluyendo `user_day_adjustments`
- `plans/` — Planes de desarrollo, guías y documentación de apoyo
