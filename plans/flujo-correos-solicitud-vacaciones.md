# Flujo de Correos - Sistema de Solicitud de Vacaciones

## Resumen

Cuando un colaborador crea una solicitud de vacaciones, se dispara un **webhook hacia N8N** que:
1. Busca datos adicionales en Google Sheets
2. Envía 2 correos en paralelo (uno al empleado, otro al supervisor)
3. Ambos tienen formatos HTML profesionales con botones de acción directa

---

## 🔄 Flujo Técnico (Backend → N8N)

### Dónde se dispara
Archivo: `backend/controllers/requestController.js` (línea 103)
- **Evento**: Cuando se crea una solicitud (`POST /api/requests`)
- **Tiempo**: Inmediato, asincrónico (no bloquea la respuesta al usuario)
- **Servicio**: `n8nService.triggerNewRequest()`

### Qué se envía al webhook
```
{
  request_number: "VAC-2026-0042",
  request_type: "Vacaciones",
  reason: "Descanso familiar",
  notes: "",
  total_days: 5,
  created_at: "17 de julio de 2026",
  dates_table_html: "<table>...</table>",
  
  employee_name: "Amy Louise Jones",
  employee_email: "ajones@marfund.org",
  employee_position: "Coordinadora",
  employee_number: "1110",
  
  manager_name: "Judith Adriana Morales López",
  manager_email: "jmorales@marfund.org",
  
  approve_url: "https://app.marfund.org/api/requests/token/abc123xyz?action=approve",
  reject_url: "https://app.marfund.org/api/requests/token/abc123xyz?action=reject",
  app_url: "https://app.marfund.org"
}
```

---

## 📧 N8N Workflow - "MAR Fund - Nueva Solicitud"

### Flujo interno

```
1. Webhook recibe datos ↓
2. Google Sheets: Busca el correo del supervisor en hoja "empleados" ↓
3. (En paralelo)
   ├→ Gmail: Envía correo al EMPLEADO
   └→ Gmail: Envía correo al SUPERVISOR
4. Responde al webhook: {"success": true}
```

### Datos adicionales que N8N obtiene

N8N consulta **Google Sheets** (hoja "empleados") buscando por correo del empleado y extrae:
- `Correo supervisor inmediato`
- `Nombre del supervisor inmediato`

---

## 📬 Correo 1: Notificación al Empleado

### Enviado a: `ajones@marfund.org`

### Asunto:
```
✅ Solicitud VAC-2026-0042 recibida - Vacaciones
```

### Contenido (HTML):

```html
Hemos recibido tu Solicitud

Hola Amy Louise Jones,

Tu solicitud de Vacaciones ha sido recibida y se ha enviado a 
tu supervisor inmediato (Judith Adriana Morales López) para su 
aprobación al correo jmorales@marfund.org.

Te notificaremos en cuanto haya una actualización.
```

**Tono**: Breve, confirmación, tranquilidad
**CTA**: Ninguno (solo información)

---

## 📬 Correo 2: Notificación al Supervisor (Jefe)

### Enviado a: `jmorales@marfund.org`

### Asunto:
```
📋 Solicitud pendiente de aprobación - Amy Louise Jones
```

### Contenido (HTML):

```html
Nueva Solicitud de Vacaciones

┌─────────────────────────────────┐
│ N° Solicitud: VAC-2026-0042     │
│ Empleado: Amy Louise Jones      │
│ Cargo: Coordinadora             │
│ Tipo: Vacaciones                │
│ Razón: Descanso familiar        │
│ Total días hábiles: 5           │
└─────────────────────────────────┘

Fechas solicitadas:
┌───────────┬───────────┬──────────┐
│ Inicio    │ Fin       │ Días     │
├───────────┼───────────┼──────────┤
│ 20 de     │ 24 de     │ 5        │
│ julio     │ julio     │          │
└───────────┴───────────┴──────────┘

Por favor toma una decisión:

[✅ APROBAR]  [❌ RECHAZAR]

También puedes gestionar la solicitud desde el portal web.
Este link expira en 7 días.
```

---

## 🎯 Característica Clave: Magic Links (Aprobación por Email)

### Cómo funciona

El supervisor **no necesita entrar al portal**. Puede:

1. **Hacer clic en "APROBAR"** dentro del email → lleva a:
   ```
   https://app.marfund.org/api/requests/token/[TOKEN_APROBACION]?action=approve
   ```
   - Token válido por 7 días
   - Aprueba la solicitud instantáneamente
   - Registra quién aprobó y cuándo

2. **Hacer clic en "RECHAZAR"** dentro del email → lleva a:
   ```
   https://app.marfund.org/api/requests/token/[TOKEN_RECHAZO]?action=reject
   ```
   - Token diferente, también válido 7 días
   - Rechaza la solicitud
   - El empleado recibe notificación

---

## 📊 Tabla de Fechas (Dinámica)

La tabla de fechas se genera automáticamente en N8N en función de las fechas solicitadas:

**Ejemplo para rango 20-24 de julio:**
```html
<table>
  <thead>
    <tr bgcolor="#374151">
      <th>Fecha Inicio</th>
      <th>Fecha Fin</th>
      <th>Días Hábiles</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>20 de julio de 2026</td>
      <td>24 de julio de 2026</td>
      <td>5</td>
    </tr>
  </tbody>
</table>
```

Si hay múltiples rangos, aparecen en filas diferentes.

---

## 🔄 Qué Pasa Después

### Si el supervisor aprueba:
1. Solicitud cambia a `status = 'approved'`
2. Se registra quién aprobó y cuándo
3. Se dispara el **segundo webhook** `N8N_WEBHOOK_DECISION`
4. N8N envía correo al empleado: "✅ Tu solicitud fue APROBADA"
5. Los días se descuentan del saldo del colaborador

### Si el supervisor rechaza:
1. Solicitud cambia a `status = 'rejected'`
2. Se registra quién rechazó y cuándo
3. Se dispara el segundo webhook
4. N8N envía correo al empleado: "❌ Tu solicitud fue RECHAZADA"
5. No se descuentan días

---

## 🛠️ Configuración Requerida en `.env`

```bash
N8N_BASE_URL=https://n8n.tudominio.com
N8N_WEBHOOK_NEW_REQUEST=https://n8n.tudominio.com/webhook/nueva-solicitud
N8N_WEBHOOK_DECISION=https://n8n.tudominio.com/webhook/decision-aprobacion

APP_URL=https://app.marfund.org
```

Si `N8N_WEBHOOK_NEW_REQUEST` no está configurado:
- El webhook no se dispara
- Se registra warning en logs: `[n8n] Webhook de nueva solicitud no configurado en .env`
- El sistema sigue funcionando (fallback seguro)

---

## 📋 Checklist de Validación

- ✅ Token de aprobación se crea con 7 días de vigencia
- ✅ Token de rechazo tiene su propia URL (no confundir)
- ✅ Correo al empleado es breve y tranquilizador
- ✅ Correo al supervisor tiene todos los datos + botones de acción
- ✅ Las fechas se formatean en español (Guatemala)
- ✅ Los totales de días son precisos (incluye cálculo de días hábiles)
- ✅ Magic links funcionan sin necesidad de login
- ✅ N8N busca datos en Google Sheets (no hardcodeados)

---

## 🔒 Seguridad

- **Tokens únicos**: Cada solicitud genera 2 tokens aleatorios (no reusables)
- **Expiración**: 7 días
- **Una sola acción**: El token se consume en la primera acción (no se puede reutilizar)
- **Audit trail**: Toda decisión queda registrada en `request_history`
- **No sensible**: Los correos no contienen datos críticos, solo lo necesario

---

## 📊 Campos de Base de Datos Involucrados

### Tabla: `users` (Empleado y Supervisor)

| Campo | Tipo | Descripción | Usado en |
|-------|------|-------------|----------|
| `id` | int | Identificador único | FK en requests y tokens |
| `email` | varchar(255) | Correo del usuario (UNIQUE) | Destinatario de correos |
| `full_name` | varchar(255) | Nombre completo | Mostrado en correos |
| `employee_number` | varchar(50) | Código de colaborador | Mostrado en correos |
| `position` | varchar(255) | Puesto/cargo | Mostrado en correos supervisores |
| `manager_id` | int | FK a supervisor inmediato | Obtener datos del jefe |
| `role` | enum | employee/manager/hr_admin/super_admin | No usado en correos |
| `base_vacation_days` | decimal(5,2) | Días base de vacaciones | Consultas de saldo |
| `is_active` | tinyint(1) | Activo=1, Inactivo=0 | Filtrado en queries |

### Tabla: `vacation_requests`

| Campo | Tipo | Descripción | Usado en |
|-------|------|-------------|----------|
| `id` | int | ID único de solicitud | PK, FK en tokens y rangos |
| `request_number` | varchar(20) | Número formato VAC-YYYY-NNNN (UNIQUE) | Mostrado en asunto y cuerpo |
| `employee_id` | int | FK a users.id | Obtener datos del empleado |
| `manager_id` | int | FK a users.id | Obtener datos del supervisor |
| `request_type` | enum | vacation/permission/justified_absence/seniority_benefit | Formateado en correos |
| `reason` | text | Razón/justificación | Mostrado en correo al supervisor |
| `status` | enum | pending/approved/rejected/cancelled | No usado en correos iniciales |
| `manager_comments` | text | Comentarios del supervisor | Mostrado en correo de decisión |
| `created_at` | timestamp | Fecha de creación | Formateado en correos |

### Tabla: `request_date_ranges`

| Campo | Tipo | Descripción | Usado en |
|-------|------|-------------|----------|
| `id` | int | ID único del rango | N/A en correos |
| `request_id` | int | FK a vacation_requests.id (CASCADE) | Agrupar fechas |
| `date_from` | date | Fecha inicio (inclusive) | Mostrado en tabla HTML |
| `date_to` | date | Fecha fin (inclusive) | Mostrado en tabla HTML |
| `business_days` | decimal(5,2) | Días hábiles (ej: 5, 0.5) | Mostrado en tabla y total |

### Tabla: `approval_tokens`

| Campo | Tipo | Descripción | Usado en |
|-------|------|-------------|----------|
| `id` | int | ID único | N/A en correos |
| `request_id` | int | FK a vacation_requests.id | Vincular token a solicitud |
| `token` | varchar(255) | Token aleatorio (UNIQUE) | Mostrado en URLs de aprobación |
| `action` | enum | 'approve' o 'reject' | Determina acción al hacer clic |
| `expires_at` | timestamp | Expiración (7 días después) | Validación de enlaces |
| `used_at` | timestamp | NULL hasta usar | Valida consumo único |
| `created_at` | timestamp | Fecha creación | Auditoría |

### Tabla: `request_history`

| Campo | Tipo | Descripción | Usado en |
|-------|------|-------------|----------|
| `id` | int | ID único | Auditoría |
| `request_id` | int | FK a vacation_requests.id | Agrupar eventos |
| `action` | varchar(100) | Acción realizada | Auditoría (no en correos) |
| `performed_by` | int | FK a users.id | Registra quién actuó |
| `details` | text | Descripción de acción | Auditoría |
| `created_at` | timestamp | Fecha/hora de acción | Ordenamiento |

---

## 🔗 Relaciones entre Tablas (Flujo de Correos)

```
NUEVA SOLICITUD:
┌────────────────────────────────────────────────────────────┐
│ vacation_requests (PK: id, UNIQUE: request_number)         │
├────────────────────────────────────────────────────────────┤
│ request_number (ej: VAC-2026-0042)                         │
│ request_type (ej: 'vacation') → formatRequestType()        │
│ reason (texto enviado al supervisor)                       │
│ employee_id ──┐                                            │
│ manager_id  ──┼─┬─ Lookups de datos de usuarios            │
│ created_at ──┐│ │                                          │
└──────────────┼──┴─┬──────────────────────────────────────┐
               │    │                                        │
        ┌──────▼──┐ │  ┌──────────────────────────┐
        │  users  │ │  │  request_date_ranges     │
        │(emplead)│ │  ├──────────────────────────┤
        ├─────────┤ │  │ request_id (FK)          │
        │ id      │ │  │ date_from, date_to       │
        │ email   │ │  │ business_days (sumadas)  │
        │ name    │ │  │ → Tabla HTML             │
        │ position│ │  └──────────────────────────┘
        └─────────┘ │
                    │  ┌──────────────────────────┐
        ┌──────────▼─┐ │  approval_tokens         │
        │ users      │ │ ├──────────────────────────┤
        │ (supervisor)│ │ request_id (FK)          │
        ├────────────┤ │ token (aleatorio)        │
        │ id         │ │ action: 'approve'        │
        │ email      │ │ expires_at: +7 días      │
        │ name       │ │ → URLs magic link        │
        └────────────┘ └──────────────────────────┘

DECISIÓN (Aprobación/Rechazo):
┌────────────────────────────────────────────────────────────┐
│ approval_tokens (token consumido)                           │
└────────────────────────────────────────────────────────────┘
               ↓
┌────────────────────────────────────────────────────────────┐
│ vacation_requests (status: 'approved' o 'rejected')        │
├────────────────────────────────────────────────────────────┤
│ manager_comments (si supervisor rechazó)                   │
│ employee_id ──┐                                            │
│ manager_id  ──┼─ Lookups de correos                       │
└────────────┼──┴─┬──────────────────────────────────────┐
             │    │                                       │
      ┌──────▼──┐ │  Query: SELECT FROM users            │
      │  users  │ │  WHERE role IN ('hr_admin',          │
      │ (emplead)│ │          'super_admin') ──────┐      │
      │ (supervis │ │                              │      │
      └─────────┘ │                    ┌───────────▼──────┐
                  │                    │ Lista de RRHH    │
                  │                    │ (para CC)        │
                  │                    └──────────────────┘
       ┌──────────▼──────────────────────────────┐
       │ request_date_ranges                     │
       │ → Tabla HTML (nuevamente generada)      │
       └─────────────────────────────────────────┘
```

---

## 🎯 Queries SQL Implícitos en N8N Webhooks

### 1️⃣ Obtener solicitud completa + empleado + supervisor
**Disparador:** Webhook nueva solicitud
```sql
SELECT 
  vr.id, vr.request_number, vr.request_type, vr.reason,
  u_emp.id as employee_id, u_emp.email, u_emp.full_name, 
  u_emp.position, u_emp.employee_number,
  u_mgr.id as manager_id, u_mgr.email as manager_email, 
  u_mgr.full_name as manager_name,
  vr.created_at
FROM vacation_requests vr
JOIN users u_emp ON vr.employee_id = u_emp.id
JOIN users u_mgr ON vr.manager_id = u_mgr.id
WHERE vr.id = ?
```

### 2️⃣ Obtener rangos de fechas
**Disparador:** Luego de Q1
```sql
SELECT date_from, date_to, business_days
FROM request_date_ranges
WHERE request_id = ?
ORDER BY date_from ASC
```

### 3️⃣ Obtener tokens de aprobación/rechazo
**Disparador:** Después de crear rangos
```sql
SELECT token FROM approval_tokens
WHERE request_id = ? AND action = 'approve'
LIMIT 1

SELECT token FROM approval_tokens
WHERE request_id = ? AND action = 'reject'
LIMIT 1
```

### 4️⃣ Obtener usuarios de RRHH (para webhook decisión)
**Disparador:** Cuando se aprueba/rechaza
```sql
SELECT id, email, full_name
FROM users
WHERE role IN ('hr_admin', 'super_admin')
AND is_active = 1
```

### 5️⃣ Validar token y obtener solicitud (endpoint público)
**Disparador:** Cuando supervisor hace clic en enlace
```sql
SELECT vr.id, vr.request_number, at.action, at.expires_at, at.used_at
FROM approval_tokens at
JOIN vacation_requests vr ON at.request_id = vr.id
WHERE at.token = ? AND at.used_at IS NULL
AND at.expires_at > NOW()
```

---

## 📧 Mapeo de Campos N8N ↔ Base de Datos

### Webhook 1: Nueva Solicitud

| Campo N8N | Campo BD | Tabla | Tipo | Ejemplo |
|-----------|----------|-------|------|---------|
| `request_number` | `request_number` | vacation_requests | varchar | VAC-2026-0042 |
| `request_type` | `request_type` | vacation_requests | enum | vacation → "Vacaciones" |
| `reason` | `reason` | vacation_requests | text | "Descanso familiar" |
| `total_days` | SUM(`business_days`) | request_date_ranges | decimal | 5.00 |
| `employee_name` | `full_name` | users | varchar | Amy Louise Jones |
| `employee_email` | `email` | users | varchar | ajones@marfund.org |
| `employee_position` | `position` | users | varchar | Coordinadora |
| `employee_number` | `employee_number` | users | varchar | 1110 |
| `manager_name` | `full_name` | users | varchar | Judith Adriana Morales López |
| `manager_email` | `email` | users | varchar | jmorales@marfund.org |
| `created_at` | `created_at` | vacation_requests | timestamp | 2026-07-17 |
| `dates_table_html` | `*` (generated) | request_date_ranges | HTML | \<table\>...\</table\> |
| `approve_url` | `token` | approval_tokens | varchar | /api/requests/token/abc123xyz?action=approve |
| `reject_url` | `token` | approval_tokens | varchar | /api/requests/token/abc123xyz?action=reject |

### Webhook 2: Decisión (Aprobación/Rechazo)

| Campo N8N | Campo BD | Tabla | Descripción |
|-----------|----------|-------|-------------|
| `request_number` | `request_number` | vacation_requests | Número de solicitud |
| `request_type` | `request_type` | vacation_requests | Tipo formateado |
| `status` | `status` | vacation_requests | 'approved' o 'rejected' |
| `decision_label` | (generado) | - | "APROBADA ✅" o "RECHAZADA ❌" |
| `manager_comments` | `manager_comments` | vacation_requests | Comentarios del supervisor |
| `total_days` | SUM(`business_days`) | request_date_ranges | Total de días |
| `employee_email` | `email` | users | Correo destinatario |
| `hr_emails` | `email` | users | Lista de RRHH (role IN (...)) |
| `dates_table_html` | `*` (generated) | request_date_ranges | Tabla HTML renovada |

---

## ⚠️ Validaciones Críticas de BD

| Validación | Campo | Impacto | Motivo |
|-----------|-------|--------|--------|
| **FK constraint** | `vacation_requests.employee_id` → `users.id` | CRÍTICO | Si se borra empleado, solicitud queda huérfana |
| **FK constraint** | `vacation_requests.manager_id` → `users.id` | CRÍTICO | Si se borra supervisor, no se sabe a quién enviar correo |
| **UNIQUE key** | `vacation_requests.request_number` | CRÍTICO | VAC-YYYY-NNNN no pueden duplicarse |
| **UNIQUE key** | `approval_tokens.token` | CRÍTICO | Tokens duplicados = aprobación duplicada |
| **FK + CASCADE** | `request_date_ranges.request_id` → `vacation_requests.id` | ALTO | Borrar solicitud borra también rangos |
| **NOT NULL** | `request_date_ranges.business_days` | MEDIO | Siempre debe existir (min: 0.5) |
| **Enum `status`** | pending/approved/rejected/cancelled | MEDIO | Solo estos 4 valores válidos |
| **Enum `action`** | approve/reject | BAJO | Token solo tiene estos 2 valores |
| **Timestamp** | `approval_tokens.expires_at` | ALTO | Validar expiración antes de usar token |
| **Unique `email`** | users.email | ALTO | No puede haber 2 usuarios con mismo email |

---

## 🔍 Validaciones de Datos en Correos

| Validación | Dónde ocurre | Qué valida |
|-----------|-------------|-----------|
| Email válido | Backend (n8nService.js) | Que `employee_email` no sea NULL |
| Manager existe | Backend (requestController.js) | Que `manager_id` sea válido FK |
| Tokens creados | Backend (requestController.js) | 2 tokens con `expires_at = NOW() + 7 días` |
| Rangos de fechas | Frontend (NewRequest.jsx) | Que `date_from ≤ date_to` |
| Días positivos | Backend (requestController.js) | Que `business_days > 0` |
| N8N conectado | Backend (n8nService.js) | Que `N8N_WEBHOOK_NEW_REQUEST` no sea NULL |
| Google Sheets activo | N8N workflow | Que Google Sheets connection esté autorizada |

---

## 📝 Notas de Implementación

1. **No hay transacción XA**: La creación de solicitud y el webhook N8N son asincrónico. Si N8N falla, la solicitud ya existe en BD.

2. **Google Sheets lookup** (en N8N):
   - Busca por `employee_email`
   - Extrae `Correo supervisor` y `Nombre supervisor`
   - Si no encuentra, N8N debe tener fallback

3. **Formato de fechas**: `formatDate()` en `n8nService.js`
   - Locale: `es-GT`
   - Ejemplo: "17 de julio de 2026"
   - Zona horaria: UTC-6 (America/Guatemala)

4. **Tabla HTML generada en backend**:
   - Encabezados: "Fecha Inicio", "Fecha Fin", "Días Hábiles"
   - Fondo header: `#374151` (gris oscuro)
   - Bordes: 1px sólido

5. **Seguridad de URLs**:
   - Tokens se generan con `crypto.randomBytes(32).toString('hex')`
   - No reversibles, no predecibles
   - Se validan contra `approval_tokens.token` exactamente

