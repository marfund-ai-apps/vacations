# Plan de Implementación — 3 Requerimientos
**Fecha:** 02/04/2026  
**Sistema:** Sistema de Solicitud de Vacaciones MAR Fund

---

## Hallazgos técnicos antes de iniciar

| Punto | Estado actual | Acción requerida |
|---|---|---|
| `request_date_ranges.business_days` | Ya es `DECIMAL(5,2)` | Ninguna |
| `users.base_vacation_days` | `INT` (no está en schema.sql pero existe en la DB) | Migrar a `DECIMAL(5,2)` |
| `request_history.request_id` | `NOT NULL` — no permite registros sin solicitud | Crear nueva tabla `user_day_adjustments` |
| Historial de colores | No existe ningún sistema | Implementar en Dashboard y nueva tabla |

---

## Requerimiento 1 — Medio día (0.5) en solicitudes

### Base de datos
- [ ] **DB-1.1** Verificar en producción si `users.base_vacation_days` es `INT` y ejecutar:
  ```sql
  ALTER TABLE users MODIFY COLUMN base_vacation_days DECIMAL(5,2) NOT NULL DEFAULT 15.00;
  ```
- [ ] **DB-1.2** Actualizar `database/schema.sql` para reflejar el tipo correcto de `base_vacation_days DECIMAL(5,2)`

### Backend
- [ ] **BE-1.1** No se requieren cambios en `requestController.js` — ya acepta `business_days` como decimal y lo guarda en `DECIMAL(5,2)`
- [ ] **BE-1.2** Verificar que `parseFloat()` se usa correctamente al leer `business_days` (ya está hecho en el controller)

### Frontend — `frontend/src/pages/NewRequest.jsx`
- [ ] **FE-1.1** Agregar estado `halfDay` (boolean, default `false`) en el componente
- [ ] **FE-1.2** Agregar checkbox debajo de las fechas con el label **"Solo medio día (el último día cuenta como 0.5)"**
- [ ] **FE-1.3** Modificar `calculateBusinessDays` para que cuando `halfDay = true`, reste `0.5` al total:
  - Lógica: `totalDays - 0.5` donde el 0.5 se aplica siempre al **último día del rango**
  - Si el resultado es `0`, mostrar error (el rango debe tener al menos 0.5 días)
- [ ] **FE-1.4** Actualizar el mensaje de preview: _"Días hábiles a descontar: **2.5 días**"_ (mostrar decimal cuando aplique)
- [ ] **FE-1.5** Pasar `business_days` como decimal en el payload al backend (ej. `2.5`)

---

## Requerimiento 2 — Incremento automático de 1.25 días el día 1 de cada mes

### Base de datos
- [ ] **DB-2.1** Crear nueva tabla `user_day_adjustments` para registro de todos los movimientos de días (manuales y automáticos):
  ```sql
  CREATE TABLE user_day_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      adjusted_by INT NULL,              -- NULL = automático por sistema
      days_added DECIMAL(5,2) NOT NULL,  -- positivo = suma, negativo = resta
      adjustment_type ENUM('manual', 'monthly_auto') NOT NULL DEFAULT 'manual',
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL
  );
  ```
- [ ] **DB-2.2** Agregar la tabla al archivo `database/schema.sql`

### Backend — nuevo job de CRON
- [ ] **BE-2.1** Instalar `node-cron`:
  ```bash
  cd backend && npm install node-cron
  ```
- [ ] **BE-2.2** Crear archivo `backend/jobs/monthlyVacationIncrement.js`:
  - Cron expression: `0 1 1 * *` (día 1 de cada mes a la 1:00am)
  - Consulta todos los usuarios activos (`is_active = 1`)
  - Hace `UPDATE users SET base_vacation_days = base_vacation_days + 1.25 WHERE is_active = 1`
  - Inserta un registro en `user_day_adjustments` por cada usuario con:
    - `adjusted_by = NULL`
    - `adjustment_type = 'monthly_auto'`
    - `reason = 'Aumento automático mensual de 1.25 días de vacaciones'`
    - `days_added = 1.25`
  - Registra log en consola: `[CRON] Incremento mensual ejecutado para N usuarios`
- [ ] **BE-2.3** Registrar el job en `backend/server.js` — importar y arrancar el cron al iniciar el servidor

### Backend — endpoint para consultar historial de ajustes
- [ ] **BE-2.4** Agregar en `userController.js` la función `getDayAdjustments(req, res)`:
  - `GET /api/users/:id/day-adjustments`
  - Devuelve todos los registros de `user_day_adjustments` del usuario ordenados por fecha desc
  - Incluye `adjusted_by_name` via JOIN a `users`
- [ ] **BE-2.5** Registrar la ruta en `userRoutes.js`:
  ```
  GET /api/users/:id/day-adjustments  →  isAuthenticated (el propio usuario o manager/admin)
  ```

### Backend — actualizar reporte del dashboard
- [ ] **BE-2.6** Actualizar `reportController.js` → `getMyReport`:
  - Sumar `user_day_adjustments.days_added` (tipo `manual` y `monthly_auto`) al balance disponible
  - Incluir los ajustes en el objeto `history` del response, marcados con `type: 'adjustment'`
  - Balance correcto: `base_vacation_days + SUM(day_adjustments) - consumed_days`

---

## Requerimiento 3 — Agregar días manualmente (solo jefes/admins)

### Backend
- [ ] **BE-3.1** Agregar en `userController.js` la función `addDayAdjustment(req, res)`:
  - `POST /api/users/:id/day-adjustments`
  - Body: `{ days_added: Number, reason: String }`
  - Valida que `days_added > 0` y `reason` no esté vacío
  - Inserta en `user_day_adjustments` con `adjusted_by = req.user.id`, `adjustment_type = 'manual'`
  - Actualiza `users.base_vacation_days = base_vacation_days + days_added` para el usuario
- [ ] **BE-3.2** Registrar la ruta en `userRoutes.js`:
  ```
  POST /api/users/:id/day-adjustments  →  requireRole('manager', 'hr_admin', 'super_admin')
  ```

### Frontend — `frontend/src/pages/Admin.jsx`
- [ ] **FE-3.1** Agregar estado `adjustModal` (`null` o `{ userId, userName }`) para el modal de ajuste
- [ ] **FE-3.2** Crear modal "Agregar Días" con:
  - Campo numérico: "Días a agregar" (mín. 0.5, step 0.5)
  - Campo textarea: "Motivo / Razón" (obligatorio)
  - Botón "Confirmar" → llama `POST /api/users/:id/day-adjustments`
  - Al éxito: toast verde + recarga tabla
- [ ] **FE-3.3** Agregar botón **"+ Días"** (color verde) en la columna de acciones de cada empleado en la tabla de Admin, visible para `manager`, `hr_admin`, `super_admin`
- [ ] **FE-3.4** Restringir visibilidad del botón: el jefe (`manager`) solo puede agregar días a usuarios donde `u.manager_id === currentUser.id`

---

## Sistema de colores — Historial de movimientos

### Criterio de color
| Color | Evento |
|---|---|
| **Rojo** `bg-red-50 / text-red-700` | Días consumidos: solicitudes de vacaciones/permiso aprobadas |
| **Verde** `bg-green-50 / text-green-700` | Días sumados: incremento automático mensual (1.25) o ajuste manual por jefe |

### Frontend — `frontend/src/pages/Dashboard.jsx`
- [ ] **FE-COL-1** Crear sección "Movimientos de Días" que combine:
  - Solicitudes aprobadas (de `report.history`) → mostrar en **rojo** con `-X días`
  - Ajustes de `user_day_adjustments` → mostrar en **verde** con `+X días`
  - Ordenar todos por fecha descendente
- [ ] **FE-COL-2** Actualizar el widget "Días Consumidos" del dashboard para que el número siga en rojo
- [ ] **FE-COL-3** Agregar widget "Días Agregados (año actual)" en verde sumando todos los ajustes del año

---

## Resumen de archivos a modificar/crear

| Archivo | Tipo de cambio |
|---|---|
| `database/schema.sql` | Agregar `user_day_adjustments`, corregir tipo de `base_vacation_days` |
| `backend/jobs/monthlyVacationIncrement.js` | **Crear nuevo** |
| `backend/server.js` | Registrar el cron job |
| `backend/controllers/userController.js` | Agregar `addDayAdjustment`, `getDayAdjustments` |
| `backend/controllers/reportController.js` | Actualizar `getMyReport` para incluir ajustes en el balance |
| `backend/routes/userRoutes.js` | Agregar 2 nuevas rutas de ajustes |
| `frontend/src/pages/NewRequest.jsx` | Checkbox medio día + lógica de cálculo |
| `frontend/src/pages/Admin.jsx` | Botón "+ Días" + modal de ajuste |
| `frontend/src/pages/Dashboard.jsx` | Sección movimientos con colores + widget días agregados |
