document.addEventListener('DOMContentLoaded', () => {
  // 1. Validar autenticación
  const token = localStorage.getItem('token');
  const usuarioGuardado = localStorage.getItem('usuario');

  if (!token || !usuarioGuardado) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Desplegar datos del usuario activo
  const usuario = JSON.parse(usuarioGuardado);
  const badgeRol = document.getElementById('userRoleBadge');
  const spanNombre = document.getElementById('userNombre');

  if (badgeRol) badgeRol.textContent = `Rol: ${usuario.rol || 'Usuario'}`;
  if (spanNombre) spanNombre.textContent = usuario.nombre || usuario.correo;

  // 3. Redirecciones al hacer clic en las tarjetas
  const cardPacientes = document.getElementById('cardPacientes');
  if (cardPacientes) {
    cardPacientes.addEventListener('click', () => {
      window.location.href = 'registro_paciente.html';
    });
  }

  // 4. Lógica de Cierre de Sesión
  const btnCerrarSesion = document.getElementById('btnCerrarSesion');
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = 'login.html';
    });
  }
});