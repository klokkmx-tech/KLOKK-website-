// Cliente falso de WhatsApp para pruebas: registra cada llamada y devuelve ids
// deterministas. Puede forzarse a fallar por operación.

import type { Envio, WaClient } from './client';

export interface LlamadaWa {
  metodo: keyof WaClient;
  to: string;
  payload: Record<string, unknown>;
}

export interface WaFake extends WaClient {
  llamadas: LlamadaWa[];
  /** Operaciones que deben lanzar error en la siguiente llamada. */
  fallar: Set<keyof WaClient>;
  medias: Array<{ media_id: string; bytes: Uint8Array; mime: string; filename: string }>;
  enviadosA(to: string): LlamadaWa[];
}

export function crearWaFake(): WaFake {
  let nMsg = 0;
  let nMedia = 0;
  const fake: WaFake = {
    llamadas: [],
    fallar: new Set(),
    medias: [],
    enviadosA(to) {
      return fake.llamadas.filter((l) => l.to === to && l.metodo !== 'subirMedia');
    },
    enviarTexto: (to, body) => registrar('enviarTexto', to, { type: 'text', text: { body } }),
    enviarSolicitudUbicacion: (to, body) =>
      registrar('enviarSolicitudUbicacion', to, { type: 'interactive', interactive: { type: 'location_request_message', body: { text: body } } }),
    enviarBotones: (to, body, botones) =>
      registrar('enviarBotones', to, { type: 'interactive', interactive: { type: 'button', body: { text: body }, botones } }),
    enviarLista: (to, body, textoBoton, filas) =>
      registrar('enviarLista', to, { type: 'interactive', interactive: { type: 'list', body: { text: body }, textoBoton, filas } }),
    enviarCtaUrl: (to, body, textoBoton, url) =>
      registrar('enviarCtaUrl', to, { type: 'interactive', interactive: { type: 'cta_url', body: { text: body }, textoBoton, url } }),
    enviarDocumento: (to, mediaId, filename, caption) =>
      registrar('enviarDocumento', to, { type: 'document', document: { id: mediaId, filename, caption } }),
    enviarPlantilla: (to, nombre, idioma, parametros) =>
      registrar('enviarPlantilla', to, { type: 'template', template: { name: nombre, language: { code: idioma }, parametros } }),
    async subirMedia(bytes, mime, filename) {
      if (fake.fallar.delete('subirMedia')) throw new Error('fake: subirMedia falló');
      const media_id = `media.fake.${++nMedia}`;
      fake.medias.push({ media_id, bytes, mime, filename });
      return { media_id };
    },
  };

  async function registrar(metodo: keyof WaClient, to: string, payload: Record<string, unknown>): Promise<Envio> {
    if (fake.fallar.delete(metodo)) throw new Error(`fake: ${metodo} falló`);
    fake.llamadas.push({ metodo, to, payload });
    return { meta_msg_id: `wamid.fake.${++nMsg}`, payload: { to, ...payload } };
  }

  return fake;
}
