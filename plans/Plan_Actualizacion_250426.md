# Plan de Actualización — 25/04/2026
**Sistema:** Sistema de Solicitud de Vacaciones MAR Fund

---

## Hallazgos técnicos antes de iniciar

| Punto | Hallazgo | Impacto |
|-------|----------|---------|
| Descuento de días | No ocurre en la aprobación — se calcula en tiempo de consulta via SQL (`status = 'approved'`) | Req 3: solo cambiar los `SUM()` del reportController para filtrar por `request_type = 'vacation'` |
| "Empleado"/"Jefe" | Aparecen en 7 archivos frontend + mensajes backend | Req 1: reemplazos de texto en múltiples archivos |
| Fechas UTC-6 | `dateUtils.js` ya tiene `timeZone: 'America/Guatemala'` — falta verificar que `Reports.jsx` lo use | Req 2: auditar Reports.jsx |
| Reporte general | `getAllEmployeesReport` retorna solo días consumidos, sin `base_vacation_days` | Req 4: agregar `base_vacation_days` + cálculo de saldo inicial/final |
| Motivo | Textarea actualmente `required` para todos los tipos | Req 5: deshabilitar y quitar `required` cuando `request_type = 'vacation'` |
| Admin layout | Contenedor usa `px-4 sm:px-6 lg:px-8` — tabla no tiene `overflow-x-auto` a nivel de página | Req 6: corregir wrapping del contenedor |

---

## Requerimiento 1 — Cambio de terminología: "Empleado" → "Colaborador", "Jefe" → "Supervisor"

### Archivos frontend (textos visibles en UI)
- [ ] **FE-1.1** `frontend/src/pages/Admin.jsx` — 8 ocurrencias: header, botón "Agregar Empleado", columna tabla, toasts, modal ajuste días, select opciones rol
- [ ] **FE-1.2** `frontend/src/pages/AllRequests.jsx` — 2 ocurrencias: encabezados de columna
- [ ] **FE-1.3** `frontend/src/pages/InactiveUsers.jsx` — 4 ocurrencias: título página, descripción, columna, mensaje vacío
- [ ] **FE-1.4** `frontend/src/components/layout/Navbar.jsx` — 5 ocurrencias: etiquetas de menú
- [ ] **FE-1.5** `frontend/src/pages/PendingApprovals.jsx` — 2 ocurrencias: encabezados de columna
- [ ] **FE-1.6** `frontend/src/pages/Profile.jsx` — 2 ocurrencias: subtítulo ficha, etiqueta número
- [ ] **FE-1.7** `frontend/src/pages/Reports.jsx` — 2 ocurrencias: descripción y encabezado de columna

### Nota de alcance
- La palabra `employee` en valores de enum (`role = 'employee'`, `request_type`) **NO se cambia** — son valores internos de DB.
- Solo se cambian textos visibles al usuario final.

---

## Requerimiento 2 — Fechas y horas en formato Guatemala UTC-6

### Estado actual
`dateUtils.js` ya implementa `timeZone: 'America/Guatemala'` correctamente. El problema es que `Reports.jsx` no usa el utilitario.

- [ ] **FE-2.1** Verificar que `Reports.jsx` importe y use `formatDate` / `formatDateTime` de `../utils/dateUtils` para cualquier fecha que muestre
- [ ] **FE-2.2** Auditar `Profile.jsx` y `InactiveUsers.jsx` — si muestran fechas, aplicar el mismo utilitario

---

## Requerimiento 3 — Solo "Vacaciones" descuenta días; Permiso y Ausencia no descuentan

### Impacto en lógica de negocio
Actualmente el sistema suma `business_days` de **todas** las solicitudes aprobadas (vacaciones + permisos + ausencias) para calcular días consumidos. Con este cambio:
- **Vacaciones aprobadas** → descuentan días del saldo
- **Permiso Personal aprobado** → NO descuenta días (solo queda registro)
- **Ausencia Justificada aprobada** → NO descuenta días (solo queda registro)

### Backend
- [ ] **BE-3.1** `backend/controllers/reportController.js` → `getMyReport()`:
  - Cambiar query de `total_consumed` para filtrar solo `vr.request_type = 'vacation'`
  - El campo `total_consumed_days` en `summary` solo contará vacaciones
- [ ] **BE-3.2** `backend/controllers/reportController.js` → `getAllEmployeesReport()`:
  - La columna `total_days` del reporte ya tiene el `CASE WHEN` por tipo — solo ajustar si el total general necesita excluir permisos y ausencias

### Frontend
- [ ] **FE-3.1** `frontend/src/pages/Dashboard.jsx` — sección "Movimientos de Días":
  - Solo las solicitudes de tipo `vacation` con `status = 'approved'` deben aparecer como movimientos **rojos** (descuento)
  - Los permisos y ausencias aprobadas **no** aparecen en el timeline de movimientos de días (no afectan saldo)
- [ ] **FE-3.2** `frontend/src/pages/Dashboard.jsx` — widget "Días Consumidos": ya se corregirá al cambiar el backend

---

## Requerimiento 4 — Reportes Generales: agregar saldo inicial y saldo final

### Backend
- [ ] **BE-4.1** `backend/controllers/reportController.js` → `getAllEmployeesReport()`:
  - Agregar `u.base_vacation_days` al SELECT
  - Agregar suma de ajustes de días del año (`user_day_adjustments`) para calcular saldo real
  - Retornar por empleado: `base_vacation_days`, `total_adjustments` (suma de ajustes del año), `vacation_days_consumed` (solo vacaciones), `saldo_final` = `base_vacation_days - vacation_days_consumed`

### Frontend — `frontend/src/pages/Reports.jsx`
- [ ] **FE-4.1** Agregar columnas en la tabla de reportes:
  | Columna nueva | Descripción |
  |---|---|
  | **Días Base** | `base_vacation_days` del usuario |
  | **Vacaciones** | días consumidos solo por vacaciones aprobadas |
  | **Permisos** | días de permisos aprobados (informativo, no descuenta) |
  | **Ausencias** | días de ausencias aprobadas (informativo, no descuenta) |
  | **Saldo Final** | `base_vacation_days - vacation_days_consumed` (en negrita, color indigo) |
- [ ] **FE-4.2** Actualizar el CSV de exportación para incluir las nuevas columnas

---

## Requerimiento 5 — "Motivo / Justificación" solo habilitado para Permiso y Ausencia

### Comportamiento esperado
| Tipo seleccionado | Estado del textarea | required |
|---|---|---|
| Vacaciones | Deshabilitado (gris, con placeholder "No aplica para vacaciones") | No |
| Permiso Personal | Habilitado | Sí |
| Ausencia Justificada | Habilitado | Sí |

### Frontend — `frontend/src/pages/NewRequest.jsx`
- [ ] **FE-5.1** Derivar `isVacation` desde `formData.request_type === 'vacation'`
- [ ] **FE-5.2** Agregar `disabled={isVacation}` y `required={!isVacation}` al textarea
- [ ] **FE-5.3** Agregar `placeholder` dinámico: `isVacation ? 'No aplica para solicitudes de vacaciones' : 'Escribe el motivo...'`
- [ ] **FE-5.4** Estilos visuales: cuando está deshabilitado usar `disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed`
- [ ] **FE-5.5** Al cambiar el tipo a "Vacaciones", limpiar el campo `reason` del estado para no enviar texto residual

---

## Requerimiento 6 — Tabla de Administración de Colaboradores cortada/truncada

### Causa probable
El contenedor de la página usa padding lateral (`px-4 sm:px-6 lg:px-8`) pero la tabla tiene muchas columnas. El `overflow-x-auto` está solo en el div interno, no en el contenedor externo.

### Frontend — `frontend/src/pages/Admin.jsx`
- [ ] **FE-6.1** Verificar que el `<div className="mt-8 flow-root">` padre de la tabla tenga `-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8"` correctamente aplicado en el nivel correcto
- [ ] **FE-6.2** Revisar si el problema es de columnas — considerar reducir el ancho de la columna "No. Colaborador" (input pequeño) para dar espacio a las demás
- [ ] **FE-6.3** Si hay columnas en modo edición que expanden el ancho, limitar con `max-w-[120px]` o similar en inputs inline

---

## Resumen de archivos a modificar

| Archivo | Requerimientos |
|---------|---------------|
| `backend/controllers/reportController.js` | Req 3, Req 4 |
| `frontend/src/pages/Admin.jsx` | Req 1, Req 6 |
| `frontend/src/pages/AllRequests.jsx` | Req 1 |
| `frontend/src/pages/InactiveUsers.jsx` | Req 1, Req 2 |
| `frontend/src/pages/Navbar.jsx` | Req 1 |
| `frontend/src/pages/PendingApprovals.jsx` | Req 1 |
| `frontend/src/pages/Profile.jsx` | Req 1, Req 2 |
| `frontend/src/pages/Reports.jsx` | Req 1, Req 2, Req 4 |
| `frontend/src/pages/NewRequest.jsx` | Req 5 |
| `frontend/src/pages/Dashboard.jsx` | Req 3 |
