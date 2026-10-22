// backend/controllers/caja.controller.js
const cajaService = require('../services/caja.service');
const cajaRepository = require('../repositories/caja.repository');

class CajaController {
    async obtenerResumen(req, res) {
        try {
            const datos = await cajaService.obtenerResumen();
            res.json({ ok: true, datos });
        } catch (error) {
            console.error('Error al obtener resumen financiero:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al obtener resumen de caja.' });
        }
    }

    async obtenerResumenFundacion(req, res) {
        try {
            const datos = await cajaRepository.obtenerResumenPendienteFundacion();
            res.json({ ok: true, datos, data: datos });
        } catch (error) {
            console.error('Error al obtener resumen de fundación:', error);
            res.status(500).json({ ok: false, mensaje: error.message || 'Error al obtener resumen de la fundación.' });
        }
    }

    async listarCargosPendientes(req, res) {
        try {
            const datos = await cajaService.listarCargosPendientes();
            res.json({ ok: true, datos });
        } catch (error) {
            console.error('Error al listar cargos pendientes:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al listar cuentas por cobrar.' });
        }
    }

    async registrarPago(req, res) {
        try {
            const idUsuario = req.usuario?.id_usuario || req.usuario?.id || 1;
            const idPago = await cajaService.registrarPago(req.body, idUsuario);
            res.status(201).json({ ok: true, id_pago: idPago, mensaje: 'Cobro registrado exitosamente.' });
        } catch (error) {
            console.error('Error al procesar pago:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al procesar el pago.' });
        }
    }

    async registrarDonacion(req, res) {
        try {
            const idUsuario = req.usuario?.id_usuario || req.usuario?.id || 1;
            const idDonacion = await cajaService.registrarDonacion(req.body, idUsuario);
            res.status(201).json({ ok: true, id_donacion: idDonacion, mensaje: 'Donación registrada correctamente.' });
        } catch (error) {
            console.error('Error al registrar donación:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al guardar la donación.' });
        }
    }

    async listarDonaciones(req, res) {
        try {
            const datos = await cajaService.listarDonaciones();
            res.json({ ok: true, datos });
        } catch (error) {
            console.error('Error al listar donaciones:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al consultar historial de donaciones.' });
        }
    }

    async registrarGasto(req, res) {
        try {
            const idUsuario = req.usuario?.id_usuario || req.usuario?.id || 1;
            const idGasto = await cajaService.registrarGasto(req.body, idUsuario);
            res.status(201).json({ ok: true, id_gasto: idGasto, mensaje: 'Gasto operativo registrado correctamente.' });
        } catch (error) {
            console.error('Error al registrar gasto:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al guardar gasto operativo.' });
        }
    }

    async listarGastos(req, res) {
        try {
            const datos = await cajaService.listarGastos();
            res.json({ ok: true, datos });
        } catch (error) {
            console.error('Error al listar gastos:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al consultar gastos operativos.' });
        }
    }

    async registrarPagoFundacion(req, res) {
        try {
            const idUsuario = req.usuario?.id_usuario || req.usuario?.id || 1;
            const idPagoFundacion = await cajaService.registrarPagoFundacion(req.body, idUsuario);
            res.status(201).json({ ok: true, id_pago_fundacion: idPagoFundacion, mensaje: 'Pago a la fundación registrado correctamente.' });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al guardar el pago a la fundación.' });
        }
    }

    async listarPagosFundacion(req, res) {
        try {
            const datos = await cajaService.listarPagosFundacion();
            res.json({ ok: true, datos });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al consultar pagos a la fundación.' });
        }
    }

    async generarCuotasMensuales(req, res) {
        try {
            const fechaActual = new Date();
            const mes = req.body.mes || (fechaActual.getMonth() + 1);
            const anio = req.body.anio || fechaActual.getFullYear();
            const idUsuario = req.usuario?.id_usuario || req.usuario?.id || 1;

            await cajaRepository.generarCuotasMensuales(mes, anio, idUsuario);
            
            res.json({ 
                ok: true, 
                mensaje: `Cuotas mensuales de ${mes}/${anio} generadas exitosamente.` 
            });
        } catch (error) {
            res.status(500).json({ ok: false, mensaje: error.message });
        }
    }
}

module.exports = new CajaController();