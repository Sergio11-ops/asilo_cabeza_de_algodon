const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.get('/kpis', verificarToken, dashboardController.obtenerKPIs);

module.exports = router;