// Fechas y horario hábil en America/Merida (brief §02.8, §06). Sin I/O.
// Yucatán no aplica horario de verano, pero igual se calcula con Intl para
// no depender de un offset fijo.

import { PLANTILLAS } from './messages';

export const ZONA = 'America/Merida';
export const HORA_INICIO = 10;
export const HORA_FIN = 18; // inclusive: 18:00:00 todavía está dentro de la ventana

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

export interface PartesMerida {
  anio: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
  /** 0 = domingo … 6 = sábado */
  diaSemana: number;
}

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function partesMerida(d: Date): PartesMerida {
  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(d)) p[type] = value;
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    segundo: Number(p.second),
    diaSemana: DIAS.indexOf(p.weekday!),
  };
}

/** Instante UTC que corresponde a una hora de pared en Mérida. */
export function desdeMerida(anio: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  let guess = Date.UTC(anio, mes - 1, dia, hora, minuto, 0, 0);
  // Dos iteraciones bastan incluso con cambios de offset.
  for (let i = 0; i < 2; i++) {
    const p = partesMerida(new Date(guess));
    const local = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
    guess += Date.UTC(anio, mes - 1, dia, hora, minuto, 0) - local;
  }
  return new Date(guess);
}

const dd = (n: number) => String(n).padStart(2, '0');

/** AAAAMMDD en Mérida (para el folio). */
export const fechaMeridaCompacta = (d: Date): string => {
  const p = partesMerida(d);
  return `${p.anio}${dd(p.mes)}${dd(p.dia)}`;
};

/** AAAA-MM-DD en Mérida (para folios_dia.fecha). */
export const fechaMeridaISO = (d: Date): string => {
  const p = partesMerida(d);
  return `${p.anio}-${dd(p.mes)}-${dd(p.dia)}`;
};

/** DD/MM/AAAA HH:mm:ss (hora de Mérida), como lo pide M3. */
export const formatoMerida = (d: Date): string => {
  const p = partesMerida(d);
  return `${dd(p.dia)}/${dd(p.mes)}/${p.anio} ${dd(p.hora)}:${dd(p.minuto)}:${dd(p.segundo)} (hora de Mérida)`;
};

const esDiaHabil = (diaSemana: number) => diaSemana >= 1 && diaSemana <= 5;

/** Lunes a viernes, de 10:00 a 18:00 inclusive, hora de Mérida. */
export function enVentanaHabil(d: Date): boolean {
  const p = partesMerida(d);
  if (!esDiaHabil(p.diaSemana)) return false;
  if (p.hora < HORA_INICIO) return false;
  if (p.hora > HORA_FIN) return false;
  if (p.hora === HORA_FIN && (p.minuto > 0 || p.segundo > 0)) return false;
  return true;
}

/**
 * Si `d` cae dentro de la ventana, se devuelve tal cual. Si cae antes de las
 * 10:00 de un día hábil, se mueve a las 10:00 de ese día. Si cae después de
 * las 18:00, en sábado o en domingo, se mueve a las 10:00 del siguiente día hábil.
 */
export function siguienteVentana(d: Date): Date {
  if (enVentanaHabil(d)) return d;
  const p = partesMerida(d);
  if (esDiaHabil(p.diaSemana) && p.hora < HORA_INICIO) {
    return desdeMerida(p.anio, p.mes, p.dia, HORA_INICIO, 0);
  }
  // Siguiente día hábil a las 10:00.
  let candidato = desdeMerida(p.anio, p.mes, p.dia, HORA_INICIO, 0);
  do {
    candidato = new Date(candidato.getTime() + 24 * 3_600_000);
  } while (!esDiaHabil(partesMerida(candidato).diaSemana));
  const c = partesMerida(candidato);
  return desdeMerida(c.anio, c.mes, c.dia, HORA_INICIO, 0);
}

export interface ProgramacionPlantilla {
  plantilla: 'T1' | 'T2' | 'T3';
  programado_para: Date;
}

/** Fechas de T1, T2 y T3 a partir del consentimiento (§06.2 y §06.3). */
export function programarPlantillas(consentimientoTs: Date): ProgramacionPlantilla[] {
  return PLANTILLAS.map((p) => ({
    plantilla: p.clave,
    programado_para: siguienteVentana(new Date(consentimientoTs.getTime() + p.dias * 24 * 3_600_000)),
  }));
}
