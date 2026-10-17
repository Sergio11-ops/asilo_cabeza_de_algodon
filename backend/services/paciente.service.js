// backend/services/paciente.service.js
const pacienteRepository = require('../repositories/paciente.repository');

class PacienteService {
    async listarPacientes() {
        return await pacienteRepository.obtenerTodos();
    }

    async obtenerCatalogos() {
        return await pacienteRepository.obtenerCatalogos();
    }

    async obtenerPacientePorId(id) {
        const paciente = await pacienteRepository.obtenerPorId(id);
        if (!paciente) {
            const error = new Error('El paciente especificado no existe.');
            error.status = 404;
            throw error;
        }
        return paciente;
    }

    async registrarPaciente(payload) {
        const { paciente, familiar, ficha_medica } = payload;

        if (!paciente || !paciente.dpi || !paciente.nombres || !paciente.apellidos || !paciente.fecha_nacimiento || !paciente.fecha_ingreso) {
            const error = new Error('Los campos DPI, nombres, apellidos, fecha de nacimiento y fecha de ingreso son obligatorios.');
            error.status = 400;
            throw error;
        }

        // Validación de formato DPI (13 dígitos) según restricción ck_paciente_dpi
        const dpiRegex = /^[0-9]{13}$/;
        if (!dpiRegex.test(paciente.dpi)) {
            const error = new Error('El DPI del paciente debe contener exactamente 13 dígitos numéricos.');
            error.status = 400;
            throw error;
        }

        if (familiar && familiar.dpi && !dpiRegex.test(familiar.dpi)) {
            const error = new Error('El DPI del familiar responsable debe contener exactamente 13 dígitos numéricos.');
            error.status = 400;
            throw error;
        }

        // Verificar que no exista un paciente con el mismo DPI
        const existeDpi = await pacienteRepository.obtenerPorDpi(paciente.dpi);
        if (existeDpi) {
            const error = new Error(`Ya existe un paciente registrado con el DPI ${paciente.dpi}.`);
            error.status = 409;
            throw error;
        }

        const resultado = await pacienteRepository.crearPacienteConRelaciones(paciente, familiar, ficha_medica);
        return {
            id_paciente: resultado.id_paciente,
            expediente: resultado.expediente,
            mensaje: `Paciente registrado exitosamente con el expediente ${resultado.expediente}.`
        };
    }

    async actualizarPaciente(id, payload) {
        const { paciente, familiar, ficha_medica } = payload;
        await this.obtenerPacientePorId(id);

        if (!paciente || !paciente.nombres || !paciente.apellidos) {
            const error = new Error('Los campos nombres y apellidos del paciente son obligatorios.');
            error.status = 400;
            throw error;
        }

        // La ficha médica es opcional: si no viene en el payload, no se toca.
        if (ficha_medica !== undefined && ficha_medica !== null) {
            const { psicopatologias, medicamentos_cajon } = ficha_medica;
            const psicoInvalida = psicopatologias !== undefined && !Array.isArray(psicopatologias);
            const medsInvalidos = medicamentos_cajon !== undefined && !Array.isArray(medicamentos_cajon);
            if (psicoInvalida || medsInvalidos) {
                const error = new Error('La ficha médica tiene un formato no válido.');
                error.status = 400;
                throw error;
            }
        }

        const actualizado = await pacienteRepository.actualizarPacienteYFamiliar(id, paciente, familiar, ficha_medica);
        if (!actualizado) {
            throw new Error('No se pudo actualizar la información del paciente.');
        }
        return { mensaje: 'Ficha del paciente y familiar actualizados correctamente.' };
    }

    async desactivarPaciente(id) {
        await this.obtenerPacientePorId(id);
        await pacienteRepository.cambiarEstado(id, 0); // Baja lógica
        return { mensaje: 'Paciente desactivado correctamente.' };
    }
}

module.exports = new PacienteService();