// PDF de ejemplo del registro (brief Anexo A). Se genera en memoria con pdf-lib,
// fuentes estándar (sin archivos), una página carta. Nunca se escribe a disco ni
// a un bucket: el ejecutor lo sube a la Media API y lo envía por media_id.
//
// Regla dura 4: dice «EJEMPLO» en grande y nunca contiene «NOM-151», «certificado»,
// «constancia» ni «validez legal». Además de la prueba (tests/pdf.test.ts), el
// generador verifica cada cadena antes de dibujarla y aborta si alguna aparece.

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatoMerida } from '../flow/horario';
import { PALABRAS_PROHIBIDAS } from '../flow/messages';
import { jsonCanonico } from './hash';

export interface DatosComprobante {
  folio: string;
  evento: string;
  /** ISO-8601 UTC. */
  ts: string;
  lat: string;
  lon: string;
  hash: string;
  /** Solo se usan los dos últimos dígitos. */
  wa_id: string;
}

export type GeneradorPdf = (datos: DatosComprobante) => Promise<Uint8Array>;

// Carta: 612 × 792 pt. Márgenes de 56 pt.
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 56;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

const TINTA = rgb(15 / 255, 50 / 255, 55 / 255); // --color-ink-900
const MARCA = rgb(42 / 255, 138 / 255, 82 / 255); // --color-brand-600
const GRIS = rgb(107 / 255, 127 / 255, 127 / 255); // --color-neutral-500
const LINEA = rgb(226 / 255, 232 / 255, 232 / 255); // --color-neutral-200
const AGUA = rgb(0.82, 0.86, 0.86);

const PIE =
  'Generado automáticamente por el demo de Klokk (klokk.mx). Es un ejemplo ilustrativo; ' +
  'no es un registro real de asistencia ni tiene efectos laborales.';

export function verificarTextoPermitido(texto: string): void {
  const bajo = texto.toLowerCase();
  for (const p of PALABRAS_PROHIBIDAS) {
    if (bajo.includes(p.toLowerCase())) throw new Error(`PDF: texto prohibido «${p}»`);
  }
}

/** Parte un texto en líneas que caben en `maxAncho` (por palabras; por caracteres si no hay espacios). */
export function envolver(texto: string, font: PDFFont, size: number, maxAncho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(' ');
    let actual = '';
    for (const palabra of palabras) {
      const candidata = actual ? `${actual} ${palabra}` : palabra;
      if (font.widthOfTextAtSize(candidata, size) <= maxAncho) {
        actual = candidata;
        continue;
      }
      if (actual) lineas.push(actual);
      // Palabra más ancha que la línea (hash, JSON): se corta por caracteres.
      let trozo = '';
      for (const ch of palabra) {
        if (font.widthOfTextAtSize(trozo + ch, size) > maxAncho) {
          lineas.push(trozo);
          trozo = ch;
        } else {
          trozo += ch;
        }
      }
      actual = trozo;
    }
    lineas.push(actual);
  }
  return lineas;
}

export const generarComprobante: GeneradorPdf = async (d) => {
  const doc = await PDFDocument.create();
  doc.setTitle(`Registro de entrada ${d.folio} (EJEMPLO)`);
  doc.setSubject('Demo de Klokk - documento de ejemplo');
  doc.setProducer('Klokk demo');
  doc.setCreator('Klokk demo');
  doc.setLanguage('es-MX');

  const page = doc.addPage([ANCHO, ALTO]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const dibujar = (
    texto: string,
    x: number,
    y: number,
    o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; rotate?: number; opacity?: number } = {},
  ) => {
    verificarTextoPermitido(texto);
    page.drawText(texto, {
      x,
      y,
      font: o.font ?? regular,
      size: o.size ?? 10.5,
      color: o.color ?? TINTA,
      ...(o.rotate !== undefined ? { rotate: degrees(o.rotate) } : {}),
      ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
    });
  };

  // Marca de agua diagonal, grande y clara, detrás de todo.
  dibujar('EJEMPLO', 96, 230, { font: negrita, size: 118, color: AGUA, rotate: 38, opacity: 0.55 });

  // Etiqueta EJEMPLO arriba a la derecha.
  const etiqueta = 'EJEMPLO';
  const anchoEtiqueta = negrita.widthOfTextAtSize(etiqueta, 11) + 20;
  page.drawRectangle({
    x: ANCHO - MARGEN - anchoEtiqueta,
    y: ALTO - MARGEN - 6,
    width: anchoEtiqueta,
    height: 24,
    color: rgb(247 / 255, 240 / 255, 218 / 255),
    borderColor: rgb(217 / 255, 168 / 255, 63 / 255),
    borderWidth: 1,
  });
  dibujar(etiqueta, ANCHO - MARGEN - anchoEtiqueta + 10, ALTO - MARGEN + 1, {
    font: negrita,
    size: 11,
    color: rgb(138 / 255, 106 / 255, 31 / 255),
  });

  // Encabezado.
  let y = ALTO - MARGEN - 2;
  dibujar('Klokk', MARGEN, y, { font: negrita, size: 13, color: MARCA });
  y -= 34;
  dibujar('Registro de entrada', MARGEN, y, { font: negrita, size: 24 });
  y -= 18;
  dibujar('Demo de Klokk · documento de ejemplo', MARGEN, y, { size: 11, color: GRIS });
  y -= 22;
  linea(page, y);

  // Tabla de datos.
  const fecha = new Date(d.ts);
  const ultimos = d.wa_id.replace(/\D/g, '').slice(-2).padStart(2, '0');
  const filas: Array<[string, string, PDFFont?]> = [
    ['Folio', d.folio, mono],
    ['Evento', d.evento],
    ['Fecha y hora (UTC)', fecha.toISOString(), mono],
    ['Fecha y hora (Mérida)', formatoMerida(fecha)],
    ['Latitud', d.lat, mono],
    ['Longitud', d.lon, mono],
    ['Origen', `WhatsApp · número terminado en ${ultimos}`],
    ['Huella SHA-256', d.hash, mono],
  ];
  const colValor = MARGEN + 150;
  y -= 22;
  for (const [k, v, f] of filas) {
    dibujar(k, MARGEN, y, { size: 9.5, color: GRIS });
    const font = f ?? regular;
    const size = f ? 8.5 : 10.5;
    const lineas = envolver(v, font, size, ANCHO - MARGEN - colValor);
    for (const [i, l] of lineas.entries()) {
      dibujar(l, colValor, y - i * 13, { font, size });
    }
    y -= 13 * lineas.length + 9;
  }
  linea(page, y + 4);

  // Cómo verificar la huella.
  y -= 26;
  dibujar('Cómo verificar la huella', MARGEN, y, { font: negrita, size: 12.5 });
  y -= 18;
  const explicacion =
    'La huella es el SHA-256 (hexadecimal, en minúsculas) de la siguiente cadena en UTF-8, sin espacios, ' +
    'sin salto de línea final y con las llaves exactamente en este orden. Las coordenadas van como texto con seis decimales.';
  for (const l of envolver(explicacion, regular, 10, ANCHO_UTIL)) {
    dibujar(l, MARGEN, y, { size: 10 });
    y -= 13;
  }
  y -= 4;
  const json = jsonCanonico({ folio: d.folio, evento: d.evento, ts: d.ts, lat: d.lat, lon: d.lon });
  const lineasJson = envolver(json, mono, 8.5, ANCHO_UTIL - 20);
  page.drawRectangle({
    x: MARGEN,
    y: y - 12 * lineasJson.length - 6,
    width: ANCHO_UTIL,
    height: 12 * lineasJson.length + 14,
    color: rgb(246 / 255, 248 / 255, 248 / 255),
    borderColor: LINEA,
    borderWidth: 0.75,
  });
  for (const l of lineasJson) {
    dibujar(l, MARGEN + 10, y - 2, { font: mono, size: 8.5 });
    y -= 12;
  }
  y -= 24;
  const comando = "En una terminal: printf '%s' '<cadena>' | shasum -a 256";
  dibujar(comando, MARGEN, y, { size: 9.5, color: GRIS });
  y -= 14;
  dibujar('Si cualquier dato cambia, la huella deja de coincidir.', MARGEN, y, { size: 9.5, color: GRIS });

  // Pie.
  linea(page, MARGEN + 36);
  let yPie = MARGEN + 22;
  for (const l of envolver(PIE, regular, 8.5, ANCHO_UTIL)) {
    dibujar(l, MARGEN, yPie, { size: 8.5, color: GRIS });
    yPie -= 11;
  }

  return doc.save({ useObjectStreams: false });
};

function linea(page: PDFPage, y: number): void {
  page.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.75, color: LINEA });
}
