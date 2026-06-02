# Plan de Actualización 01/06/2026 — Anulación de Solicitudes y Ajustes de Formulario

## Resumen ejecutivo

| # | Requerimiento | Impacto |
|---|---------------|---------|
| R1 | Super Admin puede anular solicitudes | DB + Backend + Frontend |
| R2 | Historial refleja solicitudes anuladas con nota de motivo | Backend + Frontend |
| R3 | Rehabilitar campo Motivo/Justificación para Vacaciones | Solo Frontend |

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
| `seniority_benefit` | `approved` | Resetear `benefit_extra_day_used = 0` en el colaborador + días automáticos |
| `seniority_benefit` | `pending` | Sin acción |
| `permission` | cualquiera | Sin acción (no descuenta días) |
| `justified_absence` | cualquiera | Sin acción (no descuenta días) |

---

### Paso 1 — Migración de base de datos

```sql
-- 1a. Agregar 'annulled' al enum de status
ALTER TABLE vacation_requests
MODIFY COLUMN status
  ENUM('pending','approved','rejected','cancelled','annulled') NOT NULL DEFAULT 'pending';

-- 1b. Agregar columnas de anulación
ALTER TABLE vacation_requests
  ADD COLUMN annulment_reason VARCHAR(500) NULL AFTER notes,
  ADD COLUMN annulled_by INT NULL AFTER annulment_reason,
  ADD COLUMN annulled_at DATETIME NULL AFTER annulled_by,
  ADD CONSTRAINT fk_annulled_by FOREIGN KEY (annulled_by) REFERENCES users(id);
```

---

### Paso 2 — Backend: nuevo endpoint

**Archivo:** `backend/routes/requestRoutes.js`

Agregar la ruta después de la ruta de decisión:

```js
// Anular solicitud — solo super_admin
router.put('/:id/annul', requireRole('super_admin'), requestController.annulRequest);
```

---

**Archivo:** `backend/controllers/requestController.js`

Nueva función `annulRequest`:

```js
exports.annulRequest = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason || !reason.trim()) {
        return res.status(400).json({ message: 'Se requiere un motivo para anular la solicitud.' });
    }

    try {
        // 1. Verificar que la solicitud existe y no está ya anulada/cancelada
        const [rows] = await db.query(
            'SELECT * FROM vacation_requests WHERE id = ?', [id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Solicitud no encontrada.' });

        const request = rows[0];
        if (['annulled', 'cancelled'].includes(request.status)) {
            return res.status(400).json({ message: 'La solicitud ya fue anulada o cancelada.' });
        }

        // 2. Si es seniority_benefit aprobada → devolver el beneficio
        if (request.request_type === 'seniority_benefit' && request.status === 'approved') {
            await db.query(
                'UPDATE users SET benefit_extra_day_used = 0 WHERE id = ?',
                [request.employee_id]
            );
        }

        // 3. Cambiar status a annulled y registrar motivo
        await db.query(
            `UPDATE vacation_requests
             SET status = 'annulled',
                 annulment_reason = ?,
                 annulled_by = ?,
                 annulled_at = NOW()
             WHERE id = ?`,
            [reason.trim(), adminId, id]
        );

        // 4. Registrar en request_history
        await db.query(
            `INSERT INTO request_history (request_id, action, performed_by, comments)
             VALUES (?, 'annulled', ?, ?)`,
            [id, adminId, reason.trim()]
        );

        res.json({ message: 'Solicitud anulada correctamente.' });
    } catch (err) {
        console.error('Error en annulRequest:', err);
        res.status(500).json({ message: 'Error al anular la solicitud.' });
    }
};
```

> **Nota:** Para `vacation` aprobada, los días se recuperan automáticamente porque el cálculo de consumo usa `WHERE status = 'approved'`. Cambiar el status a `'annulled'` excluye la solicitud del cálculo sin ninguna entrada adicional en `user_day_adjustments`.

---

### Paso 3 — Frontend: botón Anular en AllRequests

**Archivo:** `frontend/src/pages/AllRequests.jsx`

Cambios requeridos:

1. Importar `useAuth` para detectar rol `super_admin`.
2. Agregar estados: `annulModal` (objeto `{open, requestId, requestNumber, requestType}`) y `annulReason` (string).
3. Agregar columna **Acciones** en la tabla del Historial (visible solo si `user.role === 'super_admin'`).
4. Botón **"Anular"** en gris/rojo por fila — visible para solicitudes que no sean ya `annulled` ni `cancelled`.
5. Modal de confirmación con:
   - Info de la solicitud (número, tipo, colaborador)
   - Aviso del efecto (días devueltos si aplica)
   - Textarea obligatorio para motivo
   - Botones: Cancelar / Confirmar Anulación
6. Al confirmar → `api.put('/requests/:id/annul', { reason })` → recargar lista → toast.

---

## R2 — Historial refleja solicitudes anuladas

### Backend

**Archivo:** `backend/controllers/reportController.js` — función `getEmployeeDetail`

La query de solicitudes actualmente filtra `WHERE status = 'approved'`. Cambiar a:

```sql
WHERE vr.employee_id = ? AND vr.status IN ('approved', 'annulled')
```

Para solicitudes anuladas, agregar a los movimientos con:
- `color_type: 'annulled'`
- `type_label`: `'Solicitud Anulada'` (+ tipo original entre paréntesis)
- `days`: valor original (para referencia)
- `reason`: el `annulment_reason` como motivo del movimiento

```js
// En el loop de requests en getEmployeeDetail:
const isAnnulled = r.status === 'annulled';
const colorType = isVacation && !isAnnulled ? 'debit'
                : r.request_type === 'seniority_benefit' && !isAnnulled ? 'seniority'
                : isAnnulled ? 'annulled'
                : 'info';
```

**Archivo:** `backend/controllers/reportController.js` — función `getMyReport`

La query del historial ya devuelve todos los estados (sin filtro). Solo se necesita que el frontend muestre el badge correcto.

---

### Frontend — badges y colores para `annulled`

Los siguientes archivos necesitan agregar el caso `'annulled'` en sus funciones de badge/color:

| Archivo | Función a modificar | Badge a agregar |
|---------|---------------------|-----------------|
| `frontend/src/pages/AllRequests.jsx` | `getStatusBadge()` | Gris oscuro: `"Anulada"` con ícono `Ban` |
| `frontend/src/pages/MyRequests.jsx` | `getStatusBadge()` | Igual |
| `frontend/src/pages/Dashboard.jsx` | `getStatusBadge()` | Igual |
| `frontend/src/pages/PendingApprovals.jsx` | Historial — badge inline | Igual |
| `frontend/src/components/CollaboratorDetailModal.jsx` | `colorClass()` e `Icon()` | `annulled` → gris con ícono `Ban` |

**Ejemplo de badge para `annulled`:**
```jsx
case 'annulled':
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
            <Ban className="w-3 h-3 mr-1" /> Anulada
        </span>
    );
```

**Color en CollaboratorDetailModal para `annulled`:**
```js
if (type === 'annulled') return {
    row: 'bg-gray-50 opacity-60',
    number: 'text-gray-400',
    days: 'text-gray-400 line-through',
    sign: ''
};
```

**Mostrar motivo de anulación:**
- En la columna "Motivo / Detalle" de `CollaboratorDetailModal` → mostrar `annulment_reason`
- En `MyRequests.jsx` → tooltip o fila expandida con el motivo
- En `AllRequests.jsx` → columna de motivo o tooltip

---

## R3 — Rehabilitar campo Motivo/Justificación para Vacaciones

**Archivo:** `frontend/src/pages/NewRequest.jsx`

### Cambio 1 — Condición `reasonDisabled` (línea 65)

```js
// ANTES:
const reasonDisabled = isVacation || isSeniorityBenefit;

// DESPUÉS:
const reasonDisabled = isSeniorityBenefit;
```

### Cambio 2 — Limpiar `reason` al cambiar tipo (handleChange, línea 113)

```js
// ANTES: al seleccionar 'vacation' también borra el reason
if (value === 'vacation' || value === 'seniority_benefit') {
    setFormData({ ...formData, request_type: value, reason: '' });
    ...
}

// DESPUÉS: solo borrar reason al seleccionar seniority_benefit
if (value === 'seniority_benefit') {
    setFormData({ ...formData, request_type: value, reason: '' });
    ...
} else {
    setFormData({ ...formData, [name]: value });
}
```

### Cambio 3 — Label del campo (quitar referencia a vacaciones)

```jsx
// ANTES:
{isVacation && <span className="ml-2 text-xs font-normal text-gray-400">(no aplica para vacaciones)</span>}

// DESPUÉS: eliminar esa línea
```

### Resultado esperado

- Vacaciones: campo Motivo/Justificación **habilitado y requerido**
- Permiso Personal: habilitado y requerido (sin cambio)
- Ausencia Justificada: habilitado y requerido (sin cambio)
- Beneficio Antigüedad: **deshabilitado** (sin cambio)

---

## Archivos a modificar — resumen

### Backend
| Archivo | Cambio |
|---------|--------|
| `backend/routes/requestRoutes.js` | Agregar ruta `PUT /:id/annul` |
| `backend/controllers/requestController.js` | Nueva función `annulRequest` |
| `backend/controllers/reportController.js` | `getEmployeeDetail`: incluir `annulled` en query + color_type |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/AllRequests.jsx` | Botón Anular + modal de confirmación + badge `annulled` |
| `frontend/src/pages/MyRequests.jsx` | Badge `annulled` + mostrar motivo |
| `frontend/src/pages/Dashboard.jsx` | Badge `annulled` en historial |
| `frontend/src/pages/PendingApprovals.jsx` | Badge `annulled` en historial |
| `frontend/src/components/CollaboratorDetailModal.jsx` | `color_type: 'annulled'` + motivo visible |
| `frontend/src/pages/NewRequest.jsx` | Habilitar Motivo para vacaciones |

### Base de datos
| Migración | Cuándo ejecutar |
|-----------|-----------------|
| `ALTER TABLE vacation_requests MODIFY COLUMN status ENUM(... 'annulled')` | Antes de desplegar backend |
| `ALTER TABLE vacation_requests ADD COLUMN annulment_reason / annulled_by / annulled_at` | Antes de desplegar backend |

---

## Orden de implementación recomendado

1. **Ejecutar migración SQL** en producción
2. **Backend**: `annulRequest` en controller → ruta en routes
3. **Frontend R3**: habilitar Motivo en NewRequest (cambio mínimo, independiente)
4. **Frontend R1**: botón Anular + modal en AllRequests
5. **Frontend R2**: badges `annulled` en todos los archivos de historial
6. **Backend R2**: actualizar `getEmployeeDetail` para incluir anuladas en movimientos

---

## Ajuste post-implementación — Motivo de anulación como tooltip

**Problema:** El texto del motivo de anulación debajo del badge "Anulada" empuja las columnas Estado y Acciones fuera del ancho visible.

**Solución:** Reemplazar el texto inline por un ícono `Info` de lucide-react con `title={annulment_reason}` que muestra el motivo en un tooltip nativo al hacer hover.

**Archivo:** `frontend/src/pages/AllRequests.jsx`

```jsx
// ANTES — texto inline que rompe el layout:
{getStatusBadge(req.status)}
{req.status === 'annulled' && req.annulment_reason && (
    <p className="text-xs text-gray-400 mt-1 max-w-xs truncate" title={req.annulment_reason}>
        {req.annulment_reason}
    </p>
)}

// DESPUÉS — ícono con tooltip:
<div className="flex items-center gap-2">
    {getStatusBadge(req.status)}
    {req.status === 'annulled' && req.annulment_reason && (
        <span title={req.annulment_reason} className="cursor-help text-gray-400 hover:text-gray-600">
            <Info className="w-4 h-4" />
        </span>
    )}
</div>
```

---

## Consideraciones adicionales

- **`request_history.action`**: verificar que el enum del campo `action` en la tabla `request_history` acepte el valor `'annulled'`. Si no, ejecutar: `ALTER TABLE request_history MODIFY COLUMN action ENUM('created','approved','rejected','cancelled','annulled');`
- **Exportar CSV en Reports**: considerar si las solicitudes anuladas deben verse reflejadas en el CSV de reportes generales (actualmente solo cuenta `status = 'approved'`, comportamiento que debe mantenerse).
- **Icono `Ban`**: importar desde `lucide-react` en los archivos que muestren el badge de anulada.
