// backend/routes/paciente.routes.js
const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

// Consulta de pacientes y catálogos: Autorizado para admin, médicos y enfermeros
router.get('/', verificarToken, permitirRoles('admin', 'medico_general', 'especialista', 'enfermero'), (req, res) => pacienteController.obtenerPacientes(req, res));
router.get('/catalogos', verificarToken, permitirRoles('admin', 'medico_general', 'especialista', 'enfermero'), (req, res) => pacienteController.obtenerCatalogos(req, res));
router.get('/:id', verificarToken, permitirRoles('admin', 'medico_general', 'especialista', 'enfermero'), (req, res) => pacienteController.obtenerPacientePorId(req, res));

// Edición de datos del paciente, familiar y ficha médica: admin, médico general y especialista
router.put('/:id', verificarToken, permitirRoles('admin', 'medico_general', 'especialista'), (req, res) => pacienteController.actualizarPaciente(req, res));

// Registro de pacientes: Permitido para admin y médico general
router.post('/', verificarToken, permitirRoles('admin', 'medico_general'), (req, res) => pacienteController.crearPaciente(req, res));

// Baja de pacientes: Exclusiva del rol admin
router.patch('/:id/desactivar', verificarToken, permitirRoles('admin'), (req, res) => pacienteController.desactivarPaciente(req, res));

module.exports = router;