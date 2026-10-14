// backend/repositories/paciente.repository.js
const db = require('../config/db');

class PacienteRepository {
    async obtenerTodos() {
        const query = `
            SELECT p.id_paciente, p.expediente, p.dpi, p.nombres, p.apellidos, 
                   p.fecha_nacimiento, p.fecha_ingreso, p.grupo_sanguineo, 
                   p.telefono, p.direccion, p.activo, p.creado_en,
                   f.id_familiar, f.nombres AS familiar_nombres, f.apellidos AS familiar_apellidos, 
                   f.telefono AS familiar_telefono, pf.parentesco, pf.es_contacto_principal
            FROM paciente p
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente
            LEFT JOIN familiar f ON pf.id_familiar = f.id_familiar
            ORDER BY p.id_paciente DESC
        `;
        const [rows] = await db.query(query);
        return rows;
    }

    async obtenerPorId(id) {
        const query = `
            SELECT p.*, fm.id_ficha, fm.padecimientos, fm.observaciones AS observaciones_medicas,
                   f.id_familiar, f.nombres AS familiar_nombres, f.apellidos AS familiar_apellidos, 
                   f.telefono AS familiar_telefono, f.correo AS familiar_correo, f.dpi AS familiar_dpi,
                   pf.parentesco, pf.es_contacto_principal
            FROM paciente p
            LEFT JOIN ficha_medica fm ON p.id_paciente = fm.id_paciente
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente
            LEFT JOIN familiar f ON pf.id_familiar = f.id_familiar
            WHERE p.id_paciente = ?
        `;
        const [rows] = await db.query(query, [id]);
        return rows[0] || null;
    }

    async obtenerPorDpi(dpi) {
        const query = 'SELECT * FROM paciente WHERE dpi = ?';
        const [rows] = await db.query(query, [dpi]);
        return rows[0] || null;
    }

    async crearPacienteConRelaciones(datosPaciente, datosFamiliar) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Generar número de expediente correlativo (EXP-AAAA-NNN) usando secuencia_expediente
            const anioActual = new Date().getFullYear();
            await connection.query(
                `INSERT INTO secuencia_expediente (anio, ultimo) VALUES (?, 1)
                 ON DUPLICATE KEY UPDATE ultimo = ultimo + 1`,
                [anioActual]
            );

            const [secuencia] = await connection.query(
                `SELECT ultimo FROM secuencia_expediente WHERE anio = ? FOR UPDATE`,
                [anioActual]
            );
            const correlativo = String(secuencia[0].ultimo).padStart(3, '0');
            const expedienteGenerado = `EXP-${anioActual}-${correlativo}`;

            // 2. Insertar Paciente
            const queryPaciente = `
                INSERT INTO paciente (expediente, dpi, nombres, apellidos, fecha_nacimiento, fecha_ingreso, grupo_sanguineo, direccion, telefono, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `;
            const [resPaciente] = await connection.query(queryPaciente, [
                expedienteGenerado,
                datosPaciente.dpi,
                datosPaciente.nombres,
                datosPaciente.apellidos,
                datosPaciente.fecha_nacimiento,
                datosPaciente.fecha_ingreso,
                datosPaciente.grupo_sanguineo || null,
                datosPaciente.direccion || null,
                datosPaciente.telefono || null
            ]);

            const idPaciente = resPaciente.insertId;

            // 3. Creación automática de la Ficha Médica (RF-04)
            const queryFicha = `INSERT INTO ficha_medica (id_paciente, fecha_registro) VALUES (?, CURRENT_DATE)`;
            await connection.query(queryFicha, [idPaciente]);

            // 4. Insertar o Vincular Familiar Responsable si se provee
            if (datosFamiliar && datosFamiliar.dpi) {
                let idFamiliar;
                const [famExistente] = await connection.query(
                    'SELECT id_familiar FROM familiar WHERE dpi = ?',
                    [datosFamiliar.dpi]
                );

                if (famExistente.length > 0) {
                    idFamiliar = famExistente[0].id_familiar;
                } else {
                    const queryFamiliar = `
                        INSERT INTO familiar (nombres, apellidos, telefono, telefono_secundario, correo, direccion, dpi, activo)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                    `;
                    const [resFam] = await connection.query(queryFamiliar, [
                        datosFamiliar.nombres,
                        datosFamiliar.apellidos,
                        datosFamiliar.telefono,
                        datosFamiliar.telefono_secundario || null,
                        datosFamiliar.correo || null,
                        datosFamiliar.direccion || null,
                        datosFamiliar.dpi
                    ]);
                    idFamiliar = resFam.insertId;
                }

                // 5. Vincular Paciente con Familiar en la clase asociativa
                const queryPF = `
                    INSERT INTO paciente_familiar (id_paciente, id_familiar, parentesco, es_contacto_principal)
                    VALUES (?, ?, ?, ?)
                `;
                await connection.query(queryPF, [
                    idPaciente,
                    idFamiliar,
                    datosFamiliar.parentesco || 'Familiar',
                    datosFamiliar.es_contacto_principal ? 1 : 0
                ]);
            }

            await connection.commit();
            return { id_paciente: idPaciente, expediente: expedienteGenerado };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

 async actualizarPacienteYFamiliar(idPaciente, datosPaciente, datosFamiliar) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Actualizar Paciente
        const queryPaciente = `
            UPDATE paciente 
            SET nombres = ?, apellidos = ?, fecha_nacimiento = ?, fecha_ingreso = ?, 
                grupo_sanguineo = ?, telefono = ?, direccion = ?
            WHERE id_paciente = ?
        `;
        await connection.query(queryPaciente, [
            datosPaciente.nombres,
            datosPaciente.apellidos,
            datosPaciente.fecha_nacimiento,
            datosPaciente.fecha_ingreso,
            datosPaciente.grupo_sanguineo || null,
            datosPaciente.telefono || null,
            datosPaciente.direccion || null,
            idPaciente
        ]);

        // 2. Actualizar Familiar Responsable (si existe)
        if (datosFamiliar && datosFamiliar.id_familiar) {
            const queryFamiliar = `
                UPDATE familiar
                SET nombres = ?, apellidos = ?, telefono = ?, telefono_secundario = ?,
                    correo = ?, direccion = ?, dpi = ?
                WHERE id_familiar = ?
            `;
            await connection.query(queryFamiliar, [
                datosFamiliar.nombres,
                datosFamiliar.apellidos,
                datosFamiliar.telefono,
                datosFamiliar.telefono_secundario || null,
                datosFamiliar.correo || null,
                datosFamiliar.direccion || null,
                datosFamiliar.dpi,
                datosFamiliar.id_familiar
            ]);

            if (datosFamiliar.parentesco) {
                await connection.query(
                    `UPDATE paciente_familiar SET parentesco = ? WHERE id_paciente = ? AND id_familiar = ?`,
                    [datosFamiliar.parentesco, idPaciente, datosFamiliar.id_familiar]
                );
            }
        }

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
    async cambiarEstado(id, activo) {
        const query = 'UPDATE paciente SET activo = ? WHERE id_paciente = ?';
        const [result] = await db.query(query, [activo, id]);
        return result.affectedRows > 0;
    }
}

module.exports = new PacienteRepository();