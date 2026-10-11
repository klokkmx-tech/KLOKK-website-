// Clic en la liga de agenda /a/<token> (brief §04 fila 15, §09).

import { ejecutar, type Deps } from './executor';
import { transition } from './machine';

export type ResultadoAgenda = { ok: true; lead_id: string } | { ok: false };

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{16,64}$/;

export async function procesarClicAgenda(token: string, deps: Deps): Promise<ResultadoAgenda> {
  if (!TOKEN_VALIDO.test(token)) return { ok: false };
  const lead = await deps.db.leads.porToken(token);
  if (!lead) return { ok: false };
  const resultado = transition(lead, { tipo: 'CLIC_AGENDA' }, deps.ahora());
  const salida = await ejecutar(
    { lead, wa_id: lead.wa_id, nombre_perfil: null, evento: { tipo: 'CLIC_AGENDA' }, resultado },
    deps,
  );
  // Aunque otro proceso haya ganado una transición simultánea, el clic es válido:
  // se redirige de todos modos.
  return { ok: true, lead_id: salida.lead?.id ?? lead.id };
}
