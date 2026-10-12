# Animación del hero

## Dónde viven los tiempos

Apertura del logo (≤ 1500 ms, una vez al cargar):

- **`src/scripts/hero-apertura.config.ts`** → objeto `APERTURA`. Es la única fuente de tiempos: inicio y duración de cada capa (ms), easings de GSAP, escala inicial de la burbuja y su origen (punta de la cola, en coordenadas del viewBox), el pop final (escala 1.04, subida y regreso elástico) y el fade-in del texto del hero (`texto.duracion`, 600 ms).
- `src/scripts/hero-apertura.ts` re-exporta `APERTURA` y monta la timeline de GSAP después del primer paint. Las longitudes de los trazos se miden en runtime con `getTotalLength()`.
- `src/components/Hero.astro` importa `APERTURA` en build y pasa `texto.*` como variables CSS (`--hero-in-dur`, `--hero-in-y`, `--hero-in-from`) a la clase `.hero-in`. Cambiar el fade del texto = cambiar el config, no el CSS.

Secuencia por defecto:

| ms | Qué | Easing |
|---|---|---|
| 0–400 | `fondo` opacidad; `burbuja` escala 0.6 → 1 desde la cola | power1.out / back.out(1.4) |
| 400–750 | `palo` | power2.inOut |
| 700–1000 | `brazo` | power2.inOut |
| 1000–1280 | `palomita` | power2.out |
| 1280–1500 | pop del logo a 1.04 y regreso | power2.out → elastic.out(1, 0.6) |
| 0–600 | titular, párrafo y CTAs (CSS, en paralelo, sin delays; arrancan en opacidad 0.6 para leerse desde el frame 0) | ease-out |

Layout: el logo grande y su apertura existen **solo en escritorio (`lg`, ≥ 1024 px)**: logo de 380 px a la derecha, apertura y tilt. Debajo de `lg` el contenedor lleva `hidden lg:flex` (no reserva espacio) para que el CTA «Probar el demo en WhatsApp» quede sobre el pliegue incluso con las barras del navegador (objetivo: 390×664 y 360×670). En móvil el texto conserva su fade-in (`.hero-in`). `hero-apertura.ts` comprueba si el `<svg>` está visible (`getClientRects()`); si no, deja el logo en estado final sin cargar GSAP (que se importa con `import()` dinámico solo cuando se va a animar).

**Reactivar el logo en móvil:** en `Hero.astro` cambia `hidden ... lg:flex` del contenedor por `flex justify-center` y dale un ancho responsivo a `[data-hero-logo]` (p. ej. `w-[136px] lg:w-[380px]`, con `order-first lg:order-none` para ponerlo arriba del texto). La apertura correrá sola al estar visible. Ojo: el logo arriba empuja el CTA bajo el pliegue en celulares reales.


### Componente del logo

`src/components/Logo.astro` (SVG inline de `public/logo.svg`). Props: `class`, `size` (34), `id` (prefijo de ids de capa; sin `id` no se emiten ids), `animated` (false), `wordmark` (true), `decorative` (false), `svgClass`. Cada capa lleva `data-capa="fondo|burbuja|palo|brazo|palomita"`. En el hero va dentro de `[data-hero-logo]` (el elemento que reserva el espacio y que inclina `hero-mouse.ts`); el pop de la apertura se aplica al `<svg>`, no al contenedor.

Al terminar (o al saltarse), la apertura emite `klokk:apertura-fin` (burbujea desde el `<svg>`) y deja `data-apertura="fin"` en el `<svg>`.

## Cómo desactivar la apertura

- **Global:** `APERTURA.habilitada = false` en `src/scripts/hero-apertura.config.ts`. El logo se muestra completo y quieto (el script solo limpia el estado inicial).
- **Sin script ni estado oculto:** en `Hero.astro` quita la prop `animated` del `<Logo>` (o `animated={false}`). Las capas se renderizan visibles desde el HTML.
- Automático: debajo de `lg` (logo oculto), con `prefers-reduced-motion: reduce` (CSS + `matchMedia`), sin JS (`<noscript>`), si el script arranca después de `APERTURA.limiteInicio` (2.8 s) o si nunca arranca (red de seguridad CSS a los 3 s en `Logo.astro`), el logo aparece en su estado final.

## Secuencia de scroll

Sección `#historia`, justo debajo del hero: un «Entrada» por WhatsApp → tarjeta de registro (hora y coordenadas) → documento «Registro de asistencia · Cierre del día». La palomita del logo se desprende de la K, cae en la insignia de cada paso y al final regresa; el logo se rearma junto al CTA de cierre: «Probar el demo en WhatsApp» (`LINKS.demoWhatsApp`, la misma URL que el hero; el test A27 exige que todas las ligas `?text=Entrada` sean idénticas) y una liga de texto «Ver planes y precios» a `#precios`.

**Paso 3 (copy cuidado):** el sello NOM-151 cae sobre el renglón «Cierre del día», no sobre una persona: la constancia cubre el registro completo del día y cada entrada conserva la prueba de que forma parte de ese cierre. El texto no promete validez legal. Secuencia en escritorio (fracciones de `TIEMPOS.paso`): `fila` (la tarjeta de María entra como fila resaltada del documento) → `cierre` (aparece el renglón del cierre) → `sello` (cae sobre el cierre) → `marca` (la fila de María recibe «Incluida»). En móvil el documento aparece completo con el reveal.

### Dónde vive

- **`src/components/ScrollHistoria.astro`** → markup, estilos y el array `pasos` (`tipo`, `titulo`, `texto`). Los mockups son `aria-hidden`; el texto de apoyo es legible. Datos ficticios (María López, 8:02 a.m., Mérida, Yuc.).
- **`src/scripts/hero-scroll.ts`** → objeto `TIEMPOS` (en «pantallas» de scroll: `intro`, `paso`, `salida`, y fracciones dentro de cada paso: entrada del visual, despegue/vuelo de la palomita, `fila`/`cierre`/`sello`/`marca` del paso 3, altura del arco, suavizado del scrub) y `MEDIA_SCRUB`. Valores actuales: `intro 0.5`, `paso 0.75`, `salida 0.5` → 3.25 pantallas de scrub (antes 4.5). Si los cambias, cambia también `TIEMPOS_SCROLL` en `ScrollHistoria.astro` (de ahí sale la altura de la sección).

### Modos

| Condición | Comportamiento |
|---|---|
| `(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)` | Sección fijada con scrub: la animación avanza con el scroll. |
| Móvil (< 1024 px), touch, o `prefers-reduced-motion: reduce` | Tres bloques apilados, reveal al entrar en viewport (`.reveal` de `Layout.astro`); la palomita de cada insignia se dibuja con CSS. Sin pin ni scrub. Con movimiento reducido todo aparece completo y quieto. |
| Sin JS | Bloques apilados, todo visible. |

El «pin» es CSS: la sección mide `(intro + pasos·paso + salida) × 100svh + 55svh` (el scrub arranca con el tope de la sección al 45 % del viewport) y su contenido es `position: sticky`, así la altura está reservada desde el primer frame (cero CLS) y no hay pin-spacers. El scrub lo hace `hero-scroll.ts` con un timeline pausado de GSAP cuyo progreso sigue al scroll (lerp en rAF, listener activo solo mientras la sección está cerca del viewport). No se usa ScrollTrigger: con el pin en CSS no hacía falta y costaba ~18 KB gzip, que rompían el límite de 40 KB. El mismo media query vive en el CSS del componente y en `MEDIA_SCRUB`: si cambias uno, cambia el otro.

La palomita que vuela es una copia (`[data-historia-vuelo]`) encimada sobre la capa `palomita` del logo (que se oculta en modo scrub); sus destinos se miden con `offsetLeft/Top` (sin transforms) contra las insignias `[data-check-target]` y se recalculan en `resize`.

### Cómo agregar un cuarto paso

1. En `ScrollHistoria.astro`, agrega un objeto a `pasos`. Si reutiliza un `tipo` existente (`burbuja`, `tarjeta`, `documento`), no hay nada más que hacer.
2. Si es un visual nuevo: agrega el tipo a `TipoPaso` y su bloque `{paso.tipo === 'nuevo' && (…)}` junto a los otros mockups. Deja la insignia (`.paso-badge`) tal cual: es donde aterriza la palomita.
3. Sub-animaciones dentro del visual: márcalas con `data-anim="fila|cierre|sello|marca"`. En modo scrub todo `[data-anim]` arranca oculto por CSS y `hero-scroll.ts` lo revela en el momento que marca `TIEMPOS`; para un nombre nuevo agrega su línea `sub('nombre', …)` y su fracción en `TIEMPOS`.
4. La altura de la sección (`--pantallas`) y la duración del timeline se calculan solas con `pasos.length`. En pantallas ≥ 1024 px sin scrub la rejilla usa `--cols` (3 por defecto): con 4 pasos ponle `--cols:4` o `2` en el `style` de la sección.

### Detalles de mouse (`src/scripts/hero-mouse.ts`)

Solo con `(hover: hover) and (pointer: fine)`; en touch no se instala nada.

- **Inclinación del logo del hero:** `[data-hero-logo]` rota hacia el cursor, máx. `TILT.maxGrados` (6°) por eje, con lerp (`TILT.suavizado`) en rAF; al salir el cursor de la sección vuelve a 0. La perspectiva la pone su contenedor en `Hero.astro`. `will-change` solo mientras se mueve. Se omite con `prefers-reduced-motion`.
- **Palomita en botones `.btn-check`:** al cargar se inyecta un `<svg>` con la geometría de la capa `palomita` y el texto se envuelve en `.btn-check-label`. Al hover/focus el texto se corre `0.6em` con `transform` y la palomita se dibuja con `stroke-dashoffset` en 250 ms (CSS en `global.css`, junto a `.btn-press`). El botón no cambia de tamaño.

Cómo desactivarlos:
- Inclinación: quita `data-hero-logo` del contenedor en `Hero.astro`, o pon `TILT.maxGrados = 0`.
- Palomita en un botón: quítale la clase `btn-check`. Para todos: quita el `<script src="../scripts/hero-mouse.ts">` de `Hero.astro` (también apaga la inclinación).
- Secuencia de scroll completa: quita `<ScrollHistoria />` de `src/pages/index.astro`. Para dejarla siempre apilada (sin scrub), cambia `MEDIA_SCRUB` y el `@media` equivalente del componente por una condición que nunca se cumpla.
