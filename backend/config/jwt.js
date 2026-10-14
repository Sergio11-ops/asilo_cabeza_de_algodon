// backend/config/jwt.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_asilo_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function generarToken(usuario) {
    return jwt.sign(
        {
            id_usuario: usuario.id_usuario,
            usuario: usuario.usuario,
            correo: usuario.correo,
            rol: usuario.rol ? usuario.rol.toLowerCase() : ''
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verificarTokenJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            const err = new Error('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
            err.status = 401;
            throw err;
        }
        const err = new Error('Token no válido o alterado.');
        err.status = 401;
        throw err;
    }
}

module.exports = {
    generarToken,
    verificarTokenJWT,
    JWT_SECRET
};