# Plan — Reporte de Equipos para Supervisores (jerárquico)

> **Objetivo:** un nuevo reporte, similar a *"Reporte de Mi Equipo"*, pero que además muestra los equipos de los **sub-supervisores** que dependen del supervisor logueado. Es decir: un supervisor ve a sus colaboradores directos **y**, recursivamente, los equipos de aquellos colaboradores que a su vez tienen gente a su cargo.
>
> **Autor:** (equipo de desarrollo) · **Fecha:** 2026-09-28 · **Estado:** Propuesta (pendiente de aprobación)

---

## 1. Contexto — ejemplo funcional

Estructura organizacional (campo `users.manager_id`):

```
Judith Morales (supervisora)
├── Amy Jones
├── Ximena Flamenco
├── Elisa Blanda
└── Claudia Ruiz        ← también es supervisora
    ├── André Herrera
    ├── Claudia V. Alejandra
    └── María José Gonzalez
```

**Comportamiento esperado:** Judith puede ver el reporte de **su equipo directo** (Amy, Ximena, Elisa, Claudia Ruiz) **y también** el **equipo de Claudia Ruiz** (André, Claudia V., María José), porque Claudia Ruiz tiene colaboradores a su cargo. Si esos sub-colaboradores tuvieran a su vez gente a cargo, también se incluirían (recursivo, sin límite de niveles).

---

## 2. Estado actual (qué ya existe)

| Componente | Ubicación | Comportamiento actual |
|------------|-----------|------------------------|
| Backend controller | `backend/controllers/reportController.js` → `getTeamReport` | Devuelve **solo reportes directos**: `WHERE u.manager_id = ?` (el logueado) |
| Ruta backend | `backend/routes/reportRoutes.js` | `GET /api/reports/team` — `requireRole('manager')` |
| Página frontend | `frontend/src/pages/TeamReport.jsx` | "Reporte de Mi Equipo" (año/mes, tabla con Código, Colaborador, Supervisor, Días Base, **Incrementos**, Vacaciones, Permisos, Ausencias, B. Antigüedad, Saldo Final, CSV) |
| Ruta frontend | `frontend/src/App.jsx` | `/reports/team` |
| Navbar | `frontend/src/components/layout/Navbar.jsx` → `REPORT_ITEMS` | "Reporte de Equipo" visible para `manager` |

**Datos que ya devuelve `getTeamReport` por colaborador** (reutilizables): `id, full_name, email, employee_number, position, base_vacation_days, manager_id, manager_name, benefit_extra_day, vacation_days, permission_days, absence_days, seniority_benefit_days, extra_days`.

**Regla de negocio de saldo (ya vigente):** `Saldo Final = base_vacation_days + extra_days − vacation_days`. Solo `vacation` aprobada descuenta.

---

## 3. Alcance

### 3.1 Incluye
- Nuevo reporte **"Reporte de Equipos"** (nombre tentativo; ver §8) que arma el **árbol descendente completo** del supervisor logueado.
- Agrupación visual **por sub-equipo**: una sección por cada supervisor del árbol (empezando por el equipo directo del logueado), con encabezado "Equipo de \<Supervisor\>".
- Reutiliza las **mismas columnas** que "Reporte de Mi Equipo" (incluida la corrección de Incrementos + Saldo Final ya aplicada).
- Filtros **Año** y **Mes** (igual que hoy).
- Exportar **CSV** con una columna extra "Equipo de" (nombre del supervisor inmediato de cada fila).
- **Degradación elegante:** si el supervisor **no** tiene sub-supervisores, el reporte se ve igual que "Reporte de Mi Equipo" (una sola sección).

### 3.2 No incluye (fuera de alcance por ahora)
- Edición de estructura organizacional (eso vive en Admin → Ficha, campo Supervisor).
- Aprobación/anulación de solicitudes desde este reporte (es solo lectura).
- Los filtros "Solo con Beneficio Antigüedad" y "Mostrar solo empleados con…" (ya ocultos en la vista de supervisores).

---

## 4. Diseño Backend

### 4.1 Nuevo endpoint
```
GET /api/reports/team-hierarchy?year=2026&month=0
requireRole('manager', 'hr_admin', 'super_admin')
```
- **Raíz del árbol** = `req.user.id` (el supervisor logueado). No se acepta `id` por querystring (evita que un manager espíe otro árbol).
- `year`/`month` funcionan igual que en `getTeamReport`.

> Alternativa: reutilizar `GET /api/reports/team?scope=hierarchy`. Se prefiere endpoint separado (`team-hierarchy`) para no cambiar el contrato del existente y mantener claridad.

### 4.2 Controller: `getTeamHierarchyReport`
Estrategia: **CTE recursiva de MySQL 8.0** para obtener todos los descendientes del supervisor, y luego la misma agregación de días que `getTeamReport`.

```sql
WITH RECURSIVE team_tree AS (
    -- Nivel 0: reportes directos del supervisor logueado
    SELECT id, manager_id, 1 AS depth
    FROM users
    WHERE manager_id = ? AND is_active = 1

    UNION ALL

    -- Descendientes: colaboradores cuyo jefe ya está en el árbol
    SELECT u.id, u.manager_id, tt.depth + 1
    FROM users u
    JOIN team_tree tt ON u.manager_id = tt.id
    WHERE u.is_active = 1 AND tt.depth < 10   -- cota de seguridad anti-ciclos
)
SELECT
    u.id, u.full_name, u.email, u.employee_number, u.position,
    u.base_vacation_days, u.manager_id, u.benefit_extra_day,
    m.full_name AS manager_name,
    tt.depth,
    -- ¿este colaborador es a su vez supervisor de alguien activo?
    EXISTS (SELECT 1 FROM users s WHERE s.manager_id = u.id AND s.is_active = 1) AS is_supervisor,
    COALESCE(SUM(CASE WHEN vr.request_type='vacation'          AND vr.status='approved' THEN rdr.business_days ELSE 0 END),0) AS vacation_days,
    COALESCE(SUM(CASE WHEN vr.request_type='permission'        AND vr.status='approved' THEN rdr.business_days ELSE 0 END),0) AS permission_days,
    COALESCE(SUM(CASE WHEN vr.request_type='justified_absence' AND vr.status='approved' THEN rdr.business_days ELSE 0 END),0) AS absence_days,
    COALESCE(SUM(CASE WHEN vr.request_type='seniority_benefit' AND vr.status='approved' THEN rdr.business_days ELSE 0 END),0) AS seniority_benefit_days,
    COALESCE((SELECT SUM(uda.days_added) FROM user_day_adjustments uda
              WHERE uda.user_id = u.id AND uda.adjustment_type IN ('monthly_auto','manual')),0) AS extra_days
FROM team_tree tt
JOIN users u  ON u.id = tt.id
LEFT JOIN users m ON u.manager_id = m.id
LEFT JOIN vacation_requests vr ON u.id = vr.employee_id
     AND YEAR(vr.created_at) = ?
     {monthCondition}      -- AND MONTH(vr.created_at) = ?
LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
GROUP BY u.id, u.full_name, u.email, u.employee_number, u.position,
         u.base_vacation_days, u.manager_id, u.benefit_extra_day, m.full_name, tt.depth
ORDER BY tt.depth, m.full_name, u.full_name;
```

**Notas técnicas:**
- `ONLY_FULL_GROUP_BY` activo → todas las columnas no agregadas van en `GROUP BY` (respetado arriba).
- `is_supervisor` sirve para que el frontend sepa qué filas son sub-supervisores (badge/estilo).
- La cota `depth < 10` protege ante ciclos accidentales en `manager_id` (A→B→A). Con datos correctos nunca se alcanza.
- Devuelve **la misma forma** de datos que `getTeamReport` + `depth` + `is_supervisor` → el frontend reutiliza casi todo.

### 4.3 Respuesta JSON
Opción recomendada: el backend devuelve la **lista plana** (como hoy) y el **frontend agrupa** por `manager_id`. Esto mantiene el backend simple y reutiliza `filteredData`.

```json
{
  "year": 2026,
  "month": 0,
  "root_manager": { "id": 5, "full_name": "Judith Morales" },
  "employees": [ { "...", "manager_id": 5, "manager_name": "Judith Morales", "depth": 1, "is_supervisor": 1 }, ... ]
}
```

*(Alternativa: agrupar en el backend en `teams: [{ supervisor, members: [...] }]`. Se descarta para no duplicar lógica de filtrado que ya vive en el front.)*

### 4.4 Ruta
En `backend/routes/reportRoutes.js`:
```js
router.get('/team-hierarchy',
    requireRole('manager', 'hr_admin', 'super_admin'),
    reportController.getTeamHierarchyReport);
```

---

## 5. Diseño Frontend

### 5.1 Nueva página `TeamHierarchyReport.jsx`
Basada en `TeamReport.jsx` (copiar y adaptar). Cambios clave:

1. **Fetch** a `GET /api/reports/team-hierarchy` con `year`/`month`.
2. **Agrupación por sub-equipo:** agrupar `employees` por `manager_id` (+ `manager_name`). Orden: primero el equipo del supervisor raíz, luego los sub-equipos.
   ```js
   const groups = useMemo(() => {
     const map = new Map();
     for (const emp of filteredData) {
       const key = emp.manager_id;
       if (!map.has(key)) map.set(key, { supervisor: emp.manager_name, rows: [] });
       map.get(key).rows.push(emp);
     }
     // ordenar: equipo raíz primero
     return [...map.values()];
   }, [filteredData]);
   ```
3. **Render por secciones:** por cada grupo, un encabezado **"Equipo de \<Supervisor\>"** + la tabla con las mismas columnas de "Reporte de Mi Equipo" (Código · Colaborador · Supervisor · Días Base · Incrementos · Vacaciones · Permisos · Ausencias · B. Antigüedad · Saldo Final).
   - **Sin subtotales ni total general** (decisión §8.3 — los saldos no son sumables).
   - Badge tipo "policía" (ícono escudo `ShieldCheck`, estilo índigo) junto al nombre de quien tenga `is_supervisor = 1`.
4. **Filtros:** solo **Año** y **Mes** (sin los filtros ya ocultados en la vista de supervisores).
5. **CSV:** una sola descarga con **todas** las filas de todos los sub-equipos + columna extra **"Equipo de"** (= `manager_name`). Reutilizar el `handleExportCSV` agregando esa columna.
6. **Estado vacío:** si el supervisor no tiene ni equipo directo → mensaje "No tienes colaboradores a tu cargo".

### 5.2 Ruta y navegación
- `frontend/src/App.jsx`: `<Route path="/reports/team-hierarchy" element={<TeamHierarchyReport />} />`
- `Navbar.jsx` → `REPORT_ITEMS`: nuevo item
  ```js
  { name: 'Reporte de Equipos (Sub-supervisión)', href: '/reports/team-hierarchy', icon: FileBarChart2,
    description: 'Tu equipo y los equipos a cargo de tus supervisores', roles: ['manager'] }
  ```
  Se **mantiene** también el "Reporte de Equipo" directo (ambos conviven — §8, decisión 2).

### 5.3 Reutilización
- Mismo patrón visual/estilos de `TeamReport.jsx` (encabezados de color, badges, `formatDateTime`, etc.).
- Misma lógica de `Saldo Final = base + incrementos − vacaciones` (ya corregida).

---

## 6. Roles y permisos
- **Quién lo ve:** `manager` (principal). También `hr_admin`/`super_admin` pueden abrirlo sobre su propio árbol (aunque ellos ya tienen "Reporte General"). Gate en ruta: `requireRole('manager','hr_admin','super_admin')`.
- **Raíz forzada al usuario logueado:** el árbol siempre parte de `req.user.id`. **Nunca** se acepta un `managerId` externo → un supervisor no puede ver el árbol de otro supervisor que no esté bajo su mando.
- Sin cambios en middlewares existentes (`isAuthenticated`, `requireRole`).

---

## 7. Casos borde y consideraciones

| Caso | Manejo |
|------|--------|
| Supervisor sin sub-supervisores | El reporte muestra una sola sección = equivalente a "Reporte de Mi Equipo" |
| Supervisor sin ningún colaborador | Estado vacío con mensaje claro |
| Ciclo en `manager_id` (dato corrupto) | Cota `depth < 10` corta la recursión; documentar y validar en Admin que no se creen ciclos |
| Colaboradores inactivos | Excluidos (`is_active = 1` en la CTE) |
| Multi-nivel (3+ niveles) | Soportado (recursión sin límite práctico salvo la cota) |
| Un colaborador aparece una sola vez | Garantizado: cada usuario tiene un único `manager_id` (árbol, no grafo) |
| Rendimiento | La CTE recursiva es O(n) sobre el sub-árbol; para el tamaño de MAR Fund es despreciable. Índice recomendado: `users(manager_id)` |
| `month = 0` (todos los meses) | Igual que hoy: sin `MONTH()` en el JOIN |

---

## 8. Decisiones (CONFIRMADAS — 2026-09-28)
1. **Nombre del reporte / menú:** **"Reporte de Equipos (Sub-supervisión)"**.
2. **Convivencia:** se **mantiene** "Reporte de Mi Equipo" y se **agrega** el jerárquico como item adicional en el menú "Reportes" (Opción A). Ambos visibles para `manager`.
3. **Subtotales por equipo:** **NO**. No se agregan subtotales ni "Total general" en **ningún** reporte — los saldos por colaborador **no son sumables** (distinta base, no representan una cantidad agregada válida). Cada sección solo lista sus colaboradores.
4. **Badge de sub-supervisor:** **SÍ** — badge tipo "policía" (ícono escudo `Shield`/`ShieldCheck` de lucide-react, estilo índigo) junto al nombre de quien tenga `is_supervisor = 1`.
5. **Filtros:** siempre **Año** y **Mes** (sin los otros filtros ya ocultados).

---

## 9. Plan de implementación (pasos)

1. **Backend — controller:** agregar `getTeamHierarchyReport` en `reportController.js` (CTE recursiva de §4.2).
2. **Backend — ruta:** registrar `GET /api/reports/team-hierarchy` en `reportRoutes.js`.
3. **Backend — prueba manual:** validar con un supervisor que tenga sub-supervisores (ej. Judith) que la respuesta traiga el árbol completo con `depth`/`is_supervisor` correctos.
4. **Frontend — página:** crear `TeamHierarchyReport.jsx` (copiar `TeamReport.jsx`, agrupar por `manager_id`, render por secciones, CSV con columna "Equipo de").
5. **Frontend — ruta + navbar:** agregar `Route` en `App.jsx` y item en `REPORT_ITEMS` de `Navbar.jsx`.
6. **Verificación de build:** `npm run build` sin errores.
7. **Commit + push a `main`** (deploy en la nube: sin entorno local).
8. **QA en producción** con un supervisor real (ver §10).
9. **Actualizar `CLAUDE.md`** con el nuevo endpoint, página y comportamiento.

**Estimación:** ~0.5 día (backend simple + una página derivada de una existente).

---

## 10. Pruebas de aceptación

- [ ] Judith (con sub-supervisora Claudia Ruiz) ve **2 secciones**: "Equipo de Judith Morales" y "Equipo de Claudia Ruiz".
- [ ] Un supervisor **sin** sub-supervisores ve **1 sección** (igual que Mi Equipo).
- [ ] Los números (Días Base, Incrementos, Vacaciones, Saldo Final) coinciden con "Reporte de Mi Equipo" para el equipo directo.
- [ ] `Saldo Final = base + incrementos − vacaciones` en todas las filas.
- [ ] Filtros Año/Mes afectan todas las secciones.
- [ ] El CSV incluye todas las filas de todos los subequipos + columna "Equipo de".
- [ ] Un supervisor **no** puede ver el árbol de otro supervisor ajeno (la raíz es siempre él mismo).
- [ ] Colaboradores inactivos no aparecen.
- [ ] 3 niveles de profundidad se muestran correctamente.

---

## 11. Archivos afectados (resumen)

| Archivo | Acción |
|---------|--------|
| `backend/controllers/reportController.js` | + `getTeamHierarchyReport` (CTE recursiva) |
| `backend/routes/reportRoutes.js` | + ruta `GET /api/reports/team-hierarchy` |
| `frontend/src/pages/TeamHierarchyReport.jsx` | **nuevo** (derivado de `TeamReport.jsx`) |
| `frontend/src/App.jsx` | + `Route /reports/team-hierarchy` |
| `frontend/src/components/layout/Navbar.jsx` | + item en `REPORT_ITEMS` |
| `CLAUDE.md` | documentar el nuevo reporte |

---

*Este documento es una propuesta. Al aprobarse (y resueltas las decisiones de §8), se procede con la implementación del §9.*
