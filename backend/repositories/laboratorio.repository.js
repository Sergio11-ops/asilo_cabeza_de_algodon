// backend/repositories/laboratorio.repository.js
const db = require('../config/db');

class LaboratorioRepository {
    async obtenerCatalogoExamenes() {
        const [filas] = await db.query(`
            SELECT id_examen, nombre, precio, categoria, COALESCE(valores_referencia, 'Según criterio médico') AS valores_referencia 
            FROM examen 
            WHERE activo = 1 
            ORDER BY categoria ASC, nombre ASC
        `);
        return filas;
    }

    async obtenerPacientesActivos() {
        const query = `
            SELECT id_paciente, CONCAT(nombres, ' ', apellidos) AS paciente_nombre, expediente
            FROM paciente
            ORDER BY nombres ASC
        `;
        const [filas] = await db.query(query);
        return filas;
    }

    async obtenerOCrearVisitaParaPaciente(idPaciente) {
        // 1. Obtener o crear la Ficha Médica (expediente) del paciente
        let idFicha;
        const [fichas] = await db.query(`SELECT id_ficha FROM ficha_medica WHERE id_paciente = ? LIMIT 1`, [idPaciente]);

        if (fichas.length > 0) {
            idFicha = fichas[0].id_ficha;
        } else {
            const [nuevaFicha] = await db.query(`INSERT INTO ficha_medica (id_paciente, fecha_creacion) VALUES (?, NOW())`, [idPaciente]);
            idFicha = nuevaFicha.insertId;
        }

        // 2. Obtener un médico asignado por defecto
        const [medicos] = await db.query(`SELECT id_medico FROM medico LIMIT 1`);
        const idMedico = medicos.length > 0 ? medicos[0].id_medico : 1;

        // 3. Crear la visita médica vinculada ÚNICAMENTE a la ficha del paciente (id_solicitud = NULL)
        const [nuevaVisita] = await db.query(`
            INSERT INTO visita_medica (id_ficha, id_solicitud, id_medico, fecha_visita, observaciones)
            VALUES (?, NULL, ?, NOW(), 'Orden de Laboratorio Directa')
        `, [idFicha, idMedico]);

        return nuevaVisita.insertId;
    }

    async solicitarExamenes(idVisita, examenes, observacionesMedico = '') {
        const values = examenes.map(e => [
            idVisita, 
            e.id_examen, 
            'solicitado', 
            e.precio || 0.00,
            observacionesMedico
        ]);

        const query = `
            INSERT INTO visita_examen (id_visita, id_examen, estado, precio_aplicado, observaciones_medico)
            VALUES ?
            ON DUPLICATE KEY UPDATE 
                precio_aplicado = VALUES(precio_aplicado),
                observaciones_medico = VALUES(observaciones_medico)
        `;
        const [res] = await db.query(query, [values]);
        return res;
    }

    async obtenerTodasSolicitudes() {
        const query = `
            SELECT 
                ve.id_visita_examen,
                ve.id_visita,
                ve.id_examen,
                e.nombre AS examen_nombre,
                COALESCE(e.valores_referencia, 'Según criterio médico') AS valores_referencia,
                ve.precio_aplicado,
                ve.estado,
                ve.resultado,
                ve.observaciones_medico,
                ve.observaciones_laboratorio,
                ve.fecha_resultado,
                vm.fecha_visita,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente_nombre,
                p.expediente,
                COALESCE(CONCAT(u_med.nombre, ' ', u_med.apellido), 'Médico General') AS medico_solicitante
            FROM visita_examen ve
            INNER JOIN examen e ON ve.id_examen = e.id_examen
            INNER JOIN visita_medica vm ON ve.id_visita = vm.id_visita
            INNER JOIN ficha_medica fm ON vm.id_ficha = fm.id_ficha
            INNER JOIN paciente p ON fm.id_paciente = p.id_paciente
            LEFT JOIN medico m ON vm.id_medico = m.id_medico
            LEFT JOIN usuario u_med ON m.id_usuario = u_med.id_usuario
            ORDER BY vm.fecha_visita DESC, ve.id_visita_examen DESC
        `;
        const [filas] = await db.query(query);

        // Agrupar filas por id_visita
        const ordenesMap = new Map();

        filas.forEach(f => {
            if (!ordenesMap.has(f.id_visita)) {
                ordenesMap.set(f.id_visita, {
                    id_visita: f.id_visita,
                    paciente_nombre: f.paciente_nombre,
                    expediente: f.expediente,
                    medico_solicitante: f.medico_solicitante,
                    fecha_visita: f.fecha_visita,
                    observaciones_medico: f.observaciones_medico,
                    examenes: []
                });
            }

            ordenesMap.get(f.id_visita).examenes.push({
                id_visita_examen: f.id_visita_examen,
                id_examen: f.id_examen,
                examen_nombre: f.examen_nombre,
                valores_referencia: f.valores_referencia,
                precio_aplicado: parseFloat(f.precio_aplicado),
                estado: f.estado,
                resultado: f.resultado,
                observaciones_laboratorio: f.observaciones_laboratorio
            });
        });

        return Array.from(ordenesMap.values());
    }

    async guardarResultadosLote(resultadosList, idLaboratorista) {
        for (const item of resultadosList) {
            const query = `
                UPDATE visita_examen
                SET estado = ?,
                    resultado = ?,
                    observaciones_laboratorio = ?,
                    fecha_resultado = NOW(),
                    id_laboratorista = ?
                WHERE id_visita_examen = ?
            `;
            await db.query(query, [item.estado, item.resultado, item.observaciones || null, idLaboratorista, item.id_visita_examen]);
        }
        return true;
    }
}

module.exports = new LaboratorioRepository();