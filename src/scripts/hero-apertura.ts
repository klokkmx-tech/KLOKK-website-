/**
 * Apertura del hero: el logo de Klokk llega como un mensaje y la K se dibuja.
 *
 * - Tiempos/easings: APERTURA en ./hero-apertura.config.ts (re-exportado aquí).
 * - Se monta después del primer paint (doble requestAnimationFrame).
 * - Solo anima opacity, transform y stroke-dashoffset. `will-change` se pone
 *   al arrancar y se quita al terminar.
 * - prefers-reduced-motion, APERTURA.habilitada=false o arranque tardío →
 *   estado final inmediato.
 * - Solo corre si el logo está visible: debajo de `lg` el contenedor del
 *   logo está oculto (display:none) y la apertura se salta sin cargar GSAP;
 *   el logo queda en estado final por si la ventana se agranda después.
 * - GSAP se carga con import() dinámico solo cuando de verdad se va a animar.
 * - Idempotente: marca `data-apertura` en el <svg> (también apaga la red de
 *   seguridad CSS de Logo.astro).
 */
import { APERTURA } from './hero-apertura.config';

type Gsap = typeof import('gsap').default;

export { APERTURA };

type Capa = 'fondo' | 'burbuja' | 'palo' | 'brazo' | 'palomita';

const SELECTOR = '[data-hero-logo] [data-klokk-logo][data-animated]';
const s = (ms: number) => ms / 1000;

function capas(svg: SVGSVGElement) {
  const q = (c: Capa) => svg.querySelector<SVGGraphicsElement>(`[data-capa="${c}"]`);
  const fondo = q('fondo');
  const burbuja = q('burbuja');
  const palo = q('palo') as SVGPathElement | null;
  const brazo = q('brazo') as SVGPathElement | null;
  const palomita = q('palomita') as SVGPathElement | null;
  if (!fondo || !burbuja || !palo || !brazo || !palomita) return null;
  return { fondo, burbuja, palo, brazo, palomita };
}

/** Deja el logo completo, sin estilos de animación (no requiere GSAP). */
function estadoFinal(svg: SVGSVGElement, gsap?: Gsap) {
  svg.dataset.apertura = 'fin';
  const todas = svg.querySelectorAll<SVGElement>('[data-capa]');
  if (gsap) {
    gsap.set(todas, {
      clearProps: 'opacity,transform,strokeDasharray,strokeDashoffset,willChange',
    });
    gsap.set(svg, { clearProps: 'transform,willChange' });
  }
  for (const el of todas) {
    for (const prop of ['opacity', 'stroke-dasharray', 'stroke-dashoffset', 'will-change']) {
      el.style.removeProperty(prop);
    }
  }
  // Aviso para otros scripts (p. ej. hero-mouse) de que el logo ya está quieto.
  svg.dispatchEvent(new CustomEvent('klokk:apertura-fin', { bubbles: true }));
}

function animar(svg: SVGSVGElement, gsap: Gsap) {
  const c = capas(svg);
  if (!c) return estadoFinal(svg, gsap);
  svg.dataset.apertura = 'corriendo';

  const { fondo, burbuja, palo, brazo, palomita } = c;
  const trazos = [palo, brazo, palomita];
  const A = APERTURA;

  // Dashes medidos en runtime: la línea arranca totalmente "sin tinta".
  for (const p of trazos) {
    const largo = p.getTotalLength();
    gsap.set(p, { strokeDasharray: `${largo} ${largo + 1}`, strokeDashoffset: largo });
  }
  gsap.set(burbuja, { svgOrigin: A.burbuja.origen, scale: A.burbuja.escalaInicial });
  gsap.set([fondo, burbuja, ...trazos, svg], { willChange: 'transform, opacity' });

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set([fondo, burbuja, ...trazos, svg], { clearProps: 'willChange' });
      // Sin restos inline: el logo queda como si nunca se hubiera animado.
      estadoFinal(svg, gsap);
    },
  });

  // 0–400: fondo + burbuja (la opacidad de la burbuja entra antes que la escala).
  tl.fromTo(fondo, { opacity: 0 }, { opacity: 1, duration: s(A.fondo.duracion), ease: A.fondo.ease }, s(A.fondo.inicio));
  tl.to(burbuja, { opacity: 1, duration: s(A.burbuja.duracion * 0.4), ease: 'none' }, s(A.burbuja.inicio));
  tl.to(
    burbuja,
    { scale: 1, duration: s(A.burbuja.duracion), ease: A.burbuja.ease },
    s(A.burbuja.inicio),
  );

  // Trazos de la K: visibles justo al empezar a dibujarse (evita el punto del
  // linecap round en el frame 0).
  const trazo = (p: SVGPathElement, cfg: { inicio: number; duracion: number; ease: string }) => {
    tl.set(p, { opacity: 1 }, s(cfg.inicio));
    tl.to(p, { strokeDashoffset: 0, duration: s(cfg.duracion), ease: cfg.ease }, s(cfg.inicio));
  };
  trazo(palo, A.palo);
  trazo(brazo, A.brazo);
  trazo(palomita, A.palomita);

  // Pop del logo completo al cerrar la palomita.
  const finPalomita = s(A.palomita.inicio + A.palomita.duracion);
  tl.to(
    svg,
    { scale: A.pop.escala, transformOrigin: '50% 50%', duration: s(A.pop.subida), ease: A.pop.easeSubida },
    finPalomita,
  );
  tl.to(svg, { scale: 1, duration: s(A.pop.regreso), ease: A.pop.easeRegreso });
}

const debeSaltarse = () =>
  !APERTURA.habilitada ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  performance.now() > APERTURA.limiteInicio;

async function iniciar(svg: SVGSVGElement) {
  if (svg.dataset.apertura) return; // ya corrió (o está corriendo)
  // Oculto (contenedor `hidden` debajo de lg): no se gasta nada en animarlo.
  const visible = svg.getClientRects().length > 0;
  if (!visible || debeSaltarse()) return estadoFinal(svg);
  svg.dataset.apertura = 'cargando'; // apaga la red de seguridad CSS
  try {
    const { default: gsap } = await import('gsap');
    // Si la descarga tardó demasiado, mejor mostrar el logo ya completo.
    if (debeSaltarse()) return estadoFinal(svg, gsap);
    animar(svg, gsap);
  } catch {
    estadoFinal(svg);
  }
}

function montar() {
  document.querySelectorAll<SVGSVGElement>(SELECTOR).forEach(iniciar);
}

// Después del primer paint: el segundo rAF corre ya con el frame pintado.
requestAnimationFrame(() => requestAnimationFrame(montar));
// Por si el sitio adopta <ClientRouter /> (view transitions); idempotente.
document.addEventListener('astro:page-load', montar);
