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


    // Listener para crear especialidad rápida
const btnNuevaEsp = document.getElementById('btnNuevaEspecialidad');
if (btnNuevaEsp) {
    btnNuevaEsp.addEventListener('click', async () => {
        const nombreEsp = prompt('Ingrese el nombre de la nueva especialidad (Ej: Dermatología, Neurología):');
        if (!nombreEsp || !nombreEsp.trim()) return;

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/solicitudes/especialidades', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ nombre: nombreEsp.trim() })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje);

            alert('¡Especialidad agregada con éxito!');

            // Recargar el combo y seleccionar la especialidad recién creada
            if (typeof cargarCombos === 'function') {
                await cargarCombos();
            }
            
            const selectEsp = document.getElementById('selectEspecialidad');
            if (selectEsp && data.datos.id_especialidad) {
                selectEsp.value = data.datos.id_especialidad;
            }

        } catch (err) {
            alert('Error: ' + err.message);
        }
    });
}
});