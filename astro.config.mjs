// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // TODO: confirmar dominio definitivo antes del deploy
  site: 'https://klokk.mx',
  vite: {
    plugins: [tailwindcss()]
  }
});