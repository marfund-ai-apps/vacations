const db = require('../config/db');

// Genera número correlativo unificado VAC-YYYY-NNNN (comparte secuencia con vacation_requests)
async function generateAdjustmentNumber() {
    const year = new Date().getFullYear();
    const [vac] = await db.query('SELECT COUNT(*) as c FROM vacation_requests WHERE YEAR(created_at) = ?', [year]);
    const [adj] = await db.query('SELECT COUNT(*) as c FROM user_day_adjustments WHERE YEAR(created_at) = ?', [year]);
    const count = vac[0].c + adj[0].c + 1;
    return `VAC-${year}-${String(count).padStart(4, '0')}`;
}

// Obtener todos los managers (para el combo box del formulario)
exports.getManagers = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, full_name, position, email FROM users WHERE role IN ("manager", "hr_admin", "super_admin") AND is_active = 1'
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener jefes' });
    }
};

// Obtener todos los usuarios (solo Admin y activos)
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.*, m.full_name as manager_name 
            FROM users u 
            LEFT JOIN users m ON u.manager_id = m.id 
            WHERE u.is_active = 1
            ORDER BY u.full_name
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
};

// Actualizar usuario (solo Admin)
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { employee_number, position, role, manager_id, base_vacation_days } = req.body;

    try {
        await db.query(
            'UPDATE users SET employee_number = ?, position = ?, role = ?, manager_id = ?, base_vacation_days = ? WHERE id = ?',
            [employee_number, position, role, manager_id || null, base_vacation_days, id]
        );
        res.json({ success: true, message: 'Usuario actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar usuario' });
    }
};

// Obtener todos los usuarios inactivos
exports.getInactiveUsers = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT u.*, m.full_name as manager_name 
            FROM users u 
            LEFT JOIN users m ON u.manager_id = m.id 
            WHERE u.is_active = 0
            ORDER BY u.full_name
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener usuarios inactivos' });
    }
};

// Desactivar usuario
exports.deactivateUser = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Usuario desactivado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al desactivar usuario' });
    }
};

// Activar usuario
exports.activateUser = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
        res.json({ success: true, message: 'Usuario reactivado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al reactivar usuario' });
    }
};

// GET /api/users/:id/day-adjustments — Historial de ajustes de días de un usuario
exports.getDayAdjustments = async (req, res) => {
    const { id } = req.params;
    const requestingUser = req.user;

    // El propio usuario puede ver sus ajustes; managers y admins pueden ver los de cualquiera
    if (requestingUser.role === 'employee' && requestingUser.id !== parseInt(id)) {
        return res.status(403).json({ message: 'No tienes permiso para ver estos registros' });
    }

    try {
        const [rows] = await db.query(
            `SELECT uda.*, u.full_name as adjusted_by_name
             FROM user_day_adjustments uda
             LEFT JOIN users u ON uda.adjusted_by = u.id
             WHERE uda.user_id = ?
             ORDER BY uda.created_at DESC`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener historial de ajustes' });
    }
};

// POST /api/users/:id/day-adjustments — Agregar días manualmente (solo jefe/admin)
exports.addDayAdjustment = async (req, res) => {
    const { id } = req.params;
    const { days_added, reason } = req.body;
    const adjustedBy = req.user.id;

    if (!days_added || parseFloat(days_added) <= 0) {
        return res.status(400).json({ message: 'La cantidad de días debe ser mayor a 0' });
    }
    if (!reason || reason.trim() === '') {
        return res.status(400).json({ message: 'El motivo es obligatorio' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const adjustmentNumber = await generateAdjustmentNumber();

        // Actualizar días base del usuario
        await conn.query(
            'UPDATE users SET base_vacation_days = base_vacation_days + ? WHERE id = ?',
            [parseFloat(days_added), id]
        );

        // Registrar el ajuste
        await conn.query(
            `INSERT INTO user_day_adjustments (adjustment_number, user_id, adjusted_by, days_added, adjustment_type, reason)
             VALUES (?, ?, ?, ?, 'manual', ?)`,
            [adjustmentNumber, id, adjustedBy, parseFloat(days_added), reason.trim()]
        );

        await conn.commit();

        // Obtener nombre del empleado para la respuesta
        const [userRows] = await db.query('SELECT full_name, base_vacation_days FROM users WHERE id = ?', [id]);
        res.json({
            success: true,
            message: `Se agregaron ${days_added} días a ${userRows[0].full_name} (${adjustmentNumber})`,
            new_balance: userRows[0].base_vacation_days,
            adjustment_number: adjustmentNumber
        });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al agregar días' });
    } finally {
        conn.release();
    }
};

// Crear usuario manualmente
exports.createUser = async (req, res) => {
    const { full_name, email, employee_number, position, base_vacation_days, role, manager_id } = req.body;

    if (!full_name || !email) {
        return res.status(400).json({ message: "Nombre y correo son requeridos" });
    }

    try {
        const fakeGoogleId = 'manual_' + email; // Since we require google_id
        const [result] = await db.query(
            `INSERT INTO users (full_name, email, employee_number, position, base_vacation_days, role, manager_id, google_id, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [full_name, email, employee_number || null, position || null, base_vacation_days || 15, role || 'employee', manager_id || null, fakeGoogleId]
        );
        res.status(201).json({ success: true, id: result.insertId, message: "Usuario creado correctamente" });
    } catch (error) {
        console.error("Error al crear usuario:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: "El correo electrónico ya está registrado." });
        }
        res.status(500).json({ message: 'Error interno al crear usuario' });
    }
};
