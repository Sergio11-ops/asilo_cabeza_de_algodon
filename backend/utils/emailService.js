// backend/utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sergiotinay11@gmail.com',       // Tu correo de Gmail que enviará los correos
        pass: 'bztq ehez oufz pevb'                // Contraseña de Aplicación de Google (16 caracteres)
    }
});

/**
 * Notifica al familiar del paciente sobre la creación de una solicitud médica
 */
async function enviarNotificacionFamiliar({ correoFamiliar, nombreFamiliar, nombrePaciente, especialidad, motivo, enfermeroNombre }) {
    if (!correoFamiliar) {
        console.warn('⚠️ No se proporcionó correo electrónico del familiar. Omitiendo notificación.');
        return false;
    }

    const mailOptions = {
        from: '"Fundación Cabeza de Algodón" <notificaciones.asilo@gmail.com>',
        to: correoFamiliar,
        subject: `Notificación Médica: Remisión de ${nombrePaciente}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                <h2 style="color: #0d6efd; margin-top: 0;">Fundación Cabeza de Algodón</h2>
                <p>Estimado(a) <strong>${nombreFamiliar}</strong>,</p>
                <p>Le informamos que el departamento médico ha generado una solicitud de remisión especializada para su familiar:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f8f9fa;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Paciente:</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${nombrePaciente}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Especialidad Requerida:</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${especialidad}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Motivo de la consulta:</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${motivo}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Enfermero(a) Acompañante:</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6;">${enfermeroNombre}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">Estado:</td>
                        <td style="padding: 10px; border: 1px solid #dee2e6; color: #d97706; font-weight: bold;">Pendiente de programación por la Fundación</td>
                    </tr>
                </table>

                <p style="font-size: 0.9em; color: #6c757d;">
                    Le mantendremos informado una vez que la Fundación programe la fecha y hora exacta de la cita médica.
                </p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin-top: 20px;">
                <p style="font-size: 0.8em; color: #999; text-align: center;">
                    Este es un correo automático. Por favor no responda a este mensaje.
                </p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✉️ Correo de notificación enviado al familiar:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error enviando correo al familiar:', error.message);
        return false; // No interrumpe la aplicación si falla el servidor de e-mail
    }
}

module.exports = { enviarNotificacionFamiliar };