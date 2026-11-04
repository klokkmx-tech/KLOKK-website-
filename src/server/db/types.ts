// Contrato de acceso a datos. Dos implementaciones: supabase.ts (producción,
// llave de servicio) y memoria.ts (pruebas). Fechas como ISO-8601.

import type { Estado, GiroId, Lead, TamanoId } from '../flow/types';

export interface LeadRow extends Lead {
  id: string;
  wa_id: string;
  nombre_perfil: string | null;
  agenda_token: string;
  ultimo_entrante_ts: string | null;
  creado_ts: string;
}

export interface NuevoLead {
  wa_id: string;
  nombre_perfil: string | null;
  estado: Estado;
  agenda_token: string;
}

export interface PatchLead {
  nombre_perfil?: string | null;
  tamano?: TamanoId | null;
  giro?: GiroId | null;
  consentimiento?: boolean | null;
  consentimiento_ts?: string | null;
  baja_ts?: string | null;
  agenda_ts?: string | null;
  recordatorio_ubic_ts?: string | null;
  ultimo_entrante_ts?: string | null;
  ultimo_aviso_texto_ts?: string | null;
}

export interface MensajeEntrante {
  wa_id: string;
  tipo: string;
  meta_msg_id: string;
  cuerpo: unknown;
  /** Hora reportada por WhatsApp (ISO). */
  ts: string;
}

export interface MensajeSaliente {
  lead_id: string;
  wa_id: string;
  tipo: string;
  clave: string;
  meta_msg_id: string;
  cuerpo: unknown;
}

export interface MensajeRow {
  id: number;
  lead_id: string | null;
  wa_id: string;
  direccion: 'in' | 'out';
  tipo: string;
  clave: string | null;
  meta_msg_id: string | null;
  estatus: string | null;
  estatus_ts: string | null;
  error: unknown;
  cuerpo: unknown;
  ts: string;
}

export interface NuevoRegistro {
  lead_id: string;
  folio: string;
  evento: string;
  ts: string;
  lat: string;
  lon: string;
  hash_sha256: string;
}

export interface RegistroRow extends NuevoRegistro {
  id: number;
  media_id: string | null;
  mensaje_id: number | null;
}

export type ClavePlantilla = 'T1' | 'T2' | 'T3';

export interface PlantillaProgramadaRow {
  id: number;
  lead_id: string;
  plantilla: ClavePlantilla;
  programado_para: string;
  estado: 'pendiente' | 'enviada' | 'cancelada' | 'fallida';
  enviado_ts: string | null;
  mensaje_id: number | null;
  motivo: string | null;
}

export interface EventoRow {
  id: number;
  lead_id: string | null;
  tipo: string;
  detalle: unknown;
  ts: string;
}

export interface TotalesLeads {
  leads: number;
  calificados: number;
  agendados: number;
  bajas: number;
}

export interface Db {
  leads: {
    porWaId(wa_id: string): Promise<LeadRow | null>;
    porToken(token: string): Promise<LeadRow | null>;
    porId(id: string): Promise<LeadRow | null>;
    crear(n: NuevoLead): Promise<LeadRow>;
    /** Atómica: solo cambia si el estado actual es `esperado`. */
    transicionar(id: string, esperado: Estado, nuevo: Estado): Promise<boolean>;
    actualizar(id: string, patch: PatchLead): Promise<void>;
    porIds(ids: string[]): Promise<LeadRow[]>;
    /** Leads en ESPERA_UBIC desde antes de `limiteISO` y sin recordatorio enviado. */
    enEsperaUbicSinRecordatorio(limiteISO: string): Promise<LeadRow[]>;
    totales(): Promise<TotalesLeads>;
  };
  mensajes: {
    /** Inserta primero; si el meta_msg_id ya existe, devuelve duplicado. */
    insertarEntrante(m: MensajeEntrante): Promise<{ id: number; duplicado: false } | { duplicado: true }>;
    vincularLead(mensaje_id: number, lead_id: string): Promise<void>;
    insertarSaliente(m: MensajeSaliente): Promise<{ id: number }>;
    actualizarEstatus(meta_msg_id: string, estatus: string, estatus_ts: string, error: unknown): Promise<boolean>;
    salientesEnRango(desdeISO: string, hastaISO: string): Promise<Array<Pick<MensajeRow, 'lead_id' | 'clave' | 'estatus' | 'error'>>>;
  };
  registros: {
    /** Consecutivo del día (fecha AAAA-MM-DD en Mérida), atómico. */
    siguienteFolio(fechaISO: string): Promise<number>;
    crear(r: NuevoRegistro): Promise<RegistroRow>;
    ultimoDeLead(lead_id: string): Promise<RegistroRow | null>;
    actualizarMedia(id: number, media_id: string, mensaje_id: number | null): Promise<void>;
  };
  plantillas: {
    programar(items: Array<{ lead_id: string; plantilla: ClavePlantilla; programado_para: string }>): Promise<void>;
    /** Devuelve cuántas pendientes se cancelaron. */
    cancelarPendientes(lead_id: string, motivo: string): Promise<number>;
    /** Pendientes con programado_para ≤ ahora, en orden de fecha. */
    vencidas(ahoraISO: string): Promise<PlantillaProgramadaRow[]>;
    marcar(
      id: number,
      estado: 'enviada' | 'cancelada' | 'fallida',
      extra: { enviado_ts?: string; mensaje_id?: number; motivo?: string },
    ): Promise<void>;
    /** Cuántas pendientes hay con programado_para ≤ hastaISO. */
    pendientesHasta(hastaISO: string): Promise<number>;
  };
  eventos: {
    registrar(lead_id: string | null, tipo: string, detalle?: unknown): Promise<void>;
    enRango(desdeISO: string, hastaISO: string): Promise<EventoRow[]>;
  };
}
