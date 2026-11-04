// Cron */5 * * * * (brief §09). Protegido con CRON_SECRET.
import type { APIRoute } from 'astro';
import { contexto } from '../../../server/contexto';
import { cronAutorizado, json, noAutorizado } from '../../../server/cron/auth';
import { correrRecordatorios } from '../../../server/cron/recordatorios';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const ctx = contexto();
  if (!cronAutorizado(request, ctx.cronSecret)) return noAutorizado();
  return json(await correrRecordatorios(ctx.deps));
};
