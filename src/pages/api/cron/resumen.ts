// Cron 0 1 * * * (01:00 UTC = 19:00 Mérida, brief §08). Protegido con CRON_SECRET.
import type { APIRoute } from 'astro';
import { contexto } from '../../../server/contexto';
import { cronAutorizado, json, noAutorizado } from '../../../server/cron/auth';
import { correrResumen } from '../../../server/cron/resumen';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const ctx = contexto();
  if (!cronAutorizado(request, ctx.cronSecret)) return noAutorizado();
  const datos = await correrResumen(ctx.deps);
  // La respuesta no incluye la lista de leads: solo conteos.
  return json({ fecha: datos.fecha, embudo: datos.embudo, plantillas: datos.plantillas, salientes: datos.salientes, acumulado: datos.acumulado });
};
