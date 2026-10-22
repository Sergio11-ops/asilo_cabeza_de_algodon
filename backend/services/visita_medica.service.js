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
        // Unifica la detección del ID desde id_visita, id_solicitud o id
        const idVisita = datos.id_visita || datos.id_solicitud || datos.idVisita || datos.id;
        const diagnostico = datos.diagnostico ? datos.diagnostico.trim() : '';

        if (!idVisita || !diagnostico) {
            throw { 
                status: 400, 
                message: 'El identificador de la visita/solicitud y el diagnóstico son obligatorios.' 
            };
        }

        return await visitaMedicaRepository.guardarDiagnostico({
            ...datos,
            id_visita: parseInt(idVisita)
        });
    }
}

module.exports = new VisitaMedicaService();