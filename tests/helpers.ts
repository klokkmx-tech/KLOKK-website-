// Utilidades compartidas por las pruebas de flujo y webhook.
import { crearCorreoFake } from '../src/server/correo/types';
import { crearDbMemoria } from '../src/server/db/memoria';
import type { Deps } from '../src/server/flow/executor';
import { procesarEntrante } from '../src/server/flow/procesar';
import type { GeneradorPdf } from '../src/server/pdf/comprobante';
import { crearWaFake } from '../src/server/wa/fake';
import type { MensajeWebhook } from '../src/server/wa/schema';
import { firmaEsperada } from '../src/server/wa/signature';
import { manejarPost, type WebhookDeps } from '../src/server/wa/webhook';

export const APP_SECRET = 'secreto-de-prueba';
export const VERIFY_TOKEN = 'token-de-verificacion';
export const PHONE_NUMBER_ID = '111222333';

export const pdfFake: GeneradorPdf = async (d) => new TextEncoder().encode(`%PDF-fake EJEMPLO ${d.folio}`);

export function crearEntorno(inicio = new Date('2026-10-08T20:00:00.000Z')) {
  let ahora = inicio;
  const db = crearDbMemoria(() => ahora);
  const wa = crearWaFake();
  const correo = crearCorreoFake();
  const logs: Array<{ mensaje: string; detalle?: Record<string, unknown> }> = [];
  const deps: Deps = {
    db,
    wa,
    pdf: pdfFake,
    correo,
    ahora: () => ahora,
    log: (mensaje, detalle) => logs.push({ mensaje, detalle }),
  };
  let seq = 0;
  const pendientes: Promise<unknown>[] = [];
  const webhookDeps: WebhookDeps = {
    appSecret: APP_SECRET,
    verifyToken: VERIFY_TOKEN,
    db,
    procesar: (e) => procesarEntrante(e, deps),
    waitUntil: (p) => {
      pendientes.push(p);
    },
    log: deps.log,
  };

  return {
    db,
    wa,
    correo,
    deps,
    logs,
    webhookDeps,
    avanzar(ms: number) {
      ahora = new Date(ahora.getTime() + ms);
    },
    fijar(d: Date) {
      ahora = d;
    },
    get ahora() {
      return ahora;
    },
    /** Envía un mensaje entrante por el webhook y espera el procesamiento en segundo plano. */
    async entrante(wa_id: string, mensaje: Partial<MensajeWebhook> & { type: string }, nombre: string | null = 'Ana') {
      const m: MensajeWebhook = {
        from: wa_id,
        id: `wamid.in.${++seq}`,
        timestamp: String(Math.floor(ahora.getTime() / 1000)),
        ...mensaje,
      };
      const res = await manejarPost(peticion(valorMensajes({ mensajes: [m], nombre, wa_id })), webhookDeps);
      await Promise.all(pendientes.splice(0));
      return res;
    },
    async estatus(meta_msg_id: string, status: string, errors?: unknown[]) {
      const res = await manejarPost(
        peticion(valorMensajes({ estatus: [{ id: meta_msg_id, status, timestamp: String(Math.floor(ahora.getTime() / 1000)), errors }] })),
        webhookDeps,
      );
      await Promise.all(pendientes.splice(0));
      return res;
    },
    async esperarPendientes() {
      await Promise.all(pendientes.splice(0));
    },
  };
}

export const texto = (body: string) => ({ type: 'text', text: { body } });
export const ubicacion = (latitude = 20.96743251, longitude = -89.59261) => ({ type: 'location', location: { latitude, longitude } });
export const boton = (id: string, title = id) => ({
  type: 'interactive',
  interactive: { type: 'button_reply' as const, button_reply: { id, title } },
});
export const fila = (id: string, title = id) => ({
  type: 'interactive',
  interactive: { type: 'list_reply' as const, list_reply: { id, title } },
});

export function valorMensajes(o: {
  mensajes?: MensajeWebhook[];
  estatus?: Array<Record<string, unknown>>;
  nombre?: string | null;
  wa_id?: string;
}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550000000', phone_number_id: PHONE_NUMBER_ID },
              ...(o.wa_id ? { contacts: [{ wa_id: o.wa_id, profile: { name: o.nombre ?? undefined } }] } : {}),
              ...(o.mensajes ? { messages: o.mensajes } : {}),
              ...(o.estatus ? { statuses: o.estatus } : {}),
            },
          },
        ],
      },
    ],
  };
}

export function peticion(payload: unknown, opciones: { firmar?: boolean; secret?: string; cuerpo?: string } = {}): Request {
  const cuerpo = opciones.cuerpo ?? JSON.stringify(payload);
  const bytes = new TextEncoder().encode(cuerpo);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opciones.firmar !== false) headers['X-Hub-Signature-256'] = firmaEsperada(bytes, opciones.secret ?? APP_SECRET);
  return new Request('https://klokk.mx/api/wa', { method: 'POST', headers, body: bytes });
}
