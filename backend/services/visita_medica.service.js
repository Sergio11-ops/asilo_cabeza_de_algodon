// backend/services/visita_medica.service.js
const visitaMedicaRepository = require('../repositories/visita_medica.repository');

class VisitaMedicaService {
    async listarCitasEspecialidad() {
        return await visitaMedicaRepository.listarCitasEspecialidad();
    }

    async obtenerFichaCompletaPaciente(idPaciente) {
        if (!idPaciente) throw { status: 400, message: 'ID de paciente requerido.' };
        return await visitaMedicaRepository.obtenerFichaCompletaPaciente(idPaciente);
    }

    async guardarDiagnostico(datos) {
        if (!datos.id_solicitud || !datos.diagnostico) {
            throw { status: 400, message: 'La solicitud y el diagnóstico son obligatorios.' };
        }
        return await visitaMedicaRepository.guardarDiagnostico(datos);
    }
}

module.exports = new VisitaMedicaService();