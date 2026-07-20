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

        // Validaciones para Beneficio Antigüedad
        if (request_type === 'seniority_benefit') {
            const [userRows] = await conn.query(
                'SELECT benefit_extra_day, benefit_extra_day_used FROM users WHERE id = ?', [employee_id]
            );
            if (!userRows[0]?.benefit_extra_day) {
                await conn.rollback();
                conn.release();
                return res.status(403).json({ message: 'No tienes habilitado el Beneficio Antigüedad.' });
            }
            if (userRows[0]?.benefit_extra_day_used) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ message: 'Ya gozaste el Beneficio Antigüedad en el período actual.' });
            }
            const totalDays = (date_ranges || []).reduce((sum, r) => sum + parseFloat(r.business_days || 0), 0);
            if (totalDays !== 1) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ message: 'El Beneficio Antigüedad corresponde exactamente a 1 día completo.' });
            }
        }

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
            'INSERT INTO approval_tokens (request_id, token, action, expires_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
            [requestId, approveToken, 'approve', expiresAt, requestId, rejectToken, 'reject', expiresAt]
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
        query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email, u.employee_number
             FROM vacation_requests vr JOIN users u ON vr.employee_id = u.id
             WHERE vr.manager_id = ? ORDER BY vr.created_at DESC`;
        params = [user.id];
    } else if (scope === 'all' && ['hr_admin', 'super_admin'].includes(user.role)) {
        query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email,
                    u.employee_number, m.full_name as manager_name
             FROM vacation_requests vr
             JOIN users u ON vr.employee_id = u.id
             LEFT JOIN users m ON vr.manager_id = m.id
             ORDER BY vr.created_at DESC`;
    } else {
        if (user.role === 'manager') {
            query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email, u.employee_number
                  FROM vacation_requests vr JOIN users u ON vr.employee_id = u.id
                  WHERE vr.manager_id = ? ORDER BY vr.created_at DESC`;
            params = [user.id];
        } else {
            query = `SELECT vr.*, u.full_name as employee_name, u.email as employee_email,
                         u.employee_number, m.full_name as manager_name
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

        if (decision === 'approved' && requestArr[0].request_type === 'seniority_benefit') {
            await db.query(
                'UPDATE users SET benefit_extra_day_used = 1 WHERE id = ?',
                [requestArr[0].employee_id]
            );
        }

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

// PUT /api/requests/:id/annul — Anular solicitud (solo super_admin)
exports.annulRequest = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason || !reason.trim()) {
        return res.status(400).json({ message: 'Se requiere un motivo para anular la solicitud.' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM vacation_requests WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ message: 'Solicitud no encontrada.' });

        const request = rows[0];
        if (['annulled', 'cancelled'].includes(request.status)) {
            return res.status(400).json({ message: 'La solicitud ya fue anulada o cancelada.' });
        }

        // seniority_benefit aprobada → devolver el beneficio al colaborador
        if (request.request_type === 'seniority_benefit' && request.status === 'approved') {
            await db.query('UPDATE users SET benefit_extra_day_used = 0 WHERE id = ?', [request.employee_id]);
        }

        await db.query(
            `UPDATE vacation_requests
             SET status = 'annulled', annulment_reason = ?, annulled_by = ?, annulled_at = NOW()
             WHERE id = ?`,
            [reason.trim(), adminId, id]
        );

        await db.query(
            'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
            [id, 'annulled', adminId, `Solicitud anulada. Motivo: ${reason.trim()}`]
        );

        res.json({ message: 'Solicitud anulada correctamente.' });
    } catch (err) {
        console.error('Error en annulRequest:', err);
        res.status(500).json({ message: 'Error al anular la solicitud.' });
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
            return res.redirect(`${process.env.FRONTEND_URL}/token-expired`);
        }

        const tokenData = tokens[0];
        if (tokenData.status !== 'pending') {
            return res.redirect(`${process.env.FRONTEND_URL}/already-processed`);
        }

        const decision = action === 'approve' ? 'approved' : 'rejected';
        const tokenAction = action === 'approve' ? 'approve' : 'reject'; // enum: 'approve'|'reject'

        // Marcar token como usado
        await db.query('UPDATE approval_tokens SET used_at = NOW(), action = ? WHERE token = ?',
            [tokenAction, token]);

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

        if (decision === 'approved' && fullRequest[0]?.request_type === 'seniority_benefit') {
            await db.query(
                'UPDATE users SET benefit_extra_day_used = 1 WHERE id = ?',
                [fullRequest[0].employee_id]
            );
        }

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
        res.redirect(`${process.env.FRONTEND_URL}/approval-confirmed?status=${decision}`);

    } catch (error) {
        console.error(error);
        res.redirect(`${process.env.FRONTEND_URL}/error`);
    }
};

// GET /api/requests/token/:token/validate — Validar token sin consumirlo
// Retorna datos de la solicitud para que TokenApprovalPage pueda mostrar el modal
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
            GROUP BY at.id, vr.id, vr.request_number, vr.request_type, u.full_name
        `, [token]);

        if (!tokens.length) {
            return res.status(401).json({ message: 'Token inválido o expirado' });
        }

        const tokenData = tokens[0];
        const { formatRequestType } = require('../services/n8nService');

        res.json({
            action: tokenData.action, // 'approve' o 'reject'
            request_number: tokenData.request_number,
            employee_name: tokenData.employee_name,
            request_type: formatRequestType(tokenData.request_type), // Formateado: 'Vacaciones', 'Permiso Personal', etc.
            total_days: tokenData.total_days
        });
    } catch (error) {
        console.error('Error validando token:', error);
        res.status(500).json({ message: 'Error validando token' });
    }
};

// POST /api/requests/token/:token/approve — Aprobar solicitud vía magic link
exports.approveViaToken = async (req, res) => {
    const { token } = req.params;

    try {
        // Validar que el token exista y no esté vencido/consumido
        const [tokens] = await db.query(`
            SELECT at.id, at.request_id, at.expires_at, at.used_at
            FROM approval_tokens at
            WHERE at.token = ?
              AND at.used_at IS NULL
              AND at.expires_at > NOW()
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

        // Marcar token como consumido con acción 'approve'
        await db.query(`
            UPDATE approval_tokens
            SET used_at = NOW(), action = 'approve'
            WHERE id = ?
        `, [tokenId]);

        // Registrar en historial
        await db.query(
            'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
            [requestId, 'approved', NULL, 'Aprobada vía magic link']
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
        `, [requestId]);

        // Actualizar benefit_extra_day_used si es seniority_benefit aprobado
        if (fullRequest[0]?.request_type === 'seniority_benefit') {
            await db.query(
                'UPDATE users SET benefit_extra_day_used = 1 WHERE id = ?',
                [fullRequest[0].employee_id]
            );
        }

        // Obtener rangos de fechas y total de días
        const [dateRanges] = await db.query(
            'SELECT * FROM request_date_ranges WHERE request_id = ?', [requestId]
        );
        const totalDays = dateRanges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);

        // Obtener usuarios de RRHH para notificar
        const [hrUsers] = await db.query(
            'SELECT email, full_name FROM users WHERE role IN ("hr_admin", "super_admin") AND is_active = 1'
        );

        // Disparar webhook n8n para notificación de decisión
        await n8nService.triggerDecisionNotification({
            request: fullRequest[0],
            decision: 'approved',
            comments: '',
            dateRanges,
            totalDays,
            hrUsers,
            appUrl: process.env.APP_URL
        });

        res.json({ message: 'Solicitud aprobada exitosamente' });
    } catch (error) {
        console.error('Error aprobando solicitud:', error);
        res.status(500).json({ message: 'Error aprobando solicitud' });
    }
};

// POST /api/requests/token/:token/reject — Rechazar solicitud con comentario vía magic link
exports.rejectWithComment = async (req, res) => {
    const { token } = req.params;
    const { comment } = req.body;

    // Validar que el comentario no esté vacío
    if (!comment || !comment.trim()) {
        return res.status(400).json({ message: 'El comentario es obligatorio para rechazar' });
    }

    try {
        // Validar que el token exista y no esté vencido/consumido
        const [tokens] = await db.query(`
            SELECT at.id, at.request_id, at.expires_at, at.used_at
            FROM approval_tokens at
            WHERE at.token = ?
              AND at.used_at IS NULL
              AND at.expires_at > NOW()
        `, [token]);

        if (!tokens.length) {
            return res.status(401).json({ message: 'Token inválido o expirado' });
        }

        const { id: tokenId, request_id: requestId } = tokens[0];

        // Actualizar solicitud a 'rejected' con comentarios
        await db.query(`
            UPDATE vacation_requests
            SET status = 'rejected',
                manager_comments = ?,
                manager_decision_date = NOW()
            WHERE id = ?
        `, [comment, requestId]);

        // Marcar token como consumido con acción 'reject'
        await db.query(`
            UPDATE approval_tokens
            SET used_at = NOW(), action = 'reject'
            WHERE id = ?
        `, [tokenId]);

        // Registrar en historial
        await db.query(
            'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
            [requestId, 'rejected', NULL, `Rechazada vía magic link. Motivo: ${comment}`]
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
        `, [requestId]);

        // Obtener rangos de fechas y total de días
        const [dateRanges] = await db.query(
            'SELECT * FROM request_date_ranges WHERE request_id = ?', [requestId]
        );
        const totalDays = dateRanges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);

        // Obtener usuarios de RRHH para notificar
        const [hrUsers] = await db.query(
            'SELECT email, full_name FROM users WHERE role IN ("hr_admin", "super_admin") AND is_active = 1'
        );

        // Disparar webhook n8n para notificación de decisión
        await n8nService.triggerDecisionNotification({
            request: fullRequest[0],
            decision: 'rejected',
            comments: comment,
            dateRanges,
            totalDays,
            hrUsers,
            appUrl: process.env.APP_URL
        });

        res.json({ message: 'Solicitud rechazada con comentario' });
    } catch (error) {
        console.error('Error rechazando solicitud:', error);
        res.status(500).json({ message: 'Error rechazando solicitud' });
    }
};
