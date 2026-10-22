/* eslint-env browser */

document.addEventListener('DOMContentLoaded', () => {
    cargarSelectPacientes();

    const form = document.getElementById('formFiltrosReportes');
    const selectTipo = document.getElementById('selectTipoReporte');
    const selectPaciente = document.getElementById('selectPaciente');
    const btnImprimir = document.getElementById('btnImprimirReporte');

    if (selectTipo && selectPaciente) {
        selectTipo.addEventListener('change', () => {
            if (selectTipo.value === 'analisis_medico') {
                selectPaciente.setAttribute('required', 'required');
            } else {
                selectPaciente.removeAttribute('required');
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await generarReporteAPI();
        });
    }

    if (btnImprimir) {
        btnImprimir.addEventListener('click', () => {
            window.print();
        });
    }
});

async function cargarSelectPacientes() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/reportes/pacientes', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) return;

        const pacientes = await res.json();
        const select = document.getElementById('selectPaciente');
        if (!select) return;

        select.innerHTML = '<option value="">-- Todos los pacientes --</option>';

        pacientes.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id_paciente;
            opt.textContent = p.expediente + ' - ' + p.nombre_completo;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Error cargando pacientes:', err);
    }
}

async function generarReporteAPI() {
    const selectTipo = document.getElementById('selectTipoReporte');
    const selectPac = document.getElementById('selectPaciente');
    const inpInicio = document.getElementById('inputFechaInicio');
    const inpFin = document.getElementById('inputFechaFin');
    const contenedor = document.getElementById('reporteContenido');
    const btnImprimir = document.getElementById('btnImprimirReporte');

    if (!selectTipo || !selectTipo.value) return;

    const tipo = selectTipo.value;
    const paciente = selectPac ? selectPac.value : '';
    const desde = inpInicio ? inpInicio.value : '';
    const hasta = inpFin ? inpFin.value : '';

    contenedor.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Generando reporte...</p></div>';

    try {
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams({ tipo: tipo, id_paciente: paciente, fecha_inicio: desde, fecha_fin: hasta });

        const res = await fetch('/api/reportes/generar?' + params.toString(), {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            const err = await res.json();
            contenedor.innerHTML = '<div class="alert alert-danger">' + (err.mensaje || 'Error al generar el reporte') + '</div>';
            if (btnImprimir) btnImprimir.disabled = true;
            return;
        }

        const data = await res.json();
        renderizarDocumentoReporte(data);
        if (btnImprimir) btnImprimir.disabled = false;

    } catch (err) {
        console.error('Error al generar reporte:', err);
        contenedor.innerHTML = '<div class="alert alert-danger">Error de conexión con el servidor.</div>';
        if (btnImprimir) btnImprimir.disabled = true;
    }
}

function renderizarHeaderReporte(titulo) {
    const hoy = new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' });
    return '<div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">' +
        '<div class="d-flex align-items-center gap-3">' +
            '<img src="imagenes/logo.png" alt="Logo" style="width: 70px; height: 70px; object-fit: contain;">' +
            '<div>' +
                '<h3 class="fw-bold mb-0 text-primary">Asilo Cabeza de Algodón</h3>' +
                '<p class="text-muted small mb-0">Sistema de Gestión Residencial y Médica</p>' +
            '</div>' +
        '</div>' +
        '<div class="text-end">' +
            '<h5 class="fw-bold mb-1">' + titulo + '</h5>' +
            '<p class="text-muted small mb-0">Fecha de emisión: ' + hoy + '</p>' +
        '</div>' +
    '</div>';
}

function renderizarDocumentoReporte(payload) {
    const tipo = payload.tipo;
    const datos = payload.datos;
    const contenedor = document.getElementById('reporteContenido');
    const fmtQ = function(m) {
        return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(m || 0);
    };

    if (tipo === 'costos_cita') {
        let totalGeneral = 0;
        let html = renderizarHeaderReporte('Informe Estadístico de Costos por Cita');
        html += '<table class="table table-bordered align-middle">';
        html += '<thead class="table-light"><tr><th>Fecha</th><th>Expediente</th><th>Paciente</th><th>Médico</th><th class="text-end">Consulta</th><th class="text-end">Exámenes</th><th class="text-end">Medicamentos</th><th class="text-end">Total Cita</th></tr></thead>';
        html += '<tbody>';
        
        if (!datos || datos.length === 0) {
            html += '<tr><td colspan="8" class="text-center py-3">No se encontraron registros en el rango seleccionado.</td></tr>';
        } else {
            datos.forEach(function(d) {
                const totalCita = Number(d.costo_consulta) + Number(d.costo_examenes) + Number(d.costo_medicamentos);
                totalGeneral += totalCita;
                html += '<tr>' +
                    '<td>' + new Date(d.fecha_visita).toLocaleDateString() + '</td>' +
                    '<td><span class="badge bg-secondary">' + d.expediente + '</span></td>' +
                    '<td>' + d.paciente + '</td>' +
                    '<td>' + d.medico + '</td>' +
                    '<td class="text-end">' + fmtQ(d.costo_consulta) + '</td>' +
                    '<td class="text-end">' + fmtQ(d.costo_examenes) + '</td>' +
                    '<td class="text-end">' + fmtQ(d.costo_medicamentos) + '</td>' +
                    '<td class="text-end fw-bold text-success">' + fmtQ(totalCita) + '</td>' +
                '</tr>';
            });
        }
        html += '</tbody>';
        html += '<tfoot class="table-light fw-bold"><tr><td colspan="7" class="text-end">TOTAL ACUMULADO:</td><td class="text-end text-success">' + fmtQ(totalGeneral) + '</td></tr></tfoot></table>';
        contenedor.innerHTML = html;
    }

    else if (tipo === 'analisis_medico') {
        if (!datos) {
            contenedor.innerHTML = '<div class="alert alert-warning">No se encontró información para el paciente seleccionado.</div>';
            return;
        }
        const paciente = datos.paciente;
        const psicopatologias = datos.psicopatologias;
        const medicamentosFrecuentes = datos.medicamentosFrecuentes;
        const historialVisitas = datos.historialVisitas;

        let html = renderizarHeaderReporte('Ficha Clínica y Análisis Médico - ' + paciente.paciente);
        
        let psicoHtml = '<li>Ninguna registrada</li>';
        if (psicopatologias && psicopatologias.length) {
            psicoHtml = psicopatologias.map(function(p) {
                return '<li><strong>' + p.descripcion + ':</strong> Nivel ' + p.nivel + '</li>';
            }).join('');
        }

        let medFrecHtml = '<tr><td colspan="4" class="text-center">Sin medicamentos frecuentes asignados</td></tr>';
        if (medicamentosFrecuentes && medicamentosFrecuentes.length) {
            medFrecHtml = medicamentosFrecuentes.map(function(m) {
                return '<tr><td>' + m.nombre + '</td><td>' + m.dosis + '</td><td>' + m.frecuencia + '</td><td>' + m.via + '</td></tr>';
            }).join('');
        }

        let visHtml = '<tr><td colspan="4" class="text-center">Sin consultas registradas</td></tr>';
        if (historialVisitas && historialVisitas.length) {
            visHtml = historialVisitas.map(function(v) {
                return '<tr><td>' + new Date(v.fecha_visita).toLocaleDateString() + '</td><td>' + v.medico + '</td><td>' + (v.motivo_visita || 'Consulta') + '</td><td>' + (v.diagnostico || 'Sin diagnóstico') + '</td></tr>';
            }).join('');
        }

        html += '<div class="row g-3 mb-4">' +
            '<div class="col-md-6">' +
                '<div class="p-3 border rounded bg-light">' +
                    '<h6 class="fw-bold text-primary mb-2"><i class="bi bi-person-vcard me-2"></i>Datos del Residente</h6>' +
                    '<p class="mb-1"><strong>Expediente:</strong> ' + paciente.expediente + ' | <strong>DPI:</strong> ' + paciente.dpi + '</p>' +
                    '<p class="mb-1"><strong>Ingreso:</strong> ' + new Date(paciente.fecha_ingreso).toLocaleDateString() + ' | <strong>Sangre:</strong> ' + (paciente.grupo_sanguineo || 'N/R') + '</p>' +
                    '<p class="mb-0"><strong>Motivo / Causa de Recluimiento:</strong> ' + (paciente.motivo_recluimiento || 'Sin observaciones de ingreso') + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="col-md-6">' +
                '<div class="p-3 border rounded bg-light">' +
                    '<h6 class="fw-bold text-primary mb-2"><i class="bi bi-brain me-2"></i>Psicopatologías & Padecimientos</h6>' +
                    '<ul class="mb-0 small ps-3">' + psicoHtml + '</ul>' +
                '</div>' +
            '</div>' +
        '</div>' +

        '<h6 class="fw-bold text-primary mb-2"><i class="bi bi-capsule me-2"></i>Medicamentos Frecuentes / Habituales</h6>' +
        '<table class="table table-sm table-bordered mb-4">' +
            '<thead class="table-light"><tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Vía</th></tr></thead>' +
            '<tbody>' + medFrecHtml + '</tbody>' +
        '</table>' +

        '<h6 class="fw-bold text-primary mb-2"><i class="bi bi-journal-medical me-2"></i>Historial de Consultas & Diagnósticos</h6>' +
        '<table class="table table-sm table-bordered">' +
            '<thead class="table-light"><tr><th>Fecha</th><th>Médico</th><th>Motivo</th><th>Diagnóstico</th></tr></thead>' +
            '<tbody>' + visHtml + '</tbody>' +
        '</table>';

        contenedor.innerHTML = html;
    }

    else if (tipo === 'cobros_paciente') {
        let total = 0;
        let html = renderizarHeaderReporte('Reporte de Cobros y Gastos Médicos por Paciente');
        html += '<table class="table table-bordered align-middle"><thead class="table-light"><tr><th>Fecha</th><th>Expediente</th><th>Paciente</th><th>Concepto</th><th>Descripción</th><th>Familiar</th><th>Monto</th></tr></thead><tbody>';
        if (!datos || datos.length === 0) {
            html += '<tr><td colspan="7" class="text-center py-3">No hay cobros registrados en este periodo.</td></tr>';
        } else {
            datos.forEach(function(c) {
                total += Number(c.monto);
                html += '<tr><td>' + new Date(c.fecha).toLocaleDateString() + '</td><td><span class="badge bg-secondary">' + c.expediente + '</span></td><td>' + c.paciente + '</td><td><span class="text-uppercase fw-semibold">' + c.concepto + '</span></td><td>' + c.descripcion + '</td><td>' + c.familiar_responsable + '</td><td class="text-end fw-bold">' + fmtQ(c.monto) + '</td></tr>';
            });
        }
        html += '</tbody><tfoot class="table-light fw-bold"><tr><td colspan="6" class="text-end">TOTAL COBROS:</td><td class="text-end text-success">' + fmtQ(total) + '</td></tr></tfoot></table>';
        contenedor.innerHTML = html;
    }

    else if (tipo === 'pagos_fundacion') {
        let total = 0;
        let html = renderizarHeaderReporte('Reporte de Pagos y Liquidaciones a la Fundación');
        html += '<table class="table table-bordered align-middle"><thead class="table-light"><tr><th>ID Pago</th><th>Fecha</th><th>Fundación</th><th>Concepto</th><th>Registrado Por</th><th class="text-end">Monto</th></tr></thead><tbody>';
        if (!datos || datos.length === 0) {
            html += '<tr><td colspan="6" class="text-center py-3">No se encontraron liquidaciones registradas.</td></tr>';
        } else {
            datos.forEach(function(p) {
                total += Number(p.monto);
                html += '<tr><td>#' + p.id_pago_fundacion + '</td><td>' + new Date(p.fecha).toLocaleDateString() + '</td><td>' + p.fundacion + '</td><td>' + p.concepto + '</td><td>' + p.registrado_por + '</td><td class="text-end fw-bold">' + fmtQ(p.monto) + '</td></tr>';
            });
        }
        html += '</tbody><tfoot class="table-light fw-bold"><tr><td colspan="5" class="text-end">TOTAL TRANSFERIDO:</td><td class="text-end text-primary">' + fmtQ(total) + '</td></tr></tfoot></table>';
        contenedor.innerHTML = html;
    }

    else if (tipo === 'entradas_donaciones') {
        const entradas = datos ? datos.entradas : [];
        const totalDonaciones = datos ? datos.totalDonaciones : 0;
        const totalPagos = datos ? datos.totalPagos : 0;
        const totalEntradas = datos ? datos.totalEntradas : 0;

        let html = renderizarHeaderReporte('Reporte Consolidado de Entradas (Donaciones y Cobros)');
        html += '<div class="row g-3 mb-4 text-center">' +
            '<div class="col-md-4"><div class="p-3 border rounded bg-light"><div class="text-muted small">Total Donaciones</div><h4 class="fw-bold text-success mb-0">' + fmtQ(totalDonaciones) + '</h4></div></div>' +
            '<div class="col-md-4"><div class="p-3 border rounded bg-light"><div class="text-muted small">Total Pagos Familiares</div><h4 class="fw-bold text-primary mb-0">' + fmtQ(totalPagos) + '</h4></div></div>' +
            '<div class="col-md-4"><div class="p-3 border rounded bg-light"><div class="text-muted small">TOTAL GENERAL ENTRADAS</div><h4 class="fw-bold text-dark mb-0">' + fmtQ(totalEntradas) + '</h4></div></div>' +
        '</div>' +
        '<table class="table table-bordered align-middle"><thead class="table-light"><tr><th>Tipo</th><th>Fecha</th><th>Origen / Fuente</th><th>Detalle / Método</th><th class="text-end">Monto</th></tr></thead><tbody>';
        
        if (!entradas || entradas.length === 0) {
            html += '<tr><td colspan="5" class="text-center py-3">No hay registros de entradas en este periodo.</td></tr>';
        } else {
            entradas.forEach(function(e) {
                const bgClass = e.tipo === 'Donación' ? 'bg-success' : 'bg-primary';
                html += '<tr><td><span class="badge ' + bgClass + '">' + e.tipo + '</span></td><td>' + new Date(e.fecha).toLocaleDateString() + '</td><td>' + e.fuente + '</td><td class="text-capitalize">' + e.detalle + '</td><td class="text-end fw-bold">' + fmtQ(e.monto) + '</td></tr>';
            });
        }
        html += '</tbody></table>';
        contenedor.innerHTML = html;
    }

    else if (tipo === 'examenes_realizados') {
        let total = 0;
        let html = renderizarHeaderReporte('Reporte de Exámenes Médicos Realizados por Paciente');
        html += '<table class="table table-bordered align-middle"><thead class="table-light"><tr><th>Fecha</th><th>Expediente</th><th>Paciente</th><th>Examen</th><th>Categoría</th><th>Resultado</th><th>Costo</th></tr></thead><tbody>';
        
        if (!datos || datos.length === 0) {
            html += '<tr><td colspan="7" class="text-center py-3">No hay exámenes registrados.</td></tr>';
        } else {
            datos.forEach(function(x) {
                total += Number(x.precio_aplicado);
                html += '<tr>' +
                    '<td>' + new Date(x.fecha_resultado).toLocaleDateString() + '</td>' +
                    '<td><span class="badge bg-secondary">' + x.expediente + '</span></td>' +
                    '<td>' + x.paciente + '</td>' +
                    '<td>' + x.examen + '</td>' +
                    '<td class="text-capitalize">' + x.categoria + '</td>' +
                    '<td><strong>' + x.resultado + '</strong></td>' +
                    '<td class="text-end fw-bold">' + fmtQ(x.precio_aplicado) + '</td>' +
                '</tr>';
            });
        }
        html += '</tbody><tfoot class="table-light fw-bold"><tr><td colspan="6" class="text-end">TOTAL EXÁMENES:</td><td class="text-end text-success">' + fmtQ(total) + '</td></tr></tfoot></table>';
        contenedor.innerHTML = html;
    }

    else if (tipo === 'medicamentos_aplicados') {
        let total = 0;
        let html = renderizarHeaderReporte('Reporte de Medicamentos Aplicados / Entregados');
        html += '<table class="table table-bordered align-middle"><thead class="table-light"><tr><th>Fecha Entrega</th><th>Expediente</th><th>Paciente</th><th>Medicamento</th><th>Dosis / Indicación</th><th class="text-center">Cant.</th><th class="text-end">Total</th></tr></thead><tbody>';
        
        if (!datos || datos.length === 0) {
            html += '<tr><td colspan="7" class="text-center py-3">No hay dispensaciones de farmacia registradas.</td></tr>';
        } else {
            datos.forEach(function(m) {
                total += Number(m.total);
                html += '<tr>' +
                    '<td>' + new Date(m.fecha_entrega).toLocaleDateString() + '</td>' +
                    '<td><span class="badge bg-secondary">' + m.expediente + '</span></td>' +
                    '<td>' + m.paciente + '</td>' +
                    '<td>' + m.medicamento + '</td>' +
                    '<td>' + m.dosis + ' (' + (m.indicaciones || 's/i') + ')</td>' +
                    '<td class="text-center">' + m.cantidad + '</td>' +
                    '<td class="text-end fw-bold">' + fmtQ(m.total) + '</td>' +
                '</tr>';
            });
        }
        html += '</tbody><tfoot class="table-light fw-bold"><tr><td colspan="6" class="text-end">TOTAL DESPACHADO:</td><td class="text-end text-success">' + fmtQ(total) + '</td></tr></tfoot></table>';
        contenedor.innerHTML = html;
    }
}
function formatearFecha(fechaStr) {
    if (!fechaStr) return 'N/R';
    const d = new Date(fechaStr);
    return isNaN(d) ? fechaStr : d.toLocaleDateString('es-GT', { timeZone: 'UTC' });
}