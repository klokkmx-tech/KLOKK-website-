# Klokk — sitio web

Landing page de [Klokk](https://klokk.mx): registro de asistencia por WhatsApp con valor probatorio (LFT Art. 132 Fr. XXXIV, NOM-151).

## Stack

- [Astro](https://astro.build) + Tailwind CSS v4, sitio estático
- Fuentes self-hosted (Bricolage Grotesque, Inter, IBM Plex Mono)
- Deploy: Vercel

## Desarrollo

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # genera dist/
```

## Dónde cambiar cosas

- **CTAs (WhatsApp / demo):** `src/lib/links.ts` — un solo lugar para el número real y la agenda.
- **Copy de secciones:** cada sección es un componente en `src/components/`.
- **Tokens de marca (colores, tipografía):** `src/styles/global.css`.

## OG image (previews de WhatsApp/redes)

La fuente es `og/og.html` (1200×630, usa las fuentes de `node_modules`). Para regenerar `public/og.png`:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --allow-file-access-from-files --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1200,630 --screenshot=og/og-2x.png "file://$PWD/og/og.html"
sips -z 630 1200 og/og-2x.png --out public/og.png
```
