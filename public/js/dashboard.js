document.addEventListener('DOMContentLoaded', () => {
    let fechaActual = new Date();

    function renderizarCalendario(fecha) {
        const calTitulo = document.getElementById('calTituloMesAno');
        const calCuerpo = document.getElementById('calCuerpoDias');
        if (!calTitulo || !calCuerpo) return;

        const anio = fecha.getFullYear();
        const mes = fecha.getMonth();

        const nombresMeses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        calTitulo.textContent = `${nombresMeses[mes]} ${anio}`;

        const primerDiaSemana = new Date(anio, mes, 1).getDay();
        const totalDiasMes = new Date(anio, mes + 1, 0).getDate();
        const diasMesAnterior = new Date(anio, mes, 0).getDate();

        let indiceInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

        let html = '<tr>';
        let contadorCelda = 0;

        for (let i = indiceInicio - 1; i >= 0; i--) {
            html += `<td class="muted">${diasMesAnterior - i}</td>`;
            contadorCelda++;
        }

        const hoy = new Date();

        for (let dia = 1; dia <= totalDiasMes; dia++) {
            if (contadorCelda % 7 === 0 && contadorCelda > 0) {
                html += '</tr><tr>';
            }

            const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();

            html += `<td class="${esHoy ? 'today' : ''}">
                        <span>${dia}</span>
                     </td>`;
            contadorCelda++;
        }

        let diaSiguiente = 1;
        while (contadorCelda % 7 !== 0) {
            html += `<td class="muted">${diaSiguiente++}</td>`;
            contadorCelda++;
        }

        html += '</tr>';
        calCuerpo.innerHTML = html;
    }

    renderizarCalendario(fechaActual);

    document.getElementById('btnCalPrev')?.addEventListener('click', () => {
        fechaActual.setMonth(fechaActual.getMonth() - 1);
        renderizarCalendario(fechaActual);
    });

    document.getElementById('btnCalNext')?.addEventListener('click', () => {
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        renderizarCalendario(fechaActual);
    });

    // Cargar métricas dinámicas
    cargarKPIsReales();
});

async function cargarKPIsReales() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/dashboard/kpis', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            console.error('Error HTTP al obtener KPIs:', res.status, res.statusText);
            return;
        }

        const data = await res.json();

        const elPacientes = document.getElementById('kpiPacientesActivos');
        const elCitas = document.getElementById('kpiCitasHoy');
        const elConsultas = document.getElementById('kpiConsultasMes');
        const elDonaciones = document.getElementById('kpiDonacionesMes');

        if (elPacientes) elPacientes.textContent = data.pacientesActivos;
        if (elCitas) elCitas.textContent = data.citasHoy;
        if (elConsultas) elConsultas.textContent = data.consultasMes;
        if (elDonaciones) {
            const formateado = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(data.donacionesMes);
            elDonaciones.textContent = formateado;
        }

    } catch (error) {
        console.error('Error al conectar con la API de KPIs:', error);
    }
}