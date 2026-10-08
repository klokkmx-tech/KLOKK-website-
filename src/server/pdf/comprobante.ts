// Generación del PDF de ejemplo (brief Anexo A). La implementación con pdf-lib
// llega en la fase 3; aquí queda el contrato que usa el ejecutor.

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

/** Marcador hasta la fase 3: el ejecutor nunca debe llegar aquí en producción. */
export const generarPdfPendiente: GeneradorPdf = async () => {
  throw new Error('Generación de PDF pendiente (fase 3)');
};
