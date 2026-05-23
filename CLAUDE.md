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
- **Backend**: Express.js 5 + MySQL 2 (promise pool, raw SQL — no ORM) + Passport.js (Google OAuth 2.0) + express-session (MySQL store) + node-cron + multer + xlsx (SheetJS)
- **Frontend**: React 19 + Vite + Tailwind CSS 4 + React Router 7 + Axios + Inter (Google Font)
- **Automation**: N8N webhook workflows for email notifications

### Terminología en UI
- **Colaborador** — término visible en UI (internamente sigue siendo `employee` en la DB y enums)
- **Supervisor** — término visible para el jefe inmediato (`manager` en DB)
- Los valores de enum (`employee`, `vacation`, `approved`, etc.) **no cambian**; solo cambian textos de interfaz

### Request Lifecycle
1. Colaborador envía solicitud → backend genera número `VAC-YYYY-NNNN`, crea tokens de aprobación, dispara `N8N_WEBHOOK_NEW_REQUEST`
2. Supervisor aprueba/rechaza desde el portal o por link de correo (endpoint público `/api/requests/token/:token`)
3. La decisión dispara `N8N_WEBHOOK_DECISION` → N8N envía correos de notificación

### Regla de descuento de días
- **Solo `request_type = 'vacation'` aprobada descuenta días** del saldo del colaborador
- `permission`, `justified_absence` y `seniority_benefit` aprobadas **no descuentan** — se registran como informativas
- `seniority_benefit` aparece en ámbar en la UI; `permission`/`justified_absence` en gris
- Esta regla aplica en `reportController.js` (queries de `getMyReport` y `getAllEmployeesReport`) y en `Dashboard.jsx` (timeline de movimientos)

### Authentication & Authorization
- Google OAuth 2.0 via Passport; sesiones basadas en cookies con MySQL store
- 4 roles: `employee`, `manager`, `hr_admin`, `super_admin`
- Backend: `middleware/authMiddleware.js` (isAuthenticated) + `middleware/roleMiddleware.js` (requireRole)
- Frontend: `AuthContext` + `ProtectedRoute`; interceptor Axios redirige a `/login` en 401

### API Routes
| Prefix | File | Notes |
|--------|------|-------|
| `/api/auth` | `routes/authRoutes.js` | Google OAuth flow, logout, `GET /me` |
| `/api/requests` | `routes/requestRoutes.js` | Crear, listar, aprobar/rechazar; endpoint público de token |
| `/api/users` | `routes/userRoutes.js` | CRUD usuarios (admin), ajustes de días, importación CSV |
| `/api/reports` | `routes/reportRoutes.js` | Reportes individuales, general y detalle del colaborador |

### Endpoints de días y reportes
| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `GET` | `/api/users/:id/day-adjustments` | any authenticated | Historial de ajustes del usuario |
| `POST` | `/api/users/:id/day-adjustments` | `manager`, `hr_admin`, `super_admin` | Agregar días manualmente |
| `POST` | `/api/users/preview-balances` | `hr_admin`, `super_admin` | Previsualización de saldos desde CSV (sin guardar) |
| `POST` | `/api/users/import-balances` | `hr_admin`, `super_admin` | Carga masiva de saldos desde CSV |
| `GET` | `/api/reports/employee-report` | any authenticated | Dashboard personal |
| `GET` | `/api/reports/employee/:id` | `manager`, `hr_admin`, `super_admin` | Reporte individual |
| `GET` | `/api/reports/employee/:id/detail` | `manager`, `hr_admin`, `super_admin` | Historial unificado del colaborador |
| `GET` | `/api/reports/all` | `hr_admin`, `super_admin` | Reporte general de todos los colaboradores |

### Database Schema (MySQL 8.0+)
Key tables:
- `users` — self-referencing `manager_id`; `base_vacation_days DECIMAL(5,2)`; `employee_number VARCHAR(50)` = Código Colaborador
- `vacation_requests` — status: pending/approved/rejected/cancelled; `request_type`: vacation/permission/justified_absence/seniority_benefit
- `request_date_ranges` — `business_days DECIMAL(5,2)`, soporta 0.5 (medio día)
- `request_history` — audit trail ligado a solicitudes
- `user_day_adjustments` — todos los movimientos de días; `adjustment_number VARCHAR(20)` formato `VAC-YYYY-NNNN`; `adjustment_type ENUM('manual','monthly_auto','initial_balance')`
- `approval_tokens` — links de 7 días; enum `action`: `'approve'`/`'reject'` (NO `'approved'`/`'rejected'`)

View: `v_employee_days_summary` — agrega días aprobados por colaborador/año.

**Migración requerida al actualizar `adjustment_type`:**
```sql
ALTER TABLE user_day_adjustments
MODIFY COLUMN adjustment_type
  ENUM('manual','monthly_auto','initial_balance') NOT NULL DEFAULT 'manual';
```

### Numeración unificada VAC-YYYY-NNNN
El contador `VAC-` es compartido entre `vacation_requests` y `user_day_adjustments`. `generateAdjustmentNumber()` en `userController.js` suma el COUNT de ambas tablas. Aplica también en `importController.js` para saldos iniciales.

### Cron Job — Incremento mensual automático
- Archivo: `backend/jobs/monthlyVacationIncrement.js`
- Schedule producción: `0 1 1 * *` (día 1 de cada mes a la 1:00am, `America/Guatemala`)
- Acción: suma `1.25` a `base_vacation_days` de todos los usuarios activos; inserta registro `monthly_auto` en `user_day_adjustments` por cada usuario con número `VAC-`
- Se inicia en `server.js` dentro del callback de `app.listen`

### Cron Job — Reset anual de Beneficio Antigüedad
- Archivo: `backend/jobs/annualBenefitReset.js`
- Schedule producción: `5 6 1 1 *` (1 de enero a las 00:05am, `America/Guatemala`)
- Acción: pone `benefit_extra_day_used = 0` a todos los usuarios con `benefit_extra_day = 1`
- Se inicia en `server.js` junto al cron mensual

### Importación masiva de saldos desde CSV — flujo de dos pasos
- Formato aceptado: **CSV** (`.csv`); también acepta `.xlsx` por retrocompatibilidad
- Columnas requeridas: **`No. Colaborador`** | **`Saldo Inicial`** (también acepta `Código Colaborador` como alias)
- El parser CSV maneja BOM UTF-8 (`﻿`) que Excel agrega al exportar en Windows
- **Paso 1 — Preview**: `POST /api/users/preview-balances` — parsea el archivo, consulta la BD y devuelve `{ rows, total_found, total_not_found, total_errors }` **sin guardar nada**
- **Paso 2 — Confirmar**: `POST /api/users/import-balances` — ejecuta la carga real; actualiza `base_vacation_days` e inserta registro `initial_balance` en `user_day_adjustments`
- En el frontend (`Admin.jsx`): seleccionar archivo → modal de previsualización con tabla (verde=OK, amarillo=no encontrado, rojo=error) → botón "Confirmar carga (N)" → modal de resultado
- Implementado en `backend/controllers/importController.js`

### Beneficio Antigüedad (`seniority_benefit`)
- `request_type` = `seniority_benefit` en `vacation_requests` — 1 día extra anual para colaboradores con 3+ años
- Solo visible en Nueva Solicitud si `user.benefit_extra_day = true` Y `user.benefit_extra_day_used = false`
- **No descuenta** `base_vacation_days`; al ser aprobada, marca `benefit_extra_day_used = true` en el colaborador
- La elegibilidad (`benefit_extra_day`) la activa RRHH manualmente desde la Ficha del Colaborador en Admin
- Checkbox "Solo medio día" deshabilitado para este tipo; `date_to` se iguala a `date_from` automáticamente
- Al aprobar desde portal (`makeDecision`) y desde link de email (`processApprovalToken`) se actualiza `benefit_extra_day_used`
- Reset anual: el 1 de enero, el cron `annualBenefitReset.js` pone `benefit_extra_day_used = 0` para todos los elegibles
- **Migración requerida (una sola vez):**
  ```sql
  ALTER TABLE vacation_requests
  MODIFY COLUMN request_type
    ENUM('vacation','permission','justified_absence','seniority_benefit') NOT NULL;
  ```

### Sistema de colores (movimientos de días)
| Color | Evento |
|-------|--------|
| **Verde** `bg-green-50 / text-green-700` | Saldo inicial, incremento mensual automático, ajuste manual |
| **Rojo** `bg-red-50 / text-red-600` | Vacaciones aprobadas (días descontados) |
| **Ámbar** `bg-amber-50 / text-amber-600` | Beneficio Antigüedad aprobado (informativo, no descuenta) |
| **Gris** `bg-gray-50 / text-gray-500` | Permisos y ausencias aprobadas (informativo, no descuenta) |

Aplica en: `Dashboard.jsx` (timeline "Movimientos de Días"), `MyRequests.jsx`, `AllRequests.jsx`, `CollaboratorDetailModal.jsx`.

### Código Colaborador (`employee_number`)
- Se muestra en **todas** las vistas con estilo `font-mono font-semibold text-indigo-600`
- Aparece antes del nombre en: `Admin.jsx`, `AllRequests.jsx`, `PendingApprovals.jsx`, `Reports.jsx`, `CollaboratorDetailModal.jsx`
- Es la primera columna en todos los CSV exportados
- Es la clave de búsqueda en la importación masiva de saldos

### Frontend State
- `AuthContext` / `useAuth()` — global user y auth state
- `src/services/api.js` — Axios instance con base URL desde `VITE_API_URL` y credentials enabled
- `src/utils/dateUtils.js` — `formatDate()` (dd/mm/yyyy) y `formatDateTime()` (dd/mm/yyyy, HH:mm), locale `es-GT`, timezone `America/Guatemala` (UTC-6). **Nunca llamar `toLocaleDateString()` directamente en componentes.**

### Frontend Routes
All routes are implemented. Role-gated routes:
- Public (authenticated): `/dashboard`, `/new-request`, `/my-requests`, `/pending-approvals`, `/reports`, `/profile`
- `hr_admin` + `super_admin` only: `/admin`, `/all-requests`
- `super_admin` only: `/admin/inactive`

### Navbar — dos filas
- **Fila 1** (h-14): Logo MAR Fund + nombre usuario + badge de rol
- **Fila 2** (h-11): Links de navegación planos con hover `bg-indigo-50`
- Dropdown "Reportes" con submenú para `hr_admin`/`super_admin`
- Items visibles por rol definidos en el array `NAV_ITEMS` dentro de `Navbar.jsx`

### Admin page — funcionalidades
- Búsqueda en tiempo real por nombre o correo
- Filtro dropdown por Supervisor Inmediato
- Paginación: 5 / 10 / 20 / Todos con flechas prev/next
- **Exportar CSV**: exporta colaboradores del filtro activo con Código Colaborador como primera columna
- **Cargar Saldos**: carga CSV con saldos iniciales (flujo de dos pasos: previsualización → confirmar)
- **+ Días**: modal para agregar días manualmente con motivo
- **Reporte**: abre `CollaboratorDetailModal` con historial unificado del colaborador

### PendingApprovals — columnas
- **Pendientes de Aprobación**: Colaborador | Tipo | Fechas | Motivo | Acciones
- **Historial de Solicitudes**: Colaborador | Tipo | Fechas | Estado
- La columna "Tipo" muestra el label en español (incluyendo "Beneficio Antigüedad" para `seniority_benefit`)

### CollaboratorDetailModal
- Componente: `frontend/src/components/CollaboratorDetailModal.jsx`
- Llama `GET /api/reports/employee/:id/detail`
- Muestra: info del colaborador + 3 widgets (Días Base, Consumidos, Disponibles) + tabla de movimientos con colores
- Los movimientos están ordenados: saldo inicial primero, luego el resto por fecha descendente

## Key Design Decisions

1. **Google OAuth only** — Sin contraseñas. Solo cuentas `@marfund.org` se auto-registran.
2. **Sessions (cookies) over JWT** — Sesiones en MySQL permiten invalidación inmediata.
3. **Roles default to `employee`** — Roles superiores se asignan manualmente en DB.
4. **Email via N8N** — Lógica de correos delegada completamente a N8N. El workflow `MAR Fund - Decisión Final` incluye CC a `recursoshumanos@marfund.org` solo cuando `$json.body.decision === 'approved'`.
5. **Magic link approvals** — Supervisores reciben links con tokens para aprobar/rechazar sin iniciar sesión.
6. **Day balance computed in Node.js** — Balance = `base_vacation_days + SUM(adjustments.days_added) - consumed_vacation_days`. Solo vacaciones aprobadas descuentan.
7. **N8N reads manager email from Google Sheets** — `workflow_nueva_solicitud` consulta Google Sheets antes de enviar correo.
8. **Medio día (0.5)** — Checkbox en `NewRequest.jsx` resta 0.5 al último día del rango. `business_days` es `DECIMAL(5,2)`.
9. **Fechas siempre en UTC-6** — Todo pasa por `dateUtils.js` con `timeZone: 'America/Guatemala'`.
10. **Terminología UI** — "Colaborador" y "Supervisor" en textos visibles; los valores de enum y campos de BD permanecen en inglés.
11. **VAC- counter unificado** — Solicitudes de vacaciones y ajustes de días comparten la misma secuencia `VAC-YYYY-NNNN`.

## Known Issues & Gotchas

- **Tailwind v4 PostCSS**: Requiere `@tailwindcss/postcss` — NO el plugin estándar `tailwindcss`. Verificar `postcss.config.js` e `index.css` si el CSS se rompe.
- **Remote DB firewall**: Conexiones locales a `147.93.46.144:3306` pueden dar `ETIMEDOUT`. Solución: abrir puerto en Hostinger o usar MySQL local.
- **Zombie nodemon**: Si el puerto está en uso tras un fallo, matar el proceso nodemon anterior.
- **approval_tokens.action enum**: Valores válidos `'approve'` / `'reject'`. El campo `vacation_requests.status` usa `'approved'`/`'rejected'`. No confundirlos.
- **MySQL ONLY_FULL_GROUP_BY**: Activo en producción. Nunca mezclar `SUM()` con columnas no agrupadas en el mismo SELECT.
- **import-balances requiere columnas exactas**: El CSV debe tener `No. Colaborador` y `Saldo Inicial` (o `Código Colaborador` como alias). Sensible a mayúsculas y espacios. El parser maneja BOM UTF-8 de Excel automáticamente.
- **preview-balances no guarda nada**: Es solo lectura — úsalo para validar el archivo antes de ejecutar la carga real.
- **seniority_benefit permite fines de semana**: El tipo no usa días hábiles — el frontend fuerza `business_days: 1` en el payload y omite la validación `businessDays <= 0`. No aplicar esta lógica a otros tipos.
- **Reporte general muestra 0 si no hay solicitudes aprobadas en el año**: Las columnas Vacaciones/Permisos/Ausencias/B. Antigüedad filtran por `YEAR(vr.created_at)`. Si el año seleccionado no tiene solicitudes aprobadas, todas muestran 0 — es correcto, no es un error.

## Environment Variables

**Backend** (`backend/.env`): `PORT`, `APP_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET`, `N8N_BASE_URL`, `N8N_WEBHOOK_NEW_REQUEST`, `N8N_WEBHOOK_DECISION`

**Frontend** (`frontend/.env`): `VITE_API_URL` (e.g. `http://localhost:3001/api`)

See `.env.example` (root) for the full template with Spanish comments.

## Key Files
- `backend/server.js` — Entry point; registra el cron job al arrancar
- `backend/config/db.js` — MySQL connection pool (max 10 connections)
- `backend/config/passport.js` — Google OAuth strategy con auto-registro de usuarios
- `backend/services/n8nService.js` — Integración con webhooks de N8N; `formatRequestType()` mapea todos los tipos (incluye `seniority_benefit`)
- `backend/jobs/monthlyVacationIncrement.js` — Cron incremento 1.25 días mensual
- `backend/jobs/annualBenefitReset.js` — Cron 1 de enero: resetea `benefit_extra_day_used` para elegibles
- `backend/controllers/userController.js` — `generateAdjustmentNumber()`, `addDayAdjustment()`, `getDayAdjustments()`
- `backend/controllers/reportController.js` — `getMyReport()`, `getEmployeeDetail()`, `getAllEmployeesReport()`
- `backend/controllers/importController.js` — `previewBalances()` (previsualización sin guardar) + `importInitialBalances()` (carga real desde CSV)
- `frontend/src/App.jsx` — Definición de rutas
- `frontend/src/context/AuthContext.jsx` — Estado global de autenticación
- `frontend/src/utils/dateUtils.js` — `formatDate()` y `formatDateTime()` (dd/mm/yyyy, UTC-6)
- `frontend/src/components/layout/Navbar.jsx` — Navbar de dos filas con `NAV_ITEMS` por rol
- `frontend/src/components/layout/MainLayout.jsx` — Layout base con `overflow-x-auto`
- `frontend/src/components/CollaboratorDetailModal.jsx` — Modal de historial detallado del colaborador
- `frontend/src/pages/Admin.jsx` — Gestión de usuarios: búsqueda, filtro, paginación, CSV, carga saldos, reporte
- `database/schema.sql` — DDL completo incluyendo `user_day_adjustments` con enum `initial_balance`
- `database/reset_solicitudes.sql` — Script para limpiar solicitudes sin tocar usuarios ni saldos
- `plans/` — Planes de desarrollo, guías y documentación de apoyo
