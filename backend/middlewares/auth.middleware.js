// backend/middlewares/auth.middleware.js
const { verificarTokenJWT, JWT_SECRET } = require('../config/jwt');

/**
 * Middleware para verificar si la petición incluye un token JWT válido y activo.
 * Retorna 401 si no hay token o si ya expiró.
 */
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ 
            ok: false, 
            mensaje: 'Debes iniciar sesión para continuar.' 
        });
    }

    try {
        // Verificar token mediante la función helper centralizada
        const payload = verificarTokenJWT(token);
        
        // Inyectar datos del usuario autenticado en el objeto de petición (req)
        req.usuario = payload;
        next();
    } catch (error) {
        return res.status(401).json({ 
            ok: false, 
            mensaje: error.message || 'Tu sesión expiró o el token no es válido.' 
        });
    }
}

/**
 * Middleware para restringir acceso por roles (RBAC).
 * Retorna 403 si el rol del usuario no está en la lista permitida.
 * Ejemplo de uso: permitirRoles('admin', 'medico_general')
 */
function permitirRoles(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario || !req.usuario.rol) {
            return res.status(401).json({ 
                ok: false, 
                mensaje: 'Usuario no autenticado o rol no disponible.' 
            });
        }

        // Normalizar a minúsculas para prevenir problemas de coincidencia
        const rolUsuario = req.usuario.rol.trim().toLowerCase();
        const rolesNormalizados = rolesPermitidos.map(r => r.trim().toLowerCase());

        if (!rolesNormalizados.includes(rolUsuario)) {
            return res.status(403).json({ 
                ok: false, 
                mensaje: `No tienes permisos para realizar esta acción. Requieres rol: ${rolesPermitidos.join(', ')}` 
            });
        }

        next();
    };
}

module.exports = {
    verificarToken,
    permitirRoles,
    JWT_SECRET
};