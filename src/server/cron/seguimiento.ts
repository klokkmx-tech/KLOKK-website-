// Cron cada hora (brief §06 y §09): envía las plantillas vencidas, solo dentro
// de la ventana hábil de Mérida y solo si el lead sigue siendo elegible.

import type { Deps } from '../flow/executor';
import { enVentanaHabil } from '../flow/horario';
import { AGENDA_LINK, PLANTILLAS, nombreParaPlantilla } from '../flow/messages';
import { WaError } from '../wa/client';

export interface ResultadoSeguimiento {
  enVentana: boolean;
  vencidas: number;
  enviadas: number;
  canceladas: number;
  fallidas: number;
}

export async function correrSeguimiento(deps: Deps): Promise<ResultadoSeguimiento> {
  const { db, wa, log } = deps;
  const ahora = deps.ahora();
  const r: ResultadoSeguimiento = { enVentana: enVentanaHabil(ahora), vencidas: 0, enviadas: 0, canceladas: 0, fallidas: 0 };
  if (!r.enVentana) return r;

  const vencidas = await db.plantillas.vencidas(ahora.toISOString());
  r.vencidas = vencidas.length;
  if (vencidas.length === 0) return r;

  const leads = new Map((await db.leads.porIds([...new Set(vencidas.map((p) => p.lead_id))])).map((l) => [l.id, l]));

  for (const p of vencidas) {
    const lead = leads.get(p.lead_id);
    const motivo = lead ? motivoNoElegible(lead) : 'lead inexistente';
    if (motivo) {
      await db.plantillas.marcar(p.id, 'cancelada', { motivo });
      await db.eventos.registrar(p.lead_id, 'PLANTILLA_CANCELADA', { plantilla: p.plantilla, motivo });
      r.canceladas++;
      continue;
    }

    const def = PLANTILLAS.find((x) => x.clave === p.plantilla)!;
    const parametros = [nombreParaPlantilla(lead!.nombre_perfil), AGENDA_LINK(lead!.agenda_token)];
    try {
      const envio = await wa.enviarPlantilla(lead!.wa_id, def.nombre, def.idioma, parametros);
      const { id } = await db.mensajes.insertarSaliente({
        lead_id: lead!.id,
        wa_id: lead!.wa_id,
        tipo: 'template',
        clave: p.plantilla,
        meta_msg_id: envio.meta_msg_id,
        cuerpo: envio.payload,
      });
      await db.plantillas.marcar(p.id, 'enviada', { enviado_ts: ahora.toISOString(), mensaje_id: id });
      await db.eventos.registrar(lead!.id, 'PLANTILLA_ENVIADA', { plantilla: p.plantilla });
      r.enviadas++;
    } catch (e) {
      const detalle = e instanceof WaError ? { status: e.status, cuerpo: e.cuerpo } : { error: e instanceof Error ? e.message : String(e) };
      await db.plantillas.marcar(p.id, 'fallida', { motivo: JSON.stringify(detalle).slice(0, 500) });
      await db.eventos.registrar(lead!.id, 'PLANTILLA_FALLIDA', { plantilla: p.plantilla, ...detalle });
      log('plantilla fallida', { lead: lead!.id, plantilla: p.plantilla });
      r.fallidas++;
    }
  }
  return r;
}

/** §06.5: devuelve el motivo si el lead ya no debe recibir plantillas; null si sigue elegible. */
export function motivoNoElegible(lead: {
  consentimiento: boolean | null;
  consentimiento_ts: string | null;
  baja_ts: string | null;
  agenda_ts: string | null;
  ultimo_entrante_ts: string | null;
}): string | null {
  // La baja pone consentimiento=false; se revisa primero para conservar el motivo real.
  if (lead.baja_ts) return 'baja';
  if (lead.agenda_ts) return 'agenda';
  if (lead.consentimiento !== true || !lead.consentimiento_ts) return 'sin consentimiento';
  if (lead.ultimo_entrante_ts && lead.ultimo_entrante_ts > lead.consentimiento_ts) return 'respuesta';
  return null;
}
