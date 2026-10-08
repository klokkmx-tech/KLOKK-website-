// Contrato de correos (brief §08). La implementación con Resend llega en la
// fase 5; el ejecutor solo depende de esta interfaz.

import type { LeadRow, RegistroRow } from '../db/types';

export interface Correo {
  calificado(lead: LeadRow, registro: RegistroRow | null): Promise<void>;
  avisoTexto(lead: LeadRow, resumen: string): Promise<void>;
}

/** Sin envío: registra las llamadas (pruebas) o no hace nada (hasta la fase 5). */
export interface CorreoFake extends Correo {
  enviados: Array<{ tipo: 'calificado' | 'avisoTexto'; lead_id: string; detalle: unknown }>;
}

export function crearCorreoFake(): CorreoFake {
  const f: CorreoFake = {
    enviados: [],
    async calificado(lead, registro) {
      f.enviados.push({ tipo: 'calificado', lead_id: lead.id, detalle: registro?.folio ?? null });
    },
    async avisoTexto(lead, resumen) {
      f.enviados.push({ tipo: 'avisoTexto', lead_id: lead.id, detalle: resumen });
    },
  };
  return f;
}
