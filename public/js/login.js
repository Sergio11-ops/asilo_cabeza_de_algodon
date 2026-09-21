document.addEventListener('DOMContentLoaded', () => {
  const btnToggle = document.getElementById('btnTogglePassword');
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('toggleIcon');
  const loginForm = document.getElementById('loginForm');
  const alertBox = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  // 1. Mostrar / Ocultar Contraseña
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      toggleIcon.className = isPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill';
    });
  }

  // 2. Conexión Backend vía Fetch API
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const correo = document.getElementById('email').value.trim();
      const password = passwordInput.value.trim();

      if (!correo || !password) {
        errorMessage.textContent = 'Por favor complete todos los campos.';
        alertBox.style.display = 'block';
        return;
      }

      // Estado de carga en el botón
      alertBox.style.display = 'none';
      btnText.textContent = 'Verificando...';
      btnSpinner.style.display = 'inline-block';

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo, password })
        });

        const data = await response.json();

        if (response.ok) {
          // Guardar sesión en LocalStorage
          localStorage.setItem('token', data.token);
          localStorage.setItem('usuario', JSON.stringify(data.usuario));

          // Redireccionar al Dashboard
          window.location.href = 'dashboard.html';
        } else {
          errorMessage.textContent = data.mensaje || 'Credenciales incorrectas.';
          alertBox.style.display = 'block';
        }
      } catch (error) {
        errorMessage.textContent = 'Error de conexión con el servidor.';
        alertBox.style.display = 'block';
      } finally {
        // Restaurar estado del botón
        btnSpinner.style.display = 'none';
        btnText.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Iniciar Sesión';
      }
    });
  }
});