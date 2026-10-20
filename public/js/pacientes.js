// public/js/pacientes.js

let modalEditarPacienteInstance = null;
let psicopatologiasGlobal = [];
let medicamentosCatalogoGlobal = [];
let pacientesGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    // Obtener Token

    
    const token = window.authFundacion ? window.authFundacion.getToken() : localStorage.getItem('authToken');

    // Permisos de la interfaz (el backend también los valida)
    const usuarioActual = window.authFundacion ? window.authFundacion.getUsuario() : null;
    const rolActual = usuarioActual && usuarioActual.rol ? usuarioActual.rol : '';
    const puedeEditar = ['admin', 'medico_general', 'especialista'].includes(rolActual);
    const puedeDesactivar = rolActual === 'admin';

    // Inicializar Modal de Edición de Bootstrap
    const modalEl = document.getElementById('modalEditarPaciente');
    if (modalEl && window.bootstrap) {
        modalEditarPacienteInstance = new bootstrap.Modal(modalEl);
    }

    // Elementos DOM Básicos
    const tablaPacientes = document.getElementById('tablaPacientes');
    const inputBuscar = document.getElementById('inputBuscarPaciente');
    const formPaciente = document.getElementById('formRegistroPaciente');
    const formEditarPaciente = document.getElementById('formEditarPaciente');
    const btnLimpiar = document.getElementById('btnLimpiarForm');
    const errorAlert = document.getElementById('errorAlertPaciente');
    const errorMessage = document.getElementById('errorMessagePaciente');
    const successAlert = document.getElementById('successAlertPaciente');
    const successMessage = document.getElementById('successMessagePaciente');

    // Elementos DOM Ficha Médica Inicial
    const contenedorPsicopatologias = document.getElementById('contenedorPsicopatologias');
    const btnAgregarMedCajon = document.getElementById('btnAgregarMedicamentoCajon');
    const bodyMedicamentosCajon = document.getElementById('bodyMedicamentosCajon');

    // Estadísticas
    const statTotal = document.getElementById('statTotalPacientes');
    const statActivos = document.getElementById('statPacientesActivos');
    const statExpedientes = document.getElementById('statConExpediente');

    // Elementos DOM Ficha Médica en el modal de edición
    const editContenedorPsico = document.getElementById('edit_contenedorPsicopatologias');
    const editBodyMeds = document.getElementById('edit_bodyMedicamentosCajon');
    const btnAgregarMedEdit = document.getElementById('btnAgregarMedCajonEdit');

    // Cargar listas y catálogos iniciales
    cargarCatalogosIniciales();
    cargarPacientes();

    // Eventos
    if (formPaciente) formPaciente.addEventListener('submit', guardarPaciente);
    if (formEditarPaciente) formEditarPaciente.addEventListener('submit', guardarEdicionPaciente);
    if (inputBuscar) inputBuscar.addEventListener('input', filtrarPacientes);
    if (btnAgregarMedCajon) btnAgregarMedCajon.addEventListener('click', () => agregarFilaMedicamentoCajon(bodyMedicamentosCajon));
    if (btnAgregarMedEdit) btnAgregarMedEdit.addEventListener('click', () => agregarFilaMedicamentoCajon(editBodyMeds));

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            limpiarFormularioCompleto();
            ocultarAlertas();
        });
    }

    /**
     * Carga psicopatologías y catálogo de medicamentos para las filas dinámicas
     */
    async function cargarCatalogosIniciales() {
        try {
            const res = await fetch('/api/pacientes/catalogos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok && data.datos) {
                psicopatologiasGlobal = (data.datos.psicopatologias && data.datos.psicopatologias.length > 0) 
                    ? data.datos.psicopatologias 
                    : getFallbackPsico();

                medicamentosCatalogoGlobal = (data.datos.medicamentos && data.datos.medicamentos.length > 0) 
                    ? data.datos.medicamentos 
                    : getFallbackMeds();
            } else {
                psicopatologiasGlobal = getFallbackPsico();
                medicamentosCatalogoGlobal = getFallbackMeds();
            }

            renderizarPsicopatologias(psicopatologiasGlobal);

        } catch (e) {
            console.error('Error al cargar catálogos iniciales:', e);
            psicopatologiasGlobal = getFallbackPsico();
            medicamentosCatalogoGlobal = getFallbackMeds();
            renderizarPsicopatologias(psicopatologiasGlobal);
        }
    }

    function getFallbackPsico() {
        return [
            { id_psicopatologia: 1, nombre: 'Demencia senil' },
            { id_psicopatologia: 2, nombre: 'Alzheimer' },
            { id_psicopatologia: 3, nombre: 'Parkinson' },
            { id_psicopatologia: 4, nombre: 'Hipertensión Arterial' },
            { id_psicopatologia: 5, nombre: 'Diabetes Mellitus Tipo 2' },
            { id_psicopatologia: 6, nombre: 'Depresión Mayor' },
            { id_psicopatologia: 7, nombre: 'Ansiedad Crónica' },
            { id_psicopatologia: 8, nombre: 'Esquizofrenia' }
        ];
    }

    function getFallbackMeds() {
        return [
            { id_medicamento: 1, nombre: 'Losartán 50mg' },
            { id_medicamento: 2, nombre: 'Metformina 850mg' },
            { id_medicamento: 3, nombre: 'Donepezilo 10mg' },
            { id_medicamento: 4, nombre: 'Sertralina 50mg' },
            { id_medicamento: 5, nombre: 'Levodopa / Carbidopa' },
            { id_medicamento: 6, nombre: 'Quetiapina 25mg' },
            { id_medicamento: 7, nombre: 'Omeprazol 20mg' },
            { id_medicamento: 8, nombre: 'Aspirina 100mg' }
        ];
    }

    /**
     * Renderiza checkboxes de psicopatologías en la vista
     */
    function renderizarPsicopatologias(lista) {
        pintarPsicopatologias(contenedorPsicopatologias, lista, 'psico_', 'chk-psicopatologia');
        pintarPsicopatologias(editContenedorPsico, lista, 'edit_psico_', 'chk-psicopatologia-edit');
    }

    function pintarPsicopatologias(contenedor, lista, prefijo, claseChk) {
        if (!contenedor) return;

        if (lista.length === 0) {
            contenedor.innerHTML = `<div class="col-12 text-muted small">No hay condiciones registradas en el catálogo.</div>`;
            return;
        }

        contenedor.innerHTML = lista.map(p => `
            <div class="col-md-4 col-sm-6">
                <div class="form-check">
                    <input class="form-check-input ${claseChk}" type="checkbox" value="${p.id_psicopatologia}" id="${prefijo}${p.id_psicopatologia}">
                    <label class="form-check-input-label small text-dark" for="${prefijo}${p.id_psicopatologia}">
                        ${p.nombre}
                    </label>
                </div>
            </div>
        `).join('');
    }

    /**
     * Agrega una fila interactiva a la tabla de medicamentos de cajón.
     * Permite seleccionar de un datalist O escribir cualquier fármaco libremente.
     */
    function agregarFilaMedicamentoCajon(tbody = bodyMedicamentosCajon, datos = null) {
        if (!tbody) return;

        // Remover fila de estado vacío si existe
        const filaVacia = tbody.querySelector('.row-vacia-meds');
        if (filaVacia) filaVacia.remove();

        const tr = document.createElement('tr');
        tr.className = 'fila-medicamento-item';

        // Generar o actualizar datalist para autocompletado
        let datalist = document.getElementById('listaMedicamentosCatalogo');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'listaMedicamentosCatalogo';
            document.body.appendChild(datalist);
        }

        datalist.innerHTML = medicamentosCatalogoGlobal.map(m => `<option value="${m.nombre}">`).join('');

        tr.innerHTML = `
            <td>
                <input type="text" class="form-control form-control-sm med-nombre" list="listaMedicamentosCatalogo" placeholder="Seleccione o escriba..." required>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm med-dosis" placeholder="Ej. 1 tableta / 500mg" required>
            </td>
            <td>
                <input type="text" class="form-control form-control-sm med-frecuencia" placeholder="Ej. Cada 8 horas / Noche" required>
            </td>
            <td>
                <select class="form-select form-select-sm med-via">
                    <option value="Oral" selected>Oral</option>
                    <option value="Sublingual">Sublingual</option>
                    <option value="Tópica">Tópica</option>
                    <option value="Inyectable">Inyectable</option>
                    <option value="Oftálmica">Oftálmica</option>
                </select>
            </td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar-fila-med" title="Quitar">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        // Precargar valores (modo edición). Se asignan por JS para evitar inyectar HTML.
        if (datos) {
            tr.querySelector('.med-nombre').value = datos.nombre || '';
            tr.querySelector('.med-dosis').value = datos.dosis || '';
            tr.querySelector('.med-frecuencia').value = datos.frecuencia || '';
            if (datos.id_paciente_medicamento) tr.dataset.idMed = datos.id_paciente_medicamento;
            const selVia = tr.querySelector('.med-via');
            if (datos.via) {
                if (![...selVia.options].some(o => o.value === datos.via)) {
                    selVia.add(new Option(datos.via, datos.via));
                }
                selVia.value = datos.via;
            } else {
                // La BD aún no guarda la vía: no mostrar "Oral" como si fuera un dato real
                selVia.insertBefore(new Option('Sin especificar', ''), selVia.firstChild);
                selVia.value = '';
            }
        }

        tr.querySelector('.btn-eliminar-fila-med').addEventListener('click', () => {
            tr.remove();
            if (tbody.querySelectorAll('.fila-medicamento-item').length === 0) {
                tbody.innerHTML = `
                    <tr class="row-vacia-meds">
                        <td colspan="5" class="text-center text-muted py-3 small">
                            No se han agregado medicamentos de cajón. Presione "Agregar Medicamento" si el residente consume fármacos fijos.
                        </td>
                    </tr>
                `;
            }
        });

        tbody.appendChild(tr);
    }

    /**
     * Consulta la API para obtener pacientes (GET /api/pacientes)
     */
    async function cargarPacientes() {
        try {
            const response = await fetch('/api/pacientes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    mostrarError(data.mensaje || 'Sesión no válida o sin permisos suficientes.');
                }
                throw new Error(data.mensaje || 'Error al obtener listado de pacientes.');
            }

            pacientesGlobal = data.datos || [];
            actualizarEstadisticas(pacientesGlobal);
            renderizarTabla(pacientesGlobal);

        } catch (error) {
            if (tablaPacientes) {
                tablaPacientes.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-danger py-4">
                            <i class="bi bi-exclamation-circle me-2"></i>${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    }

    /**
     * Dibuja las 8 columnas correspondientes al <thead> del HTML
     */
    function renderizarTabla(lista) {
        if (!tablaPacientes) return;

        if (lista.length === 0) {
            tablaPacientes.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        No hay pacientes registrados en el sistema.
                    </td>
                </tr>
            `;
            return;
        }

        tablaPacientes.innerHTML = lista.map(p => {
            const edad = calcularEdad(p.fecha_nacimiento);
            const familiarInfo = p.familiar_nombres 
                ? `${p.familiar_nombres} ${p.familiar_apellidos} (${p.parentesco || 'Familiar'}) - Tel: ${p.familiar_telefono || 'N/A'}` 
                : '<span class="text-muted">Sin familiar asociado</span>';

            const fechaIngresoFormateada = p.fecha_ingreso 
                ? new Date(p.fecha_ingreso).toLocaleDateString('es-GT', { timeZone: 'UTC' }) 
                : 'N/A';

            return `
                <tr>
                    <td><strong class="text-primary">${p.expediente || 'N/A'}</strong></td>
                    <td>
                        <div class="fw-semibold">${p.nombres} ${p.apellidos}</div>
                        <small class="text-muted">${edad !== null ? `${edad} años` : 'Edad N/D'}</small>
                    </td>
                    <td><code>${p.dpi}</code></td>
                    <td><span class="badge bg-light text-dark border">${p.grupo_sanguineo || 'N/R'}</span></td>
                    <td><small>${familiarInfo}</small></td>
                    <td>${fechaIngresoFormateada}</td>
                    <td>
                        <span class="badge ${p.activo ? 'bg-success-subtle text-success border border-success' : 'bg-danger-subtle text-danger border border-danger'}">
                            ${p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td class="text-end">
                        ${puedeEditar ? `
                            <button class="btn btn-sm btn-outline-primary me-1" title="Editar datos y ficha médica" onclick="abrirModalEditar(${p.id_paciente})">
                                <i class="bi bi-pencil"></i>
                            </button>
                        ` : ''}
                        ${(p.activo && puedeDesactivar) ? `
                            <button class="btn btn-sm btn-outline-danger" title="Desactivar paciente" onclick="desactivarPaciente(${p.id_paciente}, '${p.nombres}${p.apellidos}')">
                                <i class="bi bi-person-x"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function calcularEdad(fechaNacimientoStr) {
        if (!fechaNacimientoStr) return null;
        const hoy = new Date();
        const nac = new Date(fechaNacimientoStr);
        let edad = hoy.getFullYear() - nac.getFullYear();
        const mes = hoy.getMonth() - nac.getMonth();
        if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
            edad--;
        }
        return edad >= 0 ? edad : null;
    }

    function actualizarEstadisticas(lista) {
        if (statTotal) statTotal.textContent = lista.length;
        if (statActivos) statActivos.textContent = lista.filter(p => p.activo === 1).length;
        if (statExpedientes) statExpedientes.textContent = lista.filter(p => p.expediente).length;
    }

    function filtrarPacientes() {
        const termino = inputBuscar.value.toLowerCase().trim();
        const filtrados = pacientesGlobal.filter(p => 
            p.expediente?.toLowerCase().includes(termino) ||
            p.dpi?.toLowerCase().includes(termino) ||
            p.nombres?.toLowerCase().includes(termino) ||
            p.apellidos?.toLowerCase().includes(termino) ||
            p.familiar_nombres?.toLowerCase().includes(termino)
        );
        renderizarTabla(filtrados);
    }

    /**
     * Registrar Nuevo Paciente con Ficha Médica y Medicamentos Habituales (POST /api/pacientes)
     */
    async function guardarPaciente(event) {
        event.preventDefault();
        ocultarAlertas();

        const dpiPaciente = document.getElementById('dpiPaciente').value.trim();
        const dpiFamiliar = document.getElementById('dpiFamiliar').value.trim();

        const dpiRegex = /^[0-9]{13}$/;
        if (!dpiRegex.test(dpiPaciente)) {
            mostrarError('El DPI/CUI del paciente debe contener exactamente 13 dígitos numéricos.');
            return;
        }

        if (!dpiRegex.test(dpiFamiliar)) {
            mostrarError('El DPI/CUI del familiar debe contener exactamente 13 dígitos numéricos.');
            return;
        }

        // Recopilar Psicopatologías Seleccionadas
        const psicopatologiasSeleccionadas = Array.from(
            document.querySelectorAll('.chk-psicopatologia:checked')
        ).map(chk => parseInt(chk.value));

        // Recopilar Medicamentos de Cajón (Texto libre o catálogo)
        const filasMeds = bodyMedicamentosCajon ? bodyMedicamentosCajon.querySelectorAll('.fila-medicamento-item') : [];
        const medicamentosCajon = [];

        for (const fila of filasMeds) {
            const inputNombre = fila.querySelector('.med-nombre');
            const inputDosis = fila.querySelector('.med-dosis');
            const inputFrec = fila.querySelector('.med-frecuencia');

            if (inputNombre && inputNombre.value.trim()) {
                medicamentosCajon.push({
                    nombre: inputNombre.value.trim(),
                    dosis: inputDosis ? inputDosis.value.trim() : '',
                    frecuencia: inputFrec ? inputFrec.value.trim() : '',
                    via: fila.querySelector('.med-via') ? fila.querySelector('.med-via').value : 'Oral'
                });
            }
        }

        const payload = {
            paciente: {
                dpi: dpiPaciente,
                nombres: document.getElementById('nombresPaciente').value.trim(),
                apellidos: document.getElementById('apellidosPaciente').value.trim(),
                fecha_nacimiento: document.getElementById('fechaNacimiento').value,
                fecha_ingreso: document.getElementById('fechaIngreso').value,
                grupo_sanguineo: document.getElementById('grupoSanguineo').value || null,
                telefono: document.getElementById('telefonoPaciente').value.trim() || null,
                direccion: document.getElementById('direccionPaciente').value.trim() || null
            },
            familiar: {
                dpi: dpiFamiliar,
                nombres: document.getElementById('nombresFamiliar').value.trim(),
                apellidos: document.getElementById('apellidosFamiliar').value.trim(),
                parentesco: document.getElementById('parentescoFamiliar').value.trim(),
                telefono: document.getElementById('telefonoFamiliar').value.trim(),
                telefono_secundario: document.getElementById('telefonoSecundarioFamiliar').value.trim() || null,
                correo: document.getElementById('correoFamiliar').value.trim() || null,
                direccion: document.getElementById('direccionFamiliar').value.trim() || null,
                es_contacto_principal: true
            },
            ficha_medica: {
                observaciones: document.getElementById('observacionesMedicasIngreso').value.trim() || null,
                psicopatologias: psicopatologiasSeleccionadas,
                medicamentos_cajon: medicamentosCajon
            }
        };

        try {
            const btnGuardar = document.getElementById('btnGuardarPaciente');
            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.textContent = 'Guardando paciente y ficha...';
            }

            const response = await fetch('/api/pacientes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.textContent = 'Guardar Paciente';
            }

            if (!response.ok) {
                mostrarError(data.mensaje || 'No se pudo registrar el paciente.');
                return;
            }

            mostrarExito(data.datos?.mensaje || 'Paciente, familiar y ficha médica inicial registrados exitosamente.');
            limpiarFormularioCompleto();
            cargarPacientes();

        } catch (error) {
            const btnGuardar = document.getElementById('btnGuardarPaciente');
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.textContent = 'Guardar Paciente';
            }
            mostrarError(error.message || 'Error al conectar con el servidor.');
        }
    }

    /**
     * Llena la sección "Ficha Médica" del modal de edición:
     * psicopatologías marcadas, observaciones y medicamentos de cajón.
     */
    function cargarFichaMedicaEnModal(p) {
        const ficha = p.ficha_medica || {};

        // Asegurar que los checkboxes del modal existan
        if (!document.querySelector('.chk-psicopatologia-edit')) {
            renderizarPsicopatologias(psicopatologiasGlobal);
        }

        // La BD guarda la condición por su nombre (descripcion), así que se marca por nombre.
        const normalizar = (t) => String(t || '').trim().toLowerCase();
        const listaPsico = ficha.psicopatologias || p.psicopatologias || [];
        const nombresPsico = listaPsico
            .map(x => (x && typeof x === 'object') ? normalizar(x.descripcion || x.nombre) : normalizar(x))
            .filter(Boolean);
        document.querySelectorAll('.chk-psicopatologia-edit').forEach(chk => {
            const etiqueta = document.querySelector(`label[for="${chk.id}"]`);
            chk.checked = nombresPsico.includes(normalizar(etiqueta ? etiqueta.textContent : ''));
        });

        const txtObs = document.getElementById('edit_observacionesMedicas');
        if (txtObs) txtObs.value = ficha.observaciones ?? p.observaciones_medicas ?? '';

        if (editBodyMeds) {
            editBodyMeds.innerHTML = '';
            const meds = ficha.medicamentos_cajon || p.medicamentos_cajon || [];
            if (meds.length === 0) {
                editBodyMeds.innerHTML = `
                    <tr class="row-vacia-meds">
                        <td colspan="5" class="text-center text-muted py-3 small">Sin medicamentos de cajón cargados.</td>
                    </tr>
                `;
            } else {
                meds.forEach(m => agregarFilaMedicamentoCajon(editBodyMeds, m));
            }
        }
    }

    /**
     * Lee la sección "Ficha Médica" del modal de edición y arma el objeto para el PUT.
     */
    function recopilarFichaMedicaEdicion() {
        const psicopatologias = Array.from(
            document.querySelectorAll('.chk-psicopatologia-edit:checked')
        ).map(chk => parseInt(chk.value, 10));

        const medicamentos_cajon = [];
        if (editBodyMeds) {
            editBodyMeds.querySelectorAll('.fila-medicamento-item').forEach(fila => {
                const nombre = fila.querySelector('.med-nombre').value.trim();
                if (!nombre) return;
                medicamentos_cajon.push({
                    id_paciente_medicamento: fila.dataset.idMed ? parseInt(fila.dataset.idMed, 10) : null,
                    nombre,
                    dosis: fila.querySelector('.med-dosis').value.trim(),
                    frecuencia: fila.querySelector('.med-frecuencia').value.trim(),
                    via: fila.querySelector('.med-via').value
                });
            });
        }

        const txtObs = document.getElementById('edit_observacionesMedicas');
        const ficha = { psicopatologias, medicamentos_cajon };
        if (txtObs) ficha.observaciones = txtObs.value.trim() || null;
        return ficha;
    }

    function limpiarFormularioCompleto() {
        if (formPaciente) formPaciente.reset();
        if (bodyMedicamentosCajon) {
            bodyMedicamentosCajon.innerHTML = `
                <tr class="row-vacia-meds">
                    <td colspan="5" class="text-center text-muted py-3 small">
                        No se han agregado medicamentos de cajón. Presione "Agregar Medicamento" si el residente consume fármacos fijos.
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Abre el modal y llena los campos para edición (GET /api/pacientes/:id)
     */
    window.abrirModalEditar = async function(id) {
        try {
            const res = await fetch(`/api/pacientes/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje);

            const p = data.datos;

            // Datos Paciente
            document.getElementById('edit_id_paciente').value = p.id_paciente;
            document.getElementById('edit_nombresPaciente').value = p.nombres || '';
            document.getElementById('edit_apellidosPaciente').value = p.apellidos || '';
            document.getElementById('edit_fechaNacimiento').value = p.fecha_nacimiento ? p.fecha_nacimiento.split('T')[0] : '';
            document.getElementById('edit_fechaIngreso').value = p.fecha_ingreso ? p.fecha_ingreso.split('T')[0] : '';
            document.getElementById('edit_grupoSanguineo').value = p.grupo_sanguineo || '';
            document.getElementById('edit_telefonoPaciente').value = p.telefono || '';
            document.getElementById('edit_direccionPaciente').value = p.direccion || '';

            // Datos Familiar
            document.getElementById('edit_id_familiar').value = p.id_familiar || '';
            document.getElementById('edit_dpiFamiliar').value = p.familiar_dpi || '';
            document.getElementById('edit_nombresFamiliar').value = p.familiar_nombres || '';
            document.getElementById('edit_apellidosFamiliar').value = p.familiar_apellidos || '';
            document.getElementById('edit_parentescoFamiliar').value = p.parentesco || '';
            document.getElementById('edit_telefonoFamiliar').value = p.familiar_telefono || '';
            document.getElementById('edit_correoFamiliar').value = p.familiar_correo || '';
            document.getElementById('edit_direccionFamiliar').value = p.familiar_direccion || '';
            document.getElementById('edit_telefonoSecundarioFamiliar').value = p.familiar_telefono_secundario || p.telefono_secundario || '';

            // Ficha Médica (psicopatologías, observaciones y medicamentos de cajón)
            cargarFichaMedicaEnModal(p);

            if (modalEditarPacienteInstance) {
                modalEditarPacienteInstance.show();
            }
        } catch (err) {
            alert('Error al obtener datos del paciente: ' + err.message);
        }
    };

    /**
     * Envía la actualización de Paciente y Familiar (PUT /api/pacientes/:id)
     */
    async function guardarEdicionPaciente(e) {
        e.preventDefault();
        const idPaciente = document.getElementById('edit_id_paciente').value;

        const payload = {
            paciente: {
                nombres: document.getElementById('edit_nombresPaciente').value.trim(),
                apellidos: document.getElementById('edit_apellidosPaciente').value.trim(),
                fecha_nacimiento: document.getElementById('edit_fechaNacimiento').value,
                fecha_ingreso: document.getElementById('edit_fechaIngreso').value,
                grupo_sanguineo: document.getElementById('edit_grupoSanguineo').value || null,
                telefono: document.getElementById('edit_telefonoPaciente').value.trim() || null,
                direccion: document.getElementById('edit_direccionPaciente').value.trim() || null
            },
            familiar: {
                id_familiar: document.getElementById('edit_id_familiar').value || null,
                dpi: document.getElementById('edit_dpiFamiliar').value.trim(),
                nombres: document.getElementById('edit_nombresFamiliar').value.trim(),
                apellidos: document.getElementById('edit_apellidosFamiliar').value.trim(),
                parentesco: document.getElementById('edit_parentescoFamiliar').value.trim(),
                telefono: document.getElementById('edit_telefonoFamiliar').value.trim(),
                correo: document.getElementById('edit_correoFamiliar').value.trim() || null,
                telefono_secundario: document.getElementById('edit_telefonoSecundarioFamiliar').value.trim() || null,
                direccion: document.getElementById('edit_direccionFamiliar').value.trim() || null
            },
            ficha_medica: recopilarFichaMedicaEdicion()
        };

        try {
            const response = await fetch(`/api/pacientes/${idPaciente}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.mensaje);

            alert('¡Datos actualizados correctamente!');
            if (modalEditarPacienteInstance) modalEditarPacienteInstance.hide();
            cargarPacientes();

        } catch (error) {
            alert('Error al actualizar: ' + error.message);
        }
    }

    /**
     * Desactivar Paciente (PATCH /api/pacientes/:id/desactivar)
     */
    window.desactivarPaciente = async function(id, nombreCompleto) {
        if (!confirm(`¿Está seguro de desactivar al paciente "${nombreCompleto}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/pacientes/${id}/desactivar`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.mensaje || 'Error al desactivar el paciente.');
                return;
            }

            cargarPacientes();
        } catch (error) {
            alert('Error de conexión al desactivar paciente.');
        }
    };

    function mostrarError(mensaje) {
        if (errorMessage && errorAlert) {
            errorMessage.textContent = mensaje;
            errorAlert.style.display = 'block';
            if (successAlert) successAlert.style.display = 'none';
        }
    }

    function mostrarExito(mensaje) {
        if (successMessage && successAlert) {
            successMessage.textContent = mensaje;
            successAlert.style.display = 'block';
            if (errorAlert) errorAlert.style.display = 'none';
        }
    }

    function ocultarAlertas() {
        if (errorAlert) errorAlert.style.display = 'none';
        if (successAlert) successAlert.style.display = 'none';
    }
});