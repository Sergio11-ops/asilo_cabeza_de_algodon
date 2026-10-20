// public/js/visita_medica.js

let citasGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    cargarCitas();

    document.getElementById('formDiagnostico')?.addEventListener('submit', guardarDiagnostico);
    document.getElementById('txtBuscarCita')?.addEventListener('input', (e) => {
        renderizarTabla(e.target.value.toLowerCase().trim());
    });
});

async function cargarCitas() {
    const tbody = document.getElementById('tablaVisitasBody');
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-warning py-4">Sesión expirada. Por favor, inicia sesión.</td></tr>`;
            return;
        }

        const res = await fetch('/api/visita-medica/citas', { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const data = await res.json();

        if (!res.ok) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error ${res.status}: ${data.mensaje || 'Sin autorización.'}</td></tr>`;
            return;
        }

        citasGlobal = data.datos || [];
        generarPestañasEspecialidades();
        renderizarTabla();
    } catch (e) {
        console.error('Error de conexión:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Sin conexión con el servidor.</td></tr>`;
    }
}

function generarPestañasEspecialidades() {
    const contenedor = document.getElementById('contenedorPestañasEspecialidad');
    if (!contenedor) return;

    const especialidades = [...new Set(citasGlobal.map(c => c.especialidad_nombre))].filter(Boolean);

    contenedor.innerHTML = `<button class="btn btn-sm tab-btn active" data-especialidad="todas"><i class="bi bi-grid-fill me-1"></i> Todas</button>` +
        especialidades.map(esp => `<button class="btn btn-sm tab-btn" data-especialidad="${esp}"><i class="bi bi-bookmark me-1"></i> ${esp}</button>`).join('');

    contenedor.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            contenedor.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderizarTabla();
        });
    });
}

function renderizarTabla(filtroTexto = '') {
    const tbody = document.getElementById('tablaVisitasBody');
    if (!tbody) return;

    const btnActivo = document.querySelector('#contenedorPestañasEspecialidad .tab-btn.active');
    const especialidadFiltro = btnActivo ? btnActivo.dataset.especialidad : 'todas';

    let lista = citasGlobal;

    if (especialidadFiltro !== 'todas') {
        lista = lista.filter(c => c.especialidad_nombre === especialidadFiltro);
    }

    if (filtroTexto) {
        lista = lista.filter(c => 
            (c.paciente_nombre || '').toLowerCase().includes(filtroTexto) || 
            (c.medico_nombre || '').toLowerCase().includes(filtroTexto)
        );
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay citas registradas para esta vista.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(c => {
        const fechaFmt = c.fecha_hora ? new Date(c.fecha_hora).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha';
        const atendida = c.estado_solicitud === 'atendida' || !!c.diagnostico;
        const diagEncoded = encodeURIComponent(c.diagnostico || '');

        return `
            <tr>
                <td><div class="fw-semibold">${c.paciente_nombre}</div><small class="text-muted">Exp: ${c.expediente}</small></td>
                <td><span class="badge bg-primary">${c.especialidad_nombre}</span></td>
                <td><small>${fechaFmt}</small></td>
                <td><small>${c.motivo_solicitud || 'N/A'}</small></td>
                <td><small>${c.medico_nombre}</small></td>
                <td><small>${c.enfermero_nombre}</small></td>
                <td>${atendida ? '<span class="badge bg-success">Atendida</span>' : '<span class="badge bg-warning text-dark">Programada</span>'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info rounded-circle me-1" onclick="window.verFichaClinica(${c.id_paciente})" title="Ver Ficha Clínica"><i class="bi bi-file-earmark-person"></i></button>
                    <button class="btn btn-sm btn-outline-primary rounded-circle me-1" onclick="window.abrirModalDiagnostico(${c.id_solicitud}, ${c.id_paciente}, '${diagEncoded}')" title="Registrar Diagnóstico"><i class="bi bi-clipboard2-check"></i></button>
                    <a href="farmacia.html" class="btn btn-sm btn-outline-success rounded-circle" title="Emitir Receta"><i class="bi bi-prescription2"></i></a>
                </td>
            </tr>
        `;
    }).join('');
}

// Apertura segura del modal Ficha Clínica
window.verFichaClinica = async function(idPaciente) {
    if (!idPaciente) return alert('Seleccione un paciente válido.');

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`/api/visita-medica/ficha/${idPaciente}`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        const data = await res.json();

        if (!res.ok || !data.datos || !data.datos.paciente) {
            return alert(data.mensaje || 'No se obtuvieron registros del paciente.');
        }

        const { paciente, medicamentos, psicopatologias, examenes } = data.datos;

        document.getElementById('lblFichaPaciente').textContent = `${paciente.nombres || ''} ${paciente.apellidos || ''}`.trim();
        document.getElementById('lblFichaExpediente').textContent = paciente.expediente || 'S/E';
        document.getElementById('lblFichaSangre').textContent = paciente.grupo_sanguineo || 'N/E';

        document.getElementById('contenedorFichaMeds').innerHTML = medicamentos?.length > 0 
            ? medicamentos.map(m => `<div class="list-group-item"><strong>${m.nombre}</strong> - ${m.dosis || 'Sin dosis'} (${m.frecuencia || 'N/A'}) - Vía: ${m.via || 'Oral'}</div>`).join('')
            : '<p class="text-muted p-2">Sin medicamentos registrados.</p>';

        document.getElementById('contenedorFichaPsico').innerHTML = psicopatologias?.length > 0 
            ? psicopatologias.map(p => `<div class="list-group-item"><strong>${p.descripcion}</strong> <span class="badge bg-warning text-dark ms-2">${p.nivel || 'Leve'}</span></div>`).join('')
            : '<p class="text-muted p-2">Sin condiciones psicopatológicas registradas.</p>';

        document.getElementById('contenedorFichaLab').innerHTML = examenes?.length > 0 
            ? `<table class="table table-sm"><thead><tr><th>Examen</th><th>Resultado</th><th>Valores Ref.</th><th>Fecha</th></tr></thead><tbody>` +
              examenes.map(e => `<tr><td>${e.examen_nombre}</td><td class="fw-bold text-primary">${e.resultado || 'N/A'}</td><td><small>${e.valores_referencia || 'N/A'}</small></td><td><small>${e.fecha_resultado ? new Date(e.fecha_resultado).toLocaleDateString('es-GT') : 'N/A'}</small></td></tr>`).join('') + `</tbody></table>`
            : '<p class="text-muted p-2">Sin exámenes de laboratorio completados.</p>';

        const elModal = document.getElementById('modalFichaMedica');
        const modalInstance = bootstrap.Modal.getOrCreateInstance(elModal);
        modalInstance.show();
    } catch (e) {
        console.error('Error al cargar la ficha:', e);
        alert('Ocurrió un problema al desplegar la ficha clínica.');
    }
};

// Apertura segura del modal Registrar Diagnóstico
window.abrirModalDiagnostico = function(idSolicitud, idPaciente, diagEncoded) {
    document.getElementById('txtDiagSolicitud').value = idSolicitud;
    document.getElementById('txtDiagPaciente').value = idPaciente;
    document.getElementById('txtDiagnosticoClinico').value = decodeURIComponent(diagEncoded || '');
    document.getElementById('txtObservacionesClinicas').value = '';

    const elModal = document.getElementById('modalDiagnostico');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(elModal);
    modalInstance.show();
};

// public/js/visita_medica.js

async function guardarDiagnostico(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('authUsuario') || '{}');

    const idSolicitudVal = document.getElementById('txtDiagSolicitud').value;
    const idPacienteVal = document.getElementById('txtDiagPaciente').value;

    const payload = {
        id_solicitud: idSolicitudVal ? parseInt(idSolicitudVal) : null,
        id_paciente: parseInt(idPacienteVal),
        id_medico: user.id_usuario || 1,
        diagnostico: document.getElementById('txtDiagnosticoClinico').value.trim(),
        observaciones: document.getElementById('txtObservacionesClinicas').value.trim()
    };

    if (!payload.id_paciente) {
        alert('Error: No se ha identificado el paciente para este diagnóstico.');
        return;
    }

    try {
        const res = await fetch('/api/visita-medica/diagnostico', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje || 'Error al guardar el diagnóstico');

        alert('¡Diagnóstico guardado exitosamente!');
        
        const elModal = document.getElementById('modalDiagnostico');
        const modalInstance = bootstrap.Modal.getInstance(elModal);
        if (modalInstance) modalInstance.hide();

        cargarCitas();
    } catch (err) {
        alert('Error al guardar: ' + err.message);
    }
}