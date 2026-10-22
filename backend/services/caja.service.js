// backend/services/caja.service.js
const cajaRepository = require('../repositories/caja.repository');

class CajaService {
    async obtenerResumen() {
        return await cajaRepository.obtenerResumenKpis();
    }

    async listarCargosPendientes() {
        return await cajaRepository.listarCargosPendientes();
    }

    async registrarPago(datos, idUsuario) {
        if (!datos.id_familiar || !datos.id_paciente || !datos.monto || !datos.cargos_ids || !Array.isArray(datos.cargos_ids) || datos.cargos_ids.length === 0) {
            throw { status: 400, message: 'Se requiere id_familiar, id_paciente, monto y al menos un id_cargo a liquidar.' };
        }
        return await cajaRepository.registrarPago({ ...datos, id_usuario: idUsuario });
    }

    async registrarDonacion(datos, idUsuario) {
        if (!datos.monto || datos.monto <= 0 || !datos.nombre_donante || !datos.tipo_donante) {
            throw { status: 400, message: 'Nombre de donante, tipo de donante y un monto válido son obligatorios.' };
        }

        const tiposValidos = ['empresa', 'gobierno', 'particular'];
        if (!tiposValidos.includes(datos.tipo_donante)) {
            throw { status: 400, message: 'El tipo de donante no es válido (debe ser empresa, gobierno o particular).' };
        }

        return await cajaRepository.registrarDonacion({ ...datos, id_usuario: idUsuario });
    }

    async listarDonaciones() {
        return await cajaRepository.listarDonaciones();
    }

    async registrarGasto(datos, idUsuario) {
        if (!datos.monto || datos.monto <= 0 || !datos.descripcion || !datos.categoria) {
            throw { status: 400, message: 'Categoría, descripción y un monto válido son obligatorios para registrar un gasto.' };
        }

        const categoriasValidas = ['agua', 'luz', 'telefono_internet', 'alimentos', 'limpieza', 'mantenimiento', 'otros'];
        if (!categoriasValidas.includes(datos.categoria)) {
            throw { status: 400, message: 'Categoría de gasto no válida.' };
        }

        return await cajaRepository.registrarGasto({ ...datos, id_usuario: idUsuario });
    }

    async listarGastos() {
        return await cajaRepository.listarGastos();
    }

    async registrarPagoFundacion(datos, idUsuario) {
        if (!datos.monto || datos.monto <= 0 || !datos.concepto) {
            throw { status: 400, message: 'El concepto y un monto mayor a cero son obligatorios.' };
        }
        return await cajaRepository.registrarPagoFundacion({ ...datos, id_usuario: idUsuario });
    }

    async listarPagosFundacion() {
        return await cajaRepository.listarPagosFundacion();
    }
}

module.exports = new CajaService();