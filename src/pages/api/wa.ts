// Webhook de WhatsApp (brief §09). Único punto de entrada de mensajes.
import type { APIRoute } from 'astro';
import { contexto, log } from '../../server/contexto';
import { procesarEntrante } from '../../server/flow/procesar';
import { manejarGet, manejarPost } from '../../server/wa/webhook';

export const prerender = false;

export const GET: APIRoute = ({ url }) => manejarGet(url, contexto().verifyToken);

export const POST: APIRoute = ({ request }) => {
  const ctx = contexto();
  return manejarPost(request, {
    appSecret: ctx.appSecret,
    verifyToken: ctx.verifyToken,
    db: ctx.deps.db,
    procesar: (e) => procesarEntrante(e, ctx.deps),
    waitUntil: ctx.waitUntil,
    log,
  });
};
