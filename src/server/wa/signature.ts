// Verificación de X-Hub-Signature-256 (Meta firma el cuerpo crudo con HMAC-SHA256
// y el app secret, con prefijo «sha256=»). Comparación en tiempo constante.

import { createHmac, timingSafeEqual } from 'node:crypto';

export function firmaEsperada(cuerpoCrudo: Uint8Array, appSecret: string): string {
  return 'sha256=' + createHmac('sha256', appSecret).update(cuerpoCrudo).digest('hex');
}

export function verificarFirma(cuerpoCrudo: Uint8Array, cabecera: string | null, appSecret: string): boolean {
  if (!cabecera || !appSecret) return false;
  const esperada = Buffer.from(firmaEsperada(cuerpoCrudo, appSecret), 'utf8');
  const recibida = Buffer.from(cabecera.trim(), 'utf8');
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}
