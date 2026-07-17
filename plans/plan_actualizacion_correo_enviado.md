# Plan de Actualización — Rediseño de Correo de Nueva Solicitud

## Estado: PENDIENTE

| # | Requerimiento | Estado |
|---|---------------|--------|
| R1 | AJUSTE 1: Cambiar asunto del correo al supervisor | ⏳ Pendiente |
| R2 | AJUSTE 2: Rediseñar cuerpo del correo al supervisor | ⏳ Pendiente |
| R3 | AJUSTE 3: Modal de comentarios al rechazar | ⏳ Pendiente |

---

## Objetivo

Mejorar la comunicación en el correo de notificación al supervisor:
1. **Asunto más claro**: Incluir tipo de solicitud y nombre del colaborador
2. **Cuerpo simplificado**: Mostrar quién solicitó, qué tipo, y justificación
3. **Rechazo con comentarios**: Supervisores deben agregar motivo de rechazo (en app, no en email)

---

## Contexto Actual

**Correo actual al supervisor (jefe):**

```
Asunto: 📋 Solicitud pendiente de aprobación - Amy Louise Jones

Cuerpo:
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

Botones con magic links de 7 días.
```

---

## Cambios Propuestos

### R1 — AJUSTE 1: Rediseño del Asunto

**Cambio:**
```
ANTES:
📋 Solicitud pendiente de aprobación - Amy Louise Jones

DESPUÉS:
Nueva Solicitud de <<request_type>> para: <<employee_name>>

Ejemplos:
- Nueva Solicitud de Vacaciones para: Amy Louise Jones
- Nueva Solicitud de Permiso Personal para: Edgar Chali
- Nueva Solicitud de Ausencia Justificada para: Lilian Boteo
```

**Mapeo de tipos:**
| Enum BD | Texto en correo |
|---------|-----------------|
| `vacation` | Vacaciones |
| `permission` | Permiso Personal |
| `justified_absence` | Ausencia Justificada |
| `seniority_benefit` | Beneficio Antigüedad |

**Implementación:**
- **Archivo**: `backend/services/n8nService.js` (función `triggerNewRequest`)
- **Campo N8N**: `subject_line` (nuevo)
- **Lógica**: Usar `formatRequestType()` ya existente

---

### R2 — AJUSTE 2: Rediseño del Cuerpo

**Cambio:**

```
ANTES:
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
[tabla...]

DESPUÉS:
El colaborador <<employee_name>> ha solicitado: <<request_type>>
Justificación: <<reason>>.

Gracias!
```

**Ejemplo real:**
```
El colaborador Lilian Boteo ha solicitado: Vacaciones
Justificación: Descanso familiar.

Gracias!
```

**Notas:**
- Campo `reason` ya viene en `vacation_requests.reason`
- Si `reason` es NULL, mostrar "Sin justificación"
- El HTML es mínimo (texto plano preferible)

**Implementación:**
- **Archivo**: `backend/services/n8nService.js`
- **Cambios en payload**: Incluir campo `request_reason` (alias para `reason`)
- **N8N**: Actualizar template HTML del correo

---

### R3 — AJUSTE 3: Modal de Comentarios al Rechazar

**Cambio:** Cuando supervisor hace clic en "RECHAZAR" desde email

**FLUJO ACTUAL:**
```
Supervisor → Clic en "❌ RECHAZAR" 
       ↓
Token se consume inmediatamente
       ↓
Solicitud status = 'rejected'
       ↓
N8N envía correo al empleado "Solicitud rechazada"
```

**FLUJO NUEVO:**
```
Supervisor → Clic en "❌ RECHAZAR"
       ↓
Endpoint `/api/requests/token/:token` (público) redirige a modal
       ↓
Modal pide: "¿Por qué rechazas esta solicitud?" (textarea obligatorio)
       ↓
Supervisor envía comentario
       ↓
Guardar en `vacation_requests.manager_comments`
       ↓
Marcar token como consumido
       ↓
Solicitud status = 'rejected'
       ↓
N8N envía correo al empleado con motivo del rechazo
```

**Cambios requeridos:**

#### Backend

**Archivo: `backend/routes/requestRoutes.js`**

Cambiar endpoint `/api/requests/token/:token`:

```javascript
// ANTES: POST directo, consumía token al instante
router.post('/token/:token', requestController.processApprovalToken);

// DESPUÉS: GET redirige a modal, POST guarda comentario
router.get('/token/:token', requestController.getTokenAction);      // NEW
router.post('/token/:token/reject', requestController.rejectWithComment); // NEW
```

#### Frontend

**Archivo: `frontend/src/pages/TokenApprovalPage.jsx`** (NUEVO)

Nueva página que se abre en navegador cuando supervisor hace clic en link del email:

```jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function TokenApprovalPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState(null); // 'approve', 'reject', null
  const [comment, setComment] = useState('');
  const [requestData, setRequestData] = useState(null);

  // Al montar: validar token y obtener datos de solicitud
  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await api.get(`/requests/token/${token}/validate`);
        setRequestData(res.data); // { id, request_number, employee_name, request_type, ... }
        setAction(res.data.action); // 'approve' o 'reject'
      } catch (error) {
        console.error('Token inválido o expirado');
        // Mostrar error amigable
      }
    };
    validateToken();
  }, [token]);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await api.post(`/requests/token/${token}/approve`);
      navigate('/'); // O mostrar mensaje de éxito
    } catch (error) {
      console.error('Error al aprobar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectWithComment = async () => {
    if (!comment.trim()) {
      alert('Por favor escribe un motivo de rechazo');
      return;
    }
    setIsLoading(true);
    try {
      await api.post(`/requests/token/${token}/reject`, { comment });
      navigate('/'); // O mostrar mensaje de éxito
    } catch (error) {
      console.error('Error al rechazar');
    } finally {
      setIsLoading(false);
    }
  };

  if (!requestData) return <div>Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        
        <h1 className="text-xl font-bold text-gray-800 mb-4">
          Solicitud: {requestData.request_number}
        </h1>

        <div className="space-y-3 bg-gray-50 p-4 rounded mb-6">
          <p><strong>Colaborador:</strong> {requestData.employee_name}</p>
          <p><strong>Tipo:</strong> {requestData.request_type}</p>
          <p><strong>Total días:</strong> {requestData.total_days}</p>
        </div>

        {action === 'approve' && (
          <div className="space-y-4">
            <p className="text-gray-600">¿Aprobar esta solicitud?</p>
            <button 
              onClick={handleApprove}
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              ✅ Sí, Aprobar
            </button>
          </div>
        )}

        {action === 'reject' && (
          <div className="space-y-4">
            <label className="block">
              <p className="text-gray-600 font-medium mb-2">¿Por qué rechazas esta solicitud?</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escribe el motivo del rechazo..."
                className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows="4"
                disabled={isLoading}
              />
            </label>
            <button 
              onClick={handleRejectWithComment}
              disabled={isLoading || !comment.trim()}
              className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
            >
              ❌ Rechazar con Comentario
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
```

**Archivo: `frontend/src/App.jsx`**

Agregar ruta pública (sin autenticación):

```jsx
// Ruta pública para aprobación por token
<Route path="/requests/token/:token" element={<TokenApprovalPage />} />
```

#### Backend Controllers

**Archivo: `backend/controllers/requestController.js`**

Nuevas funciones:

```javascript
// GET /api/requests/token/:token/validate
// Valida que el token exista, no esté vencido y no esté consumido
exports.validateToken = async (req, res) => {
  const { token } = req.params;
  
  try {
    const [tokens] = await db.query(`
      SELECT at.id, at.action, at.expires_at, at.used_at,
             vr.id as request_id, vr.request_number,
             u.full_name as employee_name, vr.request_type, 
             SUM(rdr.business_days) as total_days
      FROM approval_tokens at
      JOIN vacation_requests vr ON at.request_id = vr.id
      JOIN users u ON vr.employee_id = u.id
      LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
      WHERE at.token = ? 
        AND at.used_at IS NULL
        AND at.expires_at > NOW()
      GROUP BY at.id
    `, [token]);

    if (!tokens.length) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    const tokenData = tokens[0];
    res.json({
      action: tokenData.action, // 'approve' o 'reject'
      request_number: tokenData.request_number,
      employee_name: tokenData.employee_name,
      request_type: formatRequestType(tokenData.request_type),
      total_days: tokenData.total_days
    });
  } catch (error) {
    console.error('Error validando token:', error);
    res.status(500).json({ message: 'Error validando token' });
  }
};

// POST /api/requests/token/:token/approve
// Aprueba solicitud y consume token
exports.approveViaToken = async (req, res) => {
  const { token } = req.params;
  
  try {
    // Validar token
    const [tokens] = await db.query(`
      SELECT at.id, at.request_id, at.expires_at, at.used_at
      FROM approval_tokens at
      WHERE at.token = ? AND at.used_at IS NULL AND at.expires_at > NOW()
    `, [token]);

    if (!tokens.length) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    const { id: tokenId, request_id: requestId } = tokens[0];

    // Actualizar solicitud a 'approved'
    await db.query(`
      UPDATE vacation_requests 
      SET status = 'approved', manager_decision_date = NOW()
      WHERE id = ?
    `, [requestId]);

    // Marcar token como consumido
    await db.query(`
      UPDATE approval_tokens 
      SET used_at = NOW()
      WHERE id = ?
    `, [tokenId]);

    // Disparar webhook de decisión
    const [reqs] = await db.query(`
      SELECT vr.*, u.full_name, u.email
      FROM vacation_requests vr
      JOIN users u ON vr.employee_id = u.id
      WHERE vr.id = ?
    `, [requestId]);

    await triggerDecisionNotification(reqs[0], 'approved');

    res.json({ message: 'Solicitud aprobada exitosamente' });
  } catch (error) {
    console.error('Error aprobando:', error);
    res.status(500).json({ message: 'Error aprobando solicitud' });
  }
};

// POST /api/requests/token/:token/reject
// Rechaza solicitud con comentario y consume token
exports.rejectWithComment = async (req, res) => {
  const { token } = req.params;
  const { comment } = req.body;

  if (!comment?.trim()) {
    return res.status(400).json({ message: 'El comentario es obligatorio' });
  }

  try {
    // Validar token
    const [tokens] = await db.query(`
      SELECT at.id, at.request_id, at.expires_at, at.used_at
      FROM approval_tokens at
      WHERE at.token = ? AND at.used_at IS NULL AND at.expires_at > NOW()
    `, [token]);

    if (!tokens.length) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    const { id: tokenId, request_id: requestId } = tokens[0];

    // Actualizar solicitud a 'rejected' + comentarios
    await db.query(`
      UPDATE vacation_requests 
      SET status = 'rejected', 
          manager_comments = ?,
          manager_decision_date = NOW()
      WHERE id = ?
    `, [comment, requestId]);

    // Marcar token como consumido
    await db.query(`
      UPDATE approval_tokens 
      SET used_at = NOW()
      WHERE id = ?
    `, [tokenId]);

    // Disparar webhook de decisión
    const [reqs] = await db.query(`
      SELECT vr.*, u.full_name, u.email
      FROM vacation_requests vr
      JOIN users u ON vr.employee_id = u.id
      WHERE vr.id = ?
    `, [requestId]);

    await triggerDecisionNotification(reqs[0], 'rejected');

    res.json({ message: 'Solicitud rechazada con comentario' });
  } catch (error) {
    console.error('Error rechazando:', error);
    res.status(500).json({ message: 'Error rechazando solicitud' });
  }
};
```

---

## Cambios en N8N Workflow

### Workflow: "MAR Fund - Nueva Solicitud"

**Cambios:**

1. **Actualizar nodo Webhook** para recibir nuevo campo `subject_line`

2. **Actualizar template HTML del correo al supervisor:**

```html
<!-- ANTES -->
Asunto: 📋 Solicitud pendiente de aprobación - {{$json.body.employee_name}}

Cuerpo:
Nueva Solicitud de {{$json.body.request_type}}

┌─────────────────────────────────┐
│ N° Solicitud: {{$json.body.request_number}}     │
│ Empleado: {{$json.body.employee_name}}      │
│ Cargo: {{$json.body.employee_position}}             │
│ Tipo: {{$json.body.request_type}}                │
│ Razón: {{$json.body.reason}}        │
│ Total días hábiles: {{$json.body.total_days}}           │
└─────────────────────────────────┘

Fechas solicitadas:
{{$json.body.dates_table_html}}

Por favor toma una decisión:

[✅ APROBAR]  [❌ RECHAZAR]

<!-- DESPUÉS -->
Asunto: {{$json.body.subject_line}}

Cuerpo:
El colaborador {{$json.body.employee_name}} ha solicitado: {{$json.body.request_type}}
Justificación: {{$json.body.reason}}.

Gracias!

<!-- BOTONES -->
[✅ APROBAR]({{$json.body.approve_url}})
[❌ RECHAZAR]({{$json.body.reject_url}})
```

**Nota:** Los botones ahora redirigen a la página `TokenApprovalPage` en lugar de consumir el token directamente.

---

## Resumen de Archivos a Modificar

### Backend

| Archivo | Cambio | Tipo |
|---------|--------|------|
| `backend/services/n8nService.js` | Agregar `subject_line` y `request_reason` al payload webhook | Modificación |
| `backend/controllers/requestController.js` | 3 nuevas funciones: `validateToken`, `approveViaToken`, `rejectWithComment` | Nueva función |
| `backend/routes/requestRoutes.js` | 3 nuevas rutas GET/POST `/token/:token/*` | Nueva ruta |

### Frontend

| Archivo | Cambio | Tipo |
|---------|--------|------|
| `frontend/src/pages/TokenApprovalPage.jsx` | Nueva página pública para aprobación | Nuevo archivo |
| `frontend/src/App.jsx` | Agregar ruta `/requests/token/:token` sin autenticación | Modificación |

### N8N

| Workflow | Cambio |
|----------|--------|
| MAR Fund - Nueva Solicitud | Actualizar asunto y template HTML |

---

## Impacto en Tablas

| Tabla | Campo | Cambio |
|-------|-------|--------|
| `vacation_requests` | `manager_comments` | Ahora se llena obligatoriamente al rechazar desde email |
| `approval_tokens` | `used_at` | Se actualiza al usar el token (approval o reject) |

---

## Notas Técnicas

1. **URL pública**: TokenApprovalPage NO requiere autenticación (solo token válido)
2. **Validación de token**: Ocurre 2 veces (al cargar página + al aprobar/rechazar)
3. **Comentario obligatorio**: Solo para rechazos, no para aprobaciones
4. **Flujo alternativo**: Los supervisores que acceden desde el portal (no email) siguen usando la ruta existente
5. **N8N ahora recibe**: `subject_line`, `request_reason` adicionales en payload
6. **Magic links nuevos**: `/requests/token/:token?action=approve` redirige a TokenApprovalPage

---

## Validaciones Requeridas

| Validación | Dónde | Qué valida |
|-----------|-------|-----------|
| Token no vencido | Backend (validateToken) | `expires_at > NOW()` |
| Token no consumido | Backend (validateToken) | `used_at IS NULL` |
| Token existe | Backend (validateToken) | Existe en BD |
| Comentario no vacío | Frontend (handleRejectWithComment) | `comment.trim().length > 0` |
| Comentario requerido | Backend (rejectWithComment) | No permitir rechazar sin comentario |

---

## Plan de Implementación

1. **Paso 1:** Revisar y aprobar plan
2. **Paso 2:** Actualizar `n8nService.js` (agregar campos al payload)
3. **Paso 3:** Crear `TokenApprovalPage.jsx` (nueva página)
4. **Paso 4:** Agregar rutas en `requestRoutes.js` (3 nuevos endpoints)
5. **Paso 5:** Agregar funciones en `requestController.js` (3 nuevas)
6. **Paso 6:** Actualizar `App.jsx` (nueva ruta pública)
7. **Paso 7:** Actualizar N8N workflow (asunto + template)
8. **Paso 8:** Testing en dev
9. **Paso 9:** Deploy en producción

---

## Comportamiento Esperado

**Supervisor recibe correo:**
```
Asunto: Nueva Solicitud de Vacaciones para: Lilian Boteo

Cuerpo:
El colaborador Lilian Boteo ha solicitado: Vacaciones
Justificación: Descanso familiar.

Gracias!

[✅ APROBAR] [❌ RECHAZAR]
```

**Si hace clic en RECHAZAR:**
1. Se abre página con modal "¿Por qué rechazas esta solicitud?"
2. Supervisor escribe motivo (ej: "No hay cobertura en ese período")
3. Envía rechazo
4. Empleado recibe correo: "Tu solicitud fue rechazada. Motivo: No hay cobertura en ese período"

**Si hace clic en APROBAR:**
1. Se abre página con confirmación
2. Supervisor confirma aprobación
3. Empleado recibe correo: "Tu solicitud fue aprobada"

