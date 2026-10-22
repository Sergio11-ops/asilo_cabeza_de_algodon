// backend/repositories/caja.repository.js
const db = require('../config/db');

class CajaRepository {

    // 1. Obtener KPIs generales de Caja del mes actual (incluyendo Pagos a Fundación)
    async obtenerResumenKpis() {
        // Donaciones recibidas en el mes
        const [[donaciones]] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_donaciones 
            FROM donacion 
            WHERE MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())
        `);

        // Cuentas por cobrar pendientes (totales acumulados)
        const [[pendientes]] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_pendiente 
            FROM cargo 
            WHERE estado = 'pendiente'
        `);

        // Gastos operativos internos del asilo (luz, agua, etc.) en el mes
        const [[gastosOperativos]] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_gastos 
            FROM gasto 
            WHERE MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())
        `);

        // Liquidaciones / Pagos transferidos a la Fundación en el mes
        const [[pagosFundacion]] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_fundacion 
            FROM pago_fundacion 
            WHERE MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())
        `);

        // Ingresos cobrados en el mes (Cobros reales a familiares)
        const [[ingresos]] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_cobrado 
            FROM pago 
            WHERE estado = 'registrado' AND MONTH(fecha_pago) = MONTH(CURDATE()) AND YEAR(fecha_pago) = YEAR(CURDATE())
        `);

        const totalDonaciones = parseFloat(donaciones.total_donaciones);
        const totalIngresos = parseFloat(ingresos.total_cobrado);
        const totalGastosOperativos = parseFloat(gastosOperativos.total_gastos);
        const totalPagosFundacion = parseFloat(pagosFundacion.total_fundacion);

        // Gastos Totales del Mes = Gastos Operativos + Liquidaciones a Fundación
        const totalEgresosMes = totalGastosOperativos + totalPagosFundacion;

        return {
            donaciones_mes: totalDonaciones,
            cobros_pendientes: parseFloat(pendientes.total_pendiente),
            gastos_mes: totalEgresosMes,
            ingresos_cobrados_mes: totalIngresos
        };
    }

   // Obtener Desglose por Servicio para Liquidar a la Fundación
    async obtenerResumenPendienteFundacion() {
        const [filas] = await db.query(`
            SELECT 
                SUM(CASE WHEN concepto = 'consulta' THEN monto ELSE 0 END) AS consultas,
                SUM(CASE WHEN concepto = 'examen' THEN monto ELSE 0 END) AS examenes,
                SUM(CASE WHEN concepto = 'medicamento' THEN monto ELSE 0 END) AS farmacia,
                SUM(monto) AS total_generado
            FROM cargo
            WHERE estado IN ('pagado', 'cobrado') AND concepto IN ('consulta', 'examen', 'medicamento')
        `);

        const [[liquidaciones]] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) AS total_liquidado 
            FROM pago_fundacion
        `);

        const consultas = parseFloat(filas[0]?.consultas || 0);
        const examenes = parseFloat(filas[0]?.examenes || 0);
        const farmacia = parseFloat(filas[0]?.farmacia || 0);
        const totalGenerado = parseFloat(filas[0]?.total_generado || 0);
        const totalLiquidado = parseFloat(liquidaciones.total_liquidado || 0);

        const saldoPendiente = Math.max(0, totalGenerado - totalLiquidado);

        return {
            consultas,
            examenes,
            farmacia,
            totalGenerado,
            totalLiquidado,
            saldoPendiente
        };
    }

    // 3. Generar cargo automático respetando donaciones existentes
    async generarCargo({ id_paciente, concepto, descripcion, monto_original, id_visita, id_visita_examen, id_detalle_receta, id_usuario }) {
        const [pf] = await db.query(`
            SELECT id_familiar FROM paciente_familiar 
            WHERE id_paciente = ? AND es_contacto_principal = 1 
            LIMIT 1
        `, [id_paciente]);

        let idFamiliar = pf.length > 0 ? pf[0].id_familiar : null;
        if (!idFamiliar) {
            const [fam] = await db.query(`SELECT id_familiar FROM paciente_familiar WHERE id_paciente = ? LIMIT 1`, [id_paciente]);
            idFamiliar = fam.length > 0 ? fam[0].id_familiar : null;
        }

        const [[donacionesTotal]] = await db.query(`SELECT COALESCE(SUM(monto), 0) AS total FROM donacion`);
        const tieneDonaciones = parseFloat(donacionesTotal.total) > 0;

        let descuentoPorcentaje = 0;
        if (tieneDonaciones) {
            const [fund] = await db.query(`SELECT descuento_consulta, descuento_laboratorio, descuento_farmacia FROM fundacion WHERE activa = 1 LIMIT 1`);
            if (fund.length > 0) {
                if (concepto === 'consulta') descuentoPorcentaje = parseFloat(fund[0].descuento_consulta || 0);
                else if (concepto === 'examen') descuentoPorcentaje = parseFloat(fund[0].descuento_laboratorio || 0);
                else if (concepto === 'medicamento') descuentoPorcentaje = parseFloat(fund[0].descuento_farmacia || 0);
            }
        }

        const montoFinal = Math.max(0, parseFloat(monto_original) * (1 - (descuentoPorcentaje / 100)));
        const descTexto = descuentoPorcentaje > 0 ? `(Desc. Fundación: ${descuentoPorcentaje}%)` : '(Sin Desc. Donación)';

        const [res] = await db.query(`
            INSERT INTO cargo (id_paciente, id_familiar, concepto, descripcion, monto, fecha, estado, id_visita, id_visita_examen, id_detalle_receta, id_usuario)
            VALUES (?, ?, ?, ?, ?, CURDATE(), 'pendiente', ?, ?, ?, ?)
        `, [
            id_paciente, 
            idFamiliar, 
            concepto, 
            `${descripcion} ${descTexto}`.trim(), 
            montoFinal, 
            id_visita || null, 
            id_visita_examen || null, 
            id_detalle_receta || null, 
            id_usuario || 1
        ]);

        return res.insertId;
    }

    // 4. Listar cuentas pendientes por cobrar
    async listarCargosPendientes() {
        const query = `
            SELECT 
                c.id_cargo,
                c.id_paciente,
                CONCAT(p.nombres, ' ', p.apellidos) AS paciente_nombre,
                p.expediente,
                c.id_familiar,
                COALESCE(CONCAT(f.nombres, ' ', f.apellidos), 'Familiar No Asignado') AS familiar_nombre,
                COALESCE(f.telefono, 'Sin teléfono') AS familiar_telefono,
                c.concepto,
                c.descripcion,
                c.monto,
                c.fecha,
                c.estado
            FROM cargo c
            INNER JOIN paciente p ON c.id_paciente = p.id_paciente
            LEFT JOIN familiar f ON c.id_familiar = f.id_familiar
            WHERE c.estado = 'pendiente'
            ORDER BY c.fecha DESC
        `;
        const [filas] = await db.query(query);
        return filas;
    }

    // 5. Registrar pago de familiar
    async registrarPago({ id_familiar, id_paciente, monto, metodo, referencia, cargos_ids, id_usuario }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [resPago] = await connection.query(`
                INSERT INTO pago (id_familiar, id_paciente, fecha_pago, monto, metodo, referencia, estado, id_usuario)
                VALUES (?, ?, CURDATE(), ?, ?, ?, 'registrado', ?)
            `, [id_familiar, id_paciente, monto, metodo || 'efectivo', referencia || null, id_usuario || 1]);

            const idPago = resPago.insertId;
            let saldoRestante = parseFloat(monto);

            for (const idCargo of cargos_ids) {
                const [[cargo]] = await connection.query(`SELECT id_cargo, monto FROM cargo WHERE id_cargo = ? AND estado = 'pendiente'`, [idCargo]);
                if (cargo) {
                    const montoCargo = parseFloat(cargo.monto);
                    const aplicado = Math.min(saldoRestante, montoCargo);

                    await connection.query(`
                        INSERT INTO pago_cargo (id_pago, id_cargo, monto_aplicado)
                        VALUES (?, ?, ?)
                    `, [idPago, idCargo, aplicado]);

                    await connection.query(`UPDATE cargo SET estado = 'pagado' WHERE id_cargo = ?`, [idCargo]);
                    saldoRestante -= aplicado;
                }
            }

            await connection.commit();
            return idPago;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // 6. DONACIONES
    async registrarDonacion({ fecha, monto, tipo_donante, nombre_donante, id_usuario }) {
        const [res] = await db.query(`
            INSERT INTO donacion (fecha, monto, tipo_donante, nombre_donante, id_usuario)
            VALUES (?, ?, ?, ?, ?)
        `, [fecha || new Date(), monto, tipo_donante, nombre_donante, id_usuario || 1]);
        return res.insertId;
    }

    async listarDonaciones() {
        const [filas] = await db.query(`
            SELECT d.id_donacion, d.fecha, d.monto, d.tipo_donante, d.nombre_donante, CONCAT(u.nombre, ' ', u.apellido) AS registrado_por
            FROM donacion d
            INNER JOIN usuario u ON d.id_usuario = u.id_usuario
            ORDER BY d.fecha DESC
        `);
        return filas;
    }

    // 7. GASTOS
    async registrarGasto({ fecha, categoria, descripcion, monto, id_usuario }) {
        const [res] = await db.query(`
            INSERT INTO gasto (fecha, categoria, descripcion, monto, id_usuario)
            VALUES (?, ?, ?, ?, ?)
        `, [fecha || new Date(), categoria, descripcion, monto, id_usuario || 1]);
        return res.insertId;
    }

    async listarGastos() {
        const [filas] = await db.query(`
            SELECT g.id_gasto, g.fecha, g.categoria, g.descripcion, g.monto, CONCAT(u.nombre, ' ', u.apellido) AS registrado_por
            FROM gasto g
            INNER JOIN usuario u ON g.id_usuario = u.id_usuario
            ORDER BY g.fecha DESC
        `);
        return filas;
    }

    // 8. PAGOS A LA FUNDACIÓN
    async registrarPagoFundacion({ fecha, monto, concepto, id_usuario }) {
        const [fund] = await db.query(`SELECT id_fundacion FROM fundacion LIMIT 1`);
        const idFundacion = fund.length > 0 ? fund[0].id_fundacion : 1;

        const [res] = await db.query(`
            INSERT INTO pago_fundacion (id_fundacion, fecha, monto, concepto, id_usuario)
            VALUES (?, ?, ?, ?, ?)
        `, [idFundacion, fecha || new Date(), monto, concepto, id_usuario || 1]);
        return res.insertId;
    }

    async listarPagosFundacion() {
        const [filas] = await db.query(`
            SELECT pf.id_pago_fundacion, pf.fecha, pf.monto, pf.concepto, f.nombre AS fundacion_nombre, CONCAT(u.nombre, ' ', u.apellido) AS registrado_por
            FROM pago_fundacion pf
            INNER JOIN fundacion f ON pf.id_fundacion = f.id_fundacion
            INNER JOIN usuario u ON pf.id_usuario = u.id_usuario
            ORDER BY pf.fecha DESC
        `);
        return filas;
    }

    // 9. Generar cuota mensual para todos los residentes con cuota configurada
    async generarCuotasMensuales(mes, anio, id_usuario) {
        const [pacientes] = await db.query(`
            SELECT id_paciente, cuota_mensual 
            FROM paciente 
            WHERE cuota_mensual > 0
        `);

        for (const p of pacientes) {
            const [pf] = await db.query(`
                SELECT id_familiar FROM paciente_familiar 
                WHERE id_paciente = ? AND es_contacto_principal = 1 
                LIMIT 1
            `, [p.id_paciente]);

            let idFamiliar = pf.length > 0 ? pf[0].id_familiar : null;
            if (!idFamiliar) {
                const [fam] = await db.query(`
                    SELECT id_familiar FROM paciente_familiar 
                    WHERE id_paciente = ? LIMIT 1
                `, [p.id_paciente]);
                idFamiliar = fam.length > 0 ? fam[0].id_familiar : null;
            }

            const descripcion = `Cuota Mensual Hospedaje - ${mes}/${anio}`;

            const [existe] = await db.query(`
                SELECT id_cargo FROM cargo 
                WHERE id_paciente = ? AND concepto = 'cuota_mensual' AND descripcion = ?
            `, [p.id_paciente, descripcion]);

            if (existe.length === 0) {
                await db.query(`
                    INSERT INTO cargo (id_paciente, id_familiar, concepto, descripcion, monto, fecha, estado, id_usuario)
                    VALUES (?, ?, 'cuota_mensual', ?, ?, CURDATE(), 'pendiente', ?)
                `, [p.id_paciente, idFamiliar, descripcion, p.cuota_mensual, id_usuario || 1]);
            }
        }
        return true;
    }
}

module.exports = new CajaRepository();