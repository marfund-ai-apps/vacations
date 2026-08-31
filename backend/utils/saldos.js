const db = require('../config/db');

// ============================================================
// Saldos de un colaborador: Días base disponibles y Días bono disponibles
// ============================================================
// Base disponible  = base_vacation_days + SUM(monthly_auto + manual) − SUM(vacation aprobada)
// Bono disponible  = dias_beneficio_anno_laboral − SUM(seniority_benefit aprobado del año)
// (Los saldos se CALCULAN; no se almacenan. Aprobar/anular solo cambia status.)
async function getSaldos(userId, conn = db) {
    const [u] = await conn.query(
        'SELECT base_vacation_days, dias_beneficio_anno_laboral FROM users WHERE id = ?',
        [userId]
    );
    const baseVacationDays = parseFloat(u[0]?.base_vacation_days) || 0;
    const bonoAllot = parseInt(u[0]?.dias_beneficio_anno_laboral) || 0;

    const [adj] = await conn.query(
        "SELECT COALESCE(SUM(days_added),0) t FROM user_day_adjustments WHERE user_id = ? AND adjustment_type IN ('monthly_auto','manual')",
        [userId]
    );
    const [vac] = await conn.query(
        `SELECT COALESCE(SUM(rdr.business_days),0) t
         FROM vacation_requests vr JOIN request_date_ranges rdr ON vr.id = rdr.request_id
         WHERE vr.employee_id = ? AND vr.status = 'approved' AND vr.request_type = 'vacation'`,
        [userId]
    );
    const year = new Date().getFullYear();
    const [bono] = await conn.query(
        `SELECT COALESCE(SUM(rdr.business_days),0) t
         FROM vacation_requests vr JOIN request_date_ranges rdr ON vr.id = rdr.request_id
         WHERE vr.employee_id = ? AND vr.status = 'approved' AND vr.request_type = 'seniority_benefit'
           AND YEAR(vr.created_at) = ?`,
        [userId, year]
    );

    const bonoUsed = parseFloat(bono[0].t);
    return {
        baseAvail: baseVacationDays + parseFloat(adj[0].t) - parseFloat(vac[0].t),
        bonoAvail: bonoAllot - bonoUsed,
        bonoAllot,
        bonoUsed,
    };
}

module.exports = { getSaldos };
