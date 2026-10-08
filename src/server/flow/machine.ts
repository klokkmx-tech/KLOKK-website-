// Máquina de estados del demo (brief §04). Función pura: sin I/O, sin fechas
// implícitas (todo «ahora» entra por parámetro). Cada fila de la tabla de
// transiciones está referenciada en los comentarios y cubierta en
// tests/machine.test.ts.

import type { Accion, ClaveMensaje, Estado, Evento, Lead, Resultado } from './types';

export const MIN_RECORDATORIO_MS = 10 * 60_000;
export const MIN_ENTRE_AVISOS_TEXTO_MS = 60 * 60_000;

const enviar = (clave: ClaveMensaje): Accion => ({ tipo: 'ENVIAR', clave });
const nada = (estado: Estado): Resultado => ({ estado, acciones: [] });

/** Estado al que regresa un lead ya calificado tras repetir el demo. */
export function estadoFinal(lead: Pick<Lead, 'baja_ts' | 'agenda_ts'>): Estado {
  if (lead.baja_ts) return 'BAJA';
  if (lead.agenda_ts) return 'AGENDADO';
  return 'CALIFICADO';
}

/** Eventos que provienen de un mensaje del lead (no de un cron ni de un clic web). */
const ES_ENTRANTE: Record<Evento['tipo'], boolean> = {
  ENTRADA: true,
  BAJA: true,
  UBICACION: true,
  BOTON_TAMANO: true,
  LISTA_GIRO: true,
  BOTON_CONSENT: true,
  TEXTO_LIBRE: true,
  TIMEOUT_UBIC: false,
  CLIC_AGENDA: false,
};

/**
 * transition(lead, evento, ahora) -> { estado, acciones }.
 * `lead === null` significa número desconocido (filas 1 y 2).
 */
export function transition(lead: Lead | null, evento: Evento, ahora: Date): Resultado {
  if (lead === null) return sinLead(evento);

  const r = conLead(lead, evento, ahora);

  // Regla §06.6: cualquier mensaje entrante posterior al consentimiento cancela
  // las plantillas pendientes. Las filas de baja y agenda ya lo incluyen.
  const yaCancela = r.acciones.some((a) => a.tipo === 'CANCELAR_PLANTILLAS');
  if (lead.consentimiento === true && ES_ENTRANTE[evento.tipo] && !yaCancela) {
    r.acciones.unshift({ tipo: 'CANCELAR_PLANTILLAS', motivo: 'respuesta' });
  }
  return r;
}

function sinLead(evento: Evento): Resultado {
  switch (evento.tipo) {
    case 'ENTRADA': // fila 1
      return { estado: 'ESPERA_UBIC', acciones: [{ tipo: 'CREAR_LEAD' }, enviar('M1')] };
    case 'TIMEOUT_UBIC':
    case 'CLIC_AGENDA': // no pueden ocurrir sin lead
      return nada('NUEVO');
    default: // fila 2
      return {
        estado: 'NUEVO',
        acciones: [{ tipo: 'CREAR_LEAD' }, enviar('M9'), { tipo: 'CORREO_AVISO_TEXTO' }],
      };
  }
}

function conLead(lead: Lead, evento: Evento, ahora: Date): Resultado {
  const e = lead.estado;

  switch (evento.tipo) {
    case 'ENTRADA': {
      // fila 7: ya en ESPERA_UBIC, solo se reenvía M1 y el temporizador sigue.
      if (e === 'ESPERA_UBIC') return { estado: e, acciones: [enviar('M1')] };
      // filas 3 y 13: cualquier otro estado arranca (o reinicia) el demo.
      return { estado: 'ESPERA_UBIC', acciones: [{ tipo: 'REINICIAR_RECORDATORIO' }, enviar('M1')] };
    }

    case 'BAJA': {
      if (e === 'BAJA') return { estado: 'BAJA', acciones: [enviar('M8')] }; // fila 19
      return {
        // fila 14
        estado: 'BAJA',
        acciones: [{ tipo: 'GUARDAR_BAJA' }, { tipo: 'CANCELAR_PLANTILLAS', motivo: 'baja' }, enviar('M8')],
      };
    }

    case 'CLIC_AGENDA': {
      // fila 15
      const acciones: Accion[] = [];
      if (!lead.agenda_ts) acciones.push({ tipo: 'GUARDAR_AGENDA' });
      acciones.push({ tipo: 'CANCELAR_PLANTILLAS', motivo: 'agenda' }, { tipo: 'REDIRIGIR' });
      return { estado: 'AGENDADO', acciones };
    }

    case 'UBICACION': {
      if (e !== 'ESPERA_UBIC') return nada(e); // fila 18
      const base: Accion[] = [
        { tipo: 'CREAR_REGISTRO', lat: evento.lat, lon: evento.lon },
        enviar('M2'),
        { tipo: 'GENERAR_PDF' },
        enviar('M3'),
      ];
      if (lead.tamano && lead.giro) {
        // fila 5: lead ya calificado repite el demo.
        return { estado: estadoFinal(lead), acciones: [...base, enviar('M6')] };
      }
      return { estado: 'ESPERA_TAMANO', acciones: [...base, enviar('M4')] }; // fila 4
    }

    case 'TIMEOUT_UBIC': {
      // fila 6
      if (e !== 'ESPERA_UBIC' || lead.recordatorio_ubic_ts) return nada(e);
      if (ahora.getTime() - Date.parse(lead.estado_ts) < MIN_RECORDATORIO_MS) return nada(e);
      return { estado: e, acciones: [enviar('M1b'), { tipo: 'MARCAR_RECORDATORIO' }] };
    }

    case 'BOTON_TAMANO': {
      if (e !== 'ESPERA_TAMANO') return nada(e); // fila 17
      return { estado: 'ESPERA_GIRO', acciones: [{ tipo: 'GUARDAR_TAMANO', id: evento.id }, enviar('M5')] }; // fila 8
    }

    case 'LISTA_GIRO': {
      if (e !== 'ESPERA_GIRO') return nada(e); // fila 17
      const acciones: Accion[] = [
        { tipo: 'GUARDAR_GIRO', id: evento.id },
        { tipo: 'CORREO_CALIFICADO' },
        enviar('M6'),
      ];
      // fila 9: M7 solo si nunca respondió y no tiene baja previa; fila 10 si no.
      if (lead.consentimiento === null && !lead.baja_ts) acciones.push(enviar('M7'));
      return { estado: estadoFinal(lead), acciones };
    }

    case 'BOTON_CONSENT': {
      // filas 11 y 12. Se admite también en AGENDADO (el lead pudo tocar la
      // agenda antes de responder M7); en ese caso se guarda el consentimiento
      // pero no se programan plantillas (§06.1).
      const admite = e === 'CALIFICADO' || e === 'AGENDADO';
      if (!admite || lead.consentimiento !== null || lead.baja_ts) return nada(e); // fila 17
      if (evento.valor === 'no') return { estado: e, acciones: [{ tipo: 'GUARDAR_CONSENT', valor: false }] };
      const acciones: Accion[] = [{ tipo: 'GUARDAR_CONSENT', valor: true }];
      if (!lead.agenda_ts) acciones.push({ tipo: 'PROGRAMAR_PLANTILLAS' });
      return { estado: e, acciones };
    }

    case 'TEXTO_LIBRE': {
      // fila 16
      const acciones: Accion[] = [enviar('M9')];
      if (puedeAvisarTextoLibre(lead, ahora)) acciones.push({ tipo: 'CORREO_AVISO_TEXTO' });
      return { estado: e, acciones };
    }
  }
}

function puedeAvisarTextoLibre(lead: Lead, ahora: Date): boolean {
  if (!lead.ultimo_aviso_texto_ts) return true;
  return ahora.getTime() - Date.parse(lead.ultimo_aviso_texto_ts) >= MIN_ENTRE_AVISOS_TEXTO_MS;
}
