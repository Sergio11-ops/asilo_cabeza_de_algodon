// backend/routes/solicitud.routes.js
const express = require('express');
const router = express.Router();
const solicitudController = require('../controllers/solicitud.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

router.use(verificarToken);

router.get('/', solicitudController.listar);
router.get('/combos', solicitudController.combos);
router.post('/', solicitudController.crear);
router.patch('/:id/estado', solicitudController.cambiarEstado);

module.exports = router;