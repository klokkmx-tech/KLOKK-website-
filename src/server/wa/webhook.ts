// Manejo del webhook de Meta (brief §09):
//   GET  verificación con hub.verify_token → hub.challenge.
//   POST cuerpo crudo → firma → zod → dedupe por meta_msg_id → 200 inmediato →
//        procesamiento en segundo plano (waitUntil). Los estatus actualizan mensajes.

import type { Db } from '../db/types';
import type { EntranteProcesable } from '../flow/procesar';
import { PayloadWebhook, valoresDeMensajes, type ValorWebhook } from './schema';
import { verificarFirma } from './signature';

export interface WebhookDeps {
  appSecret: string;
  verifyToken: string;
  db: Db;
  procesar: (e: EntranteProcesable) => Promise<unknown>;
  waitUntil: (p: Promise<unknown>) => void;
  log: (mensaje: string, detalle?: Record<string, unknown>) => void;
}

const SIN_CACHE = { 'Cache-Control': 'no-store' };

export function manejarGet(url: URL, verifyToken: string): Response {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && challenge && igualesTiempoConstante(token, verifyToken)) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain', ...SIN_CACHE } });
  }
  return new Response('forbidden', { status: 403, headers: SIN_CACHE });
}

export async function manejarPost(request: Request, deps: WebhookDeps): Promise<Response> {
  const crudo = new Uint8Array(await request.arrayBuffer());
  if (!verificarFirma(crudo, request.headers.get('x-hub-signature-256'), deps.appSecret)) {
    return new Response('unauthorized', { status: 401, headers: SIN_CACHE });
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(crudo));
  } catch {
    deps.log('webhook: cuerpo no es JSON');
    return ok();
  }
  const parsed = PayloadWebhook.safeParse(json);
  if (!parsed.success) {
    deps.log('webhook: payload no reconocido', { issues: parsed.error.issues.length });
    return ok();
  }

  for (const valor of valoresDeMensajes(parsed.data)) {
    deps.waitUntil(
      procesarValor(valor, deps).catch((e: unknown) =>
        deps.log('webhook: error en segundo plano', { error: e instanceof Error ? e.message : String(e) }),
      ),
    );
  }
  return ok();
}

async function procesarValor(valor: ValorWebhook, deps: WebhookDeps): Promise<void> {
  // Estatus de entrega (fila 20): solo actualizan mensajes.estatus.
  for (const s of valor.statuses ?? []) {
    const ts = new Date(Number(s.timestamp) * 1000).toISOString();
    const encontrado = await deps.db.mensajes.actualizarEstatus(s.id, s.status, ts, s.errors ?? null);
    if (!encontrado) deps.log('estatus de mensaje desconocido', { status: s.status });
  }

  const nombres = new Map<string, string | null>();
  for (const c of valor.contacts ?? []) nombres.set(c.wa_id, c.profile?.name?.trim() || null);

  for (const m of valor.messages ?? []) {
    const insertado = await deps.db.mensajes.insertarEntrante({
      wa_id: m.from,
      tipo: m.type,
      meta_msg_id: m.id,
      cuerpo: m,
      ts: new Date(Number(m.timestamp) * 1000).toISOString(),
    });
    if (insertado.duplicado) continue;
    await deps.procesar({ mensaje: m, nombre_perfil: nombres.get(m.from) ?? null, mensaje_id: insertado.id });
  }
}

const ok = () => new Response('ok', { status: 200, headers: SIN_CACHE });

function igualesTiempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i]! ^ bb[i]!;
  return diff === 0;
}
