# Plan de Implementación — Beneficio Antigüedad en Nueva Solicitud

**Fecha:** 23/05/2026  
**Branch:** main  
**Estado:** BORRADOR — pendiente de revisión

---

## ⚠️ Aclaración antes de implementar

El enunciado indica que la opción se muestra cuando `benefit_extra_day = True` **Y** `benefit_extra_day_used = True`.  
Sin embargo, `benefit_extra_day_used = True` significa que el colaborador **ya gozó** el beneficio este período — mostrarle la opción en ese caso no tiene sentido.

**Se asume que la condición correcta es:**
- `benefit_extra_day = true` → el colaborador es elegible
- `benefit_extra_day_used = false` → aún no ha usado el beneficio este año

**Confirmación solicitada antes de implementar.**

---

## Resumen del cambio

Agregar la opción **"Beneficio Antigüedad"** en el formulario de Nueva Solicitud para colaboradores elegibles. Es 1 día extra de vacaciones por año (no descuenta del saldo base), aplica a quienes llevan 3+ años en la empresa. RRHH activa el campo `benefit_extra_day` manualmente. Al ser aprobada, el sistema marca `benefit_extra_day_used = true`. El 1 de enero de cada año se resetea automáticamente.

---

## Reglas de negocio

| Regla | Detalle |
|---|---|
| Visibilidad | Solo si `benefit_extra_day = true` Y `benefit_extra_day_used = false` |
| Duración | Exactamente 1 día completo |
| Medio día | Opción "Solo medio día" deshabilitada al seleccionar este tipo |
| Fecha fin | Se iguala automáticamente a la fecha de inicio |
| Descuento | **No descuenta** `base_vacation_days` — es informativo (igual que `permission`) |
| Al aprobar | Se marca `benefit_extra_day_used = true` en el colaborador |
| Reset anual | El 1 de enero → `benefit_extra_day_used = false` para todos los elegibles |
| Gestión | RRHH activa `benefit_extra_day` manualmente desde la Ficha del Colaborador en Admin |

---

## Cambios requeridos

### 1. Base de datos — migración SQL

```sql
ALTER TABLE vacation_requests
MODIFY COLUMN request_type
  ENUM('vacation','permission','justified_absence','seniority_benefit') NOT NULL;
```

> Migración no destructiva — los registros existentes no cambian.

**Archivo a actualizar:** `database/schema.sql` — cambiar el DDL del enum.

---

### 2. Backend — `requestController.js`

**Archivo:** `backend/controllers/requestController.js`

#### a) `createRequest` — validación al crear

Agregar bloque de validación para `seniority_benefit` después de extraer los datos del body:

```js
if (request_type === 'seniority_benefit') {
    const [userRows] = await conn.query(
        'SELECT benefit_extra_day, benefit_extra_day_used FROM users WHERE id = ?', [employee_id]
    );
    if (!userRows[0]?.benefit_extra_day) {
        await conn.rollback();
        return res.status(403).json({ message: 'No tienes habilitado el Beneficio Antigüedad.' });
    }
    if (userRows[0]?.benefit_extra_day_used) {
        await conn.rollback();
        return res.status(400).json({ message: 'Ya gozaste el Beneficio Antigüedad en el período actual.' });
    }
    const totalDays = date_ranges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);
    if (totalDays !== 1) {
        await conn.rollback();
        return res.status(400).json({ message: 'El Beneficio Antigüedad corresponde exactamente a 1 día completo.' });
    }
}
```

#### b) `makeDecision` — marcar `benefit_extra_day_used` al aprobar

Después de actualizar el status de la solicitud, agregar:

```js
if (decision === 'approved' && requestArr[0].request_type === 'seniority_benefit') {
    await db.query(
        'UPDATE users SET benefit_extra_day_used = 1 WHERE id = ?',
        [requestArr[0].employee_id]
    );
}
```

#### c) `processApprovalToken` — mismo marcado desde link de email

Después de `UPDATE vacation_requests SET status = ...`, agregar:

```js
if (decision === 'approved' && fullRequest[0].request_type === 'seniority_benefit') {
    await db.query(
        'UPDATE users SET benefit_extra_day_used = 1 WHERE id = ?',
        [fullRequest[0].employee_id]
    );
}
```

> **Nota:** `processApprovalToken` usa `db` directamente (no `conn`), ya que no está en una transacción explícita. El marcado de `benefit_extra_day_used` es seguro hacerlo en esa secuencia.

---

### 3. Backend — nuevo cron job anual

**Archivo nuevo:** `backend/jobs/annualBenefitReset.js`

```js
const cron = require('node-cron');
const db = require('../config/db');

function startAnnualBenefitReset() {
    // 1 de enero a las 00:05am hora Guatemala (UTC-6 = 06:05 UTC)
    cron.schedule('5 6 1 1 *', async () => {
        console.log('[CRON] Iniciando reset anual de benefit_extra_day_used...');
        try {
            const [result] = await db.query(
                'UPDATE users SET benefit_extra_day_used = 0 WHERE benefit_extra_day = 1'
            );
            console.log(`[CRON] Reset anual completado: ${result.affectedRows} colaborador(es) actualizados.`);
        } catch (err) {
            console.error('[CRON] Error en reset anual de beneficio:', err);
        }
    }, { timezone: 'America/Guatemala' });

    console.log('[CRON] Job de reset anual de beneficio registrado (1 de enero a las 00:05am, Guatemala).');
}

module.exports = { startAnnualBenefitReset };
```

**Archivo:** `backend/server.js` — registrar el nuevo cron junto al mensual:

```js
const { startAnnualBenefitReset } = require('./jobs/annualBenefitReset');
// dentro del callback de app.listen:
startAnnualBenefitReset();
```

---

### 4. Frontend — `NewRequest.jsx`

**Archivo:** `frontend/src/pages/NewRequest.jsx`

#### a) Variable de elegibilidad

```js
const isSeniorityBenefit = formData.request_type === 'seniority_benefit';
const showSeniorityOption = user?.benefit_extra_day && !user?.benefit_extra_day_used;
```

#### b) Opción condicional en el select de tipo

```jsx
<option value="vacation">Vacaciones</option>
<option value="permission">Permiso Personal</option>
<option value="justified_absence">Ausencia Justificada</option>
{showSeniorityOption && (
    <option value="seniority_benefit">Beneficio Antigüedad</option>
)}
```

#### c) `handleChange` — forzar 1 día al seleccionar el tipo

```js
if (name === 'request_type') {
    if (value === 'vacation') {
        setFormData({ ...formData, request_type: value, reason: '' });
    } else if (value === 'seniority_benefit') {
        setFormData({ ...formData, request_type: value, reason: '', date_to: formData.date_from });
        setHalfDay(false);
    } else {
        setFormData({ ...formData, [name]: value });
    }
    return;
}
// también en el onChange de date_from: si tipo=seniority_benefit, igualar date_to
if (name === 'date_from' && isSeniorityBenefit) {
    setFormData({ ...formData, date_from: value, date_to: value });
    return;
}
```

#### d) Checkbox "Solo medio día" — deshabilitar

```jsx
<input
    id="half_day"
    type="checkbox"
    checked={halfDay}
    disabled={isSeniorityBenefit}
    onChange={(e) => setHalfDay(e.target.checked)}
    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
/>
<label htmlFor="half_day" className={`text-sm font-medium cursor-pointer ${isSeniorityBenefit ? 'text-gray-400' : 'text-gray-700'}`}>
    Solo medio día — el último día del rango cuenta como <strong>0.5</strong>
    {isSeniorityBenefit && <span className="ml-2 text-xs font-normal">(no aplica para Beneficio Antigüedad)</span>}
</label>
```

#### e) Campo "Días hábiles" — texto diferenciado

```jsx
<p className="text-sm text-blue-700">
    {isSeniorityBenefit
        ? <>Beneficio Antigüedad: <strong>1 día completo</strong></>
        : <>Días hábiles a descontar: <strong>{businessDays} {businessDays === 1 ? 'día' : 'días'}</strong>{halfDay && <span className="ml-2 text-blue-500">(incluye medio día final)</span>}</>
    }
</p>
```

#### f) Campo "Motivo / Justificación" — tratar igual que vacaciones (disabled)

Extender la variable `isVacation` o crear una separada:

```js
const reasonDisabled = formData.request_type === 'vacation' || formData.request_type === 'seniority_benefit';
```

Usar `reasonDisabled` donde hoy se usa `isVacation` para controlar el estado del textarea.

---

### 5. Frontend — etiquetas en toda la UI

Agregar `'seniority_benefit': 'Beneficio Antigüedad'` al mapa de tipos en:

| Archivo | Elemento afectado |
|---|---|
| `frontend/src/pages/MyRequests.jsx` | Badge de tipo de solicitud |
| `frontend/src/pages/AllRequests.jsx` | Columna "Tipo" en tabla |
| `frontend/src/pages/PendingApprovals.jsx` | Card de la solicitud |
| `frontend/src/pages/Reports.jsx` | Columna tipo en reporte general |
| `frontend/src/components/CollaboratorDetailModal.jsx` | Historial de movimientos |
| `frontend/src/pages/Dashboard.jsx` | Timeline de movimientos |

---

### 6. Frontend — color para `seniority_benefit`

Usar **ámbar** (igual que el badge de "★ Aplica" en Admin) para distinguirlo visualmente:

| Archivo | Color |
|---|---|
| `Dashboard.jsx` | `bg-amber-50 border-amber-200 text-amber-700` |
| `CollaboratorDetailModal.jsx` | `bg-amber-50 text-amber-700` |

---

## Archivos que se modificarán

| Archivo | Tipo de cambio |
|---|---|
| `database/schema.sql` | Enum — agregar `seniority_benefit` |
| `backend/controllers/requestController.js` | Validación al crear + marcar `used` al aprobar (portal y token) |
| `backend/jobs/annualBenefitReset.js` | **Nuevo** — cron de reset anual el 1 de enero |
| `backend/server.js` | Registrar `startAnnualBenefitReset` |
| `frontend/src/pages/NewRequest.jsx` | Opción condicional + deshabilitar medio día + forzar 1 día |
| `frontend/src/pages/MyRequests.jsx` | Label del tipo |
| `frontend/src/pages/AllRequests.jsx` | Label del tipo |
| `frontend/src/pages/PendingApprovals.jsx` | Label del tipo |
| `frontend/src/pages/Reports.jsx` | Label del tipo |
| `frontend/src/components/CollaboratorDetailModal.jsx` | Label + color |
| `frontend/src/pages/Dashboard.jsx` | Color para nuevo tipo |
| `CLAUDE.md` | Actualizar documentación |

---

## Orden de implementación

1. Migración SQL (enum) + actualizar `schema.sql`
2. `requestController.js` — validaciones al crear + marcar `used` en ambas rutas de aprobación
3. `annualBenefitReset.js` (nuevo) + registrar en `server.js`
4. `NewRequest.jsx` — opción condicional, disable medio día, forzar 1 día
5. Labels en `MyRequests`, `AllRequests`, `PendingApprovals`, `Reports`
6. Colores en `Dashboard` y `CollaboratorDetailModal`
7. `CLAUDE.md`

---

## Pasos en producción (después de merge)

1. `git pull origin main`
2. Reiniciar backend
3. Ejecutar migración SQL:

```sql
ALTER TABLE vacation_requests
MODIFY COLUMN request_type
  ENUM('vacation','permission','justified_absence','seniority_benefit') NOT NULL;
```
