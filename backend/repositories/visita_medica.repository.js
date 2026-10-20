// backend/repositories/visita_medica.repository.js
const db = require('../config/db');

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
            INNER JOIN ficha_medica fm ON vm.id_ficha = fm.id_ficha
            WHERE fm.id_paciente = ? AND ve.estado = 'completado'
            ORDER BY ve.fecha_resultado DESC
        `, [idPaciente]);

        return {
            paciente,
            medicamentos: medicamentos || [],
            psicopatologias: psicopatologias || [],
            examenes: examenes || []
        };
    }

    async guardarDiagnostico(datos) {
        const { id_solicitud, id_paciente, id_medico, diagnostico, observaciones } = datos;

        if (!id_paciente) {
            throw new Error('El ID del paciente es obligatorio.');
        }

        // 1. Obtener o verificar ficha médica del paciente
        let [fichas] = await db.query(`SELECT id_ficha FROM ficha_medica WHERE id_paciente = ? LIMIT 1`, [id_paciente]);
        let idFicha;
        if (fichas.length > 0) {
            idFicha = fichas[0].id_ficha;
        } else {
            const [nuevaFicha] = await db.query(`INSERT INTO ficha_medica (id_paciente, fecha_registro) VALUES (?, CURDATE())`, [id_paciente]);
            idFicha = nuevaFicha.insertId;
        }

        // 2. Obtener id_medico válido
        let idMedicoValido = 1;
        if (id_medico) {
            const [medicos] = await db.query(`SELECT id_medico FROM medico WHERE id_usuario = ? LIMIT 1`, [id_medico]);
            if (medicos.length > 0) idMedicoValido = medicos[0].id_medico;
        }

        // 3. Obtener motivo de la solicitud
        let motivo = 'Consulta por Especialidad';
        if (id_solicitud) {
            const [solicitudes] = await db.query(`SELECT motivo FROM solicitud_medica WHERE id_solicitud = ?`, [id_solicitud]);
            if (solicitudes.length > 0 && solicitudes[0].motivo) {
                motivo = solicitudes[0].motivo;
            }
        }

        // 4. Buscar si ya existe la visita registrada
        let idVisita;
        let [visitas] = [];
        if (id_solicitud) {
            [visitas] = await db.query(`SELECT id_visita FROM visita_medica WHERE id_solicitud = ? LIMIT 1`, [id_solicitud]);
        }

        if (visitas && visitas.length > 0) {
            idVisita = visitas[0].id_visita;
            await db.query(`
                UPDATE visita_medica 
                SET id_paciente = ?, id_medico = ?, motivo_visita = ?, diagnostico = ?, observaciones = ? 
                WHERE id_visita = ?
            `, [id_paciente, idMedicoValido, motivo, diagnostico, observaciones, idVisita]);
        } else {
            const [nuevaVisita] = await db.query(`
                INSERT INTO visita_medica (id_paciente, id_solicitud, id_ficha, id_medico, fecha_visita, motivo_visita, diagnostico, observaciones)
                VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)
            `, [id_paciente, id_solicitud || null, idFicha, idMedicoValido, motivo, diagnostico, observaciones]);
            idVisita = nuevaVisita.insertId;
        }

        // 5. Marcar solicitud como atendida
        if (id_solicitud) {
            await db.query(`UPDATE solicitud_medica SET estado = 'atendida' WHERE id_solicitud = ?`, [id_solicitud]);
        }

        return idVisita;
    }
}

module.exports = new VisitaMedicaRepository();