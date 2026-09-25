// js/login.js
// Maneja el envío del formulario de inicio de sesión contra el backend (server.js)

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

  // Si ya hay una sesión activa y válida (token Y usuario), mandar directo al dashboard
  const tokenExistente = localStorage.getItem('authToken');
  const usuarioExistente = localStorage.getItem('authUsuario');
  const sesionValida = tokenExistente && !tokenExpirado(tokenExistente) && usuarioValido(usuarioExistente);

  if (sesionValida) {
    window.location.href = 'dashboard.html';
    return;
  } else if (tokenExistente || usuarioExistente) {
    // Había restos de una sesión incompleta o corrupta: los limpiamos para no arrastrar el problema
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsuario');
  }

  // Mostrar / ocultar contraseña
  btnTogglePassword.addEventListener('click', () => {
    const esPassword = passwordInput.type === 'password';
    passwordInput.type = esPassword ? 'text' : 'password';
    toggleIcon.classList.toggle('bi-eye-fill', !esPassword);
    toggleIcon.classList.toggle('bi-eye-slash-fill', esPassword);
  });

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

      // Guardar sesión en el navegador
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
    errorMessage.textContent = texto;
    errorAlert.style.display = 'block';
  }

  function ocultarError() {
    errorAlert.style.display = 'none';
  }

  function ponerCargando(cargando) {
    btnLogin.disabled = cargando;
    btnText.style.display = cargando ? 'none' : 'inline-flex';
    btnSpinner.style.display = cargando ? 'inline-block' : 'none';
  }

  // Revisa si un JWT ya expiró leyendo su payload (sin verificar firma, solo lectura local)
  function tokenExpirado(token) {
    try {
      const payload = decodificarPayloadJWT(token);
      if (!payload.exp) return false;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  // Los JWT usan Base64URL (con "-" y "_" en vez de "+" y "/"), así que hay que
  // normalizarlo antes de usar atob(), o la decodificación falla o sale corrupta.
  function decodificarPayloadJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const base64Completo = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const textoDecodificado = decodeURIComponent(
      atob(base64Completo)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(textoDecodificado);
  }

  function usuarioValido(usuarioJSON) {
    try {
      const usuario = JSON.parse(usuarioJSON);
      return Boolean(usuario && usuario.rol);
    } catch {
      return false;
    }
  }
});