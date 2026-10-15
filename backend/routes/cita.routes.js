
// backend/routes/cita.routes.js
const express = require('express');
const router = express.Router();
const citaController = require('../controllers/cita.controller');
const { verificarToken } = require('../middlewares/auth.middleware'); // Ajusta la ruta si tu middleware tiene otro nombre

router.use(verificarToken); // Protege todas las rutas y extrae req.usuario

router.get('/pendientes', (req, res) => citaController.pendientes(req, res));
router.get('/', (req, res) => citaController.porFecha(req, res));
router.post('/', (req, res) => citaController.crear(req, res));

module.exports = router;