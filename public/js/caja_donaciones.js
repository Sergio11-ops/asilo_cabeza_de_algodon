let cargosGlobales = [];
let donacionesGlobales = [];
let gastosGlobales = [];
let cargosSeleccionadosParaPago = [];

// Helper para insignias/badges de concepto
function obtenerBadgeConcepto(concepto) {
    switch (concepto) {
        case 'consulta': return '<span class="badge bg-primary">CONSULTA</span>';
        case 'examen': return '<span class="badge bg-info text-dark">EXAMEN</span>';
        case 'medicamento': return '<span class="badge bg-warning text-dark">MEDICAMENTO</span>';
        case 'cuota_mensual': return '<span class="badge text-white" style="background-color: #6f42c1;">CUOTA MENSUAL</span>';
        default: return `<span class="badge bg-secondary">${concepto ? concepto.toUpperCase() : 'OTRO'}</span>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarResumenKpis();
    cargarCargosPendientes();
    cargarDonaciones();
    cargarGastos();
    cargarPagosFundacion();

    // Form Submits
    document.getElementById('formProcesarPago').addEventListener('submit', procesarPago);
    document.getElementById('formNuevaDonacion').addEventListener('submit', guardarDonacion);
    document.getElementById('formNuevoGasto').addEventListener('submit', guardarGasto);
    document.getElementById('formNuevoPagoFundacion').addEventListener('submit', guardarPagoFundacion);

    // Filtros de Entradas
    document.getElementById('txtBuscarCargo').addEventListener('input', filtrarCargos);
    document.getElementById('txtDescuentoAdicional').addEventListener('input', recalcularTotalPago);

    // Fechas por defecto
    const hoyStr = new Date().toISOString().split('T')[0];
    document.getElementById('txtFechaDonacion').value = hoyStr;
    document.getElementById('txtFechaGasto').value = hoyStr;
    document.getElementById('txtFechaPagoFundacion').value = hoyStr;
});

// 1. Cargar KPIs
async function cargarResumenKpis() {
    const token = localStorage.getItem('authToken');
    try {
        const res = await fetch('/api/caja/resumen', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok && data.datos) {
            document.getElementById('kpiDonaciones').textContent = `Q${data.datos.donaciones_mes.toFixed(2)}`;
            document.getElementById('kpiPendientes').textContent = `Q${data.datos.cobros_pendientes.toFixed(2)}`;
            document.getElementById('kpiIngresos').textContent = `Q${data.datos.ingresos_cobrados_mes.toFixed(2)}`;
            document.getElementById('kpiGastos').textContent = `Q${data.datos.gastos_mes.toFixed(2)}`;
        }
    } catch (err) {
        console.error('Error al cargar KPIs de caja:', err);
    }
}

// 2. Cargar Cuentas por Cobrar con opción de Cobro General
async function cargarCargosPendientes() {
    const token = localStorage.getItem('authToken');
    const tbody = document.getElementById('tablaCargosBody');
    try {
        const res = await fetch('/api/caja/cargos-pendientes', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        cargosGlobales = data.datos || [];
        renderizarTablaCargos(cargosGlobales);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error: ${err.message}</td></tr>`;
    }
}

function renderizarTablaCargos(lista) {
    const tbody = document.getElementById('tablaCargosBody');
    if (!lista || lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay cargos pendientes por cobrar.</td></tr>`;
        return;
    }

    // Agrupar cuentas por paciente para habilitar "Cobrar Todo"
    const conteoPacientes = new Map();
    lista.forEach(c => {
        conteoPacientes.set(c.id_paciente, (conteoPacientes.get(c.id_paciente) || 0) + 1);
    });

    tbody.innerHTML = lista.map(c => {
        const totalCuentasPaciente = conteoPacientes.get(c.id_paciente);
        return `
            <tr>
                <td>
                    <div class="fw-bold">${c.paciente_nombre}</div>
                    <div class="text-muted small">${c.expediente}</div>
                </td>
                <td>
                    <div>${c.familiar_nombre}</div>
                    <div class="text-muted small"><i class="bi bi-telephone me-1"></i>${c.familiar_telefono || 'Sin tel.'}</div>
                </td>
                <td>${obtenerBadgeConcepto(c.concepto)}</td>
                <td><div class="text-truncate" style="max-width: 220px;" title="${c.descripcion}">${c.descripcion}</div></td>
                <td>${new Date(c.fecha).toLocaleDateString()}</td>
                <td class="fw-bold text-success">Q${parseFloat(c.monto).toFixed(2)}</td>
                <td class="text-end">
                    <div class="btn-group">
                        <button class="btn btn-sm btn-success rounded-pill me-1" onclick="abrirModalPagoIndividual(${c.id_cargo})">
                            <i class="bi bi-cash me-1"></i> Cobrar
                        </button>
                        ${totalCuentasPaciente > 1 ? `
                            <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="abrirModalPagoGeneralPaciente(${c.id_paciente})" title="Cobrar todas las cuentas del residente">
                                <i class="bi bi-check-all me-1"></i> Cobrar Todo (${totalCuentasPaciente})
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarCargos() {
    const texto = document.getElementById('txtBuscarCargo').value.toLowerCase().trim();
    const filtrados = cargosGlobales.filter(c => 
        c.paciente_nombre.toLowerCase().includes(texto) ||
        c.familiar_nombre.toLowerCase().includes(texto) ||
        c.expediente.toLowerCase().includes(texto)
    );
    renderizarTablaCargos(filtrados);
}

// 3. Modales de Pago (Individual / Consolidado)
function abrirModalPagoIndividual(idCargo) {
    const cargo = cargosGlobales.find(c => c.id_cargo === idCargo);
    if (cargo) prepararModalPago([cargo]);
}

function abrirModalPagoGeneralPaciente(idPaciente) {
    const cargosPaciente = cargosGlobales.filter(c => c.id_paciente === idPaciente);
    if (cargosPaciente.length > 0) prepararModalPago(cargosPaciente);
}

function prepararModalPago(listaCargos) {
    cargosSeleccionadosParaPago = listaCargos;
    const primerCargo = listaCargos[0];

    document.getElementById('txtPagoIdPaciente').value = primerCargo.id_paciente;
    document.getElementById('txtPagoIdFamiliar').value = primerCargo.id_familiar || 1;
    document.getElementById('lblPagoPaciente').textContent = primerCargo.paciente_nombre;
    document.getElementById('lblPagoFamiliar').textContent = primerCargo.familiar_nombre;
    document.getElementById('lblCantidadCargos').textContent = `${listaCargos.length} ${listaCargos.length === 1 ? 'cuenta' : 'cuentas consolidadas'}`;
    document.getElementById('txtDescuentoAdicional').value = '0.00';

    const listaHtml = document.getElementById('listaCargosCobro');
    listaHtml.innerHTML = listaCargos.map(c => `
        <li class="list-group-item d-flex justify-content-between align-items-center small py-2">
            <div>
                <span class="me-1">${obtenerBadgeConcepto(c.concepto)}</span> ${c.descripcion}
            </div>
            <span class="fw-bold text-dark">Q${parseFloat(c.monto).toFixed(2)}</span>
        </li>
    `).join('');

    recalcularTotalPago();

    const modal = new bootstrap.Modal(document.getElementById('modalProcesarPago'));
    modal.show();
}

function recalcularTotalPago() {
    const subtotal = cargosSeleccionadosParaPago.reduce((acc, c) => acc + parseFloat(c.monto), 0);
    const descuentoInput = parseFloat(document.getElementById('txtDescuentoAdicional').value) || 0;
    const descuentoAplicado = Math.min(subtotal, Math.max(0, descuentoInput));
    const totalFinal = Math.max(0, subtotal - descuentoAplicado);

    document.getElementById('lblSubtotalPago').textContent = `Q${subtotal.toFixed(2)}`;
    document.getElementById('lblTotalFinalPago').textContent = `Q${totalFinal.toFixed(2)}`;
}

async function procesarPago(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');

    const subtotal = cargosSeleccionadosParaPago.reduce((acc, c) => acc + parseFloat(c.monto), 0);
    const descuentoInput = parseFloat(document.getElementById('txtDescuentoAdicional').value) || 0;
    const totalMontoPago = Math.max(0, subtotal - descuentoInput);

    const payload = {
        id_paciente: parseInt(document.getElementById('txtPagoIdPaciente').value),
        id_familiar: parseInt(document.getElementById('txtPagoIdFamiliar').value),
        monto: totalMontoPago,
        metodo: document.getElementById('selMetodoPago').value,
        referencia: document.getElementById('txtReferenciaPago').value.trim(),
        cargos_ids: cargosSeleccionadosParaPago.map(c => c.id_cargo)
    };

    try {
        const res = await fetch('/api/caja/pagos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Cobro registrado exitosamente!');
        bootstrap.Modal.getInstance(document.getElementById('modalProcesarPago')).hide();

        cargarResumenKpis();
        cargarCargosPendientes();
    } catch (err) {
        alert('Error al registrar cobro: ' + err.message);
    }
}

// 4. Módulo de Donaciones
async function cargarDonaciones() {
    const token = localStorage.getItem('authToken');
    const tbody = document.getElementById('tablaDonacionesBody');
    try {
        const res = await fetch('/api/caja/donaciones', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        donacionesGlobales = data.datos || [];
        if (donacionesGlobales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No se han registrado donaciones.</td></tr>`;
            return;
        }

        tbody.innerHTML = donacionesGlobales.map(d => `
            <tr>
                <td>${new Date(d.fecha).toLocaleDateString()}</td>
                <td class="fw-bold">${d.nombre_donante}</td>
                <td><span class="badge bg-info text-capitalize">${d.tipo_donante}</span></td>
                <td class="fw-bold text-success">Q${parseFloat(d.monto).toFixed(2)}</td>
                <td>${d.registrado_por}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error: ${err.message}</td></tr>`;
    }
}

async function guardarDonacion(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');

    const payload = {
        nombre_donante: document.getElementById('txtNombreDonante').value.trim(),
        tipo_donante: document.getElementById('selTipoDonante').value,
        monto: parseFloat(document.getElementById('txtMontoDonacion').value),
        fecha: document.getElementById('txtFechaDonacion').value
    };

    try {
        const res = await fetch('/api/caja/donaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Donación registrada con éxito!');
        document.getElementById('formNuevaDonacion').reset();
        bootstrap.Modal.getInstance(document.getElementById('modalNuevaDonacion')).hide();

        cargarResumenKpis();
        cargarDonaciones();
    } catch (err) {
        alert('Error al guardar donación: ' + err.message);
    }
}

// 5. Módulo de Gastos Operativos
async function cargarGastos() {
    const token = localStorage.getItem('authToken');
    const tbody = document.getElementById('tablaGastosBody');
    try {
        const res = await fetch('/api/caja/gastos', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        gastosGlobales = data.datos || [];
        if (gastosGlobales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay gastos registrados en este período.</td></tr>`;
            return;
        }

        tbody.innerHTML = gastosGlobales.map(g => `
            <tr>
                <td>${new Date(g.fecha).toLocaleDateString()}</td>
                <td><span class="badge bg-warning text-dark text-capitalize">${g.categoria.replace('_', ' ')}</span></td>
                <td>${g.descripcion}</td>
                <td class="fw-bold text-danger">Q${parseFloat(g.monto).toFixed(2)}</td>
                <td>${g.registrado_por}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error: ${err.message}</td></tr>`;
    }
}

async function guardarGasto(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');

    const payload = {
        categoria: document.getElementById('selCategoriaGasto').value,
        monto: parseFloat(document.getElementById('txtMontoGasto').value),
        descripcion: document.getElementById('txtDescripcionGasto').value.trim(),
        fecha: document.getElementById('txtFechaGasto').value
    };

    try {
        const res = await fetch('/api/caja/gastos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Gasto registrado con éxito!');
        document.getElementById('formNuevoGasto').reset();
        bootstrap.Modal.getInstance(document.getElementById('modalNuevoGasto')).hide();

        cargarResumenKpis();
        cargarGastos();
    } catch (err) {
        alert('Error al registrar gasto: ' + err.message);
    }
}

// 6. Pagos a la Fundación
async function cargarPagosFundacion() {
    const token = localStorage.getItem('authToken');
    const tbody = document.getElementById('tablaPagosFundacionBody');
    try {
        const res = await fetch('/api/caja/pagos-fundacion', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        const lista = data.datos || [];
        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No se han registrado pagos a la fundación.</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(pf => `
            <tr>
                <td>${new Date(pf.fecha).toLocaleDateString()}</td>
                <td class="fw-bold">${pf.fundacion_nombre}</td>
                <td>${pf.concepto}</td>
                <td class="fw-bold text-primary">Q${parseFloat(pf.monto).toFixed(2)}</td>
                <td>${pf.registrado_por}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error: ${err.message}</td></tr>`;
    }
}

async function guardarPagoFundacion(e) {
    e.preventDefault();
    const token = localStorage.getItem('authToken');

    const payload = {
        concepto: document.getElementById('txtConceptoPagoFundacion').value.trim(),
        monto: parseFloat(document.getElementById('txtMontoPagoFundacion').value),
        fecha: document.getElementById('txtFechaPagoFundacion').value
    };

    try {
        const res = await fetch('/api/caja/pagos-fundacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.mensaje);

        alert('¡Pago a la Fundación registrado con éxito!');
        document.getElementById('formNuevoPagoFundacion').reset();
        const modalElem = document.getElementById('modalNuevoPagoFundacion');
        const bsModal = bootstrap.Modal.getInstance(modalElem);
        if (bsModal) bsModal.hide();

        cargarResumenKpis();
        cargarPagosFundacion();
    } catch (err) {
        alert('Error al registrar pago a la fundación: ' + err.message);
    }
}

// Cargar resumen dinámico de la fundación al abrir el modal de pago
const modalFundacionElem = document.getElementById('modalNuevoPagoFundacion');
if (modalFundacionElem) {
    modalFundacionElem.addEventListener('show.bs.modal', async () => {
        const token = localStorage.getItem('authToken');
        try {
            const res = await fetch('/api/caja/resumen-fundacion', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();

            if (data.ok) {
                const r = data.data || data.datos;
                const setElemText = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = val;
                };

                setElemText('lblResumenConsultas', `Q${parseFloat(r.consultas || 0).toFixed(2)}`);
                setElemText('lblResumenExamenes', `Q${parseFloat(r.examenes || 0).toFixed(2)}`);
                setElemText('lblResumenFarmacia', `Q${parseFloat(r.farmacia || 0).toFixed(2)}`);
                setElemText('lblResumenTotalGenerado', `Q${parseFloat(r.totalGenerado || 0).toFixed(2)}`);
                setElemText('lblResumenTotalLiquidado', `- Q${parseFloat(r.totalLiquidado || 0).toFixed(2)}`);
                setElemText('lblResumenSaldoPendiente', `Q${parseFloat(r.saldoPendiente || 0).toFixed(2)}`);

                const inputMonto = document.getElementById('txtMontoPagoFundacion');
                if (inputMonto) inputMonto.value = parseFloat(r.saldoPendiente || 0).toFixed(2);
            }
        } catch (err) {
            console.error('Error al obtener el resumen de la fundación:', err);
        }
    });
}

// Evento para generar masivamente las cuotas del mes
const btnGenerarCuotas = document.getElementById('btnGenerarCuotasMes');
if (btnGenerarCuotas) {
    btnGenerarCuotas.addEventListener('click', async () => {
        const token = localStorage.getItem('authToken');
        if (!confirm('¿Desea generar el cobro de la cuota mensual para todos los residentes activos?')) {
            return;
        }

        try {
            const res = await fetch('/api/caja/generar-cuotas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.ok) {
                alert(data.mensaje);
                if (typeof cargarCargosPendientes === 'function') {
                    cargarCargosPendientes();
                }
            } else {
                alert('Error al generar cuotas: ' + data.mensaje);
            }
        } catch (err) {
            console.error('Error al conectar con el servidor:', err);
        }
    });
}