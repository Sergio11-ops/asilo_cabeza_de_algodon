// js/auth.js - Proteger rutas internas y controlar sesión en Frontend

(function () {
  const token = localStorage.getItem('authToken');
  const usuarioGuardado = localStorage.getItem('authUsuario');

  // 1. Validar que exista token y no esté expirado
  if (!token || tokenExpirado(token)) {
    cerrarSesion();
    return;
  }

  let usuario;
  try {
    usuario = JSON.parse(usuarioGuardado);
    if (!usuario || !usuario.rol) throw new Error('Usuario inválido');
    usuario.rol = usuario.rol.trim().toLowerCase();
  } catch {
    cerrarSesion();
    return;
  }

  // 2. Verificar si la página actual exige ciertos roles
  const rolesPagina = (document.body.dataset.paginaRoles || '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);

  const enDashboard = /dashboard\.html$/.test(window.location.pathname);

  if (rolesPagina.length && !rolesPagina.includes(usuario.rol)) {
    if (enDashboard) {
      cerrarSesion();
      return;
    }
    window.location.href = 'dashboard.html';
    return;
  }

  // 3. Ocultar opciones según permisos y activar logout al cargar el DOM
  document.addEventListener('DOMContentLoaded', () => {
    filtrarMenuPorRol(usuario.rol);
    mostrarNombreUsuario(usuario);
    activarLogout();
  });

  // ---------- Funciones auxiliares ----------

  function filtrarMenuPorRol(rol) {
    document.querySelectorAll('[data-roles]').forEach((elem) => {
      const rolesPermitidos = elem.dataset.roles.split(',').map((r) => r.trim().toLowerCase());
      if (!rolesPermitidos.includes(rol)) {
        elem.style.display = 'none';
      }
    });
  }

  function mostrarNombreUsuario(u) {
    const el = document.getElementById('userNombre');
    if (el) el.textContent = u.nombre ? u.nombre.split(' ')[0] : 'Usuario';
  }

  function activarLogout() {
    const btn = document.getElementById('btnCerrarSesion');
    if (btn) btn.addEventListener('click', cerrarSesion);
  }

  function cerrarSesion() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsuario');
    window.location.href = 'login.html';
  }

  function tokenExpirado(t) {
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? Date.now() >= payload.exp * 1000 : false;
    } catch {
      return true;
    }
  }

  window.authFundacion = {
    getToken: () => localStorage.getItem('authToken'),
    getUsuario: () => usuario,
    cerrarSesion
  };a
})();