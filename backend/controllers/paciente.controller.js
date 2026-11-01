// backend/controllers/paciente.controller.js
const pacienteService = require('../services/paciente.service');

// Función auxiliar para asegurar que el status HTTP sea válido (100 - 599)
const obtenerStatusValido = (status) => {
    const statusNum = Number(status);
    return (Number.isInteger(statusNum) && statusNum >= 100 && statusNum < 600) ? statusNum : 500;
};

class PacienteController {
    async obtenerPacientes(req, res) {
        try {
            const pacientes = await pacienteService.listarPacientes();
            return res.status(200).json({ ok: true, datos: pacientes });
        } catch (error) {
            return res.status(obtenerStatusValido(error.status)).json({ 
                ok: false, 
                mensaje: error.message 
            });
        }
    }

    async obtenerCatalogos(req, res) {
        try {
            const catalogos = await pacienteService.obtenerCatalogos();
            return res.status(200).json({ ok: true, datos: catalogos });
        } catch (error) {
            return res.status(obtenerStatusValido(error.status)).json({ 
                ok: false, 
                mensaje: error.message 
            });
        }
    }

    async obtenerPacientePorId(req, res) {
        try {
            const paciente = await pacienteService.obtenerPacientePorId(req.params.id);
            return res.status(200).json({ ok: true, datos: paciente });
        } catch (error) {
            return res.status(obtenerStatusValido(error.status)).json({ 
                ok: false, 
                mensaje: error.message 
            });
        }
    }

    async crearPaciente(req, res) {
        try {
            const resultado = await pacienteService.registrarPaciente(req.body);
            return res.status(201).json({ ok: true, datos: resultado });
        } catch (error) {
            console.error("Error al crear paciente:", error);
            
            const statusCode = obtenerStatusValido(error.status);
            return res.status(statusCode).json({
                ok: false,
                mensaje: error.message || 'Error interno al registrar paciente',
                sqlMessage: error.sqlMessage || null,
                codigo: error.code || null,
                stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
            });
        }
    }

    async actualizarPaciente(req, res) {
        try {
            const resultado = await pacienteService.actualizarPaciente(req.params.id, req.body);
            return res.status(200).json({ ok: true, datos: resultado });
        } catch (error) {
            return res.status(obtenerStatusValido(error.status)).json({ 
                ok: false, 
                mensaje: error.message 
            });
        }
    }

    async desactivarPaciente(req, res) {
        try {
            const resultado = await pacienteService.desactivarPaciente(req.params.id);
            return res.status(200).json({ ok: true, datos: resultado });
        } catch (error) {
            return res.status(obtenerStatusValido(error.status)).json({ 
                ok: false, 
                mensaje: error.message 
            });
        }
    }
}

module.exports = new PacienteController();