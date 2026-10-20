// public/js/farmacia.js

let recetasGlobal = [];
let medicamentosGlobal = [];
let pacientesGlobal = [];

document.addEventListener('DOMContentLoaded', () => {
    configurarBotonesPorRol();
    cargarCombos();
    cargarDatos();

    // Pestañas Recetas / Inventario
    document.querySelectorAll('#filtroModuloFarmacia .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#filtroModuloFarmacia .tab-btn').forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');

            const tab = targetBtn.dataset.tab;
            document.getElementById('secRecetas').classList.toggle('d-none', tab !== 'recetas');
            document.getElementById('secInventario').classList.toggle('d-none', tab !== 'inventario');
        });
    });

    // Buscadores en tiempo real
    document.getElementById('txtBuscarReceta')?.addEventListener('input', (e) => {
        renderizarRecetas(e.target.value.toLowerCase().trim());
    });

    document.getElementById('txtBuscarMedicamento')?.addEventListener('input', (e) => {
        renderizarInventario(e.target.value.toLowerCase().trim());
    });

    // Botones de acción
    document.getElementById('btnAgregarFilaMed')?.addEventListener('click', agregarFilaPrescripcion);
    document.getElementById('btnNuevaReceta')?.addEventListener('click', abrirModalNuevaReceta);
    document.getElementById('btnNuevoMedicamento')?.addEventListener('click', abrirModalNuevoMedicamento);

    document.getElementById('formNuevaReceta')?.addEventListener('submit', guardarNuevaReceta);
    document.getElementById('formDespacharReceta')?.addEventListener('submit', guardarDespacho);
    document.getElementById('formMedicamento')?.addEventListener('submit', guardarMedicamento);
});

function obtenerUsuarioSesion() {
    return (window.authFundacion && window.authFundacion.getUsuario()) 
        || JSON.parse(localStorage.getItem('authUsuario') || '{}');
}

function configurarBotonesPorRol() {
    const user = obtenerUsuarioSesion();
    const rol = (user.rol || '').toLowerCase();

    const esMedOAdmin = ['admin', 'administrador', 'medico_general', 'especialista'].some(r => rol.includes(r));
    const esFarmAOAdmin = ['admin', 'administrador', 'farmacia'].some(r => rol.includes(r));

    const btnRec = document.getElementById('btnNuevaReceta');
    const btnMed = document.getElementById('btnNuevoMedicamento');

    if (btnRec) btnRec.style.display = esMedOAdmin ? 'inline-block' : 'none';
    if (btnMed) btnMed.style.display = esFarmAOAdmin ? 'inline-block' : 'none';
}

async function cargarCombos() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/farmacia/combos', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) return;

        medicamentosGlobal = data.datos.medicamentos || [];
        pacientesGlobal = data.datos.pacientes || [];

        const selPac = document.getElementById('selectPacienteReceta');
        if (selPac) {
            selPac.innerHTML = '<option value="" disabled selected>Seleccione un paciente...</option>' +
                pacientesGlobal.map(p => `<option value="${p.id_paciente}">${p.paciente_nombre} (Exp: ${p.expediente || 'S/E'})</option>`).join('');
        }

        actualizarEstadisticas();
        renderizarInventario();
    } catch (e) {
        console.error('Error combos:', e);
    }
}

async function cargarDatos() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/farmacia/recetas', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) return;

        recetasGlobal = data.datos || [];
        actualizarEstadisticas();
        renderizarRecetas();
    } catch (e) {
        console.error('Error recetas:', e);
    }
}

function actualizarEstadisticas() {
    const pendientes = recetasGlobal.filter(r => r.medicamentos.some(m => m.entregado === 0)).length;
    const stockBajo = medicamentosGlobal.filter(m => m.stock <= 10).length;
    const activos = medicamentosGlobal.filter(m => m.activo === 1).length;

    const elPend = document.getElementById('cntRecetasPendientes');
    const elStock = document.getElementById('cntStockBajo');
    const elAct = document.getElementById('cntMedActivos');

    if (elPend) elPend.textContent = pendientes;
    if (elStock) elStock.textContent = stockBajo;
    if (elAct) elAct.textContent = activos;
}

function renderizarRecetas(filtroTexto = '') {
    const tbody = document.getElementById('tablaRecetasBody');
    if (!tbody) return;

    let lista = recetasGlobal;
    if (filtroTexto) {
        lista = lista.filter(r => 
            (r.paciente_nombre || '').toLowerCase().includes(filtroTexto) ||
            (r.medico_solicitante || '').toLowerCase().includes(filtroTexto)
        );
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay recetas que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    const user = obtenerUsuarioSesion();
    const rol = (user.rol || '').toLowerCase();
    const esFarmAOAdmin = ['admin', 'administrador', 'farmacia'].some(r => rol.includes(r));

    tbody.innerHTML = lista.map(r => {
        const fechaFmt = new Date(r.fecha_receta).toLocaleDateString('es-GT');
        const badgesMeds = r.medicamentos.map(m => {
            const color = m.entregado === 1 ? 'bg-success' : 'bg-warning text-dark';
            return `<span class="badge ${color} me-1 mb-1">${m.medicamento_nombre} (x${m.cantidad})</span>`;
        }).join('');

        const todoEntregado = r.medicamentos.length > 0 && r.medicamentos.every(m => m.entregado === 1);
        const parcial = r.medicamentos.some(m => m.entregado === 1) && !todoEntregado;

        let badgeEstado = '<span class="badge bg-warning text-dark">Pendiente</span>';
        if (todoEntregado) badgeEstado = '<span class="badge bg-success">Despachado</span>';
        else if (parcial) badgeEstado = '<span class="badge bg-info text-dark">Parcial</span>';

        let btnAccion = '';
        if (esFarmAOAdmin && !todoEntregado) {
            btnAccion = `<button class="btn btn-sm btn-outline-success rounded-circle me-1" onclick="window.abrirModalDespacho(${r.id_receta})" title="Despachar"><i class="bi bi-box-seam"></i></button>`;
        }
        btnAccion += `<button class="btn btn-sm btn-outline-secondary rounded-circle" onclick="window.verDetalleReceta(${r.id_receta})" title="Ver Detalle"><i class="bi bi-eye"></i></button>`;

        return `
            <tr>
                <td><div class="fw-semibold">${r.paciente_nombre}</div><small class="text-muted">Exp: ${r.expediente}</small></td>
                <td style="max-width: 250px;">${badgesMeds || '<small class="text-muted">Sin detalles</small>'}</td>
                <td><small>${r.medico_solicitante}</small></td>
                <td><small>${fechaFmt}</small></td>
                <td>${badgeEstado}</td>
                <td class="text-end">${btnAccion}</td>
            </tr>
        `;
    }).join('');
}

function renderizarInventario(filtroTexto = '') {
    const tbody = document.getElementById('tablaInventarioBody');
    if (!tbody) return;

    let lista = medicamentosGlobal;
    if (filtroTexto) {
        lista = lista.filter(m => (m.nombre || '').toLowerCase().includes(filtroTexto));
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay medicamentos registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(m => {
        const esBajo = m.stock <= 10;
        const colorStock = esBajo ? 'text-danger fw-bold' : 'text-dark';

        return `
            <tr>
                <td class="fw-semibold">${m.nombre}</td>
                <td><small class="text-muted">${m.descripcion || 'Sin especificación'}</small></td>
                <td>Q${parseFloat(m.costo || 0).toFixed(2)}</td>
                <td class="${colorStock}">${m.stock} unid.</td>
                <td>${m.activo === 1 ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-secondary">Inactivo</span>'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="window.editarMedicamento(${m.id_medicamento})"><i class="bi bi-pencil"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function abrirModalNuevaReceta() {
    document.getElementById('formNuevaReceta').reset();
    document.getElementById('bodyFilasMedicamentos').innerHTML = '';
    agregarFilaPrescripcion();

    const elModal = document.getElementById('modalNuevaReceta');
    if (typeof bootstrap !== 'undefined') {
        const modalInst = bootstrap.Modal.getOrCreateInstance(elModal);
        modalInst.show();
    } else {
        alert('Error: La librería Bootstrap no se encuentra cargada en la página.');
    }
}

function abrirModalNuevoMedicamento() {
    document.getElementById('formMedicamento').reset();
    document.getElementById('txtIdMedicamentoEdit').value = '';
    document.getElementById('lblTituloModalMed').innerHTML = '<i class="bi bi-capsule me-2"></i>Agregar Medicamento';

    const elModal = document.getElementById('modalMedicamento');
    if (typeof bootstrap !== 'undefined') {
        const modalInst = bootstrap.Modal.getOrCreateInstance(elModal);
        modalInst.show();
    } else {
        alert('Error: La librería Bootstrap no se encuentra cargada en la página.');
    }
}

function agregarFilaPrescripcion() {
    const tbody = document.getElementById('bodyFilasMedicamentos');
    if (!tbody) return;

    const optionsMeds = medicamentosGlobal.map(m => `<option value="${m.id_medicamento}" data-precio="${m.costo}">${m.nombre} (Stock: ${m.stock})</option>`).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <select class="form-select form-select-sm sel-med-item" required>
                <option value="" disabled selected>Seleccione...</option>
                ${optionsMeds}
            </select>
        </td>
        <td><input type="number" min="1" class="form-control form-control-sm input-cant" value="1" required></td>
        <td><input type="text" class="form-control form-control-sm input-dosis" placeholder="Ej: 1 tab / 8 hrs"></td>
        <td><input type="text" class="form-control form-control-sm input-ind" placeholder="Ej: Con alimentos"></td>
        <td><input type="text" class="form-control form-control-sm input-tiempo" placeholder="Ej: Por 7 días"></td>
        <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

async function guardarNuevaReceta(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    const idPaciente = document.getElementById('selectPacienteReceta').value;
    const indicGen = document.getElementById('txtIndicacionesGenerales').value.trim();

    const filas = document.querySelectorAll('#bodyFilasMedicamentos tr');
    if (filas.length === 0) {
        alert('Debe agregar al menos un medicamento a la receta.');
        return;
    }

    const medicamentos = Array.from(filas).map(tr => {
        const sel = tr.querySelector('.sel-med-item');
        const opt = sel.options[sel.selectedIndex];
        return {
            id_medicamento: parseInt(sel.value),
            cantidad: parseInt(tr.querySelector('.input-cant').value || 1),
            dosis: tr.querySelector('.input-dosis').value.trim(),
            indicaciones: tr.querySelector('.input-ind').value.trim(),
            tiempo_aplicacion: tr.querySelector('.input-tiempo').value.trim(),
            precio_aplicado: parseFloat(opt?.dataset?.precio || 0)
        };
    });

    try {
        const res = await fetch('/api/farmacia/recetas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id_paciente: idPaciente, indicaciones_generales: indicGen, medicamentos })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Receta médica emitida exitosamente!');
        
        const elModal = document.getElementById('modalNuevaReceta');
        const modalInst = bootstrap.Modal.getInstance(elModal);
        if (modalInst) modalInst.hide();

        cargarDatos();
    } catch (err) {
        alert('Error al emitir receta: ' + err.message);
    }
}

// Visualización de detalle para consulta
window.verDetalleReceta = function(idReceta) {
    const receta = recetasGlobal.find(r => r.id_receta === idReceta);
    if (!receta) return;

    document.getElementById('lblDespachoPaciente').textContent = `${receta.paciente_nombre} (Exp: ${receta.expediente})`;
    document.getElementById('lblDespachoMedico').textContent = receta.medico_solicitante;
    document.getElementById('lblDespachoIndicaciones').textContent = receta.indicaciones_generales || 'Sin indicaciones generales';

    const tbody = document.getElementById('tablaDespachoBody');
    tbody.innerHTML = receta.medicamentos.map(m => `
        <tr>
            <td class="fw-semibold">${m.medicamento_nombre}</td>
            <td>${m.cantidad} unid.</td>
            <td><span class="badge ${m.entregado === 1 ? 'bg-success' : 'bg-warning text-dark'}">${m.entregado === 1 ? 'Entregado' : 'Pendiente'}</span></td>
            <td>Q${m.precio_aplicado.toFixed(2)}</td>
            <td><small>${m.dosis || 'N/A'} - ${m.indicaciones || 'S/I'}</small></td>
            <td class="text-center"><i class="bi ${m.entregado === 1 ? 'bi-check-circle-fill text-success' : 'bi-clock text-warning'}"></i></td>
        </tr>
    `).join('');

    const formDesp = document.getElementById('formDespacharReceta');
    const btnSubmit = formDesp.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.style.display = 'none'; // Ocultar guardar en modo lectura

    const elModal = document.getElementById('modalDespacharReceta');
    const modalInst = bootstrap.Modal.getOrCreateInstance(elModal);
    modalInst.show();
};

window.abrirModalDespacho = function(idReceta) {
    const receta = recetasGlobal.find(r => r.id_receta === idReceta);
    if (!receta) return;

    document.getElementById('lblDespachoPaciente').textContent = `${receta.paciente_nombre} (Exp: ${receta.expediente})`;
    document.getElementById('lblDespachoMedico').textContent = receta.medico_solicitante;
    document.getElementById('lblDespachoIndicaciones').textContent = receta.indicaciones_generales || 'Sin indicaciones generales';

    const tbody = document.getElementById('tablaDespachoBody');
    tbody.innerHTML = receta.medicamentos.map(m => {
        const deshabilitado = m.entregado === 1 || m.stock_actual < m.cantidad;
        const check = m.entregado === 1 ? 'checked disabled' : (m.stock_actual >= m.cantidad ? 'checked' : 'disabled');

        return `
            <tr data-id-detalle="${m.id_detalle}" data-id-med="${m.id_medicamento}" data-cant="${m.cantidad}" data-precio="${m.precio_aplicado}">
                <td class="fw-semibold">${m.medicamento_nombre}</td>
                <td>${m.cantidad} unid.</td>
                <td><span class="badge ${m.stock_actual < m.cantidad ? 'bg-danger' : 'bg-secondary'}">${m.stock_actual} unid.</span></td>
                <td>Q${m.precio_aplicado.toFixed(2)}</td>
                <td><small>${m.dosis} - ${m.indicaciones}</small></td>
                <td class="text-center">
                    <input type="checkbox" class="form-check-input chk-entregar" ${check}>
                </td>
            </tr>
        `;
    }).join('');

    const formDesp = document.getElementById('formDespacharReceta');
    const btnSubmit = formDesp.querySelector('button[type="submit"]');
    if (btnSubmit) btnSubmit.style.display = 'inline-block';

    const elModal = document.getElementById('modalDespacharReceta');
    const modalInst = bootstrap.Modal.getOrCreateInstance(elModal);
    modalInst.show();
};

async function guardarDespacho(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    const filas = document.querySelectorAll('#tablaDespachoBody tr');

    const items = Array.from(filas).map(tr => {
        const chk = tr.querySelector('.chk-entregar');
        return {
            id_detalle: parseInt(tr.dataset.idDetalle),
            id_medicamento: parseInt(tr.dataset.idMed),
            cantidad: parseInt(tr.dataset.cant),
            precio_aplicado: parseFloat(tr.dataset.precio),
            entregar: chk && chk.checked && !chk.disabled
        };
    }).filter(i => i.entregar);

    if (items.length === 0) {
        alert('Seleccione al menos un ítem disponible para realizar el despacho.');
        return;
    }

    try {
        const res = await fetch('/api/farmacia/despacho', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ items })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Despacho realizado con éxito!');
        
        const elModal = document.getElementById('modalDespacharReceta');
        const modalInst = bootstrap.Modal.getInstance(elModal);
        if (modalInst) modalInst.hide();

        cargarCombos();
        cargarDatos();
    } catch (err) {
        alert('Error en despacho: ' + err.message);
    }
}


window.editarMedicamento = function(idMed) {
    const med = medicamentosGlobal.find(m => m.id_medicamento === idMed);
    if (!med) return;

    document.getElementById('txtIdMedicamentoEdit').value = med.id_medicamento;
    document.getElementById('txtNombreMed').value = med.nombre;
    document.getElementById('txtDescripcionMed').value = med.descripcion || '';
    document.getElementById('txtCostoMed').value = med.costo;
    document.getElementById('txtStockMed').value = med.stock;
    document.getElementById('lblTituloModalMed').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Medicamento';

    const elModal = document.getElementById('modalMedicamento');
    const modalInst = bootstrap.Modal.getOrCreateInstance(elModal);
    modalInst.show();
};

async function guardarMedicamento(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');
    const payload = {
        id_medicamento: document.getElementById('txtIdMedicamentoEdit').value || null,
        nombre: document.getElementById('txtNombreMed').value.trim(),
        descripcion: document.getElementById('txtDescripcionMed').value.trim(),
        costo: parseFloat(document.getElementById('txtCostoMed').value),
        stock: parseInt(document.getElementById('txtStockMed').value)
    };

    try {
        const res = await fetch('/api/farmacia/medicamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Medicamento guardado exitosamente!');
        
        const elModal = document.getElementById('modalMedicamento');
        const modalInst = bootstrap.Modal.getInstance(elModal);
        if (modalInst) modalInst.hide();

        cargarCombos();
    } catch (err) {
        alert('Error al guardar medicamento: ' + err.message);
    }
}