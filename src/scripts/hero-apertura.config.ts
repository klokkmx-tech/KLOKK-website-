/**
 * Tiempos de la apertura del hero — ÚNICA fuente de verdad.
 *
 * Todo está en milisegundos desde que arranca la timeline (después del primer
 * paint). Los easings son strings de GSAP. Este archivo no toca el DOM: lo
 * importa Hero.astro en build (para el fade del texto) y hero-apertura.ts en
 * el navegador (para la timeline del logo).
 *
 * Secuencia (brief §3, total ≤ 1500 ms):
 *   0–400     fondo opacidad 0→1 · burbuja escala 0.6→1 desde la cola
 *   400–750   palo se dibuja de arriba a abajo
 *   700–1000  brazo se dibuja desde el cruce hacia afuera
 *   1000–1280 palomita se dibuja
 *   1280–1500 pop del logo completo a 1.04 y regreso elástico
 *   0–600     titular, párrafo y CTAs hacen fade-in en paralelo (CSS)
 */
export const APERTURA = {
  /** false = sin apertura: el logo se muestra completo y quieto. */
  habilitada: true,

  fondo: { inicio: 0, duracion: 400, ease: 'power1.out' },

  burbuja: {
    inicio: 0,
    duracion: 400,
    escalaInicial: 0.6,
    ease: 'back.out(1.4)',
    /** Origen de la escala en coordenadas del viewBox: la punta de la cola. */
    origen: '312 848',
  },

  /** Trazos de la K (stroke-dashoffset con getTotalLength() en runtime). */
  palo: { inicio: 400, duracion: 350, ease: 'power2.inOut' },
  brazo: { inicio: 700, duracion: 300, ease: 'power2.inOut' },
  palomita: { inicio: 1000, duracion: 280, ease: 'power2.out' },

  /** Pop del logo completo al terminar la palomita. */
  pop: {
    escala: 1.04,
    subida: 70,
    easeSubida: 'power2.out',
    regreso: 150,
    easeRegreso: 'elastic.out(1, 0.6)',
  },

  /** Fade-in del texto del hero (titular, párrafo, CTAs), en paralelo. */
  texto: { duracion: 600, desplazamientoPx: 8, opacidadInicial: 0.35 },

  /**
   * Si el script arranca más tarde que esto (red lenta), no se anima: el logo
   * aparece en su estado final. Coincide con la red de seguridad CSS de
   * Logo.astro (3 s).
   */
  limiteInicio: 2800,
} as const;

export type AperturaConfig = typeof APERTURA;
