// A29 · ¿A qué apunta este entorno?
//
//   npm run entorno              lee .env (si existe) y las variables del proceso
//   npm run entorno -- --en-vivo además consulta Meta y Supabase en modo lectura
//
// Imprime el ref del proyecto de Supabase, el WABA, el número y la app de Meta,
// el dominio del remitente y la agenda. NUNCA imprime un secreto: solo si está
// definido y su longitud. Falla (código 2) si algún valor coincide con la lista
// de producción que JP mantiene fuera del repo (regla dura 1):
//
//   ~/.klokk/produccion.txt   una línea por valor prohibido (refs, ids, dominios)
//   o la ruta en KLOKK_PRODUCCION_LISTA
//
// Es autocontenido: no importa nada de src/ para poder correr con Node sin build.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const env = process.env;
const enVivo = process.argv.includes('--en-vivo');

type Fila = [string, string];
const filas: Fila[] = [];
const problemas: string[] = [];

const valor = (k: string): string => (env[k] ?? '').trim();
const secreto = (k: string): string => {
  const v = valor(k);
  return v ? `definido (${v.length} caracteres)` : 'NO DEFINIDO';
};

// ---------- Supabase ----------
const supabaseUrl = valor('SUPABASE_URL');
const ref = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/.exec(supabaseUrl)?.[1] ?? null;
filas.push(['Supabase · ref del proyecto', ref ?? (supabaseUrl ? `no reconocido (${new URL(supabaseUrl).host})` : 'NO DEFINIDO')]);
filas.push(['Supabase · service role', secreto('SUPABASE_SERVICE_ROLE_KEY')]);

// ---------- Meta ----------
filas.push(['Meta · WABA id', valor('WA_WABA_ID') || 'NO DEFINIDO']);
filas.push(['Meta · phone number id', valor('WA_PHONE_NUMBER_ID') || 'NO DEFINIDO']);
filas.push(['Meta · app id', valor('WA_APP_ID') || 'NO DEFINIDO']);
filas.push(['Meta · versión de API', valor('WA_API_VERSION') || 'v24.0 (default)']);
filas.push(['Meta · access token', secreto('WA_ACCESS_TOKEN')]);
filas.push(['Meta · app secret', secreto('WA_APP_SECRET')]);
filas.push(['Meta · verify token', secreto('WA_VERIFY_TOKEN')]);

// ---------- Otros ----------
const remitente = valor('CORREO_REMITENTE');
const dominioRemitente = /@([^>\s]+)>?$/.exec(remitente)?.[1]?.toLowerCase() ?? null;
filas.push(['Correo · remitente (dominio)', dominioRemitente ?? 'NO DEFINIDO']);
if (dominioRemitente && dominioRemitente !== 'avisos.klokk.mx') problemas.push(`CORREO_REMITENTE no está en avisos.klokk.mx: ${dominioRemitente}`);
filas.push(['Correo · destinatarios', valor('CORREO_EQUIPO') ? `${valor('CORREO_EQUIPO').split(',').length} dirección(es)` : 'NO DEFINIDO']);
filas.push(['Correo · Resend API key', secreto('RESEND_API_KEY')]);
filas.push(['Crons · CRON_SECRET', secreto('CRON_SECRET')]);
const agenda = valor('AGENDA_URL');
filas.push(['Agenda · host', agenda ? new URL(agenda).host : 'NO DEFINIDO']);
filas.push(['Sitio · PUBLIC_WA_DEMO_NUMBER', valor('PUBLIC_WA_DEMO_NUMBER') ? enmascarar(valor('PUBLIC_WA_DEMO_NUMBER')) : 'NO DEFINIDO (placeholder)']);
filas.push(['Vercel · entorno', valor('VERCEL_ENV') || 'local']);

// ---------- Lista de producción ----------
const rutaLista = valor('KLOKK_PRODUCCION_LISTA') || join(homedir(), '.klokk', 'produccion.txt');
let lista: string[] = [];
if (existsSync(rutaLista)) {
  lista = readFileSync(rutaLista, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const candidatos: Array<[string, string]> = [
    ['SUPABASE_URL', ref ?? supabaseUrl],
    ['WA_WABA_ID', valor('WA_WABA_ID')],
    ['WA_PHONE_NUMBER_ID', valor('WA_PHONE_NUMBER_ID')],
    ['WA_APP_ID', valor('WA_APP_ID')],
    ['PUBLIC_WA_DEMO_NUMBER', valor('PUBLIC_WA_DEMO_NUMBER')],
    ['CORREO_REMITENTE', dominioRemitente ?? ''],
  ];
  for (const [k, v] of candidatos) {
    if (v && lista.includes(v)) problemas.push(`${k} apunta a un recurso de PRODUCCIÓN (coincide con ${rutaLista})`);
  }
  filas.push(['Lista de producción', `${lista.length} valor(es) en ${rutaLista}`]);
} else {
  filas.push(['Lista de producción', `no encontrada en ${rutaLista} (crea el archivo para activar el candado)`]);
}

// ---------- En vivo (solo lectura) ----------
async function enVivoMeta(): Promise<void> {
  const token = valor('WA_ACCESS_TOKEN');
  const version = valor('WA_API_VERSION') || 'v24.0';
  const pnid = valor('WA_PHONE_NUMBER_ID');
  if (!token || !pnid) {
    filas.push(['Meta · en vivo', 'omitido: faltan WA_ACCESS_TOKEN o WA_PHONE_NUMBER_ID']);
    return;
  }
  const r = await fetch(`https://graph.facebook.com/${version}/${pnid}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = (await r.json()) as { display_phone_number?: string; verified_name?: string; quality_rating?: string; error?: { message: string; code: number } };
  if (!r.ok) {
    filas.push(['Meta · en vivo', `HTTP ${r.status}: ${j.error?.message ?? 'error'}`]);
    return;
  }
  filas.push(['Meta · número (en vivo)', `${enmascarar(j.display_phone_number ?? '')} · ${j.verified_name ?? 'sin nombre'} · calidad ${j.quality_rating ?? '?'}`]);
  const waba = valor('WA_WABA_ID');
  if (waba) {
    const w = await fetch(`https://graph.facebook.com/${version}/${waba}?fields=name,account_review_status`, { headers: { Authorization: `Bearer ${token}` } });
    const wj = (await w.json()) as { name?: string; account_review_status?: string; error?: { message: string } };
    filas.push(['Meta · WABA (en vivo)', w.ok ? `${wj.name ?? 'sin nombre'} · ${wj.account_review_status ?? '?'}` : `HTTP ${w.status}: ${wj.error?.message ?? 'error'}`]);
  }
}

async function enVivoSupabase(): Promise<void> {
  const key = valor('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !key) {
    filas.push(['Supabase · en vivo', 'omitido: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY']);
    return;
  }
  const cab = { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' };
  const r = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/leads?select=id`, { headers: cab });
  const total = r.headers.get('content-range')?.split('/')[1] ?? '?';
  filas.push(['Supabase · leads (en vivo)', r.ok ? `${total} fila(s); tabla accesible con la llave de servicio` : `HTTP ${r.status}`]);
  // Con la llave anónima nada debe leerse; se prueba con una llave vacía (401 esperado).
  const anon = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/leads?select=id`, { headers: { apikey: 'anon-no-valida' } });
  filas.push(['Supabase · sin llave de servicio (en vivo)', anon.status === 401 || anon.status === 403 ? `bloqueado (HTTP ${anon.status})` : `ATENCIÓN: HTTP ${anon.status}`]);
}

function enmascarar(numero: string): string {
  const d = numero.replace(/\D/g, '');
  return d.length <= 4 ? '••••' : `${'•'.repeat(d.length - 2)}${d.slice(-2)}`;
}

async function main(): Promise<void> {
  if (enVivo) {
    try {
      await enVivoMeta();
      await enVivoSupabase();
    } catch (e) {
      problemas.push(`en vivo: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const ancho = Math.max(...filas.map(([k]) => k.length));
  console.log('\nDEMO-WEB-01 · entorno\n');
  for (const [k, v] of filas) console.log(`  ${k.padEnd(ancho)}  ${v}`);
  console.log('');
  if (problemas.length) {
    for (const p of problemas) console.error(`  ✗ ${p}`);
    console.error('');
    process.exit(2);
  }
  console.log('  ✓ sin coincidencias con producción\n');
}

void main();
