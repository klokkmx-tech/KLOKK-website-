// A23 secretos, A24 RLS (estático sobre la migración), A25 sin IA y sin
// importaciones de src/server desde el sitio. Todo se verifica sobre los
// archivos del repo, sin red.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');

/** Archivos rastreados por git (nunca docs/, .env ni node_modules). */
const rastreados = execSync('git ls-files', { cwd: RAIZ, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !/\.(png|ico|jpg|jpeg|webp|woff2?|pdf)$/i.test(f));

describe('A23: secretos solo por variables de servidor', () => {
  const config = leer('astro.config.mjs');

  it('ninguna variable con prefijo PUBLIC_ es secreta y toda variable de servidor es secret', () => {
    const campos = [...config.matchAll(/^\s*([A-Z0-9_]+):\s*envField\.\w+\(\{([^}]*)\}\)/gm)].map((m) => ({
      nombre: m[1]!,
      opciones: m[2]!,
    }));
    expect(campos.length).toBeGreaterThanOrEqual(15);
    for (const c of campos) {
      const esPublica = c.nombre.startsWith('PUBLIC_');
      const contexto = /context:\s*'(\w+)'/.exec(c.opciones)?.[1];
      const acceso = /access:\s*'(\w+)'/.exec(c.opciones)?.[1];
      if (esPublica) {
        expect(acceso, c.nombre).toBe('public');
        expect(contexto, c.nombre).toBe('client');
      } else {
        expect(contexto, c.nombre).toBe('server');
        expect(acceso, c.nombre).toBe('secret');
      }
    }
    // Exactamente una variable pública: el número del demo.
    expect(campos.filter((c) => c.nombre.startsWith('PUBLIC_')).map((c) => c.nombre)).toEqual(['PUBLIC_WA_DEMO_NUMBER']);
  });

  it('.env.example lista solo nombres con valor vacío', () => {
    const lineas = leer('.env.example')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    expect(lineas.length).toBeGreaterThan(10);
    for (const l of lineas) expect(l, l).toMatch(/^[A-Z0-9_]+=$/);
    // Todas las variables del esquema están en el ejemplo y viceversa.
    const enEjemplo = new Set(lineas.map((l) => l.slice(0, -1)));
    const enEsquema = new Set([...config.matchAll(/^\s*([A-Z0-9_]+):\s*envField/gm)].map((m) => m[1]!));
    expect([...enEjemplo].sort()).toEqual([...enEsquema].sort());
  });

  it('.env y .env.* reales no están rastreados y docs/ tampoco', () => {
    expect(rastreados.some((f) => /^\.env(\..*)?$/.test(f) && f !== '.env.example')).toBe(false);
    expect(rastreados.some((f) => f.startsWith('docs/'))).toBe(false);
    expect(rastreados.some((f) => f.startsWith('.local/'))).toBe(false);
  });

  it('ningún archivo rastreado contiene valores con pinta de token o de proyecto real', () => {
    const patrones: Array<[string, RegExp]> = [
      ['token de Meta', /\bEAA[A-Za-z0-9]{30,}/],
      ['llave de Resend', /\bre_[A-Za-z0-9]{20,}\b/],
      ['JWT (llave de Supabase)', /\beyJhbGciOi[A-Za-z0-9_-]{20,}\./],
      ['llave sb_secret', /\bsb_secret_[A-Za-z0-9]{10,}/],
      ['token sbp_', /\bsbp_[a-f0-9]{30,}/],
      ['URL de proyecto de Supabase', /https:\/\/[a-z]{20}\.supabase\.co/],
      ['token de Vercel', /\bvercel_[A-Za-z0-9]{20,}/],
    ];
    const hallazgos: string[] = [];
    for (const f of rastreados) {
      if (f === 'package-lock.json') continue;
      const contenido = leer(f);
      for (const [nombre, re] of patrones) if (re.test(contenido)) hallazgos.push(`${f}: ${nombre}`);
    }
    expect(hallazgos).toEqual([]);
  });

  it('el código nunca imprime los valores de las variables de entorno', () => {
    const fuentes = rastreados.filter((f) => f.startsWith('src/server/') || f.startsWith('src/pages/'));
    for (const f of fuentes) {
      const contenido = leer(f);
      expect(contenido, f).not.toMatch(/console\.\w+\([^)]*(ACCESS_TOKEN|SERVICE_ROLE|APP_SECRET|RESEND_API_KEY|CRON_SECRET|VERIFY_TOKEN)/);
    }
  });
});

describe('A24: RLS activado sin políticas (migraciones)', () => {
  const migraciones = rastreados.filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f)).map(leer).join('\n');
  const tablas = [...migraciones.matchAll(/create table\s+(\w+)/gi)].map((m) => m[1]!.toLowerCase());

  it('cada tabla creada activa RLS', () => {
    expect(tablas.length).toBeGreaterThanOrEqual(6);
    for (const t of tablas) {
      expect(migraciones, t).toMatch(new RegExp(`alter table\\s+${t}\\s+enable row level security`, 'i'));
    }
  });

  it('no existe ninguna política y se revocan permisos a anon y authenticated', () => {
    expect(migraciones).not.toMatch(/create policy/i);
    expect(migraciones).toMatch(/revoke all on all tables\s+in schema public from anon, authenticated/i);
    expect(migraciones).toMatch(/revoke all on all functions\s+in schema public from anon, authenticated/i);
  });

  it('las funciones no son security definer (corren con los permisos de la llave de servicio)', () => {
    expect(migraciones).not.toMatch(/security definer/i);
  });
});

describe('A25: sin IA y sin src/server en el sitio', () => {
  const servidor = rastreados.filter((f) => f.startsWith('src/server/'));
  const sitio = rastreados.filter((f) => /^src\/(components|layouts|lib|pages\/[^/]+\.astro|styles)/.test(f));

  it('src/server no importa SDKs ni endpoints de modelos de lenguaje', () => {
    const prohibidos = /(openai|anthropic|@ai-sdk|langchain|gemini|generativelanguage|api\.openai\.com|api\.anthropic\.com|huggingface|cohere|mistral)/i;
    for (const f of servidor) expect(leer(f), f).not.toMatch(prohibidos);
    expect(servidor.length).toBeGreaterThan(10);
  });

  it('las dependencias no incluyen SDKs de IA', () => {
    const pkg = JSON.parse(leer('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    const todas = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(todas.filter((d) => /openai|anthropic|ai-sdk|langchain|gemini/i.test(d))).toEqual([]);
  });

  it('ningún componente, layout, lib ni página estática importa de src/server', () => {
    for (const f of sitio) {
      const contenido = leer(f);
      expect(contenido, f).not.toMatch(/from\s+['"][^'"]*\/server\//);
      expect(contenido, f).not.toMatch(/import\s*\(\s*['"][^'"]*\/server\//);
    }
    expect(sitio.length).toBeGreaterThan(10);
  });

  it('los endpoints de servidor declaran prerender = false y las páginas no', () => {
    const endpoints = rastreados.filter((f) => /^src\/pages\/(api\/|a\/)/.test(f));
    expect(endpoints.length).toBe(5);
    for (const f of endpoints) expect(leer(f), f).toMatch(/export const prerender = false/);
    for (const f of rastreados.filter((x) => /^src\/pages\/[^/]+\.astro$/.test(x))) {
      expect(leer(f), f).not.toMatch(/prerender\s*=\s*false/);
    }
  });
});
