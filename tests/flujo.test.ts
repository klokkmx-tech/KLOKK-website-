// Flujo completo M1–M9 de punta a punta con la base en memoria y el cliente
// falso de WhatsApp: A5, A9, A10, A11, A12, A13, A14, A15.
import { describe, expect, it } from 'vitest';
import { M2, M4, M5_FILAS, M6, M7, M8, M9 } from '../src/server/flow/messages';
import { hashRegistro } from '../src/server/pdf/hash';
import { boton, crearEntorno, fila, texto, ubicacion } from './helpers';

const WA_ID = '5219991234567';

async function hastaCalificado(e: ReturnType<typeof crearEntorno>, wa_id = WA_ID) {
  await e.entrante(wa_id, texto('Entrada'));
  await e.entrante(wa_id, ubicacion());
  await e.entrante(wa_id, boton('tam_25_100'));
  await e.entrante(wa_id, fila('giro_comercio'));
}

const metodos = (e: ReturnType<typeof crearEntorno>, wa_id = WA_ID) => e.wa.enviadosA(wa_id).map((l) => l.metodo);
const claves = (e: ReturnType<typeof crearEntorno>) =>
  e.db.tablas.mensajes.filter((m) => m.direccion === 'out').map((m) => m.clave);

describe('recorrido feliz', () => {
  it('A5: la ubicación crea registro y PDF, sube la media y envía M2, M3 y M4 en orden', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, ubicacion(20.96743251, -89.59261));

    expect(claves(e)).toEqual(['M1', 'M2', 'M3', 'M4']);
    expect(metodos(e)).toEqual(['enviarSolicitudUbicacion', 'enviarTexto', 'enviarDocumento', 'enviarBotones']);

    const reg = e.db.tablas.registros[0]!;
    expect(reg.folio).toBe('DEMO-20261008-0001');
    expect(reg.lat).toBe('20.967433');
    expect(reg.lon).toBe('-89.592610');
    expect(reg.evento).toBe('Entrada');
    expect(reg.media_id).toBe('media.fake.1');
    expect(e.wa.medias[0]!.mime).toBe('application/pdf');
    expect(e.wa.medias[0]!.filename).toBe('DEMO-20261008-0001.pdf');

    const m3 = e.wa.enviadosA(WA_ID)[2]!.payload.document as { id: string; filename: string; caption: string };
    expect(m3.id).toBe('media.fake.1');
    expect(m3.filename).toBe('DEMO-20261008-0001.pdf');
    expect(m3.caption).toContain('Folio: DEMO-20261008-0001');
    expect(m3.caption).toContain(`Huella SHA-256: ${reg.hash_sha256}`);
    expect(m3.caption).toContain('14:00:00 (hora de Mérida)'); // 20:00Z = 14:00 en Mérida
    expect(reg.mensaje_id).toBe(e.db.tablas.mensajes.find((m) => m.clave === 'M3')!.id);

    expect((e.wa.enviadosA(WA_ID)[1]!.payload.text as { body: string }).body).toBe(M2);
    expect((e.wa.enviadosA(WA_ID)[3]!.payload.interactive as { body: { text: string } }).body.text).toBe(M4);
    expect(e.db.tablas.leads[0]!.estado).toBe('ESPERA_TAMANO');
  });

  it('A8: la huella guardada se reproduce desde la fila de registros', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, ubicacion());
    const r = e.db.tablas.registros[0]!;
    expect(hashRegistro({ folio: r.folio, evento: r.evento, ts: r.ts, lat: r.lat, lon: r.lon })).toBe(r.hash_sha256);
  });

  it('A9: folios consecutivos por día de Mérida, reiniciando en 0001', async () => {
    const e = crearEntorno(new Date('2026-10-08T23:30:00.000Z')); // 17:30 en Mérida
    await e.entrante('5219990000001', texto('Entrada'));
    await e.entrante('5219990000001', ubicacion());
    await e.entrante('5219990000002', texto('Entrada'));
    await e.entrante('5219990000002', ubicacion());
    expect(e.db.tablas.registros.map((r) => r.folio)).toEqual(['DEMO-20261008-0001', 'DEMO-20261008-0002']);

    e.fijar(new Date('2026-10-09T05:30:00.000Z')); // 23:30 del 8 en Mérida: mismo día
    await e.entrante('5219990000003', texto('Entrada'));
    await e.entrante('5219990000003', ubicacion());
    expect(e.db.tablas.registros[2]!.folio).toBe('DEMO-20261008-0003');

    e.fijar(new Date('2026-10-09T06:30:00.000Z')); // 00:30 del 9 en Mérida: nuevo día
    await e.entrante('5219990000004', texto('Entrada'));
    await e.entrante('5219990000004', ubicacion());
    expect(e.db.tablas.registros[3]!.folio).toBe('DEMO-20261009-0001');
  });

  it('A10: tamaño → M5; giro → correo de calificado, M6 y M7', async () => {
    const e = crearEntorno();
    await hastaCalificado(e);
    expect(claves(e)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
    const lead = e.db.tablas.leads[0]!;
    expect(lead.estado).toBe('CALIFICADO');
    expect(lead.tamano).toBe('tam_25_100');
    expect(lead.giro).toBe('giro_comercio');
    expect(e.correo.enviados.map((c) => c.tipo)).toEqual(['calificado']);
    expect(e.correo.enviados[0]!.detalle).toBe('DEMO-20261008-0001');

    const m5 = e.wa.enviadosA(WA_ID)[4]!.payload.interactive as { filas: typeof M5_FILAS };
    expect(m5.filas).toEqual(M5_FILAS);
    const m6 = e.wa.enviadosA(WA_ID)[5]!.payload.interactive as { body: { text: string }; url: string };
    expect(m6.body.text).toBe(M6);
    expect(m6.url).toBe(`https://klokk.mx/a/${lead.agenda_token}`);
    expect(m6.url).not.toContain(WA_ID);
    const m7 = e.wa.enviadosA(WA_ID)[6]!.payload.interactive as { body: { text: string } };
    expect(m7.body.text).toBe(M7);
  });

  it('A11: «Sí» programa T1, T2 y T3 en ventana hábil; «No» no programa; ninguno responde', async () => {
    const e = crearEntorno(new Date('2026-10-08T20:00:00.000Z')); // jueves 14:00 Mérida
    await hastaCalificado(e);
    const antes = claves(e).length;
    await e.entrante(WA_ID, boton('consent_si'));
    expect(claves(e).length).toBe(antes);
    const lead = e.db.tablas.leads[0]!;
    expect(lead.consentimiento).toBe(true);
    expect(e.db.tablas.plantillas.map((p) => [p.plantilla, p.programado_para, p.estado])).toEqual([
      ['T1', '2026-10-09T20:00:00.000Z', 'pendiente'], // viernes 14:00
      ['T2', '2026-10-12T16:00:00.000Z', 'pendiente'], // domingo 14:00 → lunes 10:00
      ['T3', '2026-10-15T20:00:00.000Z', 'pendiente'], // jueves 14:00
    ]);

    const e2 = crearEntorno();
    await hastaCalificado(e2);
    await e2.entrante(WA_ID, boton('consent_no'));
    expect(e2.db.tablas.leads[0]!.consentimiento).toBe(false);
    expect(e2.db.tablas.plantillas).toHaveLength(0);
    expect(claves(e2).length).toBe(7);
  });
});

describe('baja (A12)', () => {
  it('«Baja» envía M8, cancela plantillas y marca baja_ts', async () => {
    const e = crearEntorno();
    await hastaCalificado(e);
    await e.entrante(WA_ID, boton('consent_si'));
    await e.entrante(WA_ID, texto('Baja'));
    const lead = e.db.tablas.leads[0]!;
    expect(lead.estado).toBe('BAJA');
    expect(lead.baja_ts).not.toBeNull();
    expect(e.db.tablas.plantillas.every((p) => p.estado === 'cancelada' && p.motivo === 'baja')).toBe(true);
    expect(claves(e).at(-1)).toBe('M8');
    expect((e.wa.enviadosA(WA_ID).at(-1)!.payload.text as { body: string }).body).toBe(M8);
  });

  it('lead con baja que repite el demo no recibe M7 y nunca se le programan plantillas', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, texto('Baja'));
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, ubicacion());
    await e.entrante(WA_ID, boton('tam_menos_25'));
    await e.entrante(WA_ID, fila('giro_otro'));
    expect(claves(e)).toEqual(['M1', 'M8', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
    expect(e.db.tablas.leads[0]!.estado).toBe('BAJA');
    await e.entrante(WA_ID, boton('consent_si')); // botón viejo o reenviado
    expect(e.db.tablas.plantillas).toHaveLength(0);
    expect(e.db.tablas.leads[0]!.consentimiento).toBe(false);
  });
});

describe('repetir el demo (A13)', () => {
  it('lead calificado: registro y PDF nuevos, M1, M2, M3 y M6; sin M4, M5 ni M7', async () => {
    const e = crearEntorno();
    await hastaCalificado(e);
    await e.entrante(WA_ID, boton('consent_no'));
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, ubicacion());
    expect(claves(e).slice(7)).toEqual(['M1', 'M2', 'M3', 'M6']);
    expect(e.db.tablas.registros.map((r) => r.folio)).toEqual(['DEMO-20261008-0001', 'DEMO-20261008-0002']);
    expect(e.wa.medias).toHaveLength(2);
    expect(e.db.tablas.leads[0]!.estado).toBe('CALIFICADO');
  });
});

describe('texto libre (A14) y cancelación por respuesta (A15)', () => {
  it('texto libre envía M9 y un correo; otro texto en la misma hora solo M9', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, texto('¿Esto sirve para la STPS?'));
    expect(claves(e)).toEqual(['M1', 'M9']);
    expect((e.wa.enviadosA(WA_ID)[1]!.payload.text as { body: string }).body).toBe(M9);
    expect(e.correo.enviados.map((c) => c.tipo)).toEqual(['avisoTexto']);
    expect(e.correo.enviados[0]!.detalle).toBe('¿Esto sirve para la STPS?');

    e.avanzar(10 * 60_000);
    await e.entrante(WA_ID, { type: 'audio' });
    expect(claves(e)).toEqual(['M1', 'M9', 'M9']);
    expect(e.correo.enviados).toHaveLength(1);

    e.avanzar(50 * 60_000);
    await e.entrante(WA_ID, { type: 'image' });
    expect(e.correo.enviados).toHaveLength(2);
    expect(e.correo.enviados[1]!.detalle).toBe('tipo:image');
    expect(e.db.tablas.leads[0]!.estado).toBe('ESPERA_UBIC');
  });

  it('cualquier entrante después del consentimiento cancela las plantillas pendientes', async () => {
    const e = crearEntorno();
    await hastaCalificado(e);
    await e.entrante(WA_ID, boton('consent_si'));
    expect(e.db.tablas.plantillas.filter((p) => p.estado === 'pendiente')).toHaveLength(3);
    await e.entrante(WA_ID, texto('ok gracias'));
    expect(e.db.tablas.plantillas.every((p) => p.estado === 'cancelada' && p.motivo === 'respuesta')).toBe(true);
  });
});

describe('botones viejos y carreras', () => {
  it('un botón fuera de estado se guarda pero no responde nada', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, boton('tam_25_100'));
    expect(claves(e)).toEqual(['M1']);
    expect(e.db.tablas.mensajes.filter((m) => m.direccion === 'in')).toHaveLength(2);
  });

  it('si otro proceso ganó la transición, no se envía nada', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    // Simula una carrera: alguien movió el lead justo antes de ejecutar.
    const original = e.db.leads.transicionar;
    e.db.leads.transicionar = async () => false;
    await e.entrante(WA_ID, ubicacion());
    e.db.leads.transicionar = original;
    expect(claves(e)).toEqual(['M1']);
    expect(e.db.tablas.registros).toHaveLength(0);
    expect(e.logs.some((l) => l.mensaje === 'transición perdida')).toBe(true);
  });

  it('si la subida del PDF falla, no se envía M3 ni M4 y el error queda en el log', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    e.wa.fallar.add('subirMedia');
    await e.entrante(WA_ID, ubicacion());
    expect(claves(e)).toEqual(['M1', 'M2']);
    expect(e.logs.some((l) => l.mensaje.includes('segundo plano'))).toBe(true);
  });

  it('el nombre de perfil se actualiza cuando cambia', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'), 'Ana');
    await e.entrante(WA_ID, texto('hola'), 'Ana María');
    expect(e.db.tablas.leads[0]!.nombre_perfil).toBe('Ana María');
    await e.entrante(WA_ID, texto('hola'), null);
    expect(e.db.tablas.leads[0]!.nombre_perfil).toBe('Ana María');
  });
});
