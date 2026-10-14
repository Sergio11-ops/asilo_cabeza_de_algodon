const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_asilo_2026';

// Middleware para verificar que el usuario inició sesión
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ mensaje: 'Debes iniciar sesión para continuar.' });
    }

    jwt.verify(token, JWT_SECRET, (error, payload) => {
        if (error) {
            return res.status(403).json({ mensaje: 'Tu sesión expiró o el token no es válido.' });
        }
        req.usuario = payload;
        next();
    });
}

// Middleware para restringir acceso por rol
function permitirRoles(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción.' });
        }
        next();
    };
}

module.exports = {
    verificarToken,
    permitirRoles,
    JWT_SECRET
};