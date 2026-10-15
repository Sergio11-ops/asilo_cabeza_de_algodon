// backend/controllers/cita.controller.js
const citaService = require('../services/cita.service');

class CitaController {
    async pendientes(req, res) {
        try {
            const pendientes = await citaService.listarPendientes();
            res.json({ ok: true, datos: pendientes });
        } catch (error) {
            res.status(500).json({ ok: false, mensaje: error.message });
        }
    }

    async crear(req, res) {
        try {
            const idUsuario = (req.usuario && (req.usuario.id_usuario || req.usuario.id)) || 1;
            const resultado = await citaService.programarCita(req.body, idUsuario);
            res.status(201).json({ ok: true, datos: resultado });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async porFecha(req, res) {
        try {
            const { fecha } = req.query; // YYYY-MM-DD
            if (!fecha) return res.status(400).json({ ok: false, mensaje: 'Debe especificar el parámetro fecha' });

            const citas = await citaService.obtenerCitasPorDia(fecha);
            res.json({ ok: true, datos: citas });
        } catch (error) {
            res.status(500).json({ ok: false, mensaje: error.message });
        }
    }
}

module.exports = new CitaController();