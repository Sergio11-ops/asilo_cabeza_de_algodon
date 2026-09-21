const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'secreto_super_seguro_asilo_2026';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, '../public')));

// Pool de Conexión a MySQL
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',        // Cambia según tu configuración local de MySQL
    password: '',        // Tu contraseña de MySQL local (si la tienes)
    database: 'asilo_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificación inicial de conexión a la BD
(async () => {
    try {
        const connection = await db.getConnection();
        console.log('✅ Conexión exitosa a la base de datos MySQL (asilo_db)');
        connection.release();
    } catch (error) {
        console.error('❌ Error al conectar a MySQL:', error.message);
    }
})();

// ==========================================
// 🔑 RUTAS DE AUTENTICACIÓN (LOGIN)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ mensaje: 'El correo y la contraseña son obligatorios.' });
    }

    try {
        // 1. Buscar usuario por correo
        const [rows] = await db.query('SELECT * FROM usuarios WHERE correo = ? AND estado = 1', [correo]);

        if (rows.length === 0) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas o usuario inactivo.' });
        }

        const usuario = rows[0];

        // 2. Comparar contraseña con el hash encriptado
        const passwordMatch = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
        }

        // 3. Generar Token JWT de autenticación
        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, rol: usuario.rol, nombre: usuario.nombre },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // 4. Responder al cliente omitiendo la contraseña
        res.json({
            mensaje: 'Inicio de sesión exitoso',
            token,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en /api/auth/login:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al procesar la solicitud.' });
    }
});

// Iniciar Servidor Node.js
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});