const dashboardRepository = require('../repositories/dashboard.repository');

async function obtenerKPIs(req, res) {
    try {
        const [pacientesActivos, citasHoy, consultasMes, donacionesMes] = await Promise.all([
            dashboardRepository.obtenerPacientesActivos(),
            dashboardRepository.obtenerCitasHoy(),
            dashboardRepository.obtenerConsultasMes(),
            dashboardRepository.obtenerDonacionesMes()
        ]);

        res.json({
            pacientesActivos,
            citasHoy,
            consultasMes,
            donacionesMes
        });
    } catch (error) {
        console.error('Error en dashboard.controller:', error);
        res.status(500).json({ mensaje: 'Error interno al consultar las métricas.' });
    }
}

module.exports = {
    obtenerKPIs
};