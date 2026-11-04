import { describe, expect, it } from 'vitest';
import { esBaja, esEntrada, eventoDesdeMensaje, normalizarTexto } from '../src/server/flow/events';

describe('normalización de palabras clave', () => {
  it('reconoce «Entrada» con mayúsculas, espacios, acentos y puntuación final', () => {
    for (const t of ['Entrada', 'ENTRADA', ' entrada ', 'Entrada.', 'Éntrada!', 'entrada…', 'ENTRADA!!!', '\tEntrada\n']) {
      expect(esEntrada(t), t).toBe(true);
    }
  });

  it('no reconoce frases que contienen la palabra', () => {
    for (const t of ['entrada ya', 'quiero la entrada', 'Entrada y salida', 'la entrada']) {
      expect(esEntrada(t), t).toBe(false);
    }
  });

  it('reconoce «Baja» y rechaza frases', () => {
    for (const t of ['Baja', 'BAJA', 'baja.', ' baja ', 'Baja!']) expect(esBaja(t), t).toBe(true);
    for (const t of ['dame de baja', 'baja ya', 'me doy de baja']) expect(esBaja(t), t).toBe(false);
  });

  it('normalizarTexto es idempotente', () => {
    const n = normalizarTexto('  Éntrada!! ');
    expect(normalizarTexto(n)).toBe(n);
    expect(n).toBe('entrada');
  });
});

describe('eventoDesdeMensaje', () => {
  it('texto: ENTRADA, BAJA o TEXTO_LIBRE', () => {
    expect(eventoDesdeMensaje({ type: 'text', text: { body: 'Entrada' } })).toEqual({ tipo: 'ENTRADA' });
    expect(eventoDesdeMensaje({ type: 'text', text: { body: 'baja' } })).toEqual({ tipo: 'BAJA' });
    expect(eventoDesdeMensaje({ type: 'text', text: { body: '¿Cuánto cuesta?' } })).toEqual({
      tipo: 'TEXTO_LIBRE',
      resumen: '¿Cuánto cuesta?',
    });
  });

  it('ubicación: UBICACION con lat y lon tal cual', () => {
    expect(
      eventoDesdeMensaje({ type: 'location', location: { latitude: 20.96743251, longitude: -89.59261 } }),
    ).toEqual({ tipo: 'UBICACION', lat: 20.96743251, lon: -89.59261 });
  });

  it('interactivos: tamaño, giro y consentimiento por id', () => {
    const boton = (id: string) => ({
      type: 'interactive' as const,
      interactive: { type: 'button_reply' as const, button_reply: { id, title: 'x' } },
    });
    const fila = (id: string) => ({
      type: 'interactive' as const,
      interactive: { type: 'list_reply' as const, list_reply: { id, title: 'x' } },
    });
    expect(eventoDesdeMensaje(boton('tam_menos_25'))).toEqual({ tipo: 'BOTON_TAMANO', id: 'tam_menos_25' });
    expect(eventoDesdeMensaje(fila('giro_inmobiliaria'))).toEqual({ tipo: 'LISTA_GIRO', id: 'giro_inmobiliaria' });
    expect(eventoDesdeMensaje(boton('consent_si'))).toEqual({ tipo: 'BOTON_CONSENT', valor: 'si' });
    expect(eventoDesdeMensaje(boton('consent_no'))).toEqual({ tipo: 'BOTON_CONSENT', valor: 'no' });
    // El id no decide por el tipo de interactivo: un giro por botón también cuenta.
    expect(eventoDesdeMensaje(boton('giro_otro'))).toEqual({ tipo: 'LISTA_GIRO', id: 'giro_otro' });
  });

  it('id interactivo desconocido → TEXTO_LIBRE', () => {
    expect(
      eventoDesdeMensaje({
        type: 'interactive',
        interactive: { type: 'button_reply', button_reply: { id: 'otro_boton', title: 'x' } },
      }),
    ).toEqual({ tipo: 'TEXTO_LIBRE', resumen: 'interactivo:otro_boton' });
  });

  it('audio, imagen, sticker, documento, contacto, reacción → TEXTO_LIBRE con el tipo', () => {
    for (const type of ['audio', 'image', 'sticker', 'document', 'contacts', 'reaction', 'video', 'unsupported']) {
      expect(eventoDesdeMensaje({ type })).toEqual({ tipo: 'TEXTO_LIBRE', resumen: `tipo:${type}` });
    }
  });
});
