# Guía de Desarrolladores — Actualización 02/04/2026

## Resumen de cambios implementados

En esta sesión se implementaron 3 requerimientos funcionales y 3 mejoras técnicas sobre el sistema de solicitud de vacaciones MAR Fund.

---

## Requerimiento 1 — Medio día (0.5) en solicitudes

### Qué se hizo
Se agregó la opción de solicitar medio día marcando un checkbox en el formulario de nueva solicitud. El 0.5 siempre se resta al **último día del rango** de fechas.

### Archivos modificados
- `frontend/src/pages/NewRequest.jsx`
  - Nuevo estado `halfDay` (boolean)
  - Nuevo cálculo: `businessDays = rawBusinessDays - (halfDay ? 0.5 : 0)`
  - Nuevo checkbox "Solo medio día — el último día del rango cuenta como 0.5"
  - Preview muestra `2.5 días (incluye medio día final)`

### Base de datos
- `request_date_ranges.business_days` ya era `DECIMAL(5,2)` — no requirió migración
- `users.base_vacation_days` ya era `DECIMAL(5,2)` en producción — no requirió migración

---

## Requerimiento 2 — Incremento automático de 1.25 días el día 1 de cada mes

### Qué se hizo
Se creó un cron job con `node-cron` que se ejecuta el día 1 de cada mes a la 1:00am (hora Guatemala). Suma 1.25 días a todos los usuarios activos y registra el movimiento en `user_day_adjustments`.

### Archivos nuevos/modificados
- **Nuevo:** `backend/jobs/monthlyVacationIncrement.js`
  - Schedule producción: `'0 1 1 * *'`
  - Timezone: `America/Guatemala`
  - Inserta un registro por usuario con `adjustment_type = 'monthly_auto'` y número `VAC-YYYY-NNNN`
- `backend/server.js` — importa y llama `startMonthlyVacationIncrement()` dentro del `app.listen`
- `backend/package.json` — dependencia `node-cron` agregada

### Instalación en nuevo entorno
```bash
cd backend
npm install node-cron
```

---

## Requerimiento 3 — Agregar días manualmente (solo jefes/admins)

### Qué se hizo
Se agregó un botón verde **"+ Días"** en la tabla de usuarios de la página Admin. Abre un modal con campo de días (mín. 0.5, step 0.5) y motivo obligatorio. Solo visible para `manager`, `hr_admin`, `super_admin`.

### Archivos modificados
- `backend/controllers/userController.js`
  - Nueva función `generateAdjustmentNumber()` — número correlativo unificado `VAC-YYYY-NNNN`
  - Nueva función `addDayAdjustment()` — `POST /api/users/:id/day-adjustments`
  - Nueva función `getDayAdjustments()` — `GET /api/users/:id/day-adjustments`
- `backend/routes/userRoutes.js` — 2 nuevas rutas registradas
- `frontend/src/pages/Admin.jsx`
  - Estado `adjustModal` y `adjustForm`
  - Handler `openAdjustModal`, `handleAdjustDays`
  - Botón "+ Días" en columna de acciones
  - Modal con campos: días (number, step 0.5) + motivo (textarea)
  - Toast de éxito incluye el número `VAC-`: _"Se agregaron 2 días a Juan Pérez (VAC-2026-0010)"_

---

## Mejora técnica 1 — Tabla `user_day_adjustments`

### Migración requerida en producción
```sql
-- Crear tabla (si no existe)
CREATE TABLE `user_day_adjustments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adjustment_number` varchar(20) DEFAULT NULL,
  `user_id` int NOT NULL,
  `adjusted_by` int DEFAULT NULL,
  `days_added` decimal(5,2) NOT NULL,
  `adjustment_type` enum('manual','monthly_auto') NOT NULL DEFAULT 'manual',
  `reason` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `adjustment_number` (`adjustment_number`),
  KEY `user_id` (`user_id`),
  KEY `adjusted_by` (`adjusted_by`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Si la tabla ya existe sin adjustment_number:
ALTER TABLE user_day_adjustments
ADD COLUMN adjustment_number VARCHAR(20) UNIQUE NULL AFTER id;
```

---

## Mejora técnica 2 — Sistema de colores en movimientos de días

### Criterio
| Color | Evento |
|-------|--------|
| **Verde** `text-green-700 / bg-green-50` | Incremento mensual automático o ajuste manual |
| **Rojo** `text-red-600 / bg-red-50` | Solicitud de vacaciones/permiso aprobada |

### Dónde aplica
- `Dashboard.jsx` — sección "Movimientos de Días (año actual)": filas coloreadas + número `VAC-` en color
- `MyRequests.jsx` — número rojo cuando `status === 'approved'`
- `AllRequests.jsx` — mismo criterio

### Dashboard — datos del reporte
`GET /api/reports/employee-report` ahora retorna 3 propiedades:
```json
{
  "summary": { "total_base_days", "total_extra_days", "total_consumed_days", "total_available_days" },
  "history": [ ...vacation_requests ],
  "adjustments": [ ...user_day_adjustments con adjustment_number y adjusted_by_name ]
}
```

---

## Mejora técnica 3 — Fechas dd/mm/yyyy y timezone Guatemala

### Problema resuelto
Todas las fechas y timestamps se mostraban en formato `mm/dd/yyyy` y en UTC (+6 horas respecto a Guatemala).

### Solución
- **Nuevo archivo:** `frontend/src/utils/dateUtils.js`
  ```js
  formatDate(dateStr)     // → "02/04/2026"
  formatDateTime(dateStr) // → "02/04/2026, 02:45 p. m."
  ```
  Ambas funciones usan `locale: 'es-GT'` y `timeZone: 'America/Guatemala'` (UTC-6).
- `frontend/index.html` — `<html lang="es-GT">` para que los `<input type="date">` muestren `dd/mm/yyyy`

### Regla importante
**Nunca llamar `toLocaleDateString()` sin parámetros** en los componentes. Siempre importar y usar `formatDate` o `formatDateTime` desde `../utils/dateUtils`.

### Archivos que usan el utilitario
`Dashboard.jsx`, `AllRequests.jsx`, `MyRequests.jsx`, `PendingApprovals.jsx`

---

## Errores conocidos resueltos en esta sesión

| Error | Causa | Solución |
|-------|-------|----------|
| `ER_MIX_OF_GROUP_FUNC_AND_FIELDS` | Query mezclaba `SUM()` con columnas no agrupadas | Separar en dos queries independientes en `reportController.js` |
| `Data truncated for column 'action'` | Se guardaba `'approved'` en un enum que solo acepta `'approve'` | Corregido en `requestController.js`: usar `tokenAction = 'approve'`/`'reject'` |

---

## Commits de esta sesión

| Hash | Descripción |
|------|-------------|
| `aecdb8f` | feat: medio día, cron mensual 1.25 días, agregar días manual y colores dashboard |
| `4c6bd8e` | fix: corregir query SQL GROUP BY en getMyReport y enum action en approval_tokens |
| `44e2b14` | feat: fechas dd/mm/yyyy, cron producción, número VAC- en ajustes y colores |
| `92bf07d` | fix: lang es-GT en index.html para mostrar dd/mm/yyyy en inputs de fecha |
| `1a9b7ed` | fix: ajustar timezone a America/Guatemala (UTC-6) en formatDate y formatDateTime |
| `357b81e` | fix: renombrar 'Historial de Decisiones' a 'Historial de Solicitudes' |
