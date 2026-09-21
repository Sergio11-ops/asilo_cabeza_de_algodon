document.getElementById('formRegistroPaciente').addEventListener('submit', async function(e) {
  e.preventDefault();

  const datosPaciente = {
    nombreFamiliar: document.getElementById('nombreFamiliar').value,
    telefonoFamiliar: document.getElementById('telefonoFamiliar').value,
    correoFamiliar: document.getElementById('correoFamiliar').value,
    direccionFamiliar: document.getElementById('direccionFamiliar').value,
    nombrePaciente: document.getElementById('nombrePaciente').value,
    fechaNacimiento: document.getElementById('fechaNacimiento').value,
    cuotaMensual: document.getElementById('cuotaMensual').value,
    psicopatologia: document.getElementById('psicopatologia').value,
    medicamentosCajon: document.getElementById('medicamentosCajon').value
  };

  try {
    const respuesta = await fetch('/api/pacientes/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosPaciente)
    });

    const resultado = await respuesta.json();

    if (respuesta.ok) {
      alert('✅ Paciente y familiar registrados correctamente');
      document.getElementById('formRegistroPaciente').reset();
    } else {
      alert('❌ Error: ' + resultado.mensaje);
    }
  } catch (error) {
    alert('❌ Error al conectar con el servidor backend');
  }
});