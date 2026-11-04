import { describe, expect, it } from 'vitest';
import {
  desdeMerida,
  enVentanaHabil,
  fechaMeridaCompacta,
  fechaMeridaISO,
  formatoMerida,
  partesMerida,
  programarPlantillas,
  siguienteVentana,
} from '../src/server/flow/horario';

describe('America/Merida', () => {
  it('convierte UTC a hora de Mérida (UTC−6, sin horario de verano)', () => {
    const p = partesMerida(new Date('2026-10-08T20:03:21.000Z'));
    expect(p).toEqual({ anio: 2026, mes: 10, dia: 8, hora: 14, minuto: 3, segundo: 21, diaSemana: 4 });
    expect(partesMerida(new Date('2026-07-01T12:00:00.000Z')).hora).toBe(6);
    expect(partesMerida(new Date('2026-01-01T12:00:00.000Z')).hora).toBe(6);
  });

  it('desdeMerida es la inversa de partesMerida', () => {
    expect(desdeMerida(2026, 10, 8, 14, 3).toISOString()).toBe('2026-10-08T20:03:00.000Z');
    expect(desdeMerida(2026, 10, 9, 0, 0).toISOString()).toBe('2026-10-09T06:00:00.000Z');
  });

  it('formatos de folio y de M3', () => {
    const d = new Date('2026-10-09T05:59:59.000Z'); // 23:59:59 del 8 en Mérida
    expect(fechaMeridaCompacta(d)).toBe('20261008');
    expect(fechaMeridaISO(d)).toBe('2026-10-08');
    expect(formatoMerida(d)).toBe('08/10/2026 23:59:59 (hora de Mérida)');
  });
});

describe('ventana hábil (lunes a viernes, 10:00 a 18:00 inclusive)', () => {
  const m = (y: number, mo: number, d: number, h: number, mi = 0) => desdeMerida(y, mo, d, h, mi);

  it('dentro y fuera', () => {
    expect(enVentanaHabil(m(2026, 10, 8, 10, 0))).toBe(true); // jueves 10:00
    expect(enVentanaHabil(m(2026, 10, 8, 18, 0))).toBe(true); // jueves 18:00 inclusive
    expect(enVentanaHabil(m(2026, 10, 8, 18, 1))).toBe(false);
    expect(enVentanaHabil(m(2026, 10, 8, 9, 59))).toBe(false);
    expect(enVentanaHabil(m(2026, 10, 10, 12, 0))).toBe(false); // sábado
    expect(enVentanaHabil(m(2026, 10, 11, 12, 0))).toBe(false); // domingo
    expect(enVentanaHabil(m(2026, 10, 12, 12, 0))).toBe(true); // lunes
  });

  it('siguienteVentana mueve a la siguiente apertura', () => {
    expect(siguienteVentana(m(2026, 10, 8, 12, 30))).toEqual(m(2026, 10, 8, 12, 30)); // ya dentro
    expect(siguienteVentana(m(2026, 10, 8, 7, 0))).toEqual(m(2026, 10, 8, 10, 0)); // antes de abrir
    expect(siguienteVentana(m(2026, 10, 8, 18, 30))).toEqual(m(2026, 10, 9, 10, 0)); // después de cerrar → viernes
    expect(siguienteVentana(m(2026, 10, 9, 19, 0))).toEqual(m(2026, 10, 12, 10, 0)); // viernes noche → lunes
    expect(siguienteVentana(m(2026, 10, 10, 11, 0))).toEqual(m(2026, 10, 12, 10, 0)); // sábado → lunes
    expect(siguienteVentana(m(2026, 10, 11, 3, 0))).toEqual(m(2026, 10, 12, 10, 0)); // domingo madrugada → lunes
    expect(siguienteVentana(m(2026, 12, 31, 20, 0))).toEqual(m(2027, 1, 1, 10, 0)); // cambio de año (viernes 1 ene)
  });

  it('programarPlantillas: 1, 3 y 7 días naturales movidos a ventana', () => {
    // Consentimiento jueves 8 oct 2026 a las 14:00 Mérida.
    const fechas = programarPlantillas(m(2026, 10, 8, 14, 0));
    expect(fechas.map((f) => [f.plantilla, f.programado_para.toISOString()])).toEqual([
      ['T1', m(2026, 10, 9, 14, 0).toISOString()], // viernes 14:00
      ['T2', m(2026, 10, 12, 10, 0).toISOString()], // domingo → lunes 10:00
      ['T3', m(2026, 10, 15, 14, 0).toISOString()], // jueves 14:00
    ]);

    // Consentimiento viernes 20:30: T1 cae sábado → lunes 10:00; T2 cae lunes 20:30 → martes 10:00;
    // T3 cae viernes 20:30 → lunes siguiente 10:00.
    const tarde = programarPlantillas(m(2026, 10, 9, 20, 30));
    expect(tarde.map((f) => f.programado_para.toISOString())).toEqual([
      m(2026, 10, 12, 10, 0).toISOString(),
      m(2026, 10, 13, 10, 0).toISOString(),
      m(2026, 10, 19, 10, 0).toISOString(),
    ]);
  });
});
