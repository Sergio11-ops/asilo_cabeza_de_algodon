// backend/repositories/paciente.repository.js
const db = require('../config/db');

// Nombres de las psicopatologías por id (los mismos del catálogo de respaldo del frontend).
const MAPA_PSICOPATOLOGIAS = {
    1: 'Demencia senil',
    2: 'Alzheimer',
    3: 'Parkinson',
    4: 'Hipertensión Arterial',
    5: 'Diabetes Mellitus Tipo 2',
    6: 'Depresión Mayor',
    7: 'Ansiedad Crónica',
    8: 'Esquizofrenia'
};

function descripcionPsicopatologia(item) {
    return typeof item === 'number'
        ? (MAPA_PSICOPATOLOGIAS[item] || `Condición ${item}`)
        : (item.descripcion || item.nombre || String(item));
}

class PacienteRepository {
    async obtenerTodos() {
        const query = `
            SELECT p.id_paciente, p.expediente, p.dpi, p.nombres, p.apellidos, 
                   p.fecha_nacimiento, p.fecha_ingreso, p.grupo_sanguineo, 
                   p.telefono, p.direccion, p.activo, p.creado_en,
                   f.id_familiar, f.nombres AS familiar_nombres, f.apellidos AS familiar_apellidos, 
                   f.telefono AS familiar_telefono, pf.parentesco, pf.es_contacto_principal
            FROM paciente p
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = 1
            LEFT JOIN familiar f ON pf.id_familiar = f.id_familiar
            ORDER BY p.id_paciente DESC
        `;
        const [rows] = await db.query(query);
        return rows;
    }

    async obtenerPorId(id) {
        const query = `
            SELECT p.*, fm.id_ficha, fm.observaciones AS observaciones_medicas,
                   f.id_familiar, f.nombres AS familiar_nombres, f.apellidos AS familiar_apellidos, 
                   f.telefono AS familiar_telefono, f.telefono_secundario AS familiar_telefono_secundario,
                   f.correo AS familiar_correo, f.dpi AS familiar_dpi, f.direccion AS familiar_direccion,
                   pf.parentesco, pf.es_contacto_principal
            FROM paciente p
            LEFT JOIN ficha_medica fm ON p.id_paciente = fm.id_paciente
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = 1
            LEFT JOIN familiar f ON pf.id_familiar = f.id_familiar
            WHERE p.id_paciente = ?
        `;
        const [rows] = await db.query(query, [id]);
        if (rows.length === 0) return null;

        const paciente = rows[0];

        // Obtener Psicopatologías registradas para este paciente
        const [psico] = await db.query(
            `SELECT id_psicopatologia, descripcion, nivel FROM paciente_psicopatologia WHERE id_paciente = ?`,
            [id]
        );
        paciente.psicopatologias = psico;

        // Obtener Medicamentos de Cajón registrados para este paciente
        const [meds] = await db.query(
            `SELECT id_paciente_medicamento, nombre, dosis, frecuencia, via, activo FROM paciente_medicamento WHERE id_paciente = ? AND activo = 1`,
            [id]
        );
        paciente.medicamentos_cajon = meds;

        return paciente;
    }

    /**
     * Busca un paciente por número de DPI
     */
    async obtenerPorDpi(dpi) {
        const query = `
            SELECT id_paciente, expediente, dpi, nombres, apellidos 
            FROM paciente 
            WHERE dpi = ? AND activo = 1 
            LIMIT 1
        `;
        const [rows] = await db.query(query, [String(dpi).trim()]);
        return rows.length > 0 ? rows[0] : null;
    }

    async obtenerCatalogos() {
        let psicopatologias = [];
        let medicamentos = [];

        try {
            const [rowsPsico] = await db.query(`SELECT id_psicopatologia, nombre FROM psicopatologia ORDER BY nombre ASC`);
            psicopatologias = rowsPsico;
        } catch (e) {
            psicopatologias = [];
        }

        try {
            const [rowsMeds] = await db.query(`SELECT id_medicamento, nombre FROM medicamento WHERE activo = 1 ORDER BY nombre ASC`);
            medicamentos = rowsMeds;
        } catch (e) {
            medicamentos = [];
        }

        return { psicopatologias, medicamentos };
    }

    async crearPacienteConRelaciones(datosPaciente, datosFamiliar, datosFichaMedica = {}) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Generar número de expediente correlativo (EXP-AAAA-NNN)
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
                String(datosPaciente.dpi).trim(),
                datosPaciente.nombres,
                datosPaciente.apellidos,
                datosPaciente.fecha_nacimiento,
                datosPaciente.fecha_ingreso,
                datosPaciente.grupo_sanguineo || null,
                datosPaciente.direccion || null,
                datosPaciente.telefono || null
            ]);

            const idPaciente = resPaciente.insertId;

            // 3. Creación automática de la Ficha Médica
            const queryFicha = `
                INSERT INTO ficha_medica (id_paciente, fecha_registro, observaciones) 
                VALUES (?, CURRENT_DATE, ?)
            `;
            await connection.query(queryFicha, [idPaciente, datosFichaMedica.observaciones || null]);

            // 4. Insertar Psicopatologías
            if (datosFichaMedica.psicopatologias && datosFichaMedica.psicopatologias.length > 0) {
                for (const item of datosFichaMedica.psicopatologias) {
                    const descripcion = descripcionPsicopatologia(item);
                    const nivel = item.nivel || 'moderado';

                    await connection.query(
                        `INSERT INTO paciente_psicopatologia (id_paciente, descripcion, nivel) VALUES (?, ?, ?)`,
                        [idPaciente, descripcion, nivel]
                    );
                }
            }

            // 5. Insertar Medicamentos Habituales + Auto-sincronización con Farmacia
            if (datosFichaMedica.medicamentos_cajon && datosFichaMedica.medicamentos_cajon.length > 0) {
                for (const med of datosFichaMedica.medicamentos_cajon) {
                    const nombreMed = med.nombre ? med.nombre.trim() : null;
                    if (!nombreMed) continue;

                    // 5a. Guardar en antecedentes del paciente
                    await connection.query(
                        `INSERT INTO paciente_medicamento (id_paciente, nombre, dosis, frecuencia, via, activo) 
                         VALUES (?, ?, ?, ?, ?, 1)`,
                        [idPaciente, nombreMed, med.dosis || null, med.frecuencia || null, med.via || null]
                    );

                    // 5b. Auto-registrar o asegurar presencia en catálogo general de farmacia
                    await connection.query(
                        `INSERT INTO medicamento (nombre, descripcion, costo, stock, activo) 
                         VALUES (?, 'Registrado automáticamente desde ingreso de residente', 0.00, 0, 1)
                         ON DUPLICATE KEY UPDATE activo = 1`,
                        [nombreMed]
                    );
                }
            }

            // 6. Insertar o Vincular Familiar Responsable
            if (datosFamiliar && datosFamiliar.dpi) {
                let idFamiliar;
                const dpiFamStr = String(datosFamiliar.dpi).trim();

                const [famExistente] = await connection.query(
                    'SELECT id_familiar FROM familiar WHERE dpi = ?',
                    [dpiFamStr]
                );

                if (famExistente.length > 0) {
                    idFamiliar = famExistente[0].id_familiar;
                    
                    // Actualizar información del familiar si ya existía
                    const queryUpdateFam = `
                        UPDATE familiar 
                        SET nombres = ?, apellidos = ?, telefono = ?, telefono_secundario = ?, correo = ?, direccion = ?
                        WHERE id_familiar = ?
                    `;
                    await connection.query(queryUpdateFam, [
                        datosFamiliar.nombres,
                        datosFamiliar.apellidos,
                        datosFamiliar.telefono,
                        datosFamiliar.telefono_secundario || null,
                        datosFamiliar.correo || null,
                        datosFamiliar.direccion || null,
                        idFamiliar
                    ]);
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
                        dpiFamStr
                    ]);
                    idFamiliar = resFam.insertId;
                }

                // Vincular Paciente con Familiar
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

    async actualizarPacienteYFamiliar(idPaciente, datosPaciente, datosFamiliar, datosFicha = null) {
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
                    String(datosFamiliar.dpi).trim(),
                    datosFamiliar.id_familiar
                ]);

                if (datosFamiliar.parentesco) {
                    await connection.query(
                        `UPDATE paciente_familiar SET parentesco = ? WHERE id_paciente = ? AND id_familiar = ?`,
                        [datosFamiliar.parentesco, idPaciente, datosFamiliar.id_familiar]
                    );
                }
            }

            // 3. Actualizar Ficha Médica (solo si el payload la incluye)
            if (datosFicha) {
                await this._actualizarFichaMedica(connection, idPaciente, datosFicha);
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

    /**
     * Sincroniza la ficha médica dentro de la transacción recibida:
     * observaciones, psicopatologías y medicamentos de cajón.
     * Cada parte se toca solo si viene en el payload.
     */
    async _actualizarFichaMedica(connection, idPaciente, ficha) {
        // 1. Observaciones
        if (ficha.observaciones !== undefined) {
            const [fichas] = await connection.query(
                'SELECT id_ficha FROM ficha_medica WHERE id_paciente = ? LIMIT 1',
                [idPaciente]
            );
            if (fichas.length > 0) {
                await connection.query(
                    'UPDATE ficha_medica SET observaciones = ? WHERE id_paciente = ?',
                    [ficha.observaciones || null, idPaciente]
                );
            } else {
                await connection.query(
                    'INSERT INTO ficha_medica (id_paciente, fecha_registro, observaciones) VALUES (?, CURRENT_DATE, ?)',
                    [idPaciente, ficha.observaciones || null]
                );
            }
        }

        // 2. Psicopatologías: se agregan las nuevas y se quitan las desmarcadas.
        //    Solo se pueden quitar condiciones conocidas (las que se muestran como casillas);
        //    cualquier otra que ya estuviera guardada se respeta.
        if (Array.isArray(ficha.psicopatologias)) {
            const norm = (t) => String(t || '').trim().toLowerCase();

            const deseadas = new Map();
            for (const item of ficha.psicopatologias) {
                const desc = descripcionPsicopatologia(item);
                deseadas.set(norm(desc), desc);
            }

            const [actuales] = await connection.query(
                'SELECT descripcion FROM paciente_psicopatologia WHERE id_paciente = ?',
                [idPaciente]
            );
            const actualesNorm = new Set(actuales.map(r => norm(r.descripcion)));

            const conocidas = new Set(Object.values(MAPA_PSICOPATOLOGIAS).map(norm));
            try {
                const [catalogo] = await connection.query('SELECT nombre FROM psicopatologia');
                catalogo.forEach(r => conocidas.add(norm(r.nombre)));
            } catch (e) {
                // El catálogo es opcional; se usa solo el mapa de respaldo.
            }

            for (const r of actuales) {
                const n = norm(r.descripcion);
                if (conocidas.has(n) && !deseadas.has(n)) {
                    await connection.query(
                        'DELETE FROM paciente_psicopatologia WHERE id_paciente = ? AND descripcion = ?',
                        [idPaciente, r.descripcion]
                    );
                }
            }

            for (const [n, desc] of deseadas) {
                if (!actualesNorm.has(n)) {
                    await connection.query(
                        'INSERT INTO paciente_psicopatologia (id_paciente, descripcion, nivel) VALUES (?, ?, ?)',
                        [idPaciente, desc, 'moderado']
                    );
                }
            }
        }

        // 3. Medicamentos de cajón: actualizar, agregar y dar de baja lógica (activo = 0)
        if (Array.isArray(ficha.medicamentos_cajon)) {
            const [existentes] = await connection.query(
                'SELECT id_paciente_medicamento, nombre FROM paciente_medicamento WHERE id_paciente = ? AND activo = 1',
                [idPaciente]
            );
            const nombrePorId = new Map(existentes.map(r => [r.id_paciente_medicamento, r.nombre]));
            const conservados = new Set();

            for (const med of ficha.medicamentos_cajon) {
                const nombreMed = med && med.nombre ? String(med.nombre).trim() : '';
                if (!nombreMed) continue;

                const idMed = Number(med.id_paciente_medicamento);
                let sincronizarCatalogo = false;

                if (idMed && nombrePorId.has(idMed)) {
                    await connection.query(
                        'UPDATE paciente_medicamento SET nombre = ?, dosis = ?, frecuencia = ?, via = ? WHERE id_paciente_medicamento = ? AND id_paciente = ?',
                        [nombreMed, med.dosis || null, med.frecuencia || null, med.via || null, idMed, idPaciente]
                    );
                    conservados.add(idMed);
                    sincronizarCatalogo = String(nombrePorId.get(idMed)).trim().toLowerCase() !== nombreMed.toLowerCase();
                } else {
                    await connection.query(
                        'INSERT INTO paciente_medicamento (id_paciente, nombre, dosis, frecuencia, via, activo) VALUES (?, ?, ?, ?, ?, 1)',
                        [idPaciente, nombreMed, med.dosis || null, med.frecuencia || null, med.via || null]
                    );
                    sincronizarCatalogo = true;
                }

                // Igual que en el registro: asegurar el medicamento en el catálogo de farmacia
                if (sincronizarCatalogo) {
                    await connection.query(
                        `INSERT INTO medicamento (nombre, descripcion, costo, stock, activo)
                         VALUES (?, 'Registrado automáticamente desde la edición de la ficha médica', 0.00, 0, 1)
                         ON DUPLICATE KEY UPDATE activo = 1`,
                        [nombreMed]
                    );
                }
            }

            for (const idMed of nombrePorId.keys()) {
                if (!conservados.has(idMed)) {
                    await connection.query(
                        'UPDATE paciente_medicamento SET activo = 0 WHERE id_paciente_medicamento = ? AND id_paciente = ?',
                        [idMed, idPaciente]
                    );
                }
            }
        }
    }

    async cambiarEstado(id, activo) {
        const query = 'UPDATE paciente SET activo = ? WHERE id_paciente = ?';
        const [result] = await db.query(query, [activo, id]);
        return result.affectedRows > 0;
    }
}

module.exports = new PacienteRepository();