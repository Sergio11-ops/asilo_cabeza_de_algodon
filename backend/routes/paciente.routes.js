// backend/routes/paciente.routes.js
const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

// Consulta de pacientes: Autorizado para admin, médicos y enfermeros
router.get('/', verificarToken, permitirRoles('admin', 'medico_general', 'especialista', 'enfermero'), (req, res) => pacienteController.obtenerPacientes(req, res));
router.get('/:id', verificarToken, permitirRoles('admin', 'medico_general', 'especialista', 'enfermero'), (req, res) => pacienteController.obtenerPacientePorId(req, res));

// Acciones de administración de pacientes: Exclusivas del rol admin
router.post('/', verificarToken, permitirRoles('admin'), (req, res) => pacienteController.crearPaciente(req, res));
router.put('/:id', verificarToken, permitirRoles('admin'), (req, res) => pacienteController.actualizarPaciente(req, res));
router.patch('/:id/desactivar', verificarToken, permitirRoles('admin'), (req, res) => pacienteController.desactivarPaciente(req, res));

module.exports = router;