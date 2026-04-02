# Plan de Actualización v2
**Fecha:** 02/04/2026  
**Sistema:** Sistema de Solicitud de Vacaciones MAR Fund

---

## Requerimiento A — Formato de fechas dd/mm/yyyy en toda la app

### Estrategia
Crear una función utilitaria `formatDate(dateStr)` en `src/utils/dateUtils.js` que centralice el formato `dd/mm/yyyy` con locale `es-GT`. Todos los componentes la importan en lugar de llamar `toLocaleDateString()` directamente.

### Frontend — nuevo archivo utilitario
- [ ] **FE-A.1** Crear `frontend/src/utils/dateUtils.js` con:
  - `formatDate(dateStr)` → formato `dd/mm/yyyy` usando `toLocaleDateString('es-GT', { day:'2-digit', month:'2-digit', year:'numeric' })`
  - `formatDateTime(dateStr)` → formato `dd/mm/yyyy, HH:mm` (para timestamps de movimientos)

### Frontend — reemplazar en todos los componentes (15 instancias)
- [ ] **FE-A.2** `Dashboard.jsx` — 5 instancias (líneas 157, 158, 213, 214, 256)
- [ ] **FE-A.3** `AllRequests.jsx` — 4 instancias (líneas 100, 101, 156, 157)
- [ ] **FE-A.4** `MyRequests.jsx` — 4 instancias (líneas 95, 96, 149, 150)
- [ ] **FE-A.5** `PendingApprovals.jsx` — 2 instancias (líneas 103, 161)

---

## Requerimiento B — Cron: restituir a producción (día 1 de cada mes a la 1am)

- [ ] **BE-B.1** En `backend/jobs/monthlyVacationIncrement.js`: cambiar `'*/15 * * * *'` → `'0 1 1 * *'`
- [ ] **BE-B.2** Actualizar el comentario del archivo para reflejar el horario correcto

---

## Requerimiento C — Número de tracking para ajustes de días

### Diseño del número
Formato: `VAC-YYYY-NNNN` — numeración **unificada** con las solicitudes de vacaciones.  
Ejemplos: si el último VAC fue `VAC-2026-0009`, el siguiente ajuste será `VAC-2026-0010`.  
Aplica a: incrementos automáticos mensuales Y ajustes manuales por jefe.

El tipo se distingue visualmente por color, no por prefijo:
- **Verde** → `VAC-2026-0010` (ajuste manual o automático = incremento)
- **Rojo** → `VAC-2026-0009` (solicitud aprobada = descuento)

### Base de datos
- [ ] **DB-C.1** Agregar columna `adjustment_number` a la tabla `user_day_adjustments`:
  ```sql
  ALTER TABLE user_day_adjustments 
  ADD COLUMN adjustment_number VARCHAR(20) UNIQUE NULL AFTER id;
  ```
- [ ] **DB-C.2** Actualizar `database/schema.sql` con la nueva columna e índice único

### Backend — generador de número correlativo
- [ ] **BE-C.1** Agregar función `generateAdjustmentNumber()` en `userController.js` que use el mismo contador unificado de VAC- (cuenta registros en ambas tablas `vacation_requests` + `user_day_adjustments` para el año):
  ```js
  async function generateAdjustmentNumber() {
      const year = new Date().getFullYear();
      const [vac] = await db.query('SELECT COUNT(*) as c FROM vacation_requests WHERE YEAR(created_at) = ?', [year]);
      const [adj] = await db.query('SELECT COUNT(*) as c FROM user_day_adjustments WHERE YEAR(created_at) = ?', [year]);
      const count = vac[0].c + adj[0].c + 1;
      return `VAC-${year}-${String(count).padStart(4, '0')}`;
  }
  ```
- [ ] **BE-C.2** Llamar `generateAdjustmentNumber()` en `addDayAdjustment()` al insertar el registro manual
- [ ] **BE-C.3** Llamar `generateAdjustmentNumber()` en `monthlyVacationIncrement.js` — generar un número por cada usuario en la pasada mensual

### Frontend — mostrar el número en UI
- [ ] **FE-C.1** En `Dashboard.jsx` — sección "Movimientos de Días": agregar columna `#` que muestre el número en **verde** si es ajuste y en **rojo** si es solicitud aprobada
- [ ] **FE-C.2** En el modal de ajuste en `Admin.jsx`: mostrar el número en el toast de éxito: _"Se agregaron 2 días a Juan Pérez (VAC-2026-0010)"_
- [ ] **FE-C.3** En `reportController.js` → `getMyReport`: incluir `adjustment_number` en el query del listado de ajustes
- [ ] **FE-C.4** Aplicar colores en **todas** las vistas que muestran números de movimiento: `MyRequests.jsx`, `AllRequests.jsx`, `PendingApprovals.jsx` — verde para ajustes, rojo para solicitudes aprobadas

---

## Resumen de archivos a modificar

| Archivo | Cambio |
|---|---|
| `frontend/src/utils/dateUtils.js` | **Crear nuevo** — función `formatDate` y `formatDateTime` |
| `frontend/src/pages/Dashboard.jsx` | Usar `formatDate`, agregar columna `#` en movimientos |
| `frontend/src/pages/AllRequests.jsx` | Usar `formatDate` |
| `frontend/src/pages/MyRequests.jsx` | Usar `formatDate` |
| `frontend/src/pages/PendingApprovals.jsx` | Usar `formatDate` |
| `backend/jobs/monthlyVacationIncrement.js` | Restituir cron a producción + generar `adjustment_number` |
| `backend/controllers/userController.js` | Agregar `generateAdjustmentNumber`, usarlo en `addDayAdjustment` |
| `backend/controllers/reportController.js` | Incluir `adjustment_number` en query de ajustes |
| `database/schema.sql` | Agregar columna `adjustment_number` a `user_day_adjustments` |
