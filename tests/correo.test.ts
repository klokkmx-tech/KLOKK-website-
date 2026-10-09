// A22 remitente en avisos.klokk.mx, redacción de los tres correos y envío por Resend sin red.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calcularResumen } from '../src/server/cron/resumen';
import type { LeadRow } from '../src/server/db/types';
import { correoAvisoTexto, correoCalificado, correoResumen } from '../src/server/correo/redaccion';
import { CorreoError, crearCorreoResend, direccionDe, validarDestinatarios, validarRemitente } from '../src/server/correo/resend';
import { desdeMerida } from '../src/server/flow/horario';
import { boton, crearEntorno, fila, texto, ubicacion } from './helpers';

const AHORA = new Date('2026-10-08T20:03:21.000Z');
const lead: LeadRow = {
  id: 'lead-1',
  wa_id: '5219991234567',
  nombre_perfil: 'Ana <López>',
  estado: 'CALIFICADO',
  estado_ts: AHORA.toISOString(),
  tamano: 'tam_25_100',
  giro: 'giro_inmobiliaria',
  consentimiento: null,
  consentimiento_ts: null,
  baja_ts: null,
  agenda_ts: null,
  agenda_token: 'tok',
  recordatorio_ubic_ts: null,
  ultimo_entrante_ts: null,
  ultimo_aviso_texto_ts: null,
  creado_ts: AHORA.toISOString(),
};

function fetchFalso(status = 200) {
  const llamadas: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
  const fn: typeof fetch = async (url, init) => {
    llamadas.push({ url: String(url), init: init!, body: JSON.parse(String(init!.body)) });
    return new Response(status === 200 ? '{"id":"re_123"}' : '{"message":"Invalid from"}', { status });
  };
  return { fn, llamadas };
}

describe('remitente y destinatarios (A22)', () => {
  it('acepta solo remitentes en avisos.klokk.mx', () => {
    expect(validarRemitente('Klokk demo <demo@avisos.klokk.mx>')).toBe('Klokk demo <demo@avisos.klokk.mx>');
    expect(validarRemitente('demo@avisos.klokk.mx')).toBe('demo@avisos.klokk.mx');
    expect(validarRemitente('Demo <demo@AVISOS.KLOKK.MX>')).toBeTruthy();
    for (const malo of ['demo@klokk.mx', 'Klokk <hola@klokk.mx>', 'demo@avisos.klokk.mx.evil.com', 'x@sub.avisos.klokk.mx', '', 'sin arroba']) {
      expect(() => validarRemitente(malo), malo).toThrow();
    }
    expect(direccionDe('Nombre Largo <a@b.co>')).toBe('a@b.co');
  });

  it('destinatarios separados por coma, al menos uno, todos válidos', () => {
    expect(validarDestinatarios('ventas@klokk.mx, jp@klokk.mx')).toEqual(['ventas@klokk.mx', 'jp@klokk.mx']);
    expect(validarDestinatarios('solo@klokk.mx')).toEqual(['solo@klokk.mx']);
    expect(() => validarDestinatarios('')).toThrow();
    expect(() => validarDestinatarios('ventas@klokk.mx, nada')).toThrow();
  });

  it('el cliente no se construye con un remitente fuera del subdominio', () => {
    expect(() => crearCorreoResend({ apiKey: 'k', remitente: 'demo@klokk.mx', destinatarios: 'a@klokk.mx' })).toThrow(/avisos\.klokk\.mx/);
  });
});

describe('redacción', () => {
  it('lead calificado: asunto de §08 y datos para contactar', () => {
    const m = correoCalificado(lead, { id: 1, lead_id: 'lead-1', folio: 'DEMO-20261008-0003', evento: 'Entrada', ts: AHORA.toISOString(), lat: '1', lon: '2', hash_sha256: 'h', media_id: null, mensaje_id: null }, AHORA);
    expect(m.asunto).toBe('Lead calificado · Ana <López> · De 25 a 100 · Inmobiliaria o desarrollo');
    expect(m.texto).toContain('wa_id: 5219991234567');
    expect(m.texto).toContain('Folio del registro: DEMO-20261008-0003');
    expect(m.texto).toContain('Hora: 08/10/2026 14:03:21 (hora de Mérida)');
    expect(m.texto).toContain('Baja previa: no');
    expect(m.texto).toContain('https://wa.me/5219991234567');
    expect(m.html).toContain('Ana &lt;López&gt;'); // escapado
    expect(m.html).not.toContain('<López>');
    expect(m.html).not.toMatch(/<img/);
  });

  it('aviso de texto libre: es el único que incluye el texto del lead', () => {
    const m = correoAvisoTexto({ ...lead, estado: 'ESPERA_UBIC' }, '¿Esto me sirve para la STPS? <script>', AHORA);
    expect(m.asunto).toBe('Mensaje libre en el demo · Ana <López>');
    expect(m.texto).toContain('¿Esto me sirve para la STPS? <script>');
    expect(m.texto).toContain('Estado: ESPERA_UBIC');
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.html).not.toContain('<script>');
    const audio = correoAvisoTexto(lead, 'tipo:audio', AHORA);
    expect(audio.texto).toContain('(audio, sin texto)');
  });

  it('resumen diario: asunto con fecha de Mérida y las seis secciones en orden', async () => {
    const e = crearEntorno(desdeMerida(2026, 10, 8, 14, 0));
    await e.entrante('5219990000001', texto('Entrada'));
    await e.entrante('5219990000001', ubicacion());
    await e.entrante('5219990000001', boton('tam_mas_100'));
    await e.entrante('5219990000001', fila('giro_construccion'));
    await e.entrante('5219990000002', texto('hola, ¿precio?'));
    const datos = await calcularResumen(e.deps, desdeMerida(2026, 10, 8, 19, 0));
    const m = correoResumen(datos);
    expect(m.asunto).toBe('Klokk demo · resumen del 08/10/2026');
    const orden = ['1. Embudo del día', '2. Plantillas', '3. Entrega de mensajes salientes', '4. Leads calificados del día', '5. Pendientes de atención humana', '6. Acumulado histórico'];
    let pos = -1;
    for (const titulo of orden) {
      const i = m.texto.indexOf(titulo);
      expect(i, titulo).toBeGreaterThan(pos);
      pos = i;
    }
    expect(m.texto).toContain('Leads que enviaron Entrada: 1');
    expect(m.texto).toContain('M5 respondidas (calificados): 1');
    expect(m.texto).toContain('Ana · Más de 100 · Construcción · consentimiento: sin responder · sin agendar · folio DEMO-20261008-0001 · https://wa.me/5219990000001');
    expect(m.texto).toContain('Ana · estado NUEVO · 1 mensaje(s) · https://wa.me/5219990000002');
    // Nunca el contenido de los textos libres.
    expect(m.texto).not.toContain('precio');
    expect(m.html).not.toContain('precio');
    expect(m.texto).toContain('Leads totales: 2');

    if (process.env.CORREO_EJEMPLO_SALIDA) {
      mkdirSync(dirname(process.env.CORREO_EJEMPLO_SALIDA), { recursive: true });
      writeFileSync(process.env.CORREO_EJEMPLO_SALIDA, m.html);
    }
  });

  it('resumen sin actividad lo dice explícitamente', async () => {
    const e = crearEntorno();
    const m = correoResumen(await calcularResumen(e.deps));
    expect(m.texto).toContain('Sin actividad en el periodo.');
    expect(m.texto).toContain('4. Leads calificados del día\n- Ninguno');
  });
});

describe('envío por Resend (sin red)', () => {
  it('manda POST /emails con from, to, subject, text y html', async () => {
    const f = fetchFalso();
    const correo = crearCorreoResend({
      apiKey: 'llave-de-prueba',
      remitente: 'Klokk demo <demo@avisos.klokk.mx>',
      destinatarios: 'ventas@klokk.mx, jp@klokk.mx',
      fetchFn: f.fn,
      ahora: () => AHORA,
    });
    await correo.avisoTexto(lead, 'hola');
    expect(f.llamadas).toHaveLength(1);
    const { url, init, body } = f.llamadas[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer llave-de-prueba');
    expect(body.from).toBe('Klokk demo <demo@avisos.klokk.mx>');
    expect(body.to).toEqual(['ventas@klokk.mx', 'jp@klokk.mx']);
    expect(body.subject).toBe('Mensaje libre en el demo · Ana <López>');
    expect(typeof body.text).toBe('string');
    expect(typeof body.html).toBe('string');
  });

  it('una respuesta no 2xx lanza CorreoError con el estatus', async () => {
    const f = fetchFalso(422);
    const correo = crearCorreoResend({ apiKey: 'k', remitente: 'demo@avisos.klokk.mx', destinatarios: 'a@klokk.mx', fetchFn: f.fn });
    await expect(correo.calificado(lead, null)).rejects.toBeInstanceOf(CorreoError);
  });
});

describe('el correo nunca bloquea el demo', () => {
  it('si Resend falla, M6 y M7 salen igual y queda un evento CORREO_ERROR', async () => {
    const e = crearEntorno();
    e.deps.correo = {
      calificado: async () => {
        throw new CorreoError(500, null);
      },
      avisoTexto: async () => {
        throw new CorreoError(500, null);
      },
      resumen: async () => {},
    };
    await e.entrante('5219990000001', texto('Entrada'));
    await e.entrante('5219990000001', ubicacion());
    await e.entrante('5219990000001', boton('tam_25_100'));
    await e.entrante('5219990000001', fila('giro_comercio'));
    const claves = e.db.tablas.mensajes.filter((m) => m.direccion === 'out').map((m) => m.clave);
    expect(claves).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
    expect(e.db.tablas.eventos.filter((ev) => ev.tipo === 'CORREO_ERROR')).toHaveLength(1);
    expect(e.logs.some((l) => l.mensaje === 'correo: error')).toBe(true);

    // Texto libre: M9 sale y el límite de una hora se respeta aunque el correo falle.
    await e.entrante('5219990000001', texto('hola'));
    expect(e.db.tablas.mensajes.at(-1)!.clave).toBe('M9');
    expect(e.db.tablas.leads[0]!.ultimo_aviso_texto_ts).not.toBeNull();
  });
});
