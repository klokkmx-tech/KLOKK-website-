// Cron 0 * * * * (brief §06, §09). Protegido con CRON_SECRET.
import type { APIRoute } from 'astro';
import { contexto } from '../../../server/contexto';
import { cronAutorizado, json, noAutorizado } from '../../../server/cron/auth';
import { correrSeguimiento } from '../../../server/cron/seguimiento';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const ctx = contexto();
  if (!cronAutorizado(request, ctx.cronSecret)) return noAutorizado();
  return json(await correrSeguimiento(ctx.deps));
};
