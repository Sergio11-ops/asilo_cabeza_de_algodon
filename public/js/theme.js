// Carga inmediata antes de renderizar para evitar parpadeos
(function () {
  const temaGuardado = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', temaGuardado);
})();

document.addEventListener('DOMContentLoaded', () => {
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  if (!btnThemeToggle) return;

  actualizarIconoTema();

  btnThemeToggle.addEventListener('click', () => {
    const temaActual = document.documentElement.getAttribute('data-theme');
    const nuevoTema = temaActual === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', nuevoTema);
    localStorage.setItem('theme', nuevoTema);
    actualizarIconoTema();
  });

  function actualizarIconoTema() {
    const esOscuro = document.documentElement.getAttribute('data-theme') === 'dark';
    const icono = btnThemeToggle.querySelector('i');
    if (icono) {
      icono.className = esOscuro ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-stars-fill';
    }
  }
});