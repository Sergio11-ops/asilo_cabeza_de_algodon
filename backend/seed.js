const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Ajusta tu clave de MySQL si aplica
    database: 'asilo_db'
};

const usuariosIniciales = [
    {
        nombre: 'Administrador',
        apellido: 'Sistema',
        correo: 'admin@asilo.com',
        usuario: 'admin',
        clavePlana: 'Admin#2026!',
        rol: 'admin'
    }
];

async function poblar() {
    try {
        const db = await mysql.createConnection(dbConfig);
        console.log('🔄 Conectado a MySQL (asilo_db)...');

        for (const u of usuariosIniciales) {
            const hash = await bcrypt.hash(u.clavePlana, 10);

            await db.query(
                `INSERT INTO usuario (nombre, apellido, correo, usuario, password_hash, rol, activo)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE 
                    password_hash = VALUES(password_hash),
                    nombre = VALUES(nombre),
                    apellido = VALUES(apellido),
                    activo = 1`,
                [u.nombre, u.apellido, u.correo, u.usuario, hash, u.rol]
            );

            console.log(`✅ Usuario listo: ${u.usuario} (${u.correo})`);
        }

        await db.end();
        console.log('¡Semilla ejecutada con éxito!');
    } catch (error) {
        console.error(' Error al poblar usuarios:', error.message);
    }
}

poblar();