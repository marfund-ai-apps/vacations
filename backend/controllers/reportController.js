const db = require('../config/db');

// GET /api/reports/employee-report (Dashboard del usuario logueado)
exports.getMyReport = async (req, res) => {
  const id = req.user.id;
  const year = req.query.year || new Date().getFullYear();

  try {
    // Obtener días base del usuario
    const [users] = await db.query('SELECT base_vacation_days FROM users WHERE id = ?', [id]);
    const baseDays = parseFloat(users.length ? users[0].base_vacation_days : 15);

    // Días consumidos — SOLO vacaciones aprobadas (permisos y ausencias no descuentan)
    const [consumed] = await db.query(`
            SELECT COALESCE(SUM(rdr.business_days), 0) as total_consumed
            FROM vacation_requests vr
            JOIN request_date_ranges rdr ON vr.id = rdr.request_id
            WHERE vr.employee_id = ?
            AND vr.status = 'approved'
            AND vr.request_type = 'vacation'
            AND YEAR(vr.created_at) = ?
        `, [id, year]);

    const consumedDays = parseFloat(consumed[0].total_consumed) || 0;

    // Total de días agregados por ajustes del año actual
    const [adjustmentSum] = await db.query(`
            SELECT COALESCE(SUM(days_added), 0) as total_adjusted
            FROM user_day_adjustments
            WHERE user_id = ? AND YEAR(created_at) = ?
        `, [id, year]);

    const totalAdjusted = parseFloat(adjustmentSum[0].total_adjusted) || 0;
    const availableDays = baseDays - consumedDays;

    // Historial de ajustes del año actual (para mostrar en el dashboard como movimientos verdes)
    const [adjustmentList] = await db.query(`
            SELECT uda.id, uda.adjustment_number, uda.days_added, uda.adjustment_type, uda.reason, uda.created_at,
                   u.full_name as adjusted_by_name
            FROM user_day_adjustments uda
            LEFT JOIN users u ON uda.adjusted_by = u.id
            WHERE uda.user_id = ? AND YEAR(uda.created_at) = ?
            ORDER BY uda.created_at DESC
        `, [id, year]);

    // Solicitudes recientes del año actual
    const [requests] = await db.query(`
            SELECT vr.*, m.full_name as manager_name,
            (SELECT SUM(business_days) FROM request_date_ranges WHERE request_id = vr.id) as total_days
            FROM vacation_requests vr
            LEFT JOIN users m ON vr.manager_id = m.id
            WHERE vr.employee_id = ? AND YEAR(vr.created_at) = ?
            ORDER BY vr.created_at DESC
        `, [id, year]);

    for (const req of requests) {
      const [ranges] = await db.query(
        'SELECT * FROM request_date_ranges WHERE request_id = ?', [req.id]
      );
      req.date_ranges = ranges;
    }

    res.json({
      summary: {
        total_base_days: baseDays,
        total_extra_days: totalAdjusted,
        total_consumed_days: consumedDays,
        total_available_days: availableDays
      },
      history: requests,
      adjustments: adjustmentList
    });
  } catch (err) {
    console.error("Error en getMyReport:", err);
    res.status(500).json({ message: 'Error obteniendo reporte del dashboard' });
  }
};

// GET /api/reports/employee/:id?year=2024
exports.getEmployeeReport = async (req, res) => {
  const { id } = req.params;
  const year = req.query.year || new Date().getFullYear();

  try {
    const [summary] = await db.query(`
      SELECT 
        u.full_name, u.email, u.employee_number, u.position,
        vr.request_type,
        COUNT(vr.id) as total_requests,
        SUM(rdr.business_days) as total_days,
        vr.status
      FROM users u
      LEFT JOIN vacation_requests vr ON u.id = vr.employee_id 
           AND YEAR(vr.created_at) = ? 
           AND vr.status = 'approved'
      LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
      WHERE u.id = ?
      GROUP BY u.id, vr.request_type, vr.status
    `, [year, id]);

    const [requests] = await db.query(`
      SELECT vr.*, m.full_name as manager_name
      FROM vacation_requests vr
      JOIN users m ON vr.manager_id = m.id
      WHERE vr.employee_id = ? AND YEAR(vr.created_at) = ?
      ORDER BY vr.created_at DESC
    `, [id, year]);

    for (const req of requests) {
      const [ranges] = await db.query(
        'SELECT * FROM request_date_ranges WHERE request_id = ?', [req.id]
      );
      req.date_ranges = ranges;
      req.total_days = ranges.reduce((sum, r) => sum + parseFloat(r.business_days), 0);
    }

    res.json({ year, summary, requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error obteniendo reporte del empleado' });
  }
};

// GET /api/reports/employee/:id/detail — Historial unificado de movimientos del colaborador
exports.getEmployeeDetail = async (req, res) => {
  const { id } = req.params;

  try {
    // Info del colaborador
    const [userRows] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.employee_number, u.position, u.base_vacation_days,
              m.full_name as manager_name
       FROM users u LEFT JOIN users m ON u.manager_id = m.id
       WHERE u.id = ?`, [id]
    );
    if (!userRows.length) return res.status(404).json({ message: 'Colaborador no encontrado' });
    const userData = userRows[0];

    // Días consumidos (solo vacaciones aprobadas)
    const [consumed] = await db.query(
      `SELECT COALESCE(SUM(rdr.business_days), 0) as total
       FROM vacation_requests vr
       JOIN request_date_ranges rdr ON vr.id = rdr.request_id
       WHERE vr.employee_id = ? AND vr.status = 'approved' AND vr.request_type = 'vacation'`, [id]
    );
    const consumedDays = parseFloat(consumed[0].total) || 0;

    // Ajustes de días (incrementos manuales, automáticos, saldo inicial)
    const [adjustments] = await db.query(
      `SELECT uda.id, uda.adjustment_number, uda.days_added, uda.adjustment_type,
              uda.reason, uda.created_at, u.full_name as adjusted_by_name
       FROM user_day_adjustments uda
       LEFT JOIN users u ON uda.adjusted_by = u.id
       WHERE uda.user_id = ?
       ORDER BY uda.created_at ASC`, [id]
    );

    // Solicitudes (todas las aprobadas)
    const [requests] = await db.query(
      `SELECT vr.id, vr.request_number, vr.request_type, vr.status, vr.reason,
              vr.manager_decision_date, vr.created_at
       FROM vacation_requests vr
       WHERE vr.employee_id = ? AND vr.status = 'approved'
       ORDER BY vr.created_at ASC`, [id]
    );
    for (const r of requests) {
      const [ranges] = await db.query('SELECT SUM(business_days) as total FROM request_date_ranges WHERE request_id = ?', [r.id]);
      r.total_days = parseFloat(ranges[0].total) || 0;
    }

    // Unificar movimientos: ajustes (verde) + solicitudes vacaciones (rojo) + permisos/ausencias (gris)
    const movements = [];

    for (const adj of adjustments) {
      let typeLabel = 'Ajuste Manual';
      if (adj.adjustment_type === 'monthly_auto') typeLabel = 'Incremento Mensual Automático';
      if (adj.adjustment_type === 'initial_balance') typeLabel = 'Saldo Inicial';
      movements.push({
        id: `adj-${adj.id}`,
        date: adj.created_at,
        number: adj.adjustment_number || '—',
        type_label: typeLabel,
        color_type: 'credit',
        days: parseFloat(adj.days_added),
        reason: adj.reason,
        detail: adj.adjusted_by_name ? `Por: ${adj.adjusted_by_name}` : 'Sistema automático',
        sort_priority: adj.adjustment_type === 'initial_balance' ? 0 : 1
      });
    }

    for (const r of requests) {
      const isVacation = r.request_type === 'vacation';
      movements.push({
        id: `req-${r.id}`,
        date: r.manager_decision_date || r.created_at,
        number: r.request_number,
        type_label: r.request_type === 'vacation' ? 'Vacaciones aprobadas' :
                    r.request_type === 'permission' ? 'Permiso aprobado' : 'Ausencia justificada',
        color_type: isVacation ? 'debit' : 'info',
        days: r.total_days,
        reason: r.reason || '',
        detail: '',
        sort_priority: 1
      });
    }

    // Saldo inicial primero, luego el resto por fecha DESC
    movements.sort((a, b) => {
      if (a.sort_priority !== b.sort_priority) return a.sort_priority - b.sort_priority;
      return new Date(b.date) - new Date(a.date);
    });

    res.json({
      user: userData,
      summary: {
        base_days: parseFloat(userData.base_vacation_days),
        consumed_days: consumedDays,
        available_days: parseFloat(userData.base_vacation_days) - consumedDays
      },
      movements
    });
  } catch (err) {
    console.error('Error en getEmployeeDetail:', err);
    res.status(500).json({ message: 'Error obteniendo detalle del colaborador' });
  }
};

// GET /api/reports/all?year=2024 — Para RRHH: reporte de todos
exports.getAllEmployeesReport = async (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  try {
    const [rows] = await db.query(`
      SELECT
        u.id, u.full_name, u.email, u.employee_number, u.position,
        u.base_vacation_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'vacation' THEN rdr.business_days END), 0) as vacation_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'permission' THEN rdr.business_days END), 0) as permission_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'justified_absence' THEN rdr.business_days END), 0) as absence_days,
        COUNT(DISTINCT vr.id) as total_requests
      FROM users u
      LEFT JOIN vacation_requests vr ON u.id = vr.employee_id
           AND YEAR(vr.created_at) = ?
           AND vr.status = 'approved'
      LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
      WHERE u.is_active = 1
      GROUP BY u.id, u.full_name, u.email, u.employee_number, u.position, u.base_vacation_days
      ORDER BY u.full_name
    `, [year]);

    res.json({ year, employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener reporte general' });
  }
};
