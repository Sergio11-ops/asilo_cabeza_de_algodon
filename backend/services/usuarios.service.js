const usuariosRepository = require('../repositories/usuarios.repository');
const bcrypt = require('bcryptjs');

async function listarUsuarios() {
    return await usuariosRepository.obtenerTodos();
}

async function registrarUsuario(datosUsuario) {
    const { nombre, apellido, correo, usuario, password, rol, activo } = datosUsuario;

    const existentes = await usuariosRepository.buscarPorCorreoOUsuario(correo, usuario);
    if (existentes.length > 0) {
        const error = new Error('El correo o nombre de usuario ya se encuentra registrado.');
        error.status = 409;
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const rolNormalizado = rol.trim().toLowerCase();
    const estadoActivo = activo !== undefined ? parseInt(activo, 10) : 1;

    return await usuariosRepository.crear({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: correo.trim(),
        usuario: usuario.trim(),
        passwordHash,
        rol: rolNormalizado,
        activo: estadoActivo
    });
}

async function modificarUsuario(id, datosActualizar) {
    const { nombre, apellido, correo, usuario, rol, password } = datosActualizar;

    const existentes = await usuariosRepository.buscarPorCorreoOUsuario(correo, usuario, id);
    if (existentes.length > 0) {
        const error = new Error('El correo o nombre de usuario ya está registrado por otro usuario.');
        error.status = 409;
        throw error;
    }

    const rolNormalizado = rol.trim().toLowerCase();
    let passwordHash = null;

    if (password && password.trim().length > 0) {
        passwordHash = await bcrypt.hash(password, 10);
    }

    await usuariosRepository.actualizar(id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: correo.trim(),
        usuario: usuario.trim(),
        rol: rolNormalizado,
        passwordHash
    });
}

async function cambiarEstadoUsuario(id, activo) {
    await usuariosRepository.cambiarEstado(id, activo);
}

module.exports = {
    listarUsuarios,
    registrarUsuario,
    modificarUsuario,
    cambiarEstadoUsuario
};