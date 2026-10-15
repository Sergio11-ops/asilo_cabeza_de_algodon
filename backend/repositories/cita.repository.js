// backend/repositories/cita.repository.js
const db = require('../config/db');

class CitaRepository {
    async obtenerSolicitudesPendientes() {
        const query = `
            SELECT 
                s.id_solicitud,
                s.id_paciente,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente_nombre,
                p.expediente,
                s.id_especialidad,
                e.nombre AS especialidad_nombre,
                s.motivo,
                s.fecha_solicitud,
                CONCAT(u_med.nombre, ' ', u_med.apellido) AS medico_referente
            FROM solicitud_medica s
            INNER JOIN paciente p ON s.id_paciente = p.id_paciente
            INNER JOIN especialidad e ON s.id_especialidad = e.id_especialidad
            INNER JOIN medico m ON s.id_medico_general = m.id_medico
            INNER JOIN usuario u_med ON m.id_usuario = u_med.id_usuario
            WHERE s.estado IN ('pendiente', 'referida')
            ORDER BY s.fecha_solicitud ASC
        `;
        const [filas] = await db.query(query);
        return filas;
    }

    async obtenerIdUsuarioValido(idSolicitado) {
        if (idSolicitado) {
            const [filas] = await db.query(
                `SELECT id_usuario FROM usuario WHERE id_usuario = ? AND activo = 1 LIMIT 1`, 
                [idSolicitado]
            );
            if (filas.length > 0) return filas[0].id_usuario;
        }
        // Fallback: si no se detecta ID en token, tomar el primer usuario activo registrado
        const [fallback] = await db.query(`SELECT id_usuario FROM usuario WHERE activo = 1 LIMIT 1`);
        return fallback.length > 0 ? fallback[0].id_usuario : 1;
    }

    async crearCita(datos) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Garantizar que el ID de usuario exista en la tabla 'usuario'
            const idUsuarioValido = await this.obtenerIdUsuarioValido(datos.id_usuario_asigna);

            // 1. Insertar la cita en cita_medica
            const queryCita = `
                INSERT INTO cita_medica 
                    (id_solicitud, fecha_hora, id_medico, id_enfermero, observaciones, id_usuario_asigna)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const [resCita] = await connection.query(queryCita, [
                datos.id_solicitud,
                datos.fecha_hora,
                datos.id_medico,
                datos.id_enfermero || null,
                datos.observaciones || null,
                idUsuarioValido
            ]);

            // 2. Actualizar estado de solicitud_medica a 'programada'
            const queryUpdate = `UPDATE solicitud_medica SET estado = 'programada' WHERE id_solicitud = ?`;
            await connection.query(queryUpdate, [datos.id_solicitud]);

            await connection.commit();
            return resCita.insertId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async obtenerCitasPorFecha(fechaInicio, fechaFin) {
        const query = `
            SELECT 
                c.id_cita,
                c.id_solicitud,
                c.fecha_hora,
                c.observaciones,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente_nombre,
                p.expediente,
                e.nombre AS especialidad_nombre,
                s.motivo,
                CONCAT(u_med.nombre, ' ', u_med.apellido) AS especialista_nombre,
                CONCAT(u_enf.nombre, ' ', u_enf.apellido) AS enfermero_nombre
            FROM cita_medica c
            INNER JOIN solicitud_medica s ON c.id_solicitud = s.id_solicitud
            INNER JOIN paciente p ON s.id_paciente = p.id_paciente
            INNER JOIN especialidad e ON s.id_especialidad = e.id_especialidad
            INNER JOIN medico m ON c.id_medico = m.id_medico
            INNER JOIN usuario u_med ON m.id_usuario = u_med.id_usuario
            LEFT JOIN usuario u_enf ON c.id_enfermero = u_enf.id_usuario
            WHERE c.fecha_hora BETWEEN ? AND ?
            ORDER BY c.fecha_hora ASC
        `;
        const [filas] = await db.query(query, [fechaInicio, fechaFin]);
        return filas;
    }
}

module.exports = new CitaRepository();