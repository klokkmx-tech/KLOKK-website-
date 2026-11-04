// Liga de agenda con token opaco (brief §09). Nunca lleva teléfono.
import type { APIRoute } from 'astro';
import { contexto } from '../../server/contexto';
import { procesarClicAgenda } from '../../server/flow/agenda';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const ctx = contexto();
  const r = await procesarClicAgenda(params.token ?? '', ctx.deps);
  if (!r.ok) {
    return new Response('No encontrado', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: ctx.agendaUrl, 'Cache-Control': 'no-store' },
  });
};
