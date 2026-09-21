document.getElementById('formRegistroPaciente').addEventListener('submit', async function(e) {
  e.preventDefault();

  // 1. Obtener el valor del campo de fecha
  let fechaRaw = document.getElementById('fechaNacimiento').value;
  let fechaFormatted = fechaRaw;

  // Si la fecha viene en formato DD/MM/AAAA (ej. 15/10/2001), convertir a AAAA-MM-DD
  if (fechaRaw && fechaRaw.includes('/')) {
    const partes = fechaRaw.split('/');
    if (partes.length === 3) {
      fechaFormatted = `\({partes[2]}-\){partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
  }

  // 2. Construir el objeto con los datos normalizados
  const datosPaciente = {
    nombreFamiliar: document.getElementById('nombreFamiliar').value,
    telefonoFamiliar: document.getElementById('telefonoFamiliar').value,
    correoFamiliar: document.getElementById('correoFamiliar').value,
    direccionFamiliar: document.getElementById('direccionFamiliar').value,
    nombrePaciente: document.getElementById('nombrePaciente').value,
    fechaNacimiento: fechaFormatted,
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
      // Usamos comillas invertidas (backticks ` `) para interpolar correctamente ${}
      const mensajeError = resultado.detalles 
        ? `\({resultado.mensaje}\nDetalle:\){resultado.detalles}` 
        : resultado.mensaje;
      
      alert('❌ Error: ' + mensajeError);
    }
  } catch (error) {
    alert('❌ Error al conectar con el servidor backend');
  }
});