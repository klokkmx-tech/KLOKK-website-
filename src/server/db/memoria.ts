// Implementación en memoria de `Db` para pruebas. Misma semántica que Supabase:
// unicidad de meta_msg_id, transición atómica, folio por día.

import type { Estado } from '../flow/types';
import type {
  Db,
  LeadRow,
  MensajeRow,
  PlantillaProgramadaRow,
  RegistroRow,
} from './types';

export interface EventoRow {
  id: number;
  lead_id: string | null;
  tipo: string;
  detalle: unknown;
  ts: string;
}

export interface DbMemoria extends Db {
  tablas: {
    leads: LeadRow[];
    mensajes: MensajeRow[];
    registros: RegistroRow[];
    folios_dia: Map<string, number>;
    plantillas: PlantillaProgramadaRow[];
    eventos: EventoRow[];
  };
}

export function crearDbMemoria(ahora: () => Date = () => new Date()): DbMemoria {
  const t: DbMemoria['tablas'] = {
    leads: [],
    mensajes: [],
    registros: [],
    folios_dia: new Map(),
    plantillas: [],
    eventos: [],
  };
  let ids = 0;
  const iso = () => ahora().toISOString();
  const clon = <T>(x: T): T => structuredClone(x);

  const db: DbMemoria = {
    tablas: t,
    leads: {
      async porWaId(wa_id) {
        return clon(t.leads.find((l) => l.wa_id === wa_id) ?? null);
      },
      async porToken(token) {
        return clon(t.leads.find((l) => l.agenda_token === token) ?? null);
      },
      async porId(id) {
        return clon(t.leads.find((l) => l.id === id) ?? null);
      },
      async crear(n) {
        if (t.leads.some((l) => l.wa_id === n.wa_id)) throw new Error('wa_id duplicado');
        const row: LeadRow = {
          id: `lead-${++ids}`,
          wa_id: n.wa_id,
          nombre_perfil: n.nombre_perfil,
          estado: n.estado,
          estado_ts: iso(),
          tamano: null,
          giro: null,
          consentimiento: null,
          consentimiento_ts: null,
          baja_ts: null,
          agenda_ts: null,
          agenda_token: n.agenda_token,
          recordatorio_ubic_ts: null,
          ultimo_entrante_ts: null,
          ultimo_aviso_texto_ts: null,
          creado_ts: iso(),
        };
        t.leads.push(row);
        return clon(row);
      },
      async transicionar(id, esperado: Estado, nuevo: Estado) {
        const l = t.leads.find((x) => x.id === id);
        if (!l || l.estado !== esperado) return false;
        if (nuevo !== esperado) l.estado_ts = iso();
        l.estado = nuevo;
        return true;
      },
      async actualizar(id, patch) {
        const l = t.leads.find((x) => x.id === id);
        if (!l) throw new Error('lead inexistente');
        Object.assign(l, patch);
      },
    },
    mensajes: {
      async insertarEntrante(m) {
        if (t.mensajes.some((x) => x.meta_msg_id === m.meta_msg_id)) return { duplicado: true };
        const row: MensajeRow = {
          id: ++ids,
          lead_id: null,
          wa_id: m.wa_id,
          direccion: 'in',
          tipo: m.tipo,
          clave: null,
          meta_msg_id: m.meta_msg_id,
          estatus: null,
          estatus_ts: null,
          error: null,
          cuerpo: m.cuerpo,
          ts: m.ts,
        };
        t.mensajes.push(row);
        return { id: row.id, duplicado: false };
      },
      async vincularLead(mensaje_id, lead_id) {
        const m = t.mensajes.find((x) => x.id === mensaje_id);
        if (m) m.lead_id = lead_id;
      },
      async insertarSaliente(m) {
        if (t.mensajes.some((x) => x.meta_msg_id === m.meta_msg_id)) throw new Error('meta_msg_id duplicado');
        const row: MensajeRow = {
          id: ++ids,
          lead_id: m.lead_id,
          wa_id: m.wa_id,
          direccion: 'out',
          tipo: m.tipo,
          clave: m.clave,
          meta_msg_id: m.meta_msg_id,
          estatus: 'accepted',
          estatus_ts: iso(),
          error: null,
          cuerpo: m.cuerpo,
          ts: iso(),
        };
        t.mensajes.push(row);
        return { id: row.id };
      },
      async actualizarEstatus(meta_msg_id, estatus, estatus_ts, error) {
        const m = t.mensajes.find((x) => x.meta_msg_id === meta_msg_id);
        if (!m) return false;
        m.estatus = estatus;
        m.estatus_ts = estatus_ts;
        m.error = error ?? null;
        return true;
      },
    },
    registros: {
      async siguienteFolio(fechaISO) {
        const n = (t.folios_dia.get(fechaISO) ?? 0) + 1;
        t.folios_dia.set(fechaISO, n);
        return n;
      },
      async crear(r) {
        if (t.registros.some((x) => x.folio === r.folio)) throw new Error('folio duplicado');
        const row: RegistroRow = { ...r, id: ++ids, media_id: null, mensaje_id: null };
        t.registros.push(row);
        return clon(row);
      },
      async ultimoDeLead(lead_id) {
        const propios = t.registros.filter((r) => r.lead_id === lead_id);
        return clon(propios.at(-1) ?? null);
      },
      async actualizarMedia(id, media_id, mensaje_id) {
        const r = t.registros.find((x) => x.id === id);
        if (r) {
          r.media_id = media_id;
          r.mensaje_id = mensaje_id;
        }
      },
    },
    plantillas: {
      async programar(items) {
        for (const it of items) {
          const existente = t.plantillas.find((p) => p.lead_id === it.lead_id && p.plantilla === it.plantilla);
          if (existente) {
            Object.assign(existente, { programado_para: it.programado_para, estado: 'pendiente', motivo: null });
          } else {
            t.plantillas.push({
              id: ++ids,
              lead_id: it.lead_id,
              plantilla: it.plantilla,
              programado_para: it.programado_para,
              estado: 'pendiente',
              enviado_ts: null,
              mensaje_id: null,
              motivo: null,
            });
          }
        }
      },
      async cancelarPendientes(lead_id, motivo) {
        let n = 0;
        for (const p of t.plantillas) {
          if (p.lead_id === lead_id && p.estado === 'pendiente') {
            p.estado = 'cancelada';
            p.motivo = motivo;
            n++;
          }
        }
        return n;
      },
    },
    eventos: {
      async registrar(lead_id, tipo, detalle) {
        t.eventos.push({ id: ++ids, lead_id, tipo, detalle: detalle ?? null, ts: iso() });
      },
    },
  };
  return db;
}
