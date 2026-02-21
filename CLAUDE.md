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
- **Backend**: Express.js 5 + MySQL 2 (promise pool, raw SQL — no ORM) + Passport.js (Google OAuth 2.0) + express-session (MySQL session store)
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
| `/api/users` | `routes/userRoutes.js` | Manager list, user CRUD (admin only) |
| `/api/reports` | `routes/reportRoutes.js` | Employee and aggregate reports |

### Database Schema (MySQL 8.0+)
Key tables: `users` (self-referencing `manager_id`), `vacation_requests` (status: pending/approved/rejected/cancelled), `request_date_ranges` (multiple ranges per request), `request_history` (audit trail), `approval_tokens` (7-day email links). View: `v_employee_days_summary` aggregates approved days per employee/year.

### Frontend State
- `AuthContext` / `useAuth()` hook — global user and auth state
- `src/services/api.js` — Axios instance with base URL from `VITE_API_URL` and credentials enabled

### Frontend Route Status
`/dashboard`, `/my-requests`, `/pending-approvals`, `/reports`, `/admin` are defined but most are placeholders rendering the same dashboard component.

## Key Design Decisions

1. **Google OAuth only** — No passwords. Only `@marfund.org` accounts are auto-registered on first login.
2. **Sessions (cookies) over JWT** — Stateful sessions stored in MySQL allow immediate session invalidation (useful for HR global logout). No refresh token complexity.
3. **Roles default to `employee`** — Higher roles (`manager`, `hr_admin`, `super_admin`) must be granted manually via DB by an admin. There is no self-service role upgrade.
4. **Email via N8N, not Nodemailer** — Email logic is fully delegated to N8N so non-technical HR staff can modify email templates visually without touching backend code.
5. **Magic link approvals** — Managers receive email links with one-time tokens to approve/reject without logging into the platform (`/api/requests/token/:token` is a public endpoint).
6. **Day balance as SQL VIEW** — `v_employee_days_summary` computes `base_days + extra_days - consumed_days`. The backend only reads this view; no day-counting logic exists in Node.js.
7. **N8N reads manager email from Google Sheets** — The `workflow_nueva_solicitud` workflow looks up the manager's contact in a Google Sheets spreadsheet before sending the approval email.

## Known Issues & Gotchas

- **Tailwind v4 PostCSS**: The project uses Tailwind CSS v4, which requires `@tailwindcss/postcss` as the PostCSS plugin — NOT the standard `tailwindcss` plugin. If CSS breaks after dependency changes, check `postcss.config.js` and `index.css`.
- **Remote DB firewall (Easypanel/Hostinger)**: When running the backend locally, connections to the remote MySQL at `147.93.46.144:3306` may time out (`ETIMEDOUT`) because Hostinger's firewall typically blocks external port 3306. Solutions: open port 3306 in Hostinger's firewall panel, or use a local MySQL instance for development.
- **Zombie nodemon processes**: If the port is already in use after a failed restart, a previous nodemon process may still be running. Kill it before restarting.

## Pending Frontend Components (Phase 5)

These routes exist in `App.jsx` but render placeholder content — they are the next development targets:

| Route | Component | API Endpoint |
|-------|-----------|--------------|
| `/dashboard` | Day summary widgets (available/requested/balance) | `GET /api/reports/employee/:id` |
| `/my-requests` | Employee request history table | `GET /api/requests` |
| `/pending-approvals` | Manager/HR approval queue | `GET /api/requests` (filtered by role) |
| `/reports` | Aggregate company report | `GET /api/reports/all` |

The new request form (`/dashboard` or a modal) must include: date range picker skipping weekends/holidays, client-side business day calculation before submitting to `POST /api/requests`.

## Environment Variables

**Backend** (`backend/.env`): `PORT`, `APP_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET`, `N8N_BASE_URL`, `N8N_WEBHOOK_NEW_REQUEST`, `N8N_WEBHOOK_DECISION`

**Frontend** (`frontend/.env`): `VITE_API_URL` (e.g. `http://localhost:3001/api`)

See `.env.example` (root) for the full template with Spanish comments.

## Key Files
- `backend/server.js` — Express app entry point
- `backend/config/db.js` — MySQL connection pool (max 10 connections)
- `backend/config/passport.js` — Google OAuth strategy with auto user creation
- `backend/services/n8nService.js` — N8N webhook integration
- `frontend/src/App.jsx` — Route definitions
- `frontend/src/context/AuthContext.jsx` — Global auth state
- `database/schema.sql` — Full DDL with all tables and the summary view
- `PROMPT_SistemaVacaciones_MARFund.md` — Original system requirements (reference for business rules)
