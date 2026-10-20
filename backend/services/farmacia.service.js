// backend/services/farmacia.service.js
const farmaciaRepository = require('../repositories/farmacia.repository');

class FarmaciaService {
    async obtenerCombos() {
        const medicamentos = await farmaciaRepository.obtenerCatalogoMedicamentos();
        const [pacientes] = await require('../config/db').query(`
            SELECT id_paciente, CONCAT(nombres, ' ', apellidos) AS paciente_nombre, expediente 
            FROM paciente 
            ORDER BY nombres ASC
        `);
        return { medicamentos, pacientes };
    }

    async guardarMedicamento(datos) {
        return await farmaciaRepository.guardarMedicamento(datos);
    }

    async prescribirReceta(datos, idUsuarioMedico) {
        const { id_paciente, indicaciones_generales, medicamentos } = datos;
        if (!id_paciente || !medicamentos || medicamentos.length === 0) {
            throw { status: 400, message: 'Debe seleccionar un paciente y al menos un medicamento.' };
        }

        const idVisita = await farmaciaRepository.obtenerOCrearVisitaParaPaciente(id_paciente, idUsuarioMedico);
        return await farmaciaRepository.crearRecetaConDetalle(idVisita, indicaciones_generales || '', medicamentos);
    }

    async listarRecetas() {
        return await farmaciaRepository.obtenerTodasRecetas();
    }

    async despacharReceta(datos, idUsuarioFarmacia) {
        const { items } = datos;
        if (!items || items.length === 0) {
            throw { status: 400, message: 'No se enviaron ítems para despacho.' };
        }
        return await farmaciaRepository.despacharItemsReceta(items, idUsuarioFarmacia);
    }
}

module.exports = new FarmaciaService();