# Plan de Actualización 22/06/2026 — Ajustes Finales

## Estado: COMPLETADO ✓

| # | Requerimiento | Estado |
|---|---------------|--------|
| R1 | Editar employee_number desde la Ficha del Colaborador | ✅ Implementado |
| R2 | ~~Auto-incremento de código de usuario al crear colaboradores~~ | ❌ Cancelado (R1 es suficiente) |
| R3 | Bug: Días Disponibles no suma los días agregados | ✅ Implementado |
| R4 | Renombrar columna "Apoderado" → "Supervisor" en historial | ✅ Implementado |
| R5 | Modal de instrucciones para "Cargar Saldos" | ✅ Implementado |

---

## Commits realizados

| Hash | Descripción |
|------|-------------|
| `acc1ee5` | feat: employee_number editable, fix días disponibles, columna Supervisor |
| `62e39ee` | feat: modal de instrucciones para Cargar Saldos con formato y ejemplo |

---

## R1 — Editar `employee_number` desde la Ficha del Colaborador

### Problema

En el modal de edición (Ficha del Colaborador), el campo `employee_number` aparecía como **badge de solo lectura** en el encabezado. No existía campo editable para modificarlo, y `handleSaveEdit` usaba `editModal.employee_number` (valor fijo del objeto original).

### Solución

**`frontend/src/pages/Admin.jsx`** — 3 cambios:

1. `handleOpenEdit`: agregar `employee_number: u.employee_number || ''` al estado `editForm`
2. Modal "Información Personal": nuevo campo `<input>` editable para `employee_number` (con `font-mono`) entre Nombre Completo y Puesto
3. `handleSaveEdit`: cambiar `employee_number: editModal.employee_number` → se elimina la sobreescritura; `editForm` ya lo incluye en el spread `...editForm`

El backend (`updateUser` en `userController.js`) ya recibía y guardaba `employee_number` en el UPDATE ✓

### Resultado

El supervisor o admin puede editar el Código Colaborador directamente desde la ficha sin necesidad de acceso a la base de datos.

---

## R2 — Auto-incremento de `employee_number` al crear colaboradores

**Decisión:** Cancelado. Con R1 implementado (el campo es editable), el administrador puede asignar el código manualmente. No se implementó auto-incremento.

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

El sistema tenía una doble escritura inconsistente:

- El **cron mensual** hacía DOS cosas: (1) `UPDATE users SET base_vacation_days = base_vacation_days + 1.25` y (2) insertar registro `monthly_auto` en `user_day_adjustments`
- Los **ajustes manuales** también hacían DOS cosas: (1) `UPDATE users SET base_vacation_days + ?` y (2) insertar en `user_day_adjustments`
- La **importación de saldos** SETEA `base_vacation_days` al valor del CSV (sobrescribe lo acumulado)

Resultado cuando el import corre **después** de que el cron ya acumuló días:
- `base_vacation_days` queda en 7.5 (valor del CSV, sin los incrementos previos del cron)
- Los registros `monthly_auto` de 2.5 siguen en `user_day_adjustments`
- La fórmula `available = base - vacation = 7.5 - 0 = 7.5` no incluía los 2.5

### Solución arquitectónica

**`base_vacation_days` = solo el saldo importado/inicial. Los incrementos viven únicamente en `user_day_adjustments`.**

| Componente | Antes | Después |
|------------|-------|---------|
| `base_vacation_days` | Se actualizaba con cron y ajustes manuales | Solo se setea al crear usuario o importar saldos |
| Cron mensual | UPDATE base + INSERT adjustment | Solo INSERT adjustment |
| Ajuste manual | UPDATE base + INSERT adjustment | Solo INSERT adjustment |
| Importación | SET base = valor CSV | SET base = valor CSV (sin cambio) |
| Fórmula disponibles | `base - vacation` | `base + SUM(monthly_auto + manual) - vacation` |

> **Nota clave:** `initial_balance` en `user_day_adjustments` es solo histórico y **no** se suma al cálculo de disponibles, porque ese valor ya está capturado en `base_vacation_days`.

### Cambios en código

**`backend/jobs/monthlyVacationIncrement.js`** — eliminado:
```js
await conn.query(
    'UPDATE users SET base_vacation_days = base_vacation_days + 1.25 WHERE is_active = 1'
);
```

**`backend/controllers/userController.js`** (`addDayAdjustment`) — eliminado:
```js
await conn.query(
    'UPDATE users SET base_vacation_days = base_vacation_days + ? WHERE id = ?',
    [parseFloat(days_added), id]
);
```

**`backend/controllers/reportController.js`** (`getMyReport`) — nueva query y fórmula:
```js
// Solo monthly_auto y manual (excluye initial_balance)
const [allAdjSum] = await db.query(
    "SELECT COALESCE(SUM(days_added), 0) as total FROM user_day_adjustments WHERE user_id = ? AND adjustment_type != 'initial_balance'",
    [id]
);
const totalAdjustmentDays = parseFloat(allAdjSum[0].total) || 0;
const availableDays = baseDays + totalAdjustmentDays - vacationConsumed;
```

**`backend/controllers/reportController.js`** (`getEmployeeDetail`) — mismo criterio en el resumen:
```js
const totalAdjDays = adjustments
    .filter(a => a.adjustment_type !== 'initial_balance')
    .reduce((sum, a) => sum + (parseFloat(a.days_added) || 0), 0);

available_days: baseDays + totalAdjDays - consumedDays
```

### Migración SQL (ejecutada en producción el 22/06/2026)

Solo resta los ajustes `monthly_auto` y `manual` de `base_vacation_days`; no toca los `initial_balance`.

```sql
-- PASO 1: Verificar resultado esperado por usuario
SELECT 
    u.id,
    u.full_name,
    u.base_vacation_days AS base_actual,
    COALESCE(SUM(CASE WHEN uda.adjustment_type != 'initial_balance' 
                      THEN uda.days_added END), 0) AS monthly_manual_total,
    u.base_vacation_days 
        - COALESCE(SUM(CASE WHEN uda.adjustment_type != 'initial_balance' 
                            THEN uda.days_added END), 0) AS base_nuevo
FROM users u
LEFT JOIN user_day_adjustments uda ON uda.user_id = u.id
GROUP BY u.id, u.full_name, u.base_vacation_days
ORDER BY u.full_name;

-- PASO 2: Confirmar que ningún usuario queda en negativo
SELECT u.id, u.full_name,
    u.base_vacation_days 
        - COALESCE(SUM(CASE WHEN uda.adjustment_type != 'initial_balance' 
                            THEN uda.days_added END), 0) AS base_nuevo
FROM users u
LEFT JOIN user_day_adjustments uda ON uda.user_id = u.id
GROUP BY u.id, u.full_name, u.base_vacation_days
HAVING base_nuevo < 0;

-- PASO 3: Ejecutar migración
UPDATE users u
SET base_vacation_days = base_vacation_days - COALESCE((
    SELECT SUM(days_added) 
    FROM user_day_adjustments 
    WHERE user_id = u.id AND adjustment_type != 'initial_balance'
), 0);
```

### Resultado para Amy Louise Jones (usuario de prueba)

| Campo | Antes | Después |
|-------|-------|---------|
| `base_vacation_days` en DB | 17.50 | **15.00** |
| `user_day_adjustments` (initial_balance) | 15.00 | 15.00 (sin cambio) |
| `user_day_adjustments` (monthly_auto ×2) | 2.50 | 2.50 (sin cambio) |
| **Días Disponibles en Dashboard** | 17.50 | **17.50** ✓ (15 + 2.5) |

---

## R4 — Renombrar columna "Apoderado" → "Supervisor"

### Problema

En la página **Historial de Solicitudes** (`AllRequests.jsx`), la columna que muestra el supervisor aparecía con el texto "Apoderado", terminología incorrecta para el sistema.

### Solución

**`frontend/src/pages/AllRequests.jsx`** — cambiadas 2 ocurrencias (líneas 129 y 184):

```jsx
// Antes
<th ...>Apoderado</th>

// Después
<th ...>Supervisor</th>
```

---

## R5 — Modal de instrucciones para "Cargar Saldos"

### Problema

El botón "Cargar Saldos" abría directamente el selector de archivos sin ninguna indicación sobre qué formato o columnas debía tener el archivo. Un usuario nuevo no sabía qué preparar.

### Solución

**`frontend/src/pages/Admin.jsx`** — nuevo flujo:

**Antes:** botón `<label>` con `<input type="file">` oculto → abría file picker directo

**Después:** botón normal → abre modal de instrucciones → modal contiene el file picker

El modal incluye:
- Formatos aceptados: `.csv` o `.xlsx`
- Tabla de columnas requeridas con descripción de cada una
- Ejemplo visual de archivo (fondo oscuro, estilo terminal):
  ```
  No. Colaborador,Saldo Inicial
  1110,15.00
  1111,12.50
  1142,7.50
  ```
- Tres notas de ayuda (previsualización antes de guardar, color amarillo = no encontrado, sensible a mayúsculas)
- Botón "Seleccionar archivo" en el footer del modal que lanza el file picker

Al seleccionar el archivo, el modal se cierra automáticamente y abre la previsualización existente (flujo de dos pasos sin cambios).

### Cambios técnicos

- Nuevo estado `importInfoModal` (boolean)
- `handleImportFileSelected`: agrega `setImportInfoModal(false)` al inicio
- Botón toolbar: de `<label>` con input oculto a `<button onClick={() => setImportInfoModal(true)}>`
- Input `type="file"` ahora vive dentro del modal, acepta `.csv,.xlsx`

---

## Resumen de archivos modificados

### Backend
| Archivo | Cambio |
|---------|--------|
| `backend/controllers/userController.js` | R3: eliminar `UPDATE base_vacation_days` en `addDayAdjustment` |
| `backend/jobs/monthlyVacationIncrement.js` | R3: eliminar `UPDATE base_vacation_days` del cron mensual |
| `backend/controllers/reportController.js` | R3: fórmula `base + SUM(monthly_auto+manual) - vacation` en `getMyReport` y `getEmployeeDetail` |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/Admin.jsx` | R1: `employee_number` editable en Ficha; R5: modal instrucciones Cargar Saldos |
| `frontend/src/pages/AllRequests.jsx` | R4: columna "Apoderado" → "Supervisor" |

### Migración SQL en producción
| Script | Ejecutado |
|--------|-----------|
| Restar `monthly_auto + manual` de `base_vacation_days` | ✅ 22/06/2026 |
