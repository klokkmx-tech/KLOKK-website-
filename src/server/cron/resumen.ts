// Cron diario a la 01:00 UTC = 19:00 en Mérida (brief §08). Calcula las métricas
// de las últimas 24 horas y las entrega al módulo de correo. Se envía aunque no
// haya actividad.

import type { Deps } from '../flow/executor';
import { fechaMeridaISO } from '../flow/horario';
import { M4_BOTONES, M5_FILAS } from '../flow/messages';

export interface DatosResumen {
  desde: string;
  hasta: string;
  /** AAAA-MM-DD en Mérida del corte. */
  fecha: string;
  embudo: {
    numerosNuevos: number;
    entradas: number;
    ubicaciones: number;
    pdfs: number;
    tamanos: number;
    calificados: number;
    consentimientoSi: number;
    consentimientoNo: number;
    clicsAgenda: number;
    bajas: number;
    textosLibres: number;
  };
  plantillas: {
    enviadas: { T1: number; T2: number; T3: number };
    entregadas: number;
    leidas: number;
    fallidas: number;
    canceladas: number;
    pendientesManana: number;
  };
  salientes: {
    total: number;
    fallidos: number;
    errorFrecuente: string | null;
  };
  calificados: Array<{
    nombre: string | null;
    wa_id: string;
    tamano: string | null;
    giro: string | null;
    consentimiento: boolean | null;
    agendo: boolean;
    folio: string | null;
  }>;
  pendientesHumano: Array<{ nombre: string | null; wa_id: string; estado: string; textos: number }>;
  acumulado: { leads: number; calificados: number; agendados: number; bajas: number };
}

export const etiquetaTamano = (id: string | null): string | null => M4_BOTONES.find((b) => b.id === id)?.titulo ?? id;
export const etiquetaGiro = (id: string | null): string | null => {
  const f = M5_FILAS.find((x) => x.id === id);
  return f ? (f.descripcion ? `${f.titulo} ${f.descripcion}` : f.titulo) : id;
};

export async function calcularResumen(deps: Deps, hasta: Date = deps.ahora()): Promise<DatosResumen> {
  const { db } = deps;
  const desde = new Date(hasta.getTime() - 24 * 3_600_000);
  const desdeISO = desde.toISOString();
  const hastaISO = hasta.toISOString();

  const eventos = await db.eventos.enRango(desdeISO, hastaISO);
  const contar = (tipo: string) => eventos.filter((e) => e.tipo === tipo).length;
  const leadsDe = (tipo: string) => [...new Set(eventos.filter((e) => e.tipo === tipo && e.lead_id).map((e) => e.lead_id!))];

  const enviadas = { T1: 0, T2: 0, T3: 0 };
  for (const e of eventos) {
    if (e.tipo !== 'PLANTILLA_ENVIADA') continue;
    const p = (e.detalle as { plantilla?: keyof typeof enviadas } | null)?.plantilla;
    if (p && p in enviadas) enviadas[p]++;
  }
  const canceladas = eventos
    .filter((e) => e.tipo === 'PLANTILLAS_CANCELADAS' || e.tipo === 'PLANTILLA_CANCELADA')
    .reduce((n, e) => n + ((e.detalle as { n?: number } | null)?.n ?? 1), 0);

  const salientes = await db.mensajes.salientesEnRango(desdeISO, hastaISO);
  const dePlantilla = salientes.filter((m) => m.clave?.startsWith('T'));
  const errores = new Map<string, number>();
  for (const m of salientes) {
    if (m.estatus !== 'failed') continue;
    const code = Array.isArray(m.error) ? (m.error[0] as { code?: number } | undefined)?.code : undefined;
    const clave = code !== undefined ? String(code) : 'desconocido';
    errores.set(clave, (errores.get(clave) ?? 0) + 1);
  }
  const errorFrecuente = [...errores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const idsCalificados = leadsDe('CALIFICADO');
  const idsTexto = leadsDe('TEXTO_LIBRE');
  const leads = new Map((await db.leads.porIds([...new Set([...idsCalificados, ...idsTexto])])).map((l) => [l.id, l]));

  const calificados: DatosResumen['calificados'] = [];
  for (const id of idsCalificados) {
    const l = leads.get(id);
    if (!l) continue;
    const reg = await db.registros.ultimoDeLead(id);
    calificados.push({
      nombre: l.nombre_perfil,
      wa_id: l.wa_id,
      tamano: etiquetaTamano(l.tamano),
      giro: etiquetaGiro(l.giro),
      consentimiento: l.consentimiento,
      agendo: l.agenda_ts !== null,
      folio: reg?.folio ?? null,
    });
  }

  const pendientesHumano: DatosResumen['pendientesHumano'] = idsTexto.flatMap((id) => {
    const l = leads.get(id);
    return l
      ? [{ nombre: l.nombre_perfil, wa_id: l.wa_id, estado: l.estado, textos: eventos.filter((e) => e.tipo === 'TEXTO_LIBRE' && e.lead_id === id).length }]
      : [];
  });

  return {
    desde: desdeISO,
    hasta: hastaISO,
    fecha: fechaMeridaISO(hasta),
    embudo: {
      numerosNuevos: contar('LEAD_NUEVO'),
      entradas: contar('ENTRADA'),
      ubicaciones: contar('REGISTRO'),
      pdfs: contar('PDF'),
      tamanos: contar('BOTON_TAMANO'),
      calificados: contar('CALIFICADO'),
      consentimientoSi: contar('CONSENT_SI'),
      consentimientoNo: contar('CONSENT_NO'),
      clicsAgenda: contar('CLIC_AGENDA'),
      bajas: contar('BAJA'),
      textosLibres: contar('TEXTO_LIBRE'),
    },
    plantillas: {
      enviadas,
      entregadas: dePlantilla.filter((m) => m.estatus === 'delivered' || m.estatus === 'read').length,
      leidas: dePlantilla.filter((m) => m.estatus === 'read').length,
      fallidas: contar('PLANTILLA_FALLIDA'),
      canceladas,
      pendientesManana: await db.plantillas.pendientesHasta(new Date(hasta.getTime() + 24 * 3_600_000).toISOString()),
    },
    salientes: {
      total: salientes.length,
      fallidos: salientes.filter((m) => m.estatus === 'failed').length,
      errorFrecuente,
    },
    calificados,
    pendientesHumano,
    acumulado: await db.leads.totales(),
  };
}

export async function correrResumen(deps: Deps): Promise<DatosResumen> {
  const datos = await calcularResumen(deps);
  await deps.correo.resumen(datos);
  await deps.db.eventos.registrar(null, 'CORREO_RESUMEN', { fecha: datos.fecha });
  return datos;
}
