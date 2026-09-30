# Actualización 30/08/2026 – 30/09/2026 — Bono por Años Laborales, Dashboard, Reportes y Admin

> **Periodo:** 30 de agosto al 30 de septiembre de 2026
> **Rama:** `main` (despliegue en la nube vía Easypanel — sin entorno local)
> **Commits:** `1154891` → `a7640bc` (33 commits)
> **Documentos relacionados:** `plans/Plan_detalla_Consumo_Ingreso_beneficio.md`, `plans/plan_reporte_equipos_supervisores.md`, `plans/plan_cierre_beneficio_antiguo.md`, `Informe_Auditoria_Sistemas.md`

---

## 1. Resumen ejecutivo

| Área | Resultado |
|---|---|
| **Bono por años laborales** | Consumo automático (auto-split base + bono) **liberado a todos los roles** (Fase 2). |
| **Beneficio antiguo (día extra manual)** | **Desactivado** (código comentado, reversible). Plan de cierre con Fases B–E. |
| **Dashboard** | Fila 1 solo vacaciones (ecuación exacta); Fila 2 con bono + informativos. |
| **Reporte del colaborador (modal)** | Tarjetas tipo dashboard, filtro por tipo, columnas nuevas y **exportar Excel**. |
| **Admin** | Paginación arriba/abajo; columnas *Días Vacaciones Disponibles* y *Días Beneficio disponibles*. |
| **Reportes** | Nuevo **Reporte de Equipos (Sub-supervisión)** jerárquico; columnas *Incrementos*, *Días Beneficio disponibles*; renombres; filtro de años 2026–2030. |
| **Documentación** | `Informe_Auditoria_Sistemas.md` (infraestructura + guía de migración de VPS). |

---

## 2. Bono por Años Laborales (consumo)

### 2.1 Fase de prueba (30/08) → Fase 2 (29/09)
- **Auto-split:** al pedir **Vacaciones**, si la base no alcanza, el backend crea **2 solicitudes vinculadas** por `vacation_requests.split_group_id`:
  - `vacation` → días base (fechas tempranas).
  - `seniority_benefit` → días de bono (fechas finales).
- Aprobación y anulación **agrupadas** (una decisión aplica a ambas partes) y **un solo correo** combinado (N8N).
- Consumo **fraccionario** permitido.
- **Fase de prueba:** solo `super_admin`. **Fase 2 (29/09):** liberado a **todos los roles**.
  - Backend: `bonoConsumoActivo(user) = Boolean(user)` en `requestController.js`.
  - `NewRequest.jsx`: vista previa del split para todos.
  - `Dashboard.jsx`: `showBono = true`.

### 2.2 Archivos clave
| Archivo | Rol |
|---|---|
| `backend/utils/saldos.js` | `getSaldos()` → `baseAvail`, `bonoAvail`, `bonoAllot`, `bonoUsed` |
| `backend/utils/splitFechas.js` | División de rangos por días hábiles (base / bono) |
| `backend/controllers/requestController.js` | `createRequest` (split), `makeDecision` y `annulRequest` agrupados |
| `backend/services/n8nService.js` | `buildSplitDatesTable` (correo combinado) |
| `database/migration_split_group_bono.sql` | Columna `split_group_id` + índice (**ya aplicada** en producción) |

### 2.3 Fórmulas
- **Bono disponible** = `dias_beneficio_anno_laboral − SUM(seniority_benefit aprobado del año en curso)`.
- `dias_beneficio_anno_laboral = min(max(año − añoIngreso − 3, 0), 10)`, recalculado cada 1 de enero (cron `recalcBeneficioAnios.js`).

---

## 3. Cierre del Beneficio Antigüedad antiguo (29/09) — Fase A

El "día extra manual" (`benefit_extra_day` / `benefit_extra_day_used`) quedó **comentado** con la marca `[BENEFICIO ANTIGUO — DESACTIVADO]`. **Ningún rol** lo ve.

| Archivo | Desactivado |
|---|---|
| `NewRequest.jsx` | Opción "Beneficio Antigüedad" del dropdown |
| `Admin.jsx` | Checks *Aplica* / *Ya gozó* en la Ficha |
| `Reports.jsx` | Filtro "Solo con Beneficio Antigüedad" + badge "Beneficio usado/disponible" |
| `TeamReport.jsx`, `TeamHierarchyReport.jsx` | Badge "Beneficio usado/disponible" |
| `requestController.js` | `createRequest` **rechaza** `seniority_benefit` directo (400); solo lo genera el auto-split |
| `server.js` | Arranque del cron `annualBenefitReset` |

**Pendiente (Fases B–E):** limpieza de backend, reportes con criterio nuevo, `DROP COLUMN` en BD (con respaldo previo) y eliminación del código comentado. Detalle en `plans/plan_cierre_beneficio_antiguo.md`.

---

## 4. Dashboard

- **Fila 1 — solo vacaciones (4):** Saldo Inicial · **Días Vacaciones Agregados** · Días Consumidos · **Días Vacaciones Disponibles Hoy**
  - `Saldo Inicial + Agregados − Consumidos = Disponibles Hoy` (cuadra exacto; el bono **no** entra).
  - Backend `getMyReport`: `total_extra_days` y `total_consumed_days` ya **no** incluyen `seniority_benefit`.
- **Fila 2 (5):** Bono por antigüedad · Bono usado (año) · **Días Beneficio disponibles** · Permisos Personales · Ausencia Justificada (Permisos en celeste, Ausencia en violeta).

---

## 5. Reporte del colaborador (`CollaboratorDetailModal`, Admin → Reporte)

- Tarjetas en **2 filas idénticas al Dashboard**.
- **Filtro por tipo** (todos activos por defecto): Vacaciones · Permisos · Ausencias · Bono Beneficio. Los créditos (saldo inicial, incrementos) siempre visibles.
- **Columnas:** Fecha · # Número · **Ref.** (antes "Tipo") · **Tipo de Solicitud** (nueva) · Días · **Motivo / Detalle** (40% de ancho, con salto de línea).
- **Botón "Generar Excel"**: exporta el historial visible (respeta filtros) a `.xlsx`. Usa `xlsx` (SheetJS) con carga dinámica.
- Backend `getEmployeeDetail`: `summary` con saldos de bono, permisos y ausencias; `category` por movimiento.

> ⚠️ Se agregó la dependencia **`xlsx`** al frontend → en el deploy hace falta `npm install` antes de `npm run build`.

---

## 6. Admin — grid de usuarios

- **Paginación duplicada** arriba y abajo del grid (`renderPagination()`).
- Columnas **"Días Vac."** y **"Días Beneficio (Años Laborales)"** reemplazadas por:
  - **Días Vacaciones Disponibles** (`available_days`, ordenable).
  - **Días Beneficio disponibles** (`bono_avail`, ordenable, badge ámbar).
- Backend `getAllUsers` calcula ambos con subconsultas (misma fórmula que el Dashboard).
- Tabla compactada (acciones solo con íconos) para evitar scroll horizontal.

---

## 7. Reportes

### 7.1 Reporte de Mi Equipo (`/reports/team`)
- **Fix:** faltaba la columna **Incrementos** y el **Saldo Final** no la sumaba. Ahora `Saldo Final = Saldo Inicial + Incrementos − Vacaciones`.
- Filtros "Solo con Beneficio Antigüedad" y "Mostrar solo empleados con" ocultos; quedan **Año** y **Mes**.

### 7.2 Nuevo: Reporte de Equipos (Sub-supervisión) (`/reports/team-hierarchy`)
- Muestra el **equipo directo** del supervisor y, **recursivamente**, los equipos de sus colaboradores que también supervisan.
- Backend `getTeamHierarchyReport` con **CTE recursiva**; la raíz es siempre el usuario logueado.
- Secciones "Equipo de \<Supervisor\>", badge **Supervisor** (escudo), **sin subtotales** (los saldos no son sumables), CSV con columna "Equipo de".
- **Fix (28/09):** registros repetidos por un **ciclo en los datos** (José Ruiz ↔ Automatizaciones IA se supervisan mutuamente). La recursión ahora registra la ruta visitada y deduplica por colaborador.

### 7.3 Cambios comunes a los 3 reportes (General, Mi Equipo, Sub-supervisión)
- Nueva columna **Días Beneficio disponibles** (constante `BONO_AVAIL_SQL`), también en el CSV.
- Renombres: **"Días Base" → "Saldo Inicial"** y **"B. Antigüedad" → "Bono Antigüedad Utilizados"**.
- **Filtro Año:** 2026–2030, años futuros deshabilitados (`frontend/src/utils/reportYears.js`). En el Reporte General el filtro Año/Mes sigue oculto temporalmente.
- **Reporte General:** tabla compactada (sin scroll horizontal en pantallas normales).

### 7.4 Permisos de acceso a reportes de equipo
| Reporte | manager | super_admin | hr_admin |
|---|---|---|---|
| Reporte General | ❌ | ✅ | ✅ |
| Reporte de Mi Equipo | ✅ | ✅ | ❌ |
| Reporte de Equipos (Sub-supervisión) | ✅ | ✅ | ❌ |

Motivo: algunos `super_admin` también supervisan; RRHH no tiene equipo a cargo.

---

## 8. Documentación

- **`Informe_Auditoria_Sistemas.md`**: arquitectura, Easypanel (proyecto `marfund-ia`), backend, frontend, BD, N8N, GitHub, hallazgos de seguridad (H1–H5) y guía extensa de **migración a otro VPS**.
- **`CLAUDE.md`** actualizado en cada entrega.
- Planes nuevos: `plan_reporte_equipos_supervisores.md`, `plan_cierre_beneficio_antiguo.md`.

---

## 9. Despliegue y operación

- **Sin entorno local:** cada cambio se sube con `git commit` + `git push origin main`; el deploy se hace en Easypanel.
- Orden recomendado: **backend** (`vacations-app`) → **frontend** (`vacations-app-frontend`) → **Ctrl+Shift+R**.
- Si cambia `frontend/package.json` (ej. `xlsx`), el build requiere `npm install`.

---

## 10. Hallazgos y pendientes

| # | Tema | Acción sugerida |
|---|---|---|
| 1 | **Ciclo en supervisores**: José Ruiz ↔ Automatizaciones IA | Corregir en Admin → Ficha → Supervisor |
| 2 | **Webhooks N8N en modo `/webhook-test/`** | Pasar a `/webhook/` (Active) en producción |
| 3 | **Token de GitHub embebido** en la URL del remoto git | Rotar y usar Deploy Key |
| 4 | **MySQL expuesto** en `147.93.46.144:3306` | Restringir por firewall |
| 5 | **Cierre beneficio antiguo — Fases B–E** | Ver `plan_cierre_beneficio_antiguo.md` |
| 6 | Confirmar con RRHH: colaboradores con día extra viejo y sin bono nuevo; solicitudes viejas pendientes | Consultas SQL en el plan de cierre |
| 7 | Bono usado se imputa por **fecha de creación** (no de goce) | Validar criterio con RRHH |
| 8 | Filtro Año/Mes del Reporte General **oculto temporalmente** | Reactivar cuando se requiera (ya preparado) |
| 9 | Tag `checkpoint-pre-consumo-bono` obsoleto | Borrar en la Fase E |

---

## 11. Bitácora de commits

| Fecha | Commit | Descripción |
|---|---|---|
| 30/08 | `1154891` | Plan de consumo de bono (checkpoint) |
| 30/08 | `973590e` | Backend auto-split (solo super_admin) |
| 30/08 | `2445b6f` | NewRequest con vista previa del split |
| 30/08 | `7d1d57c`…`cff94ce` | Dashboard: tarjetas del bono y reorganización en 2 filas |
| 31/08 | `8b3d71c` | Admin: tabla compactada |
| 31/08 | `b421c81`, `facf946` | Dashboard: reorden de tarjetas y colores |
| 06/09 | `041d449`, `db44fe9` | Dashboard: Fila 1 solo vacaciones + renombres |
| 06/09 | `0daf5ec`…`3957163` | Modal del colaborador: filtros, columnas, Excel |
| 06/09 | `7aba54f`, `91337f1` | Admin: paginación superior + columnas disponibles |
| 06/09 | `c115842` | Informe de Auditoría + CLAUDE.md |
| 28/09 | `64b26a5`, `e0eb37e` | Mi Equipo: Incrementos + filtros ocultos |
| 28/09 | `69e3116`, `ab54939` | Reporte de Equipos (Sub-supervisión) + fix de ciclos |
| 28/09 | `01d4475` | Filtro de años 2026–2030 |
| 29/09 | `60112ec` | **Fase 2:** bono liberado a todos |
| 29/09 | `80ee0f7` | Beneficio antiguo desactivado + plan de cierre |
| 29/09 | `bada8be`, `5c68907` | Reportes: Días Beneficio disponibles + renombre Bono Utilizados |
| 29/09 | `be66b24`, `e4aaacd` | Reporte General compacto + reportes de equipo para super_admin |
| 30/09 | `a7640bc` | "Días Base" → "Saldo Inicial" |
