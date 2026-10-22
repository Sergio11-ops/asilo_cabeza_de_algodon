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

  // Elementos de Recuperación de Contraseña
  const formPaso1 = document.getElementById('formPaso1Recuperar');
  const formPaso2 = document.getElementById('formPaso2Recuperar');
  const alertPaso1 = document.getElementById('alertPaso1');
  const alertPaso2 = document.getElementById('alertPaso2');
  let correoRecuperacionActivo = '';

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

  // Envío del formulario de Login
  form?.addEventListener('submit', async (evento) => {
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

  // PASO 1: Solicitar PIN de Recuperación
  formPaso1?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertPaso1) alertPaso1.style.display = 'none';

    const correo = document.getElementById('txtCorreoRecuperacion').value.trim();

    try {
      const res = await fetch('/api/auth/solicitar-recuperacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje);

      correoRecuperacionActivo = correo;
      alert(data.mensaje + (data.pin_prueba ? `\n\nPIN de Prueba: ${data.pin_prueba}` : ''));

      // Transición al Paso 2
      formPaso1.style.display = 'none';
      formPaso2.style.display = 'block';

    } catch (err) {
      if (alertPaso1) {
        alertPaso1.textContent = err.message;
        alertPaso1.style.display = 'block';
      }
    }
  });

  // PASO 2: Validar PIN y Restablecer Contraseña
  formPaso2?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertPaso2) alertPaso2.style.display = 'none';

    const pin = document.getElementById('txtPinVerificacion').value.trim();
    const nuevaPassword = document.getElementById('txtNuevaPassword').value;
    const confirmPass = document.getElementById('txtConfirmarNuevaPassword').value;

    if (nuevaPassword !== confirmPass) {
      if (alertPaso2) {
        alertPaso2.textContent = 'Las contraseñas no coinciden.';
        alertPaso2.style.display = 'block';
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/restablecer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: correoRecuperacionActivo,
          pin,
          nuevaPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje);

      alert(data.mensaje);

      // Cerrar modal y restablecer vista
      const modalEl = document.getElementById('modalRecuperarPassword');
      if (typeof bootstrap !== 'undefined') {
        const modalInst = bootstrap.Modal.getInstance(modalEl);
        if (modalInst) modalInst.hide();
      }

      formPaso2.reset();
      formPaso1.reset();
      formPaso2.style.display = 'none';
      formPaso1.style.display = 'block';

    } catch (err) {
      if (alertPaso2) {
        alertPaso2.textContent = err.message;
        alertPaso2.style.display = 'block';
      }
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