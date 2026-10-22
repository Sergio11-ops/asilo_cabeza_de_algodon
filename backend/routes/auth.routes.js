// backend/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/login', authController.login);
router.post('/solicitar-recuperacion', authController.solicitarRecuperacion);
router.post('/restablecer-password', authController.restablecerPassword);

module.exports = router;