document.addEventListener('DOMContentLoaded', () => {
  const tablaBody = document.getElementById('tablaUsuariosBody');
  const formNuevoUsuario = document.getElementById('formNuevoUsuario');
  const formEditarUsuario = document.getElementById('formEditarUsuario');
  const inputBuscar = document.getElementById('inputBuscar');
  
  const statTotal = document.getElementById('statTotal');
  const statActivos = document.getElementById('statActivos');
  const statAdmins = document.getElementById('statAdmins');

  let modalEditarInstance = null;
  const modalEl = document.getElementById('modalEditarUsuario');
  if (modalEl && window.bootstrap) {
    modalEditarInstance = new bootstrap.Modal(modalEl);
  }

  let listaUsuarios = [];

  // 1. Cargar usuarios al iniciar
  cargarUsuarios();

  // 2. Búsqueda dinámina
  if (inputBuscar) {
    inputBuscar.addEventListener('input', (e) => {
      const termino = e.target.value.toLowerCase().trim();
      const filtrados = listaUsuarios.filter(u => 
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(termino) ||
        u.correo.toLowerCase().includes(termino) ||
        u.usuario.toLowerCase().includes(termino)
      );
      renderizarTabla(filtrados);
    });
  }

  // 3. Crear Usuario
  if (formNuevoUsuario) {
    formNuevoUsuario.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nuevoUsuario = {
        nombre: document.getElementById('nombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        usuario: document.getElementById('usuario').value.trim(),
        correo: document.getElementById('correo').value.trim(),
        password: document.getElementById('password').value,
        rol: document.getElementById('rol').value,
        activo: document.getElementById('activo').value
      };

      try {
        const respuesta = await fetch('/api/usuarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.authFundacion.getToken()}`
          },
          body: JSON.stringify(nuevoUsuario)
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          mostrarAlerta(datos.mensaje || 'Error al crear el usuario', 'danger');
          return;
        }

        mostrarAlerta('¡Usuario registrado con éxito!', 'success');
        formNuevoUsuario.reset();
        cargarUsuarios();

      } catch (error) {
        console.error('Error al guardar usuario:', error);
        mostrarAlerta('Error de conexión con el servidor', 'danger');
      }
    });
  }

  // 4. Guardar Edición de Usuario (PUT)
  if (formEditarUsuario) {
    formEditarUsuario.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('edit_id_usuario').value;
      const datosEditados = {
        nombre: document.getElementById('edit_nombre').value.trim(),
        apellido: document.getElementById('edit_apellido').value.trim(),
        usuario: document.getElementById('edit_usuario').value.trim(),
        correo: document.getElementById('edit_correo').value.trim(),
        rol: document.getElementById('edit_rol').value,
        password: document.getElementById('edit_password').value
      };

      try {
        const respuesta = await fetch(`/api/usuarios/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.authFundacion.getToken()}`
          },
          body: JSON.stringify(datosEditados)
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          mostrarAlerta(datos.mensaje || 'Error al actualizar usuario', 'danger');
          return;
        }

        mostrarAlerta('¡Usuario actualizado con éxito!', 'success');
        if (modalEditarInstance) modalEditarInstance.hide();
        cargarUsuarios();

      } catch (error) {
        console.error('Error al actualizar usuario:', error);
        mostrarAlerta('Error de conexión', 'danger');
      }
    });
  }

  // Carga lista de usuarios desde la API
  async function cargarUsuarios() {
    try {
      const respuesta = await fetch('/api/usuarios', {
        headers: {
          'Authorization': `Bearer ${window.authFundacion.getToken()}`
        }
      });

      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) {
          window.authFundacion.cerrarSesion();
          return;
        }
        throw new Error('Error al consultar usuarios');
      }

      listaUsuarios = await respuesta.json();
      actualizarEstadisticas(listaUsuarios);
      renderizarTabla(listaUsuarios);

    } catch (error) {
      console.error('Error:', error);
      if (tablaBody) {
        tablaBody.innerHTML = `
          <tr>
            <td colspan="5" class="text-center py-4 text-danger">
              <i class="bi bi-exclamation-triangle me-2"></i> No se pudieron cargar los usuarios.
            </td>
          </tr>`;
      }
    }
  }

  // Dibuja filas en la tabla
  function renderizarTabla(usuarios) {
    if (!tablaBody) return;

    if (usuarios.length === 0) {
      tablaBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            No se encontraron usuarios registrados.
          </td>
        </tr>`;
      return;
    }

    tablaBody.innerHTML = usuarios.map(u => {
      const iniciales = `${(u.nombre || '')[0] || ''}${(u.apellido || '')[0] || ''}`.toUpperCase();
      const esActivo = Boolean(u.activo);
      const rolEtiqueta = obtenerEtiquetaRol(u.rol);

      return `
        <tr>
          <td>
            <div class="d-flex align-items-center gap-2">
              <div class="avatar-user" style="background-color: var(--brand);">${iniciales}</div>
              <div>
                <div class="fw-semibold">${u.nombre} ${u.apellido}</div>
                <small class="text-muted">@${u.usuario}</small>
              </div>
            </div>
          </td>
          <td>${u.correo}</td>
          <td><span class="role-badge role-${u.rol}">${rolEtiqueta}</span></td>
          <td>
            <span class="${esActivo ? 'badge-status-activo' : 'badge-status-inactivo'}">
              ${esActivo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="text-end">
            <!-- Botón Editar -->
            <button class="btn-icon-action neutral me-1" 
                    title="Editar" 
                    onclick="abrirModalEditar(${u.id_usuario})">
              <i class="bi bi-pencil"></i>
            </button>
            <!-- Botón Cambiar Estado -->
            <button class="btn-icon-action ${esActivo ? 'reject' : 'approve'}" 
                    title="${esActivo ? 'Desactivar' : 'Activar'}" 
                    onclick="cambiarEstadoUsuario(${u.id_usuario}, ${!esActivo})">
              <i class="bi ${esActivo ? 'bi-slash-circle' : 'bi-check-circle'}"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Función global para llenar y abrir el Modal de Edición
  window.abrirModalEditar = function(id) {
    const usuario = listaUsuarios.find(u => u.id_usuario === id);
    if (!usuario) return;

    document.getElementById('edit_id_usuario').value = usuario.id_usuario;
    document.getElementById('edit_nombre').value = usuario.nombre || '';
    document.getElementById('edit_apellido').value = usuario.apellido || '';
    document.getElementById('edit_usuario').value = usuario.usuario || '';
    document.getElementById('edit_correo').value = usuario.correo || '';
    document.getElementById('edit_rol').value = usuario.rol || 'enfermero';
    document.getElementById('edit_password').value = ''; // Limpio por seguridad

    if (!modalEditarInstance && window.bootstrap) {
      modalEditarInstance = new bootstrap.Modal(document.getElementById('modalEditarUsuario'));
    }
    if (modalEditarInstance) modalEditarInstance.show();
  };

  // Función global para Cambiar Estado (Activar/Desactivar)
  window.cambiarEstadoUsuario = async function(id, nuevoEstado) {
    try {
      const respuesta = await fetch(`/api/usuarios/${id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.authFundacion.getToken()}`
        },
        body: JSON.stringify({ activo: nuevoEstado })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        mostrarAlerta(datos.mensaje || 'No se pudo cambiar el estado', 'danger');
        return;
      }

      mostrarAlerta('Estado del usuario actualizado correctamente', 'success');
      cargarUsuarios();

    } catch (error) {
      console.error('Error al cambiar estado:', error);
      mostrarAlerta('Error de conexión', 'danger');
    }
  };

  function actualizarEstadisticas(usuarios) {
    if (statTotal) statTotal.textContent = usuarios.length;
    if (statActivos) statActivos.textContent = usuarios.filter(u => u.activo).length;
    if (statAdmins) statAdmins.textContent = usuarios.filter(u => u.rol === 'admin').length;
  }

  function obtenerEtiquetaRol(rol) {
    const rolesMap = {
      'admin': 'Administrador',
      'medico_general': 'Médico General',
      'especialista': 'Especialista',
      'enfermero': 'Enfermero/a',
      'laboratorio': 'Laboratorio',
      'farmacia': 'Farmacia',
      'caja': 'Caja'
    };
    return rolesMap[rol] || rol;
  }

  function mostrarAlerta(mensaje, tipo) {
    const alertMensaje = document.getElementById('alertMensaje');
    const alertTexto = document.getElementById('alertTexto');
    if (alertMensaje && alertTexto) {
      alertTexto.textContent = mensaje;
      alertMensaje.className = `alert alert-${tipo} alert-dismissible fade show`;
      alertMensaje.classList.remove('d-none');
      setTimeout(() => alertMensaje.classList.add('d-none'), 4000);
    }
  }
});