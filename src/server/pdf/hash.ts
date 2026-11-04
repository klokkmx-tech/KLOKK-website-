// Huella del registro (brief Anexo A). Reproducible desde una fila de `registros`.
//
// SHA-256 en hexadecimal minúsculas sobre la cadena UTF-8 de este JSON, sin
// espacios, sin salto de línea final y con las llaves exactamente en este orden:
//
//   {"folio":"DEMO-20261008-0007","evento":"Entrada","ts":"2026-10-08T20:03:21.412Z","lat":"20.967400","lon":"-89.592600"}
//
//   folio   cadena
//   evento  siempre "Entrada" en v1
//   ts      hora de servidor, ISO-8601 UTC con milisegundos y sufijo Z (Date#toISOString)
//   lat/lon CADENAS con exactamente seis decimales (Number#toFixed(6)); el mismo
//           valor redondeado se guarda en registros.lat / registros.lon
//
// Reproducir desde la terminal:
//   printf '%s' '<json>' | shasum -a 256

import { createHash } from 'node:crypto';

export interface DatosHash {
  folio: string;
  evento: string;
  ts: string;
  lat: string;
  lon: string;
}

/** Coordenada con seis decimales fijos, como cadena. */
export const coordenada = (n: number): string => n.toFixed(6);

export function jsonCanonico(d: DatosHash): string {
  return (
    `{"folio":${JSON.stringify(d.folio)},"evento":${JSON.stringify(d.evento)},` +
    `"ts":${JSON.stringify(d.ts)},"lat":${JSON.stringify(d.lat)},"lon":${JSON.stringify(d.lon)}}`
  );
}

export function hashRegistro(d: DatosHash): string {
  return createHash('sha256').update(jsonCanonico(d), 'utf8').digest('hex');
}

/** DEMO-AAAAMMDD-NNNN. Si el día pasa de 9999, el consecutivo crece sin romper la unicidad. */
export const formatearFolio = (fechaCompacta: string, n: number): string =>
  `DEMO-${fechaCompacta}-${String(n).padStart(4, '0')}`;
