// Ejecuta las acciones que devuelve `transition` (brief §04) con I/O real a
// través de dependencias inyectadas. Orden de operación:
//   1. CREAR_LEAD si aplica.
//   2. Reclamar la transición de estado de forma atómica. Si otro proceso ganó
//      la carrera, se descarta todo sin enviar mensajes.
//   3. Ejecutar las acciones en el orden recibido.

import { randomBytes } from 'node:crypto';
import type { Correo } from '../correo/types';
import type { Db, LeadRow, RegistroRow } from '../db/types';
import type { GeneradorPdf } from '../pdf/comprobante';
import { coordenada, formatearFolio, hashRegistro } from '../pdf/hash';
import type { WaClient } from '../wa/client';
import { fechaMeridaCompacta, fechaMeridaISO, formatoMerida, programarPlantillas } from './horario';
import {
  AGENDA_LINK,
  M1,
  M1b,
  M2,
  M3_NOMBRE_ARCHIVO,
  M4,
  M4_BOTONES,
  M5,
  M5_BOTON,
  M5_FILAS,
  M6,
  M6_BOTON,
  M7,
  M7_BOTONES,
  M8,
  M9,
  m3Caption,
} from './messages';
import type { Accion, ClaveMensaje, Evento, Resultado } from './types';

export interface Deps {
  db: Db;
  wa: WaClient;
  pdf: GeneradorPdf;
  correo: Correo;
  ahora: () => Date;
  log: (mensaje: string, detalle?: Record<string, unknown>) => void;
}

export interface Entrada {
  /** null = número desconocido. */
  lead: LeadRow | null;
  wa_id: string;
  nombre_perfil: string | null;
  evento: Evento;
  resultado: Resultado;
  /** Id del mensaje entrante ya guardado, para vincularlo al lead nuevo. */
  mensaje_id?: number;
}

export interface Salida {
  lead: LeadRow | null;
  /** false si otro proceso ganó la transición y no se hizo nada. */
  aplicado: boolean;
  registro: RegistroRow | null;
}

export const nuevoToken = (): string => randomBytes(24).toString('base64url');

export async function ejecutar(entrada: Entrada, deps: Deps): Promise<Salida> {
  const { db, wa, correo, log } = deps;
  const ahora = deps.ahora();
  const iso = ahora.toISOString();
  const { evento, resultado } = entrada;
  let lead = entrada.lead;
  let registro: RegistroRow | null = null;

  const acciones = [...resultado.acciones];

  // 1. Crear lead.
  if (acciones[0]?.tipo === 'CREAR_LEAD') {
    acciones.shift();
    lead = await db.leads.crear({
      wa_id: entrada.wa_id,
      nombre_perfil: entrada.nombre_perfil,
      estado: resultado.estado,
      agenda_token: nuevoToken(),
    });
    if (entrada.mensaje_id !== undefined) await db.mensajes.vincularLead(entrada.mensaje_id, lead.id);
    await db.eventos.registrar(lead.id, 'LEAD_NUEVO');
  } else if (lead) {
    if (entrada.mensaje_id !== undefined) await db.mensajes.vincularLead(entrada.mensaje_id, lead.id);
    // 2. Transición atómica.
    if (resultado.estado !== lead.estado) {
      const ok = await db.leads.transicionar(lead.id, lead.estado, resultado.estado);
      if (!ok) {
        log('transición perdida', { lead: lead.id, de: lead.estado, a: resultado.estado, evento: evento.tipo });
        return { lead, aplicado: false, registro: null };
      }
      lead = { ...lead, estado: resultado.estado, estado_ts: iso };
    }
  }

  if (!lead) return { lead: null, aplicado: acciones.length === 0, registro: null };

  if (entrada.nombre_perfil && entrada.nombre_perfil !== lead.nombre_perfil) {
    await db.leads.actualizar(lead.id, { nombre_perfil: entrada.nombre_perfil });
    lead = { ...lead, nombre_perfil: entrada.nombre_perfil };
  }

  await db.eventos.registrar(lead.id, evento.tipo, 'resumen' in evento ? { resumen: evento.resumen.slice(0, 200) } : undefined);

  // 3. Acciones en orden.
  for (const accion of acciones) {
    switch (accion.tipo) {
      case 'CREAR_LEAD':
        throw new Error('CREAR_LEAD solo puede ir primero');

      case 'ENVIAR':
        await enviar(accion.clave);
        break;

      case 'CREAR_REGISTRO': {
        const lat = coordenada(accion.lat);
        const lon = coordenada(accion.lon);
        const n = await db.registros.siguienteFolio(fechaMeridaISO(ahora));
        const folio = formatearFolio(fechaMeridaCompacta(ahora), n);
        const datos = { folio, evento: 'Entrada', ts: iso, lat, lon };
        registro = await db.registros.crear({ lead_id: lead.id, ...datos, hash_sha256: hashRegistro(datos) });
        await db.eventos.registrar(lead.id, 'REGISTRO', { folio });
        break;
      }

      case 'GENERAR_PDF': {
        const reg: RegistroRow | null = registro;
        if (!reg) throw new Error('GENERAR_PDF sin registro');
        const bytes = await deps.pdf({
          folio: reg.folio,
          evento: reg.evento,
          ts: reg.ts,
          lat: reg.lat,
          lon: reg.lon,
          hash: reg.hash_sha256,
          wa_id: lead.wa_id,
        });
        const { media_id } = await wa.subirMedia(bytes, 'application/pdf', M3_NOMBRE_ARCHIVO(reg.folio));
        const conMedia: RegistroRow = { ...reg, media_id };
        registro = conMedia;
        await db.registros.actualizarMedia(reg.id, media_id, null);
        await db.eventos.registrar(lead.id, 'PDF', { folio: reg.folio });
        break;
      }

      case 'GUARDAR_TAMANO':
        await db.leads.actualizar(lead.id, { tamano: accion.id });
        lead = { ...lead, tamano: accion.id };
        break;

      case 'GUARDAR_GIRO':
        await db.leads.actualizar(lead.id, { giro: accion.id });
        lead = { ...lead, giro: accion.id };
        await db.eventos.registrar(lead.id, 'CALIFICADO', { tamano: lead.tamano, giro: accion.id });
        break;

      case 'GUARDAR_CONSENT':
        await db.leads.actualizar(lead.id, { consentimiento: accion.valor, consentimiento_ts: iso });
        lead = { ...lead, consentimiento: accion.valor, consentimiento_ts: iso };
        await db.eventos.registrar(lead.id, accion.valor ? 'CONSENT_SI' : 'CONSENT_NO');
        break;

      case 'GUARDAR_BAJA':
        await db.leads.actualizar(lead.id, { baja_ts: iso, consentimiento: false });
        lead = { ...lead, baja_ts: iso, consentimiento: false };
        break;

      case 'GUARDAR_AGENDA':
        await db.leads.actualizar(lead.id, { agenda_ts: iso });
        lead = { ...lead, agenda_ts: iso };
        break;

      case 'MARCAR_RECORDATORIO':
        await db.leads.actualizar(lead.id, { recordatorio_ubic_ts: iso });
        lead = { ...lead, recordatorio_ubic_ts: iso };
        await db.eventos.registrar(lead.id, 'RECORDATORIO');
        break;

      case 'REINICIAR_RECORDATORIO':
        await db.leads.actualizar(lead.id, { recordatorio_ubic_ts: null });
        lead = { ...lead, recordatorio_ubic_ts: null };
        break;

      case 'PROGRAMAR_PLANTILLAS': {
        const items = programarPlantillas(ahora).map((p) => ({
          lead_id: lead!.id,
          plantilla: p.plantilla,
          programado_para: p.programado_para.toISOString(),
        }));
        await db.plantillas.programar(items);
        await db.eventos.registrar(lead.id, 'PLANTILLAS_PROGRAMADAS', { fechas: items.map((i) => i.programado_para) });
        break;
      }

      case 'CANCELAR_PLANTILLAS': {
        const n = await db.plantillas.cancelarPendientes(lead.id, accion.motivo);
        if (n > 0) await db.eventos.registrar(lead.id, 'PLANTILLAS_CANCELADAS', { n, motivo: accion.motivo });
        break;
      }

      case 'CORREO_CALIFICADO':
        await correo.calificado(lead, registro ?? (await db.registros.ultimoDeLead(lead.id)));
        await db.eventos.registrar(lead.id, 'CORREO_CALIFICADO');
        break;

      case 'CORREO_AVISO_TEXTO':
        await correo.avisoTexto(lead, 'resumen' in evento ? evento.resumen : evento.tipo);
        await db.leads.actualizar(lead.id, { ultimo_aviso_texto_ts: iso });
        lead = { ...lead, ultimo_aviso_texto_ts: iso };
        await db.eventos.registrar(lead.id, 'CORREO_AVISO');
        break;

      case 'REDIRIGIR':
        // Lo resuelve el endpoint /a/[token].
        break;
    }
  }

  return { lead, aplicado: true, registro };

  async function enviar(clave: ClaveMensaje): Promise<void> {
    const to = lead!.wa_id; // regla 9: siempre el wa_id tal como llegó
    let envio;
    let tipo: string;
    switch (clave) {
      case 'M1':
        tipo = 'interactive';
        envio = await wa.enviarSolicitudUbicacion(to, M1);
        break;
      case 'M1b':
        tipo = 'text';
        envio = await wa.enviarTexto(to, M1b);
        break;
      case 'M2':
        tipo = 'text';
        envio = await wa.enviarTexto(to, M2);
        break;
      case 'M3': {
        if (!registro?.media_id) throw new Error('M3 sin PDF subido');
        tipo = 'document';
        const caption = m3Caption({
          folio: registro.folio,
          fecha_hora_merida: formatoMerida(new Date(registro.ts)),
          hash: registro.hash_sha256,
        });
        envio = await wa.enviarDocumento(to, registro.media_id, M3_NOMBRE_ARCHIVO(registro.folio), caption);
        break;
      }
      case 'M4':
        tipo = 'interactive';
        envio = await wa.enviarBotones(to, M4, M4_BOTONES);
        break;
      case 'M5':
        tipo = 'interactive';
        envio = await wa.enviarLista(to, M5, M5_BOTON, M5_FILAS);
        break;
      case 'M6':
        tipo = 'interactive';
        envio = await wa.enviarCtaUrl(to, M6, M6_BOTON, AGENDA_LINK(lead!.agenda_token));
        break;
      case 'M7':
        tipo = 'interactive';
        envio = await wa.enviarBotones(to, M7, M7_BOTONES);
        break;
      case 'M8':
        tipo = 'text';
        envio = await wa.enviarTexto(to, M8);
        break;
      case 'M9':
        tipo = 'text';
        envio = await wa.enviarTexto(to, M9);
        break;
    }
    const { id } = await db.mensajes.insertarSaliente({
      lead_id: lead!.id,
      wa_id: to,
      tipo,
      clave,
      meta_msg_id: envio.meta_msg_id,
      cuerpo: envio.payload,
    });
    if (clave === 'M3' && registro) {
      await db.registros.actualizarMedia(registro.id, registro.media_id!, id);
      registro = { ...registro, mensaje_id: id };
    }
  }
}

/** Utilidad para pruebas y crons: acciones de solo envío. */
export const soloEnvios = (acciones: Accion[]): ClaveMensaje[] =>
  acciones.flatMap((a) => (a.tipo === 'ENVIAR' ? [a.clave] : []));
