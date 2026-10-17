// backend/controllers/laboratorio.controller.js
const laboratorioService = require('../services/laboratorio.service');

class LaboratorioController {
    async obtenerCombos(req, res) {
        try {
            const datos = await laboratorioService.obtenerCombos();
            res.json({ ok: true, datos });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async crearOrden(req, res) {
        try {
            const resultado = await laboratorioService.crearOrden(req.body);
            res.status(201).json({ ok: true, datos: resultado });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async listarSolicitudes(req, res) {
        try {
            const datos = await laboratorioService.listarSolicitudes();
            res.json({ ok: true, datos });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async guardarResultado(req, res) {
        try {
            const idUsuario = req.usuario?.id_usuario;
            const resultado = await laboratorioService.registrarResultadosOrden(req.body, idUsuario);
            res.json({ ok: true, datos: resultado });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }
}

module.exports = new LaboratorioController();