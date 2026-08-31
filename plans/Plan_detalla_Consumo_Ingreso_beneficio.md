# Plan detallado — Consumo de Días Beneficio (Bono) con auto-split

**Fecha:** 10/08/2026
**Estado:** Propuesta (pendiente de OK para implementar)
**Base:** continúa `plans/Plan_Fecha_Ingreso_y_Beneficio_Anios_Laborales.md` (registro/cálculo del bono ya implementado)

---

## Objetivo
Empezar a **consumir/descontar el Bono** al solicitar vacaciones. Hoy el bono solo se registra y se muestra; no se descuenta. Este plan agrega el **descuento ordenado (base → bono)** y el **auto-split** de la solicitud.

## Reglas confirmadas (rectificaciones 10/08/2026)
1. **Orden estricto:** el consumo va **SIEMPRE primero sobre Días Vacaciones (base)**; solo cuando la base llega a **CERO** (se consumió todo) se empieza a usar **Días Beneficio (bono)**, hasta que el bono también se agote.
2. **Auto-split:** el **sistema divide automáticamente** la solicitud en dos partidas (una de base + una de bono) cuando una sola solicitud toca ambas bolsas. El colaborador ya **no** tiene que hacer dos solicitudes manualmente.
3. **Alcance de prueba:** todos estos cambios se activan **SOLO para `super_admin`** (estamos en pruebas). Para el resto de roles, el comportamiento sigue **igual que hoy** (solo base, sin bono, sin split).

---

## Modelo de datos y saldos

- **Base disponible** (ya existe): `base_vacation_days + SUM(ajustes monthly_auto+manual) − SUM(vacation aprobadas)`.
- **Bono disponible** (nuevo cálculo de consumo): `dias_beneficio_anno_laboral − SUM(bono aprobado del año)`.
- **Origen de cada partida** — se reutiliza el `request_type`:
  - `vacation` → consume **base** (como hoy).
  - `seniority_benefit` → se **reutiliza como la partida de "bono"**: descuenta del bono (`dias_beneficio_anno_laboral`) en lugar del beneficio viejo de 1 día. Ya existe en el enum, con color ámbar en la UI y en reportes, así que consolidamos el esquema viejo con el nuevo.

> Nota: al reutilizar `seniority_benefit`, el beneficio antiguo (`benefit_extra_day` / `benefit_extra_day_used` / cron `annualBenefitReset.js` / checkbox manual) queda **obsoleto**. En la fase de pruebas se mantiene en BD sin usarse; su limpieza es fase 2.

---

## Algoritmo de auto-split

Dada una solicitud de **N** días hábiles hecha por un `super_admin`:

1. Calcular `baseAvail` y `bonoAvail`.
2. `baseUsed = min(N, baseAvail)` → lo que cubre la base.
3. `bonoUsed = N − baseUsed` → el resto lo cubre el bono.
4. **Casos:**
   - **`bonoUsed == 0`** → 1 sola solicitud `vacation` de N días (comportamiento actual).
   - **`bonoUsed > 0`** →
     1. Validar `bonoUsed ≤ bonoAvail` (si no, **rechazar**: "saldo de bono insuficiente").
     2. Si `baseUsed > 0`: crear **Solicitud A** `vacation` de `baseUsed` días.
     3. Crear **Solicitud B** `seniority_benefit` (bono) de `bonoUsed` días.

### Reparto por fechas (qué días van a cada partida)
El rango se parte **cronológicamente**: la **base cubre los días más tempranos** y el **bono cubre los días finales**. Se recorren los días hábiles del rango; los primeros `baseUsed` se asignan a la Solicitud A y los siguientes `bonoUsed` a la Solicitud B.

---

## Ejemplos (recreados con auto-split)

**Escenario inicial:** Base = 12, Bono = 4.

### Ejemplo 1 — cabe todo en base
Pide **3 días** (Lun 1 – Mié 3 sep).
- `baseUsed = 3`, `bonoUsed = 0` → **1 solicitud** `vacation` (1–3 sep, 3 días).
- Queda: Base **9**, Bono **4**.

### Ejemplo 2 — cabe todo en base
Pide **6 días** (base ahora 9).
- `baseUsed = 6`, `bonoUsed = 0` → **1 solicitud** `vacation` (6 días).
- Queda: Base **3**, Bono **4**.

### Ejemplo 3 — AUTO-SPLIT (base + bono)
Base = 3, Bono = 4. Pide **5 días** (Lun 1 – Vie 5 sep, 5 hábiles).
- `baseUsed = min(5,3) = 3`, `bonoUsed = 2`.
- **Solicitud A** `vacation`: **1–3 sep (3 días)** → Base 3 → **0**.
- **Solicitud B** `seniority_benefit`: **4–5 sep (2 días)** → Bono 4 → **2**.
- El sistema crea las **dos** automáticamente; el colaborador solo pidió "1–5 sep".

### Ejemplo 4 — solo bono (base ya en 0)
Base = 0, Bono = 2. Pide **1 día**.
- `baseUsed = 0`, `bonoUsed = 1` → **solo Solicitud B** (bono) de 1 día (no se crea una de 0).
- Queda: Base **0**, Bono **1**.

### Ejemplo 5 — medio día en el borde
Base = 0.5, Bono = 3. Pide **2 días** (Lun–Mar).
- `baseUsed = 0.5`, `bonoUsed = 1.5`.
- **Solicitud A** `vacation`: **0.5 día** (medio día del Lunes) → Base 0.5 → **0**.
- **Solicitud B** `seniority_benefit`: **1.5 días** (medio Lunes + Martes) → Bono 3 → **1.5**.
- ⚠️ Aquí el bono se consumiría en **fracción (1.5)**. Ver "Decisión A".

### Ejemplo 6 — bono insuficiente (rechazo)
Base = 1, Bono = 1. Pide **4 días**.
- `baseUsed = 1`, `bonoUsed = 3`, pero `bonoAvail = 1` → **se rechaza** la solicitud con aviso: "No tienes saldo suficiente (Base 1 + Bono 1 = 2 días disponibles)".

---

## Alcance de prueba — gate `super_admin`
- **Backend** (`requestController.createRequest`): si `req.user.role === 'super_admin'` → aplica auto-split y consumo de bono. Si no → comportamiento actual (una sola `vacation`, sin bono).
- **Frontend** (`NewRequest.jsx`): si el usuario es `super_admin` → muestra las dos bolsas (Base / Bono) y el desglose del split antes de enviar. Otros roles → formulario actual.
- Helper compartido de criterio: `bonoConsumoActivo(user) = user.role === 'super_admin'` (fácil de abrir a todos cuando termine la prueba).

---

## Cambios técnicos por archivo

| Archivo | Cambio |
|---|---|
| `backend/controllers/requestController.js` | `createRequest`: para super_admin, calcular saldos, auto-split, crear 1–2 solicitudes (`vacation` + `seniority_benefit`), validar saldo bono, repartir fechas. Ajustar aprobación/anulación para descontar/devolver bono. |
| `backend/controllers/reportController.js` | `getMyReport`/`getEmployeeDetail`/`getAllEmployeesReport`: calcular **bono usado** (`SUM(seniority_benefit aprobado del año)`) y **bono disponible** (`dias_beneficio_anno_laboral − usado`); exponerlos. |
| `frontend/src/pages/NewRequest.jsx` | Mostrar Base y Bono disponibles; previsualizar el split; validar; enviar (el backend hace el split real). Solo super_admin. |
| `frontend/src/pages/Dashboard.jsx` | (super_admin) tarjeta/KPI de Bono usado/disponible. |
| `backend/services/n8nService.js` | Que las 2 solicitudes generen sus correos (o un correo combinado). Definir. |
| `CLAUDE.md` | Documentar el consumo del bono y el gate de prueba. |

---

## Flujo de aprobación AGRUPADA (2 solicitudes vinculadas)
El auto-split genera **dos solicitudes** (base + bono) que se **vinculan** con un identificador de grupo para aprobarse/rechazarse **juntas**:
- Nueva columna `vacation_requests.split_group_id VARCHAR(36) NULL` (o reutilizar el `request_number` base como ancla). Ambas partidas comparten el mismo grupo.
- **Aprobar/Rechazar** una del grupo aplica la **misma decisión a ambas** (transacción única): se descuentan base y bono a la vez, o se rechazan las dos.
- En `PendingApprovals`/`AllRequests` se muestran como **una fila agrupada** (o dos filas con un badge "Split base+bono") con **un solo par de botones** Aprobar/Rechazar.
- **Anulación:** anular una anula el grupo y devuelve base y bono.

## Correo N8N — UN solo correo combinado
- El backend dispara **un** `N8N_WEBHOOK_NEW_REQUEST` con el desglose del split en el payload: `parte_base` (días + fechas) y `parte_bono` (días + fechas), total, y saldos resultantes.
- La plantilla muestra ambas partidas en una sola tabla. No se envían dos correos.

---

## Decisiones tomadas (10/08/2026)

- **A → A1:** se **permite el consumo de bono en fracción** (ej. 1.5). La asignación anual sigue entera; el saldo de bono se lleva como decimal consumido.
- **B → Aprobación AGRUPADA:** las dos partidas del split se aprueban/rechazan **juntas** (una sola decisión del supervisor afecta a ambas).
- **C → UN SOLO correo combinado:** N8N envía **un correo** que explica el desglose (parte base + parte bono).
- **Alcance:** SOLO `super_admin` puede ver/probar estas actualizaciones. Ningún `employee` ni `manager` participa en la prueba por ahora.

---

## Orden de implementación sugerido
1. Backend: cálculo de saldos base/bono + `createRequest` con auto-split y gate super_admin. **Punto de prueba 1** (crear solicitud que cruce base→bono y verificar las 2 partidas en BD).
2. Aprobación/anulación: descuento y devolución de bono. **Punto de prueba 2.**
3. Reportes/Dashboard: bono usado/disponible.
4. `NewRequest.jsx`: UI de las dos bolsas + preview del split (super_admin).
5. Correos N8N (según Decisión C).
6. Documentar (`CLAUDE.md`).

## Fuera de alcance (fase 2)
- Abrir el consumo a todos los roles (quitar el gate super_admin) tras validar la prueba.
- Eliminar físicamente `benefit_extra_day` / `benefit_extra_day_used` y el cron `annualBenefitReset.js`.
