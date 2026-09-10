// Destinos de los CTA — placeholders hasta tener el número y la agenda reales.
// Cambiar aquí actualiza todo el sitio.

/** Número de WhatsApp de ventas, formato internacional sin «+» ni espacios. */
const WHATSAPP_NUMBER = '5219990000000'; // TODO: número real

const WHATSAPP_TEXT = encodeURIComponent(
  'Hola, quiero saber más de Klokk para el registro de asistencia de mi empresa.',
);

export const LINKS = {
  whatsapp: `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`,
  demo: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Hola, quiero agendar una demo de 20 minutos de Klokk.',
  )}`, // TODO: reemplazar por Calendly/Cal.com cuando exista
  email: 'contacto@klokk.mx', // TODO: correo real
} as const;
