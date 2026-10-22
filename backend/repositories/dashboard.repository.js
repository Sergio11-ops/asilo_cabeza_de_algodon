const db = require('../config/db');

class DashboardRepository {
    async obtenerPacientesActivos() {
        try {
            // Cuenta los pacientes activos
            const [rows] = await db.query(`
                SELECT COUNT(*) AS total 
                FROM paciente 
                WHERE LOWER(COALESCE(estado, 'activo')) = 'activo' OR activo = 1
            `);
            return rows[0]?.total || 0;
        } catch (error) {
            // Fallback si la tabla paciente no usa 'estado' o 'activo'
            try {
                const [rows] = await db.query(`SELECT COUNT(*) AS total FROM paciente`);
                return rows[0]?.total || 0;
            } catch (err) {
                return 0;
            }
        }
    }

    async obtenerCitasHoy() {
        try {
            const [rows] = await db.query(`
                SELECT COUNT(*) AS total 
                FROM solicitud_medica 
                WHERE DATE(fecha_solicitud) = CURDATE()
            `);
            return rows[0]?.total || 0;
        } catch (error) {
            return 0;
        }
    }

    async obtenerConsultasMes() {
        try {
            const [rows] = await db.query(`
                SELECT COUNT(*) AS total 
                FROM visita_medica 
                WHERE MONTH(fecha_visita) = MONTH(NOW()) 
                  AND YEAR(fecha_visita) = YEAR(NOW())
            `);
            return rows[0]?.total || 0;
        } catch (error) {
            return 0;
        }
    }

    async obtenerDonacionesMes() {
        try {
            // Nombre de columna corregido a 'fecha' según el esquema MySQL
            const [rows] = await db.query(`
                SELECT COALESCE(SUM(monto), 0) AS total 
                FROM donacion 
                WHERE MONTH(fecha) = MONTH(NOW()) 
                  AND YEAR(fecha) = YEAR(NOW())
            `);
            return Number(rows[0]?.total) || 0;
        } catch (error) {
            console.error('Error al consultar donaciones:', error);
            return 0;
        }
    }
}

module.exports = new DashboardRepository();