const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Endpoint público para que el Jefe reaccione vía link en el correo
router.get('/token/:token', requestController.processApprovalToken);

// Todas las demás rutas requieren autenticación
router.use(isAuthenticated);

// Crear una nueva solicitud
router.post('/', requestController.createRequest);

// Listar solicitudes (filtradas por el rol del usuario en el controller)
router.get('/', requestController.listRequests);

// El jefe o rrhh procesan una decisión desde el portal web
router.put('/:id/decision', requireRole('manager', 'hr_admin', 'super_admin'), requestController.makeDecision);

module.exports = router;
