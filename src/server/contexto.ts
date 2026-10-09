// Arma las dependencias reales a partir de las variables de entorno de servidor.
// Es el único módulo del demo que importa `astro:env/server`; por eso solo lo
// importan los endpoints (nunca las pruebas ni los componentes del sitio).

import {
  AGENDA_URL,
  CORREO_EQUIPO,
  CORREO_REMITENTE,
  CRON_SECRET,
  RESEND_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  WA_ACCESS_TOKEN,
  WA_API_VERSION,
  WA_APP_SECRET,
  WA_PHONE_NUMBER_ID,
  WA_VERIFY_TOKEN,
} from 'astro:env/server';
import { waitUntil } from '@vercel/functions';
import { crearCorreoFake } from './correo/types';
import { crearDbSupabase, crearSupabase } from './db/supabase';
import type { Deps } from './flow/executor';
import { generarComprobante } from './pdf/comprobante';
import { crearWaClient } from './wa/client';

export interface Contexto {
  deps: Deps;
  appSecret: string;
  verifyToken: string;
  cronSecret: string;
  agendaUrl: string;
  waitUntil: (p: Promise<unknown>) => void;
}

/** Log sin secretos: solo texto fijo y detalle estructurado. */
export const log = (mensaje: string, detalle?: Record<string, unknown>): void => {
  console.log(JSON.stringify({ demo: mensaje, ...(detalle ?? {}) }));
};

let cache: Contexto | null = null;

export function contexto(): Contexto {
  if (cache) return cache;

  // Fase 5 reemplaza el correo falso por Resend y valida el remitente en avisos.klokk.mx.
  void RESEND_API_KEY;
  void CORREO_REMITENTE;
  void CORREO_EQUIPO;

  const db = crearDbSupabase(crearSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY));
  const wa = crearWaClient({ token: WA_ACCESS_TOKEN, phoneNumberId: WA_PHONE_NUMBER_ID, apiVersion: WA_API_VERSION });

  cache = {
    deps: { db, wa, pdf: generarComprobante, correo: crearCorreoFake(), ahora: () => new Date(), log },
    appSecret: WA_APP_SECRET,
    verifyToken: WA_VERIFY_TOKEN,
    cronSecret: CRON_SECRET,
    agendaUrl: AGENDA_URL,
    waitUntil: (p) => waitUntil(p),
  };
  return cache;
}
