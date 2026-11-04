// A17 recordatorios, A18 seguimiento, A19 resumen, A20 CRON_SECRET.
import { describe, expect, it } from 'vitest';
import { cronAutorizado } from '../src/server/cron/auth';
import { correrRecordatorios } from '../src/server/cron/recordatorios';
import { calcularResumen, correrResumen } from '../src/server/cron/resumen';
import { correrSeguimiento, motivoNoElegible } from '../src/server/cron/seguimiento';
import { desdeMerida } from '../src/server/flow/horario';
import { M1b, PLANTILLAS } from '../src/server/flow/messages';
import { boton, crearEntorno, fila, texto, ubicacion } from './helpers';

const WA_ID = '5219991234567';
const MIN = 60_000;

async function calificadoConConsentimiento(e: ReturnType<typeof crearEntorno>, wa_id = WA_ID) {
  await e.entrante(wa_id, texto('Entrada'));
  await e.entrante(wa_id, ubicacion());
  await e.entrante(wa_id, boton('tam_25_100'));
  await e.entrante(wa_id, fila('giro_comercio'));
  await e.entrante(wa_id, boton('consent_si'));
}

describe('CRON_SECRET (A20)', () => {
  const req = (auth?: string) => new Request('https://klokk.mx/api/cron/x', auth ? { headers: { authorization: auth } } : {});
  it('solo acepta Bearer <CRON_SECRET> exacto', () => {
    expect(cronAutorizado(req('Bearer abc123'), 'abc123')).toBe(true);
    expect(cronAutorizado(req(), 'abc123')).toBe(false);
    expect(cronAutorizado(req('Bearer abc12'), 'abc123')).toBe(false);
    expect(cronAutorizado(req('Bearer abc1234'), 'abc123')).toBe(false);
    expect(cronAutorizado(req('abc123'), 'abc123')).toBe(false);
    expect(cronAutorizado(req('Bearer '), '')).toBe(false);
  });
});

describe('cron de recordatorios (A17)', () => {
  it('manda M1b exactamente una vez a leads con ≥ 10 min en ESPERA_UBIC', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante('5219990000002', texto('Entrada'));

    e.avanzar(9 * MIN);
    expect(await correrRecordatorios(e.deps)).toEqual({ candidatos: 0, enviados: 0, errores: 0 });

    e.avanzar(1 * MIN);
    expect(await correrRecordatorios(e.deps)).toEqual({ candidatos: 2, enviados: 2, errores: 0 });
    const m1b = e.wa.enviadosA(WA_ID).at(-1)!;
    expect(m1b.metodo).toBe('enviarTexto');
    expect((m1b.payload.text as { body: string }).body).toBe(M1b);
    expect(e.db.tablas.leads.every((l) => l.recordatorio_ubic_ts !== null)).toBe(true);
    expect(e.db.tablas.mensajes.filter((m) => m.clave === 'M1b')).toHaveLength(2);

    // Nunca dos veces.
    e.avanzar(60 * MIN);
    expect(await correrRecordatorios(e.deps)).toEqual({ candidatos: 0, enviados: 0, errores: 0 });
    expect(e.db.tablas.mensajes.filter((m) => m.clave === 'M1b')).toHaveLength(2);
  });

  it('no manda M1b a leads en otro estado ni a quien ya compartió ubicación', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, ubicacion());
    await e.entrante('5219990000002', texto('hola'));
    e.avanzar(15 * MIN);
    expect(await correrRecordatorios(e.deps)).toEqual({ candidatos: 0, enviados: 0, errores: 0 });
    expect(e.db.tablas.mensajes.filter((m) => m.clave === 'M1b')).toHaveLength(0);
  });

  it('si el lead vuelve a escribir Entrada después del recordatorio, el temporizador se reinicia', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    e.avanzar(10 * MIN);
    await correrRecordatorios(e.deps);
    await e.entrante(WA_ID, texto('hola'));
    await e.entrante(WA_ID, texto('Baja'));
    await e.entrante(WA_ID, texto('Entrada')); // de BAJA a ESPERA_UBIC: reinicia recordatorio
    expect(e.db.tablas.leads[0]!.recordatorio_ubic_ts).toBeNull();
    e.avanzar(10 * MIN);
    expect((await correrRecordatorios(e.deps)).enviados).toBe(1);
    expect(e.db.tablas.mensajes.filter((m) => m.clave === 'M1b')).toHaveLength(2);
  });

  it('un error de envío no detiene a los demás', async () => {
    const e = crearEntorno();
    await e.entrante('5219990000001', texto('Entrada'));
    await e.entrante('5219990000002', texto('Entrada'));
    e.avanzar(10 * MIN);
    e.wa.fallar.add('enviarTexto');
    const r = await correrRecordatorios(e.deps);
    expect(r).toEqual({ candidatos: 2, enviados: 1, errores: 1 });
  });
});

describe('cron de seguimiento (A18)', () => {
  const jueves14 = desdeMerida(2026, 10, 8, 14, 0); // jueves 8 oct 2026, 14:00 Mérida

  it('fuera de la ventana hábil no envía nada aunque haya vencidas', async () => {
    const e = crearEntorno(jueves14);
    await calificadoConConsentimiento(e);
    e.fijar(desdeMerida(2026, 10, 9, 19, 0)); // viernes 19:00: T1 ya venció (viernes 14:00)
    const r = await correrSeguimiento(e.deps);
    expect(r).toEqual({ enVentana: false, vencidas: 0, enviadas: 0, canceladas: 0, fallidas: 0 });
    e.fijar(desdeMerida(2026, 10, 10, 12, 0)); // sábado
    expect((await correrSeguimiento(e.deps)).enVentana).toBe(false);
    expect(e.db.tablas.plantillas.every((p) => p.estado === 'pendiente')).toBe(true);
  });

  it('en ventana envía solo las vencidas, con nombre y liga de agenda, y las marca enviadas', async () => {
    const e = crearEntorno(jueves14);
    await calificadoConConsentimiento(e);
    const lead = e.db.tablas.leads[0]!;

    e.fijar(desdeMerida(2026, 10, 9, 13, 0)); // viernes 13:00: aún no vence T1
    expect(await correrSeguimiento(e.deps)).toEqual({ enVentana: true, vencidas: 0, enviadas: 0, canceladas: 0, fallidas: 0 });

    e.fijar(desdeMerida(2026, 10, 9, 14, 0)); // viernes 14:00: vence T1
    expect(await correrSeguimiento(e.deps)).toEqual({ enVentana: true, vencidas: 1, enviadas: 1, canceladas: 0, fallidas: 0 });
    const envio = e.wa.enviadosA(WA_ID).at(-1)!;
    expect(envio.metodo).toBe('enviarPlantilla');
    expect(envio.payload.template).toEqual({
      name: 'demo_seguimiento_1',
      language: { code: 'es_MX' },
      parametros: ['Ana', `https://klokk.mx/a/${lead.agenda_token}`],
    });
    const t1 = e.db.tablas.plantillas.find((p) => p.plantilla === 'T1')!;
    expect(t1.estado).toBe('enviada');
    expect(t1.enviado_ts).toBe(e.ahora.toISOString());
    expect(e.db.tablas.mensajes.find((m) => m.id === t1.mensaje_id)!.clave).toBe('T1');

    // Mismo cron una hora después: nada nuevo.
    e.fijar(desdeMerida(2026, 10, 9, 15, 0));
    expect((await correrSeguimiento(e.deps)).enviadas).toBe(0);

    // Lunes 10:00: T2 (domingo 14:00 → lunes 10:00).
    e.fijar(desdeMerida(2026, 10, 12, 10, 0));
    expect((await correrSeguimiento(e.deps)).enviadas).toBe(1);
    expect(e.db.tablas.plantillas.find((p) => p.plantilla === 'T2')!.estado).toBe('enviada');

    // Jueves 15 a las 14:00: T3.
    e.fijar(desdeMerida(2026, 10, 15, 14, 0));
    expect((await correrSeguimiento(e.deps)).enviadas).toBe(1);
    expect(e.db.tablas.plantillas.map((p) => p.estado)).toEqual(['enviada', 'enviada', 'enviada']);
  });

  it('usa NOMBRE_FALLBACK cuando el perfil no tiene nombre', async () => {
    const e = crearEntorno(jueves14);
    await e.entrante(WA_ID, texto('Entrada'), null);
    await e.entrante(WA_ID, ubicacion(), null);
    await e.entrante(WA_ID, boton('tam_25_100'), null);
    await e.entrante(WA_ID, fila('giro_comercio'), null);
    await e.entrante(WA_ID, boton('consent_si'), null);
    e.fijar(desdeMerida(2026, 10, 9, 14, 0));
    await correrSeguimiento(e.deps);
    const envio = e.wa.enviadosA(WA_ID).at(-1)!;
    expect((envio.payload.template as { parametros: string[] }).parametros[0]).toBe('buen día');
  });

  it('cancela en vez de enviar si hubo respuesta, agenda o baja después del consentimiento', async () => {
    const casos: Array<[string, (e: ReturnType<typeof crearEntorno>) => Promise<void>, string]> = [
      ['respuesta', async (e) => void (await e.entrante(WA_ID, texto('gracias'))), 'respuesta'],
      ['baja', async (e) => void (await e.entrante(WA_ID, texto('Baja'))), 'baja'],
    ];
    for (const [nombre, accion, motivo] of casos) {
      const e = crearEntorno(jueves14);
      await calificadoConConsentimiento(e);
      // Simula que la cancelación inmediata no ocurrió (p. ej. carrera): las deja pendientes.
      e.avanzar(MIN);
      await accion(e);
      for (const p of e.db.tablas.plantillas) {
        p.estado = 'pendiente';
        p.motivo = null;
      }
      e.fijar(desdeMerida(2026, 10, 9, 14, 0));
      const r = await correrSeguimiento(e.deps);
      expect(r.enviadas, nombre).toBe(0);
      expect(r.canceladas, nombre).toBe(1);
      expect(e.db.tablas.plantillas.find((p) => p.plantilla === 'T1')!.motivo, nombre).toBe(motivo);
      expect(e.wa.enviadosA(WA_ID).some((l) => l.metodo === 'enviarPlantilla'), nombre).toBe(false);
    }
  });

  it('motivoNoElegible cubre las cuatro guardas de §06.5', () => {
    const base = { consentimiento: true, consentimiento_ts: '2026-10-08T20:00:00.000Z', baja_ts: null, agenda_ts: null, ultimo_entrante_ts: '2026-10-08T20:00:00.000Z' };
    expect(motivoNoElegible(base)).toBeNull();
    expect(motivoNoElegible({ ...base, consentimiento: false })).toBe('sin consentimiento');
    expect(motivoNoElegible({ ...base, consentimiento: null })).toBe('sin consentimiento');
    expect(motivoNoElegible({ ...base, baja_ts: 'x' })).toBe('baja');
    expect(motivoNoElegible({ ...base, agenda_ts: 'x' })).toBe('agenda');
    expect(motivoNoElegible({ ...base, ultimo_entrante_ts: '2026-10-08T20:00:00.001Z' })).toBe('respuesta');
  });

  it('una plantilla rechazada por Meta queda fallida y no se reintenta', async () => {
    const e = crearEntorno(jueves14);
    await calificadoConConsentimiento(e);
    e.fijar(desdeMerida(2026, 10, 9, 14, 0));
    e.wa.fallar.add('enviarPlantilla');
    expect(await correrSeguimiento(e.deps)).toEqual({ enVentana: true, vencidas: 1, enviadas: 0, canceladas: 0, fallidas: 1 });
    expect(e.db.tablas.plantillas.find((p) => p.plantilla === 'T1')!.estado).toBe('fallida');
    e.fijar(desdeMerida(2026, 10, 9, 15, 0));
    expect((await correrSeguimiento(e.deps)).vencidas).toBe(0);
  });

  it('las tres plantillas registradas existen en messages.ts con sus nombres de Meta', () => {
    expect(PLANTILLAS.map((p) => p.nombre)).toEqual(['demo_seguimiento_1', 'demo_seguimiento_3', 'demo_seguimiento_7']);
  });
});

describe('cron de resumen (A19)', () => {
  it('sin actividad produce un resumen en ceros y lo envía igual', async () => {
    const e = crearEntorno();
    const datos = await correrResumen(e.deps);
    expect(datos.embudo).toEqual({
      numerosNuevos: 0,
      entradas: 0,
      ubicaciones: 0,
      pdfs: 0,
      tamanos: 0,
      calificados: 0,
      consentimientoSi: 0,
      consentimientoNo: 0,
      clicsAgenda: 0,
      bajas: 0,
      textosLibres: 0,
    });
    expect(datos.calificados).toEqual([]);
    expect(datos.acumulado).toEqual({ leads: 0, calificados: 0, agendados: 0, bajas: 0 });
    expect(e.correo.enviados.map((c) => c.tipo)).toEqual(['resumen']);
    expect(e.db.tablas.eventos.some((ev) => ev.tipo === 'CORREO_RESUMEN')).toBe(true);
  });

  it('cuenta el embudo, plantillas, entregas y lista los calificados del día', async () => {
    const e = crearEntorno(desdeMerida(2026, 10, 8, 14, 0));
    await calificadoConConsentimiento(e, '5219990000001');
    await e.entrante('5219990000002', texto('Entrada'));
    await e.entrante('5219990000002', ubicacion());
    await e.entrante('5219990000002', boton('tam_menos_25'));
    await e.entrante('5219990000002', fila('giro_inmobiliaria'));
    await e.entrante('5219990000002', boton('consent_no'));
    await e.entrante('5219990000003', texto('¿cuánto cuesta?'));
    await e.entrante('5219990000003', texto('hola?'));
    await e.entrante('5219990000004', texto('Entrada'));
    await e.entrante('5219990000004', texto('Baja'));

    // Estatus de un saliente fallido.
    const saliente = e.db.tablas.mensajes.find((m) => m.direccion === 'out')!;
    await e.estatus(saliente.meta_msg_id!, 'failed', [{ code: 131026 }]);

    // Corte del jueves a las 19:00: todo el embudo del día.
    const jueves = await calcularResumen(e.deps, desdeMerida(2026, 10, 8, 19, 0));
    expect(jueves.embudo).toEqual({
      numerosNuevos: 4,
      entradas: 3,
      ubicaciones: 2,
      pdfs: 2,
      tamanos: 2,
      calificados: 2,
      consentimientoSi: 1,
      consentimientoNo: 1,
      clicsAgenda: 0,
      bajas: 1,
      textosLibres: 2,
    });
    expect(jueves.calificados).toEqual([
      { nombre: 'Ana', wa_id: '5219990000001', tamano: 'De 25 a 100', giro: 'Comercio', consentimiento: true, agendo: false, folio: 'DEMO-20261008-0001' },
      { nombre: 'Ana', wa_id: '5219990000002', tamano: 'Menos de 25', giro: 'Inmobiliaria o desarrollo', consentimiento: false, agendo: false, folio: 'DEMO-20261008-0002' },
    ]);
    expect(jueves.pendientesHumano).toEqual([{ nombre: 'Ana', wa_id: '5219990000003', estado: 'NUEVO', textos: 2 }]);
    expect(jueves.salientes.fallidos).toBe(1);
    expect(jueves.salientes.errorFrecuente).toBe('131026');
    expect(jueves.plantillas.pendientesManana).toBe(1); // T1 del viernes 14:00
    expect(jueves.acumulado).toEqual({ leads: 4, calificados: 2, agendados: 0, bajas: 1 });

    // T1 del lead 1 se envía el viernes y se marca entregada.
    e.fijar(desdeMerida(2026, 10, 9, 14, 0));
    await correrSeguimiento(e.deps);
    const t1 = e.db.tablas.plantillas.find((p) => p.plantilla === 'T1')!;
    await e.estatus(e.db.tablas.mensajes.find((m) => m.id === t1.mensaje_id)!.meta_msg_id!, 'read');

    e.fijar(desdeMerida(2026, 10, 9, 19, 0)); // corte de las 19:00
    const datos = await calcularResumen(e.deps);
    expect(datos.fecha).toBe('2026-10-09');
    // Las últimas 24 h: desde el jueves 19:00. Todo lo de arriba ocurrió el jueves 14:00 salvo T1.
    expect(datos.embudo.entradas).toBe(0);
    expect(datos.plantillas.enviadas).toEqual({ T1: 1, T2: 0, T3: 0 });
    expect(datos.plantillas.entregadas).toBe(1);
    expect(datos.plantillas.leidas).toBe(1);
    expect(datos.plantillas.pendientesManana).toBe(0); // T2 es el lunes

  });
});
