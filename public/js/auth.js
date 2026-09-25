// js/auth.js
// Se incluye en TODAS las páginas internas (dashboard, pacientes, farmacia, etc.)
// Protege el acceso, oculta lo que el rol no puede ver, y controla el logout.

(function () {
  const token = localStorage.getItem('authToken');
  const usuarioGuardado = localStorage.getItem('authUsuario');

  // 1. Sin token, expirado, o usuario corrupto -> limpiar y quedarse en login (sin rebotar)
  if (!token || tokenExpirado(token)) {
    cerrarSesion();
    return;
  }

  let usuario;
  try {
    usuario = JSON.parse(usuarioGuardado);
    if (!usuario || !usuario.rol) throw new Error('Usuario inválido');
    usuario.rol = usuario.rol.trim().toLowerCase(); // normalizamos por si quedó en mayúsculas
  } catch {
    cerrarSesion();
    return;
  }

  // 2. El rol del usuario no tiene permiso para ESTA página -> al dashboard
  //    (a menos que YA estemos en el dashboard, para no crear un loop de recarga)
  const rolesPagina = (document.body.dataset.paginaRoles || '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  const yaEstoyEnDashboard = /dashboard\.html$/.test(window.location.pathname);

  if (rolesPagina.length && !rolesPagina.includes(usuario.rol)) {
    if (yaEstoyEnDashboard) {
      // Algo está mal configurado (el rol no calza ni con el dashboard, que acepta todos los roles).
      // En vez de recargar infinitamente, avisamos y cerramos sesión.
      console.error('El rol "' + usuario.rol + '" no coincide con ningún rol esperado. Cerrando sesión.');
      cerrarSesion();
      return;
    }
    window.location.href = 'dashboard.html';
    return;
  }

  // 3. Todo bien: preparar la página una vez cargado el DOM
  document.addEventListener('DOMContentLoaded', () => {
    filtrarMenuPorRol(usuario.rol);
    mostrarDatosUsuario(usuario);
    activarLogout();
  });

  // ---------- Funciones ----------

  function filtrarMenuPorRol(rol) {
    document.querySelectorAll('[data-roles]').forEach((elemento) => {
      const rolesPermitidos = elemento.dataset.roles.split(',').map((r) => r.trim().toLowerCase());
      if (!rolesPermitidos.includes(rol)) {
        elemento.style.display = 'none';
      }
    });
  }

  function mostrarDatosUsuario(usuario) {
    const nombreEl = document.getElementById('userNombre');
    if (nombreEl) {
      // Solo el primer nombre para no romper el saludo
      nombreEl.textContent = usuario.nombre ? usuario.nombre.split(' ')[0] : 'Usuario';
    }
  }

  function activarLogout() {
    const btnLogout = document.getElementById('btnCerrarSesion');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        cerrarSesion();
      });
    }
  }

  function cerrarSesion() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsuario');
    window.location.href = 'login.html';
  }

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

  // Expuesto por si otras páginas (dashboard.js, etc.) necesitan el token o el usuario actual
  window.authFundacion = {
    getToken: () => localStorage.getItem('authToken'),
    getUsuario: () => usuario,
    cerrarSesion
  };
})();