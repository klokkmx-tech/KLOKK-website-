// A6: el PDF dice EJEMPLO, trae folio y huella, y nunca contiene las cadenas prohibidas.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';
import { PALABRAS_PROHIBIDAS } from '../src/server/flow/messages';
import { envolver, generarComprobante, verificarTextoPermitido } from '../src/server/pdf/comprobante';
import { hashRegistro } from '../src/server/pdf/hash';
import { crearEntorno, texto, ubicacion } from './helpers';

const DATOS = {
  folio: 'DEMO-20261008-0007',
  evento: 'Entrada',
  ts: '2026-10-08T20:03:21.412Z',
  lat: '20.967400',
  lon: '-89.592600',
  wa_id: '5219991234567',
};
const HASH = hashRegistro({ folio: DATOS.folio, evento: DATOS.evento, ts: DATOS.ts, lat: DATOS.lat, lon: DATOS.lon });

async function textoDe(bytes: Uint8Array) {
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  try {
    const r = await parser.getText();
    return { texto: r.text, paginas: r.total };
  } finally {
    await parser.destroy();
  }
}

describe('PDF de ejemplo (A6)', () => {
  it('es un PDF carta de una página con EJEMPLO, folio, huella y origen enmascarado', async () => {
    const bytes = await generarComprobante({ ...DATOS, hash: HASH });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeLessThan(200_000);

    // Si se pide, guarda una muestra para revisión visual.
    if (process.env.PDF_EJEMPLO_SALIDA) {
      mkdirSync(dirname(process.env.PDF_EJEMPLO_SALIDA), { recursive: true });
      writeFileSync(process.env.PDF_EJEMPLO_SALIDA, bytes);
    }

    const { texto: t, paginas } = await textoDe(bytes);
    expect(paginas).toBe(1);
    expect(t).toContain('EJEMPLO');
    expect(t).toContain('Registro de entrada');
    expect(t).toContain(DATOS.folio);
    expect(t).toContain(HASH);
    expect(t).toContain('2026-10-08T20:03:21.412Z');
    expect(t).toContain('08/10/2026 14:03:21 (hora de Mérida)');
    expect(t).toContain('20.967400');
    expect(t).toContain('-89.592600');
    expect(t).toContain('terminado en 67');
    expect(t).not.toContain(DATOS.wa_id);
    expect(t).toContain('no es un registro real de asistencia');
  });

  it('nunca contiene NOM-151, certificado, constancia ni validez legal', async () => {
    const bytes = await generarComprobante({ ...DATOS, hash: HASH });
    const { texto: t } = await textoDe(bytes);
    for (const p of PALABRAS_PROHIBIDAS) expect(t.toLowerCase(), p).not.toContain(p.toLowerCase());
    // Tampoco en el binario completo (metadatos incluidos).
    const crudo = Buffer.from(bytes).toString('latin1').toLowerCase();
    for (const p of PALABRAS_PROHIBIDAS) expect(crudo, p).not.toContain(p.toLowerCase());
  });

  it('el generador aborta si un dato trae una cadena prohibida', async () => {
    await expect(generarComprobante({ ...DATOS, hash: HASH, evento: 'Entrada con constancia' })).rejects.toThrow(/prohibido/);
    expect(() => verificarTextoPermitido('Sello NOM-151')).toThrow();
    expect(() => verificarTextoPermitido('Registro de entrada')).not.toThrow();
  });

  it('el JSON canónico impreso en el PDF reproduce la huella', async () => {
    const bytes = await generarComprobante({ ...DATOS, hash: HASH });
    const { texto: t } = await textoDe(bytes);
    // El JSON puede venir partido en varias líneas: se reconstruye quitando saltos.
    const compacto = t.replace(/\n/g, '');
    expect(compacto).toContain(
      '{"folio":"DEMO-20261008-0007","evento":"Entrada","ts":"2026-10-08T20:03:21.412Z","lat":"20.967400","lon":"-89.592600"}',
    );
  });

  it('en el flujo real el PDF subido a la Media API es el del registro', async () => {
    const e = crearEntorno();
    e.deps.pdf = generarComprobante;
    await e.entrante(DATOS.wa_id, texto('Entrada'));
    await e.entrante(DATOS.wa_id, ubicacion());
    const reg = e.db.tablas.registros[0]!;
    expect(e.wa.medias).toHaveLength(1);
    const { texto: t } = await textoDe(e.wa.medias[0]!.bytes);
    expect(t).toContain(reg.folio);
    expect(t).toContain(reg.hash_sha256);
    expect(e.wa.medias[0]!.filename).toBe(`${reg.folio}.pdf`);
    expect(e.wa.medias[0]!.mime).toBe('application/pdf');
  });
});

describe('envolver', () => {
  it('parte por palabras y corta cadenas largas sin espacios', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Courier);
    expect(envolver('a b c', font, 10, 1000)).toEqual(['a b c']);
    const largo = 'x'.repeat(100);
    const lineas = envolver(largo, font, 10, 120); // Courier 10pt: 6pt por carácter → 20 por línea
    expect(lineas.join('')).toBe(largo);
    expect(lineas.every((l) => l.length <= 20)).toBe(true);
    expect(envolver('uno\ndos', font, 10, 1000)).toEqual(['uno', 'dos']);
  });
});
