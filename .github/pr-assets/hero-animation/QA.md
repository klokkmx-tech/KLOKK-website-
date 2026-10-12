# Reporte de QA — animación del hero (`feat/hero-animation`)

QA independiente con Playwright 1.58 + Chromium headless-shell 1208 sobre el build estático (`.vercel/output/static`). Tres pasadas: `d8980c2` → `af722ba` → `fccda53` (final).

## Resultado final (@ `fccda53`)

| # | Punto | Resultado | Evidencia |
|---|---|---|---|
| 1 | Apertura ≤ 1.5 s, titular y CTA desde el frame 0 | CUMPLE | Estado final de las 5 capas a 1493 ms (1440) / 1463 ms (390) desde el primer frame. H1 y CTA visibles en DCL con opacidad 0.6, llegan a 1 en ~500 ms. Sin pantalla de entrada, scroll libre. |
| 2 | CLS del hero = 0 | CUMPLE | Hero: 0 en 1440 y 390, con y sin reduced-motion. Residual 0.004 en 1440 causado por el nav (`ul.hidden`) y `.qr-demo`, fuera del hero. (Era 0.207/0.353 en `main`.) |
| 3 | Scroll: pin + scrub en desktop, apilado en móvil | CUMPLE | `.historia-pin` sticky durante ~3570 px; avance ligado al scroll (sin cambio en 2.5 s quieto; reversible). Móvil: `static`, bloques con reveal. Mockups `aria-hidden`, textos legibles. |
| 4 | Mouse (tilt ≤ 6°, palomita en CTA ~250 ms, sin cambio de ancho) | CUMPLE | Tilt máx 6° con lerp, vuelve a `none`. Palomita dashoffset 1→0 en ~250 ms; ancho del botón 270.31 px constante. En touch no ocurre nada. |
| 5 | `prefers-reduced-motion` | CUMPLE | Capas en opacity 1 y dashoffset 0 en DCL; ningún estilo cambia entre 0 y 2.2 s; sin pin, scrub ni tilt. |
| 6 | Consola | CUMPLE | 0 errores, 0 warnings, 0 pageerror en todas las cargas. |
| 7 | Build / lint / tests | CUMPLE | `npm run build` OK; `npx astro check` 0/0/0; `npm test` 149/149. |
| 8 | JS agregado ≤ 40 KB gzip | CUMPLE | gsap 26.9 KB + Hero 1.2 KB + ScrollHistoria 1.9 KB + mouse inline 1.0 KB = **30.3 KB**. 0 requests extra para la apertura (SVG inline). |
| 9 | Accesibilidad | CUMPLE | SVG `role="img"` `aria-label="Klokk"`; mockups `aria-hidden`; sin ids duplicados. |
| 10 | Sin JS | CUMPLE | Logo completo vía `<noscript>`; tres pasos visibles. |
| 11 | Regresiones | CUMPLE | Un solo `?text=Entrada`; ids `#como-funciona`, `#valor-probatorio`, `#que-incluye`, `#precios`; Nav/Footer con logo. |

## Fallas corregidas entre pasadas

- **F1** `docs/HERO-ANIMATION.md` rompía `tests/seguridad.test.ts` (A23: nada rastreado en `docs/`). → Movido a `HERO-ANIMATION.md` en la raíz.
- **F2** CLS 0.069 por `.aurora -inset-[10%]` (heredado de `main`). → Insets verticales en px.
- **F3** CLS 0.025 por el swap de fuente del H1 (3→4 líneas al cargar Bricolage Grotesque). → `@font-face 'Bricolage Fallback'` con `size-adjust`/overrides + `lg:min-h-[4.2em]`.
- **OBS-1** En 390 px el logo quedaba bajo el fold y la apertura no se veía. → Logo arriba del texto (136 px); logo, H1 y CTA caben en 844 px (CTA en 751–801).

## Observaciones abiertas (menores)

- Sin ScrollTrigger: con el plugin el JS subía a 45.7 KB; el pin es `position: sticky` y el scrub un timeline GSAP pausado que sigue al scroll con lerp.
- El tilt responde al cursor en todo el hero (6° en las esquinas, ~2° sobre el logo).
- Solo el CTA primario del hero lleva `.btn-check`; otros botones verdes (nav, CtaFinal) no.
- Los pasos de scroll son crossfade + escala, no un morph de un mismo elemento.
- En móvil con red lenta, el párrafo (Inter, sin fallback ajustado) podría generar un shift pequeño bajo el H1.
- Cambio visual sitio-wide: Nav, Footer y páginas legales usan el logo nuevo (con palomita).
