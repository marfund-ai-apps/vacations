const db = require('../config/db');
const XLSX = require('xlsx');

function parseFile(file) {
    const ext = (file.originalname || '').toLowerCase();
    if (ext.endsWith('.csv')) {
        let text = file.buffer.toString('utf8');
        // Quitar BOM UTF-8 que Excel agrega al exportar en Windows
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => {
            const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const row = {};
            headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
            return row;
        }).filter(row => Object.values(row).some(v => v !== ''));
    }
    // XLSX / XLS — la librería xlsx también puede leer CSV, pero preferimos el parser propio
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function getColumns(rows) {
    if (!rows.length) return null;
    const firstRow = rows[0];
    const codeCol = 'No. Colaborador' in firstRow ? 'No. Colaborador'
                  : 'Código Colaborador' in firstRow ? 'Código Colaborador'
                  : null;
    const saldoCol = 'Saldo Inicial' in firstRow ? 'Saldo Inicial' : null;
    if (!codeCol || !saldoCol) return null;
    return { codeCol, saldoCol };
}

// POST /api/users/preview-balances
// Parsea el archivo y devuelve previsualización sin guardar en DB
exports.previewBalances = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo.' });

    try {
        const rows = parseFile(req.file);
        if (!rows.length) return res.status(400).json({ message: 'El archivo está vacío o no tiene datos.' });

        const cols = getColumns(rows);
        if (!cols) {
            return res.status(400).json({
                message: 'El archivo no cumple con el formato requerido. Las columnas deben ser: "No. Colaborador" y "Saldo Inicial".'
            });
        }

        const preview = [];
        for (const row of rows) {
            const codigo = String(row[cols.codeCol] || '').trim();
            if (!codigo) continue;

            const saldoRaw = row[cols.saldoCol];
            const saldo = parseFloat(saldoRaw);
            const saldoInvalido = isNaN(saldo) || saldo < 0;

            const [users] = await db.query(
                'SELECT id, full_name, base_vacation_days FROM users WHERE employee_number = ? AND is_active = 1',
                [codigo]
            );

            if (users.length) {
                preview.push({
                    employee_number: codigo,
                    full_name: users[0].full_name,
                    current_balance: parseFloat(users[0].base_vacation_days) || 0,
                    new_balance: saldoInvalido ? null : saldo,
                    found: true,
                    error: saldoInvalido ? 'Saldo inválido' : null
                });
            } else {
                preview.push({
                    employee_number: codigo,
                    full_name: null,
                    current_balance: null,
                    new_balance: saldoInvalido ? null : saldo,
                    found: false,
                    error: null
                });
            }
        }

        res.json({
            rows: preview,
            total_found: preview.filter(r => r.found && !r.error).length,
            total_not_found: preview.filter(r => !r.found).length,
            total_errors: preview.filter(r => r.error).length
        });
    } catch (error) {
        console.error('Error en preview de saldos:', error);
        res.status(500).json({ message: 'Error al procesar el archivo', error: error.message });
    }
};

// POST /api/users/import-balances
// Carga masiva de saldos iniciales desde CSV o Excel
// Columnas requeridas: "No. Colaborador" | "Saldo Inicial"  (o "Código Colaborador")
exports.importInitialBalances = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo.' });

    const adjustedBy = req.user.id;
    const conn = await db.getConnection();

    try {
        const rows = parseFile(req.file);
        if (!rows.length) return res.status(400).json({ message: 'El archivo está vacío o no tiene datos.' });

        const cols = getColumns(rows);
        if (!cols) {
            return res.status(400).json({
                message: 'El archivo no cumple con el formato requerido. Las columnas deben ser: "No. Colaborador" y "Saldo Inicial".'
            });
        }

        const procesados = [];
        const no_encontrados = [];
        const errores = [];

        await conn.beginTransaction();

        for (const row of rows) {
            const codigo = String(row[cols.codeCol] || '').trim();
            const saldo = parseFloat(row[cols.saldoCol]);

            if (!codigo) { errores.push({ codigo: '(vacío)', motivo: 'Código vacío' }); continue; }
            if (isNaN(saldo) || saldo < 0) { errores.push({ codigo, motivo: 'Saldo Inicial no es un número válido' }); continue; }

            const [users] = await conn.query(
                'SELECT id, full_name FROM users WHERE employee_number = ? AND is_active = 1',
                [codigo]
            );

            if (!users.length) { no_encontrados.push(codigo); continue; }

            const userId = users[0].id;

            const year = new Date().getFullYear();
            const [vac] = await conn.query('SELECT COUNT(*) as c FROM vacation_requests WHERE YEAR(created_at) = ?', [year]);
            const [adj] = await conn.query('SELECT COUNT(*) as c FROM user_day_adjustments WHERE YEAR(created_at) = ?', [year]);
            const count = vac[0].c + adj[0].c + 1;
            const adjNumber = `VAC-${year}-${String(count).padStart(4, '0')}`;

            await conn.query('UPDATE users SET base_vacation_days = ? WHERE id = ?', [saldo, userId]);
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
