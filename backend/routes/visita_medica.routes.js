// backend/routes/visita_medica.routes.js
const express = require('express');
const router = express.Router();
const visitaMedicaController = require('../controllers/visita_medica.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);

// Acceso habilitado para especialistas, médicos generales y admin
router.get('/citas', permitirRoles('admin', 'especialista', 'medico_general'), visitaMedicaController.listarCitas);
router.get('/ficha/:idPaciente', permitirRoles('admin', 'especialista', 'medico_general'), visitaMedicaController.obtenerFicha);
router.post('/diagnostico', permitirRoles('admin', 'especialista', 'medico_general'), visitaMedicaController.guardarDiagnostico);

module.exports = router;