// TEXTOS CONGELADOS del demo (brief §05 y §06). Regla dura 3: no se reformulan.
// Si un texto rompe un límite de Meta, se avisa a JP; no se recorta aquí.
// Regla dura 4: ningún texto contiene «NOM-151», «certificado», «constancia» ni
// «validez legal» (tests/messages.test.ts lo verifica).

import type { ClaveMensaje, GiroId, TamanoId } from './types';

export const PRIVACIDAD_URL = 'https://klokk.mx/privacidad-demo';

/** Cadenas prohibidas en el PDF y en todos los mensajes del demo (regla 4). */
export const PALABRAS_PROHIBIDAS = ['NOM-151', 'certificado', 'constancia', 'validez legal'] as const;

/** Límites de la Cloud API de Meta usados por las pruebas (se revisan en fase 2). */
export const LIMITES_META = {
  texto: 4096,
  cuerpoInteractivo: 1024,
  captionDocumento: 1024,
  tituloBoton: 20,
  botonesMax: 3,
  textoBotonLista: 20,
  tituloFila: 24,
  descripcionFila: 72,
  filasMax: 10,
  textoCtaUrl: 20,
  cuerpoPlantilla: 1024,
} as const;

// ---------------------------------------------------------------------------
// M1 · Bienvenida, aviso de privacidad y solicitud de ubicación
// interactive / location_request_message
export const M1 = `Hola, soy el demo de Klokk. En un minuto vas a ver cómo un empleado registra su entrada por WhatsApp y qué comprobante recibe.

Este chat es automático. Solo usa tu número y la ubicación que compartas para generar el ejemplo. Aviso de privacidad: ${PRIVACIDAD_URL}

Para empezar, comparte tu ubicación con el botón de abajo.`;

// M1b · Recordatorio de ubicación (una sola vez, a los 10 minutos) · text
export const M1b = `Para ver el demo completo falta tu ubicación. Puedes compartirla con el botón del mensaje anterior o desde el clip > Ubicación.

Si prefieres no hacerlo, no pasa nada: este chat no te volverá a escribir.`;

// M2 · Ubicación recibida · text
export const M2 = 'Ubicación recibida. Estoy generando tu registro de ejemplo, dame unos segundos.';

// M3 · Comprobante de ejemplo · document (caption)
export interface DatosM3 {
  folio: string;
  /** Formato DD/MM/AAAA HH:mm:ss (hora de Mérida). */
  fecha_hora_merida: string;
  /** SHA-256 hexadecimal en minúsculas, 64 caracteres. */
  hash: string;
}
export const m3Caption = ({ folio, fecha_hora_merida, hash }: DatosM3): string =>
  `Este es el comprobante de EJEMPLO de tu entrada. Así se ve lo que recibe cada empleado al checar y lo que la empresa conserva en su expediente.

Folio: ${folio}
Hora del servidor: ${fecha_hora_merida}
Huella SHA-256: ${hash}

La huella se calcula sobre los datos del registro. Si alguien cambia un dato, la huella ya no coincide.`;

export const M3_NOMBRE_ARCHIVO = (folio: string): string => `${folio}.pdf`;

// M4 · Tamaño de empresa · interactive / button
export const M4 = 'Para orientarte mejor: ¿cuántas personas trabajan en tu empresa?';
export const M4_BOTONES: ReadonlyArray<{ id: TamanoId; titulo: string }> = [
  { id: 'tam_menos_25', titulo: 'Menos de 25' },
  { id: 'tam_25_100', titulo: 'De 25 a 100' },
  { id: 'tam_mas_100', titulo: 'Más de 100' },
];

// M5 · Giro · interactive / list
export const M5 = '¿A qué se dedica tu empresa?';
export const M5_BOTON = 'Elegir giro';
// TODO(JP): la fila deseada era «Inmobiliaria o desarrollo» (25 caracteres, límite 24).
// Default aplicado: título «Inmobiliaria», descripción «o desarrollo».
export const M5_FILAS: ReadonlyArray<{ id: GiroId; titulo: string; descripcion?: string }> = [
  { id: 'giro_construccion', titulo: 'Construcción' },
  { id: 'giro_restaurantes', titulo: 'Restaurantes y hoteles' },
  { id: 'giro_comercio', titulo: 'Comercio' },
  { id: 'giro_manufactura', titulo: 'Manufactura' },
  { id: 'giro_inmobiliaria', titulo: 'Inmobiliaria', descripcion: 'o desarrollo' },
  { id: 'giro_servicios', titulo: 'Servicios profesionales' },
  { id: 'giro_seguridad', titulo: 'Seguridad o limpieza' },
  { id: 'giro_logistica', titulo: 'Logística y transporte' },
  { id: 'giro_otro', titulo: 'Otro' },
];

// M6 · Liga para agendar · interactive / cta_url
export const M6 =
  'Si quieres ver Klokk operando con tu equipo, agenda una llamada de 20 minutos con nosotros. Elige el horario que te acomode.';
export const M6_BOTON = 'Agendar llamada';
export const AGENDA_LINK = (token: string): string => `https://klokk.mx/a/${token}`;

// M7 · Consentimiento de seguimiento · interactive / button
export const M7 =
  'Última pregunta. Si no agendas hoy, ¿podemos escribirte por aquí en los próximos días con información de Klokk? Serán máximo 3 mensajes y puedes responder «Baja» en cualquier momento.';
export const M7_BOTONES: ReadonlyArray<{ id: 'consent_si' | 'consent_no'; titulo: string }> = [
  { id: 'consent_si', titulo: 'Sí, escríbanme' },
  { id: 'consent_no', titulo: 'No, gracias' },
];

// M8 · Confirmación de baja · text
export const M8 =
  'Listo. No te volveremos a escribir por este medio. Si algún día quieres retomar, escribe «Entrada» y repetimos el demo. Gracias por tu tiempo.';

// M9 · Texto libre o contenido no reconocido · text
export const M9 = `Este chat es un demo automático y no puede leer mensajes libres. Ya avisamos a una persona del equipo de Klokk, que te responderá en horario hábil (lunes a viernes de 10:00 a 18:00, hora de Mérida).

Mientras, puedes escribir «Entrada» para ver el demo o «Baja» para no recibir más mensajes.`;

/** Cuerpos de texto por clave (M3 se arma con m3Caption). */
export const CUERPOS: Record<Exclude<ClaveMensaje, 'M3'>, string> = {
  M1,
  M1b,
  M2,
  M4,
  M5,
  M6,
  M7,
  M8,
  M9,
};

// ---------------------------------------------------------------------------
// §06 · Plantillas de seguimiento (categoría Marketing, idioma es_MX).
// {{1}} = nombre de perfil (o NOMBRE_FALLBACK), {{2}} = liga de agenda.

// TODO(JP): definir el valor final. Con este default el saludo queda «Hola, buen día.»
export const NOMBRE_FALLBACK = 'buen día';

export interface Plantilla {
  clave: 'T1' | 'T2' | 'T3';
  nombre: string;
  idioma: 'es_MX';
  /** Días naturales después del consentimiento. */
  dias: 1 | 3 | 7;
  cuerpo: string;
}

export const PLANTILLAS: ReadonlyArray<Plantilla> = [
  {
    clave: 'T1',
    nombre: 'demo_seguimiento_1',
    idioma: 'es_MX',
    dias: 1,
    cuerpo: `Hola, {{1}}. Ayer probaste el demo de Klokk y viste cómo queda registrada una entrada por WhatsApp. Si quieres ver cómo funcionaría con tu equipo, agenda una llamada de 20 minutos aquí: {{2}}

Si prefieres que no te escribamos, responde «Baja».`,
  },
  {
    clave: 'T2',
    nombre: 'demo_seguimiento_3',
    idioma: 'es_MX',
    dias: 3,
    cuerpo: `Hola, {{1}}. A partir del 1 de enero de 2027 el registro electrónico de asistencia será obligatorio (LFT, art. 132, fr. XXXIV). Klokk lo resuelve por WhatsApp, sin app y con tarifa plana. ¿Lo vemos en 20 minutos? Agenda aquí: {{2}}

Responde «Baja» para no recibir más mensajes.`,
  },
  {
    clave: 'T3',
    nombre: 'demo_seguimiento_7',
    idioma: 'es_MX',
    dias: 7,
    cuerpo: `Hola, {{1}}. Último mensaje de nuestra parte. Si el registro de asistencia de tu empresa sigue en la lista de pendientes, con gusto te mostramos Klokk en una llamada corta: {{2}}

Si no, gracias por probar el demo. No te volveremos a escribir.`,
  },
];

/** Nombre que va en {{1}}: el de perfil si existe, si no NOMBRE_FALLBACK. */
export const nombreParaPlantilla = (nombrePerfil: string | null | undefined): string => {
  const n = (nombrePerfil ?? '').trim();
  return n.length > 0 ? n : NOMBRE_FALLBACK;
};
