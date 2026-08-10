const cron = require('node-cron');
const db = require('../config/db');

// ============================================================
// Recálculo anual de Días Beneficio por Años Laborales
// ============================================================
// Se ejecuta el 1 de enero a las 02:00 (America/Guatemala, UTC-6).
// El bono NO es acumulable: se recalcula desde cero cada año según la
// fecha de ingreso. Fórmula (por año calendario):
//   dias = min( max( YEAR(hoy) - YEAR(fecha_ingreso) - 3, 0 ), 10 )
// (misma regla que utils/beneficioAnios.js -> calcDiasBeneficioBono)
function startRecalcBeneficioAnios() {
    cron.schedule('0 2 1 1 *', async () => {
        console.log('[CRON] Recalculando dias_beneficio_anno_laboral (1 de enero)...');
        try {
            const [result] = await db.query(
                `UPDATE users
                 SET dias_beneficio_anno_laboral = LEAST(GREATEST(CAST(YEAR(CURDATE()) AS SIGNED) - CAST(YEAR(fecha_ingreso) AS SIGNED) - 3, 0), 10)
                 WHERE fecha_ingreso IS NOT NULL`
            );
            console.log(`[CRON] Recálculo de bono completado: ${result.affectedRows} colaborador(es).`);
        } catch (err) {
            console.error('[CRON] Error en recálculo anual de bono:', err);
        }
    }, { timezone: 'America/Guatemala' });

    console.log('[CRON] Job de recálculo de bono registrado (1 de enero a las 02:00, Guatemala).');
}

module.exports = { startRecalcBeneficioAnios };
