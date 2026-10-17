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
            s.id_enfermero,
            CONCAT(u_enf.nombre, ' ', u_enf.apellido) AS enfermero_nombre,
            COALESCE(CONCAT(u_med.nombre, ' ', u_med.apellido), CONCAT(m.nombre, ' ', m.apellido)) AS medico_referente
        FROM solicitud_medica s
        INNER JOIN paciente p ON s.id_paciente = p.id_paciente
        INNER JOIN especialidad e ON s.id_especialidad = e.id_especialidad
        INNER JOIN medico m ON s.id_medico_general = m.id_medico
        LEFT JOIN usuario u_med ON m.id_usuario = u_med.id_usuario
        LEFT JOIN usuario u_enf ON s.id_enfermero = u_enf.id_usuario
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
        const [fallback] = await db.query(`SELECT id_usuario FROM usuario WHERE activo = 1 LIMIT 1`);
        return fallback.length > 0 ? fallback[0].id_usuario : 1;
    }

    async crearMedicoEspecialista(datosMedico, idSolicitud) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Obtener id_especialidad desde la solicitud si no viene especificada
            let idEspecialidad = datosMedico.id_especialidad;
            if (!idEspecialidad && idSolicitud) {
                const [sol] = await connection.query(
                    `SELECT id_especialidad FROM solicitud_medica WHERE id_solicitud = ?`,
                    [idSolicitud]
                );
                if (sol.length > 0) {
                    idEspecialidad = sol[0].id_especialidad;
                }
            }

            if (!idEspecialidad) {
                throw new Error('No se pudo determinar la especialidad para el registro del médico.');
            }

            // Insertar únicamente en la tabla medico (id_usuario en NULL)
            const queryMedico = `
                INSERT INTO medico (id_usuario, nombre, apellido, colegiado, tipo, id_especialidad)
                VALUES (NULL, ?, ?, ?, 'especialista', ?)
            `;
            const [resMedico] = await connection.query(queryMedico, [
                datosMedico.nombres,
                datosMedico.apellidos,
                datosMedico.colegiado,
                idEspecialidad
            ]);

            await connection.commit();
            return resMedico.insertId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async crearCita(datos) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const idUsuarioValido = await this.obtenerIdUsuarioValido(datos.id_usuario_asigna);

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
                COALESCE(CONCAT(u_med.nombre, ' ', u_med.apellido), CONCAT(m.nombre, ' ', m.apellido)) AS especialista_nombre,
                CONCAT(u_enf.nombre, ' ', u_enf.apellido) AS enfermero_nombre
            FROM cita_medica c
            INNER JOIN solicitud_medica s ON c.id_solicitud = s.id_solicitud
            INNER JOIN paciente p ON s.id_paciente = p.id_paciente
            INNER JOIN especialidad e ON s.id_especialidad = e.id_especialidad
            INNER JOIN medico m ON c.id_medico = m.id_medico
            LEFT JOIN usuario u_med ON m.id_usuario = u_med.id_usuario
            LEFT JOIN usuario u_enf ON c.id_enfermero = u_enf.id_usuario
            WHERE c.fecha_hora BETWEEN ? AND ?
            ORDER BY c.fecha_hora ASC
        `;
        const [filas] = await db.query(query, [fechaInicio, fechaFin]);
        return filas;
    }
}

module.exports = new CitaRepository();