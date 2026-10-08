// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: confirmar dominio definitivo antes del deploy
  site: 'https://klokk.mx',

  // El sitio sigue siendo estático: todas las páginas se prerenderizan.
  // Solo los endpoints del demo (src/pages/api/**, src/pages/a/**) declaran
  // `export const prerender = false` y corren como funciones de Vercel.
  adapter: vercel(),

  env: {
    // Variables del demo (brief §09). Las de servidor van como `secret`:
    // se leen y validan en runtime, nunca se incrustan en el build y el build
    // del sitio no las necesita. Ninguna lleva prefijo PUBLIC_ salvo el número.
    schema: {
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret' }),
      WA_ACCESS_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      WA_PHONE_NUMBER_ID: envField.string({ context: 'server', access: 'secret' }),
      WA_WABA_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      WA_APP_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      WA_APP_SECRET: envField.string({ context: 'server', access: 'secret' }),
      WA_VERIFY_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      WA_API_VERSION: envField.string({ context: 'server', access: 'secret', default: 'v24.0' }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret' }),
      AGENDA_URL: envField.string({ context: 'server', access: 'secret', url: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      CORREO_REMITENTE: envField.string({ context: 'server', access: 'secret' }),
      CORREO_EQUIPO: envField.string({ context: 'server', access: 'secret' }),
      // Única variable pública: número del demo para construir la liga wa.me.
      PUBLIC_WA_DEMO_NUMBER: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
