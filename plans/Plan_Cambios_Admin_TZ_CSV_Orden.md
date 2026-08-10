# Plan — Zona horaria en correos, Export CSV y Tabla Admin

**Fecha:** 10/08/2026
**Estado:** Propuesta (pendiente de OK para implementar)

---

## 1) Fechas en America/Guatemala (UTC-6) — plataforma y correos n8n

### 1a. Plataforma (app)
- El fix ya está **committeado**: `backend/config/db.js` usa `timezone: 'Z'` (commit `b567a22`) + `dateStrings: ['DATE']`.
- **Acción:** confirmar que el **backend esté desplegado** con ese cambio.
- **Si tras el deploy sigue desfasado:** correr en la BD `SELECT NOW(), @@session.time_zone, @@global.time_zone;` para confirmar la convención real (si MySQL guarda en UTC o en -06:00) y ajustar el `timezone` del pool en consecuencia. *(Solo verificación, sin cambios a ciegas.)*

### 1b. Correos n8n (el que falla hoy)
- Causa: `backend/services/n8nService.js` → `formatDate` usa `toLocaleDateString('es-GT', …)` **sin `timeZone`**, así que depende de la zona del contenedor. Además, para fechas `DATE` (`date_from`/`date_to`, ahora strings `'YYYY-MM-DD'`), `new Date('2026-08-10')` se ancla a medianoche UTC y puede **correrse un día**.
- **Corrección** (espejo de `frontend/src/utils/dateUtils.js`):
  - Anclar las fechas date-only (`'YYYY-MM-DD'`) a mediodía UTC antes de formatear.
  - Formatear **siempre** con `timeZone: 'America/Guatemala'`.
  - Aplica a `date_from`/`date_to` (tabla HTML del correo) y a `created_at`.
- Archivo: `backend/services/n8nService.js` (solo la función `formatDate`; el resto del payload no cambia).
- **Nota:** el HTML/plantillas de N8N no requieren cambio (las fechas ya vienen formateadas desde el backend en el payload).

---

## 2) Export CSV (Admin) — agregar Fecha Ingreso y Días Beneficio

- En `Admin.jsx` → `handleExportCSV`:
  - **Headers:** agregar `'Fecha Ingreso'` y `'Días Beneficio (Años Laborales)'` (después de `Días Vac.`).
  - **Filas:** agregar `u.fecha_ingreso || ''` y `parseInt(u.dias_beneficio_anno_laboral) || 0`.
- Sin cambios de backend (los campos ya vienen en `getAllUsers`).

---

## 3) Tabla "Administración de Usuarios"

### 3.1 Filtro por Días Beneficio ≥ 1  — DECIDIDO: checkbox
- **Checkbox "Solo con Días Beneficio"** junto a los filtros actuales (búsqueda / supervisor). Por defecto se ven todos; al activarlo, solo aparecen los que tienen bono ≥ 1.
- Implementación: estado `onlyWithBenefit`; agregarlo al `useMemo` de `filteredUsers` (`parseInt(u.dias_beneficio_anno_laboral) >= 1`).

### 3.2 Ordenar por columnas (asc/desc)
- Hacer clic en el encabezado ordena; segundo clic invierte (asc ↔ desc); indicador visual ▲/▼.
- **Columnas ordenables:** **Supervisor Inmediato**, **Días Vac.**, **Días Beneficio (Años Laborales)**.
  - Supervisor: alfabético por `manager_name`.
  - Días Vac.: numérico por `base_vacation_days`.
  - Días Beneficio: numérico por `dias_beneficio_anno_laboral`.
- Las demás columnas (Código, Colaborador, Cargo, Rol) quedan **sin** orden por ahora (según lo pedido). *(Si luego quieres, se agregan fácil.)*
- Implementación: estado `sortBy` + `sortDir`; ordenar `filteredUsers` (client-side) **antes** de paginar; headers de esas 3 columnas se vuelven botones con el ícono de dirección.

---

## Archivos a tocar
| Archivo | Punto |
|---|---|
| `backend/services/n8nService.js` | 1b (formatDate con TZ Guatemala) |
| `backend/config/db.js` | 1a (ya hecho; solo verificar deploy) |
| `frontend/src/pages/Admin.jsx` | 2 (CSV), 3.1 (filtro), 3.2 (orden) |

## Orden sugerido de implementación
1. Correos n8n (1b) — es el que falla hoy.
2. Export CSV (2).
3. Filtro + ordenamiento en la tabla (3.1, 3.2).

## Decisiones tomadas
- **3.1:** checkbox **"Solo con Días Beneficio"** (opción A). ✅
