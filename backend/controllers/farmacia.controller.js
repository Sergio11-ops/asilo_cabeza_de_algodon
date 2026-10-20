// backend/controllers/farmacia.controller.js
const farmaciaService = require('../services/farmacia.service');

class FarmaciaController {
    async obtenerCombos(req, res) {
        try {
            const datos = await farmaciaService.obtenerCombos();
            res.json({ ok: true, datos });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async guardarMedicamento(req, res) {
        try {
            const id = await farmaciaService.guardarMedicamento(req.body);
            res.json({ ok: true, id_medicamento: id });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async prescribirReceta(req, res) {
        try {
            const idUsuario = req.usuario?.id_usuario;
            const idReceta = await farmaciaService.prescribirReceta(req.body, idUsuario);
            res.status(201).json({ ok: true, id_receta: idReceta });
        } catch (error) {
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }

    async listarRecetas(req, res) {
        try {
            const datos = await farmaciaService.listarRecetas();
            res.json({ ok: true, datos });
        } catch (error) {
            console.error('Error al listar recetas en farmacia:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error en la base de datos' });
        }
    }

    async despacharReceta(req, res) {
        try {
            // Extrae el ID del usuario autenticado probando los nombres de propiedad habituales del JWT
            const idUsuario = req.usuario?.id_usuario || req.usuario?.id || 1;
            
            await farmaciaService.despacharReceta(req.body, idUsuario);
            res.json({ ok: true, mensaje: 'Despacho registrado correctamente' });
        } catch (error) {
            console.error('Error al despachar receta:', error);
            res.status(error.status || 500).json({ ok: false, mensaje: error.message });
        }
    }
}

module.exports = new FarmaciaController();