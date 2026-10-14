// backend/controllers/paciente.controller.js
const pacienteService = require('../services/paciente.service');

class PacienteController {
    async obtenerPacientes(req, res) {
        try {
            const pacientes = await pacienteService.listarPacientes();
            return res.status(200).json({ ok: true, datos: pacientes });
        } catch (error) {
            return res.status(500).json({ ok: false, mensaje: error.message });
        }
    }

    async obtenerPacientePorId(req, res) {
        try {
            const paciente = await pacienteService.obtenerPacientePorId(req.params.id);
            return res.status(200).json({ ok: true, datos: paciente });
        } catch (error) {
            return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async crearPaciente(req, res) {
        try {
            const resultado = await pacienteService.registrarPaciente(req.body);
            return res.status(201).json({ ok: true, datos: resultado });
        } catch (error) {
            return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async actualizarPaciente(req, res) {
        try {
            const resultado = await pacienteService.actualizarPaciente(req.params.id, req.body);
            return res.status(200).json({ ok: true, datos: resultado });
        } catch (error) {
            return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async desactivarPaciente(req, res) {
        try {
            const resultado = await pacienteService.desactivarPaciente(req.params.id);
            return res.status(200).json({ ok: true, datos: resultado });
        } catch (error) {
            return res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }
}

module.exports = new PacienteController();