// backend/controllers/solicitud.controller.js
const solicitudService = require('../services/solicitud.service');

class SolicitudController {
    async listar(req, res, next) {
        try {
            const { estado } = req.query;
            const solicitudes = await solicitudService.listarSolicitudes(estado);
            res.json({ ok: true, datos: solicitudes });
        } catch (error) {
            next(error);
        }
    }

    async crear(req, res, next) {
        try {
            const idUsuario = req.usuario ? req.usuario.id_usuario : 1;
            const resultado = await solicitudService.registrarSolicitud(req.body, idUsuario);
            res.status(201).json({ ok: true, datos: resultado });
        } catch (error) {
            next(error);
        }
    }

    async cambiarEstado(req, res, next) {
        try {
            const { id } = req.params;
            const { estado } = req.body;
            const resultado = await solicitudService.cambiarEstadoSolicitud(id, estado);
            res.json({ ok: true, datos: resultado });
        } catch (error) {
            next(error);
        }
    }

    async combos(req, res, next) {
        try {
            const resultado = await solicitudService.obtenerCombos();
            res.json({ ok: true, datos: resultado });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SolicitudController();