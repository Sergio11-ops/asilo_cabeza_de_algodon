// public/js/solicitudes.js

let modalNuevaSolicitudInstance = null;
let modalAprobarInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = window.authFundacion ? window.authFundacion.getToken() : localStorage.getItem('authToken');

    if (!token) return;

    // Modales de Bootstrap
    const modalNuevaEl = document.getElementById('modalNuevaSolicitud');
    if (modalNuevaEl && window.bootstrap) modalNuevaSolicitudInstance = new bootstrap.Modal(modalNuevaEl);

    const modalAprobarEl = document.getElementById('modalAprobarSolicitud');
    if (modalAprobarEl && window.bootstrap) modalAprobarInstance = new bootstrap.Modal(modalAprobarEl);

    // Elementos DOM
    const tablaBody = document.getElementById('tablaSolicitudes');
    const formNueva = document.getElementById('formNuevaSolicitud');
    const formAprobar = document.getElementById('formAprobarSolicitud');
    const filterTabs = document.querySelectorAll('.tab-btn');

    // Estadísticas
    const statPendientes = document.getElementById('statPendientes');
    const statAprobadas = document.getElementById('statAprobadas');
    const statRechazadas = document.getElementById('statRechazadas');
    const pillCount = document.getElementById('pillCountSolicitudes');

    let solicitudesGlobal = [];
    let estadoFiltroActual = 'pendiente';

    // Cargar datos
    cargarCombos();
    cargarSolicitudes();

    // Event Listeners
    if (formNueva) formNueva.addEventListener('submit', guardarSolicitud);
    if (formAprobar) formAprobar.addEventListener('submit', confirmarAprobacion);

    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            filterTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const rawEstado = e.target.getAttribute('data-estado') || 'todas';
            if (rawEstado === 'aprobada') estadoFiltroActual = 'programada';
            else if (rawEstado === 'rechazada') estadoFiltroActual = 'cancelada';
            else estadoFiltroActual = rawEstado;

            filtrarYRenderizar();
        });
    });

    async function cargarSolicitudes() {
        try {
            const res = await fetch('/api/solicitudes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje);

            solicitudesGlobal = data.datos || [];
            actualizarEstadisticas(solicitudesGlobal);
            filtrarYRenderizar();

        } catch (err) {
            if (tablaBody) {
                tablaBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-danger py-4">
                            <i class="bi bi-exclamation-triangle me-2"></i> ${err.message}
                        </td>
                    </tr>
                `;
            }
        }
    }

    async function cargarCombos() {
        try {
            const [resCombos, resPacientes] = await Promise.all([
                fetch('/api/solicitudes/combos', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/pacientes', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const dataCombos = await resCombos.json();
            const dataPacientes = await resPacientes.json();

            // Select Pacientes
            const selectPac = document.getElementById('selectPaciente');
            if (selectPac) {
                const pacientes = dataPacientes.datos || [];
                selectPac.innerHTML = '<option value="" disabled selected>Seleccionar paciente residente...</option>' +
                    pacientes.filter(p => p.activo).map(p => `<option value="${p.id_paciente}">${p.expediente || 'S/E'} - ${p.nombres} ${p.apellidos}</option>`).join('');
            }

            // Select Especialidades
            const selectEsp = document.getElementById('selectEspecialidad');
            if (selectEsp && dataCombos.datos) {
                selectEsp.innerHTML = '<option value="" disabled selected>Seleccionar especialidad...</option>' +
                    dataCombos.datos.especialidades.map(e => `<option value="${e.id_especialidad}">${e.nombre}</option>`).join('');
            }

            // Select Enfermeros
            const selectEnf = document.getElementById('selectEnfermero');
            if (selectEnf && dataCombos.datos) {
                selectEnf.innerHTML = '<option value="" disabled selected>Seleccionar enfermero(a)...</option>' +
                    dataCombos.datos.enfermeros.map(e => `<option value="${e.id_usuario}">${e.nombre_completo}</option>`).join('');
                    
            }

        } catch (e) {
            console.error('Error cargando desplegables:', e);
        }
    }

    function filtrarYRenderizar() {
        let lista = solicitudesGlobal;
        if (estadoFiltroActual !== 'todas') {
            lista = solicitudesGlobal.filter(s => s.estado.toLowerCase() === estadoFiltroActual.toLowerCase());
        }
        renderizarTabla(lista);
    }

    function renderizarTabla(lista) {
        if (!tablaBody) return;

        if (pillCount) pillCount.textContent = `${lista.length} solicitudes`;

        if (lista.length === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        No hay solicitudes registradas con este filtro.
                    </td>
                </tr>
            `;
            return;
        }

        tablaBody.innerHTML = lista.map(s => {
            const fechaFmt = s.fecha_solicitud 
                ? new Date(s.fecha_solicitud).toLocaleString('es-GT', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })
                : 'N/A';

            let badgeClass = 'badge-status-pendiente';
            const est = s.estado.toLowerCase();

            if (est === 'programada' || est === 'referida' || est === 'atendida') badgeClass = 'badge-status-activo';
            if (est === 'cancelada') badgeClass = 'badge-status-inactivo';

            const esPendiente = est === 'pendiente';

            return `
                <tr>
                    <td>
                        <div class="fw-semibold">${s.paciente_nombre}</div>
                        <small class="text-muted">Exp: ${s.expediente || 'N/A'}</small>
                    </td>
                    <td><span class="badge bg-light text-dark border">${s.especialidad_nombre}</span></td>
                    <td><small>${s.motivo}</small></td>
                    <td><i class="bi bi-person-badge me-1"></i>${s.enfermero_nombre || 'No asignado'}</td>
                    <td>${fechaFmt}</td>
                    <td><span class="${badgeClass}">${s.estado}</span></td>
                    <td class="text-end">
                        ${esPendiente ? `
                            <button class="btn-icon-action approve" title="Programar / Referir" onclick="abrirModalAprobar(${s.id_solicitud})">
                                <i class="bi bi-check-lg"></i>
                            </button>
                            <button class="btn-icon-action reject" title="Cancelar" onclick="rechazarSolicitud(${s.id_solicitud})">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        ` : `
                            <span class="text-muted small">Procesado</span>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function actualizarEstadisticas(lista) {
        const pendientes = lista.filter(s => s.estado.toLowerCase() === 'pendiente').length;
        const aprobadas = lista.filter(s => ['programada', 'referida', 'atendida'].includes(s.estado.toLowerCase())).length;
        const rechazadas = lista.filter(s => s.estado.toLowerCase() === 'cancelada').length;

        if (statPendientes) statPendientes.textContent = pendientes;
        if (statAprobadas) statAprobadas.textContent = aprobadas;
        if (statRechazadas) statRechazadas.textContent = rechazadas;
    }

    async function guardarSolicitud(e) {
        e.preventDefault();

        const payload = {
            id_paciente: parseInt(document.getElementById('selectPaciente').value),
            id_especialidad: parseInt(document.getElementById('selectEspecialidad').value),
            id_enfermero: parseInt(document.getElementById('selectEnfermero').value),
            motivo: document.getElementById('motivoSolicitud').value.trim()
        };

        const btn = document.getElementById('btnGuardarSolicitud');

        try {
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const res = await fetch('/api/solicitudes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            btn.disabled = false;
            btn.textContent = 'Enviar Solicitud';

            if (!res.ok) throw new Error(data.mensaje);

            alert('¡Solicitud médica creada exitosamente!');
            formNueva.reset();
            if (modalNuevaSolicitudInstance) modalNuevaSolicitudInstance.hide();
            cargarSolicitudes();

        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Enviar Solicitud';
            alert('Error: ' + err.message);
        }
    }

    window.abrirModalAprobar = function(idSolicitud) {
        document.getElementById('aprobar_id_solicitud').value = idSolicitud;
        if (modalAprobarInstance) modalAprobarInstance.show();
    };

    async function confirmarAprobacion(e) {
        e.preventDefault();
        const id = document.getElementById('aprobar_id_solicitud').value;

        try {
            const res = await fetch(`/api/solicitudes/${id}/estado`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ estado: 'programada' })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje);

            alert('¡Solicitud Programada correctamente!');
            if (modalAprobarInstance) modalAprobarInstance.hide();
            cargarSolicitudes();

        } catch (err) {
            alert('Error al actualizar estado: ' + err.message);
        }
    }

    window.rechazarSolicitud = async function(id) {
        if (!confirm('¿Desea cancelar esta solicitud médica?')) return;

        try {
            const res = await fetch(`/api/solicitudes/${id}/estado`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ estado: 'cancelada' })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje);

            cargarSolicitudes();
        } catch (err) {
            alert('Error al cancelar solicitud: ' + err.message);
        }
    };


    // =====================================================
    //  Nueva especialidad: cuadro elegante dentro del modal de la solicitud
    // =====================================================
    const btnNuevaEsp = document.getElementById('btnNuevaEspecialidad');
    let cuadroEsp = null; // se construye la primera vez que se abre

    if (btnNuevaEsp) btnNuevaEsp.addEventListener('click', abrirCuadroEspecialidad);

    // Si se cierra el modal de la solicitud, el cuadro también se cierra
    if (modalNuevaEl) {
        modalNuevaEl.addEventListener('hidden.bs.modal', () => cerrarCuadroEspecialidad(true));
    }

    /**
     * Guarda la especialidad (POST /api/solicitudes/especialidades) y la deja seleccionada.
     * Es la misma inserción de siempre; además conserva el paciente y el enfermero ya elegidos.
     */
    async function crearEspecialidad(nombre) {
        const res = await fetch('/api/solicitudes/especialidades', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nombre })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        const selectPac = document.getElementById('selectPaciente');
        const selectEnf = document.getElementById('selectEnfermero');
        const selectEsp = document.getElementById('selectEspecialidad');
        const valorPaciente = selectPac ? selectPac.value : '';
        const valorEnfermero = selectEnf ? selectEnf.value : '';

        // Recargar los combos y seleccionar la especialidad recién creada
        await cargarCombos();

        if (selectPac) selectPac.value = valorPaciente;
        if (selectEnf) selectEnf.value = valorEnfermero;

        if (selectEsp && data.datos && data.datos.id_especialidad) {
            selectEsp.value = data.datos.id_especialidad;
            selectEsp.classList.add('is-valid'); // resalta unos segundos que quedó seleccionada
            setTimeout(() => selectEsp.classList.remove('is-valid'), 2500);
        }
    }

    function abrirCuadroEspecialidad() {
        const contenedor = modalNuevaEl ? modalNuevaEl.querySelector('.modal-content') : null;

        // Respaldo: si no se encuentra el modal, se usa el cuadro simple del navegador
        if (!contenedor) {
            const nombre = prompt('Ingrese el nombre de la nueva especialidad (Ej: Dermatología, Neurología):');
            if (nombre && nombre.trim()) {
                crearEspecialidad(nombre.trim()).catch(err => alert('Error: ' + err.message));
            }
            return;
        }

        if (!cuadroEsp) cuadroEsp = construirCuadroEspecialidad(contenedor);

        const input = cuadroEsp.querySelector('#inputNuevaEspecialidad');
        input.value = '';
        input.classList.remove('is-invalid');

        cuadroEsp.classList.remove('d-none');
        requestAnimationFrame(() => {
            cuadroEsp.classList.add('show');
            input.focus();
        });
    }

    function cerrarCuadroEspecialidad(inmediato = false) {
        if (!cuadroEsp) return;
        cuadroEsp.classList.remove('show');
        if (inmediato) {
            cuadroEsp.classList.add('d-none');
            return;
        }
        setTimeout(() => {
            if (!cuadroEsp.classList.contains('show')) cuadroEsp.classList.add('d-none');
        }, 160);
        if (btnNuevaEsp) btnNuevaEsp.focus();
    }

    function construirCuadroEspecialidad(contenedor) {
        const overlay = document.createElement('div');
        overlay.id = 'cuadroNuevaEspecialidad';
        overlay.className = 'position-absolute top-0 start-0 w-100 h-100 d-flex d-none align-items-center justify-content-center fade';
        overlay.style.cssText = 'z-index:1060; padding:1rem; background:rgba(15,23,42,.45); border-radius:inherit;';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'tituloNuevaEspecialidad');

        overlay.innerHTML = `
            <div class="bg-white shadow-lg p-4" style="width:100%; max-width:420px; border-radius:1rem;">
                <div class="d-flex align-items-start gap-3 mb-3">
                    <span class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                          style="width:44px; height:44px; background:rgba(13,110,253,.12); color:#0d6efd; font-size:1.25rem;">
                        <i class="bi bi-plus-lg"></i>
                    </span>
                    <div>
                        <h5 class="mb-1 fw-semibold" id="tituloNuevaEspecialidad">Nueva especialidad</h5>
                        <p class="text-muted small mb-0">Se agregará al catálogo y quedará seleccionada en esta solicitud.</p>
                    </div>
                </div>

                <label for="inputNuevaEspecialidad" class="form-label small fw-semibold">
                    Nombre de la especialidad <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control" id="inputNuevaEspecialidad"
                       placeholder="Ej. Dermatología, Neurología" autocomplete="off">
                <div class="invalid-feedback" id="feedbackNuevaEspecialidad"></div>

                <div class="d-flex justify-content-end gap-2 mt-4">
                    <button type="button" class="btn btn-secondary" id="btnCancelarEspecialidad">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="btnGuardarEspecialidad">
                        <i class="bi bi-check-lg me-1"></i>Guardar
                    </button>
                </div>
            </div>
        `;

        contenedor.appendChild(overlay);

        const input = overlay.querySelector('#inputNuevaEspecialidad');
        const feedback = overlay.querySelector('#feedbackNuevaEspecialidad');
        const btnGuardar = overlay.querySelector('#btnGuardarEspecialidad');
        const textoBotonGuardar = btnGuardar.innerHTML;

        function mostrarError(mensaje) {
            feedback.textContent = mensaje;
            input.classList.add('is-invalid');
        }

        async function guardar() {
            if (btnGuardar.disabled) return;

            const nombre = input.value.trim();
            if (!nombre) {
                mostrarError('Ingresa el nombre de la especialidad.');
                input.focus();
                return;
            }

            try {
                btnGuardar.disabled = true;
                btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Guardando...';
                await crearEspecialidad(nombre);
                cerrarCuadroEspecialidad();
            } catch (err) {
                mostrarError(err.message || 'No se pudo guardar la especialidad.');
                input.focus();
            } finally {
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = textoBotonGuardar;
            }
        }

        btnGuardar.addEventListener('click', guardar);
        overlay.querySelector('#btnCancelarEspecialidad').addEventListener('click', () => cerrarCuadroEspecialidad());
        input.addEventListener('input', () => input.classList.remove('is-invalid'));

        // Enter guarda (sin enviar la solicitud) y Esc cierra solo este cuadro (no el modal de atrás)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                guardar();
            }
        });
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                cerrarCuadroEspecialidad();
            }
        });

        // Clic en el fondo oscuro cierra el cuadro
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cerrarCuadroEspecialidad();
        });

        return overlay;
    }
});