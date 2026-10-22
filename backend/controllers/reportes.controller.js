const reportesRepository = require('../repositories/reportes.repository');

async function obtenerPacientes(req, res) {
    try {
        const pacientes = await reportesRepository.listarPacientesActivos();
        res.json(pacientes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener lista de pacientes.' });
    }
}

async function generarReporte(req, res) {
    try {
        const { tipo, id_paciente, fecha_inicio, fecha_fin } = req.query;

        switch (tipo) {
            case 'costos_cita':
                const costosCita = await reportesRepository.obtenerCostosPorCita(id_paciente, fecha_inicio, fecha_fin);
                return res.json({ tipo, datos: costosCita });

            case 'analisis_medico':
                if (!id_paciente) {
                    return res.status(400).json({ mensaje: 'Debe seleccionar un paciente para este reporte.' });
                }
                const analisis = await reportesRepository.obtenerAnalisisMedicoFicha(id_paciente);
                return res.json({ tipo, datos: analisis });

            case 'cobros_paciente':
                const cobros = await reportesRepository.obtenerCobrosPorPaciente(id_paciente, fecha_inicio, fecha_fin);
                return res.json({ tipo, datos: cobros });

            case 'pagos_fundacion':
                const pagosFundacion = await reportesRepository.obtenerPagosFundacion(fecha_inicio, fecha_fin);
                return res.json({ tipo, datos: pagosFundacion });

            case 'entradas_donaciones':
                const entradas = await reportesRepository.obtenerEntradasDonacionesYCobros(fecha_inicio, fecha_fin);
                return res.json({ tipo, datos: entradas });

            case 'examenes_realizados':
                const examenes = await reportesRepository.obtenerExamenesRealizados(id_paciente, fecha_inicio, fecha_fin);
                return res.json({ tipo, datos: examenes });

            case 'medicamentos_aplicados':
                const medicamentos = await reportesRepository.obtenerMedicamentosAplicados(id_paciente, fecha_inicio, fecha_fin);
                return res.json({ tipo, datos: medicamentos });

            default:
                return res.status(400).json({ mensaje: 'Tipo de reporte no válido.' });
        }
    } catch (error) {
        console.error('Error en reportes.controller:', error);
        res.status(500).json({ mensaje: 'Error interno al generar el reporte.' });
    }
}

module.exports = {
    obtenerPacientes,
    generarReporte
};