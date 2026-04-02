const cron = require('node-cron');
const db = require('../config/db');

// TEMPORAL: cada 15 minutos para pruebas
// Producción: '0 1 1 * *' (día 1 de cada mes a la 1:00am)
const schedule = '*/15 * * * *';

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

            // Registrar un ajuste en user_day_adjustments por cada usuario
            const reason = 'Aumento automático mensual de 1.25 días de vacaciones';
            const insertValues = activeUsers.map(u => [u.id, null, 1.25, 'monthly_auto', reason]);

            await conn.query(
                `INSERT INTO user_day_adjustments (user_id, adjusted_by, days_added, adjustment_type, reason)
                 VALUES ?`,
                [insertValues]
            );

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
