// Wrapper delgado de la Cloud API de WhatsApp (Graph API).
// Payloads según la referencia de Meta revisada en la fase 2:
//   POST /{version}/{phone_number_id}/messages  (texto, interactivos, documento, plantilla)
//   POST /{version}/{phone_number_id}/media     (multipart: file, type, messaging_product)
// Nunca registra el token. Los errores llevan estatus y cuerpo de la respuesta.

export interface Boton {
  id: string;
  titulo: string;
}
export interface Fila {
  id: string;
  titulo: string;
  descripcion?: string;
}

export interface Envio {
  /** wamid del mensaje saliente. */
  meta_msg_id: string;
  /** Payload enviado (para guardarlo en `mensajes.cuerpo`). */
  payload: Record<string, unknown>;
}

export interface WaClient {
  enviarTexto(to: string, body: string): Promise<Envio>;
  enviarSolicitudUbicacion(to: string, body: string): Promise<Envio>;
  enviarBotones(to: string, body: string, botones: ReadonlyArray<Boton>): Promise<Envio>;
  enviarLista(to: string, body: string, textoBoton: string, filas: ReadonlyArray<Fila>): Promise<Envio>;
  enviarCtaUrl(to: string, body: string, textoBoton: string, url: string): Promise<Envio>;
  enviarDocumento(to: string, mediaId: string, filename: string, caption: string): Promise<Envio>;
  subirMedia(bytes: Uint8Array, mime: string, filename: string): Promise<{ media_id: string }>;
  enviarPlantilla(to: string, nombre: string, idioma: string, parametros: ReadonlyArray<string>): Promise<Envio>;
}

export class WaError extends Error {
  constructor(
    public readonly operacion: string,
    public readonly status: number,
    public readonly cuerpo: unknown,
  ) {
    super(`WhatsApp ${operacion}: HTTP ${status}`);
    this.name = 'WaError';
  }
}

export interface OpcionesWa {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  fetchFn?: typeof fetch;
  base?: string;
}

export function crearWaClient(op: OpcionesWa): WaClient {
  const fetchFn = op.fetchFn ?? fetch;
  const base = `${op.base ?? 'https://graph.facebook.com'}/${op.apiVersion}/${op.phoneNumberId}`;

  async function post(path: string, body: BodyInit, contentType?: string): Promise<unknown> {
    const headers: Record<string, string> = { Authorization: `Bearer ${op.token}` };
    if (contentType) headers['Content-Type'] = contentType;
    const res = await fetchFn(`${base}${path}`, { method: 'POST', headers, body });
    const texto = await res.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = { raw: texto.slice(0, 500) };
    }
    if (!res.ok) throw new WaError(path, res.status, json);
    return json;
  }

  async function mensaje(to: string, payload: Record<string, unknown>): Promise<Envio> {
    const completo = { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload };
    const res = (await post('/messages', JSON.stringify(completo), 'application/json')) as {
      messages?: Array<{ id: string }>;
    };
    const id = res?.messages?.[0]?.id;
    if (!id) throw new WaError('/messages', 200, { motivo: 'respuesta sin messages[0].id', res });
    return { meta_msg_id: id, payload: completo };
  }

  return {
    enviarTexto: (to, body) => mensaje(to, { type: 'text', text: { preview_url: false, body } }),

    enviarSolicitudUbicacion: (to, body) =>
      mensaje(to, {
        type: 'interactive',
        interactive: { type: 'location_request_message', body: { text: body }, action: { name: 'send_location' } },
      }),

    enviarBotones: (to, body, botones) =>
      mensaje(to, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: { buttons: botones.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.titulo } })) },
        },
      }),

    enviarLista: (to, body, textoBoton, filas) =>
      mensaje(to, {
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: {
            button: textoBoton,
            sections: [
              {
                rows: filas.map((f) => ({
                  id: f.id,
                  title: f.titulo,
                  ...(f.descripcion ? { description: f.descripcion } : {}),
                })),
              },
            ],
          },
        },
      }),

    enviarCtaUrl: (to, body, textoBoton, url) =>
      mensaje(to, {
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: body },
          action: { name: 'cta_url', parameters: { display_text: textoBoton, url } },
        },
      }),

    enviarDocumento: (to, mediaId, filename, caption) =>
      mensaje(to, { type: 'document', document: { id: mediaId, filename, caption } }),

    subirMedia: async (bytes, mime, filename) => {
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', mime);
      form.append('file', new Blob([bytes as BlobPart], { type: mime }), filename);
      const res = (await post('/media', form)) as { id?: string };
      if (!res?.id) throw new WaError('/media', 200, { motivo: 'respuesta sin id', res });
      return { media_id: res.id };
    },

    enviarPlantilla: (to, nombre, idioma, parametros) =>
      mensaje(to, {
        type: 'template',
        template: {
          name: nombre,
          language: { code: idioma },
          components: [{ type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) }],
        },
      }),
  };
}
