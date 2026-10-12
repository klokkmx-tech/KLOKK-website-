# Reporte de QA — animación del hero (`feat/hero-animation`)

QA independiente con Playwright 1.58 + Chromium headless-shell 1208 sobre el build estático (`.vercel/output/static`). Cinco pasadas: `d8980c2` → `af722ba` → `fccda53` → `0f3e47e` → `d7d4701` (final).

## Correcciones del memo ANIM-WEB-01 (@ `d7d4701`)

| Criterio del memo | Resultado | Evidencia |
|---|---|---|
| A 390×664 y 360×670 el botón «Probar el demo en WhatsApp» se ve completo sin scroll | CUMPLE | CTA en 555–605 px en ambos (H1 160–335). Sin logo grande en el hero bajo `lg` (`display:none`); el móvil no descarga gsap. |
| En el HTML no aparecen «ya llegué», «válida», «ante la STPS», «en una audiencia»; la burbuja dice «Entrada» | CUMPLE (con nota) | 0 / 0 / 0 coincidencias de las tres primeras. «en una audiencia» aparece 1 vez, en `Faq.astro:5` (texto previo al PR, fuera del alcance); ninguna viene de ScrollHistoria. Burbuja «Entrada». |
| El sello cae sobre el cierre del día y la fila de María queda marcada | CUMPLE | Orden en desktop (scrub): fila de María → renglón «Cierre del día» → sello (y 647–708 sobre el cierre 639–667, lejos de la fila 535–563) → marca «Incluida» en la fila. Igual en móvil. |
| CLS del hero 0 y JS ≤ 40 KB gzip | CUMPLE | CLS **0** en 1440×900 (×3, también con reduced-motion y con woff2 bloqueadas), 390×664 y 360×670 (fallbacks con métricas para Bricolage e Inter). JS escritorio **31.5 KB**; móvil **≈5.2 KB** sin gsap (import dinámico, sin modulepreload). |
| Build, `astro check` y pruebas en verde con A27 actualizada | CUMPLE | Build OK; 0/0/0; 149/149. A27 ahora exige ≥1 liga `?text=Entrada` y que todas apunten a la misma URL (hay 2, ambas al demo). |
| Desktop sin regresión | CUMPLE | Apertura completa a 1500 ms; tilt y palomita del botón funcionan; `#historia` sticky, ahora 2510 px de pin (antes ~3570; `paso` 0.75, `salida` 0.5). |

Observación: el sello sobresale ~17–20 px del borde inferior del documento (parece intencional, pero en móvil queda cerca de la etiqueta «Paso 3»).

---

## Pasadas 1–3 (brief original)

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
