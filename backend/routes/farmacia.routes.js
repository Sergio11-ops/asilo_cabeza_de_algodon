// backend/routes/farmacia.routes.js
const express = require('express');
const router = express.Router();
const farmaciaController = require('../controllers/farmacia.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/combos', farmaciaController.obtenerCombos);
router.get('/recetas', farmaciaController.listarRecetas);

// Prescribir receta: Médicos y Admin
router.post('/recetas', permitirRoles('admin', 'medico_general', 'especialista'), farmaciaController.prescribirReceta);

// Despachar receta e Inventario: Farmacia y Admin
router.post('/despacho', permitirRoles('admin', 'farmacia'), farmaciaController.despacharReceta);
router.post('/medicamentos', permitirRoles('admin', 'farmacia'), farmaciaController.guardarMedicamento);

module.exports = router;