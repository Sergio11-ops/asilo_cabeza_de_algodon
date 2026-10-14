const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/auth.middleware');

async function login(req, res) {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ mensaje: 'El correo y la contraseña son obligatorios.' });
    }

    try {
        // Buscar usuario por correo o nombre de usuario
        const [rows] = await db.query(
            'SELECT * FROM usuario WHERE (correo = ? OR usuario = ?) AND activo = 1',
            [correo, correo]
        );

        if (rows.length === 0) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas o usuario inactivo.' });
        }

        const usuario = rows[0];
        const rolNormalizado = (usuario.rol || '').trim().toLowerCase();

        // Verificar contraseña con hash bcrypt
        const passwordMatch = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
        }

        // Registrar último acceso
        await db.query('UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = ?', [usuario.id_usuario]);

        // Generar Token JWT (duración de 8 horas)
        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, rol: rolNormalizado, nombre: usuario.nombre },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: 'Inicio de sesión exitoso',
            token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
                correo: usuario.correo,
                usuario: usuario.usuario,
                rol: rolNormalizado
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al procesar la solicitud.' });
    }
}

module.exports = {
    login
};