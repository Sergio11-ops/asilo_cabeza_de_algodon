// public/js/agenda.js

let modalProgramarCitaInstance = null;
let solicitudesPendientesGlobal = [];
let especialidadesGlobal = [];
let medicosGlobal = [];
let enfermerosGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    const token = window.authFundacion ? window.authFundacion.getToken() : localStorage.getItem('authToken');
    if (!token) return;

    // Elementos DOM
    const tablaPendientes = document.getElementById('tablaSolicitudesPendientes');
    const pillPendientes = document.getElementById('pillCountPendientes');
    const formProgramar = document.getElementById('formProgramarCita');

    const selectSolicitud = document.getElementById('selectSolicitudCita');
    const selectEspecialista = document.getElementById('selectEspecialistaCita');
    const selectEnfermero = document.getElementById('selectEnfermeroCita');

    const listaCitasDia = document.getElementById('listaCitasDia');
    const tituloCitasDia = document.getElementById('tituloCitasDia');
    const pillCitasDia = document.getElementById('pillCountCitasDia');

    // Instancia Modal Bootstrap
    const modalEl = document.getElementById('modalProgramarCita');
    if (modalEl && window.bootstrap) {
        modalProgramarCitaInstance = new bootstrap.Modal(modalEl);
    }

    // Cargar Datos Iniciales
    cargarCombos().then(() => {
        cargarSolicitudesPendientes();
    });

    // Citas del día de hoy
    const hoyStr = new Date().toISOString().split('T')[0];
    cargarCitasDelDia(hoyStr);

    // Eventos
    if (formProgramar) formProgramar.addEventListener('submit', guardarCita);
    if (selectSolicitud) selectSolicitud.addEventListener('change', alCambiarSolicitudSeleccionada);

    async function cargarCombos() {
        try {
            const res = await fetch('/api/solicitudes/combos', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) return;

            medicosGlobal = data.datos.medicos || [];
            enfermerosGlobal = data.datos.enfermeros || [];
            especialidadesGlobal = data.datos.especialidades || [];

            poblarSelectEspecialistas(medicosGlobal);
            poblarSelectEnfermeros(enfermerosGlobal);

        } catch (e) {
            console.error('Error cargando combos:', e);
        }
    }

    function poblarSelectEspecialistas(listaMedicos) {
        if (!selectEspecialista) return;
        if (listaMedicos.length === 0) {
            selectEspecialista.innerHTML = '<option value="" disabled selected>No hay especialistas registrados</option>';
            return;
        }
        selectEspecialista.innerHTML = '<option value="" disabled selected>Seleccione especialista...</option>' +
            listaMedicos.map(m => `<option value="${m.id_medico}">${m.nombre_completo} — ${m.especialidad || 'Especialista'}</option>`).join('');
    }

    function poblarSelectEnfermeros(listaEnfermeros) {
        if (!selectEnfermero) return;
        selectEnfermero.innerHTML = '<option value="">Ninguno asignado</option>' +
            listaEnfermeros.map(e => `<option value="${e.id_usuario}">${e.nombre_completo}</option>`).join('');
    }

    async function cargarSolicitudesPendientes() {
        try {
            const res = await fetch('/api/citas/pendientes', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje);

            solicitudesPendientesGlobal = data.datos || [];
            if (pillPendientes) pillPendientes.textContent = `${solicitudesPendientesGlobal.length} pendientes`;

            // Llenar combo del modal
            if (selectSolicitud) {
                selectSolicitud.innerHTML = '<option value="" disabled selected>Seleccione una solicitud...</option>' +
                    solicitudesPendientesGlobal.map(s => `<option value="${s.id_solicitud}">${s.paciente_nombre} - ${s.especialidad_nombre}</option>`).join('');
            }

            if (solicitudesPendientesGlobal.length === 0) {
                tablaPendientes.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-3">
                            <i class="bi bi-check-circle text-success me-2"></i>No hay solicitudes médicas pendientes por agendar.
                        </td>
                    </tr>
                `;
                return;
            }

            tablaPendientes.innerHTML = solicitudesPendientesGlobal.map(s => {
                const fechaFmt = new Date(s.fecha_solicitud).toLocaleDateString('es-GT');
                return `
                    <tr>
                        <td class="fw-bold">${s.paciente_nombre} <br><small class="text-muted">Exp: ${s.expediente}</small></td>
                        <td><span class="badge bg-light text-dark border">${s.especialidad_nombre}</span></td>
                        <td><small>${s.motivo}</small></td>
                        <td><small>${s.medico_referente}</small></td>
                        <td><small>${fechaFmt}</small></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-primary rounded-pill px-3" onclick="abrirModalConSolicitud(${s.id_solicitud})">
                                <i class="bi bi-calendar-plus me-1"></i> Agendar Cita
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (err) {
            console.error(err);
            if (tablaPendientes) {
                tablaPendientes.innerHTML = `<tr><td colspan="6" class="text-danger text-center">${err.message}</td></tr>`;
            }
        }
    }

    function alCambiarSolicitudSeleccionada() {
        const idSol = parseInt(selectSolicitud.value);
        const sol = solicitudesPendientesGlobal.find(s => s.id_solicitud === idSol);
        if (!sol) return;

        // Auto-filtrar especialista acorde a la especialidad requerida
        const medicosFiltrados = medicosGlobal.filter(m => m.especialidad === sol.especialidad_nombre);
        if (medicosFiltrados.length > 0) {
            poblarSelectEspecialistas(medicosFiltrados);
            selectEspecialista.selectedIndex = 1; // Seleccionar el primero disponible
        } else {
            poblarSelectEspecialistas(medicosGlobal); // Fallback: mostrar todos
        }

        // Seleccionar primer enfermero por defecto si está en "Ninguno"
        if (selectEnfermero && enfermerosGlobal.length > 0 && !selectEnfermero.value) {
            selectEnfermero.value = enfermerosGlobal[0].id_usuario;
        }
    }

    async function cargarCitasDelDia(fechaStr) {
        try {
            const res = await fetch(`/api/citas?fecha=${fechaStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.mensaje);

            const citas = data.datos || [];
            if (pillCitasDia) pillCitasDia.textContent = `${citas.length} citas`;
            if (tituloCitasDia) tituloCitasDia.textContent = `Citas de hoy · ${fechaStr}`;

            if (citas.length === 0) {
                listaCitasDia.innerHTML = `<li class="text-muted small py-3">No hay citas médicas programadas para este día.</li>`;
                return;
            }

            listaCitasDia.innerHTML = citas.map(c => {
                const horaFmt = new Date(c.fecha_hora).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
                return `
                    <li>
                        <div class="activity-icon" style="background-color: var(--brand-tint); color: var(--brand);"><i class="bi bi-clock"></i></div>
                        <div>
                            <div class="activity-title">${horaFmt} · ${c.paciente_nombre}</div>
                            <div class="activity-date">${c.especialidad_nombre} — ${c.especialista_nombre}</div>
                            ${c.enfermero_nombre ? `<small class="text-muted"><i class="bi bi-person-badge me-1"></i>Acompaña: ${c.enfermero_nombre}</small>` : ''}
                        </div>
                    </li>
                `;
            }).join('');

        } catch (err) {
            console.error(err);
        }
    }

    async function guardarCita(e) {
        e.preventDefault();

        const payload = {
            id_solicitud: parseInt(document.getElementById('selectSolicitudCita').value),
            fecha_hora: document.getElementById('fechaHoraCita').value,
            id_medico: parseInt(document.getElementById('selectEspecialistaCita').value),
            id_enfermero: document.getElementById('selectEnfermeroCita').value ? parseInt(document.getElementById('selectEnfermeroCita').value) : null,
            observaciones: document.getElementById('observacionesCita').value.trim()
        };

        const btn = document.getElementById('btnGuardarCita');

        try {
            btn.disabled = true;
            btn.textContent = 'Agendando...';

            const res = await fetch('/api/citas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            btn.disabled = false;
            btn.textContent = 'Confirmar y Agendar';

            if (!res.ok) throw new Error(data.mensaje);

            alert('¡Cita médica programada exitosamente!');
            formProgramar.reset();
            if (modalProgramarCitaInstance) modalProgramarCitaInstance.hide();

            cargarSolicitudesPendientes();
            cargarCitasDelDia(hoyStr);

        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Confirmar y Agendar';
            alert('Error: ' + err.message);
        }
    }

    window.abrirModalConSolicitud = function(idSolicitud) {
        if (selectSolicitud) {
            selectSolicitud.value = idSolicitud;
            alCambiarSolicitudSeleccionada();
        }
        if (modalProgramarCitaInstance) modalProgramarCitaInstance.show();
    };
});