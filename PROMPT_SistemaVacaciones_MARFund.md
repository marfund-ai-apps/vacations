# PROMPT COMPLETO — Sistema de Gestión de Vacaciones / Permisos
## Stack: React + MySQL + n8n | Deploy: Servidor LAMP

---

## 🎯 CONTEXTO Y OBJETIVO

Desarrolla una aplicación web completa para gestionar **solicitudes de vacaciones y permisos** del personal de MAR Fund. La app debe replicar digitalmente el formulario físico adjunto y automatizar todo el flujo de aprobación mediante notificaciones por email con n8n como motor de automatización.

**Stack tecnológico:**
- **Frontend:** React 18 + Vite + TailwindCSS + React Router v6
- **Backend:** Node.js + Express (API REST)
- **Base de datos:** MySQL 8.x
- **Automatización / Notificaciones:** n8n (self-hosted, webhooks HTTP)
- **Autenticación:** Google OAuth 2.0 (Gmail)
- **Deploy:** Servidor LAMP (Apache como reverse proxy, Node.js como proceso PM2)

---

## 📁 ESTRUCTURA DEL PROYECTO

```
vacation-system/
├── frontend/                    # React App
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── GoogleLoginButton.jsx
│   │   │   ├── forms/
│   │   │   │   └── VacationRequestForm.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── EmployeeDashboard.jsx
│   │   │   │   ├── ManagerDashboard.jsx
│   │   │   │   └── HRDashboard.jsx
│   │   │   ├── reports/
│   │   │   │   └── VacationReportByEmployee.jsx
│   │   │   └── shared/
│   │   │       ├── Navbar.jsx
│   │   │       ├── StatusBadge.jsx
│   │   │       └── RequestCard.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── NewRequest.jsx
│   │   │   ├── MyRequests.jsx
│   │   │   ├── PendingApprovals.jsx
│   │   │   ├── Reports.jsx
│   │   │   └── AdminUsers.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   └── api.js
│   │   └── App.jsx
├── backend/                     # Node.js + Express API
│   ├── config/
│   │   ├── db.js
│   │   └── passport.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── requestController.js
│   │   ├── userController.js
│   │   └── reportController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── roleMiddleware.js
│   ├── models/
│   │   ├── User.js
│   │   └── VacationRequest.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── requestRoutes.js
│   │   ├── userRoutes.js
│   │   └── reportRoutes.js
│   ├── services/
│   │   └── n8nService.js        # Disparador de webhooks hacia n8n
│   └── server.js
├── database/
│   └── schema.sql
└── n8n-workflows/
    ├── workflow_nueva_solicitud.json
    └── workflow_decision_aprobacion.json
```

---

## 🗄️ BASE DE DATOS — MySQL Schema

```sql
-- database/schema.sql

CREATE DATABASE IF NOT EXISTS vacation_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vacation_system;

-- Tabla de usuarios (autenticados con Google OAuth)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    employee_number VARCHAR(50),
    position VARCHAR(255),                    -- Cargo
    role ENUM('employee', 'manager', 'hr_admin', 'super_admin') DEFAULT 'employee',
    manager_id INT NULL,                      -- FK al jefe inmediato
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabla principal de solicitudes
CREATE TABLE vacation_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_number VARCHAR(20) UNIQUE NOT NULL,  -- Número correlativo: VAC-2024-0001
    employee_id INT NOT NULL,
    request_type ENUM('vacation', 'permission', 'justified_absence') NOT NULL,
    reason TEXT,
    notes TEXT,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    manager_id INT NOT NULL,                     -- Jefe al momento de solicitar
    manager_comments TEXT,                       -- Comentarios del jefe al aprobar/denegar
    manager_decision_date TIMESTAMP NULL,
    notified_employee BOOLEAN DEFAULT FALSE,
    notified_manager BOOLEAN DEFAULT FALSE,
    notified_hr BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id),
    FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Tabla de rangos de fechas por solicitud (puede tener múltiples rangos)
CREATE TABLE request_date_ranges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    business_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (request_id) REFERENCES vacation_requests(id) ON DELETE CASCADE
);

-- Tabla de historial / auditoría
CREATE TABLE request_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,              -- 'created', 'approved', 'rejected', 'email_sent', etc.
    performed_by INT NULL,                     -- Usuario que realizó la acción
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES vacation_requests(id),
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- Tabla de tokens para aprobación por email (link seguro enviado al jefe)
CREATE TABLE approval_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    action ENUM('approve', 'reject') NULL,     -- Se llena cuando el jefe hace clic
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES vacation_requests(id)
);

-- Vista para reporte de días por empleado por año
CREATE OR REPLACE VIEW v_employee_days_summary AS
SELECT 
    u.id AS employee_id,
    u.full_name,
    u.email,
    u.employee_number,
    u.position,
    vr.request_type,
    vr.status,
    YEAR(vr.created_at) AS fiscal_year,
    SUM(rdr.business_days) AS total_business_days,
    COUNT(DISTINCT vr.id) AS total_requests
FROM users u
LEFT JOIN vacation_requests vr ON u.id = vr.employee_id AND vr.status = 'approved'
LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
GROUP BY u.id, u.full_name, u.email, u.employee_number, u.position, 
         vr.request_type, vr.status, YEAR(vr.created_at);

-- Índices de rendimiento
CREATE INDEX idx_vacation_requests_employee ON vacation_requests(employee_id);
CREATE INDEX idx_vacation_requests_manager ON vacation_requests(manager_id);
CREATE INDEX idx_vacation_requests_status ON vacation_requests(status);
CREATE INDEX idx_vacation_requests_year ON vacation_requests(created_at);
CREATE INDEX idx_request_date_ranges_request ON request_date_ranges(request_id);
```

---

## 🔐 AUTENTICACIÓN — Google OAuth 2.0

### Backend: `backend/config/passport.js`

```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      
      // Solo permitir correos del dominio autorizado (opcional)
      // if (!email.endsWith('@marfund.org')) return done(null, false);
      
      // Buscar o crear usuario
      const [rows] = await db.query('SELECT * FROM users WHERE google_id = ?', [profile.id]);
      
      if (rows.length > 0) {
        // Usuario existente: actualizar datos de Google
        await db.query(
          'UPDATE users SET full_name = ?, avatar_url = ? WHERE google_id = ?',
          [profile.displayName, profile.photos[0]?.value, profile.id]
        );
        return done(null, rows[0]);
      } else {
        // Nuevo usuario: crear registro
        const [result] = await db.query(
          'INSERT INTO users (google_id, email, full_name, avatar_url, role) VALUES (?, ?, ?, ?, ?)',
          [profile.id, email, profile.displayName, profile.photos[0]?.value, 'employee']
        );
        const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        return done(null, newUser[0]);
      }
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  done(null, rows[0]);
});
```

### Frontend: `frontend/src/pages/Login.jsx`

```jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user]);

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
        {/* Logo MAR Fund */}
        <img src="/mar-fund-logo.png" alt="MAR Fund" className="h-20 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Sistema de Vacaciones</h1>
        <p className="text-gray-500 mb-8">Solicitud y gestión de permisos y vacaciones</p>
        
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 
                     hover:border-indigo-400 hover:bg-indigo-50 text-gray-700 font-medium py-3 px-6 
                     rounded-xl transition-all duration-200 shadow-sm hover:shadow"
        >
          <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" className="w-5 h-5" />
          Iniciar sesión con Gmail
        </button>
        
        <p className="mt-6 text-xs text-gray-400">
          Solo usuarios autorizados de MAR Fund
        </p>
      </div>
    </div>
  );
}
```

---

## 📋 FORMULARIO DE SOLICITUD

### `frontend/src/components/forms/VacationRequestForm.jsx`

El formulario debe capturar exactamente los mismos campos del formato físico:

```jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const REQUEST_TYPES = [
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'permission', label: 'Permiso' },
  { value: 'justified_absence', label: 'Ausencia Justificada' },
];

// Función para calcular días hábiles (excluye sábados y domingos)
function calculateBusinessDays(from, to) {
  if (!from || !to) return 0;
  let count = 0;
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export default function VacationRequestForm({ onSuccess }) {
  const { user } = useAuth();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    request_type: 'vacation',
    reason: '',
    notes: '',
    manager_id: user?.manager_id || '',
    date_ranges: [{ date_from: '', date_to: '', business_days: 0 }],
  });

  useEffect(() => {
    api.get('/users/managers').then(r => setManagers(r.data));
  }, []);

  const updateDateRange = (index, field, value) => {
    const updated = [...form.date_ranges];
    updated[index][field] = value;
    // Recalcular días hábiles automáticamente
    if (updated[index].date_from && updated[index].date_to) {
      updated[index].business_days = calculateBusinessDays(
        updated[index].date_from, 
        updated[index].date_to
      );
    }
    setForm({ ...form, date_ranges: updated });
  };

  const addDateRange = () => {
    setForm({ 
      ...form, 
      date_ranges: [...form.date_ranges, { date_from: '', date_to: '', business_days: 0 }] 
    });
  };

  const removeDateRange = (index) => {
    if (form.date_ranges.length === 1) return;
    setForm({ ...form, date_ranges: form.date_ranges.filter((_, i) => i !== index) });
  };

  const totalBusinessDays = form.date_ranges.reduce((sum, r) => sum + (r.business_days || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/requests', form);
      alert('Solicitud enviada correctamente. Recibirás una notificación por correo.');
      onSuccess?.();
    } catch (err) {
      alert('Error al enviar la solicitud: ' + err.response?.data?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">
      {/* Encabezado con logo */}
      <div className="text-center mb-8">
        <img src="/mar-fund-logo.png" alt="MAR Fund" className="h-16 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">
          Solicitud de Vacaciones / Permisos
        </h2>
      </div>

      {/* Datos del empleado (solo lectura, viene del perfil Google) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Nombre del Empleado</label>
          <p className="text-gray-800 font-medium">{user?.full_name}</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">No. Empleado</label>
          <p className="text-gray-800">{user?.employee_number || 'Sin asignar'}</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Cargo</label>
          <p className="text-gray-800">{user?.position || 'Sin asignar'}</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Correo</label>
          <p className="text-gray-800">{user?.email}</p>
        </div>
      </div>

      {/* Tipo de solicitud */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo de la Solicitud</label>
        <div className="flex gap-6">
          {REQUEST_TYPES.map(type => (
            <label key={type.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="request_type"
                value={type.value}
                checked={form.request_type === type.value}
                onChange={e => setForm({ ...form, request_type: e.target.value })}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-sm font-medium text-gray-700">{type.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Razón / descripción */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Razón</label>
        <input
          type="text"
          value={form.reason}
          onChange={e => setForm({ ...form, reason: e.target.value })}
          placeholder="Describe brevemente el motivo de la solicitud..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
      </div>

      {/* Jefe inmediato */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Jefe Inmediato</label>
        <select
          value={form.manager_id}
          onChange={e => setForm({ ...form, manager_id: e.target.value })}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        >
          <option value="">Selecciona tu jefe inmediato...</option>
          {managers.map(m => (
            <option key={m.id} value={m.id}>{m.full_name} — {m.position}</option>
          ))}
        </select>
      </div>

      {/* Rangos de fechas */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">Fechas Solicitadas</label>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-700 text-white">
                <th className="py-2 px-4 text-sm text-center" colSpan={2}>Fecha</th>
                <th className="py-2 px-4 text-sm text-center">Días Hábiles</th>
                <th className="py-2 px-4 text-sm text-center w-10"></th>
              </tr>
              <tr className="bg-gray-600 text-white">
                <th className="py-2 px-4 text-sm text-center">De</th>
                <th className="py-2 px-4 text-sm text-center">A</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {form.date_ranges.map((range, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-2 px-2">
                    <input
                      type="date"
                      value={range.date_from}
                      onChange={e => updateDateRange(i, 'date_from', e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="date"
                      value={range.date_to}
                      min={range.date_from}
                      onChange={e => updateDateRange(i, 'date_to', e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-2 px-4 text-center font-semibold text-gray-700">
                    {range.business_days || 0}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button 
                      type="button" 
                      onClick={() => removeDateRange(i)}
                      className="text-red-400 hover:text-red-600 text-lg"
                    >×</button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-700 text-white font-bold">
                <td colSpan={2} className="py-2 px-4 text-sm text-right">Total Días Hábiles</td>
                <td className="py-2 px-4 text-center">{totalBusinessDays.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addDateRange}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          + Agregar otro rango de fechas
        </button>
      </div>

      {/* Notas */}
      <div className="mb-8">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Notas adicionales</label>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="Información adicional relevante..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />
      </div>

      {/* Botón enviar */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 
                   rounded-xl transition-colors duration-200 disabled:opacity-50"
      >
        {loading ? 'Enviando solicitud...' : 'Enviar Solicitud'}
      </button>
    </form>
  );
}
```

---

## ⚙️ BACKEND — API REST Node.js + Express

### `backend/controllers/requestController.js`

```javascript
const db = require('../config/db');
const n8nService = require('../services/n8nService');
const crypto = require('crypto');

// Generar número correlativo de solicitud
async function generateRequestNumber() {
  const year = new Date().getFullYear();
  const [rows] = await db.query(
    'SELECT COUNT(*) as count FROM vacation_requests WHERE YEAR(created_at) = ?', [year]
  );
  const count = rows[0].count + 1;
  return `VAC-${year}-${String(count).padStart(4, '0')}`;
}

// POST /api/requests — Crear nueva solicitud
exports.createRequest = async (req, res) => {
  const { request_type, reason, notes, manager_id, date_ranges } = req.body;
  const employee_id = req.user.id;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    
    const request_number = await generateRequestNumber();

    // Insertar solicitud principal
    const [result] = await conn.query(
      `INSERT INTO vacation_requests 
       (request_number, employee_id, request_type, reason, notes, status, manager_id) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [request_number, employee_id, request_type, reason, notes, manager_id]
    );
    const requestId = result.insertId;

    // Insertar rangos de fechas
    for (const range of date_ranges) {
      await conn.query(
        'INSERT INTO request_date_ranges (request_id, date_from, date_to, business_days) VALUES (?, ?, ?, ?)',
        [requestId, range.date_from, range.date_to, range.business_days]
      );
    }

    // Generar tokens de aprobación/rechazo para el jefe (link en el email)
    const approveToken = crypto.randomBytes(32).toString('hex');
    const rejectToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    await conn.query(
      'INSERT INTO approval_tokens (request_id, token, expires_at) VALUES (?, ?, ?), (?, ?, ?)',
      [requestId, approveToken, expiresAt, requestId, rejectToken, expiresAt]
    );

    // Registrar en historial
    await conn.query(
      'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
      [requestId, 'created', employee_id, `Solicitud ${request_number} creada`]
    );

    await conn.commit();

    // Obtener datos completos para notificación
    const [requestData] = await db.query(`
      SELECT vr.*, 
             u.full_name as employee_name, u.email as employee_email, 
             u.position as employee_position, u.employee_number,
             m.full_name as manager_name, m.email as manager_email
      FROM vacation_requests vr
      JOIN users u ON vr.employee_id = u.id
      JOIN users m ON vr.manager_id = m.id
      WHERE vr.id = ?
    `, [requestId]);

    const [dateRanges] = await db.query(
      'SELECT * FROM request_date_ranges WHERE request_id = ?', [requestId]
    );

    const totalDays = dateRanges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);

    // Disparar webhook n8n para notificaciones
    await n8nService.triggerNewRequest({
      request: requestData[0],
      dateRanges,
      totalDays,
      approveToken,
      rejectToken,
      appUrl: process.env.APP_URL
    });

    res.status(201).json({ 
      success: true, 
      request_number, 
      message: 'Solicitud creada y notificaciones enviadas' 
    });

  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear solicitud', error: error.message });
  } finally {
    conn.release();
  }
};

// GET /api/requests — Listar solicitudes (filtradas por rol)
exports.listRequests = async (req, res) => {
  const user = req.user;
  let query = '';
  let params = [];

  if (user.role === 'employee') {
    query = `SELECT vr.*, m.full_name as manager_name 
             FROM vacation_requests vr JOIN users m ON vr.manager_id = m.id
             WHERE vr.employee_id = ? ORDER BY vr.created_at DESC`;
    params = [user.id];
  } else if (user.role === 'manager') {
    query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email
             FROM vacation_requests vr JOIN users u ON vr.employee_id = u.id
             WHERE vr.manager_id = ? ORDER BY vr.created_at DESC`;
    params = [user.id];
  } else {
    // hr_admin y super_admin ven todo
    query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email,
                    m.full_name as manager_name
             FROM vacation_requests vr 
             JOIN users u ON vr.employee_id = u.id
             JOIN users m ON vr.manager_id = m.id
             ORDER BY vr.created_at DESC`;
  }

  const [rows] = await db.query(query, params);

  // Para cada solicitud, traer sus rangos de fechas
  for (const req of rows) {
    const [ranges] = await db.query(
      'SELECT * FROM request_date_ranges WHERE request_id = ?', [req.id]
    );
    req.date_ranges = ranges;
    req.total_days = ranges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);
  }

  res.json(rows);
};

// PUT /api/requests/:id/decision — Aprobar o rechazar (jefe inmediato)
exports.makeDecision = async (req, res) => {
  const { id } = req.params;
  const { decision, comments } = req.body; // decision: 'approved' | 'rejected'
  const manager_id = req.user.id;

  try {
    const [request] = await db.query(
      'SELECT * FROM vacation_requests WHERE id = ? AND manager_id = ? AND status = "pending"',
      [id, manager_id]
    );

    if (!request.length) {
      return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada' });
    }

    await db.query(
      `UPDATE vacation_requests 
       SET status = ?, manager_comments = ?, manager_decision_date = NOW() 
       WHERE id = ?`,
      [decision, comments, id]
    );

    await db.query(
      'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
      [id, decision, manager_id, `Decisión: ${decision}. Comentarios: ${comments || 'N/A'}`]
    );

    // Obtener datos completos para notificación de decisión
    const [fullRequest] = await db.query(`
      SELECT vr.*, 
             u.full_name as employee_name, u.email as employee_email,
             m.full_name as manager_name, m.email as manager_email
      FROM vacation_requests vr
      JOIN users u ON vr.employee_id = u.id
      JOIN users m ON vr.manager_id = m.id
      WHERE vr.id = ?
    `, [id]);

    const [dateRanges] = await db.query(
      'SELECT * FROM request_date_ranges WHERE request_id = ?', [id]
    );
    const totalDays = dateRanges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);

    // Obtener correo de RRHH
    const [hrUsers] = await db.query(
      'SELECT email, full_name FROM users WHERE role IN ("hr_admin", "super_admin") AND is_active = 1'
    );

    // Disparar webhook n8n para notificación de decisión
    await n8nService.triggerDecisionNotification({
      request: fullRequest[0],
      decision,
      comments,
      dateRanges,
      totalDays,
      hrUsers,
      appUrl: process.env.APP_URL
    });

    res.json({ success: true, message: `Solicitud ${decision === 'approved' ? 'aprobada' : 'rechazada'} correctamente` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al procesar decisión' });
  }
};

// GET /api/requests/token/:token — Aprobación por link de email
exports.processApprovalToken = async (req, res) => {
  const { token } = req.params;
  const { action, comments } = req.query; // action: 'approve' | 'reject'

  try {
    const [tokens] = await db.query(
      `SELECT at.*, vr.status, vr.manager_id 
       FROM approval_tokens at
       JOIN vacation_requests vr ON at.request_id = vr.id
       WHERE at.token = ? AND at.expires_at > NOW() AND at.used_at IS NULL`,
      [token]
    );

    if (!tokens.length) {
      return res.redirect(`${process.env.APP_URL}/token-expired`);
    }

    const tokenData = tokens[0];
    if (tokenData.status !== 'pending') {
      return res.redirect(`${process.env.APP_URL}/already-processed`);
    }

    const decision = action === 'approve' ? 'approved' : 'rejected';

    // Marcar token como usado
    await db.query('UPDATE approval_tokens SET used_at = NOW(), action = ? WHERE token = ?', 
                   [decision, token]);

    // Procesar decisión
    await db.query(
      `UPDATE vacation_requests SET status = ?, manager_comments = ?, manager_decision_date = NOW() WHERE id = ?`,
      [decision, comments || '', tokenData.request_id]
    );

    // Obtener datos y notificar
    const [fullRequest] = await db.query(`
      SELECT vr.*, u.full_name as employee_name, u.email as employee_email,
             m.full_name as manager_name, m.email as manager_email
      FROM vacation_requests vr
      JOIN users u ON vr.employee_id = u.id
      JOIN users m ON vr.manager_id = m.id
      WHERE vr.id = ?
    `, [tokenData.request_id]);

    const [dateRanges] = await db.query(
      'SELECT * FROM request_date_ranges WHERE request_id = ?', [tokenData.request_id]
    );
    const totalDays = dateRanges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);
    const [hrUsers] = await db.query(
      'SELECT email, full_name FROM users WHERE role IN ("hr_admin") AND is_active = 1'
    );

    await n8nService.triggerDecisionNotification({
      request: fullRequest[0], decision, comments: comments || '',
      dateRanges, totalDays, hrUsers, appUrl: process.env.APP_URL
    });

    // Redirigir a página de confirmación en la app
    res.redirect(`${process.env.APP_URL}/approval-confirmed?status=${decision}`);

  } catch (error) {
    console.error(error);
    res.redirect(`${process.env.APP_URL}/error`);
  }
};
```

---

## 🔗 SERVICIO N8N — Disparador de Webhooks

### `backend/services/n8nService.js`

```javascript
const axios = require('axios');

const N8N_BASE_URL = process.env.N8N_BASE_URL; // ej: https://n8n.tudominio.com

const WEBHOOKS = {
  NEW_REQUEST: process.env.N8N_WEBHOOK_NEW_REQUEST,
  DECISION: process.env.N8N_WEBHOOK_DECISION,
};

// Formatea el tipo de solicitud para mostrar en emails
const formatRequestType = (type) => ({
  vacation: 'Vacaciones',
  permission: 'Permiso',
  justified_absence: 'Ausencia Justificada'
}[type] || type);

// Formatea fechas legibles
const formatDate = (date) => new Date(date).toLocaleDateString('es-GT', {
  day: '2-digit', month: 'long', year: 'numeric'
});

// Genera tabla HTML de fechas para emails
const buildDatesTable = (dateRanges) => {
  const rows = dateRanges.map(r => `
    <tr>
      <td style="padding:8px; border:1px solid #ddd;">${formatDate(r.date_from)}</td>
      <td style="padding:8px; border:1px solid #ddd;">${formatDate(r.date_to)}</td>
      <td style="padding:8px; border:1px solid #ddd; text-align:center;">${r.business_days}</td>
    </tr>
  `).join('');

  return `
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <thead>
        <tr style="background:#374151; color:white;">
          <th style="padding:10px; border:1px solid #ddd;">Fecha Inicio</th>
          <th style="padding:10px; border:1px solid #ddd;">Fecha Fin</th>
          <th style="padding:10px; border:1px solid #ddd;">Días Hábiles</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

// ═══════════════════════════════════════════════════════════
// NOTIFICACIÓN 1: Nueva solicitud creada
// Envía a: empleado, jefe inmediato, RRHH
// ═══════════════════════════════════════════════════════════
exports.triggerNewRequest = async ({ request, dateRanges, totalDays, approveToken, rejectToken, appUrl }) => {
  const datesTable = buildDatesTable(dateRanges);
  const requestTypeLabel = formatRequestType(request.request_type);

  // Links de acción directa para el jefe (desde email)
  const approveUrl = `${appUrl}/api/requests/token/${approveToken}?action=approve`;
  const rejectUrl = `${appUrl}/api/requests/token/${rejectToken}?action=reject`;

  const payload = {
    // Metadatos de la solicitud
    request_number: request.request_number,
    request_type: requestTypeLabel,
    reason: request.reason,
    notes: request.notes,
    total_days: totalDays,
    created_at: formatDate(request.created_at),
    dates_table_html: datesTable,

    // Datos del empleado
    employee_name: request.employee_name,
    employee_email: request.employee_email,
    employee_position: request.employee_position,
    employee_number: request.employee_number,

    // Datos del jefe
    manager_name: request.manager_name,
    manager_email: request.manager_email,

    // Links de aprobación por email
    approve_url: approveUrl,
    reject_url: rejectUrl,
    app_url: appUrl,
  };

  try {
    await axios.post(WEBHOOKS.NEW_REQUEST, payload);
    console.log(`[n8n] Nueva solicitud ${request.request_number} notificada`);
  } catch (err) {
    console.error('[n8n] Error al disparar webhook nueva solicitud:', err.message);
    // No lanzar error para no interrumpir el flujo principal
  }
};

// ═══════════════════════════════════════════════════════════
// NOTIFICACIÓN 2: Decisión del jefe (aprobado/rechazado)
// Envía a: empleado, RRHH
// ═══════════════════════════════════════════════════════════
exports.triggerDecisionNotification = async ({ request, decision, comments, dateRanges, totalDays, hrUsers, appUrl }) => {
  const datesTable = buildDatesTable(dateRanges);
  const statusLabel = decision === 'approved' ? 'APROBADA ✅' : 'RECHAZADA ❌';
  const statusColor = decision === 'approved' ? '#059669' : '#DC2626';

  const payload = {
    request_number: request.request_number,
    request_type: formatRequestType(request.request_type),
    decision,
    decision_label: statusLabel,
    decision_color: statusColor,
    manager_comments: comments || 'Sin comentarios adicionales',
    total_days: totalDays,
    dates_table_html: datesTable,
    decision_date: formatDate(new Date()),

    employee_name: request.employee_name,
    employee_email: request.employee_email,
    manager_name: request.manager_name,
    manager_email: request.manager_email,

    // Lista de correos de RRHH para notificar
    hr_emails: hrUsers.map(u => u.email),
    hr_names: hrUsers.map(u => u.full_name),

    app_url: appUrl,
  };

  try {
    await axios.post(WEBHOOKS.DECISION, payload);
    console.log(`[n8n] Decisión ${decision} de ${request.request_number} notificada`);
  } catch (err) {
    console.error('[n8n] Error al disparar webhook decisión:', err.message);
  }
};
```

---

## 🤖 WORKFLOWS DE N8N

### Workflow 1: Nueva Solicitud (`workflow_nueva_solicitud`)

```
NODO 1: Webhook (POST)
  → URL: /webhook/nueva-solicitud
  → Método: POST

NODO 2: Set Variables
  → Mapear todos los campos del payload

NODO 3: Send Email → Empleado
  → Para: {{ $json.employee_email }}
  → Asunto: "✅ Solicitud {{ $json.request_number }} recibida - {{ $json.request_type }}"
  → Cuerpo HTML: Template con confirmación de recepción

NODO 4: Send Email → Jefe
  → Para: {{ $json.manager_email }}
  → Asunto: "📋 Solicitud pendiente de aprobación - {{ $json.employee_name }}"
  → Cuerpo HTML: Template con botones APROBAR / RECHAZAR (links únicos)

NODO 5: Get HR Emails
  → (Los emails de RRHH vienen en el payload, no requiere DB query adicional)

NODO 6: Send Email → RRHH
  → Para: Lista de correos HR
  → Asunto: "📋 Nueva solicitud - {{ $json.employee_name }} - {{ $json.request_type }}"
  → Cuerpo HTML: Template informativo (solo lectura)

NODO 7: Respond to Webhook
  → { "success": true }
```

**Template HTML del email al JEFE (nodo 4):**
```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto; padding:20px;">
  
  <div style="text-align:center; margin-bottom:20px;">
    <img src="URL_LOGO_MAR_FUND" alt="MAR Fund" style="height:60px;">
    <h2 style="color:#1e40af;">Nueva Solicitud de {{ $json.request_type }}</h2>
  </div>

  <div style="background:#f8fafc; border-left:4px solid #3b82f6; padding:16px; margin-bottom:20px;">
    <p><strong>N° Solicitud:</strong> {{ $json.request_number }}</p>
    <p><strong>Empleado:</strong> {{ $json.employee_name }}</p>
    <p><strong>Cargo:</strong> {{ $json.employee_position }}</p>
    <p><strong>Tipo:</strong> {{ $json.request_type }}</p>
    <p><strong>Razón:</strong> {{ $json.reason }}</p>
    <p><strong>Total días hábiles:</strong> <strong>{{ $json.total_days }}</strong></p>
  </div>

  <p><strong>Fechas solicitadas:</strong></p>
  {{ $json.dates_table_html }}

  <div style="margin:30px 0; text-align:center;">
    <p style="margin-bottom:15px;"><strong>Por favor toma una decisión:</strong></p>
    <a href="{{ $json.approve_url }}" 
       style="background:#059669; color:white; padding:12px 30px; border-radius:8px; 
              text-decoration:none; font-weight:bold; margin-right:15px;">
      ✅ APROBAR
    </a>
    <a href="{{ $json.reject_url }}"
       style="background:#DC2626; color:white; padding:12px 30px; border-radius:8px; 
              text-decoration:none; font-weight:bold;">
      ❌ RECHAZAR
    </a>
  </div>

  <p style="color:#64748b; font-size:12px;">
    También puedes gestionar la solicitud desde el 
    <a href="{{ $json.app_url }}/pending-approvals">portal web</a>.
    Este link expira en 7 días.
  </p>
</body>
</html>
```

### Workflow 2: Notificación de Decisión (`workflow_decision_aprobacion`)

```
NODO 1: Webhook (POST)
  → URL: /webhook/decision-aprobacion

NODO 2: IF Decision == 'approved'
  → TRUE branch: Color verde, mensaje aprobación
  → FALSE branch: Color rojo, mensaje rechazo

NODO 3A/3B: Send Email → Empleado
  → Asunto aprobado: "✅ Vacaciones aprobadas - {{ $json.request_number }}"
  → Asunto rechazado: "❌ Solicitud rechazada - {{ $json.request_number }}"
  → Incluir comentarios del jefe y fechas

NODO 4: Loop Over HR Emails
  → Iterar lista $json.hr_emails

NODO 5: Send Email → RRHH (por cada uno)
  → Asunto: "📋 Decisión registrada - {{ $json.employee_name }} - {{ $json.decision_label }}"
  → Cuerpo: Resumen completo con decisión, fechas, comentarios
```

---

## 📊 REPORTES

### `backend/controllers/reportController.js`

```javascript
// GET /api/reports/employee/:id?year=2024
exports.getEmployeeReport = async (req, res) => {
  const { id } = req.params;
  const year = req.query.year || new Date().getFullYear();

  const [summary] = await db.query(`
    SELECT 
      u.full_name, u.email, u.employee_number, u.position,
      vr.request_type,
      COUNT(vr.id) as total_requests,
      SUM(rdr.business_days) as total_days,
      vr.status
    FROM users u
    LEFT JOIN vacation_requests vr ON u.id = vr.employee_id 
         AND YEAR(vr.created_at) = ? 
         AND vr.status = 'approved'
    LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
    WHERE u.id = ?
    GROUP BY u.id, vr.request_type, vr.status
  `, [year, id]);

  const [requests] = await db.query(`
    SELECT vr.*, m.full_name as manager_name
    FROM vacation_requests vr
    JOIN users m ON vr.manager_id = m.id
    WHERE vr.employee_id = ? AND YEAR(vr.created_at) = ?
    ORDER BY vr.created_at DESC
  `, [id, year]);

  for (const req of requests) {
    const [ranges] = await db.query(
      'SELECT * FROM request_date_ranges WHERE request_id = ?', [req.id]
    );
    req.date_ranges = ranges;
    req.total_days = ranges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);
  }

  res.json({ year, summary, requests });
};

// GET /api/reports/all?year=2024 — Para RRHH: reporte de todos
exports.getAllEmployeesReport = async (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  const [rows] = await db.query(`
    SELECT 
      u.id, u.full_name, u.email, u.employee_number, u.position,
      COALESCE(SUM(CASE WHEN vr.request_type = 'vacation' THEN rdr.business_days END), 0) as vacation_days,
      COALESCE(SUM(CASE WHEN vr.request_type = 'permission' THEN rdr.business_days END), 0) as permission_days,
      COALESCE(SUM(CASE WHEN vr.request_type = 'justified_absence' THEN rdr.business_days END), 0) as absence_days,
      COALESCE(SUM(rdr.business_days), 0) as total_days,
      COUNT(DISTINCT vr.id) as total_requests
    FROM users u
    LEFT JOIN vacation_requests vr ON u.id = vr.employee_id 
         AND YEAR(vr.created_at) = ? 
         AND vr.status = 'approved'
    LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
    WHERE u.is_active = 1
    GROUP BY u.id, u.full_name, u.email, u.employee_number, u.position
    ORDER BY u.full_name
  `, [year]);

  res.json({ year, employees: rows });
};
```

### `frontend/src/pages/Reports.jsx`

```jsx
// Componente de reporte con tabla exportable a CSV/PDF
// Muestra por empleado:
//   - Total días de vacaciones (aprobadas)
//   - Total días de permisos (aprobados)
//   - Total días de ausencias justificadas
//   - Número de solicitudes por año
// Filtros: año lectivo, tipo de solicitud, empleado
// Exportar: botón "Descargar CSV" y "Imprimir"
```

---

## 🔒 MIDDLEWARE DE ROLES

### `backend/middleware/roleMiddleware.js`

```javascript
exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: 'No autenticado' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Sin permisos para esta acción' });
  }
  next();
};

// Uso en rutas:
// router.put('/:id/decision', requireRole('manager', 'hr_admin', 'super_admin'), makeDecision);
// router.get('/reports/all', requireRole('hr_admin', 'super_admin'), getAllReport);
```

---

## 🌐 RUTAS REACT (React Router v6)

```jsx
// App.jsx — Rutas protegidas por rol
<Routes>
  <Route path="/login" element={<Login />} />
  
  {/* Rutas para todos los empleados autenticados */}
  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/new-request" element={<NewRequest />} />
    <Route path="/my-requests" element={<MyRequests />} />
  </Route>

  {/* Solo jefes y RRHH */}
  <Route element={<ProtectedRoute roles={['manager', 'hr_admin', 'super_admin']} />}>
    <Route path="/pending-approvals" element={<PendingApprovals />} />
  </Route>

  {/* Solo RRHH y Super Admin */}
  <Route element={<ProtectedRoute roles={['hr_admin', 'super_admin']} />}>
    <Route path="/reports" element={<Reports />} />
    <Route path="/admin/users" element={<AdminUsers />} />
  </Route>

  {/* Páginas de confirmación para aprobación por email */}
  <Route path="/approval-confirmed" element={<ApprovalConfirmed />} />
  <Route path="/token-expired" element={<TokenExpired />} />
  
  <Route path="/" element={<Navigate to="/dashboard" />} />
</Routes>
```

---

## 📦 VARIABLES DE ENTORNO

### `backend/.env`
```env
# Base de datos MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=vacation_system
DB_USER=vacation_user
DB_PASSWORD=tu_password_seguro

# Google OAuth 2.0
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_CALLBACK_URL=https://tudominio.com/api/auth/google/callback

# Sesión Express
SESSION_SECRET=cadena_aleatoria_muy_larga_y_segura

# n8n Webhooks
N8N_BASE_URL=https://n8n.tudominio.com
N8N_WEBHOOK_NEW_REQUEST=https://n8n.tudominio.com/webhook/nueva-solicitud
N8N_WEBHOOK_DECISION=https://n8n.tudominio.com/webhook/decision-aprobacion

# URL de la aplicación frontend
APP_URL=https://vacaciones.tudominio.com

# Puerto del servidor Express
PORT=3001

# Entorno
NODE_ENV=production
```

### `frontend/.env`
```env
VITE_API_URL=https://vacaciones.tudominio.com/api
VITE_GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
```

---

## 🚀 DEPLOY EN SERVIDOR LAMP

### Configuración Apache (Virtual Host con reverse proxy)
```apache
# /etc/apache2/sites-available/vacaciones.conf
<VirtualHost *:443>
    ServerName vacaciones.tudominio.com
    
    # React build (archivos estáticos)
    DocumentRoot /var/www/vacation-system/frontend/dist
    <Directory /var/www/vacation-system/frontend/dist>
        Options -Indexes
        AllowOverride All
        Require all granted
        # Para React Router (SPA)
        FallbackResource /index.html
    </Directory>

    # Proxy inverso hacia Node.js Express
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api
    ProxyPass /auth http://localhost:3001/auth
    ProxyPassReverse /auth http://localhost:3001/auth

    # SSL (Let's Encrypt)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/vacaciones.tudominio.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/vacaciones.tudominio.com/privkey.pem
</VirtualHost>
```

### PM2 para Node.js
```bash
# Instalar PM2
npm install -g pm2

# Iniciar el servidor Express
cd /var/www/vacation-system/backend
pm2 start server.js --name "vacation-api" --env production

# Guardar proceso para reinicio automático
pm2 save
pm2 startup
```

### Script de deploy completo
```bash
#!/bin/bash
# deploy.sh

# 1. Actualizar código
cd /var/www/vacation-system
git pull origin main

# 2. Build frontend
cd frontend
npm install
npm run build

# 3. Instalar dependencias backend
cd ../backend
npm install --production

# 4. Ejecutar migraciones SQL si las hay
mysql -u vacation_user -p vacation_system < ../database/schema.sql

# 5. Reiniciar proceso Node.js
pm2 restart vacation-api

echo "✅ Deploy completado"
```

---

## 📋 FLUJO COMPLETO DEL PROCESO

```
EMPLEADO
  │
  ├─ Inicia sesión con Gmail (Google OAuth)
  ├─ Llena formulario de solicitud
  └─ Hace clic en "Enviar Solicitud"
        │
        ▼
BACKEND API
  ├─ Guarda en MySQL (vacation_requests + date_ranges)
  ├─ Genera tokens únicos de aprobación/rechazo
  └─ Dispara webhook → n8n
        │
        ▼
N8N (Workflow 1: Nueva Solicitud)
  ├─ Email → EMPLEADO: "Tu solicitud VAC-2024-0001 fue recibida"
  ├─ Email → JEFE: "Tienes una solicitud pendiente" + botones [APROBAR] [RECHAZAR]
  └─ Email → RRHH: "Nueva solicitud de [empleado]"
        │
        ▼
JEFE (tiene 2 opciones)
  │
  ├─ OPCIÓN A: Hace clic en botón del email
  │     └─ Link con token → API procesa decisión automáticamente
  │
  └─ OPCIÓN B: Entra al portal web
        └─ Va a "Aprobaciones Pendientes"
        └─ Ve detalle y hace clic en "Aprobar" o "Rechazar" con comentarios
              │
              ▼
        BACKEND API
          └─ Actualiza status en MySQL
          └─ Registra en historial
          └─ Dispara webhook → n8n
                │
                ▼
        N8N (Workflow 2: Decisión)
          ├─ Email → EMPLEADO: "✅ Aprobada" o "❌ Rechazada" + comentarios del jefe
          └─ Email → RRHH: "Solicitud de [empleado] fue [aprobada/rechazada]"
                │
                ▼
        REGISTRO COMPLETO GUARDADO EN MYSQL
          └─ Disponible para consulta y reportes
```

---

## 📌 INSTRUCCIONES ADICIONALES PARA EL DESARROLLADOR

1. **Paquetes NPM requeridos en backend:** `express`, `mysql2`, `passport`, `passport-google-oauth20`, `express-session`, `connect-mysql2`, `axios`, `crypto`, `cors`, `helmet`, `dotenv`

2. **Paquetes NPM requeridos en frontend:** `react`, `react-dom`, `react-router-dom`, `axios`, `@tailwindcss/forms`, `date-fns`, `react-hot-toast`

3. **Google Cloud Console:** Configura un proyecto OAuth 2.0, habilita la API de Gmail, agrega `https://tudominio.com/api/auth/google/callback` como URI de redirección autorizado.

4. **n8n:** Configura las credenciales SMTP de Gmail en n8n para el envío de correos. Usa las plantillas HTML proporcionadas en los nodos de email.

5. **Dominio de empleados:** Si deseas restringir el acceso solo a emails corporativos, descomenta la validación de dominio en `passport.js`.

6. **Año lectivo para reportes:** Considera si el año lectivo va de enero a diciembre o de otro período. Ajusta las consultas SQL según corresponda.

7. **Días hábiles:** La función `calculateBusinessDays` solo excluye sábados y domingos. Si necesitas excluir días festivos de Guatemala, agrega una tabla `holidays` y ajusta la consulta.

8. **Seguridad de tokens de aprobación:** Los tokens expiran en 7 días y solo pueden usarse una vez. Una vez procesados, el link muestra una página de confirmación.
```
