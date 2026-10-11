// Redacción de los correos (brief §08). Funciones puras: devuelven asunto,
// texto plano y HTML sencillo sin imágenes externas. El único correo que
// incluye texto del lead es el aviso de texto libre.

import type { DatosResumen } from '../cron/resumen';
import type { LeadRow, RegistroRow } from '../db/types';
import { formatoMerida } from '../flow/horario';
import { etiquetaGiro, etiquetaTamano } from '../cron/resumen';

export interface Mensaje {
  asunto: string;
  texto: string;
  html: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const waMe = (wa_id: string) => `https://wa.me/${wa_id}`;
const nombreDe = (l: { nombre_perfil: string | null }) => l.nombre_perfil ?? 'Sin nombre';
const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};
const siNo = (v: boolean | null) => (v === null ? 'sin responder' : v ? 'sí' : 'no');

function envolverHtml(titulo: string, cuerpo: string): string {
  return (
    `<!doctype html><html lang="es-MX"><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;color:#0f3237;font-size:15px;line-height:1.5;margin:0;padding:24px">` +
    `<h1 style="font-size:18px;margin:0 0 16px">${esc(titulo)}</h1>${cuerpo}` +
    `<p style="color:#6b7f7f;font-size:12px;margin-top:28px">Demo de Klokk · correo automático desde avisos.klokk.mx</p></body></html>`
  );
}

function tabla(filas: Array<[string, string]>): { texto: string; html: string } {
  const texto = filas.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html =
    '<table cellpadding="4" style="border-collapse:collapse">' +
    filas.map(([k, v]) => `<tr><td style="color:#6b7f7f;padding-right:12px">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('') +
    '</table>';
  return { texto, html };
}

export function correoCalificado(lead: LeadRow, registro: RegistroRow | null, ahora: Date): Mensaje {
  const nombre = nombreDe(lead);
  const tamano = etiquetaTamano(lead.tamano) ?? 'sin dato';
  const giro = etiquetaGiro(lead.giro) ?? 'sin dato';
  const t = tabla([
    ['Nombre de perfil', nombre],
    ['wa_id', lead.wa_id],
    ['Tamaño', tamano],
    ['Giro', giro],
    ['Hora', formatoMerida(ahora)],
    ['Folio del registro', registro?.folio ?? 'sin registro'],
    ['Baja previa', lead.baja_ts ? `sí (${formatoMerida(new Date(lead.baja_ts))})` : 'no'],
    ['Contactar', waMe(lead.wa_id)],
  ]);
  return {
    asunto: `Lead calificado · ${nombre} · ${tamano} · ${giro}`,
    texto: `Nuevo lead calificado en el demo.\n\n${t.texto}\n`,
    html: envolverHtml('Nuevo lead calificado en el demo', t.html + `<p><a href="${waMe(lead.wa_id)}">Abrir chat en WhatsApp</a></p>`),
  };
}

export function correoAvisoTexto(lead: LeadRow, resumen: string, ahora: Date): Mensaje {
  const nombre = nombreDe(lead);
  const recibido = resumen.startsWith('tipo:') ? `(${resumen.slice(5)}, sin texto)` : resumen;
  const t = tabla([
    ['Nombre de perfil', nombre],
    ['wa_id', lead.wa_id],
    ['Estado', lead.estado],
    ['Hora', formatoMerida(ahora)],
    ['Contactar', waMe(lead.wa_id)],
  ]);
  return {
    asunto: `Mensaje libre en el demo · ${nombre}`,
    texto: `Un lead escribió algo que el demo no puede responder. Alguien del equipo debe contestar en horario hábil.\n\n${t.texto}\n\nMensaje recibido:\n${recibido}\n`,
    html: envolverHtml(
      'Mensaje libre en el demo',
      `<p>Un lead escribió algo que el demo no puede responder. Alguien del equipo debe contestar en horario hábil.</p>${t.html}` +
        `<p style="margin-top:16px;color:#6b7f7f">Mensaje recibido:</p><blockquote style="border-left:3px solid #d9a83f;margin:0;padding:6px 12px">${esc(recibido)}</blockquote>` +
        `<p><a href="${waMe(lead.wa_id)}">Abrir chat en WhatsApp</a></p>`,
    ),
  };
}

export function correoResumen(d: DatosResumen): Mensaje {
  const fecha = fechaCorta(d.fecha);
  const e = d.embudo;
  const p = d.plantillas;
  const s = d.salientes;
  const a = d.acumulado;

  const embudo = tabla([
    ['Números nuevos que escribieron', String(e.numerosNuevos)],
    ['Leads que enviaron Entrada', String(e.entradas)],
    ['Ubicaciones recibidas', String(e.ubicaciones)],
    ['PDFs generados', String(e.pdfs)],
    ['M4 respondidas (tamaño)', String(e.tamanos)],
    ['M5 respondidas (calificados)', String(e.calificados)],
    ['Consentimientos sí / no', `${e.consentimientoSi} / ${e.consentimientoNo}`],
    ['Clics en agenda', String(e.clicsAgenda)],
    ['Bajas', String(e.bajas)],
    ['Textos libres recibidos', String(e.textosLibres)],
  ]);
  const plantillas = tabla([
    ['Enviadas T1 / T2 / T3', `${p.enviadas.T1} / ${p.enviadas.T2} / ${p.enviadas.T3}`],
    ['Entregadas', String(p.entregadas)],
    ['Leídas', String(p.leidas)],
    ['Fallidas', String(p.fallidas)],
    ['Canceladas', String(p.canceladas)],
    ['Pendientes para mañana', String(p.pendientesManana)],
  ]);
  const salientes = tabla([
    ['Mensajes salientes', String(s.total)],
    ['Con estatus failed', String(s.fallidos)],
    ['Código de error más frecuente', s.errorFrecuente ?? 'ninguno'],
  ]);
  const acumulado = tabla([
    ['Leads totales', String(a.leads)],
    ['Calificados totales', String(a.calificados)],
    ['Agendados totales', String(a.agendados)],
    ['Bajas totales', String(a.bajas)],
  ]);

  const lineaCalificado = (c: DatosResumen['calificados'][number]) =>
    `${c.nombre ?? 'Sin nombre'} · ${c.tamano ?? 'sin dato'} · ${c.giro ?? 'sin dato'} · consentimiento: ${siNo(c.consentimiento)} · ` +
    `${c.agendo ? 'agendó' : 'sin agendar'} · folio ${c.folio ?? 'sin registro'} · ${waMe(c.wa_id)}`;
  const lineaPendiente = (h: DatosResumen['pendientesHumano'][number]) =>
    `${h.nombre ?? 'Sin nombre'} · estado ${h.estado} · ${h.textos} mensaje(s) · ${waMe(h.wa_id)}`;

  const calificados = d.calificados.length ? d.calificados.map(lineaCalificado) : ['Ninguno'];
  const pendientes = d.pendientesHumano.length ? d.pendientesHumano.map(lineaPendiente) : ['Ninguno'];
  const sinActividad = e.numerosNuevos + e.entradas + e.textosLibres + s.total === 0;

  const texto =
    `Resumen del demo de Klokk · ${fecha} (últimas 24 h hasta las 19:00 de Mérida)\n` +
    (sinActividad ? '\nSin actividad en el periodo.\n' : '') +
    `\n1. Embudo del día\n${embudo.texto}\n` +
    `\n2. Plantillas\n${plantillas.texto}\n` +
    `\n3. Entrega de mensajes salientes\n${salientes.texto}\n` +
    `\n4. Leads calificados del día\n${calificados.map((l) => `- ${l}`).join('\n')}\n` +
    `\n5. Pendientes de atención humana\n${pendientes.map((l) => `- ${l}`).join('\n')}\n` +
    `\n6. Acumulado histórico\n${acumulado.texto}\n`;

  const seccion = (n: number, titulo: string, cuerpo: string) => `<h2 style="font-size:15px;margin:20px 0 6px">${n}. ${esc(titulo)}</h2>${cuerpo}`;
  const lista = (items: string[]) => `<ul style="margin:0;padding-left:18px">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  const html = envolverHtml(
    `Resumen del demo · ${fecha}`,
    `<p style="color:#6b7f7f;margin:0">Últimas 24 h hasta las 19:00 de Mérida.</p>` +
      (sinActividad ? '<p><strong>Sin actividad en el periodo.</strong></p>' : '') +
      seccion(1, 'Embudo del día', embudo.html) +
      seccion(2, 'Plantillas', plantillas.html) +
      seccion(3, 'Entrega de mensajes salientes', salientes.html) +
      seccion(4, 'Leads calificados del día', lista(calificados)) +
      seccion(5, 'Pendientes de atención humana', lista(pendientes)) +
      seccion(6, 'Acumulado histórico', acumulado.html),
  );

  return { asunto: `Klokk demo · resumen del ${fecha}`, texto, html };
}
