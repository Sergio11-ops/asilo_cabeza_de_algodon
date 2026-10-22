// backend/repositories/visita_medica.repository.js
const db = require('../config/db');
const cajaRepository = require('./caja.repository');

class VisitaMedicaRepository {
    async listarCitasEspecialidad() {
        const query = `
            SELECT 
                cm.id_cita,
                cm.id_solicitud,
                cm.fecha_hora,
                cm.observaciones AS obs_cita,
                sm.id_paciente,
                sm.motivo AS motivo_solicitud,
                sm.estado AS estado_solicitud,
                e.id_especialidad,
                e.nombre AS especialidad_nombre,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente_nombre,
                p.expediente,
                p.fecha_nacimiento,
                p.grupo_sanguineo,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(m.nombre, ''), ' ', COALESCE(m.apellido, ''))), ''),
                    NULLIF(TRIM(CONCAT(COALESCE(u_med.nombre, ''), ' ', COALESCE(u_med.apellido, ''))), ''),
                    'Por asignar'
                ) AS medico_nombre,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(u_enf.nombre, ''), ' ', COALESCE(u_enf.apellido, ''))), ''),
                    'Sin acompañante'
                ) AS enfermero_nombre,
                vm.id_visita,
                vm.diagnostico,
                vm.observaciones AS observaciones_visita
            FROM cita_medica cm
            INNER JOIN solicitud_medica sm ON cm.id_solicitud = sm.id_solicitud
            INNER JOIN paciente p ON sm.id_paciente = p.id_paciente
            INNER JOIN especialidad e ON sm.id_especialidad = e.id_especialidad
            LEFT JOIN medico m ON cm.id_medico = m.id_medico
            LEFT JOIN usuario u_med ON m.id_usuario = u_med.id_usuario
            LEFT JOIN usuario u_enf ON cm.id_enfermero = u_enf.id_usuario
            LEFT JOIN visita_medica vm ON sm.id_solicitud = vm.id_solicitud
            ORDER BY cm.fecha_hora DESC
        `;
        const [filas] = await db.query(query);
        return filas;
    }

    async obtenerFichaCompletaPaciente(idPaciente) {
        if (!idPaciente || isNaN(idPaciente)) {
            throw { status: 400, message: 'ID de paciente no válido.' };
        }

        const [pacienteRows] = await db.query(`
            SELECT 
                p.id_paciente, p.expediente, p.dpi, p.nombres, p.apellidos, 
                p.fecha_nacimiento, p.grupo_sanguineo, p.direccion, p.telefono,
                fm.id_ficha, fm.padecimientos, fm.observaciones AS obs_ficha
            FROM paciente p
            LEFT JOIN ficha_medica fm ON p.id_paciente = fm.id_paciente
            WHERE p.id_paciente = ?
        `, [idPaciente]);

        if (pacienteRows.length === 0) {
            throw { status: 404, message: 'Paciente no encontrado en la base de datos.' };
        }

        const paciente = pacienteRows[0];

        const [medicamentos] = await db.query(`
            SELECT id_paciente_medicamento, nombre, dosis, frecuencia, via 
            FROM paciente_medicamento 
            WHERE id_paciente = ? AND activo = 1
        `, [idPaciente]);

        const [psicopatologias] = await db.query(`
            SELECT id_psicopatologia, descripcion, nivel 
            FROM paciente_psicopatologia 
            WHERE id_paciente = ?
        `, [idPaciente]);

        const [examenes] = await db.query(`
            SELECT 
                ve.id_visita_examen,
                ex.nombre AS examen_nombre,
                ve.resultado,
                ex.valores_referencia,
                ve.fecha_resultado,
                ve.observaciones_laboratorio
            FROM visita_examen ve
            INNER JOIN examen ex ON ve.id_examen = ex.id_examen
            INNER JOIN visita_medica vm ON ve.id_visita = vm.id_visita
            LEFT JOIN ficha_medica fm ON vm.id_ficha = fm.id_ficha
            WHERE (vm.id_paciente = ? OR fm.id_paciente = ?) AND ve.estado = 'completado'
            ORDER BY ve.fecha_resultado DESC
        `, [idPaciente, idPaciente]);

        return {
            paciente,
            medicamentos: medicamentos || [],
            psicopatologias: psicopatologias || [],
            examenes: examenes || []
        };
    }

    async guardarDiagnostico(datos) {
        const { diagnostico, observaciones, costo_consulta, id_usuario } = datos;
        const precioConsulta = parseFloat(costo_consulta) > 0 ? parseFloat(costo_consulta) : 150.00;

        // 1. Capturar el ID enviado desde la pantalla (cita o solicitud)
        const idRecibido = datos.id_solicitud || datos.idSolicitud || datos.id_cita || datos.idCita || datos.id_visita || datos.idVisita || datos.id;

        if (!idRecibido) {
            throw new Error('No se recibió un identificador válido para guardar el diagnóstico.');
        }

        let idSolicitud = datos.id_solicitud || datos.idSolicitud || null;
        let idPaciente = datos.id_paciente || datos.idPaciente || null;
        let idMedico = datos.id_medico || datos.idMedico || null;
        let motivoVisita = datos.motivo_visita || datos.motivo || 'Consulta Médica';

        // 2. Buscar datos en Cita Médica
        const [[cita]] = await db.query(`
            SELECT id_cita, id_solicitud, id_medico 
            FROM cita_medica 
            WHERE id_cita = ? OR id_solicitud = ?
            LIMIT 1
        `, [idRecibido, idRecibido]);

        if (cita) {
            idSolicitud = cita.id_solicitud;
            if (!idMedico) idMedico = cita.id_medico;
        }

        // 3. Buscar datos en Solicitud Médica
        if (idSolicitud || idRecibido) {
            const [[sm]] = await db.query(`
                SELECT id_solicitud, id_paciente, motivo, id_medico_general 
                FROM solicitud_medica 
                WHERE id_solicitud = COALESCE(?, ?)
                LIMIT 1
            `, [idSolicitud, idRecibido]);

            if (sm) {
                idSolicitud = sm.id_solicitud;
                if (!idPaciente) idPaciente = sm.id_paciente;
                if (!motivoVisita || motivoVisita === 'Consulta Médica') motivoVisita = sm.motivo;
                if (!idMedico) idMedico = sm.id_medico_general;
            }
        }

        // 4. Fallback si se envió directamente el id_paciente
        if (!idPaciente) {
            const [[pac]] = await db.query(`SELECT id_paciente FROM paciente WHERE id_paciente = ?`, [idRecibido]);
            if (pac) idPaciente = pac.id_paciente;
        }

        if (!idPaciente) {
            throw new Error('No se pudo determinar el paciente para esta consulta.');
        }

        // 5. Obtener o generar Ficha Médica
        let idFicha = null;
        const [[ficha]] = await db.query(`SELECT id_ficha FROM ficha_medica WHERE id_paciente = ? LIMIT 1`, [idPaciente]);
        if (ficha) {
            idFicha = ficha.id_ficha;
        } else {
            const [resFicha] = await db.query(`
                INSERT INTO ficha_medica (id_paciente, fecha_registro, observaciones)
                VALUES (?, CURDATE(), 'Ficha generada automáticamente')
            `, [idPaciente]);
            idFicha = resFicha.insertId;
        }

        // 6. Verificar si la visita existe FÍSICAMENTE en la base de datos
        let idVisitaReal = null;
        if (idSolicitud) {
            const [[vm]] = await db.query(`SELECT id_visita FROM visita_medica WHERE id_solicitud = ? LIMIT 1`, [idSolicitud]);
            if (vm) idVisitaReal = vm.id_visita;
        }

        // 7. Insertar (si no existe) o Actualizar (si ya existía)
        if (idVisitaReal) {
            await db.query(`
                UPDATE visita_medica 
                SET id_solicitud = ?,
                    id_paciente = ?, 
                    id_ficha = ?, 
                    id_medico = ?,
                    fecha_visita = NOW(),
                    motivo_visita = ?,
                    diagnostico = ?, 
                    observaciones = ?, 
                    costo_consulta = ?
                WHERE id_visita = ?
            `, [idSolicitud, idPaciente, idFicha, idMedico, motivoVisita, diagnostico, observaciones, precioConsulta, idVisitaReal]);
        } else {
            const [resInsert] = await db.query(`
                INSERT INTO visita_medica 
                    (id_solicitud, id_paciente, id_ficha, id_medico, fecha_visita, motivo_visita, diagnostico, observaciones, costo_consulta)
                VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)
            `, [idSolicitud, idPaciente, idFicha, idMedico, motivoVisita, diagnostico, observaciones, precioConsulta]);

            idVisitaReal = resInsert.insertId;
        }

        // 8. Marcar solicitud como atendida
        if (idSolicitud) {
            await db.query(`UPDATE solicitud_medica SET estado = 'atendida' WHERE id_solicitud = ?`, [idSolicitud]);
        }

        // 9. Registrar cargo financiero en Caja
        if (idPaciente && idVisitaReal) {
            await cajaRepository.generarCargo({
                id_paciente: idPaciente,
                concepto: 'consulta',
                descripcion: 'Consulta Médica Especialidad',
                monto_original: precioConsulta,
                id_visita: idVisitaReal,
                id_usuario: id_usuario || 1
            });
        }

        return true;
    }
}

module.exports = new VisitaMedicaRepository();