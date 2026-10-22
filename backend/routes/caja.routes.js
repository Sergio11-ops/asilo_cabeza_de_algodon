// backend/routes/caja.routes.js
const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/caja.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.use(permitirRoles('admin', 'caja'));

// Indicadores financieros y cobros
router.get('/resumen', cajaController.obtenerResumen);
router.get('/resumen-fundacion', cajaController.obtenerResumenFundacion); // <-- Habilitado
router.get('/cargos-pendientes', cajaController.listarCargosPendientes);
router.post('/pagos', cajaController.registrarPago);
router.post('/generar-cuotas', cajaController.generarCuotasMensuales); // <-- Habilitado

// Gestión de Donaciones
router.get('/donaciones', cajaController.listarDonaciones);
router.post('/donaciones', cajaController.registrarDonacion);

// Fiscalización de Gastos Operativos
router.get('/gastos', cajaController.listarGastos);
router.post('/gastos', cajaController.registrarGasto);

// Pagos a la Fundación
router.get('/pagos-fundacion', cajaController.listarPagosFundacion);
router.post('/pagos-fundacion', cajaController.registrarPagoFundacion);

module.exports = router;