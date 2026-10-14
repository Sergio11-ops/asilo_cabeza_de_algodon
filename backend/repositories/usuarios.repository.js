const db = require('../config/db');

async function obtenerTodos() {
    const [rows] = await db.query(
        'SELECT id_usuario, nombre, apellido, correo, usuario, LOWER(TRIM(rol)) AS rol, activo, ultimo_acceso, creado_en FROM usuario ORDER BY creado_en DESC'
    );
    return rows;
}

async function buscarPorCorreoOUsuario(correo, usuario, idExcluir = null) {
    let sql = 'SELECT id_usuario FROM usuario WHERE (correo = ? OR usuario = ?)';
    const params = [correo, usuario];

    if (idExcluir) {
        sql += ' AND id_usuario != ?';
        params.push(idExcluir);
    }

    const [rows] = await db.query(sql, params);
    return rows;
}

async function crear(datos) {
    const { nombre, apellido, correo, usuario, passwordHash, rol, activo } = datos;
    const [resultado] = await db.query(
        'INSERT INTO usuario (nombre, apellido, correo, usuario, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nombre, apellido, correo, usuario, passwordHash, rol, activo]
    );
    return resultado.insertId;
}

async function actualizar(id, datos) {
    const { nombre, apellido, correo, usuario, rol, passwordHash } = datos;
    if (passwordHash) {
        await db.query(
            'UPDATE usuario SET nombre = ?, apellido = ?, correo = ?, usuario = ?, rol = ?, password_hash = ? WHERE id_usuario = ?',
            [nombre, apellido, correo, usuario, rol, passwordHash, id]
        );
    } else {
        await db.query(
            'UPDATE usuario SET nombre = ?, apellido = ?, correo = ?, usuario = ?, rol = ? WHERE id_usuario = ?',
            [nombre, apellido, correo, usuario, rol, id]
        );
    }
}

async function cambiarEstado(id, activo) {
    await db.query('UPDATE usuario SET activo = ? WHERE id_usuario = ?', [activo ? 1 : 0, id]);
}

module.exports = {
    obtenerTodos,
    buscarPorCorreoOUsuario,
    crear,
    actualizar,
    cambiarEstado
};