// Envío de correos por la API REST de Resend (POST https://api.resend.com/emails).
// Se usa fetch directo en vez del SDK para poder inyectar un fetch falso en las
// pruebas y mantener el proyecto sin red. Regla del brief: el remitente vive en
// avisos.klokk.mx; cualquier otro dominio aborta al construir el cliente (A22).

import type { Correo } from './types';
import { correoAvisoTexto, correoCalificado, correoResumen, type Mensaje } from './redaccion';

export const DOMINIO_REMITENTE = 'avisos.klokk.mx';

export interface OpcionesResend {
  apiKey: string;
  /** «Nombre <algo@avisos.klokk.mx>» o «algo@avisos.klokk.mx». */
  remitente: string;
  /** Destinatarios separados por coma. */
  destinatarios: string;
  ahora?: () => Date;
  fetchFn?: typeof fetch;
  base?: string;
}

export class CorreoError extends Error {
  constructor(
    public readonly status: number,
    public readonly cuerpo: unknown,
  ) {
    super(`Resend: HTTP ${status}`);
    this.name = 'CorreoError';
  }
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Devuelve la dirección de un remitente «Nombre <dir>» o «dir». Lanza si no es válido. */
export function direccionDe(remitente: string): string {
  const m = remitente.trim().match(/^(?:[^<>]*<\s*([^<>\s]+)\s*>|([^<>\s]+))$/);
  const dir = (m?.[1] ?? m?.[2] ?? '').trim();
  if (!EMAIL.test(dir)) throw new Error('CORREO_REMITENTE no es una dirección válida');
  return dir;
}

export function validarRemitente(remitente: string): string {
  const dir = direccionDe(remitente);
  const dominio = dir.slice(dir.lastIndexOf('@') + 1).toLowerCase();
  if (dominio !== DOMINIO_REMITENTE) {
    throw new Error(`CORREO_REMITENTE debe estar en ${DOMINIO_REMITENTE}, no en ${dominio}`);
  }
  return remitente.trim();
}

export function validarDestinatarios(lista: string): string[] {
  const dirs = lista
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  if (dirs.length === 0) throw new Error('CORREO_EQUIPO está vacío');
  for (const d of dirs) if (!EMAIL.test(d)) throw new Error(`CORREO_EQUIPO contiene una dirección inválida`);
  return dirs;
}

export function crearCorreoResend(op: OpcionesResend): Correo {
  const from = validarRemitente(op.remitente);
  const to = validarDestinatarios(op.destinatarios);
  const fetchFn = op.fetchFn ?? fetch;
  const ahora = op.ahora ?? (() => new Date());
  const url = `${op.base ?? 'https://api.resend.com'}/emails`;

  async function enviar(m: Mensaje): Promise<void> {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${op.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: m.asunto, text: m.texto, html: m.html }),
    });
    if (!res.ok) {
      let cuerpo: unknown = null;
      try {
        cuerpo = await res.json();
      } catch {
        cuerpo = null;
      }
      throw new CorreoError(res.status, cuerpo);
    }
  }

  return {
    calificado: (lead, registro) => enviar(correoCalificado(lead, registro, ahora())),
    avisoTexto: (lead, resumen) => enviar(correoAvisoTexto(lead, resumen, ahora())),
    resumen: (datos) => enviar(correoResumen(datos)),
  };
}
