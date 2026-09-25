const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'secreto_super_seguro_asilo_2026';

// Roles válidos del sistema
const ROLES_VALIDOS = ['admin', 'medico_general', 'especialista', 'enfermero', 'laboratorio', 'farmacia', 'caja'];

// Estados válidos para un paciente (deben calzar con el <select> del formulario)
const ESTADOS_PACIENTE_VALIDOS = ['Activo', 'Por valorar', 'En observación'];

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
        console.error('❌ Error al conectar a MySQL:');
        console.error(error);
    }
})();

// ==========================================
// 🔒 MIDDLEWARE DE AUTENTICACIÓN Y ROLES
// ==========================================

// Verifica que venga un token válido en el header Authorization: Bearer <token>
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
        // payload trae { id_usuario, rol, nombre } (lo que firmamos en el login)
        req.usuario = payload;
        next();
    });
}

// Genera un middleware que solo deja pasar a los roles indicados.
// Uso: permitirRoles('admin', 'trabajo_social')
function permitirRoles(...rolesPermitidos) {
    return (req, res, next) => {
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
            return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción.' });
        }
        next();
    };
}

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

        // Normalizamos el rol a minúsculas por si en la BD quedó con mayúsculas o espacios
        const rolNormalizado = (usuario.rol || '').trim().toLowerCase();

        // 2. Comparar contraseña (admite tanto texto plano como encriptada con bcrypt)
        const passwordMatch = (password === usuario.password_hash) || await bcrypt.compare(password, usuario.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
        }

        // 3. Generar Token JWT de autenticación
        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, rol: rolNormalizado, nombre: usuario.nombre },
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
                rol: rolNormalizado
            }
        });

    } catch (error) {
        console.error('Error en /api/auth/login:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al procesar la solicitud.' });
    }
});

// ==========================================
// 👤 GESTIÓN DE USUARIOS (solo admin)
// ==========================================
app.post('/api/usuarios/crear', verificarToken, permitirRoles('admin'), async (req, res) => {
    const { nombre, correo } = req.body;
    const { password } = req.body;
    const rol = req.body.rol ? req.body.rol.trim().toLowerCase() : req.body.rol;

    if (!nombre || !correo || !password || !rol) {
        return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
    }

    if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ mensaje: 'El rol indicado no es válido.' });
    }

    try {
        const [existentes] = await db.query('SELECT id_usuario FROM usuarios WHERE correo = ?', [correo]);
        if (existentes.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe un usuario con ese correo.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [resultado] = await db.query(
            'INSERT INTO usuarios (nombre, correo, password_hash, rol, estado) VALUES (?, ?, ?, ?, 1)',
            [nombre, correo, passwordHash, rol]
        );

        res.status(201).json({
            mensaje: 'Usuario creado con éxito',
            id_usuario: resultado.insertId
        });

    } catch (error) {
        console.error('❌ Error al crear usuario:', error);
        res.status(500).json({ mensaje: 'Error interno al crear el usuario.', detalles: error.message });
    }
});

// Lista simple de usuarios, útil para una futura pantalla de administración
app.get('/api/usuarios', verificarToken, permitirRoles('admin'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id_usuario, nombre, correo, LOWER(TRIM(rol)) AS rol, estado, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error al listar usuarios:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los usuarios.' });
    }
});

// ==========================================
// 🧓 GESTIÓN DE PACIENTES
// (Administrador y Trabajo Social/Recepción hacen las altas)
//
// Modelo real: el paciente tiene sus propios datos clínicos/administrativos,
// y un CONTACTO DE EMERGENCIA (tabla "familiares") con nombre y teléfono.
// ==========================================
app.post('/api/pacientes/registrar', verificarToken, permitirRoles('admin', 'enfermero'), async (req, res) => {
    const {
        nombrePaciente,
        fechaNacimiento,
        genero,
        dpi,
        telefonoContacto,
        nombreContactoEmergencia,
        telefonoContactoEmergencia,
        diagnosticoPrincipal,
        estado,
        fechaIngreso,
        observaciones
    } = req.body;

    // Campos obligatorios según el formulario de registro_paciente.html
    if (!nombrePaciente || !fechaNacimiento || !genero || !fechaIngreso ||
        !nombreContactoEmergencia || !telefonoContactoEmergencia) {
        return res.status(400).json({ mensaje: 'Por favor complete todos los campos obligatorios.' });
    }

    const estadoFinal = estado && ESTADOS_PACIENTE_VALIDOS.includes(estado) ? estado : 'Activo';

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Insertar el contacto de emergencia (familiar)
        const [resFamiliar] = await connection.query(
            'INSERT INTO familiares (nombre, telefono) VALUES (?, ?)',
            [nombreContactoEmergencia, telefonoContactoEmergencia]
        );

        const idFamiliar = resFamiliar.insertId;

        // 2. Insertar el paciente
        const [resPaciente] = await connection.query(
            `INSERT INTO pacientes 
            (id_familiar, nombre, fecha_nacimiento, genero, dpi, telefono_contacto,
             diagnostico_principal, estado, fecha_ingreso, observaciones) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idFamiliar,
                nombrePaciente,
                fechaNacimiento,
                genero,
                dpi || null,
                telefonoContacto || null,
                diagnosticoPrincipal || null,
                estadoFinal,
                fechaIngreso,
                observaciones || null
            ]
        );

        await connection.commit();

        res.status(201).json({
            mensaje: 'Paciente registrado con éxito',
            id_paciente: resPaciente.insertId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('❌ Error de MySQL al registrar paciente:', error);

        res.status(500).json({
            mensaje: 'Error en la base de datos al registrar el paciente.',
            detalles: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Lista de pacientes con su contacto de emergencia, para la tabla de registro_paciente.html
app.get('/api/pacientes', verificarToken, permitirRoles('admin', 'enfermero', 'medico_general', 'especialista'), async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT p.id_paciente, p.nombre, p.fecha_nacimiento, p.genero, p.dpi,
                    p.telefono_contacto, p.diagnostico_principal, p.estado,
                    p.fecha_ingreso, p.observaciones,
                    f.nombre AS nombre_contacto_emergencia, f.telefono AS telefono_contacto_emergencia
             FROM pacientes p
             LEFT JOIN familiares f ON f.id_familiar = p.id_familiar
             ORDER BY p.fecha_ingreso DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Error al listar pacientes:', error);
        res.status(500).json({ mensaje: 'Error interno al obtener los pacientes.' });
    }
});

// Iniciar Servidor Node.js
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});