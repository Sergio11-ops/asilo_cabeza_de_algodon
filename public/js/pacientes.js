// public/js/pacientes.js

let modalEditarPacienteInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener Token
    const token = window.authFundacion ? window.authFundacion.getToken() : localStorage.getItem('authToken');

    // Inicializar Modal de Edición de Bootstrap
    const modalEl = document.getElementById('modalEditarPaciente');
    if (modalEl && window.bootstrap) {
        modalEditarPacienteInstance = new bootstrap.Modal(modalEl);
    }

    // Elementos DOM
    const tablaPacientes = document.getElementById('tablaPacientes');
    const inputBuscar = document.getElementById('inputBuscarPaciente');
    const formPaciente = document.getElementById('formRegistroPaciente');
    const formEditarPaciente = document.getElementById('formEditarPaciente');
    const btnLimpiar = document.getElementById('btnLimpiarForm');
    const errorAlert = document.getElementById('errorAlertPaciente');
    const errorMessage = document.getElementById('errorMessagePaciente');
    const successAlert = document.getElementById('successAlertPaciente');
    const successMessage = document.getElementById('successMessagePaciente');

    // Estadísticas
    const statTotal = document.getElementById('statTotalPacientes');
    const statActivos = document.getElementById('statPacientesActivos');
    const statExpedientes = document.getElementById('statConExpediente');

    let pacientesGlobal = [];

    // Cargar la lista inicial
    cargarPacientes();

    // Eventos
    if (formPaciente) formPaciente.addEventListener('submit', guardarPaciente);
    if (formEditarPaciente) formEditarPaciente.addEventListener('submit', guardarEdicionPaciente);
    if (inputBuscar) inputBuscar.addEventListener('input', filtrarPacientes);
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            formPaciente.reset();
            ocultarAlertas();
        });
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
     * Dibuja exactamente las 8 columnas correspondientes al <thead> del HTML
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
                    <!-- Columna 1: Expediente -->
                    <td><strong class="text-primary">${p.expediente || 'N/A'}</strong></td>
                    <!-- Columna 2: Paciente (Edad) -->
                    <td>
                        <div class="fw-semibold">${p.nombres} ${p.apellidos}</div>
                        <small class="text-muted">${edad !== null ? `${edad} años` : 'Edad N/D'}</small>
                    </td>
                    <!-- Columna 3: DPI / CUI -->
                    <td><code>${p.dpi}</code></td>
                    <!-- Columna 4: Grupo Sanguíneo -->
                    <td><span class="badge bg-light text-dark border">${p.grupo_sanguineo || 'N/R'}</span></td>
                    <!-- Columna 5: Familiar Responsable -->
                    <td><small>${familiarInfo}</small></td>
                    <!-- Columna 6: Fecha Ingreso -->
                    <td>${fechaIngresoFormateada}</td>
                    <!-- Columna 7: Estado -->
                    <td>
                        <span class="badge ${p.activo ? 'bg-success-subtle text-success border border-success' : 'bg-danger-subtle text-danger border border-danger'}">
                            ${p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <!-- Columna 8: Acciones -->
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary me-1" title="Editar datos" onclick="abrirModalEditar(${p.id_paciente})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        ${p.activo ? `
                            <button class="btn btn-sm btn-outline-danger" title="Desactivar paciente" onclick="desactivarPaciente(${p.id_paciente}, '${p.nombres}${p.apellidos}')">
                                <i class="bi bi-person-x"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Calcula la edad en años basándose en la fecha de nacimiento
     */
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
     * Registrar Nuevo Paciente (POST /api/pacientes)
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
            }
        };

        try {
            const btnGuardar = document.getElementById('btnGuardarPaciente');
            if (btnGuardar) {
                btnGuardar.disabled = true;
                btnGuardar.textContent = 'Guardando...';
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

            mostrarExito(data.datos.mensaje || 'Paciente y familiar registrados exitosamente.');
            formPaciente.reset();
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

            if (modalEditarPacienteInstance) {
                modalEditarPacienteInstance.show();
            }
        } catch (err) {
            alert('Error al obtener datos del paciente: ' + err.message);
        }
    };

    /**
     * Envia la actualización de Paciente y Familiar (PUT /api/pacientes/:id)
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
            }
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