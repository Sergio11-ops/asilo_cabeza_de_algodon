document.getElementById('formNuevoUsuario').addEventListener('submit', async function (e) {
  e.preventDefault();

  const datosUsuario = {
    nombre: document.getElementById('nombreUsuario').value,
    correo: document.getElementById('correoUsuario').value,
    password: document.getElementById('passwordUsuario').value,
    rol: document.getElementById('rolUsuario').value
  };

  try {
    const respuesta = await fetchAutenticado('/api/usuarios/crear', {
      method: 'POST',
      body: JSON.stringify(datosUsuario)
    });

    const resultado = await respuesta.json();

    if (respuesta.ok) {
      alert('✅ Usuario creado correctamente');
      document.getElementById('formNuevoUsuario').reset();
    } else if (respuesta.status === 409) {
      alert('❌ Ya existe un usuario con ese correo.');
    } else if (respuesta.status === 403) {
      alert('❌ No tienes permiso para crear usuarios.');
    } else {
      alert('❌ Error: ' + resultado.mensaje);
    }
  } catch (error) {
    alert('❌ Error al conectar con el servidor backend');
  }
});