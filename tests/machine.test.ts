// Pruebas de la máquina de estados: una por fila de la tabla de §04 y una por
// cada caso borde listado en el brief.
import { describe, expect, it } from 'vitest';
import { MIN_RECORDATORIO_MS, estadoFinal, transition } from '../src/server/flow/machine';
import type { Accion, Estado, Evento, Lead } from '../src/server/flow/types';

const AHORA = new Date('2026-10-08T20:00:00.000Z');
const hace = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();

const lead = (p: Partial<Lead> = {}): Lead => ({
  estado: 'NUEVO',
  estado_ts: hace(60_000),
  tamano: null,
  giro: null,
  consentimiento: null,
  consentimiento_ts: null,
  baja_ts: null,
  agenda_ts: null,
  recordatorio_ubic_ts: null,
  ultimo_aviso_texto_ts: null,
  ...p,
});

const calificado = (p: Partial<Lead> = {}): Lead =>
  lead({ estado: 'CALIFICADO', tamano: 'tam_25_100', giro: 'giro_comercio', ...p });

const tipos = (acciones: Accion[]) => acciones.map((a) => a.tipo);
const enviados = (acciones: Accion[]) =>
  acciones.flatMap((a) => (a.tipo === 'ENVIAR' ? [a.clave] : []));

const ENTRADA: Evento = { tipo: 'ENTRADA' };
const BAJA: Evento = { tipo: 'BAJA' };
const UBIC: Evento = { tipo: 'UBICACION', lat: 20.9674, lon: -89.5926 };
const TEXTO: Evento = { tipo: 'TEXTO_LIBRE', resumen: 'hola' };
const CLIC: Evento = { tipo: 'CLIC_AGENDA' };
const TIMEOUT: Evento = { tipo: 'TIMEOUT_UBIC' };
const CONSENT_SI: Evento = { tipo: 'BOTON_CONSENT', valor: 'si' };
const CONSENT_NO: Evento = { tipo: 'BOTON_CONSENT', valor: 'no' };

describe('tabla de transiciones §04', () => {
  it('fila 1: desconocido + ENTRADA → ESPERA_UBIC, crear lead y M1', () => {
    const r = transition(null, ENTRADA, AHORA);
    expect(r.estado).toBe('ESPERA_UBIC');
    expect(r.acciones).toEqual([{ tipo: 'CREAR_LEAD' }, { tipo: 'ENVIAR', clave: 'M1' }]);
  });

  it('fila 2: desconocido + cualquier otro → NUEVO, crear lead, M9 y correo', () => {
    for (const ev of [TEXTO, UBIC, BAJA, CONSENT_SI] as Evento[]) {
      const r = transition(null, ev, AHORA);
      expect(r.estado).toBe('NUEVO');
      expect(r.acciones).toEqual([
        { tipo: 'CREAR_LEAD' },
        { tipo: 'ENVIAR', clave: 'M9' },
        { tipo: 'CORREO_AVISO_TEXTO' },
      ]);
    }
  });

  it('fila 3: NUEVO + ENTRADA → ESPERA_UBIC y M1', () => {
    const r = transition(lead({ estado: 'NUEVO' }), ENTRADA, AHORA);
    expect(r.estado).toBe('ESPERA_UBIC');
    expect(r.acciones).toEqual([{ tipo: 'REINICIAR_RECORDATORIO' }, { tipo: 'ENVIAR', clave: 'M1' }]);
  });

  it('fila 4: ESPERA_UBIC + UBICACION (sin calificar) → ESPERA_TAMANO con registro, M2, PDF, M3, M4', () => {
    const r = transition(lead({ estado: 'ESPERA_UBIC' }), UBIC, AHORA);
    expect(r.estado).toBe('ESPERA_TAMANO');
    expect(r.acciones).toEqual([
      { tipo: 'CREAR_REGISTRO', lat: 20.9674, lon: -89.5926 },
      { tipo: 'ENVIAR', clave: 'M2' },
      { tipo: 'GENERAR_PDF' },
      { tipo: 'ENVIAR', clave: 'M3' },
      { tipo: 'ENVIAR', clave: 'M4' },
    ]);
  });

  it('fila 5: ESPERA_UBIC + UBICACION (ya calificado) → estado final con M6 y sin M4', () => {
    const r = transition(calificado({ estado: 'ESPERA_UBIC' }), UBIC, AHORA);
    expect(r.estado).toBe('CALIFICADO');
    expect(enviados(r.acciones)).toEqual(['M2', 'M3', 'M6']);
    expect(tipos(r.acciones)).toContain('CREAR_REGISTRO');
    expect(tipos(r.acciones)).toContain('GENERAR_PDF');
  });

  it('fila 6: ESPERA_UBIC + TIMEOUT_UBIC tras 10 min → M1b y marcar recordatorio', () => {
    const l = lead({ estado: 'ESPERA_UBIC', estado_ts: hace(MIN_RECORDATORIO_MS) });
    const r = transition(l, TIMEOUT, AHORA);
    expect(r.estado).toBe('ESPERA_UBIC');
    expect(r.acciones).toEqual([{ tipo: 'ENVIAR', clave: 'M1b' }, { tipo: 'MARCAR_RECORDATORIO' }]);
  });

  it('fila 6 (guarda): antes de 10 min no hay recordatorio', () => {
    const l = lead({ estado: 'ESPERA_UBIC', estado_ts: hace(MIN_RECORDATORIO_MS - 1) });
    expect(transition(l, TIMEOUT, AHORA).acciones).toEqual([]);
  });

  it('fila 7: ESPERA_UBIC + ENTRADA → sigue en ESPERA_UBIC y reenvía M1 sin reiniciar el temporizador', () => {
    const r = transition(lead({ estado: 'ESPERA_UBIC' }), ENTRADA, AHORA);
    expect(r.estado).toBe('ESPERA_UBIC');
    expect(r.acciones).toEqual([{ tipo: 'ENVIAR', clave: 'M1' }]);
  });

  it('fila 8: ESPERA_TAMANO + BOTON_TAMANO → ESPERA_GIRO, guardar tamaño y M5', () => {
    const r = transition(lead({ estado: 'ESPERA_TAMANO' }), { tipo: 'BOTON_TAMANO', id: 'tam_mas_100' }, AHORA);
    expect(r.estado).toBe('ESPERA_GIRO');
    expect(r.acciones).toEqual([{ tipo: 'GUARDAR_TAMANO', id: 'tam_mas_100' }, { tipo: 'ENVIAR', clave: 'M5' }]);
  });

  it('fila 9: ESPERA_GIRO + LISTA_GIRO (sin consentimiento previo) → CALIFICADO, correo, M6 y M7', () => {
    const l = lead({ estado: 'ESPERA_GIRO', tamano: 'tam_menos_25' });
    const r = transition(l, { tipo: 'LISTA_GIRO', id: 'giro_construccion' }, AHORA);
    expect(r.estado).toBe('CALIFICADO');
    expect(r.acciones).toEqual([
      { tipo: 'GUARDAR_GIRO', id: 'giro_construccion' },
      { tipo: 'CORREO_CALIFICADO' },
      { tipo: 'ENVIAR', clave: 'M6' },
      { tipo: 'ENVIAR', clave: 'M7' },
    ]);
  });

  it('fila 10: ESPERA_GIRO + LISTA_GIRO con consentimiento ya respondido → sin M7', () => {
    const l = lead({ estado: 'ESPERA_GIRO', tamano: 'tam_menos_25', consentimiento: false });
    const r = transition(l, { tipo: 'LISTA_GIRO', id: 'giro_otro' }, AHORA);
    expect(r.estado).toBe('CALIFICADO');
    expect(enviados(r.acciones)).toEqual(['M6']);
    expect(tipos(r.acciones)).toContain('CORREO_CALIFICADO');
  });

  it('fila 10 (baja previa): ESPERA_GIRO + LISTA_GIRO con baja_ts → BAJA y sin M7', () => {
    const l = lead({ estado: 'ESPERA_GIRO', tamano: 'tam_menos_25', baja_ts: hace(86_400_000) });
    const r = transition(l, { tipo: 'LISTA_GIRO', id: 'giro_otro' }, AHORA);
    expect(r.estado).toBe('BAJA');
    expect(enviados(r.acciones)).toEqual(['M6']);
  });

  it('fila 11: CALIFICADO + BOTON_CONSENT(si) → guardar consentimiento y programar plantillas', () => {
    const r = transition(calificado(), CONSENT_SI, AHORA);
    expect(r.estado).toBe('CALIFICADO');
    expect(r.acciones).toEqual([{ tipo: 'GUARDAR_CONSENT', valor: true }, { tipo: 'PROGRAMAR_PLANTILLAS' }]);
  });

  it('fila 12: CALIFICADO + BOTON_CONSENT(no) → guardar false, nada más', () => {
    const r = transition(calificado(), CONSENT_NO, AHORA);
    expect(r.estado).toBe('CALIFICADO');
    expect(r.acciones).toEqual([{ tipo: 'GUARDAR_CONSENT', valor: false }]);
  });

  it('fila 13: cualquier estado ≠ ESPERA_UBIC + ENTRADA → ESPERA_UBIC y M1', () => {
    for (const estado of ['ESPERA_TAMANO', 'ESPERA_GIRO', 'CALIFICADO', 'AGENDADO', 'BAJA'] as Estado[]) {
      const r = transition(lead({ estado }), ENTRADA, AHORA);
      expect(r.estado).toBe('ESPERA_UBIC');
      expect(enviados(r.acciones)).toEqual(['M1']);
      expect(tipos(r.acciones)).toContain('REINICIAR_RECORDATORIO');
    }
  });

  it('fila 14: cualquier estado + BAJA → BAJA, guardar baja, cancelar plantillas y M8', () => {
    for (const estado of ['NUEVO', 'ESPERA_UBIC', 'ESPERA_TAMANO', 'ESPERA_GIRO', 'CALIFICADO', 'AGENDADO'] as Estado[]) {
      const r = transition(lead({ estado }), BAJA, AHORA);
      expect(r.estado).toBe('BAJA');
      expect(r.acciones).toEqual([
        { tipo: 'GUARDAR_BAJA' },
        { tipo: 'CANCELAR_PLANTILLAS', motivo: 'baja' },
        { tipo: 'ENVIAR', clave: 'M8' },
      ]);
    }
  });

  it('fila 15: cualquier estado + CLIC_AGENDA → AGENDADO, guardar agenda, cancelar plantillas y redirigir', () => {
    for (const estado of ['NUEVO', 'ESPERA_UBIC', 'ESPERA_GIRO', 'CALIFICADO', 'BAJA'] as Estado[]) {
      const r = transition(lead({ estado }), CLIC, AHORA);
      expect(r.estado).toBe('AGENDADO');
      expect(r.acciones).toEqual([
        { tipo: 'GUARDAR_AGENDA' },
        { tipo: 'CANCELAR_PLANTILLAS', motivo: 'agenda' },
        { tipo: 'REDIRIGIR' },
      ]);
    }
  });

  it('fila 16: cualquier estado + TEXTO_LIBRE → sin cambio, M9 y correo de aviso', () => {
    for (const estado of ['NUEVO', 'ESPERA_UBIC', 'ESPERA_TAMANO', 'ESPERA_GIRO', 'CALIFICADO', 'AGENDADO', 'BAJA'] as Estado[]) {
      const r = transition(lead({ estado }), TEXTO, AHORA);
      expect(r.estado).toBe(estado);
      expect(r.acciones).toEqual([{ tipo: 'ENVIAR', clave: 'M9' }, { tipo: 'CORREO_AVISO_TEXTO' }]);
    }
  });

  it('fila 17: respuesta interactiva fuera de estado → ninguna acción', () => {
    expect(transition(lead({ estado: 'ESPERA_UBIC' }), { tipo: 'BOTON_TAMANO', id: 'tam_25_100' }, AHORA).acciones).toEqual([]);
    expect(transition(lead({ estado: 'ESPERA_TAMANO' }), { tipo: 'LISTA_GIRO', id: 'giro_otro' }, AHORA).acciones).toEqual([]);
    expect(transition(lead({ estado: 'ESPERA_GIRO' }), CONSENT_SI, AHORA).acciones).toEqual([]);
    expect(transition(calificado(), { tipo: 'BOTON_TAMANO', id: 'tam_25_100' }, AHORA).acciones).toEqual([]);
  });

  it('fila 18: UBICACION fuera de ESPERA_UBIC → ninguna acción y sin cambio de estado', () => {
    for (const estado of ['NUEVO', 'ESPERA_TAMANO', 'ESPERA_GIRO', 'CALIFICADO', 'AGENDADO', 'BAJA'] as Estado[]) {
      const r = transition(lead({ estado }), UBIC, AHORA);
      expect(r.estado).toBe(estado);
      expect(r.acciones).toEqual([]);
    }
  });

  it('fila 19: BAJA + BAJA → solo M8', () => {
    const r = transition(lead({ estado: 'BAJA', baja_ts: hace(1000) }), BAJA, AHORA);
    expect(r.estado).toBe('BAJA');
    expect(r.acciones).toEqual([{ tipo: 'ENVIAR', clave: 'M8' }]);
  });

  // La fila 20 (ESTATUS) no entra a la máquina: la maneja el webhook actualizando
  // mensajes.estatus. tests/webhook.test.ts la cubre en la fase 2.
});

describe('casos borde', () => {
  it('lead en BAJA escribe Entrada: corre el demo, nunca M7, nunca plantillas', () => {
    const base = lead({ estado: 'BAJA', baja_ts: hace(3_600_000) });
    const r1 = transition(base, ENTRADA, AHORA);
    expect(r1.estado).toBe('ESPERA_UBIC');

    const r2 = transition({ ...base, estado: 'ESPERA_UBIC' }, UBIC, AHORA);
    expect(r2.estado).toBe('ESPERA_TAMANO');

    const r3 = transition({ ...base, estado: 'ESPERA_TAMANO' }, { tipo: 'BOTON_TAMANO', id: 'tam_25_100' }, AHORA);
    expect(r3.estado).toBe('ESPERA_GIRO');

    const r4 = transition({ ...base, estado: 'ESPERA_GIRO', tamano: 'tam_25_100' }, { tipo: 'LISTA_GIRO', id: 'giro_comercio' }, AHORA);
    expect(r4.estado).toBe('BAJA');
    expect(enviados(r4.acciones)).not.toContain('M7');

    // Aunque llegara un «Sí» de un botón viejo, nunca se programan plantillas.
    const r5 = transition({ ...base, estado: 'CALIFICADO', tamano: 'tam_25_100', giro: 'giro_comercio' }, CONSENT_SI, AHORA);
    expect(tipos(r5.acciones)).not.toContain('PROGRAMAR_PLANTILLAS');
    for (const r of [r1, r2, r3, r4, r5]) expect(tipos(r.acciones)).not.toContain('PROGRAMAR_PLANTILLAS');
  });

  it('lead calificado repite el demo: sin M4, M5 ni M7; con M6 y registro nuevo', () => {
    const base = calificado({ consentimiento: false });
    const r1 = transition(base, ENTRADA, AHORA);
    expect(r1.estado).toBe('ESPERA_UBIC');
    const r2 = transition({ ...base, estado: 'ESPERA_UBIC' }, UBIC, AHORA);
    expect(r2.estado).toBe('CALIFICADO');
    expect(enviados(r2.acciones)).toEqual(['M2', 'M3', 'M6']);
    expect(tipos(r2.acciones)).toContain('CREAR_REGISTRO');
  });

  it('lead AGENDADO repite el demo y termina en AGENDADO', () => {
    const base = calificado({ estado: 'AGENDADO', agenda_ts: hace(1000), consentimiento: true });
    const r = transition({ ...base, estado: 'ESPERA_UBIC' }, UBIC, AHORA);
    expect(r.estado).toBe('AGENDADO');
    expect(enviados(r.acciones)).toEqual(['M2', 'M3', 'M6']);
  });

  it('botón de consentimiento recibido dos veces: la segunda no guarda ni programa', () => {
    const r = transition(calificado({ consentimiento: true, consentimiento_ts: hace(1000) }), CONSENT_SI, AHORA);
    expect(tipos(r.acciones)).not.toContain('GUARDAR_CONSENT');
    expect(tipos(r.acciones)).not.toContain('PROGRAMAR_PLANTILLAS');
  });

  it('consentimiento en AGENDADO: se guarda pero no se programan plantillas', () => {
    const r = transition(calificado({ estado: 'AGENDADO', agenda_ts: hace(1000) }), CONSENT_SI, AHORA);
    expect(r.estado).toBe('AGENDADO');
    expect(r.acciones).toEqual([{ tipo: 'GUARDAR_CONSENT', valor: true }]);
  });

  it('ubicación en ESPERA_TAMANO: ninguna acción', () => {
    expect(transition(lead({ estado: 'ESPERA_TAMANO' }), UBIC, AHORA).acciones).toEqual([]);
  });

  it('TIMEOUT_UBIC con recordatorio ya enviado: ninguna acción', () => {
    const l = lead({ estado: 'ESPERA_UBIC', estado_ts: hace(3_600_000), recordatorio_ubic_ts: hace(1_800_000) });
    expect(transition(l, TIMEOUT, AHORA).acciones).toEqual([]);
  });

  it('TIMEOUT_UBIC fuera de ESPERA_UBIC: ninguna acción', () => {
    expect(transition(lead({ estado: 'ESPERA_TAMANO', estado_ts: hace(3_600_000) }), TIMEOUT, AHORA).acciones).toEqual([]);
  });

  it('CLIC_AGENDA repetido no vuelve a guardar agenda_ts', () => {
    const r = transition(calificado({ estado: 'AGENDADO', agenda_ts: hace(1000) }), CLIC, AHORA);
    expect(r.estado).toBe('AGENDADO');
    expect(tipos(r.acciones)).not.toContain('GUARDAR_AGENDA');
    expect(tipos(r.acciones)).toContain('REDIRIGIR');
  });

  it('TEXTO_LIBRE dos veces en 10 minutos: M9 ambas, correo solo la primera', () => {
    const primero = transition(calificado(), TEXTO, AHORA);
    expect(tipos(primero.acciones)).toContain('CORREO_AVISO_TEXTO');
    const segundo = transition(calificado({ ultimo_aviso_texto_ts: hace(10 * 60_000) }), TEXTO, AHORA);
    expect(segundo.acciones).toEqual([{ tipo: 'ENVIAR', clave: 'M9' }]);
    const unaHoraDespues = transition(calificado({ ultimo_aviso_texto_ts: hace(60 * 60_000) }), TEXTO, AHORA);
    expect(tipos(unaHoraDespues.acciones)).toContain('CORREO_AVISO_TEXTO');
  });

  it('cualquier mensaje entrante después del consentimiento cancela las plantillas', () => {
    const l = calificado({ consentimiento: true, consentimiento_ts: hace(60_000) });
    const entrantes: Evento[] = [TEXTO, UBIC, ENTRADA, { tipo: 'BOTON_TAMANO', id: 'tam_25_100' }, CONSENT_SI];
    for (const ev of entrantes) {
      const r = transition(l, ev, AHORA);
      expect(r.acciones[0]).toEqual({ tipo: 'CANCELAR_PLANTILLAS', motivo: 'respuesta' });
    }
    // Las de baja y agenda llevan su propio motivo, sin duplicar.
    expect(transition(l, BAJA, AHORA).acciones.filter((a) => a.tipo === 'CANCELAR_PLANTILLAS')).toEqual([
      { tipo: 'CANCELAR_PLANTILLAS', motivo: 'baja' },
    ]);
    expect(transition(l, CLIC, AHORA).acciones.filter((a) => a.tipo === 'CANCELAR_PLANTILLAS')).toEqual([
      { tipo: 'CANCELAR_PLANTILLAS', motivo: 'agenda' },
    ]);
    // Un cron no es una respuesta del lead.
    expect(tipos(transition({ ...l, estado: 'ESPERA_UBIC' }, TIMEOUT, AHORA).acciones)).not.toContain('CANCELAR_PLANTILLAS');
  });

  it('sin consentimiento no se emite CANCELAR_PLANTILLAS implícito', () => {
    expect(tipos(transition(calificado(), TEXTO, AHORA).acciones)).not.toContain('CANCELAR_PLANTILLAS');
    expect(tipos(transition(calificado({ consentimiento: false }), TEXTO, AHORA).acciones)).not.toContain('CANCELAR_PLANTILLAS');
  });

  it('el «Sí» que otorga el consentimiento programa y no cancela', () => {
    const r = transition(calificado(), CONSENT_SI, AHORA);
    expect(tipos(r.acciones)).not.toContain('CANCELAR_PLANTILLAS');
  });

  it('estadoFinal: baja gana sobre agenda, agenda sobre calificado', () => {
    expect(estadoFinal({ baja_ts: 'x', agenda_ts: 'y' })).toBe('BAJA');
    expect(estadoFinal({ baja_ts: null, agenda_ts: 'y' })).toBe('AGENDADO');
    expect(estadoFinal({ baja_ts: null, agenda_ts: null })).toBe('CALIFICADO');
  });

  it('es pura: no muta el lead ni el evento', () => {
    const l = calificado({ consentimiento: true });
    const copia = structuredClone(l);
    transition(l, TEXTO, AHORA);
    transition(l, BAJA, AHORA);
    expect(l).toEqual(copia);
  });
});
