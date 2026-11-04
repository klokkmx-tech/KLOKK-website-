import { describe, expect, it } from 'vitest';
import { firmaEsperada, verificarFirma } from '../src/server/wa/signature';

const cuerpo = new TextEncoder().encode('{"object":"whatsapp_business_account","entry":[]}');

describe('X-Hub-Signature-256', () => {
  it('acepta la firma correcta con prefijo sha256=', () => {
    const firma = firmaEsperada(cuerpo, 'secreto');
    expect(firma.startsWith('sha256=')).toBe(true);
    expect(firma.length).toBe('sha256='.length + 64);
    expect(verificarFirma(cuerpo, firma, 'secreto')).toBe(true);
  });

  it('rechaza firma ausente, vacía, con otro secreto, o de otro cuerpo', () => {
    const firma = firmaEsperada(cuerpo, 'secreto');
    expect(verificarFirma(cuerpo, null, 'secreto')).toBe(false);
    expect(verificarFirma(cuerpo, '', 'secreto')).toBe(false);
    expect(verificarFirma(cuerpo, firma, 'otro')).toBe(false);
    expect(verificarFirma(new TextEncoder().encode('{}'), firma, 'secreto')).toBe(false);
    expect(verificarFirma(cuerpo, 'sha256=' + '0'.repeat(64), 'secreto')).toBe(false);
    expect(verificarFirma(cuerpo, 'sha256=abc', 'secreto')).toBe(false);
  });

  it('sin app secret configurado nunca verifica', () => {
    expect(verificarFirma(cuerpo, firmaEsperada(cuerpo, ''), '')).toBe(false);
  });
});
