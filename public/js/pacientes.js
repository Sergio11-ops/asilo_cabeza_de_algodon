// js/pacientes.js
// Se encarga SOLO de la lógica de registro_paciente.html:
// listar pacientes desde /api/pacientes y guardar nuevos con /api/pacientes/registrar.
// Depende de que js/auth.js ya haya corrido antes (usa window.authFundacion).

document.addEventListener('DOMContentLoaded', () => {
  const tablaPacientes = document.getElementById('tablaPacientes');
  const form = document.getElementById('formRegistroPaciente');
  const errorAlert = document.getElementById('errorAlertPaciente');
  const errorMessage = document.getElementById('errorMessagePaciente');
  const btnGuardar = document.getElementById('btnGuardarPaciente');

  cargarPacientes();

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    ocultarError();

    const cuerpo = {
      nombrePaciente: valorDe('nombrePaciente'),
      fechaNacimiento: valorDe('fechaNacimiento'),
      genero: valorDe('genero'),
      dpi: valorDe('dpi'),
      telefonoContacto: valorDe('telefonoContacto'),
      fechaIngreso: valorDe('fechaIngreso'),
      nombreContactoEmergencia: valorDe('nombreContactoEmergencia'),
      telefonoContactoEmergencia: valorDe('telefonoContactoEmergencia'),
      diagnosticoPrincipal: valorDe('diagnosticoPrincipal'),
      estado: valorDe('estado'),
      observaciones: valorDe('observaciones')
    };

    if (!cuerpo.nombrePaciente || !cuerpo.fechaNacimiento || !cuerpo.genero || !cuerpo.fechaIngreso ||
        !cuerpo.nombreContactoEmergencia || !cuerpo.telefonoContactoEmergencia) {
      mostrarError('Por favor complete los campos obligatorios del paciente y del contacto de emergencia.');
      return;
    }

    ponerCargando(true);

    try {
      const respuesta = await fetch('/api/pacientes/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + window.authFundacion.getToken()
        },
        body: JSON.stringify(cuerpo)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        mostrarError(datos.mensaje || 'No se pudo registrar el paciente.');
        ponerCargando(false);
        return;
      }

      form.reset();
      await cargarPacientes();

    } catch (error) {
      console.error('Error de red al registrar paciente:', error);
      mostrarError('No se pudo conectar con el servidor. Intente de nuevo.');
    } finally {
      ponerCargando(false);
    }
  });

  async function cargarPacientes() {
    tablaPacientes.innerHTML = `
      <tr><td colspan="6" class="text-center text-muted py-4">Cargando pacientes...</td></tr>
    `;

    try {
      const respuesta = await fetch('/api/pacientes', {
        headers: { Authorization: 'Bearer ' + window.authFundacion.getToken() }
      });

      if (!respuesta.ok) {
        tablaPacientes.innerHTML = `
          <tr><td colspan="6" class="text-center text-muted py-4">No se pudo cargar el listado de pacientes.</td></tr>
        `;
        return;
      }

      const pacientes = await respuesta.json();

      if (!pacientes.length) {
        tablaPacientes.innerHTML = `
          <tr><td colspan="6" class="text-center text-muted py-4">Todavía no hay pacientes registrados.</td></tr>
        `;
        return;
      }

      tablaPacientes.innerHTML = pacientes.map(filaPaciente).join('');

    } catch (error) {
      console.error('Error de red al listar pacientes:', error);
      tablaPacientes.innerHTML = `
        <tr><td colspan="6" class="text-center text-muted py-4">No se pudo conectar con el servidor.</td></tr>
      `;
    }
  }

  function filaPaciente(paciente) {
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="avatar-patient">${iniciales(paciente.nombre)}</div>
            <div class="fw-semibold">${paciente.nombre}</div>
          </div>
        </td>
        <td>${calcularEdad(paciente.fecha_nacimiento)}</td>
        <td>${paciente.telefono_contacto || paciente.telefono_contacto_emergencia || '-'}</td>
        <td>${formatearFecha(paciente.fecha_ingreso)}</td>
        <td>${badgeEstado(paciente.estado)}</td>
        <td class="text-end">
          <button class="btn-icon-action neutral" title="Ver expediente"><i class="bi bi-eye"></i></button>
          <button class="btn-icon-action neutral" title="Editar"><i class="bi bi-pencil"></i></button>
        </td>
      </tr>
    `;
  }

  function badgeEstado(estado) {
    const mapa = {
      'Activo': 'badge-status-activo',
      'Por valorar': 'badge-status-pendiente',
      'En observación': 'badge-status-observacion'
    };
    const clase = mapa[estado] || 'badge-status-activo';
    return `<span class="${clase}">${estado}</span>`;
  }

  function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return '-';
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mesDiferencia = hoy.getMonth() - nacimiento.getMonth();
    if (mesDiferencia < 0 || (mesDiferencia === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  function formatearFecha(fechaISO) {
    if (!fechaISO) return '-';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function iniciales(nombreCompleto) {
    return nombreCompleto
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0].toUpperCase())
      .join('');
  }

  function valorDe(id) {
    const elemento = document.getElementById(id);
    return elemento ? elemento.value.trim() : '';
  }

  function mostrarError(texto) {
    errorMessage.textContent = texto;
    errorAlert.style.display = 'block';
  }

  function ocultarError() {
    errorAlert.style.display = 'none';
  }

  function ponerCargando(cargando) {
    btnGuardar.disabled = cargando;
    btnGuardar.textContent = cargando ? 'Guardando...' : 'Guardar paciente';
  }
});