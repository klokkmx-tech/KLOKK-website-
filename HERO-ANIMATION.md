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

Layout: en `lg` el logo va a la derecha (380 px); debajo de `lg` va arriba del texto, centrado y chico (136 px en móvil, 200 px en `sm`), para que la apertura ocurra dentro del primer viewport (390×844).

### Componente del logo

`src/components/Logo.astro` (SVG inline de `public/logo.svg`). Props: `class`, `size` (34), `id` (prefijo de ids de capa; sin `id` no se emiten ids), `animated` (false), `wordmark` (true), `decorative` (false), `svgClass`. Cada capa lleva `data-capa="fondo|burbuja|palo|brazo|palomita"`. En el hero va dentro de `[data-hero-logo]` (el elemento que reserva el espacio y que inclina `hero-mouse.ts`); el pop de la apertura se aplica al `<svg>`, no al contenedor.

Al terminar (o al saltarse), la apertura emite `klokk:apertura-fin` (burbujea desde el `<svg>`) y deja `data-apertura="fin"` en el `<svg>`.

## Cómo desactivar la apertura

- **Global:** `APERTURA.habilitada = false` en `src/scripts/hero-apertura.config.ts`. El logo se muestra completo y quieto (el script solo limpia el estado inicial).
- **Sin script ni estado oculto:** en `Hero.astro` quita la prop `animated` del `<Logo>` (o `animated={false}`). Las capas se renderizan visibles desde el HTML.
- Automático: con `prefers-reduced-motion: reduce` (CSS + `matchMedia`), sin JS (`<noscript>`), si el script arranca después de `APERTURA.limiteInicio` (2.8 s) o si nunca arranca (red de seguridad CSS a los 3 s en `Logo.astro`), el logo aparece en su estado final.

## Secuencia de scroll

Sección `#historia`, justo debajo del hero: un «Ya llegué» por WhatsApp → tarjeta de registro → documento con sello NOM-151. La palomita del logo se desprende de la K, cae en la insignia de cada paso y al final regresa; el logo se rearma junto al CTA de cierre (ancla a `#precios`, no al demo).

### Dónde vive

- **`src/components/ScrollHistoria.astro`** → markup, estilos y el array `pasos` (`tipo`, `titulo`, `texto`). Los mockups son `aria-hidden`; el texto de apoyo es legible. Datos ficticios (María López, 8:02 a.m., Mérida, Yuc.).
- **`src/scripts/hero-scroll.ts`** → objeto `TIEMPOS` (en «pantallas» de scroll: `intro`, `paso`, `salida`, y fracciones dentro de cada paso: entrada del visual, despegue/vuelo de la palomita, caída del sello, altura del arco, suavizado del scrub) y `MEDIA_SCRUB`.

### Modos

| Condición | Comportamiento |
|---|---|
| `(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)` | Sección fijada con scrub: la animación avanza con el scroll. |
| Móvil (< 1024 px), touch, o `prefers-reduced-motion: reduce` | Tres bloques apilados, reveal al entrar en viewport (`.reveal` de `Layout.astro`); la palomita de cada insignia se dibuja con CSS. Sin pin ni scrub. Con movimiento reducido todo aparece completo y quieto. |
| Sin JS | Bloques apilados, todo visible. |

El «pin» es CSS: la sección mide `(pasos + 2) × 100svh` y su contenido es `position: sticky`, así la altura está reservada desde el primer frame (cero CLS) y no hay pin-spacers. El scrub lo hace `hero-scroll.ts` con un timeline pausado de GSAP cuyo progreso sigue al scroll (lerp en rAF, listener activo solo mientras la sección está cerca del viewport). No se usa ScrollTrigger: con el pin en CSS no hacía falta y costaba ~18 KB gzip, que rompían el límite de 40 KB. El mismo media query vive en el CSS del componente y en `MEDIA_SCRUB`: si cambias uno, cambia el otro.

La palomita que vuela es una copia (`[data-historia-vuelo]`) encimada sobre la capa `palomita` del logo (que se oculta en modo scrub); sus destinos se miden con `offsetLeft/Top` (sin transforms) contra las insignias `[data-check-target]` y se recalculan en `resize`.

### Cómo agregar un cuarto paso

1. En `ScrollHistoria.astro`, agrega un objeto a `pasos`. Si reutiliza un `tipo` existente (`burbuja`, `tarjeta`, `documento`), no hay nada más que hacer.
2. Si es un visual nuevo: agrega el tipo a `TipoPaso` y su bloque `{paso.tipo === 'nuevo' && (…)}` junto a los otros mockups. Deja la insignia (`.paso-badge`) tal cual: es donde aterriza la palomita.
3. Elementos que deban «caer» sobre el visual: márcalos con `data-anim="sello"` (oculta su opacidad inicial en el CSS del modo scrub, como `.sello`).
4. La altura de la sección (`--pantallas`) y la duración del timeline se calculan solas con `pasos.length`. En pantallas ≥ 1024 px sin scrub la rejilla usa `--cols` (3 por defecto): con 4 pasos ponle `--cols:4` o `2` en el `style` de la sección.

### Detalles de mouse (`src/scripts/hero-mouse.ts`)

Solo con `(hover: hover) and (pointer: fine)`; en touch no se instala nada.

- **Inclinación del logo del hero:** `[data-hero-logo]` rota hacia el cursor, máx. `TILT.maxGrados` (6°) por eje, con lerp (`TILT.suavizado`) en rAF; al salir el cursor de la sección vuelve a 0. La perspectiva la pone su contenedor en `Hero.astro`. `will-change` solo mientras se mueve. Se omite con `prefers-reduced-motion`.
- **Palomita en botones `.btn-check`:** al cargar se inyecta un `<svg>` con la geometría de la capa `palomita` y el texto se envuelve en `.btn-check-label`. Al hover/focus el texto se corre `0.6em` con `transform` y la palomita se dibuja con `stroke-dashoffset` en 250 ms (CSS en `global.css`, junto a `.btn-press`). El botón no cambia de tamaño.

Cómo desactivarlos:
- Inclinación: quita `data-hero-logo` del contenedor en `Hero.astro`, o pon `TILT.maxGrados = 0`.
- Palomita en un botón: quítale la clase `btn-check`. Para todos: quita el `<script src="../scripts/hero-mouse.ts">` de `Hero.astro` (también apaga la inclinación).
- Secuencia de scroll completa: quita `<ScrollHistoria />` de `src/pages/index.astro`. Para dejarla siempre apilada (sin scrub), cambia `MEDIA_SCRUB` y el `@media` equivalente del componente por una condición que nunca se cumpla.
