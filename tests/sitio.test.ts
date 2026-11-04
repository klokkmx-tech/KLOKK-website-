// A26 build prerenderizado, A27 CTA del hero y QR, A28 /privacidad-demo.
// Verifica la salida real del build en .vercel/output. Si no existe, construye.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { M1, PRIVACIDAD_URL } from '../src/server/flow/messages';

const RAIZ = join(import.meta.dirname, '..');
const SALIDA = join(RAIZ, '.vercel', 'output');
const ESTATICO = join(SALIDA, 'static');
const leer = (p: string) => readFileSync(join(ESTATICO, p), 'utf8');

beforeAll(() => {
  if (!existsSync(join(ESTATICO, 'index.html'))) {
    execSync('npx astro build', { cwd: RAIZ, stdio: 'pipe', env: { ...process.env, PUBLIC_WA_DEMO_NUMBER: process.env.PUBLIC_WA_DEMO_NUMBER ?? '' } });
  }
}, 120_000);

describe('A26: build estático con endpoints en servidor', () => {
  it('las dos páginas están prerenderizadas como HTML', () => {
    expect(existsSync(join(ESTATICO, 'index.html'))).toBe(true);
    expect(existsSync(join(ESTATICO, 'privacidad-demo', 'index.html'))).toBe(true);
  });

  it('los endpoints no existen como archivos estáticos y sí como rutas de función', () => {
    expect(existsSync(join(ESTATICO, 'api'))).toBe(false);
    expect(existsSync(join(ESTATICO, 'a'))).toBe(false);
    const config = JSON.parse(readFileSync(join(SALIDA, 'config.json'), 'utf8')) as { routes: Array<{ src?: string; dest?: string }> };
    const dinamicas = config.routes.filter((r) => r.dest && /_render/.test(r.dest)).map((r) => r.src!);
    for (const ruta of ['/api/wa', '/a/x', '/api/cron/recordatorios', '/api/cron/seguimiento', '/api/cron/resumen']) {
      expect(dinamicas.some((src) => new RegExp(src).test(ruta)), ruta).toBe(true);
    }
    expect(readdirSync(join(SALIDA, 'functions')).length).toBeGreaterThan(0);
  });

  it('el resto del sitio conserva sus secciones', () => {
    const html = leer('index.html');
    for (const id of ['como-funciona', 'valor-probatorio', 'que-incluye', 'precios']) {
      expect(html, id).toContain(`id="${id}"`);
    }
    // Copy del producto intacto (regla 4 no aplica al sitio).
    expect(html).toContain('NOM-151');
  });
});

describe('A27: CTA principal del hero', () => {
  const html = () => leer('index.html');

  it('apunta a wa.me/<número>?text=Entrada', () => {
    const m = /href="https:\/\/wa\.me\/(\d+)\?text=Entrada"/.exec(html());
    expect(m).not.toBeNull();
    expect(m![1]!.length).toBeGreaterThanOrEqual(10);
    const esperado = (process.env.PUBLIC_WA_DEMO_NUMBER ?? '').replace(/\D/g, '');
    if (esperado) expect(m![1]).toBe(esperado);
  });

  it('en escritorio muestra el QR con la misma liga; en móvil está oculto', () => {
    const h = html();
    const qr = /<div class="qr-demo[^"]*hidden[^"]*lg:flex[^"]*"/.exec(h);
    expect(qr).not.toBeNull();
    expect(h).toMatch(/role="img" aria-label="Código QR[^"]*"/);
    // El QR es SVG inline generado en build: hay <svg con <path dentro del contenedor.
    const i = h.indexOf('class="qr-demo');
    expect(h.slice(i, i + 20_000)).toMatch(/<svg[^>]*viewBox/);
    // Un solo CTA al demo: el QR codifica la misma URL (se verifica en el componente, aquí la presencia).
    expect((h.match(/\?text=Entrada"/g) ?? []).length).toBe(1);
  });

  it('la nota enlaza al aviso de privacidad del demo', () => {
    expect(html()).toMatch(/href="\/privacidad-demo"/);
  });
});

describe('A28: /privacidad-demo', () => {
  it('existe, usa el Layout y no menciona las cadenas prohibidas', () => {
    const h = leer('privacidad-demo/index.html');
    expect(h).toContain('Aviso de privacidad del demo');
    expect(h).toContain('<html lang="es-MX">');
    expect(h).toContain('<link rel="canonical" href="https://klokk.mx/privacidad-demo');
    expect(h).toContain('<meta property="og:site_name" content="Klokk">');
    for (const p of ['NOM-151', 'certificado', 'constancia', 'validez legal']) expect(h.toLowerCase()).not.toContain(p.toLowerCase());
  });

  it('M1 enlaza exactamente a esa URL', () => {
    expect(PRIVACIDAD_URL).toBe('https://klokk.mx/privacidad-demo');
    expect(M1).toContain(PRIVACIDAD_URL);
  });
});
