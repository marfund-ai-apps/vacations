# Plan de Actualización — Reporte de Equipo para Supervisores

## Estado: COMPLETADO ✓

| # | Requerimiento | Estado |
|---|---------------|--------|
| R1 | Crear endpoint `/reports/team` en backend | ✅ Implementado |
| R2 | Crear componente `TeamReport.jsx` en frontend | ✅ Implementado |
| R3 | Agregar ruta `/reports/team` en App.jsx | ✅ Implementado |
| R4 | Actualizar Navbar con "Reporte de Equipo" (solo manager) | ✅ Implementado |
| R5 | Proteger ruta con middleware (solo manager) | ✅ Implementado |

---

## Commit

| Hash | Descripción |
|------|-------------|
| `d900f92` | feat: reporte de equipo para supervisores (managers) |

---

## Objetivo

Crear un reporte **idéntico** al actual `/reports` (Reportes Generales) pero con filtrado automático por supervisor. Los managers (supervisores) verán SOLO a sus colaboradores diretos, sin necesidad de usar el filtro "Supervisor/Coordinador".

---

## Contexto actual

**Ruta actual:** `/reports` (Reportes Generales)
- **Roles permitidos:** `hr_admin`, `super_admin`
- **Funcionalidad:** Muestra todos los colaboradores de la organización
- **Filtros:** Año, Mes, Supervisor, Tipo (Vacaciones/Permisos/Ausencias/Beneficio), Beneficio Antigüedad
- **Backend:** Endpoint `GET /api/reports/all?year=2026&month=0`

---

## Solución propuesta

### R1 — Endpoint `/api/reports/team`

**Ubicación:** `backend/controllers/reportController.js`

Nueva función `getTeamReport`:

```js
exports.getTeamReport = async (req, res) => {
  const managerId = req.user.id;  // Manager autenticado
  const year = req.query.year || new Date().getFullYear();
  const month = parseInt(req.query.month) || 0;

  const monthCondition = month > 0 ? 'AND MONTH(vr.created_at) = ?' : '';
  const params = month > 0 ? [managerId, year, month] : [managerId, year];

  try {
    const [rows] = await db.query(`
      SELECT
        u.id, u.full_name, u.email, u.employee_number, u.position,
        u.base_vacation_days, u.manager_id, u.benefit_extra_day,
        m.full_name as manager_name, m.role as manager_role,
        COALESCE(SUM(CASE WHEN vr.request_type = 'vacation'           AND vr.status = 'approved' THEN rdr.business_days ELSE 0 END), 0) as vacation_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'permission'         AND vr.status = 'approved' THEN rdr.business_days ELSE 0 END), 0) as permission_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'justified_absence'  AND vr.status = 'approved' THEN rdr.business_days ELSE 0 END), 0) as absence_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'seniority_benefit'  AND vr.status = 'approved' THEN rdr.business_days ELSE 0 END), 0) as seniority_benefit_days,
        COALESCE(SUM(CASE WHEN uda.adjustment_type IN ('monthly_auto', 'manual') THEN uda.days_added ELSE 0 END), 0) as extra_days
      FROM users u
      LEFT JOIN users m ON u.manager_id = m.id
      LEFT JOIN vacation_requests vr ON u.id = vr.employee_id
        AND YEAR(vr.created_at) = ?
        ${monthCondition}
      LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
      LEFT JOIN user_day_adjustments uda ON u.id = uda.user_id
        AND uda.adjustment_type IN ('monthly_auto', 'manual')
      WHERE u.manager_id = ?
      GROUP BY u.id, u.full_name, u.email, u.employee_number, u.position, 
               u.base_vacation_days, u.manager_id, u.benefit_extra_day,
               m.full_name, m.role
      ORDER BY u.full_name
    `, params);

    res.json({ employees: rows });
  } catch (error) {
    console.error('Error en getTeamReport:', error);
    res.status(500).json({ message: 'Error obteniendo reporte del equipo' });
  }
};
```

**Cambios en archivo:**
| Archivo | Cambio |
|---------|--------|
| `backend/controllers/reportController.js` | Nueva función `getTeamReport` (exportada) |

**Ruta en backend:**
| Archivo | Cambio |
|---------|--------|
| `backend/routes/reportRoutes.js` | Nueva ruta: `router.get('/team', requireRole('manager'), reportController.getTeamReport);` |

---

### R2 — Componente `TeamReport.jsx`

**Ubicación:** `frontend/src/pages/TeamReport.jsx`

Una **copia casi idéntica** de `Reports.jsx` con cambios mínimos:

**Cambios respecto a Reports.jsx:**

1. **Import `useAuth`:**
   ```jsx
   import { useAuth } from '../context/AuthContext';
   const { user } = useAuth();
   ```

2. **Cambiar endpoint:** de `/reports/all` a `/reports/team`
   ```js
   const res = await api.get(`/reports/team?${params}`);
   ```

3. **Eliminar `selectedManager` y el filtro de Supervisor:**
   - Remover estado `selectedManager`
   - Remover array `managers` (useMemo)
   - Remover filtro client-side que compara `emp.manager_id`
   - Remover el `<select>` de "Supervisor/Coordinador" del UI

4. **Título y descripción:**
   - Cambiar `<h1>` a "Reporte de Mi Equipo"
   - Descripción: "Resumen de colaboradores bajo tu supervisión"

5. **CSV export:**
   - Cambiar nombre de archivo: `reporte_equipo_${year}_${month || 'todos'}.csv`
   - El nombre del usuario ya va implícito (es su equipo)

**Lógica igual:**
- Filtros de Año, Mes, Tipo, Beneficio Antigüedad (TODOS se mantienen)
- Tabla con mismas columnas: Código, Colaborador, Supervisor, Días Base, Vacaciones, Permisos, Ausencias, B. Antigüedad, Saldo Final
- Badge de beneficio (usado/disponible)
- Exportar CSV con filtros aplicados

---

### R3 — Agregar ruta en App.jsx

**Ubicación:** `frontend/src/App.jsx`

Agregar nueva ruta protegida:

```jsx
import TeamReport from './pages/TeamReport';

<ProtectedRoute path="/reports/team" element={<TeamReport />} allowedRoles={['manager']} />
```

---

### R4 — Actualizar Navbar

**Ubicación:** `frontend/src/components/layout/Navbar.jsx`

**Cambios:**

1. En array `REPORT_ITEMS`, agregar nuevo item:
```js
const REPORT_ITEMS = [
    { name: 'Reporte General', href: '/reports', icon: FileBarChart2, description: 'Resumen de todos los colaboradores', roles: ['hr_admin', 'super_admin'] },
    { name: 'Reporte de Equipo', href: '/reports/team', icon: FileBarChart2, description: 'Resumen de tu equipo', roles: ['manager'] },
];
```

2. Cambiar variable `showReportsMenu` para incluir `manager`:
```js
const showReportsMenu = ['manager', 'hr_admin', 'super_admin'].includes(user?.role);
```

3. En el renderizado de `REPORT_ITEMS`, filtrar por roles:
```jsx
{REPORT_ITEMS.filter(item => item.roles.includes(user?.role)).map(item => (...))}
```

---

### R5 — Protección de ruta

**Ubicación:** `frontend/src/components/ProtectedRoute.jsx`

La ruta ya está protegida con `ProtectedRoute` en App.jsx. El parámetro `allowedRoles={['manager']}` solo permite managers.

**Backend:** El middleware `requireRole('manager')` en la ruta `/api/reports/team` permite solo managers.

---

## Matriz de permisos

| Rol | `/reports` (Reportes Generales) | `/reports/team` (Reporte Equipo) | Ver en Navbar |
|-----|--------------------------------|--------------------------------|---------------|
| `employee` | ❌ No | ❌ No | ❌ No |
| `manager` | ❌ No | ✅ Sí (su equipo) | ✅ "Reporte de Equipo" |
| `hr_admin` | ✅ Sí (todos) | ❌ No | ✅ "Reporte General" |
| `super_admin` | ✅ Sí (todos) | ❌ No | ✅ "Reporte General" |

---

## Resumen de archivos a modificar

### Backend
| Archivo | Cambio |
|---------|--------|
| `backend/controllers/reportController.js` | Nueva función `getTeamReport` |
| `backend/routes/reportRoutes.js` | Nueva ruta `GET /team` con `requireRole('manager')` |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/TeamReport.jsx` | Nuevo componente (copia modificada de Reports.jsx) |
| `frontend/src/App.jsx` | Nueva ruta `ProtectedRoute` para `/reports/team` |
| `frontend/src/components/layout/Navbar.jsx` | Agregar item "Reporte de Equipo" al dropdown, incluir `roles` en items |

---

## Comportamiento esperado

**Patricia Cabrera** (manager):
1. Accede a `/reports/team`
2. Ve SOLO sus 6 colaboradores directos: Cristina Monzón, Edgar Chali, Lilian Boteo, Matilde Tox, Cristina Fernández, Recursos Humanos
3. Puede filtrar por Año, Mes, Tipo de movimiento, Beneficio
4. El filtro "Supervisor/Coordinador" NO está visible (su supervisor es "Judith Adriana Morales López" — no puede filtrar por otros supervisores)
5. Puede exportar CSV de sus colaboradores

**María José González** (super_admin):
1. Accede a `/reports` (Reportes Generales)
2. Ve TODOS los colaboradores (comportamiento actual sin cambios)

---

## Notas técnicas

- La query en `getTeamReport` es casi idéntica a `getAllEmployeesReport`, pero con `WHERE u.manager_id = ?` (el ID del manager autenticado) en lugar de sin filtro
- Los `GROUP BY` incluyen `u.manager_id` para que los managers puedan verse a sí mismos si están bajo supervisión
- El `month` parameter funciona idéntico al reporte general
- El CSV export incluye solo los colaboradores filtrados del equipo

---

## Plan de implementación

1. **Paso 1:** Revisar y aprobar plan
2. **Paso 2:** Implementar R1 (backend: función + ruta)
3. **Paso 3:** Implementar R2 (frontend: componente TeamReport.jsx)
4. **Paso 4:** Implementar R3 (App.jsx: agregar ruta)
5. **Paso 5:** Implementar R4 (Navbar: agregar item)
6. **Paso 6:** Testing en dev
7. **Paso 7:** Deploy y testing en producción
