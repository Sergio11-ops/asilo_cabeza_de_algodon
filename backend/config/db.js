const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',        // Cambia si tu usuario local de MySQL es distinto
    password: '',        // Tu contraseña de MySQL local
    database: 'asilo_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificación inicial de conexión
(async () => {
    try {
        const connection = await db.getConnection();
        console.log('✅ Conexión exitosa a MySQL (asilo_db)');
        connection.release();
    } catch (error) {
        console.error('❌ Error al conectar a MySQL:', error.message);
    }
})();

module.exports = db;