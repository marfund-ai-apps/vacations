# Plan de Actualización 22/06/2026 — Ajustes Finales

## Estado: COMPLETADO ✓

| # | Requerimiento | Estado |
|---|---------------|--------|
| R1 | Editar employee_number desde la Ficha del Colaborador | ✅ Implementado |
| R2 | ~~Auto-incremento de código de usuario al crear colaboradores~~ | ❌ Cancelado (R1 es suficiente) |
| R3 | Bug: Días Disponibles no suma los días agregados | ✅ Implementado |

---

## R1 — Editar `employee_number` desde la Ficha del Colaborador

### Problema

En el modal de edición (Ficha del Colaborador), el campo `employee_number` aparece como **badge de solo lectura** en el encabezado. No hay campo editable para modificarlo.

En `handleOpenEdit` (Admin.jsx línea 136), `editForm` NO incluye `employee_number`:
```js
setEditForm({
    full_name: u.full_name || '',
    position: u.position || '',
    role: u.role,
    // ← employee_number ausente aquí
    ...
});
```

En `handleSaveEdit` (línea 155) se usa `editModal.employee_number` (read-only del objeto original), no del formulario.

### Solución

**`frontend/src/pages/Admin.jsx`** — 3 cambios:

1. `handleOpenEdit`: agregar `employee_number: u.employee_number || ''` al estado `editForm`
2. Modal "Información Personal": agregar campo `<input>` para `employee_number` entre Nombre y Puesto
3. `handleSaveEdit`: cambiar `employee_number: editModal.employee_number` → `employee_number: editForm.employee_number`

El backend (`updateUser` en userController.js) ya recibe y guarda `employee_number` en el UPDATE ✓

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/Admin.jsx` | Agregar `employee_number` a `editForm` + campo editable en modal |

---

## R2 — Auto-incremento de código de usuario (`employee_number`)

### Problema

Al crear un colaborador desde Admin, el campo "Código" queda vacío por defecto. El administrador debe ingresar el código manualmente sin saber cuál sigue. El próximo código es **1143** (último asignado: 1142).

### Solución

**Backend — nueva función y endpoint:**

`backend/controllers/userController.js` — nueva función `getNextEmployeeNumber`:
```js
async function getNextEmployeeNumber() {
    const [rows] = await db.query(
        "SELECT MAX(CAST(employee_number AS UNSIGNED)) as max_num FROM users WHERE employee_number REGEXP '^[0-9]+$'"
    );
    const max = parseInt(rows[0].max_num) || 1142;
    return String(max + 1);
}

exports.getNextEmployeeNumber = async (req, res) => {
    try {
        const next = await getNextEmployeeNumber();
        res.json({ next_employee_number: next });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el siguiente código' });
    }
};
```

`backend/controllers/userController.js` — en `createUser`: si no se envía `employee_number`, auto-generar:
```js
const empNumber = employee_number || await getNextEmployeeNumber();
// usar empNumber en el INSERT
```

`backend/routes/userRoutes.js` — nuevo endpoint (ANTES de `/:id` para no colisionar):
```js
router.get('/next-employee-number', requireRole('hr_admin', 'super_admin'), userController.getNextEmployeeNumber);
```

**Frontend — pre-llenar el campo al abrir creación:**

`frontend/src/pages/Admin.jsx`:
- Nuevo estado: `const [nextEmpNumber, setNextEmpNumber] = useState('');`
- Modificar el botón "Agregar Colaborador": al hacer click, llama `GET /api/users/next-employee-number` y pre-llena `newForm.employee_number`
- El campo sigue siendo editable (el admin puede cambiar el código si necesita)

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/controllers/userController.js` | `getNextEmployeeNumber()` + export + auto-asignar en `createUser` |
| `backend/routes/userRoutes.js` | `GET /next-employee-number` |
| `frontend/src/pages/Admin.jsx` | Llamar endpoint al abrir creación, pre-llenar campo |

---

## R3 — Bug: Días Disponibles no refleja los Días Agregados

### Problema reportado

| KPI | Valor mostrado | Esperado |
|-----|---------------|----------|
| Saldo Inicial | 7.5 | 7.5 |
| Días Agregados | +2.5 | +2.5 |
| Días Consumidos | -0 | -0 |
| **Días Disponibles** | **7.5** | **10** |

### Análisis de causa raíz

El sistema tiene una doble escritura inconsistente:

- El **cron mensual** hace DOS acciones: (1) `UPDATE users SET base_vacation_days = base_vacation_days + 1.25` y (2) inserta registro `monthly_auto` en `user_day_adjustments`
- Los **ajustes manuales** también hacen DOS acciones: (1) `UPDATE users SET base_vacation_days = base_vacation_days + ?` y (2) insertan en `user_day_adjustments`
- La **importación de saldos** SETEA `base_vacation_days` al valor del CSV (sobrescribe lo acumulado)

Resultado cuando el import corre **después** de que el cron ya acumuló días:
- `base_vacation_days` queda en 7.5 (el valor del CSV, sin los incrementos anteriores)
- Los registros `monthly_auto` de 2.5 siguen en `user_day_adjustments`
- La fórmula actual `available = base_vacation_days - vacation_consumed = 7.5 - 0 = 7.5` no suma los 2.5

### Diseño original (CLAUDE.md)

> Balance = `base_vacation_days + SUM(adjustments.days_added) - consumed_vacation_days`

La implementación del cron NO sigue este diseño: agrega a `base_vacation_days` en lugar de solo registrar en adjustments. Esto hace que `base_vacation_days` mezcle "saldo base" con "incrementos acumulados".

### Solución arquitectónica

**Separar `base_vacation_days` de los incrementos:**

| Componente | Comportamiento actual | Comportamiento nuevo |
|------------|----------------------|---------------------|
| `base_vacation_days` | Se actualiza con cada cron y ajuste manual | Solo se setea al crear usuario o importar saldos |
| Cron mensual | UPDATE base + INSERT adjustment | Solo INSERT adjustment |
| Ajuste manual | UPDATE base + INSERT adjustment | Solo INSERT adjustment |
| Importación | SET base = valor CSV | SET base = valor CSV (sin cambio) |
| Fórmula disponibles | `base - vacation` | `base + SUM(adjustments) - vacation` |

**Cambios en código:**

`backend/jobs/monthlyVacationIncrement.js` — ELIMINAR:
```js
await conn.query(
    'UPDATE users SET base_vacation_days = base_vacation_days + 1.25 WHERE is_active = 1'
);
```
(Solo queda el INSERT en user_day_adjustments)

`backend/controllers/userController.js` (`addDayAdjustment`) — ELIMINAR:
```js
await conn.query(
    'UPDATE users SET base_vacation_days = base_vacation_days + ? WHERE id = ?',
    [parseFloat(days_added), id]
);
```

`backend/controllers/reportController.js` (`getMyReport`) — cambiar fórmula:
```js
// Agregar query para todos los ajustes del usuario (no solo monthly_auto)
const [allAdjustments] = await db.query(
    'SELECT COALESCE(SUM(days_added), 0) as total FROM user_day_adjustments WHERE user_id = ?',
    [id]
);
const totalAdjustmentDays = parseFloat(allAdjustments[0].total) || 0;

// Días Disponibles = base + SUM(todos los ajustes) - vacaciones aprobadas
const availableDays = baseDays + totalAdjustmentDays - vacationConsumed;
```

`backend/controllers/reportController.js` (`getEmployeeDetail`) — actualizar el resumen:
- `consumed_days` y `available_days` deben usar la misma lógica

### Migración de datos (CRÍTICO — ejecutar UNA SOLA VEZ antes del deploy)

Para usuarios donde el cron YA actualizó `base_vacation_days`, restar lo que ya está acumulado en adjustments para evitar doble conteo:

```sql
-- Verificar antes de ejecutar (solo debe correrse UNA VEZ)
-- Muestra cómo quedaría cada usuario:
SELECT 
    u.id,
    u.full_name,
    u.base_vacation_days as base_actual,
    COALESCE(SUM(uda.days_added), 0) as total_adjustments,
    u.base_vacation_days - COALESCE(SUM(uda.days_added), 0) as base_nuevo
FROM users u
LEFT JOIN user_day_adjustments uda ON uda.user_id = u.id
GROUP BY u.id, u.full_name, u.base_vacation_days
ORDER BY u.full_name;

-- Ejecutar migración:
UPDATE users u
SET base_vacation_days = base_vacation_days - COALESCE((
    SELECT SUM(days_added) FROM user_day_adjustments WHERE user_id = u.id
), 0);
```

> ⚠️ **Importante:** Verificar con el SELECT primero que ningún usuario quede en negativo. Si alguno queda negativo, significa que su `base_vacation_days` ya fue reseteado por un import previo (como el caso del bug) y necesita corrección manual.

### Impacto en Admin UI

El campo "Días Base de Vacaciones" en la Ficha del Colaborador sigue siendo editable y representa el **saldo base inicial** del colaborador. El cron ya no lo modifica; el admin puede ajustarlo manualmente si necesita correcciones.

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/jobs/monthlyVacationIncrement.js` | Eliminar `UPDATE users SET base_vacation_days` |
| `backend/controllers/userController.js` | Eliminar `UPDATE users SET base_vacation_days` en `addDayAdjustment` |
| `backend/controllers/reportController.js` | Fórmula `availableDays = base + SUM(adjustments) - vacation` en `getMyReport` y `getEmployeeDetail` |

---

## Resumen de archivos a modificar

### Backend
| Archivo | Requerimiento | Cambio |
|---------|---------------|--------|
| `backend/controllers/userController.js` | R1, R2, R3 | `getNextEmployeeNumber()`, `createUser` auto-genera, `addDayAdjustment` sin UPDATE base |
| `backend/routes/userRoutes.js` | R2 | `GET /next-employee-number` |
| `backend/jobs/monthlyVacationIncrement.js` | R3 | Eliminar UPDATE base_vacation_days |
| `backend/controllers/reportController.js` | R3 | Nueva fórmula disponibles en `getMyReport` y `getEmployeeDetail` |

### Frontend
| Archivo | Requerimiento | Cambio |
|---------|---------------|--------|
| `frontend/src/pages/Admin.jsx` | R1, R2 | Campo editable employee_number en modal + pre-fill al crear |

### Migración SQL
| Script | Cuándo |
|--------|--------|
| `UPDATE users SET base_vacation_days = base - SUM(adjustments)` | **Antes** de reiniciar el backend en producción |

---

## Notas adicionales

- **R2**: Si el admin ingresa un código manualmente diferente al sugerido, se respeta. El auto-incremento es solo el valor por defecto.
- **R3**: Después del fix, "Saldo Inicial" mostrará el valor neto del CSV de importación. "Días Agregados" mostrará solo los incrementos mensuales + beneficio antigüedad del año (como ahora). "Días Disponibles" = Saldo Inicial + TODOS los ajustes de días - vacaciones aprobadas.
- La fórmula de `getAllEmployeesReport` (Reportes Generales) usa una lógica diferente (SUM desde SQL directo), no requiere cambios para R3.
