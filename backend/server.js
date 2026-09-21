const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('../public')); // Sirve los archivos del Frontend desde /public

// Configuración DB MySQL
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'asilo_db',
    waitForConnections: true,
    connectionLimit: 10
});

// Configuración Transporter Nodemailer para correos a familiares
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'notificaciones@asilo.org', // Reemplazar por credenciales reales
        pass: 'contrasena_correo'
    }
});

// 1. ENDPOINT: Autenticación / Login
app.post('/api/auth/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        const [rows] = await dbPool.execute('SELECT * FROM usuarios WHERE correo = ? AND estado = 1', [correo]);
        if (rows.length === 0) return res.status(401).json({ mensaje: 'Credenciales inválidas' });

        const usuario = rows[0];
        const esValido = await bcrypt.compare(password, usuario.password_hash);
        if (!esValido) return res.status(401).json({ mensaje: 'Credenciales inválidas' });

        const token = jwt.sign(
            { id: usuario.id_usuario, rol: usuario.rol },
            'ClaveSecretaAsilo2026',
            { expiresIn: '8h' }
        );

        res.json({ token, usuario: { nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol } });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor', detalle: error.message });
    }
});

// 2. ENDPOINT: Registrar Paciente y Familiar
app.post('/api/pacientes/registrar', async (req, res) => {
    const { nombreFamiliar, telefonoFamiliar, correoFamiliar, direccionFamiliar, nombrePaciente, fechaNacimiento, cuotaMensual, psicopatologia, medicamentosCajon } = req.body;
    const connection = await dbPool.getConnection();
    try {
        await connection.beginTransaction();

        const [resFam] = await connection.execute(
            'INSERT INTO familiares (nombre, telefono, correo, direccion) VALUES (?, ?, ?, ?)',
            [nombreFamiliar, telefonoFamiliar, correoFamiliar, direccionFamiliar]
        );

        const [resPac] = await connection.execute(
            'INSERT INTO pacientes (id_familiar, nombre, fecha_nacimiento, cuota_mensual, psicopatologia_base, medicamentos_cajon) VALUES (?, ?, ?, ?, ?, ?)',
            [resFam.insertId, nombrePaciente, fechaNacimiento, cuotaMensual || 0, psicopatologia, medicamentosCajon]
        );

        await connection.commit();
        res.json({ mensaje: 'Paciente registrado exitosamente', id_paciente: resPac.insertId });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ mensaje: 'Error al registrar paciente', detalle: error.message });
    } finally {
        connection.release();
    }
});

// 3. ENDPOINT: Crear Solicitud Médica y enviar correo
app.post('/api/solicitudes/crear', async (req, res) => {
    const { id_paciente, id_medico_emisor, id_enfermero_asignado, especialidad_requerida, motivo } = req.body;
    try {
        const [resSol] = await dbPool.execute(
            'INSERT INTO solicitudes_medicas (id_paciente, id_medico_emisor, id_enfermero_asignado, especialidad_requerida, motivo) VALUES (?, ?, ?, ?, ?)',
            [id_paciente, id_medico_emisor, id_enfermero_asignado, especialidad_requerida, motivo]
        );

        // Obtener datos del familiar para enviar correo
        const [info] = await dbPool.execute(
            'SELECT p.nombre AS paciente, f.correo, f.nombre AS familiar FROM pacientes p JOIN familiares f ON p.id_familiar = f.id_familiar WHERE p.id_paciente = ?',
            [id_paciente]
        );

        if (info.length > 0) {
            const correoDestino = info[0].correo;
            const mailOptions = {
                from: '"Asilo Cabeza de Algodón" <notificaciones@asilo.org>',
                to: correoDestino,
                subject: `Notificación Médica - Paciente: ${info[0].paciente}`,
                text: `Estimado(a) ${info[0].familiar},\n\nLe informamos que se ha generado una solicitud de evaluación médica especializada para el paciente ${info[0].paciente}.\nEspecialidad requerida: ${especialidad_requerida}.\nMotivo: ${motivo}.\n\nLe mantendremos informado sobre la fecha asignada.`
            };
            transporter.sendMail(mailOptions).catch(err => console.error('Error enviando correo:', err));
        }

        res.json({ mensaje: 'Solicitud creada y correo enviado al familiar', id_solicitud: resSol.insertId });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error creando la solicitud', detalle: error.message });
    }
});

// 4. ENDPOINT: Obtener Historial / Ficha Médica de un Paciente
app.get('/api/pacientes/:id/ficha', async (req, res) => {
    const idPaciente = req.params.id;
    try {
        const [paciente] = await dbPool.execute(
            'SELECT p.*, f.nombre AS familiar_nombre, f.telefono AS familiar_telefono, f.correo AS familiar_correo FROM pacientes p JOIN familiares f ON p.id_familiar = f.id_familiar WHERE p.id_paciente = ?',
            [idPaciente]
        );

        if (paciente.length === 0) return res.status(404).json({ mensaje: 'Paciente no encontrado' });

        const [visitas] = await dbPool.execute(
            'SELECT v.id_visita, v.fecha_visita, v.diagnostico, v.observaciones, v.costo_consulta, u.nombre AS medico_especialista FROM visitas_medicas v JOIN citas_fundacion c ON v.id_cita = c.id_cita JOIN usuarios u ON c.id_medico_especialista = u.id_usuario WHERE v.id_paciente = ? ORDER BY v.fecha_visita DESC',
            [idPaciente]
        );

        res.json({ paciente: paciente[0], historial_visitas: visitas });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error obteniendo la ficha médica', detalle: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor de Asilo escuchando en http://localhost:${PORT}`));