// Implementación de `Db` sobre Supabase Postgres con supabase-js y la llave de
// servicio. RLS está activo sin políticas: solo esta llave entra.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Estado } from '../flow/types';
import type { Db, EventoRow, LeadRow, PlantillaProgramadaRow, RegistroRow } from './types';

const UNICIDAD = '23505';

export function crearSupabase(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'klokk-demo-web-01' } },
  });
}

function fallo(op: string, error: { message: string; code?: string } | null): never {
  throw new Error(`db ${op}: ${error?.code ?? ''} ${error?.message ?? 'error desconocido'}`.trim());
}

export function crearDbSupabase(sb: SupabaseClient): Db {
  return {
    leads: {
      async porWaId(wa_id) {
        const { data, error } = await sb.from('leads').select('*').eq('wa_id', wa_id).maybeSingle();
        if (error) fallo('leads.porWaId', error);
        return (data as LeadRow | null) ?? null;
      },
      async porToken(token) {
        const { data, error } = await sb.from('leads').select('*').eq('agenda_token', token).maybeSingle();
        if (error) fallo('leads.porToken', error);
        return (data as LeadRow | null) ?? null;
      },
      async porId(id) {
        const { data, error } = await sb.from('leads').select('*').eq('id', id).maybeSingle();
        if (error) fallo('leads.porId', error);
        return (data as LeadRow | null) ?? null;
      },
      async crear(n) {
        const { data, error } = await sb.from('leads').insert(n).select('*').single();
        if (error) fallo('leads.crear', error);
        return data as LeadRow;
      },
      async transicionar(id, esperado: Estado, nuevo: Estado) {
        const { data, error } = await sb.rpc('transicionar_lead', { p_id: id, p_esperado: esperado, p_nuevo: nuevo });
        if (error) fallo('leads.transicionar', error);
        return data === true;
      },
      async actualizar(id, patch) {
        const { error } = await sb
          .from('leads')
          .update({ ...patch, actualizado_ts: new Date().toISOString() })
          .eq('id', id);
        if (error) fallo('leads.actualizar', error);
      },
      async porIds(ids) {
        if (ids.length === 0) return [];
        const { data, error } = await sb.from('leads').select('*').in('id', ids);
        if (error) fallo('leads.porIds', error);
        return (data as LeadRow[]) ?? [];
      },
      async enEsperaUbicSinRecordatorio(limiteISO) {
        const { data, error } = await sb
          .from('leads')
          .select('*')
          .eq('estado', 'ESPERA_UBIC')
          .lte('estado_ts', limiteISO)
          .is('recordatorio_ubic_ts', null)
          .limit(200);
        if (error) fallo('leads.enEsperaUbicSinRecordatorio', error);
        return (data as LeadRow[]) ?? [];
      },
      async totales() {
        const contar = async (q: (b: ReturnType<typeof sb.from>) => PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
          const { count, error } = await q(sb.from('leads'));
          if (error) fallo('leads.totales', error);
          return count ?? 0;
        };
        return {
          leads: await contar((b) => b.select('id', { count: 'exact', head: true })),
          calificados: await contar((b) => b.select('id', { count: 'exact', head: true }).not('tamano', 'is', null).not('giro', 'is', null)),
          agendados: await contar((b) => b.select('id', { count: 'exact', head: true }).not('agenda_ts', 'is', null)),
          bajas: await contar((b) => b.select('id', { count: 'exact', head: true }).not('baja_ts', 'is', null)),
        };
      },
    },
    mensajes: {
      async insertarEntrante(m) {
        const { data, error } = await sb
          .from('mensajes')
          .insert({ wa_id: m.wa_id, direccion: 'in', tipo: m.tipo, meta_msg_id: m.meta_msg_id, cuerpo: m.cuerpo, ts: m.ts })
          .select('id')
          .single();
        if (error) {
          if (error.code === UNICIDAD) return { duplicado: true };
          fallo('mensajes.insertarEntrante', error);
        }
        return { id: (data as { id: number }).id, duplicado: false };
      },
      async vincularLead(mensaje_id, lead_id) {
        const { error } = await sb.from('mensajes').update({ lead_id }).eq('id', mensaje_id);
        if (error) fallo('mensajes.vincularLead', error);
      },
      async insertarSaliente(m) {
        const { data, error } = await sb
          .from('mensajes')
          .insert({ ...m, direccion: 'out', estatus: 'accepted', estatus_ts: new Date().toISOString() })
          .select('id')
          .single();
        if (error) fallo('mensajes.insertarSaliente', error);
        return { id: (data as { id: number }).id };
      },
      async actualizarEstatus(meta_msg_id, estatus, estatus_ts, error) {
        const { data, error: e } = await sb
          .from('mensajes')
          .update({ estatus, estatus_ts, error: error ?? null })
          .eq('meta_msg_id', meta_msg_id)
          .select('id');
        if (e) fallo('mensajes.actualizarEstatus', e);
        return (data?.length ?? 0) > 0;
      },
      async salientesEnRango(desdeISO, hastaISO) {
        const { data, error } = await sb
          .from('mensajes')
          .select('lead_id, clave, estatus, error')
          .eq('direccion', 'out')
          .gt('ts', desdeISO)
          .lte('ts', hastaISO)
          .limit(5000);
        if (error) fallo('mensajes.salientesEnRango', error);
        return (data as Array<{ lead_id: string | null; clave: string | null; estatus: string | null; error: unknown }>) ?? [];
      },
    },
    registros: {
      async siguienteFolio(fechaISO) {
        const { data, error } = await sb.rpc('siguiente_folio', { p_fecha: fechaISO });
        if (error) fallo('registros.siguienteFolio', error);
        return Number(data);
      },
      async crear(r) {
        const { data, error } = await sb.from('registros').insert(r).select('*').single();
        if (error) fallo('registros.crear', error);
        return data as RegistroRow;
      },
      async ultimoDeLead(lead_id) {
        const { data, error } = await sb
          .from('registros')
          .select('*')
          .eq('lead_id', lead_id)
          .order('ts', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) fallo('registros.ultimoDeLead', error);
        return (data as RegistroRow | null) ?? null;
      },
      async actualizarMedia(id, media_id, mensaje_id) {
        const { error } = await sb.from('registros').update({ media_id, mensaje_id }).eq('id', id);
        if (error) fallo('registros.actualizarMedia', error);
      },
    },
    plantillas: {
      async programar(items) {
        const { error } = await sb
          .from('plantillas_programadas')
          .upsert(
            items.map((i) => ({ ...i, estado: 'pendiente', motivo: null })),
            { onConflict: 'lead_id,plantilla' },
          );
        if (error) fallo('plantillas.programar', error);
      },
      async cancelarPendientes(lead_id, motivo) {
        const { data, error } = await sb
          .from('plantillas_programadas')
          .update({ estado: 'cancelada', motivo })
          .eq('lead_id', lead_id)
          .eq('estado', 'pendiente')
          .select('id');
        if (error) fallo('plantillas.cancelarPendientes', error);
        return data?.length ?? 0;
      },
      async vencidas(ahoraISO) {
        const { data, error } = await sb
          .from('plantillas_programadas')
          .select('*')
          .eq('estado', 'pendiente')
          .lte('programado_para', ahoraISO)
          .order('programado_para', { ascending: true })
          .limit(200);
        if (error) fallo('plantillas.vencidas', error);
        return (data as PlantillaProgramadaRow[]) ?? [];
      },
      async marcar(id, estado, extra) {
        const { error } = await sb.from('plantillas_programadas').update({ estado, ...extra }).eq('id', id);
        if (error) fallo('plantillas.marcar', error);
      },
      async pendientesHasta(hastaISO) {
        const { count, error } = await sb
          .from('plantillas_programadas')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente')
          .lte('programado_para', hastaISO);
        if (error) fallo('plantillas.pendientesHasta', error);
        return count ?? 0;
      },
    },
    eventos: {
      async registrar(lead_id, tipo, detalle) {
        const { error } = await sb.from('eventos').insert({ lead_id, tipo, detalle: detalle ?? null });
        if (error) fallo('eventos.registrar', error);
      },
      async enRango(desdeISO, hastaISO) {
        const { data, error } = await sb.from('eventos').select('*').gt('ts', desdeISO).lte('ts', hastaISO).limit(10000);
        if (error) fallo('eventos.enRango', error);
        return (data as EventoRow[]) ?? [];
      },
    },
  };
}
