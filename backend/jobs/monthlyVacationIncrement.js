const cron = require('node-cron');
const db = require('../config/db');

// Genera número correlativo unificado VAC-YYYY-NNNN
async function generateAdjustmentNumber(conn) {
    const year = new Date().getFullYear();
    const [vac] = await conn.query('SELECT COUNT(*) as c FROM vacation_requests WHERE YEAR(created_at) = ?', [year]);
    const [adj] = await conn.query('SELECT COUNT(*) as c FROM user_day_adjustments WHERE YEAR(created_at) = ?', [year]);
    const count = vac[0].c + adj[0].c + 1;
    return `VAC-${year}-${String(count).padStart(4, '0')}`;
}

// Día 1 de cada mes a la 1:00am (zona horaria Guatemala)
const schedule = '0 1 1 * *';

function startMonthlyVacationIncrement() {
    cron.schedule(schedule, async () => {
        console.log('[CRON] Iniciando incremento mensual de días de vacaciones...');
        const conn = await db.getConnection();

        try {
            await conn.beginTransaction();

            // Obtener todos los usuarios activos
            const [activeUsers] = await conn.query(
                'SELECT id FROM users WHERE is_active = 1'
            );

            if (activeUsers.length === 0) {
                console.log('[CRON] No hay usuarios activos. Incremento omitido.');
                await conn.rollback();
                return;
            }

            // Sumar 1.25 días a todos los usuarios activos
            await conn.query(
                'UPDATE users SET base_vacation_days = base_vacation_days + 1.25 WHERE is_active = 1'
            );

            // Registrar un ajuste en user_day_adjustments por cada usuario (con número VAC- único)
            const reason = 'Aumento automático mensual de 1.25 días de vacaciones';
            for (const u of activeUsers) {
                const adjNumber = await generateAdjustmentNumber(conn);
                await conn.query(
                    `INSERT INTO user_day_adjustments (adjustment_number, user_id, adjusted_by, days_added, adjustment_type, reason)
                     VALUES (?, ?, NULL, 1.25, 'monthly_auto', ?)`,
                    [adjNumber, u.id, reason]
                );
            }

            await conn.commit();
            console.log(`[CRON] Incremento mensual completado para ${activeUsers.length} usuario(s).`);

        } catch (error) {
            await conn.rollback();
            console.error('[CRON] Error en incremento mensual de vacaciones:', error);
        } finally {
            conn.release();
        }
    }, {
        timezone: 'America/Guatemala'
    });

    console.log('[CRON] Job de incremento mensual registrado (día 1 de cada mes a la 1:00am, Guatemala).');
}

module.exports = { startMonthlyVacationIncrement };
