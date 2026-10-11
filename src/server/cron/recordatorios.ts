// Cron cada 5 minutos (brief §09): M1b una sola vez a leads con ≥ 10 min en
// ESPERA_UBIC. La máquina decide (fila 6); aquí solo se buscan candidatos.

import { ejecutar, type Deps } from '../flow/executor';
import { MIN_RECORDATORIO_MS, transition } from '../flow/machine';

export interface ResultadoRecordatorios {
  candidatos: number;
  enviados: number;
  errores: number;
}

export async function correrRecordatorios(deps: Deps): Promise<ResultadoRecordatorios> {
  const ahora = deps.ahora();
  const limite = new Date(ahora.getTime() - MIN_RECORDATORIO_MS).toISOString();
  const candidatos = await deps.db.leads.enEsperaUbicSinRecordatorio(limite);
  let enviados = 0;
  let errores = 0;

  for (const lead of candidatos) {
    const evento = { tipo: 'TIMEOUT_UBIC' } as const;
    const resultado = transition(lead, evento, ahora);
    if (resultado.acciones.length === 0) continue;
    try {
      const salida = await ejecutar({ lead, wa_id: lead.wa_id, nombre_perfil: null, evento, resultado }, deps);
      if (salida.aplicado) enviados++;
    } catch (e) {
      errores++;
      deps.log('recordatorio: error', { lead: lead.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { candidatos: candidatos.length, enviados, errores };
}
