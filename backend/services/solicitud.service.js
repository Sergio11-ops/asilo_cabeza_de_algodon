// backend/services/solicitud.service.js
const solicitudRepository = require('../repositories/solicitud.repository');

class SolicitudService {
    async listarSolicitudes(estado) {
        return await solicitudRepository.obtenerSolicitudes(estado);
    }

    async registrarSolicitud(datosSolicitud, idUsuarioSolicitante) {
        if (!datosSolicitud.id_paciente || !datosSolicitud.id_especialidad || !datosSolicitud.motivo) {
            const err = new Error('Los campos paciente, especialidad y motivo son obligatorios.');
            err.status = 400;
            throw err;
        }

        // Obtener id_medico correspondiente al usuario que hace la solicitud
        const idMedicoGeneral = await solicitudRepository.obtenerIdMedicoPorUsuario(idUsuarioSolicitante);
        
        if (!idMedicoGeneral) {
            const err = new Error('No existe un Médico General registrado en el sistema para realizar la remisión.');
            err.status = 400;
            throw err;
        }

        datosSolicitud.id_medico_general = idMedicoGeneral;

        // 1. Insertar solicitud en la base de datos
        const idInsertado = await solicitudRepository.crearSolicitud(datosSolicitud);

        // 2. Obtener nombres reales de Especialidad y Enfermero para el Correo
        try {
            const infoNotif = await solicitudRepository.obtenerDatosNotificacion(datosSolicitud.id_paciente);
            const nombreEspecialidad = await solicitudRepository.obtenerEspecialidadPorId(datosSolicitud.id_especialidad);
            const nombreEnfermero = await solicitudRepository.obtenerNombreUsuarioPorId(datosSolicitud.id_enfermero);

            if (infoNotif && infoNotif.familiar_correo) {
                const { enviarNotificacionFamiliar } = require('../utils/emailService');
                await enviarNotificacionFamiliar({
                    correoFamiliar: infoNotif.familiar_correo,
                    nombreFamiliar: infoNotif.familiar_nombre || 'Familiar',
                    nombrePaciente: infoNotif.paciente_nombre || 'Paciente',
                    especialidad: nombreEspecialidad,
                    motivo: datosSolicitud.motivo,
                    enfermeroNombre: nombreEnfermero
                });
            }
        } catch (e) {
            console.warn('⚠️ No se pudo enviar el correo de notificación:', e.message);
        }

        return { id_solicitud: idInsertado, mensaje: 'Solicitud médica registrada correctamente.' };
    }

    async cambiarEstadoSolicitud(idSolicitud, estado) {
        const actualizado = await solicitudRepository.cambiarEstado(idSolicitud, estado);
        if (!actualizado) {
            const err = new Error('No se encontró la solicitud especificada.');
            err.status = 404;
            throw err;
        }
        return { mensaje: `Estado de solicitud actualizado a '${estado}'.` };
    }

    async obtenerCombos() {
        const [especialidades, enfermeros, medicos] = await Promise.all([
            solicitudRepository.obtenerEspecialidades(),
            solicitudRepository.obtenerEnfermeros(),
            solicitudRepository.obtenerMedicosEspecialistas()
        ]);
        return { especialidades, enfermeros, medicos };
    }
}

module.exports = new SolicitudService();