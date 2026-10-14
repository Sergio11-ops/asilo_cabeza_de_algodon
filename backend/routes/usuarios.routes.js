const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

// Rutas protegidas únicamente para Administrador
router.get('/', verificarToken, permitirRoles('admin'), usuariosController.obtenerUsuarios);
router.post('/', verificarToken, permitirRoles('admin'), usuariosController.crearUsuario);
router.patch('/:id/estado', verificarToken, permitirRoles('admin'), usuariosController.cambiarEstado);
// Actualizar datos de un usuario
router.put('/:id', verificarToken, permitirRoles('admin'), usuariosController.actualizarUsuario);
module.exports = router;