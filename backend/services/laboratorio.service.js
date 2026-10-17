// backend/services/laboratorio.service.js
const laboratorioRepository = require('../repositories/laboratorio.repository');

class LaboratorioService {
    async obtenerCombos() {
        const examenes = await laboratorioRepository.obtenerCatalogoExamenes();
        const pacientes = await laboratorioRepository.obtenerPacientesActivos();
        return { examenes, pacientes };
    }

    async crearOrden(datos) {
        const idPaciente = parseInt(datos.id_paciente);
        const examenes = datos.examenes;
        const observaciones = datos.observaciones || '';

        if (!idPaciente || !examenes || !Array.isArray(examenes) || examenes.length === 0) {
            const err = new Error('Debe seleccionar un paciente y al menos un examen.');
            err.status = 400;
            throw err;
        }

        const idVisita = await laboratorioRepository.obtenerOCrearVisitaParaPaciente(idPaciente);
        await laboratorioRepository.solicitarExamenes(idVisita, examenes, observaciones);
        return { mensaje: 'Orden de laboratorio registrada exitosamente.' };
    }

    async listarSolicitudes() {
        return await laboratorioRepository.obtenerTodasSolicitudes();
    }

    async registrarResultadosOrden(datos, idUsuario) {
        const { resultados } = datos; // Array de { id_visita_examen, estado, resultado, observaciones }

        if (!resultados || !Array.isArray(resultados) || resultados.length === 0) {
            const err = new Error('No se enviaron resultados válidos.');
            err.status = 400;
            throw err;
        }

        await laboratorioRepository.guardarResultadosLote(resultados, idUsuario);
        return { mensaje: 'Resultados de la orden guardados correctamente.' };
    }
}

module.exports = new LaboratorioService();