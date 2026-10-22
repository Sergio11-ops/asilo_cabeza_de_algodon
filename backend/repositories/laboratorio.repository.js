// backend/repositories/laboratorio.repository.js
const db = require('../config/db');
const cajaRepository = require('./caja.repository');

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

  async obtenerOCrearVisitaParaPaciente(idPaciente, idMedicoUsuario) {
        let idFicha;
        const [fichas] = await db.query(`SELECT id_ficha FROM ficha_medica WHERE id_paciente = ? LIMIT 1`, [idPaciente]);

        if (fichas.length > 0) {
            idFicha = fichas[0].id_ficha;
        } else {
            const [nuevaFicha] = await db.query(`INSERT INTO ficha_medica (id_paciente, fecha_registro) VALUES (?, CURDATE())`, [idPaciente]);
            idFicha = nuevaFicha.insertId;
        }

        // 1. REUTILIZAR VISITA: Buscar si el paciente ya tiene una visita médica creada el día de hoy
        const [visitasHoy] = await db.query(`
            SELECT id_visita FROM visita_medica 
            WHERE (id_paciente = ? OR id_ficha = ?) AND DATE(fecha_visita) = CURDATE()
            ORDER BY id_visita DESC LIMIT 1
        `, [idPaciente, idFicha]);

        if (visitasHoy.length > 0) {
            return visitasHoy[0].id_visita; // Retorna la visita de la consulta abierta hoy
        }

        // 2. SOLO si no tiene visita previa hoy, determinar el médico y crear una nueva
        let idMedico = 1;
        if (idMedicoUsuario) {
            const [medicos] = await db.query(`SELECT id_medico FROM medico WHERE id_usuario = ? LIMIT 1`, [idMedicoUsuario]);
            if (medicos.length > 0) idMedico = medicos[0].id_medico;
        } else {
            const [medicos] = await db.query(`SELECT id_medico FROM medico LIMIT 1`);
            if (medicos.length > 0) idMedico = medicos[0].id_medico;
        }

        const [nuevaVisita] = await db.query(`
            INSERT INTO visita_medica (id_paciente, id_ficha, id_solicitud, id_medico, fecha_visita, observaciones, costo_consulta)
            VALUES (?, ?, NULL, ?, NOW(), 'Orden de Laboratorio Directa', 0.00)
        `, [idPaciente, idFicha, idMedico]);

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
            await db.query(`
                UPDATE visita_examen
                SET estado = ?,
                    resultado = ?,
                    observaciones_laboratorio = ?,
                    fecha_resultado = NOW(),
                    id_laboratorista = ?
                WHERE id_visita_examen = ?
            `, [item.estado, item.resultado, item.observaciones || null, idLaboratorista, item.id_visita_examen]);

            // Si el examen fue completado, vinculamos id_visita e id_visita_examen al cargo de Caja
            if (item.estado === 'completado') {
                const [[infoExamen]] = await db.query(`
                    SELECT ve.id_visita, ve.precio_aplicado, fm.id_paciente, e.nombre AS examen_nombre
                    FROM visita_examen ve
                    INNER JOIN visita_medica vm ON ve.id_visita = vm.id_visita
                    INNER JOIN ficha_medica fm ON vm.id_ficha = fm.id_ficha
                    INNER JOIN examen e ON ve.id_examen = e.id_examen
                    WHERE ve.id_visita_examen = ?
                `, [item.id_visita_examen]);

                if (infoExamen && infoExamen.id_paciente) {
                    await cajaRepository.generarCargo({
                        id_paciente: infoExamen.id_paciente,
                        concepto: 'examen',
                        descripcion: `Laboratorio: ${infoExamen.examen_nombre}`,
                        monto_original: infoExamen.precio_aplicado,
                        id_visita: infoExamen.id_visita,
                        id_visita_examen: item.id_visita_examen,
                        id_usuario: idLaboratorista
                    });
                }
            }
        }
        return true;
    }
}

module.exports = new LaboratorioRepository();