// backend/repositories/farmacia.repository.js
const db = require('../config/db');
const cajaRepository = require('./caja.repository');

class FarmaciaRepository {
    async obtenerCatalogoMedicamentos() {
        const [filas] = await db.query(`
            SELECT id_medicamento, nombre, descripcion, costo, stock, activo 
            FROM medicamento 
            ORDER BY nombre ASC
        `);
        return filas;
    }

    async guardarMedicamento(datos) {
        const { id_medicamento, nombre, descripcion, costo, stock } = datos;
        if (id_medicamento) {
            await db.query(`
                UPDATE medicamento 
                SET nombre = ?, descripcion = ?, costo = ?, stock = ? 
                WHERE id_medicamento = ?
            `, [nombre, descripcion, costo, stock, id_medicamento]);
            return id_medicamento;
        } else {
            const [res] = await db.query(`
                INSERT INTO medicamento (nombre, descripcion, costo, stock, activo) 
                VALUES (?, ?, ?, ?, 1)
            `, [nombre, descripcion, costo, stock]);
            return res.insertId;
        }
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
        }

        const [nuevaVisita] = await db.query(`
            INSERT INTO visita_medica (id_paciente, id_ficha, id_solicitud, id_medico, fecha_visita, observaciones, costo_consulta)
            VALUES (?, ?, NULL, ?, NOW(), 'Prescripción de Farmacia Directa', 0.00)
        `, [idPaciente, idFicha, idMedico]);

        return nuevaVisita.insertId;
    }

    async crearRecetaConDetalle(idVisita, indicacionesGenerales, items) {
        const [resReceta] = await db.query(`
            INSERT INTO receta (id_visita, fecha_receta, indicaciones_generales) 
            VALUES (?, NOW(), ?)
        `, [idVisita, indicacionesGenerales]);

        const idReceta = resReceta.insertId;

        for (const item of items) {
            await db.query(`
                INSERT INTO detalle_receta (id_receta, id_medicamento, cantidad, dosis, indicaciones, tiempo_aplicacion, precio_aplicado, entregado)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            `, [
                idReceta, 
                item.id_medicamento, 
                item.cantidad, 
                item.dosis || '', 
                item.indicaciones || '', 
                item.tiempo_aplicacion || '',
                item.precio_aplicado || 0.00
            ]);
        }

        return idReceta;
    }

    async obtenerTodasRecetas() {
        const query = `
            SELECT 
                r.id_receta,
                r.id_visita,
                r.fecha_receta,
                r.indicaciones_generales,
                rd.id_detalle,
                rd.id_medicamento,
                COALESCE(m.nombre, 'Medicamento') AS medicamento_nombre,
                COALESCE(m.stock, 0) AS stock_actual,
                COALESCE(rd.cantidad, 1) AS cantidad,
                rd.dosis,
                rd.indicaciones,
                rd.tiempo_aplicacion,
                COALESCE(rd.precio_aplicado, 0.00) AS precio_aplicado,
                COALESCE(rd.entregado, 0) AS entregado,
                rd.fecha_entrega,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(p_fm.nombres, ''), ' ', COALESCE(p_fm.apellidos, ''))), ''),
                    NULLIF(TRIM(CONCAT(COALESCE(p_sm.nombres, ''), ' ', COALESCE(p_sm.apellidos, ''))), ''),
                    'Paciente Registrado'
                ) AS paciente_nombre,
                COALESCE(p_fm.expediente, p_sm.expediente, 'S/E') AS expediente,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(u_med.nombre, ''), ' ', COALESCE(u_med.apellido, ''))), ''),
                    'Médico General'
                ) AS medico_solicitante
            FROM receta r
            INNER JOIN visita_medica vm ON r.id_visita = vm.id_visita
            LEFT JOIN ficha_medica fm ON vm.id_ficha = fm.id_ficha
            LEFT JOIN paciente p_fm ON fm.id_paciente = p_fm.id_paciente
            LEFT JOIN solicitud_medica sm ON vm.id_solicitud = sm.id_solicitud
            LEFT JOIN paciente p_sm ON sm.id_paciente = p_sm.id_paciente
            LEFT JOIN medico med ON vm.id_medico = med.id_medico
            LEFT JOIN usuario u_med ON med.id_usuario = u_med.id_usuario
            LEFT JOIN detalle_receta rd ON r.id_receta = rd.id_receta
            LEFT JOIN medicamento m ON rd.id_medicamento = m.id_medicamento
            ORDER BY r.fecha_receta DESC, rd.id_detalle ASC
        `;

        const [filas] = await db.query(query);
        const recetasMap = new Map();

        filas.forEach(f => {
            if (!recetasMap.has(f.id_receta)) {
                recetasMap.set(f.id_receta, {
                    id_receta: f.id_receta,
                    paciente_nombre: f.paciente_nombre,
                    expediente: f.expediente,
                    medico_solicitante: f.medico_solicitante,
                    fecha_receta: f.fecha_receta,
                    indicaciones_generales: f.indicaciones_generales,
                    medicamentos: []
                });
            }

            if (f.id_detalle) {
                recetasMap.get(f.id_receta).medicamentos.push({
                    id_detalle: f.id_detalle,
                    id_medicamento: f.id_medicamento,
                    medicamento_nombre: f.medicamento_nombre,
                    stock_actual: f.stock_actual,
                    cantidad: f.cantidad,
                    dosis: f.dosis,
                    indicaciones: f.indicaciones,
                    tiempo_aplicacion: f.tiempo_aplicacion,
                    precio_aplicado: parseFloat(f.precio_aplicado || 0),
                    entregado: f.entregado,
                    fecha_entrega: f.fecha_entrega
                });
            }
        });

        return Array.from(recetasMap.values());
    }

    async despacharItemsReceta(despachoItems, idUsuarioFarmacia) {
        const idFarmaciaValido = idUsuarioFarmacia || 1;

        for (const item of despachoItems) {
            if (item.entregar) {
                await db.query(`
                    UPDATE detalle_receta 
                    SET entregado = 1, 
                        fecha_entrega = NOW(), 
                        id_usuario_farmacia = ?,
                        precio_aplicado = ?
                    WHERE id_detalle = ?
                `, [idFarmaciaValido, item.precio_aplicado, item.id_detalle]);

                await db.query(`
                    UPDATE medicamento 
                    SET stock = GREATEST(0, stock - ?) 
                    WHERE id_medicamento = ?
                `, [item.cantidad, item.id_medicamento]);

                // Obtener id_visita, id_paciente y nombre para asociar id_detalle_receta al cargo
                const [[infoReceta]] = await db.query(`
                    SELECT r.id_visita, fm.id_paciente, m.nombre AS medicamento_nombre
                    FROM detalle_receta dr
                    INNER JOIN receta r ON dr.id_receta = r.id_receta
                    INNER JOIN visita_medica vm ON r.id_visita = vm.id_visita
                    INNER JOIN ficha_medica fm ON vm.id_ficha = fm.id_ficha
                    INNER JOIN medicamento m ON dr.id_medicamento = m.id_medicamento
                    WHERE dr.id_detalle = ?
                `, [item.id_detalle]);

                if (infoReceta && infoReceta.id_paciente) {
                    const montoTotal = parseFloat(item.precio_aplicado) * parseInt(item.cantidad);
                    await cajaRepository.generarCargo({
                        id_paciente: infoReceta.id_paciente,
                        concepto: 'medicamento',
                        descripcion: `Farmacia: ${infoReceta.medicamento_nombre} (Cant: ${item.cantidad})`,
                        monto_original: montoTotal,
                        id_visita: infoReceta.id_visita,
                        id_detalle_receta: item.id_detalle,
                        id_usuario: idFarmaciaValido
                    });
                }
            }
        }
        return true;
    }
}

module.exports = new FarmaciaRepository();