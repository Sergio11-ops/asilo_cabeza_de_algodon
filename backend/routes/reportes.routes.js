const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/pacientes', verificarToken, reportesController.obtenerPacientes);
router.get('/generar', verificarToken, reportesController.generarReporte);

module.exports = router;