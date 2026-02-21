const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Iniciar login con Google
router.get('/google', authController.googleLogin);

// Callback de Google
router.get('/google/callback', authController.googleCallback);

// Cerrar sesión
router.post('/logout', authController.logout);

// Obtener usuario actual
router.get('/me', authController.getCurrentUser);

module.exports = router;
