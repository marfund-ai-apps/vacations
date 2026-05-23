const cron = require('node-cron');
const db = require('../config/db');

// 1 de enero a las 00:05am hora Guatemala (UTC-6 = 06:05 UTC)
function startAnnualBenefitReset() {
    cron.schedule('5 6 1 1 *', async () => {
        console.log('[CRON] Iniciando reset anual de benefit_extra_day_used...');
        try {
            const [result] = await db.query(
                'UPDATE users SET benefit_extra_day_used = 0 WHERE benefit_extra_day = 1'
            );
            console.log(`[CRON] Reset anual completado: ${result.affectedRows} colaborador(es) actualizados.`);
        } catch (err) {
            console.error('[CRON] Error en reset anual de beneficio:', err);
        }
    }, { timezone: 'America/Guatemala' });

    console.log('[CRON] Job de reset anual de beneficio registrado (1 de enero a las 00:05am, Guatemala).');
}

module.exports = { startAnnualBenefitReset };
