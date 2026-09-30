# Plan — Cierre del Beneficio Antigüedad antiguo (día extra manual)

> **Objetivo:** retirar por completo el requerimiento antiguo del "día extra por antigüedad" (`benefit_extra_day` / `benefit_extra_day_used`) y dejar como único mecanismo el **bono por años laborales** (`dias_beneficio_anno_laboral`), que se consume solo vía **auto-split** al pedir Vacaciones.
>
> **Fecha:** 2026-09-29 · **Estado:** Fase A aplicada (código comentado) · Fases B–E pendientes

---

## 1. Contexto: dos sistemas que convivían

| | **Antiguo** (a retirar) | **Nuevo** (vigente) |
|---|---|---|
| Elegibilidad | `users.benefit_extra_day` (check manual de RRHH) | `users.dias_beneficio_anno_laboral` (calculado desde `fecha_ingreso`, 0–10) |
| Consumo | Opción "Beneficio Antigüedad" en Nueva Solicitud (1 día) | Automático por auto-split al pedir Vacaciones |
| Control de uso | `users.benefit_extra_day_used` (0/1) | Calculado: `seniority_benefit` aprobado del año (`utils/saldos.js`) |
| Reset anual | Cron `jobs/annualBenefitReset.js` | Cron `jobs/recalcBeneficioAnios.js` |

**Riesgo que motivó el cierre:** ambos usan `request_type = 'seniority_benefit'`. Un día extra pedido a mano también se descontaba del bono nuevo (doble efecto).

---

## 2. Fase A — Desactivar (APLICADA, código comentado)

Todo quedó **comentado** (no borrado) con la marca `[BENEFICIO ANTIGUO — DESACTIVADO]` para poder revertir. Ya no lo ve **ningún rol** (super_admin, hr_admin, manager, employee).

| Archivo | Qué se desactivó |
|---|---|
| `frontend/src/pages/NewRequest.jsx` | Opción "Beneficio Antigüedad" del dropdown y `showSeniorityOption` |
| `frontend/src/pages/Admin.jsx` | Sección "Beneficio Antigüedad" de la Ficha (checks *Aplica* / *Ya gozó*) |
| `frontend/src/pages/Reports.jsx` | Filtro "Solo con Beneficio Antigüedad" + badge "Beneficio usado/disponible" |
| `frontend/src/pages/TeamReport.jsx` | Badge "Beneficio usado/disponible" |
| `frontend/src/pages/TeamHierarchyReport.jsx` | Badge "Beneficio usado/disponible" |
| `backend/controllers/requestController.js` | `createRequest` **rechaza** `request_type = 'seniority_benefit'` directo (400, mensaje guía). Las validaciones viejas quedaron comentadas. El auto-split sigue creando `seniority_benefit` internamente (entra como `vacation`) |
| `backend/server.js` | Arranque del cron `startAnnualBenefitReset()` |

**Lo que NO se tocó (intencional):**
- Columna **"B. Antigüedad"** de los reportes y el filtro por tipo "B. Antigüedad": ahora reflejan los días de **bono** usados vía split → siguen siendo válidos.
- Label "Beneficio Antigüedad" de `seniority_benefit` en tablas/correos (`n8nService.formatRequestType`, PendingApprovals, Dashboard): representa la parte bono del split.
- Columnas de BD y escrituras internas a `benefit_extra_day_used` (invisibles; se limpian en Fase B/D).

---

## 3. Decisiones de negocio (confirmar con RRHH)

1. **Confirmar** que el día extra antiguo desaparece y lo reemplaza el bono por años laborales.
2. **Colaboradores con `benefit_extra_day = 1` y bono nuevo = 0** (< 3 años): ¿pierden ese día o se les respeta este año (p. ej. con un ajuste manual "+ Días")?
   ```sql
   SELECT employee_number, full_name, benefit_extra_day_used, dias_beneficio_anno_laboral
   FROM users
   WHERE is_active = 1 AND benefit_extra_day = 1 AND COALESCE(dias_beneficio_anno_laboral,0) = 0;
   ```
3. **Solicitudes antiguas pendientes** de `seniority_benefit` (sin `split_group_id`): decidir aprobar/rechazar antes de la Fase D.
   ```sql
   SELECT request_number, employee_id, status, created_at
   FROM vacation_requests
   WHERE request_type = 'seniority_benefit' AND split_group_id IS NULL AND status = 'pending';
   ```
4. **Cambio de año:** el bono usado se imputa por `YEAR(created_at)` (fecha de creación), no por la fecha de goce. ¿Es aceptable?

---

## 4. Fase B — Limpieza del backend (pendiente)

En `backend/controllers/requestController.js`:
- Quitar `UPDATE users SET benefit_extra_day_used = 1` al **aprobar** (portal `makeDecision`) y por **link de correo** (`processApprovalToken`, 2 lugares).
- Quitar `UPDATE users SET benefit_extra_day_used = 0` al **anular** (`annulRequest`).
- Verificar que `processApprovalToken` apruebe/rechace **ambas partes** de un split (igual que `makeDecision`).
- Borrar el bloque comentado de validaciones viejas en `createRequest`.

En `backend/controllers/userController.js`:
- Quitar `benefit_extra_day` / `benefit_extra_day_used` de `updateUser` y `createUser`.

En `backend/controllers/reportController.js` (`getAllEmployeesReport`, `getTeamReport`, `getTeamHierarchyReport`):
- Reemplazar `u.benefit_extra_day` por `u.dias_beneficio_anno_laboral` en SELECT y GROUP BY.

## 5. Fase C — Reportes con el criterio nuevo (pendiente, opcional)

- Reactivar el filtro como **"Solo con Días Beneficio"** usando `dias_beneficio_anno_laboral > 0`.
- Reemplazar el badge por **"Bono: X días disponibles"** (requiere exponer `bono_avail` en los reportes).
- Renombrar la columna **"B. Antigüedad"** → **"Bono usado"**.
- Opcional: columna **"Días Beneficio disponibles"** en Reporte General / Mi Equipo / Sub-supervisión.
- Frontend: quitar `benefit_extra_day` de `newForm`/`editForm` en `Admin.jsx`.

## 6. Fase D — Base de datos (pendiente, AL FINAL)

> **Orden obligatorio:** desplegar Fases B y C **antes** de borrar columnas. Si se borran primero, fallan login/Admin/reportes (los SELECT todavía las piden).

1. **Respaldo** completo de `marfund-vacations-ai` (`mysqldump`).
2. Resolver las solicitudes pendientes del punto 3.3.
3. Migración:
   ```sql
   ALTER TABLE users
     DROP COLUMN benefit_extra_day,
     DROP COLUMN benefit_extra_day_used;
   ```
4. Actualizar `database/schema.sql`.

## 7. Fase E — Limpieza final (pendiente)

- Eliminar todo el código marcado `[BENEFICIO ANTIGUO — DESACTIVADO]`.
- Borrar `backend/jobs/annualBenefitReset.js`.
- Borrar el tag git `checkpoint-pre-consumo-bono` (ya no es punto de retorno).
- Actualizar `CLAUDE.md` (secciones "Beneficio Antigüedad", "Cron — Reset anual", "Anulación"), `plans/Plan_detalla_Consumo_Ingreso_beneficio.md` e `Informe_Auditoria_Sistemas.md` (tabla de crons).

---

## 8. Pruebas de aceptación

**Fase A (ya aplicada):**
- [ ] Ningún rol ve la opción "Beneficio Antigüedad" en Nueva Solicitud.
- [ ] La Ficha del colaborador (Admin) ya no muestra los checks *Aplica* / *Ya gozó*.
- [ ] Reportes sin filtro "Solo con Beneficio Antigüedad" ni badges "Beneficio usado/disponible".
- [ ] Un POST directo con `request_type = 'seniority_benefit'` devuelve 400 con el mensaje guía.
- [ ] El auto-split sigue funcionando: Vacaciones > base → crea `vacation` + `seniority_benefit`.

**Fases B–E:**
- [ ] Aprobar un split desde el **link del correo** aprueba ambas partes.
- [ ] Anular un split anula ambas y el bono vuelve a estar disponible.
- [ ] Tras la migración: login, Admin, Dashboard y los 3 reportes cargan sin errores.

---

## 9. Reversión de la Fase A

Descomentar los bloques marcados `[BENEFICIO ANTIGUO — DESACTIVADO]` en los archivos de la tabla §2 y volver a desplegar backend + frontend. No hay cambios de base de datos en la Fase A.
