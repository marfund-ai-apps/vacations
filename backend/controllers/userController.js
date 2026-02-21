const db = require('../config/db');

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
