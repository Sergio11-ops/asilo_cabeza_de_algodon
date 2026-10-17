// backend/services/cita.service.js
const citaRepository = require('../repositories/cita.repository');

class CitaService {
    async listarPendientes() {
        return await citaRepository.obtenerSolicitudesPendientes();
    }

    async programarCita(datos, idUsuarioAsigna) {
        // Validación inicial sin exigir id_medico de entrada
        if (!datos.id_solicitud || !datos.fecha_hora) {
            const err = new Error('La solicitud y la fecha/hora de la cita son obligatorias.');
            err.status = 400;
            throw err;
        }

        // Si se registra un médico nuevo desde el modal
        if (datos.es_nuevo_medico && datos.nuevo_medico) {
            if (!datos.nuevo_medico.nombres || !datos.nuevo_medico.colegiado) {
                const err = new Error('Nombres y número de colegiado son requeridos para el nuevo médico.');
                err.status = 400;
                throw err;
            }

            const idMedicoNuevo = await citaRepository.crearMedicoEspecialista(
                datos.nuevo_medico,
                datos.id_solicitud
            );
            datos.id_medico = idMedicoNuevo;

        } else if (!datos.id_medico) {
            const err = new Error('Debe seleccionar un médico especialista o registrar uno nuevo.');
            err.status = 400;
            throw err;
        }

        datos.id_usuario_asigna = idUsuarioAsigna || 1;
        const idCita = await citaRepository.crearCita(datos);

        return { id_cita: idCita, id_medico: datos.id_medico, mensaje: 'Cita agendada correctamente.' };
    }

    async obtenerCitasPorDia(fechaStr) {
        const fechaInicio = `${fechaStr} 00:00:00`;
        const fechaFin = `${fechaStr} 23:59:59`;
        return await citaRepository.obtenerCitasPorFecha(fechaInicio, fechaFin);
    }
}

module.exports = new CitaService();