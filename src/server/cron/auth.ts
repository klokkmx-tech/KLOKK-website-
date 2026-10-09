// Protección de los crons (brief §09): Vercel manda `Authorization: Bearer <CRON_SECRET>`.
// Comparación en tiempo constante; sin cabecera o con otro valor → 401.

import { timingSafeEqual } from 'node:crypto';

export function cronAutorizado(request: Request, cronSecret: string): boolean {
  if (!cronSecret) return false;
  const cabecera = request.headers.get('authorization') ?? '';
  const esperado = Buffer.from(`Bearer ${cronSecret}`, 'utf8');
  const recibido = Buffer.from(cabecera, 'utf8');
  if (esperado.length !== recibido.length) return false;
  return timingSafeEqual(esperado, recibido);
}

export const SIN_CACHE = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } as const;

export const noAutorizado = (): Response => new Response('{"error":"unauthorized"}', { status: 401, headers: SIN_CACHE });

export const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), { status, headers: SIN_CACHE });
