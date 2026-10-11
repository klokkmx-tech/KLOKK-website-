// A1 verificación GET, A2 firma, A3 dedupe, A4 primer mensaje, A21 estatus, A30 wa_id.
import { describe, expect, it } from 'vitest';
import { manejarGet, manejarPost } from '../src/server/wa/webhook';
import { APP_SECRET, VERIFY_TOKEN, crearEntorno, peticion, texto, valorMensajes } from './helpers';

const WA_ID = '5219991234567';

describe('GET /api/wa (A1)', () => {
  it('devuelve hub.challenge con el token correcto', async () => {
    const url = new URL(`https://klokk.mx/api/wa?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=123456`);
    const res = manejarGet(url, VERIFY_TOKEN);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('123456');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('403 con token incorrecto, modo distinto o sin challenge', async () => {
    expect(manejarGet(new URL('https://k/api/wa?hub.mode=subscribe&hub.verify_token=malo&hub.challenge=1'), VERIFY_TOKEN).status).toBe(403);
    expect(manejarGet(new URL(`https://k/api/wa?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`), VERIFY_TOKEN).status).toBe(403);
    expect(manejarGet(new URL(`https://k/api/wa?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}`), VERIFY_TOKEN).status).toBe(403);
  });
});

describe('POST /api/wa firma (A2)', () => {
  it('401 sin firma y no escribe nada', async () => {
    const e = crearEntorno();
    const payload = valorMensajes({ mensajes: [{ from: WA_ID, id: 'wamid.1', timestamp: '1', ...texto('Entrada') }], wa_id: WA_ID });
    const res = await manejarPost(peticion(payload, { firmar: false }), e.webhookDeps);
    expect(res.status).toBe(401);
    expect(e.db.tablas.mensajes).toHaveLength(0);
    expect(e.db.tablas.leads).toHaveLength(0);
  });

  it('401 con firma de otro secreto', async () => {
    const e = crearEntorno();
    const payload = valorMensajes({ mensajes: [{ from: WA_ID, id: 'wamid.1', timestamp: '1', ...texto('Entrada') }], wa_id: WA_ID });
    const res = await manejarPost(peticion(payload, { secret: 'otro' }), e.webhookDeps);
    expect(res.status).toBe(401);
    expect(e.db.tablas.mensajes).toHaveLength(0);
  });

  it('401 si el cuerpo cambió después de firmar', async () => {
    const e = crearEntorno();
    const payload = valorMensajes({ mensajes: [{ from: WA_ID, id: 'wamid.1', timestamp: '1', ...texto('Entrada') }], wa_id: WA_ID });
    const req = peticion(payload);
    const alterada = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(payload).replace('Entrada', 'Baja'),
    });
    expect((await manejarPost(alterada, e.webhookDeps)).status).toBe(401);
  });

  it('200 con JSON inválido o payload desconocido pero bien firmado (sin procesar nada)', async () => {
    const e = crearEntorno();
    expect((await manejarPost(peticion(null, { cuerpo: 'no es json' }), e.webhookDeps)).status).toBe(200);
    expect((await manejarPost(peticion({ object: 'page', entry: [] }), e.webhookDeps)).status).toBe(200);
    expect(e.db.tablas.mensajes).toHaveLength(0);
    expect(e.logs.length).toBeGreaterThan(0);
  });
});

describe('dedupe por meta_msg_id (A3)', () => {
  it('el mismo wamid dos veces produce un solo mensaje y una sola M1', async () => {
    const e = crearEntorno();
    const m = { from: WA_ID, id: 'wamid.dup', timestamp: '1', ...texto('Entrada') };
    const payload = valorMensajes({ mensajes: [m], wa_id: WA_ID });
    await manejarPost(peticion(payload), e.webhookDeps);
    await manejarPost(peticion(payload), e.webhookDeps);
    await e.esperarPendientes();
    expect(e.db.tablas.mensajes.filter((x) => x.direccion === 'in')).toHaveLength(1);
    expect(e.wa.enviadosA(WA_ID).map((l) => l.metodo)).toEqual(['enviarSolicitudUbicacion']);
    expect(e.db.tablas.leads).toHaveLength(1);
  });

  it('el entrante se inserta antes de procesar y queda vinculado al lead', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    const entrante = e.db.tablas.mensajes.find((x) => x.direccion === 'in')!;
    expect(entrante.lead_id).toBe(e.db.tablas.leads[0]!.id);
  });
});

describe('primer mensaje (A4) y wa_id (A30)', () => {
  it('«Entrada» crea el lead en ESPERA_UBIC y envía M1 con aviso y solicitud de ubicación', async () => {
    const e = crearEntorno();
    const res = await e.entrante(WA_ID, texto('Entrada'));
    expect(res.status).toBe(200);
    const lead = e.db.tablas.leads[0]!;
    expect(lead.estado).toBe('ESPERA_UBIC');
    expect(lead.nombre_perfil).toBe('Ana');
    const [m1] = e.wa.enviadosA(WA_ID);
    expect(m1!.metodo).toBe('enviarSolicitudUbicacion');
    const cuerpo = (m1!.payload.interactive as { body: { text: string } }).body.text;
    expect(cuerpo).toContain('https://klokk.mx/privacidad-demo');
    expect(cuerpo.indexOf('privacidad-demo')).toBeLessThan(cuerpo.indexOf('comparte tu ubicación'));
    const saliente = e.db.tablas.mensajes.find((x) => x.direccion === 'out')!;
    expect(saliente.clave).toBe('M1');
    expect(m1!.to).toBe(WA_ID);
    expect(saliente.meta_msg_id).toBe('wamid.fake.1');
  });

  it('guarda el wa_id byte a byte y responde a ese mismo valor', async () => {
    const e = crearEntorno();
    const raro = '5219991234567'; // México con 1 extra: no se normaliza
    await e.entrante(raro, texto('Entrada'));
    expect(e.db.tablas.leads[0]!.wa_id).toBe(raro);
    for (const l of e.wa.llamadas) if (l.metodo !== 'subirMedia') expect(l.to).toBe(raro);
    for (const m of e.db.tablas.mensajes) expect(m.wa_id).toBe(raro);
  });

  it('un primer mensaje que no es «Entrada» crea el lead en NUEVO, manda M9 y avisa por correo', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('hola, info?'));
    expect(e.db.tablas.leads[0]!.estado).toBe('NUEVO');
    expect(e.wa.enviadosA(WA_ID).map((l) => l.metodo)).toEqual(['enviarTexto']);
    expect(e.correo.enviados.map((c) => c.tipo)).toEqual(['avisoTexto']);
  });
});

describe('estatus de entrega (A21)', () => {
  it('actualiza mensajes.estatus del saliente y no toca el lead', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    const saliente = e.db.tablas.mensajes.find((x) => x.direccion === 'out')!;
    const estadoAntes = e.db.tablas.leads[0]!.estado;

    expect((await e.estatus(saliente.meta_msg_id!, 'delivered')).status).toBe(200);
    expect(e.db.tablas.mensajes.find((x) => x.id === saliente.id)!.estatus).toBe('delivered');

    await e.estatus(saliente.meta_msg_id!, 'failed', [{ code: 131026, title: 'Message undeliverable' }]);
    const fallido = e.db.tablas.mensajes.find((x) => x.id === saliente.id)!;
    expect(fallido.estatus).toBe('failed');
    expect(fallido.error).toEqual([{ code: 131026, title: 'Message undeliverable' }]);
    expect(e.db.tablas.leads[0]!.estado).toBe(estadoAntes);
    expect(e.wa.enviadosA(WA_ID)).toHaveLength(1);
  });

  it('un estatus de un wamid desconocido se ignora con 200', async () => {
    const e = crearEntorno();
    expect((await e.estatus('wamid.desconocido', 'read')).status).toBe(200);
    expect(e.logs.some((l) => l.mensaje.includes('desconocido'))).toBe(true);
  });
});

describe('secreto', () => {
  it('APP_SECRET de prueba no es el valor real', () => {
    expect(APP_SECRET).toBe('secreto-de-prueba');
  });
});
