/**
 * Detalles de mouse del hero (docs/HERO-ANIMATION.md). Solo con
 * `(hover: hover) and (pointer: fine)`; en touch no existen.
 *
 * 1. Inclinación: `[data-hero-logo]` rota hacia el cursor (máx. TILT.maxGrados
 *    por eje) con lerp en requestAnimationFrame. La perspectiva la da su
 *    contenedor en Hero.astro. Desactivado con prefers-reduced-motion.
 * 2. `.btn-check`: se inyecta una palomita (misma forma que la capa `palomita`
 *    del logo) que se dibuja con stroke-dashoffset al hover. El CSS vive en
 *    global.css (.btn-check); el botón no cambia de tamaño.
 *
 * Tolera la ausencia de cualquiera de los elementos (no hace nada).
 */

export const TILT = {
  maxGrados: 6,
  /** Fracción del camino que avanza por frame (0–1). Más alto = más rígido. */
  suavizado: 0.12,
} as const;

const PALOMITA_D = 'M400 452 L531 583 L680 420';
const PALOMITA_VB = '364 384 352 236';
const SVG_NS = 'http://www.w3.org/2000/svg';

const punteroFino = window.matchMedia('(hover: hover) and (pointer: fine)');
const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');

function iniciarInclinacion() {
  const logo = document.querySelector<HTMLElement>('[data-hero-logo]');
  if (!logo || logo.dataset.tiltInit) return;
  logo.dataset.tiltInit = '1';
  const zona = logo.closest<HTMLElement>('section') ?? logo.parentElement ?? logo;

  let objetivoX = 0;
  let objetivoY = 0;
  let actualX = 0;
  let actualY = 0;
  let frame = 0;

  const pintar = () => {
    actualX += (objetivoX - actualX) * TILT.suavizado;
    actualY += (objetivoY - actualY) * TILT.suavizado;
    const quieto =
      Math.abs(objetivoX - actualX) < 0.01 && Math.abs(objetivoY - actualY) < 0.01;
    if (quieto) {
      actualX = objetivoX;
      actualY = objetivoY;
    }
    logo.style.transform =
      actualX === 0 && actualY === 0
        ? ''
        : `rotateX(${actualX.toFixed(2)}deg) rotateY(${actualY.toFixed(2)}deg)`;
    if (quieto) {
      frame = 0;
      if (objetivoX === 0 && objetivoY === 0) logo.style.willChange = '';
      return;
    }
    frame = requestAnimationFrame(pintar);
  };
  const pedirFrame = () => {
    if (!frame) {
      logo.style.willChange = 'transform';
      frame = requestAnimationFrame(pintar);
    }
  };

  // Se lee el rect una vez por entrada del cursor (no en cada pointermove)
  let rect: DOMRect | null = null;
  let zonaRect: DOMRect | null = null;

  zona.addEventListener('pointerenter', () => {
    rect = null;
  });
  zona.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || movimientoReducido.matches) return;
    if (!rect || !zonaRect) {
      rect = logo.getBoundingClientRect();
      zonaRect = zona.getBoundingClientRect();
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Normaliza contra la mitad del ancho/alto de la zona: -1…1
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (zonaRect.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (zonaRect.height / 2)));
    objetivoY = nx * TILT.maxGrados; // mover a la derecha gira sobre Y
    objetivoX = -ny * TILT.maxGrados; // mover abajo inclina hacia el cursor
    pedirFrame();
  });
  zona.addEventListener('pointerleave', () => {
    objetivoX = 0;
    objetivoY = 0;
    rect = null;
    zonaRect = null;
    pedirFrame();
  });
  // Scroll o resize invalidan las medidas
  const invalidar = () => {
    rect = null;
    zonaRect = null;
  };
  window.addEventListener('scroll', invalidar, { passive: true });
  window.addEventListener('resize', invalidar, { passive: true });
}

function iniciarBotonesCheck() {
  document.querySelectorAll<HTMLElement>('.btn-check').forEach((btn) => {
    if (btn.dataset.checkInit) return;
    btn.dataset.checkInit = '1';

    // Envuelve el texto en un span para poder desplazarlo con transform
    // (los nodos de texto no se transforman). Elementos hijos: solo la clase.
    btn.childNodes.forEach((nodo) => {
      if (nodo.nodeType === Node.TEXT_NODE && nodo.textContent?.trim()) {
        const span = document.createElement('span');
        span.className = 'btn-check-label';
        nodo.replaceWith(span);
        span.append(nodo);
      } else if (nodo instanceof HTMLElement || nodo instanceof SVGElement) {
        nodo.classList.add('btn-check-label');
      }
    });

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', PALOMITA_VB);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('btn-check-icon');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', PALOMITA_D);
    path.setAttribute('pathLength', '1');
    svg.append(path);
    btn.append(svg);
    btn.classList.add('btn-check-on');
  });
}

function arrancar() {
  if (!punteroFino.matches) return;
  iniciarBotonesCheck();
  if (!movimientoReducido.matches) iniciarInclinacion();
}

// Después del primer paint
requestAnimationFrame(() => setTimeout(arrancar, 0));
