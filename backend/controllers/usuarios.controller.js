const usuariosService = require('../services/usuarios.service');

async function obtenerUsuarios(req, res) {
    try {
        const usuarios = await usuariosService.listarUsuarios();
        res.json(usuarios);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ mensaje: 'Error al obtener la lista de usuarios.' });
    }
}

async function crearUsuario(req, res) {
    try {
        const { nombre, apellido, correo, usuario, password, rol } = req.body;
        if (!nombre || !apellido || !correo || !usuario || !password || !rol) {
            return res.status(400).json({ mensaje: 'Todos los campos obligatorios deben estar completos.' });
        }

        const id_usuario = await usuariosService.registrarUsuario(req.body);
        res.status(201).json({ mensaje: 'Usuario creado con éxito', id_usuario });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(error.status || 500).json({ mensaje: error.message || 'Error interno al registrar el usuario.' });
    }
}

async function actualizarUsuario(req, res) {
    try {
        const { id } = req.params;
        const { nombre, apellido, correo, usuario, rol } = req.body;

        if (!nombre || !apellido || !correo || !usuario || !rol) {
            return res.status(400).json({ mensaje: 'Todos los campos obligatorios deben estar completos.' });
        }

        await usuariosService.modificarUsuario(id, req.body);
        res.json({ mensaje: 'Usuario actualizado correctamente.' });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(error.status || 500).json({ mensaje: error.message || 'Error interno al actualizar usuario.' });
    }
}

async function cambiarEstado(req, res) {
    try {
        const { id } = req.params;
        const { activo } = req.body;

        if (activo === undefined) {
            return res.status(400).json({ mensaje: 'Debe especificar el nuevo estado activo.' });
        }

        await usuariosService.cambiarEstadoUsuario(id, activo);
        res.json({ mensaje: 'Estado del usuario actualizado correctamente.' });
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).json({ mensaje: 'Error interno al cambiar el estado del usuario.' });
    }
}

module.exports = {
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    cambiarEstado
};