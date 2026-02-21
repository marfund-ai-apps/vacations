const db = require('../config/db');

// GET /api/reports/employee-report (Dashboard del usuario logueado)
exports.getMyReport = async (req, res) => {
  const id = req.user.id;
  const year = req.query.year || new Date().getFullYear();

  try {
    // Obtener días base del usuario
    const [users] = await db.query('SELECT base_vacation_days FROM users WHERE id = ?', [id]);
    const baseDays = users.length ? users[0].base_vacation_days : 15;

    // Días consumidos (solicitudes aprobadas del año actual)
    const [consumed] = await db.query(`
            SELECT COALESCE(SUM(rdr.business_days), 0) as total_consumed
            FROM vacation_requests vr
            JOIN request_date_ranges rdr ON vr.id = rdr.request_id
            WHERE vr.employee_id = ? 
            AND vr.status = 'approved'
            AND YEAR(vr.created_at) = ?
        `, [id, year]);

    const consumedDays = parseFloat(consumed[0].total_consumed) || 0;
    const availableDays = baseDays - consumedDays;

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
        total_extra_days: 0,
        total_consumed_days: consumedDays,
        total_available_days: availableDays
      },
      history: requests
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

// GET /api/reports/all?year=2024 — Para RRHH: reporte de todos
exports.getAllEmployeesReport = async (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  try {
    const [rows] = await db.query(`
      SELECT 
        u.id, u.full_name, u.email, u.employee_number, u.position,
        COALESCE(SUM(CASE WHEN vr.request_type = 'vacation' THEN rdr.business_days END), 0) as vacation_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'permission' THEN rdr.business_days END), 0) as permission_days,
        COALESCE(SUM(CASE WHEN vr.request_type = 'justified_absence' THEN rdr.business_days END), 0) as absence_days,
        COALESCE(SUM(rdr.business_days), 0) as total_days,
        COUNT(DISTINCT vr.id) as total_requests
      FROM users u
      LEFT JOIN vacation_requests vr ON u.id = vr.employee_id 
           AND YEAR(vr.created_at) = ? 
           AND vr.status = 'approved'
      LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
      WHERE u.is_active = 1
      GROUP BY u.id, u.full_name, u.email, u.employee_number, u.position
      ORDER BY u.full_name
    `, [year]);

    res.json({ year, employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener reporte general' });
  }
};
