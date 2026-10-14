document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const btnLogin = document.getElementById('btnLogin');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  const toggleIcon = document.getElementById('toggleIcon');

  // Redirigir si ya hay sesión activa
  const tokenExistente = localStorage.getItem('authToken');
  const usuarioExistente = localStorage.getItem('authUsuario');

  if (tokenExistente && usuarioExistente) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Ocultar / Mostrar contraseña
  if (btnTogglePassword) {
    btnTogglePassword.addEventListener('click', () => {
      const esPassword = passwordInput.type === 'password';
      passwordInput.type = esPassword ? 'text' : 'password';
      if (toggleIcon) {
        toggleIcon.classList.toggle('bi-eye-fill', !esPassword);
        toggleIcon.classList.toggle('bi-eye-slash-fill', esPassword);
      }
    });
  }

  // Envío del formulario
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    ocultarError();

    const correo = emailInput.value.trim();
    const password = passwordInput.value;

    if (!correo || !password) {
      mostrarError('Por favor ingrese su correo y contraseña.');
      return;
    }

    ponerCargando(true);

    try {
      const respuesta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        mostrarError(datos.mensaje || 'No se pudo iniciar sesión.');
        ponerCargando(false);
        return;
      }

      // Guardar token y datos del usuario en sesión local
      localStorage.setItem('authToken', datos.token);
      localStorage.setItem('authUsuario', JSON.stringify(datos.usuario));

      window.location.href = 'dashboard.html';

    } catch (error) {
      console.error('Error de red al iniciar sesión:', error);
      mostrarError('No se pudo conectar con el servidor. Intente de nuevo.');
      ponerCargando(false);
    }
  });

  function mostrarError(texto) {
    if (errorMessage && errorAlert) {
      errorMessage.textContent = texto;
      errorAlert.style.display = 'block';
    }
  }

  function ocultarError() {
    if (errorAlert) errorAlert.style.display = 'none';
  }

  function ponerCargando(cargando) {
    if (btnLogin) btnLogin.disabled = cargando;
    if (btnText) btnText.style.display = cargando ? 'none' : 'inline-flex';
    if (btnSpinner) btnSpinner.style.display = cargando ? 'inline-block' : 'none';
  }
});