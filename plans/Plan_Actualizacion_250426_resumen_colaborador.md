# Plan de Actualización — Resumen por Colaborador
**Fecha:** 25/04/2026  
**Sistema:** Sistema de Solicitud de Vacaciones MAR Fund

---

## Diagrama — Req 2: Modal de Resumen Detallado del Colaborador

Al hacer clic en el ícono 📊 de la fila de un colaborador en Admin, se abre un panel lateral (drawer) o modal grande con el siguiente layout:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ✕   Resumen del Colaborador                                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  COL-001  Ana Beatriz Rivas Chacón                                       │
│           arivas@marfund.org  ·  Coordinadora Fase 3                     │
│           Supervisor: Judith Adriana Morales López                        │
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Días Base      │  │  Consumidos     │  │  Disponibles Hoy        │  │
│  │  25.00          │  │  -3.00          │  │  22.00                  │  │
│  │  (actual)       │  │  (vacaciones)   │  │  (base - consumido)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                                                                           │
│  Historial de Movimientos                                                │
│  ───────────────────────────────────────────────────────────────────     │
│  ┌──────────────┬──────────────┬─────────────────┬───────┬───────────┐  │
│  │ Fecha        │ # Número     │ Tipo            │ Días  │ Motivo /  │  │
│  │              │              │                 │       │ Detalle   │  │
│  ├──────────────┼──────────────┼─────────────────┼───────┼───────────┤  │
│  │ 01/01/2026   │ VAC-2026-001 │ 🟢 Saldo Inicial│ +15.00│ Saldo    │  │
│  │              │  (verde)     │                 │       │ inicial   │  │
│  ├──────────────┼──────────────┼─────────────────┼───────┼───────────┤  │
│  │ 01/02/2026   │ VAC-2026-010 │ 🟢 Incr. Mensual│ +1.25 │ Aumento  │  │
│  │              │  (verde)     │                 │       │ automático│  │
│  ├──────────────┼──────────────┼─────────────────┼───────┼───────────┤  │
│  │ 15/03/2026   │ VAC-2026-015 │ 🟢 Días Manual  │ +2.00 │ Trabajó  │  │
│  │              │  (verde)     │                 │       │ sábado    │  │
│  ├──────────────┼──────────────┼─────────────────┼───────┼───────────┤  │
│  │ 20/04/2026   │ VAC-2026-022 │ 🔴 Vacaciones   │ -3.00 │           │  │
│  │              │  (rojo)      │   aprobadas     │       │           │  │
│  ├──────────────┼──────────────┼─────────────────┼───────┼───────────┤  │
│  │ 22/04/2026   │ VAC-2026-024 │ ⚪ Permiso      │  1.00 │ Cita     │  │
│  │              │  (gris)      │   (informativo) │       │ médica    │  │
│  └──────────────┴──────────────┴─────────────────┴───────┴───────────┘  │
│                                                                           │
│                                          [ Exportar PDF ]  [ Cerrar ]   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Notas del diseño:**
- Se abre como **modal grande** (max-w-4xl) centrado
- El número VAC- se muestra en **verde** para incrementos y **rojo** para descuentos
- Permisos y ausencias aparecen en **gris** (informativo, no afectan saldo)
- El primer registro siempre es el **Saldo Inicial** (el más antiguo)
- Orden: más reciente arriba (excepto el Saldo Inicial que va primero como fila de encabezado)

---

## Hallazgos técnicos antes de iniciar

| Punto | Estado actual | Acción requerida |
|-------|--------------|-----------------|
| `employee_number` en backend | Ya se retorna en `getAllUsers`, `getAllEmployeesReport` | Incluirlo en las queries de `listRequests` |
| `getEmployeeReport` endpoint | Existe `GET /api/reports/employee/:id` pero retorna resumen por tipo, sin movimientos detallados | Ampliar para retornar historial unificado |
| `user_day_adjustments.adjustment_type` | Enum: `'manual'`, `'monthly_auto'` | Agregar `'initial_balance'` para Req 3 |
| SheetJS para Excel | No instalado | `npm install xlsx` en backend |

---

## Requerimiento 1 — Código Colaborador en todas las visualizaciones

### Vistas afectadas
- [ ] **FE-1.1** `Admin.jsx` — agregar columna "Código" antes de "Colaborador"
- [ ] **FE-1.2** `AllRequests.jsx` — mostrar `employee_number` bajo el nombre del colaborador
- [ ] **FE-1.3** `PendingApprovals.jsx` — mostrar `employee_number` bajo el nombre
- [ ] **FE-1.4** `Reports.jsx` — agregar columna "Código" antes del nombre

### Backend
- [ ] **BE-1.1** `requestController.js` → `listRequests`: incluir `u.employee_number` en los SELECT que hacen JOIN con `users`
- [ ] **BE-1.2** `reportController.js` → `getAllEmployeesReport`: ya incluye `employee_number` ✓

---

## Requerimiento 2 — Modal de Resumen Detallado del Colaborador

### Backend
- [ ] **BE-2.1** Crear nuevo endpoint `GET /api/reports/employee/:id/detail` en `reportController.js`:
  - Retorna info del usuario (nombre, código, cargo, supervisor, días base)
  - Retorna **todos** los movimientos unificados: solicitudes + ajustes
  - Cada movimiento incluye: `fecha`, `number` (VAC-), `type_label`, `days` (positivo o negativo), `reason`, `color_type` (`credit`/`debit`/`info`)
  - Ordenados por `created_at DESC`, pero el saldo inicial siempre va primero en la lista
- [ ] **BE-2.2** Registrar ruta en `reportRoutes.js`:
  ```
  GET /api/reports/employee/:id/detail  →  requireRole('manager', 'hr_admin', 'super_admin')
  ```

### Frontend
- [ ] **FE-2.1** Crear componente `frontend/src/components/CollaboratorDetailModal.jsx`:
  - Props: `userId`, `onClose`
  - Llama `GET /api/reports/employee/:id/detail` al montar
  - Muestra 3 widgets de resumen (Días Base, Consumidos, Disponibles)
  - Tabla de movimientos con colores (verde/rojo/gris)
- [ ] **FE-2.2** `Admin.jsx` — agregar ícono `FileBarChart2` al final de cada fila
  - Estado `detailModal` (`null` o `userId`)
  - Al hacer clic abre `<CollaboratorDetailModal userId={...} onClose={() => setDetailModal(null)} />`

---

## Requerimiento 3 — Cargar Saldos Iniciales desde Excel

### Diseño del proceso
1. Admin sube archivo `.xlsx` con columnas: **Código Colaborador** | **Saldo Inicial**
2. Backend busca al usuario por `employee_number`
3. Actualiza `users.base_vacation_days = Saldo Inicial`
4. Inserta en `user_day_adjustments` un registro con:
   - `adjustment_type = 'initial_balance'`
   - `days_added = Saldo Inicial`
   - `reason = 'Saldo inicial cargado por administrador'`
   - `adjusted_by = id del admin que subió el archivo`

### Base de datos
- [ ] **DB-3.1** Agregar valor al enum de `user_day_adjustments.adjustment_type`:
  ```sql
  ALTER TABLE user_day_adjustments
  MODIFY COLUMN adjustment_type 
    ENUM('manual', 'monthly_auto', 'initial_balance') NOT NULL DEFAULT 'manual';
  ```
- [ ] **DB-3.2** Actualizar `database/schema.sql`

### Backend
- [ ] **BE-3.1** Instalar `xlsx` (SheetJS):
  ```bash
  cd backend && npm install xlsx multer
  ```
- [ ] **BE-3.2** Crear `backend/controllers/importController.js` con función `importInitialBalances`:
  - Recibe archivo via `multipart/form-data`
  - Parsea Excel con SheetJS, extrae columnas `Código Colaborador` y `Saldo Inicial`
  - Por cada fila: busca usuario por `employee_number`, actualiza días base, inserta ajuste
  - Retorna reporte: `{ procesados: N, no_encontrados: [...], errores: [...] }`
- [ ] **BE-3.3** Crear ruta:
  ```
  POST /api/users/import-balances  →  requireRole('hr_admin', 'super_admin')
  ```

### Frontend — `Admin.jsx`
- [ ] **FE-3.1** Agregar botón **"Cargar Saldos"** en la cabecera (junto a Exportar CSV y Agregar Colaborador)
- [ ] **FE-3.2** Al hacer clic, abre un `<input type="file" accept=".xlsx,.xls">` oculto
- [ ] **FE-3.3** Al seleccionar el archivo, envía a `POST /api/users/import-balances`
- [ ] **FE-3.4** Modal de resultado que muestra:
  - `N colaboradores actualizados`
  - Lista de códigos **no encontrados** (para corrección)
  - Lista de **errores** (si algún Saldo Inicial no es número válido)

---

## Resumen de archivos a crear/modificar

| Archivo | Req | Tipo de cambio |
|---------|-----|----------------|
| `backend/controllers/reportController.js` | 2 | Agregar `getEmployeeDetail` |
| `backend/controllers/importController.js` | 3 | **Crear nuevo** |
| `backend/routes/reportRoutes.js` | 2 | Agregar ruta `/employee/:id/detail` |
| `backend/routes/userRoutes.js` | 3 | Agregar ruta `import-balances` |
| `backend/controllers/requestController.js` | 1 | Incluir `employee_number` en listRequests |
| `database/schema.sql` | 3 | ALTER enum `adjustment_type` |
| `frontend/src/components/CollaboratorDetailModal.jsx` | 2 | **Crear nuevo** |
| `frontend/src/pages/Admin.jsx` | 1, 2, 3 | Columna código, ícono reporte, botón cargar |
| `frontend/src/pages/AllRequests.jsx` | 1 | Mostrar código bajo nombre |
| `frontend/src/pages/PendingApprovals.jsx` | 1 | Mostrar código bajo nombre |
| `frontend/src/pages/Reports.jsx` | 1 | Columna código |
