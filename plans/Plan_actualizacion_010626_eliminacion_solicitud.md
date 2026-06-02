# Plan de Actualización 01/06/2026 — Anulación de Solicitudes y Ajustes de Formulario

## Estado: COMPLETADO ✓

| # | Requerimiento | Estado |
|---|---------------|--------|
| R1 | Super Admin puede anular solicitudes | ✅ Implementado |
| R2 | Historial refleja solicitudes anuladas con nota de motivo | ✅ Implementado |
| R3 | Rehabilitar campo Motivo/Justificación para Vacaciones | ✅ Implementado |

---

## Commits realizados

| Hash | Descripción |
|------|-------------|
| `28abd2a` | feat: anulación de solicitudes, historial de anuladas y motivo en vacaciones |
| `933985a` | fix: reemplazar texto inline de motivo anulación por ícono Info con tooltip |
| `01db856` | fix: tooltip instantáneo con fondo morado para motivo de anulación |

---

## Migración SQL requerida en producción

```sql
-- 1. Agregar 'annulled' al enum de status
ALTER TABLE vacation_requests
MODIFY COLUMN status
  ENUM('pending','approved','rejected','cancelled','annulled') NOT NULL DEFAULT 'pending';

-- 2. Agregar columnas de anulación
ALTER TABLE vacation_requests
  ADD COLUMN annulment_reason VARCHAR(500) NULL AFTER notes,
  ADD COLUMN annulled_by INT NULL AFTER annulment_reason,
  ADD COLUMN annulled_at DATETIME NULL AFTER annulled_by;
```

> Ejecutar **antes** de reiniciar el backend en producción.

---

## R1 — Anulación de solicitudes (solo `super_admin`)

### Reglas de negocio

- Solo el rol `super_admin` puede anular.
- La solicitud **no se elimina** de la BD; cambia su `status` a `'annulled'`.
- Se debe ingresar un motivo de anulación obligatorio.
- **Devolución de días según tipo:**

| Tipo de solicitud | Status antes de anular | Acción sobre días |
|-------------------|------------------------|-------------------|
| `vacation` | `approved` | Los días se recuperan automáticamente (el query de consumo filtra `status = 'approved'`) |
| `vacation` | `pending` | Sin acción (nunca descontaron) |
| `seniority_benefit` | `approved` | Resetear `benefit_extra_day_used = 0` en el colaborador |
| `seniority_benefit` | `pending` | Sin acción |
| `permission` | cualquiera | Sin acción (no descuenta días) |
| `justified_absence` | cualquiera | Sin acción (no descuenta días) |

### Archivos modificados

**`backend/routes/requestRoutes.js`**
```js
router.put('/:id/annul', requireRole('super_admin'), requestController.annulRequest);
```

**`backend/controllers/requestController.js`** — nueva función `annulRequest`:
- Valida existencia de solicitud y que no esté ya anulada/cancelada
- Si es `seniority_benefit` aprobada → `UPDATE users SET benefit_extra_day_used = 0`
- Cambia status a `'annulled'`, guarda `annulment_reason`, `annulled_by`, `annulled_at`
- Inserta registro en `request_history`

**`frontend/src/pages/AllRequests.jsx`** — cambios completos:
- Importa `useAuth` para detectar `super_admin`
- Estado `annulModal` + `annulReason` + `submittingAnnul`
- Columna **Acciones** en historial (solo visible para `super_admin`)
- Botón **"Anular"** por fila — oculto si ya es `annulled` o `cancelled`
- Modal con: info de solicitud, aviso ámbar si devuelve días, textarea obligatorio, botones Cancelar / Confirmar Anulación
- Filas anuladas con `opacity-50`

---

## R2 — Historial refleja solicitudes anuladas

### Backend

**`backend/controllers/reportController.js`** — `getEmployeeDetail`:
- Query cambiada a `WHERE vr.status IN ('approved', 'annulled')`
- SELECT incluye `vr.annulment_reason` y `vr.annulled_at`
- Loop de movimientos asigna `color_type: 'annulled'` para anuladas
- `type_label` formato: `"Vacaciones — Anulada"` (tipo original + sufijo)
- `reason` del movimiento = `annulment_reason`; `detail` = `'Solicitud anulada'`

### Frontend — badge "Anulada"

Badge gris oscuro con ícono `Ban` agregado en:

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/AllRequests.jsx` | `getStatusBadge()` + ícono Info con tooltip |
| `frontend/src/pages/MyRequests.jsx` | `getStatusBadge()` + tooltip en columna de nota |
| `frontend/src/pages/Dashboard.jsx` | `getStatusBadge()` |
| `frontend/src/pages/PendingApprovals.jsx` | Badge inline en historial |
| `frontend/src/components/CollaboratorDetailModal.jsx` | `colorClass()` → gris opaco + texto tachado; `Icon()` → ícono `Ban` |

### Tooltip del motivo de anulación (AllRequests)

**Problema inicial:** texto inline debajo del badge empujaba columnas Estado y Acciones fuera del ancho visible.

**Solución final:** tooltip custom con `position: fixed` que se posiciona con `getBoundingClientRect()` al hacer `onMouseEnter`. Aparece **instantáneamente** sin delay y no queda cortado por el `overflow: hidden` de la tabla.

- Ícono: círculo **`bg-indigo-600`** (morado) con `Info` en blanco, `w-5 h-5`
- Tooltip: `bg-gray-900` texto blanco, `z-[9999]`, aparece debajo del ícono
- `MyRequests.jsx`: muestra motivo como tooltip en columna de nota (texto "Motivo anulación")

---

## R3 — Rehabilitar campo Motivo/Justificación para Vacaciones

**`frontend/src/pages/NewRequest.jsx`** — 3 cambios:

1. `reasonDisabled = isSeniorityBenefit` (eliminado `isVacation ||`)
2. `handleChange`: ya no limpia `reason` al seleccionar `vacation`
3. Eliminada etiqueta `"(no aplica para vacaciones)"`

**Resultado:**

| Tipo | Campo Motivo |
|------|-------------|
| Vacaciones | Habilitado y requerido ✅ |
| Permiso Personal | Habilitado y requerido (sin cambio) |
| Ausencia Justificada | Habilitado y requerido (sin cambio) |
| Beneficio Antigüedad | Deshabilitado (sin cambio) |

---

## Archivos modificados — resumen completo

### Backend
| Archivo | Cambio |
|---------|--------|
| `backend/routes/requestRoutes.js` | Ruta `PUT /:id/annul` con `requireRole('super_admin')` |
| `backend/controllers/requestController.js` | Función `annulRequest` |
| `backend/controllers/reportController.js` | `getEmployeeDetail`: incluye anuladas, `color_type: 'annulled'` |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/AllRequests.jsx` | Botón Anular + modal + badge + tooltip instantáneo morado |
| `frontend/src/pages/MyRequests.jsx` | Badge `annulled` + tooltip motivo |
| `frontend/src/pages/Dashboard.jsx` | Badge `annulled` |
| `frontend/src/pages/PendingApprovals.jsx` | Badge `annulled` |
| `frontend/src/components/CollaboratorDetailModal.jsx` | `color_type: 'annulled'` (gris tachado + ícono Ban) |
| `frontend/src/pages/NewRequest.jsx` | Motivo habilitado para Vacaciones |
