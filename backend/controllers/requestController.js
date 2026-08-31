const db = require('../config/db');
const n8nService = require('../services/n8nService');
const crypto = require('crypto');
const { getSaldos } = require('../utils/saldos');
const { splitByBusinessDays } = require('../utils/splitFechas');

// ¿El consumo de bono (auto-split) está activo para este usuario? (fase de prueba: solo super_admin)
const bonoConsumoActivo = (user) => user?.role === 'super_admin';

// Generar número correlativo de solicitud (conn-aware para transacciones con múltiples inserts)
async function generateRequestNumber(conn = db) {
    const year = new Date().getFullYear();
    const [rows] = await conn.query(
        'SELECT COUNT(*) as count FROM vacation_requests WHERE YEAR(created_at) = ?', [year]
    );
    const count = rows[0].count + 1;
    return `VAC-${year}-${String(count).padStart(4, '0')}`;
}

// POST /api/requests — Crear nueva solicitud (con auto-split base+bono para super_admin)
exports.createRequest = async (req, res) => {
    const { request_type, reason, notes, manager_id, date_ranges } = req.body;
    const employee_id = req.user.id;
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        // Validaciones del Beneficio Antigüedad "viejo" (solicitud directa, no auto-split)
        if (request_type === 'seniority_benefit') {
            const [userRows] = await conn.query(
                'SELECT benefit_extra_day, benefit_extra_day_used FROM users WHERE id = ?', [employee_id]
            );
            if (!userRows[0]?.benefit_extra_day) {
                await conn.rollback(); conn.release();
                return res.status(403).json({ message: 'No tienes habilitado el Beneficio Antigüedad.' });
            }
            if (userRows[0]?.benefit_extra_day_used) {
                await conn.rollback(); conn.release();
                return res.status(400).json({ message: 'Ya gozaste el Beneficio Antigüedad en el período actual.' });
            }
            const t = (date_ranges || []).reduce((sum, r) => sum + parseFloat(r.business_days || 0), 0);
            if (t !== 1) {
                await conn.rollback(); conn.release();
                return res.status(400).json({ message: 'El Beneficio Antigüedad corresponde exactamente a 1 día completo.' });
            }
        }

        const totalDays = (date_ranges || []).reduce((s, r) => s + parseFloat(r.business_days || 0), 0);

        // ¿Auto-split? Solo super_admin + vacation cuando la base no alcanza y hay que usar bono
        let doSplit = false, baseUsed = totalDays;
        if (bonoConsumoActivo(req.user) && request_type === 'vacation') {
            const { baseAvail, bonoAvail } = await getSaldos(employee_id, conn);
            baseUsed = Math.min(totalDays, Math.max(baseAvail, 0));
            const bonoUsed = Math.round((totalDays - baseUsed) * 100) / 100;
            if (bonoUsed > 1e-9) {
                if (bonoUsed > bonoAvail + 1e-9) {
                    await conn.rollback(); conn.release();
                    return res.status(400).json({
                        message: `Saldo insuficiente. Disponible: ${Math.max(baseAvail, 0).toFixed(2)} base + ${Math.max(bonoAvail, 0).toFixed(2)} bono = ${(Math.max(baseAvail, 0) + Math.max(bonoAvail, 0)).toFixed(2)} días. Solicitaste ${totalDays}.`
                    });
                }
                doSplit = true;
            }
        }

        // Inserta una solicitud (número + rangos + tokens + historial) y devuelve sus datos
        const insertOne = async (rtype, ranges, groupId) => {
            const number = await generateRequestNumber(conn);
            const [r] = await conn.query(
                `INSERT INTO vacation_requests (request_number, split_group_id, employee_id, request_type, reason, notes, status, manager_id)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [number, groupId, employee_id, rtype, reason, notes, manager_id]
            );
            const rid = r.insertId;
            for (const rg of ranges) {
                await conn.query(
                    'INSERT INTO request_date_ranges (request_id, date_from, date_to, business_days) VALUES (?, ?, ?, ?)',
                    [rid, rg.date_from, rg.date_to, rg.business_days]
                );
            }
            const approveToken = crypto.randomBytes(32).toString('hex');
            const rejectToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await conn.query(
                'INSERT INTO approval_tokens (request_id, token, action, expires_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
                [rid, approveToken, 'approve', expiresAt, rid, rejectToken, 'reject', expiresAt]
            );
            await conn.query(
                'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
                [rid, 'created', employee_id, `Solicitud ${number} creada`]
            );
            return { rid, number, ranges };
        };

        let primaryId, splitParts = null;
        if (doSplit) {
            const { baseRange, bonoRange } = splitByBusinessDays(date_ranges, baseUsed);
            const groupId = crypto.randomUUID();
            const parts = [];
            if (baseRange && baseRange.business_days > 1e-9) {
                const b = await insertOne('vacation', [baseRange], groupId);
                parts.push({ label: 'Días Vacaciones (base)', ...b });
            }
            const bo = await insertOne('seniority_benefit', [bonoRange], groupId);
            parts.push({ label: 'Días Beneficio (bono)', ...bo });
            primaryId = parts[0].rid;
            splitParts = parts;
        } else {
            const single = await insertOne(request_type, date_ranges, null);
            primaryId = single.rid;
        }

        await conn.commit();

        // Datos para notificación (solicitud primaria)
        const [requestData] = await db.query(`
            SELECT vr.*, u.full_name as employee_name, u.email as employee_email,
                   u.position as employee_position, u.employee_number,
                   m.full_name as manager_name, m.email as manager_email
            FROM vacation_requests vr
            JOIN users u ON vr.employee_id = u.id
            JOIN users m ON vr.manager_id = m.id
            WHERE vr.id = ?`, [primaryId]);

        if (splitParts) {
            // UN solo correo combinado con el desglose base + bono
            await n8nService.triggerNewRequest({
                request: requestData[0],
                dateRanges: [],
                totalDays,
                splitParts: splitParts.map(p => ({ label: p.label, ranges: p.ranges })),
                appUrl: process.env.APP_URL
            });
        } else {
            const [dr] = await db.query('SELECT * FROM request_date_ranges WHERE request_id = ?', [primaryId]);
            await n8nService.triggerNewRequest({
                request: requestData[0], dateRanges: dr, totalDays, appUrl: process.env.APP_URL
            });
        }

        res.status(201).json({
            success: true,
            request_number: requestData[0].request_number,
            split: !!splitParts,
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
        const permClause = req.user.role === 'manager' ? ' AND manager_id = ?' : '';
        const permParams = req.user.role === 'manager' ? [id, manager_id] : [id];
        const [requestArr] = await db.query(
            `SELECT * FROM vacation_requests WHERE id = ?${permClause} AND status = "pending"`, permParams
        );

        if (!requestArr.length) {
            return res.status(404).json({ message: 'Solicitud no encontrada o ya procesada/sin permisos' });
        }
        const request = requestArr[0];

        // Aprobación AGRUPADA: si es parte de un auto-split, aplicar la decisión a todo el grupo
        let ids = [Number(id)];
        if (request.split_group_id) {
            const [grp] = await db.query(
                'SELECT id FROM vacation_requests WHERE split_group_id = ? AND status = "pending"',
                [request.split_group_id]
            );
            ids = grp.map(g => g.id);
        }

        await db.query(
            'UPDATE vacation_requests SET status = ?, manager_comments = ?, manager_decision_date = NOW() WHERE id IN (?)',
            [decision, comments, ids]
        );
        for (const rid of ids) {
            await db.query(
                'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
                [rid, decision, manager_id, `Decisión: ${decision}. Comentarios: ${comments || 'N/A'}`]
            );
        }

        // Beneficio "viejo" (solicitud directa, no split): marcar usado
        if (!request.split_group_id && decision === 'approved' && request.request_type === 'seniority_benefit') {
            await db.query('UPDATE users SET benefit_extra_day_used = 1 WHERE id = ?', [request.employee_id]);
        }

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
            'SELECT * FROM request_date_ranges WHERE request_id IN (?)', [ids]
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

        // Anulación AGRUPADA: si es parte de un auto-split, anular todo el grupo
        let ids = [Number(id)];
        if (request.split_group_id) {
            const [grp] = await db.query(
                "SELECT id FROM vacation_requests WHERE split_group_id = ? AND status NOT IN ('annulled','cancelled')",
                [request.split_group_id]
            );
            ids = grp.map(g => g.id);
        }

        // Beneficio "viejo" (solicitud directa, no split) aprobada → devolver el flag
        if (!request.split_group_id && request.request_type === 'seniority_benefit' && request.status === 'approved') {
            await db.query('UPDATE users SET benefit_extra_day_used = 0 WHERE id = ?', [request.employee_id]);
        }
        // (En el esquema nuevo, base y bono se recalculan solos al cambiar status a 'annulled'.)

        await db.query(
            `UPDATE vacation_requests
             SET status = 'annulled', annulment_reason = ?, annulled_by = ?, annulled_at = NOW()
             WHERE id IN (?)`,
            [reason.trim(), adminId, ids]
        );
        for (const rid of ids) {
            await db.query(
                'INSERT INTO request_history (request_id, action, performed_by, details) VALUES (?, ?, ?, ?)',
                [rid, 'annulled', adminId, `Solicitud anulada. Motivo: ${reason.trim()}`]
            );
        }

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
