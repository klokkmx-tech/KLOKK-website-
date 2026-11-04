// Procesamiento de un mensaje entrante ya deduplicado: carga el lead, deriva el
// evento, corre la máquina y ejecuta las acciones. Corre en segundo plano.

import type { MensajeWebhook } from '../wa/schema';
import { eventoDesdeMensaje, type MensajeEntrante } from './events';
import { ejecutar, type Deps, type Salida } from './executor';
import { transition } from './machine';

export interface EntranteProcesable {
  mensaje: MensajeWebhook;
  nombre_perfil: string | null;
  /** Id en `mensajes` del entrante ya insertado. */
  mensaje_id: number;
}

export async function procesarEntrante(e: EntranteProcesable, deps: Deps): Promise<Salida> {
  const wa_id = e.mensaje.from; // regla 9: tal como llega
  const lead = await deps.db.leads.porWaId(wa_id);
  const evento = eventoDesdeMensaje(e.mensaje as MensajeEntrante);
  const ahora = deps.ahora();
  const resultado = transition(lead, evento, ahora);

  if (lead) {
    await deps.db.leads.actualizar(lead.id, { ultimo_entrante_ts: ahora.toISOString() });
  }

  return ejecutar(
    { lead, wa_id, nombre_perfil: e.nombre_perfil, evento, resultado, mensaje_id: e.mensaje_id },
    deps,
  );
}
