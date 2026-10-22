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
            const idVisita = req.params.id || req.body.id_visita || req.body.id_solicitud || req.body.idVisita;
            const idUsuario = req.usuario?.id_usuario || req.usuario?.id || 1;

            await visitaMedicaService.guardarDiagnostico({
                id_visita: idVisita,
                diagnostico: req.body.diagnostico,
                observaciones: req.body.observaciones,
                costo_consulta: req.body.costo_consulta,
                id_usuario: idUsuario
            });

            res.json({ ok: true, mensaje: 'Diagnóstico guardado correctamente.' });
        } catch (error) {
            res.status(error.status || 500).json({ 
                ok: false, 
                mensaje: error.message || 'Error interno al guardar el diagnóstico.' 
            });
        }
    }
}

module.exports = new VisitaMedicaController();