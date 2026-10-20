// backend/controllers/visita_medica.controller.js
const visitaMedicaService = require('../services/visita_medica.service');

class VisitaMedicaController {
    async listarCitas(req, res) {
        try {
            const datos = await visitaMedicaService.listarCitasEspecialidad();
            res.json({ ok: true, datos });
        } catch (error) {
            console.error('Error interno en listarCitas:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al consultar citas en la base de datos.' });
        }
    }

    async obtenerFicha(req, res) {
        try {
            const idPaciente = parseInt(req.params.idPaciente);
            const datos = await visitaMedicaService.obtenerFichaCompletaPaciente(idPaciente);
            res.json({ ok: true, datos });
        } catch (error) {
            console.error('Error interno en obtenerFicha:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async guardarDiagnostico(req, res) {
        try {
            const idVisita = await visitaMedicaService.guardarDiagnostico(req.body);
            res.json({ ok: true, id_visita: idVisita, mensaje: 'Diagnóstico registrado con éxito.' });
        } catch (error) {
            console.error('Error interno en guardarDiagnostico:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }
}

module.exports = new VisitaMedicaController();