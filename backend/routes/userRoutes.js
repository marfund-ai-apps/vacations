const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const importController = require('../controllers/importController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Multer en memoria (sin guardar en disco)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(isAuthenticated);

// Obtener lista de managers para el formulario
router.get('/managers', userController.getManagers);

// Obtener todos los usuarios inactivos (solo super_admin)
router.get('/inactive', requireRole('super_admin'), userController.getInactiveUsers);

// Obtener todos los usuarios (Solo Admin)
router.get('/', requireRole('hr_admin', 'super_admin'), userController.getAllUsers);

// Crear nuevo usuario (Solo Admin)
router.post('/', requireRole('hr_admin', 'super_admin'), userController.createUser);

// Modificar usuario
router.put('/:id', requireRole('hr_admin', 'super_admin'), userController.updateUser);

// Desactivar usuario
router.put('/:id/deactivate', requireRole('hr_admin', 'super_admin'), userController.deactivateUser);

// Activar usuario
router.put('/:id/activate', requireRole('super_admin'), userController.activateUser);

// Carga masiva de saldos iniciales desde Excel
router.post('/import-balances', requireRole('hr_admin', 'super_admin'), upload.single('file'), importController.importInitialBalances);

// Historial de ajustes de días de un usuario
router.get('/:id/day-adjustments', userController.getDayAdjustments);

// Agregar días manualmente (solo jefe/admin)
router.post('/:id/day-adjustments', requireRole('manager', 'hr_admin', 'super_admin'), userController.addDayAdjustment);

module.exports = router;
