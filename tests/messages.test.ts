// Regla dura 3 y 4 sobre los textos congelados, y límites de Meta (brief §05, §06).
import { describe, expect, it } from 'vitest';
import {
  AGENDA_LINK,
  CUERPOS,
  LIMITES_META,
  M1,
  M4_BOTONES,
  M5_BOTON,
  M5_FILAS,
  M6_BOTON,
  M7_BOTONES,
  NOMBRE_FALLBACK,
  PALABRAS_PROHIBIDAS,
  PLANTILLAS,
  PRIVACIDAD_URL,
  m3Caption,
  nombreParaPlantilla,
} from '../src/server/flow/messages';
import { GIROS, TAMANOS } from '../src/server/flow/types';

const M3_EJEMPLO = m3Caption({
  folio: 'DEMO-20261008-0007',
  fecha_hora_merida: '08/10/2026 14:03:21 (hora de Mérida)',
  hash: 'a'.repeat(64),
});

const todosLosTextos: Array<[string, string]> = [
  ...Object.entries(CUERPOS),
  ['M3', M3_EJEMPLO],
  ...M4_BOTONES.map((b) => [`M4:${b.id}`, b.titulo] as [string, string]),
  ['M5:boton', M5_BOTON],
  ...M5_FILAS.map((f) => [`M5:${f.id}`, `${f.titulo} ${f.descripcion ?? ''}`] as [string, string]),
  ['M6:boton', M6_BOTON],
  ...M7_BOTONES.map((b) => [`M7:${b.id}`, b.titulo] as [string, string]),
  ...PLANTILLAS.map((p) => [p.clave, p.cuerpo] as [string, string]),
  ['NOMBRE_FALLBACK', NOMBRE_FALLBACK],
];

describe('regla 4: cadenas prohibidas', () => {
  it('ningún texto del demo contiene NOM-151, certificado, constancia ni validez legal', () => {
    for (const [clave, texto] of todosLosTextos) {
      for (const prohibida of PALABRAS_PROHIBIDAS) {
        expect(texto.toLowerCase(), `${clave} contiene «${prohibida}»`).not.toContain(prohibida.toLowerCase());
      }
    }
  });
});

describe('regla 5: aviso de privacidad en el primer mensaje', () => {
  it('M1 incluye la liga exacta al aviso antes de pedir la ubicación', () => {
    const iAviso = M1.indexOf(PRIVACIDAD_URL);
    const iPedir = M1.indexOf('comparte tu ubicación');
    expect(iAviso).toBeGreaterThan(-1);
    expect(iPedir).toBeGreaterThan(iAviso);
    expect(PRIVACIDAD_URL).toBe('https://klokk.mx/privacidad-demo');
  });
});

describe('límites de la Cloud API de Meta', () => {
  it('cuerpos de texto e interactivos', () => {
    for (const clave of ['M1b', 'M2', 'M8', 'M9'] as const) expect(CUERPOS[clave].length).toBeLessThanOrEqual(LIMITES_META.texto);
    for (const clave of ['M1', 'M4', 'M5', 'M6', 'M7'] as const) {
      expect(CUERPOS[clave].length).toBeLessThanOrEqual(LIMITES_META.cuerpoInteractivo);
    }
    expect(M3_EJEMPLO.length).toBeLessThanOrEqual(LIMITES_META.captionDocumento);
  });

  it('botones de M4 y M7: máximo 3, títulos ≤ 20', () => {
    expect(M4_BOTONES.length).toBeLessThanOrEqual(LIMITES_META.botonesMax);
    expect(M7_BOTONES.length).toBeLessThanOrEqual(LIMITES_META.botonesMax);
    for (const b of [...M4_BOTONES, ...M7_BOTONES]) expect(b.titulo.length, b.titulo).toBeLessThanOrEqual(LIMITES_META.tituloBoton);
  });

  it('lista M5: ≤ 10 filas, títulos ≤ 24, descripciones ≤ 72, botón ≤ 20', () => {
    expect(M5_FILAS.length).toBeLessThanOrEqual(LIMITES_META.filasMax);
    expect(M5_BOTON.length).toBeLessThanOrEqual(LIMITES_META.textoBotonLista);
    for (const f of M5_FILAS) {
      expect(f.titulo.length, f.titulo).toBeLessThanOrEqual(LIMITES_META.tituloFila);
      if (f.descripcion) expect(f.descripcion.length).toBeLessThanOrEqual(LIMITES_META.descripcionFila);
    }
  });

  it('cta_url M6: texto del botón ≤ 20 y liga sin teléfono', () => {
    expect(M6_BOTON.length).toBeLessThanOrEqual(LIMITES_META.textoCtaUrl);
    expect(AGENDA_LINK('abc123')).toBe('https://klokk.mx/a/abc123');
  });

  it('plantillas: cuerpo ≤ 1024, con {{1}} y {{2}}, días 1/3/7 y nombres únicos', () => {
    expect(PLANTILLAS.map((p) => p.dias)).toEqual([1, 3, 7]);
    expect(new Set(PLANTILLAS.map((p) => p.nombre)).size).toBe(3);
    for (const p of PLANTILLAS) {
      expect(p.cuerpo.length).toBeLessThanOrEqual(LIMITES_META.cuerpoPlantilla);
      expect(p.cuerpo).toContain('{{1}}');
      expect(p.cuerpo).toContain('{{2}}');
      expect(p.idioma).toBe('es_MX');
    }
    // T1 y T2 ofrecen la baja; T3 es el último mensaje y lo dice explícitamente.
    expect(PLANTILLAS[0]!.cuerpo).toContain('«Baja»');
    expect(PLANTILLAS[1]!.cuerpo).toContain('«Baja»');
    expect(PLANTILLAS[2]!.cuerpo).toContain('No te volveremos a escribir');
  });
});

describe('ids interactivos coinciden con los tipos de la máquina', () => {
  it('M4 cubre exactamente los tamaños y M5 exactamente los giros', () => {
    expect(M4_BOTONES.map((b) => b.id)).toEqual([...TAMANOS]);
    expect(M5_FILAS.map((f) => f.id)).toEqual([...GIROS]);
    expect(M7_BOTONES.map((b) => b.id)).toEqual(['consent_si', 'consent_no']);
  });
});

describe('nombre de perfil en plantillas', () => {
  it('usa el nombre si existe y NOMBRE_FALLBACK si viene vacío o nulo', () => {
    expect(nombreParaPlantilla('Ana')).toBe('Ana');
    expect(nombreParaPlantilla('  Ana  ')).toBe('Ana');
    expect(nombreParaPlantilla('')).toBe(NOMBRE_FALLBACK);
    expect(nombreParaPlantilla('   ')).toBe(NOMBRE_FALLBACK);
    expect(nombreParaPlantilla(null)).toBe(NOMBRE_FALLBACK);
    expect(nombreParaPlantilla(undefined)).toBe(NOMBRE_FALLBACK);
    expect(NOMBRE_FALLBACK.length).toBeGreaterThan(0);
  });
});
