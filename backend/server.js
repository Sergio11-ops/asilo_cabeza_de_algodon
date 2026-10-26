require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

// Importar rutas modulares
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const pacienteRoutes = require('./routes/paciente.routes');
const solicitudRoutes = require('./routes/solicitud.routes');
const citaRoutes = require('./routes/cita.routes');
const laboratorioRoutes = require('./routes/laboratorio.routes');
const farmaciaRoutes = require('./routes/farmacia.routes');
const visitaMedicaRoutes = require('./routes/visita_medica.routes');
const cajaRoutes = require('./routes/caja.routes'); 
const dashboardRoutes = require('./routes/dashboard.routes');
const reportesRoutes = require('./routes/reportes.routes'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend (public)
app.use(express.static(path.join(__dirname, 'public')));

console.log('authRoutes:', typeof authRoutes);
console.log('usuariosRoutes:', typeof usuariosRoutes); 
console.log('farmaciaRoutes:', typeof farmaciaRoutes);
console.log('visitaMedicaRoutes:', typeof visitaMedicaRoutes);


// Servir archivos estáticos (CSS, JS, imágenes) desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Redirigir la raíz directamente a login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Enrutamiento modular
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/citas', citaRoutes);
app.use('/api/laboratorio', laboratorioRoutes);
app.use('/api/farmacia', farmaciaRoutes);
app.use('/api/visita-medica', visitaMedicaRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reportes', reportesRoutes);                   // <--- Registrar
// Servidor escuchando
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});