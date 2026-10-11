// A16: /a/<token> registra el clic, pone AGENDADO, cancela plantillas y redirige.
import { describe, expect, it } from 'vitest';
import { procesarClicAgenda } from '../src/server/flow/agenda';
import { boton, crearEntorno, fila, texto, ubicacion } from './helpers';

const WA_ID = '5219991234567';

describe('/a/[token]', () => {
  it('token válido: AGENDADO, agenda_ts una sola vez, plantillas canceladas', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    await e.entrante(WA_ID, ubicacion());
    await e.entrante(WA_ID, boton('tam_mas_100'));
    await e.entrante(WA_ID, fila('giro_construccion'));
    await e.entrante(WA_ID, boton('consent_si'));
    const lead = e.db.tablas.leads[0]!;
    const enviosAntes = e.wa.enviadosA(WA_ID).length;

    const r1 = await procesarClicAgenda(lead.agenda_token, e.deps);
    expect(r1).toEqual({ ok: true, lead_id: lead.id });
    expect(lead.estado).toBe('AGENDADO');
    const primera = lead.agenda_ts;
    expect(primera).not.toBeNull();
    expect(e.db.tablas.plantillas.every((p) => p.estado === 'cancelada' && p.motivo === 'agenda')).toBe(true);
    expect(e.db.tablas.eventos.some((ev) => ev.tipo === 'CLIC_AGENDA')).toBe(true);

    e.avanzar(60_000);
    const r2 = await procesarClicAgenda(lead.agenda_token, e.deps);
    expect(r2.ok).toBe(true);
    expect(lead.agenda_ts).toBe(primera);
    expect(lead.estado).toBe('AGENDADO');
    // El clic no manda mensajes.
    expect(e.wa.enviadosA(WA_ID)).toHaveLength(enviosAntes);
  });

  it('token inválido, vacío o con formato raro: no encontrado y sin efectos', async () => {
    const e = crearEntorno();
    await e.entrante(WA_ID, texto('Entrada'));
    for (const t of ['', 'x', 'no-existe-no-existe-no-existe', '../../etc', e.db.tablas.leads[0]!.wa_id]) {
      expect(await procesarClicAgenda(t, e.deps)).toEqual({ ok: false });
    }
    expect(e.db.tablas.leads[0]!.estado).toBe('ESPERA_UBIC');
  });

  it('el token es opaco: 32 caracteres base64url, distinto por lead y sin el teléfono', async () => {
    const e = crearEntorno();
    await e.entrante('5219990000001', texto('Entrada'));
    await e.entrante('5219990000002', texto('Entrada'));
    const [a, b] = e.db.tablas.leads;
    expect(a!.agenda_token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a!.agenda_token).not.toBe(b!.agenda_token);
    expect(a!.agenda_token).not.toContain('999');
  });
});
