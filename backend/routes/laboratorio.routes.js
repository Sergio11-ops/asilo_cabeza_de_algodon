// backend/routes/laboratorio.routes.js
const express = require('express');
const router = express.Router();
const laboratorioController = require('../controllers/laboratorio.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/combos', laboratorioController.obtenerCombos);
router.get('/solicitudes', laboratorioController.listarSolicitudes);
router.post('/ordenes', laboratorioController.crearOrden);

// Proteger la carga de resultados: Solo administradores y personal de laboratorio
router.put(
    '/solicitudes/resultados-lote', 
    permitirRoles('admin', 'laboratorio', 'laboratorista'), 
    laboratorioController.guardarResultado
);

module.exports = router;