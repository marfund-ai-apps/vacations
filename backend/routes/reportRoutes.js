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

// Reporte de todos (RRHH)
router.get('/all', requireRole('hr_admin', 'super_admin'), reportController.getAllEmployeesReport);

module.exports = router;
