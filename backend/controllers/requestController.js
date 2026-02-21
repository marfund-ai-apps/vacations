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

        const [dateRangesArray] = await db.query(
            'SELECT * FROM request_date_ranges WHERE request_id = ?', [requestId]
        );

        const totalDays = dateRangesArray.reduce((sum, r) => sum + parseFloat(r.business_days), 0);

        // Disparar webhook n8n para notificaciones
        await n8nService.triggerNewRequest({
            request: requestData[0],
            dateRanges: dateRangesArray,
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
        if (conn) await conn.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al crear solicitud', error: error.message });
    } finally {
        if (conn) conn.release();
    }
};

// GET /api/requests — Listar solicitudes (filtradas por rol y query param scope)
exports.listRequests = async (req, res) => {
    const user = req.user;
    const scope = req.query.scope; // 'me', 'team', 'all'
    let query = '';
    let params = [];

    if (scope === 'me' || (user.role === 'employee' && !scope)) {
        query = `SELECT vr.*, m.full_name as manager_name 
             FROM vacation_requests vr LEFT JOIN users m ON vr.manager_id = m.id
             WHERE vr.employee_id = ? ORDER BY vr.created_at DESC`;
        params = [user.id];
    } else if (scope === 'team') {
        query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email
             FROM vacation_requests vr JOIN users u ON vr.employee_id = u.id
             WHERE vr.manager_id = ? ORDER BY vr.created_at DESC`;
        params = [user.id];
    } else if (scope === 'all' && ['hr_admin', 'super_admin'].includes(user.role)) {
        query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email,
                    m.full_name as manager_name
             FROM vacation_requests vr 
             JOIN users u ON vr.employee_id = u.id
             LEFT JOIN users m ON vr.manager_id = m.id
             ORDER BY vr.created_at DESC`;
    } else {
        // Fallback default based on role
        if (user.role === 'manager') {
            query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email
                  FROM vacation_requests vr JOIN users u ON vr.employee_id = u.id
                  WHERE vr.manager_id = ? ORDER BY vr.created_at DESC`;
            params = [user.id];
        } else {
            query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email,
                         m.full_name as manager_name
                  FROM vacation_requests vr 
                  JOIN users u ON vr.employee_id = u.id
                  LEFT JOIN users m ON vr.manager_id = m.id
                  ORDER BY vr.created_at DESC`;
        }
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

// PUT /api/requests/:id/decision — Aprobar o rechazar (jefe inmediato u admin)
exports.makeDecision = async (req, res) => {
    const { id } = req.params;
    const { decision, comments } = req.body; // decision: 'approved' | 'rejected'
    const manager_id = req.user.id;

    try {
        let requestQuery = '';
        let requestParams = [];

        if (req.user.role === 'manager') {
            requestQuery = 'SELECT * FROM vacation_requests WHERE id = ? AND manager_id = ? AND status = "pending"';
            requestParams = [id, manager_id];
        } else {
            requestQuery = 'SELECT * FROM vacation_requests WHERE id = ? AND status = "pending"';
            requestParams = [id];
        }

        const [requestArr] = await db.query(requestQuery, requestParams);

        if (!requestArr.length) {
            return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada/sin permisos' });
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
            'SELECT email, full_name FROM users WHERE role IN ("hr_admin", "super_admin") AND is_active = 1'
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
