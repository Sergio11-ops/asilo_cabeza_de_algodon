// backend/services/cita.service.js
const citaRepository = require('../repositories/cita.repository');

class CitaService {
    async listarPendientes() {
        return await citaRepository.obtenerSolicitudesPendientes();
    }

    async programarCita(datos, idUsuarioAsigna) {
        if (!datos.id_solicitud || !datos.fecha_hora || !datos.id_medico) {
            const err = new Error('La solicitud, la fecha/hora y el médico especialista son obligatorios.');
            err.status = 400;
            throw err;
        }

        datos.id_usuario_asigna = idUsuarioAsigna || 1;
        const idCita = await citaRepository.crearCita(datos);

        return { id_cita: idCita, mensaje: 'Cita agendada correctamente.' };
    }

    async obtenerCitasPorDia(fechaStr) {
        // Formato esperado YYYY-MM-DD
        const fechaInicio = `${fechaStr} 00:00:00`;
        const fechaFin = `${fechaStr} 23:59:59`;
        return await citaRepository.obtenerCitasPorFecha(fechaInicio, fechaFin);
    }
}

module.exports = new CitaService();