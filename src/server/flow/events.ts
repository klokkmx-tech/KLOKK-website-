// Normalización de mensajes entrantes de WhatsApp a eventos de la máquina (brief §04).
// Sin I/O. La forma `MensajeEntrante` es el subconjunto del webhook que importa aquí;
// la validación completa con zod vive en src/server/wa/schema.ts (fase 2).

import { CONSENT_IDS, GIROS, TAMANOS, type Evento, type GiroId, type TamanoId } from './types';

export type MensajeEntrante =
  | { type: 'text'; text: { body: string } }
  | { type: 'location'; location: { latitude: number; longitude: number } }
  | {
      type: 'interactive';
      interactive:
        | { type: 'button_reply'; button_reply: { id: string; title: string } }
        | { type: 'list_reply'; list_reply: { id: string; title: string; description?: string } };
    }
  | { type: string };

/**
 * Normaliza un texto para compararlo con las palabras clave: recorta espacios,
 * pasa a minúsculas, quita acentos y quita signos de puntuación finales.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[.!?…,;:]+$/u, '')
    .trim();
}

export const esEntrada = (texto: string): boolean => normalizarTexto(texto) === 'entrada';
export const esBaja = (texto: string): boolean => normalizarTexto(texto) === 'baja';

const esTamano = (id: string): id is TamanoId => (TAMANOS as readonly string[]).includes(id);
const esGiro = (id: string): id is GiroId => (GIROS as readonly string[]).includes(id);
const esConsent = (id: string): id is (typeof CONSENT_IDS)[number] =>
  (CONSENT_IDS as readonly string[]).includes(id);

/** Convierte un mensaje entrante en el evento que consume `transition`. */
export function eventoDesdeMensaje(msg: MensajeEntrante): Evento {
  switch (msg.type) {
    case 'text': {
      const body = (msg as Extract<MensajeEntrante, { type: 'text' }>).text.body;
      if (esEntrada(body)) return { tipo: 'ENTRADA' };
      if (esBaja(body)) return { tipo: 'BAJA' };
      return { tipo: 'TEXTO_LIBRE', resumen: body };
    }
    case 'location': {
      const { latitude, longitude } = (msg as Extract<MensajeEntrante, { type: 'location' }>).location;
      return { tipo: 'UBICACION', lat: latitude, lon: longitude };
    }
    case 'interactive': {
      const i = (msg as Extract<MensajeEntrante, { type: 'interactive' }>).interactive;
      const id = i.type === 'button_reply' ? i.button_reply.id : i.list_reply.id;
      if (esTamano(id)) return { tipo: 'BOTON_TAMANO', id };
      if (esGiro(id)) return { tipo: 'LISTA_GIRO', id };
      if (esConsent(id)) return { tipo: 'BOTON_CONSENT', valor: id === 'consent_si' ? 'si' : 'no' };
      return { tipo: 'TEXTO_LIBRE', resumen: `interactivo:${id}` };
    }
    default:
      return { tipo: 'TEXTO_LIBRE', resumen: `tipo:${msg.type}` };
  }
}
