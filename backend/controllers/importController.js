const db = require('../config/db');
const XLSX = require('xlsx');

// POST /api/users/import-balances
// Carga masiva de saldos iniciales desde Excel
// Columnas requeridas: "Código Colaborador" | "Saldo Inicial"
exports.importInitialBalances = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se recibió ningún archivo.' });
    }

    const adjustedBy = req.user.id;
    const conn = await db.getConnection();

    try {
        // Parsear Excel en memoria
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows.length) {
            return res.status(400).json({ message: 'El archivo está vacío o no tiene datos.' });
        }

        // Verificar columnas requeridas
        const firstRow = rows[0];
        if (!('Código Colaborador' in firstRow) || !('Saldo Inicial' in firstRow)) {
            return res.status(400).json({
                message: 'El archivo debe tener las columnas exactas: "Código Colaborador" y "Saldo Inicial".'
            });
        }

        const procesados = [];
        const no_encontrados = [];
        const errores = [];

        await conn.beginTransaction();

        for (const row of rows) {
            const codigo = String(row['Código Colaborador'] || '').trim();
            const saldo = parseFloat(row['Saldo Inicial']);

            if (!codigo) { errores.push({ codigo: '(vacío)', motivo: 'Código vacío' }); continue; }
            if (isNaN(saldo) || saldo < 0) { errores.push({ codigo, motivo: 'Saldo Inicial no es un número válido' }); continue; }

            // Buscar usuario por employee_number
            const [users] = await conn.query(
                'SELECT id, full_name FROM users WHERE employee_number = ? AND is_active = 1',
                [codigo]
            );

            if (!users.length) { no_encontrados.push(codigo); continue; }

            const userId = users[0].id;

            // Generar número VAC- unificado
            const year = new Date().getFullYear();
            const [vac] = await conn.query('SELECT COUNT(*) as c FROM vacation_requests WHERE YEAR(created_at) = ?', [year]);
            const [adj] = await conn.query('SELECT COUNT(*) as c FROM user_day_adjustments WHERE YEAR(created_at) = ?', [year]);
            const count = vac[0].c + adj[0].c + 1;
            const adjNumber = `VAC-${year}-${String(count).padStart(4, '0')}`;

            // Actualizar base_vacation_days
            await conn.query('UPDATE users SET base_vacation_days = ? WHERE id = ?', [saldo, userId]);

            // Registrar en user_day_adjustments como saldo inicial
            await conn.query(
                `INSERT INTO user_day_adjustments
                 (adjustment_number, user_id, adjusted_by, days_added, adjustment_type, reason)
                 VALUES (?, ?, ?, ?, 'initial_balance', ?)`,
                [adjNumber, userId, adjustedBy, saldo, `Saldo inicial cargado por administrador (${saldo} días)`]
            );

            procesados.push({ codigo, nombre: users[0].full_name, saldo, adjNumber });
        }

        await conn.commit();

        res.json({
            success: true,
            procesados: procesados.length,
            detalle_procesados: procesados,
            no_encontrados,
            errores
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error importando saldos:', error);
        res.status(500).json({ message: 'Error al procesar el archivo', error: error.message });
    } finally {
        conn.release();
    }
};
