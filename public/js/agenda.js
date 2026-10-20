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
    const selectEnfermero = document.getElementById('selectEnfermeroCita') || document.getElementById('txtEnfermeroCita');
    const panelNuevoMedico = document.getElementById('panelNuevoMedico');

    const listaCitasDia = document.getElementById('listaCitasDia');
    const tituloCitasDia = document.getElementById('tituloCitasDia');
    const pillCitasDia = document.getElementById('pillCountCitasDia');

    const hoyStr = new Date().toISOString().split('T')[0];

    // Instancia Modal Bootstrap
    const modalEl = document.getElementById('modalProgramarCita');
    if (modalEl && window.bootstrap) {
        modalProgramarCitaInstance = new bootstrap.Modal(modalEl);
    }

    // Cargar Datos Iniciales
    cargarCombos().then(() => {
        cargarSolicitudesPendientes();
    });

    cargarCitasDelDia(hoyStr);

    // Eventos
    if (formProgramar) formProgramar.addEventListener('submit', guardarCita);
    if (selectSolicitud) selectSolicitud.addEventListener('change', alCambiarSolicitudSeleccionada);
    
    // Toggle para mostrar/ocultar panel de nuevo especialista
    if (selectEspecialista) {
        selectEspecialista.addEventListener('change', () => {
            if (panelNuevoMedico) {
                panelNuevoMedico.style.display = (selectEspecialista.value === 'NUEVO') ? 'block' : 'none';
            }
        });
    }

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

        let html = '<option value="" disabled selected>Seleccione especialista...</option>';

        if (listaMedicos && listaMedicos.length > 0) {
            html += listaMedicos.map(m => `<option value="${m.id_medico}">${m.nombre_completo} — ${m.especialidad || 'Especialista'}</option>`).join('');
        }

        // Siempre añadir opción para registrar un nuevo médico
        html += '<option value="NUEVO" class="fw-bold text-primary">+ Registrar nuevo especialista...</option>';

        selectEspecialista.innerHTML = html;
    }

    function poblarSelectEnfermeros(listaEnfermeros) {
        if (!selectEnfermero || selectEnfermero.tagName !== 'SELECT') return;
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

            if (selectSolicitud) {
                selectSolicitud.innerHTML = '<option value="" disabled selected>Seleccione una solicitud...</option>' +
                    solicitudesPendientesGlobal.map(s => `<option value="${s.id_solicitud}">${s.paciente_nombre} — ${s.especialidad_nombre}</option>`).join('');
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
                        <td><small>${s.medico_referente || s.medico_referente_nombre}</small></td>
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
    const selectSol = document.getElementById('selectSolicitudCita');
    if (!selectSol || !selectSol.value) return;

    const idSol = parseInt(selectSol.value);
    const sol = solicitudesPendientesGlobal.find(s => s.id_solicitud === idSol);
    if (!sol) return;

    const medicosFiltrados = medicosGlobal.filter(m => m.especialidad === sol.especialidad_nombre);
    poblarSelectEspecialistas(medicosFiltrados);

    if (panelNuevoMedico) panelNuevoMedico.style.display = 'none';

    // Evaluar cualquier variante de nombre que pueda venir del backend
    const nombreEnfermero = sol.enfermero_nombre 
                         || sol.enfermero 
                         || sol.nombre_enfermero 
                         || sol.enfermero_referente;

    const campoEnfermero = document.getElementById('selectEnfermeroCita') 
                        || document.getElementById('txtEnfermeroAcompanante') 
                        || document.getElementById('selectEnfermero')
                        || document.getElementById('txtEnfermeroCita');

    if (campoEnfermero) {
        campoEnfermero.value = nombreEnfermero ? nombreEnfermero : 'Sin enfermero asignado';
        campoEnfermero.readOnly = true;
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

        const idSolicitud = parseInt(document.getElementById('selectSolicitudCita').value);
        const fechaHora = document.getElementById('fechaHoraCita').value;
        const valEspecialista = document.getElementById('selectEspecialistaCita').value;
        const observaciones = document.getElementById('observacionesCita').value.trim();

        // Obtener ID de enfermero directamente de la solicitud seleccionada
        const solicitudSel = solicitudesPendientesGlobal.find(s => s.id_solicitud === idSolicitud);
        const idEnfermero = solicitudSel ? (solicitudSel.id_enfermero || null) : null;

        const payload = {
            id_solicitud: idSolicitud,
            fecha_hora: fechaHora,
            id_enfermero: idEnfermero,
            observaciones: observaciones
        };

        if (valEspecialista === 'NUEVO') {
            const nombres = document.getElementById('nuevoMedicoNombres').value.trim();
            const apellidos = document.getElementById('nuevoMedicoApellidos').value.trim();
            const colegiado = document.getElementById('nuevoMedicoColegiado').value.trim();

            if (!nombres || !apellidos || !colegiado) {
                alert('Por favor ingrese nombres, apellidos y colegiado para el nuevo médico.');
                return;
            }

            payload.es_nuevo_medico = true;
            payload.nuevo_medico = { nombres, apellidos, colegiado };
        } else {
            if (!valEspecialista) {
                alert('Debe seleccionar un médico especialista.');
                return;
            }
            payload.id_medico = parseInt(valEspecialista);
        }

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
            if (panelNuevoMedico) panelNuevoMedico.style.display = 'none';
            if (modalProgramarCitaInstance) modalProgramarCitaInstance.hide();

            // Refrescar catálogo de médicos en memoria
            await cargarCombos();
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