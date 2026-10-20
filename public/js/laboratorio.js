// public/js/laboratorio.js

let ordenesGlobal = [];
let examenesCatalogo = [];
let pacientesCatalogo = [];

let modalNuevaOrdenInst = null;
let modalCargarResultadoInst = null;
let modalVerResultadoInst = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    modalNuevaOrdenInst = new bootstrap.Modal(document.getElementById('modalNuevaOrden'));
    modalCargarResultadoInst = new bootstrap.Modal(document.getElementById('modalCargarResultado'));
    modalVerResultadoInst = new bootstrap.Modal(document.getElementById('modalVerResultado'));

    cargarCombos();
    cargarSolicitudes();

    document.getElementById('btnNuevaOrden')?.addEventListener('click', () => {
        document.getElementById('formNuevaOrden').reset();
        actualizarContadorSeleccionados();
        modalNuevaOrdenInst.show();
    });

    document.getElementById('formNuevaOrden')?.addEventListener('submit', guardarNuevaOrden);
    document.getElementById('formCargarResultado')?.addEventListener('submit', guardarResultadosModal);

    // Búsqueda en tiempo real modal nueva orden
    document.getElementById('txtBuscarExamen')?.addEventListener('input', (e) => {
        renderizarGridExamenes(e.target.value.toLowerCase().trim());
    });

    // Filtros por pestañas
    document.querySelectorAll('#filtroEstados .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#filtroEstados .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderizarTabla(e.target.dataset.estado);
        });
    });
});

async function cargarCombos() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/laboratorio/combos', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) return;

        examenesCatalogo = data.datos.examenes || [];
        pacientesCatalogo = data.datos.pacientes || [];

        const selectPac = document.getElementById('selectPacienteOrden');
        selectPac.innerHTML = '<option value="" disabled selected>Seleccione un paciente...</option>' +
            pacientesCatalogo.map(p => `<option value="${p.id_paciente}">${p.paciente_nombre} (Exp: ${p.expediente || 'S/E'})</option>`).join('');

        renderizarGridExamenes();
    } catch (e) {
        console.error('Error combos:', e);
    }
}

function renderizarGridExamenes(filtro = '') {
    const gridFrecuentes = document.getElementById('gridExamenesFrecuentes');
    const gridEspeciales = document.getElementById('gridExamenesEspeciales');

    const frecuentes = examenesCatalogo.filter(ex => ex.categoria === 'frecuente' && ex.nombre.toLowerCase().includes(filtro));
    const especiales = examenesCatalogo.filter(ex => ex.categoria === 'especialidad' && ex.nombre.toLowerCase().includes(filtro));

    gridFrecuentes.innerHTML = frecuentes.length > 0 
        ? frecuentes.map(ex => crearCheckboxHtml(ex)).join('')
        : `<p class="text-muted small col-12">No hay exámenes frecuentes con esa búsqueda.</p>`;

    gridEspeciales.innerHTML = especiales.length > 0 
        ? especiales.map(ex => crearCheckboxHtml(ex)).join('')
        : `<p class="text-muted small col-12">No hay exámenes especializados con esa búsqueda.</p>`;

    document.querySelectorAll('.chk-examen').forEach(chk => chk.addEventListener('change', actualizarContadorSeleccionados));
}

function crearCheckboxHtml(ex) {
    return `
        <div class="col">
            <div class="form-check">
                <input class="form-check-input chk-examen" type="checkbox" value="${ex.id_examen}" data-precio="${ex.precio}" id="chkEx_${ex.id_examen}">
                <label class="form-check-label small" for="chkEx_${ex.id_examen}">
                    ${ex.nombre}
                </label>
            </div>
        </div>
    `;
}

function actualizarContadorSeleccionados() {
    const seleccionados = document.querySelectorAll('.chk-examen:checked').length;
    document.getElementById('lblCantSeleccionados').textContent = `${seleccionados} examen(es) seleccionado(s)`;
}

async function cargarSolicitudes() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/laboratorio/solicitudes', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        ordenesGlobal = data.datos || [];
        actualizarContadores();
        renderizarTabla('todos');
    } catch (err) {
        console.error(err);
    }
}

function obtenerEstadoGeneralOrden(examenes) {
    const completados = examenes.filter(e => e.estado === 'completado').length;
    const noRealizados = examenes.filter(e => e.estado === 'no_realizado').length;
    const total = examenes.length;

    if (completados === total) return 'completado';
    if (noRealizados === total) return 'no_realizado';
    if (completados + noRealizados === total) return 'completado';
    return 'solicitado';
}

function actualizarContadores() {
    let pend = 0, proc = 0, comp = 0;

    ordenesGlobal.forEach(o => {
        const st = obtenerEstadoGeneralOrden(o.examenes);
        if (st === 'solicitado') pend++;
        else if (st === 'en_proceso') proc++;
        else if (st === 'completado') comp++;
    });

    document.getElementById('cntPendientes').textContent = pend;
    document.getElementById('cntProceso').textContent = proc;
    document.getElementById('cntCompletados').textContent = comp;
}
// public/js/laboratorio.js

// public/js/laboratorio.js

function esPersonalLaboratorio() {
    try {
        // Leer el usuario desde el objeto global authFundacion o desde localStorage ('authUsuario')
        const usuarioObj = (window.authFundacion && window.authFundacion.getUsuario()) 
            || JSON.parse(localStorage.getItem('authUsuario') || '{}');

        const rol = (usuarioObj.rol || '').trim().toLowerCase();

        // Verificar si el rol corresponde a personal de laboratorio o administrador
        return ['laboratorio', 'laboratorista', 'admin', 'administrador'].includes(rol);
    } catch (e) {
        return false;
    }
}

function renderizarTabla(filtroEstado = 'todos') {
    const tbody = document.getElementById('tablaLaboratorioBody');
    if (!tbody) return;

    let lista = ordenesGlobal || [];

    // Validar si el usuario tiene permisos de carga
    const esPersonalLab = esPersonalLaboratorio();

    if (filtroEstado !== 'todos') {
        lista = lista.filter(o => obtenerEstadoGeneralOrden(o.examenes || []) === filtroEstado);
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay órdenes de laboratorio en esta categoría.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(o => {
        const examenesList = Array.isArray(o.examenes) ? o.examenes : [];

        let fechaFmt = 'Fecha N/A';
        if (o.fecha_visita) {
            const f = new Date(o.fecha_visita);
            fechaFmt = isNaN(f.getTime()) ? 'Fecha N/A' : f.toLocaleDateString('es-GT', { timeZone: 'UTC' });
        }

        const totalOrden = examenesList.reduce((sum, e) => sum + (parseFloat(e.precio_aplicado) || 0), 0);
        const nombresExamenes = examenesList.map(e => 
            `<span class="badge bg-light text-dark border me-1 mb-1">${e.examen_nombre || 'Examen'}</span>`
        ).join('');
        
        const estGeneral = obtenerEstadoGeneralOrden(examenesList);
        let badgeClass = 'badge-status-pendiente';
        let badgeText = 'Pendiente';

        if (estGeneral === 'completado') { badgeClass = 'bg-success text-white badge'; badgeText = 'Completado'; }
        else if (estGeneral === 'en_proceso') { badgeClass = 'bg-primary text-white badge'; badgeText = 'En Proceso'; }
        else if (estGeneral === 'no_realizado') { badgeClass = 'bg-danger text-white badge'; badgeText = 'No Realizado'; }

        // Botón de Acción: Si la orden NO está completada y es personal de lab/admin (o en modo desarrollo), muestra el botón de carga (📤)
        let botonAccion = '';
        if (esPersonalLab && estGeneral !== 'completado' && estGeneral !== 'no_realizado') {
            botonAccion = `<button class="btn btn-sm btn-outline-primary rounded-circle" onclick="abrirModalCargarOrden(${o.id_visita})" title="Cargar Resultados"><i class="bi bi-upload"></i></button>`;
        } else {
            botonAccion = `<button class="btn btn-sm btn-outline-secondary rounded-circle" onclick="verDetalleOrden(${o.id_visita})" title="Ver Detalle"><i class="bi bi-eye"></i></button>`;
        }

        return `
            <tr>
                <td><div class="fw-semibold">${o.paciente_nombre || 'Paciente sin nombre'}</div><small class="text-muted">Exp: ${o.expediente || 'S/E'}</small></td>
                <td style="max-width: 250px;">${nombresExamenes || '<span class="text-muted small">Sin exámenes</span>'}</td>
                <td><small>${o.medico_solicitante || 'Médico General'}</small></td>
                <td><small>${fechaFmt}</small></td>
                <td>Q${totalOrden.toFixed(2)}</td>
                <td><span class="${badgeClass}">${badgeText}</span></td>
                <td class="text-end">${botonAccion}</td>
            </tr>
        `;
    }).join('');
}

async function guardarNuevaOrden(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    const idPaciente = document.getElementById('selectPacienteOrden').value;
    const observaciones = document.getElementById('txtObservacionesOrden').value.trim();

    const seleccionados = Array.from(document.querySelectorAll('.chk-examen:checked')).map(chk => ({
        id_examen: parseInt(chk.value),
        precio: parseFloat(chk.dataset.precio)
    }));

    if (!idPaciente || seleccionados.length === 0) {
        alert('Seleccione un paciente y al menos un examen.');
        return;
    }

    try {
        const res = await fetch('/api/laboratorio/ordenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id_paciente: idPaciente, examenes: seleccionados, observaciones })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Orden registrada exitosamente!');
        modalNuevaOrdenInst.hide();
        document.getElementById('formNuevaOrden').reset();
        actualizarContadorSeleccionados();
        cargarSolicitudes();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.abrirModalCargarOrden = function(idVisita) {
    const orden = ordenesGlobal.find(o => o.id_visita === idVisita);
    if (!orden) return;

    document.getElementById('lblPacienteModal').textContent = `${orden.paciente_nombre} (Exp: ${orden.expediente || 'S/E'})`;
    document.getElementById('lblMedicoModal').textContent = orden.medico_solicitante;
    document.getElementById('txtObservacionesOrdenLab').value = orden.examenes[0]?.observaciones_laboratorio || '';

    const tbody = document.getElementById('tablaCapturaExamenesBody');
    tbody.innerHTML = orden.examenes.map(e => `
        <tr data-id-visita-examen="${e.id_visita_examen}">
            <td class="fw-semibold text-dark">${e.examen_nombre}</td>
            <td>
                <input type="text" class="form-control form-control-sm input-resultado" 
                       placeholder="Ej: 85 mg/dL" value="${e.resultado || ''}">
            </td>
            <td>
                <span class="badge bg-secondary font-monospace">${e.valores_referencia}</span>
            </td>
            <td>
                <select class="form-select form-select-sm select-estado-item">
                    <option value="completado" ${e.estado === 'completado' ? 'selected' : ''}>Completado</option>
                    <option value="no_realizado" ${e.estado === 'no_realizado' ? 'selected' : ''}>No Realizado</option>
                </select>
            </td>
        </tr>
    `).join('');

    modalCargarResultadoInst.show();
};

async function guardarResultadosModal(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    const filas = document.querySelectorAll('#tablaCapturaExamenesBody tr');
    const obsGen = document.getElementById('txtObservacionesOrdenLab').value.trim();

    const resultados = Array.from(filas).map(tr => ({
        id_visita_examen: parseInt(tr.dataset.idVisitaExamen),
        resultado: tr.querySelector('.input-resultado').value.trim(),
        estado: tr.querySelector('.select-estado-item').value,
        observaciones: obsGen
    }));

    try {
        const res = await fetch('/api/laboratorio/solicitudes/resultados-lote', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ resultados })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Resultados guardados exitosamente!');
        modalCargarResultadoInst.hide();
        cargarSolicitudes();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

window.verDetalleOrden = function(idVisita) {
    const orden = ordenesGlobal.find(o => o.id_visita === idVisita);
    if (!orden) return;

    document.getElementById('verPaciente').textContent = `${orden.paciente_nombre} (Exp: ${orden.expediente || 'S/E'})`;
    document.getElementById('verExamen').textContent = orden.examenes.map(e => e.examen_nombre).join(', ');
    document.getElementById('verMedico').textContent = orden.medico_solicitante;

    const htmlResultados = orden.examenes.map(e => `
        <div class="border-bottom pb-2 mb-2">
            <div class="d-flex justify-content-between fw-bold">
                <span>${e.examen_nombre}</span>
                <span class="text-primary">${e.resultado || 'Sin resultado'}</span>
            </div>
            <small class="text-muted">Valor Ref: ${e.valores_referencia}</small>
        </div>
    `).join('');

    document.getElementById('verContenidoResultado').innerHTML = htmlResultados;
    modalVerResultadoInst.show();
};