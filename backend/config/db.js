const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'asilo_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Verificación inicial de conexión
(async () => {
    try {
        const connection = await db.getConnection();
        console.log(`Conexión exitosa a MySQL (${process.env.DB_NAME || 'asilo_db'})`);
        connection.release();
    } catch (error) {
        console.error('Error al conectar a MySQL:', error.message);
    }
})();

module.exports = db;