// backend/controllers/auth.controller.js
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
                nombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
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

async function solicitarRecuperacion(req, res) {
    try {
        const { correo } = req.body;
        if (!correo) return res.status(400).json({ mensaje: 'Ingrese su correo electrónico o usuario.' });

        // Buscar usuario activo
        const [rows] = await db.query(
            'SELECT id_usuario, correo FROM usuario WHERE (correo = ? OR usuario = ?) AND activo = 1',
            [correo, correo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ mensaje: 'No existe un usuario activo asociado a este correo/usuario.' });
        }

        const idUsuario = rows[0].id_usuario;
        const pin = Math.floor(100000 + Math.random() * 900000).toString(); // PIN de 6 dígitos

        // Guardar PIN y expiración (15 minutos)
        await db.query(`
            UPDATE usuario 
            SET token_recuperacion = ?, 
                token_expiracion = DATE_ADD(NOW(), INTERVAL 15 MINUTE) 
            WHERE id_usuario = ?
        `, [pin, idUsuario]);

        console.log(`\n========================================`);
        console.log(`PIN RECUPERACIÓN (${rows[0].correo}): ${pin}`);
        console.log(`========================================\n`);

        res.json({ 
            mensaje: 'Código de verificación generado con éxito. Válido por 15 minutos.',
            pin_prueba: pin // Se envía en respuesta para agilizar tus pruebas locales
        });
    } catch (error) {
        console.error('Error al solicitar recuperación:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
}

async function restablecerPassword(req, res) {
    try {
        const { correo, pin, nuevaPassword } = req.body;

        if (!correo || !pin || !nuevaPassword) {
            return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
        }

        if (nuevaPassword.length < 6) {
            return res.status(400).json({ mensaje: 'La contraseña debe contener al menos 6 caracteres.' });
        }

        // Se envían exactamente los 3 parámetros requeridos: [correo, correo, pin]
        const [rows] = await db.query(`
            SELECT id_usuario FROM usuario 
            WHERE (correo = ? OR usuario = ?) 
            AND token_recuperacion = ? 
            AND token_expiracion > NOW() 
            AND activo = 1
        `, [correo, correo, pin]);

        if (rows.length === 0) {
            return res.status(400).json({ mensaje: 'El código PIN es inválido o ha expirado.' });
        }

        const idUsuario = rows[0].id_usuario;
        const nuevoHash = await bcrypt.hash(nuevaPassword, 10);

        // Actualizar contraseña y limpiar el token utilizado
        await db.query(`
            UPDATE usuario 
            SET password_hash = ?, 
                token_recuperacion = NULL, 
                token_expiracion = NULL 
            WHERE id_usuario = ?
        `, [nuevoHash, idUsuario]);

        res.json({ mensaje: 'Contraseña actualizada correctamente. Ya puede iniciar sesión.' });
    } catch (error) {
        console.error('Error al restablecer contraseña:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
}

module.exports = {
    login,
    solicitarRecuperacion,
    restablecerPassword
};