// A8: huella reproducible según el Anexo A.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { coordenada, formatearFolio, hashRegistro, jsonCanonico } from '../src/server/pdf/hash';

describe('JSON canónico y SHA-256', () => {
  const datos = { folio: 'DEMO-20261008-0007', evento: 'Entrada', ts: '2026-10-08T20:03:21.412Z', lat: '20.967400', lon: '-89.592600' };

  it('orden de llaves fijo, sin espacios, decimales fijos', () => {
    expect(jsonCanonico(datos)).toBe(
      '{"folio":"DEMO-20261008-0007","evento":"Entrada","ts":"2026-10-08T20:03:21.412Z","lat":"20.967400","lon":"-89.592600"}',
    );
    // Es JSON válido y el orden de llaves se conserva al parsear.
    expect(Object.keys(JSON.parse(jsonCanonico(datos)))).toEqual(['folio', 'evento', 'ts', 'lat', 'lon']);
  });

  it('coincide con shasum -a 256 sobre la cadena', () => {
    const esperado = createHash('sha256').update(jsonCanonico(datos), 'utf8').digest('hex');
    expect(hashRegistro(datos)).toBe(esperado);
    expect(hashRegistro(datos)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cualquier cambio en un dato cambia la huella', () => {
    const base = hashRegistro(datos);
    expect(hashRegistro({ ...datos, lat: '20.967401' })).not.toBe(base);
    expect(hashRegistro({ ...datos, ts: '2026-10-08T20:03:21.413Z' })).not.toBe(base);
    expect(hashRegistro({ ...datos, folio: 'DEMO-20261008-0008' })).not.toBe(base);
  });

  it('coordenada: seis decimales fijos como cadena, con signo', () => {
    expect(coordenada(20.9674)).toBe('20.967400');
    expect(coordenada(-89.59261)).toBe('-89.592610');
    expect(coordenada(20.96743251)).toBe('20.967433');
    expect(coordenada(0)).toBe('0.000000');
  });

  it('folio DEMO-AAAAMMDD-NNNN', () => {
    expect(formatearFolio('20261008', 1)).toBe('DEMO-20261008-0001');
    expect(formatearFolio('20261008', 9999)).toBe('DEMO-20261008-9999');
    expect(formatearFolio('20261008', 10000)).toBe('DEMO-20261008-10000');
  });
});
