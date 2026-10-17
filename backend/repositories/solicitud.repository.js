// backend/repositories/solicitud.repository.js
const db = require('../config/db');

class SolicitudRepository {
    async obtenerSolicitudes(estado = 'todas') {
        let query = `
            SELECT 
                s.id_solicitud,
                s.id_paciente,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente_nombre,
                p.expediente,
                s.id_especialidad,
                e.nombre AS especialidad_nombre,
                s.motivo,
                s.fecha_solicitud,
                s.estado,
                COALESCE(
                    CONCAT(u_med.nombre, ' ', u_med.apellido), 
                    CONCAT(m.nombre, ' ', m.apellido)
                ) AS medico_referente_nombre,
                CONCAT(u_enf.nombre, ' ', u_enf.apellido) AS enfermero_nombre
            FROM solicitud_medica s
            INNER JOIN paciente p ON s.id_paciente = p.id_paciente
            INNER JOIN especialidad e ON s.id_especialidad = e.id_especialidad
            INNER JOIN medico m ON s.id_medico_general = m.id_medico
            LEFT JOIN usuario u_med ON m.id_usuario = u_med.id_usuario
            LEFT JOIN usuario u_enf ON s.id_enfermero = u_enf.id_usuario
        `;

        const params = [];
        if (estado && estado !== 'todas') {
            query += ` WHERE LOWER(s.estado) = ?`;
            params.push(estado.toLowerCase());
        }

        query += ` ORDER BY s.fecha_solicitud DESC`;

        const [filas] = await db.query(query, params);
        return filas;
    }

    // backend/repositories/solicitud.repository.js

async obtenerIdMedicoPorUsuario(idUsuario) {
    // 1. Buscar si ya existe el médico asociado al usuario
    const [filas] = await db.query(
        `SELECT id_medico FROM medico WHERE id_usuario = ? LIMIT 1`,
        [idUsuario]
    );
    if (filas.length > 0) {
        return filas[0].id_medico;
    }

    // 2. Buscar si hay algún médico general registrado
    const [fallback] = await db.query(
        `SELECT id_medico FROM medico WHERE tipo = 'general' LIMIT 1`
    );
    if (fallback.length > 0) {
        return fallback[0].id_medico;
    }

    // 3. Si la tabla está totalmente vacía, registrar automáticamente al usuario logueado como Médico General
    const [resAuto] = await db.query(
        `INSERT INTO medico (id_usuario, colegiado, tipo, id_especialidad) VALUES (?, 'COL-GEN-AUTO', 'general', NULL)`,
        [idUsuario]
    );

    return resAuto.insertId;
}

    async crearSolicitud(datos) {
        const query = `
            INSERT INTO solicitud_medica 
                (id_paciente, id_medico_general, id_especialidad, id_enfermero, motivo, estado, fecha_solicitud)
            VALUES (?, ?, ?, ?, ?, 'pendiente', NOW())
        `;
        const [resultado] = await db.query(query, [
            datos.id_paciente,
            datos.id_medico_general,
            datos.id_especialidad,
            datos.id_enfermero || null,
            datos.motivo
        ]);

        return resultado.insertId;
    }

    async cambiarEstado(idSolicitud, estado) {
        let estadoEnum = estado.toLowerCase();
        if (estadoEnum === 'aprobada') estadoEnum = 'programada';
        if (estadoEnum === 'rechazada') estadoEnum = 'cancelada';

        const query = `UPDATE solicitud_medica SET estado = ? WHERE id_solicitud = ?`;
        const [resultado] = await db.query(query, [estadoEnum, idSolicitud]);
        return resultado.affectedRows > 0;
    }

    async obtenerEspecialidades() {
        const [filas] = await db.query(`SELECT id_especialidad, nombre FROM especialidad ORDER BY nombre ASC`);
        return filas;
    }

    async obtenerEnfermeros() {
        const [filas] = await db.query(`
            SELECT id_usuario, CONCAT(nombre, ' ', apellido) AS nombre_completo 
            FROM usuario 
            WHERE LOWER(rol) = 'enfermero' AND activo = 1 
            ORDER BY nombre ASC
        `);
        return filas;
    }

    async obtenerMedicosEspecialistas() {
        const [filas] = await db.query(`
            SELECT 
                m.id_medico, 
                COALESCE(
                    CONCAT(u.nombre, ' ', u.apellido), 
                    CONCAT(m.nombre, ' ', m.apellido)
                ) AS nombre_completo, 
                e.nombre AS especialidad
            FROM medico m
            LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
            LEFT JOIN especialidad e ON m.id_especialidad = e.id_especialidad
            WHERE (u.activo = 1 OR m.id_usuario IS NULL) 
              AND m.tipo = 'especialista'
            ORDER BY nombre_completo ASC
        `);
        return filas;
    }

    async obtenerDatosNotificacion(idPaciente) {
        const query = `
            SELECT 
                fam.id_familiar,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente_nombre,
                fam.correo AS familiar_correo,
                CONCAT(fam.nombres, ' ', fam.apellidos) AS familiar_nombre
            FROM paciente p
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = 1
            LEFT JOIN familiar fam ON pf.id_familiar = fam.id_familiar
            WHERE p.id_paciente = ?
            LIMIT 1
        `;
        const [filas] = await db.query(query, [idPaciente]);
        return filas[0] || null;
    }

    async registrarNotificacionCorreo({ idSolicitud, idFamiliar, correoDestino, asunto, estado, mensajeError }) {
        const query = `
            INSERT INTO notificacion_correo 
                (id_solicitud, id_familiar, correo_destino, asunto, estado, mensaje_error, creado_en, enviado_en)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ${estado === 'enviado' ? 'NOW()' : 'NULL'})
        `;
        await db.query(query, [
            idSolicitud,
            idFamiliar,
            correoDestino,
            asunto,
            estado,
            mensajeError || null
        ]);
    }

    async obtenerEspecialidadPorId(idEspecialidad) {
        const [filas] = await db.query(`SELECT nombre FROM especialidad WHERE id_especialidad = ?`, [idEspecialidad]);
        return filas[0] ? filas[0].nombre : 'Especialidad médica';
    }

    async obtenerNombreUsuarioPorId(idUsuario) {
        if (!idUsuario) return 'Personal de Enfermería';
        const [filas] = await db.query(
            `SELECT CONCAT(nombre, ' ', apellido) AS nombre_completo FROM usuario WHERE id_usuario = ?`, 
            [idUsuario]
        );
        return filas[0] ? filas[0].nombre_completo : 'Personal de Enfermería';
    }

    async crearEspecialidad(nombre) {
        const query = `INSERT INTO especialidad (nombre) VALUES (?)`;
        const [resultado] = await db.query(query, [nombre.trim()]);
        return { id_especialidad: resultado.insertId, nombre: nombre.trim() };
    }
}

module.exports = new SolicitudRepository();