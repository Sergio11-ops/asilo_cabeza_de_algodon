// backend/repositories/reportes.repository.js
const db = require('../config/db');

class ReportesRepository {
    // 1. Costos de cada cita por paciente
    async obtenerCostosPorCita(id_paciente, fechaInicio, fechaFin) {
        let sql = `
            SELECT 
                v.id_visita,
                v.fecha_visita,
                p.id_paciente,
                p.expediente,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente,
                COALESCE(
                    NULLIF(TRIM(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido, ''))), ''),
                    'Médico General'
                ) AS medico,
                COALESCE(v.costo_consulta, 0) AS costo_consulta,
                COALESCE((
                    SELECT SUM(COALESCE(c.monto, ve.precio_aplicado, 0)) 
                    FROM visita_examen ve 
                    LEFT JOIN cargo c ON c.id_visita_examen = ve.id_visita_examen
                    WHERE ve.id_visita = v.id_visita AND ve.estado = 'completado'
                ), 0) AS costo_examenes,
                COALESCE((
                    SELECT SUM(COALESCE(c.monto, dr.precio_aplicado * dr.cantidad, 0)) 
                    FROM receta r 
                    JOIN detalle_receta dr ON r.id_receta = dr.id_receta 
                    LEFT JOIN cargo c ON c.id_detalle_receta = dr.id_detalle
                    WHERE r.id_visita = v.id_visita AND dr.entregado = 1
                ), 0) AS costo_medicamentos
            FROM visita_medica v
            LEFT JOIN ficha_medica fm ON v.id_ficha = fm.id_ficha
            LEFT JOIN paciente p ON p.id_paciente = COALESCE(v.id_paciente, fm.id_paciente)
            LEFT JOIN medico m ON v.id_medico = m.id_medico
            LEFT JOIN usuario u ON u.id_usuario = COALESCE(m.id_usuario, v.id_medico)
            WHERE 1=1
        `;
        const params = [];

        if (id_paciente) {
            sql += ` AND (v.id_paciente = ? OR fm.id_paciente = ?)`;
            params.push(id_paciente, id_paciente);
        }
        if (fechaInicio) {
            sql += ` AND DATE(v.fecha_visita) >= ?`;
            params.push(fechaInicio);
        }
        if (fechaFin) {
            sql += ` AND DATE(v.fecha_visita) <= ?`;
            params.push(fechaFin);
        }

        sql += ` ORDER BY v.fecha_visita DESC`;
        const [rows] = await db.query(sql, params);
        return rows;
    }

    // 2. Reporte de Análisis médico y ficha por paciente
    async obtenerAnalisisMedicoFicha(id_paciente) {
        if (!id_paciente) return null;

        const [pacientes] = await db.query(`
            SELECT 
                p.id_paciente, p.expediente, p.dpi, 
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente,
                p.fecha_nacimiento, p.fecha_ingreso, p.grupo_sanguineo,
                p.direccion, p.telefono, p.cuota_mensual,
                COALESCE(f.fecha_registro, p.fecha_ingreso) AS fecha_registro, 
                COALESCE(f.padecimientos, '') AS padecimientos, 
                COALESCE(f.observaciones, '') AS motivo_recluimiento
            FROM paciente p
            LEFT JOIN ficha_medica f ON p.id_paciente = f.id_paciente
            WHERE p.id_paciente = ?
        `, [id_paciente]);

        if (!pacientes || pacientes.length === 0) return null;
        const paciente = pacientes[0];

        // Psicopatologías
        let psicopatologias = [];
        try {
            const [rows] = await db.query(`
                SELECT 
                    COALESCE(cp.nombre_condicion, cp.nombre, 'Condición clínica') AS descripcion,
                    COALESCE(pp.nivel, 'Diagnosticado') AS nivel
                FROM paciente_psicopatologia pp
                LEFT JOIN catalogo_psicopatologia cp ON pp.id_psicopatologia = cp.id_psicopatologia
                WHERE pp.id_paciente = ?
            `, [id_paciente]);
            psicopatologias = rows;
        } catch (e1) {
            try {
                const [rows] = await db.query(`
                    SELECT descripcion, nivel FROM paciente_psicopatologia WHERE id_paciente = ?
                `, [id_paciente]);
                psicopatologias = rows;
            } catch (e2) {
                psicopatologias = [];
            }
        }

        // Medicamentos frecuentes
        let medicamentosFrecuentes = [];
        try {
            const [rows] = await db.query(`
                SELECT nombre, dosis, frecuencia, via 
                FROM paciente_medicamento 
                WHERE id_paciente = ? AND (activo = 1 OR activo IS NULL)
            `, [id_paciente]);
            medicamentosFrecuentes = rows;
        } catch (e) {
            medicamentosFrecuentes = [];
        }

        // Historial de visitas
        let historialVisitas = [];
        try {
            const [rows] = await db.query(`
                SELECT 
                    v.fecha_visita, 
                    COALESCE(NULLIF(v.motivo_visita, ''), s.motivo, 'Consulta Médica') AS motivo_visita, 
                    v.diagnostico, 
                    v.observaciones,
                    COALESCE(
                        NULLIF(TRIM(CONCAT(COALESCE(u.nombre, ''), ' ', COALESCE(u.apellido, ''))), ''),
                        'Médico General'
                    ) AS medico
                FROM visita_medica v
                LEFT JOIN ficha_medica fm ON v.id_ficha = fm.id_ficha
                LEFT JOIN solicitud_medica s ON v.id_solicitud = s.id_solicitud
                LEFT JOIN medico m ON v.id_medico = m.id_medico
                LEFT JOIN usuario u ON u.id_usuario = COALESCE(m.id_usuario, v.id_medico)
                WHERE (v.id_paciente = ? OR fm.id_paciente = ?)
                ORDER BY v.fecha_visita DESC
            `, [id_paciente, id_paciente]);
            historialVisitas = rows;
        } catch (e) {
            historialVisitas = [];
        }

        return {
            paciente,
            psicopatologias,
            medicamentosFrecuentes,
            historialVisitas
        };
    }

    // 3. Reporte de cobros por paciente
    async obtenerCobrosPorPaciente(id_paciente, fechaInicio, fechaFin) {
        let sql = `
            SELECT 
                c.id_cargo, c.fecha, c.concepto, c.descripcion, c.monto, c.estado,
                p.expediente, CONCAT(p.nombres, ' ', p.apellidos) AS paciente,
                CONCAT(fam.nombres, ' ', fam.apellidos) AS familiar_responsable
            FROM cargo c
            JOIN paciente p ON c.id_paciente = p.id_paciente
            JOIN familiar fam ON c.id_familiar = fam.id_familiar
            WHERE 1=1
        `;
        const params = [];

        if (id_paciente) {
            sql += ` AND c.id_paciente = ?`;
            params.push(id_paciente);
        }
        if (fechaInicio) {
            sql += ` AND c.fecha >= ?`;
            params.push(fechaInicio);
        }
        if (fechaFin) {
            sql += ` AND c.fecha <= ?`;
            params.push(fechaFin);
        }

        sql += ` ORDER BY c.fecha DESC`;
        const [rows] = await db.query(sql, params);
        return rows;
    }

    // 4. Reporte de pagos a la fundación
    async obtenerPagosFundacion(fechaInicio, fechaFin) {
        let sql = `
            SELECT 
                pf.id_pago_fundacion, pf.fecha, pf.monto, pf.concepto,
                f.nombre AS fundacion,
                CONCAT(u.nombre, ' ', u.apellido) AS registrado_por
            FROM pago_fundacion pf
            JOIN fundacion f ON pf.id_fundacion = f.id_fundacion
            JOIN usuario u ON pf.id_usuario = u.id_usuario
            WHERE 1=1
        `;
        const params = [];

        if (fechaInicio) {
            sql += ` AND pf.fecha >= ?`;
            params.push(fechaInicio);
        }
        if (fechaFin) {
            sql += ` AND pf.fecha <= ?`;
            params.push(fechaFin);
        }

        sql += ` ORDER BY pf.fecha DESC`;
        const [rows] = await db.query(sql, params);
        return rows;
    }

    // 5. Reporte de Entradas (Donaciones y Cobros)
    async obtenerEntradasDonacionesYCobros(fechaInicio, fechaFin) {
        let sqlDonaciones = `
            SELECT 'Donación' AS tipo, d.fecha, d.monto, d.nombre_donante AS fuente, d.tipo_donante AS detalle
            FROM donacion d WHERE 1=1
        `;
        let sqlPagos = `
            SELECT 'Pago Familiar' AS tipo, p.fecha_pago AS fecha, p.monto, 
                CONCAT(pac.nombres, ' ', pac.apellidos) AS fuente, p.metodo AS detalle
            FROM pago p
            JOIN paciente pac ON p.id_paciente = pac.id_paciente
            WHERE p.estado = 'registrado'
        `;
        const paramsD = [];
        const paramsP = [];

        if (fechaInicio) {
            sqlDonaciones += ` AND d.fecha >= ?`;
            paramsD.push(fechaInicio);
            sqlPagos += ` AND p.fecha_pago >= ?`;
            paramsP.push(fechaInicio);
        }
        if (fechaFin) {
            sqlDonaciones += ` AND d.fecha <= ?`;
            paramsD.push(fechaFin);
            sqlPagos += ` AND p.fecha_pago <= ?`;
            paramsP.push(fechaFin);
        }

        const [donaciones] = await db.query(sqlDonaciones, paramsD);
        const [pagos] = await db.query(sqlPagos, paramsP);

        const entradas = [...donaciones, ...pagos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        const totalDonaciones = donaciones.reduce((sum, d) => sum + Number(d.monto), 0);
        const totalPagos = pagos.reduce((sum, p) => sum + Number(p.monto), 0);

        return {
            entradas,
            totalDonaciones,
            totalPagos,
            totalEntradas: totalDonaciones + totalPagos
        };
    }

    // 6. Reporte de exámenes médicos realizados por paciente
    async obtenerExamenesRealizados(id_paciente, fechaInicio, fechaFin) {
        let sql = `
            SELECT 
                ve.id_visita_examen, ve.fecha_resultado, e.nombre AS examen, e.categoria,
                ve.resultado, ve.observaciones_laboratorio, 
                COALESCE(c.monto, ve.precio_aplicado) AS precio_aplicado,
                p.expediente, CONCAT(p.nombres, ' ', p.apellidos) AS paciente,
                e.valores_referencia
            FROM visita_examen ve
            JOIN visita_medica v ON ve.id_visita = v.id_visita
            LEFT JOIN ficha_medica fm ON v.id_ficha = fm.id_ficha
            JOIN paciente p ON p.id_paciente = COALESCE(v.id_paciente, fm.id_paciente)
            JOIN examen e ON ve.id_examen = e.id_examen
            LEFT JOIN cargo c ON c.id_visita_examen = ve.id_visita_examen
            WHERE ve.estado = 'completado'
        `;
        const params = [];

        if (id_paciente) {
            sql += ` AND (v.id_paciente = ? OR fm.id_paciente = ?)`;
            params.push(id_paciente, id_paciente);
        }
        if (fechaInicio) {
            sql += ` AND DATE(ve.fecha_resultado) >= ?`;
            params.push(fechaInicio);
        }
        if (fechaFin) {
            sql += ` AND DATE(ve.fecha_resultado) <= ?`;
            params.push(fechaFin);
        }

        sql += ` ORDER BY ve.fecha_resultado DESC`;
        const [rows] = await db.query(sql, params);
        return rows;
    }

    // 7. Reporte de medicamentos aplicados/entregados por paciente
    async obtenerMedicamentosAplicados(id_paciente, fechaInicio, fechaFin) {
        let sql = `
            SELECT 
                dr.id_detalle, dr.fecha_entrega, m.nombre AS medicamento,
                dr.cantidad, dr.dosis, dr.indicaciones, dr.tiempo_aplicacion,
                COALESCE(c.monto / dr.cantidad, dr.precio_aplicado) AS precio_aplicado,
                COALESCE(c.monto, dr.cantidad * dr.precio_aplicado) AS total,
                p.expediente, CONCAT(p.nombres, ' ', p.apellidos) AS paciente
            FROM detalle_receta dr
            JOIN receta r ON dr.id_receta = r.id_receta
            JOIN visita_medica v ON r.id_visita = v.id_visita
            LEFT JOIN ficha_medica fm ON v.id_ficha = fm.id_ficha
            JOIN paciente p ON p.id_paciente = COALESCE(v.id_paciente, fm.id_paciente)
            JOIN medicamento m ON dr.id_medicamento = m.id_medicamento
            LEFT JOIN cargo c ON c.id_detalle_receta = dr.id_detalle
            WHERE dr.entregado = 1
        `;
        const params = [];

        if (id_paciente) {
            sql += ` AND (v.id_paciente = ? OR fm.id_paciente = ?)`;
            params.push(id_paciente, id_paciente);
        }
        if (fechaInicio) {
            sql += ` AND DATE(dr.fecha_entrega) >= ?`;
            params.push(fechaInicio);
        }
        if (fechaFin) {
            sql += ` AND DATE(dr.fecha_entrega) <= ?`;
            params.push(fechaFin);
        }

        sql += ` ORDER BY dr.fecha_entrega DESC`;
        const [rows] = await db.query(sql, params);
        return rows;
    }

    async listarPacientesActivos() {
        const [rows] = await db.query(`
            SELECT id_paciente, expediente, CONCAT(nombres, ' ', apellidos) AS nombre_completo 
            FROM paciente 
            ORDER BY apellidos, nombres
        `);
        return rows;
    }
}

module.exports = new ReportesRepository();