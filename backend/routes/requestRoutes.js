const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { isAuthenticated } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// ═══════════════════════════════════════════════════════════════
// RUTAS PÚBLICAS (Sin autenticación)
// ═══════════════════════════════════════════════════════════════

// Endpoints públicos para aprobación/rechazo vía magic links (sin autenticación)
router.get('/token/:token/validate', requestController.validateToken);
router.post('/token/:token/approve', requestController.approveViaToken);
router.post('/token/:token/reject', requestController.rejectWithComment);

// ═══════════════════════════════════════════════════════════════
// RUTAS PROTEGIDAS (Requieren autenticación)
// ═══════════════════════════════════════════════════════════════

// Crear una nueva solicitud
router.post('/', isAuthenticated, requestController.createRequest);

// Listar solicitudes (filtradas por el rol del usuario en el controller)
router.get('/', isAuthenticated, requestController.listRequests);

// El jefe o rrhh procesan una decisión desde el portal web
router.put('/:id/decision', isAuthenticated, requireRole('manager', 'hr_admin', 'super_admin'), requestController.makeDecision);

// Anular solicitud — solo super_admin
router.put('/:id/annul', isAuthenticated, requireRole('super_admin'), requestController.annulRequest);

module.exports = router;
