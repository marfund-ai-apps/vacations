const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(isAuthenticated);

// Dashboard del empleado actual
router.get('/employee-report', reportController.getMyReport);

// Reporte individual
router.get('/employee/:id', requireRole('hr_admin', 'super_admin', 'manager'), reportController.getEmployeeReport);

// Historial detallado unificado del colaborador (para modal en Admin)
router.get('/employee/:id/detail', requireRole('hr_admin', 'super_admin', 'manager'), reportController.getEmployeeDetail);

// Reporte de todos (RRHH)
router.get('/all', requireRole('hr_admin', 'super_admin'), reportController.getAllEmployeesReport);

// Reporte de mi equipo (solo managers)
router.get('/team', requireRole('manager'), reportController.getTeamReport);

module.exports = router;
