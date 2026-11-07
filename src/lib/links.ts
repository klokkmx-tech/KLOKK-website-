// Destinos de los CTA y datos de contacto de la empresa.
// Cambiar aquí actualiza todo el sitio.

import { PUBLIC_WA_DEMO_NUMBER } from 'astro:env/client';

/** Número de WhatsApp de ventas, formato internacional sin «+» ni espacios. */
const WHATSAPP_NUMBER = '529991155439';

/**
 * Número del demo automático (DEMO-WEB-01). Viene de la variable pública de
 * build PUBLIC_WA_DEMO_NUMBER; mientras no exista, usa el placeholder.
 */
const WA_DEMO_NUMBER = PUBLIC_WA_DEMO_NUMBER?.replace(/\D/g, '') || WHATSAPP_NUMBER; // TODO: definir PUBLIC_WA_DEMO_NUMBER

const WHATSAPP_TEXT = encodeURIComponent(
  'Hola, quiero saber más de Klokk para el registro de asistencia de mi empresa.',
);

export const LINKS = {
  whatsapp: `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`,
  demo: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Hola, quiero agendar una demo de 20 minutos de Klokk.',
  )}`, // TODO: reemplazar por Calendly/Cal.com cuando exista
  /** Demo automático por WhatsApp: el texto «Entrada» arranca el flujo (brief §03). */
  demoWhatsApp: `https://wa.me/${WA_DEMO_NUMBER}?text=Entrada`,
  email: 'contacto@klokk.mx', // TODO: correo real
} as const;

/** Datos de la empresa tal como se dieron de alta ante Meta (verificación del negocio). */
export const EMPRESA = {
  razonSocial: 'Klokk Technology, S. de R.L. de C.V.',
  domicilio: '28 363, Montebello, C.P. 97113, Mérida, Yucatán, México',
  telefono: '+52 999 115 5439',
  telefonoHref: 'tel:+529991155439',
} as const;
