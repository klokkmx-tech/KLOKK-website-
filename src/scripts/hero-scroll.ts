/**
 * Secuencia de scroll de ScrollHistoria.astro (HERO-ANIMATION.md).
 *
 * Solo en escritorio con mouse y sin movimiento reducido: un timeline de GSAP
 * atado al scroll (scrub). El «pin» lo hace CSS (position: sticky dentro de una
 * sección de N pantallas), así la altura está reservada desde el primer frame
 * y no hay pin-spacers. Como el pin ya es CSS, el scrub lo hace este archivo
 * (progreso = posición de scroll, suavizado con lerp en rAF) en vez de
 * ScrollTrigger: ahorra ~18 KB gzip y deja el JS total bajo 40 KB.
 * En móvil/touch/movimiento reducido no hace nada: los pasos se apilan con
 * `.reveal`.
 *
 * Anima solo transform, opacity (autoAlpha) y stroke-dashoffset.
 */
// GSAP se carga con import() dinámico y SOLO si aplica el modo scrub de
// escritorio: en móvil/touch/movimiento reducido no se descarga el chunk.
let gsap: typeof import('gsap').default;

/** Debe coincidir con el @media del modo scrub en ScrollHistoria.astro. */
export const MEDIA_SCRUB =
  '(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/**
 * Tiempos en «pantallas» de scroll (1 = 100vh). Total = intro + pasos·paso + salida.
 * Las fracciones de `paso` reparten qué ocurre dentro de cada paso.
 */
export const TIEMPOS = {
  intro: 0.5,
  paso: 0.75, // si cambias intro/paso/salida, cambia TIEMPOS_SCROLL en ScrollHistoria.astro
  salida: 0.5,
  // dentro de cada paso (fracción de TIEMPOS.paso)
  entraVisual: 0, // la tarjeta/burbuja entra
  duraVisual: 0.35,
  saleVisual: 0.3, // duración de la salida del paso anterior
  despegaPalomita: 0.15, // la palomita sale de la K (o del paso anterior)
  duraPalomita: 0.35, // vuelo hasta la insignia del paso
  // Sub-animaciones de un visual, por atributo data-anim (paso 3: el documento).
  // Orden: entra la fila de María → aparece el cierre del día → cae el sello
  // sobre el cierre → la fila de María se marca «Incluida».
  fila: 0.12,
  cierre: 0.3,
  sello: 0.45,
  marca: 0.68,
  duraSello: 0.2,
  /** Altura extra del arco que hace la palomita al saltar (px). */
  arco: 70,
  /** Inicio del scrub: cuando el tope de la sección cruza esta fracción del viewport. */
  inicioViewport: 0.45,
  /** Suavizado del scrub (fracción por frame, 0–1). 1 = sin suavizado. */
  scrub: 0.14,
} as const;

interface Punto {
  x: number;
  y: number;
  s: number;
}

/** Offset de `el` relativo a `ancestro` sin transforms (offsetLeft/Top). */
function offsetDentro(el: HTMLElement, ancestro: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== ancestro) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function iniciar(seccion: HTMLElement) {
  if (seccion.dataset.historiaInit) return;
  seccion.dataset.historiaInit = '1';

  const grid = seccion.querySelector<HTMLElement>('[data-historia-grid]');
  const logo = seccion.querySelector<HTMLElement>('[data-historia-logo]');
  const vuelo = seccion.querySelector<SVGElement>('[data-historia-vuelo]');
  const cierre = seccion.querySelector<HTMLElement>('[data-historia-cierre]');
  const visuales = gsap.utils.toArray<HTMLElement>('[data-paso-visual]', seccion);
  const textos = gsap.utils.toArray<HTMLElement>('[data-paso-texto]', seccion);
  if (!grid || !logo || !vuelo || !cierre || !visuales.length) return;

  const capaPalomita = logo.querySelector('[data-capa="palomita"]');
  const mm = gsap.matchMedia();

  mm.add(MEDIA_SCRUB, () => {
    // Las capas del logo existen: la copia que vuela suplanta a la palomita
    // real (CSS ya la oculta). Si no existen, la copia solo aparece al volar.
    if (!capaPalomita) gsap.set(vuelo, { autoAlpha: 0 });

    // ── Medidas (se recalculan en resize) ──
    let destinos: Punto[] = [];
    let centroLogo = { y: 0 };
    const medir = () => {
      const L = logo.offsetWidth;
      const home = offsetDentro(logo, grid);
      const hx = home.x + (L * 476) / 896; // centro de la palomita en el viewBox
      const hy = home.y + (L * 438) / 896;
      const anchoPalomita = (L * 352) / 896;
      destinos = visuales.map((v) => {
        const badge = v.querySelector<HTMLElement>('[data-check-target]');
        const check = badge?.querySelector('svg');
        if (!badge) return { x: 0, y: 0, s: 1 };
        const b = offsetDentro(badge, grid);
        const anchoCheck = check ? parseFloat(getComputedStyle(check).width) || 30 : 30;
        return {
          x: b.x + badge.offsetWidth / 2 - hx,
          y: b.y + badge.offsetHeight / 2 - hy,
          s: anchoCheck / anchoPalomita,
        };
      });
      // Al final el logo baja al centro del área de los visuales
      const v0 = offsetDentro(visuales[0], grid);
      const centroArea = v0.y + (grid.clientHeight - v0.y) / 2;
      centroLogo = { y: centroArea - (home.y + L / 2) };
    };
    medir();

    const T = TIEMPOS;
    const P = T.paso;
    const n = visuales.length;
    const total = T.intro + n * P + T.salida;
    const animados = [logo, vuelo, ...visuales, ...textos, cierre];

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

    // Intro: el texto del paso 1 aparece mientras la sección llega al tope
    tl.set({}, {}, total); // fija la duración total del timeline

    visuales.forEach((visual, i) => {
      const t0 = T.intro + i * P;
      const texto = textos[i];
      const d = (k: keyof Punto) => () => destinos[i]?.[k] ?? 0;

      // Sale el paso anterior
      if (i > 0) {
        tl.to(visuales[i - 1], { autoAlpha: 0, y: 28, scale: 0.94, duration: T.saleVisual * P, ease: 'power2.in' }, t0);
        if (textos[i - 1]) tl.to(textos[i - 1], { autoAlpha: 0, y: -16, duration: T.saleVisual * P, ease: 'power2.in' }, t0);
      }

      // Entra el visual: baja desde arriba (la burbuja «cae» al chat)
      tl.fromTo(
        visual,
        { autoAlpha: 0, y: -56, scale: 0.92 },
        { autoAlpha: 1, y: 0, scale: 1, duration: T.duraVisual * P, ease: 'back.out(1.4)' },
        t0 + T.entraVisual * P + (i > 0 ? T.saleVisual * P * 0.6 : 0),
      );
      if (texto) {
        tl.fromTo(
          texto,
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: T.duraVisual * P },
          t0 + (i > 0 ? T.saleVisual * P * 0.6 : -T.intro * 0.6),
        );
      }

      // Sub-animaciones del visual (data-anim), en el orden de TIEMPOS
      const sub = (nombre: string, desde: gsap.TweenVars, hasta: gsap.TweenVars, en: number) =>
        visual.querySelectorAll(`[data-anim="${nombre}"]`).forEach((el) => {
          tl.fromTo(el, { autoAlpha: 0, ...desde }, { autoAlpha: 1, ...hasta }, t0 + en * P);
        });
      // La tarjeta del paso anterior «aterriza» como fila del documento
      sub('fila', { y: -26, scale: 1.06 }, { y: 0, scale: 1, duration: 0.2 * P }, T.fila);
      sub('cierre', { y: 10 }, { y: 0, duration: 0.15 * P }, T.cierre);
      sub(
        'sello',
        { scale: 1.9, rotation: -22 },
        { scale: 1, rotation: -8, duration: T.duraSello * P, ease: 'back.out(2)' },
        T.sello,
      );
      sub('marca', { scale: 0.6, x: -6 }, { scale: 1, x: 0, duration: 0.12 * P, ease: 'back.out(2)' }, T.marca);

      // La palomita: despega (de la K o del paso anterior), hace un arco y
      // aterriza en la insignia del paso
      const tv = t0 + T.despegaPalomita * P;
      const dur = T.duraPalomita * P;
      if (i === 0 && !capaPalomita) tl.to(vuelo, { autoAlpha: 1, duration: 0.05 }, tv);
      tl.to(vuelo, { x: d('x'), scale: d('s'), duration: dur, ease: 'power1.inOut' }, tv);
      tl.to(
        vuelo,
        {
          y: () => Math.min(i > 0 ? (destinos[i - 1]?.y ?? 0) : 0, destinos[i]?.y ?? 0) - T.arco,
          duration: dur * 0.4,
          ease: 'power2.out',
        },
        tv,
      );
      tl.to(vuelo, { y: d('y'), duration: dur * 0.6, ease: 'power2.in' }, tv + dur * 0.4);
    });

    // Salida: el último paso se va, la palomita regresa a la K y el logo se
    // rearma completo junto al CTA de cierre.
    const ts = T.intro + n * P;
    const ultimo = visuales[n - 1];
    const S = T.salida;
    tl.to(ultimo, { autoAlpha: 0, scale: 0.9, duration: 0.3 * S, ease: 'power2.in' }, ts);
    if (textos[n - 1]) tl.to(textos[n - 1], { autoAlpha: 0, y: -16, duration: 0.3 * S, ease: 'power2.in' }, ts);
    tl.to(vuelo, { x: 0, y: 0, scale: 1, duration: 0.35 * S, ease: 'power2.inOut' }, ts + 0.1 * S);
    if (!capaPalomita) tl.to(vuelo, { autoAlpha: 0, duration: 0.05 * S }, ts + 0.45 * S);
    tl.to(logo, { y: () => centroLogo.y, scale: 1.6, duration: 0.35 * S, ease: 'power2.inOut' }, ts + 0.45 * S);
    tl.fromTo(cierre, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.3 * S }, ts + 0.55 * S);

    // ── Scrub: progreso del timeline = posición de scroll dentro de la sección ──
    let inicio = 0;
    let recorrido = 1;
    let objetivo = 0;
    let actual = 0;
    let frame = 0;
    let activo = false;
    const medirScroll = () => {
      const top = seccion.getBoundingClientRect().top + window.scrollY;
      const vh = window.innerHeight;
      inicio = top - vh * T.inicioViewport;
      recorrido = Math.max(1, top + seccion.offsetHeight - vh - inicio);
    };
    const leerScroll = () => {
      objetivo = gsap.utils.clamp(0, 1, (window.scrollY - inicio) / recorrido);
    };
    const pintar = () => {
      actual += (objetivo - actual) * T.scrub;
      if (Math.abs(objetivo - actual) < 0.0005) actual = objetivo;
      tl.progress(actual);
      frame = actual === objetivo ? 0 : requestAnimationFrame(pintar);
    };
    const onScroll = () => {
      leerScroll();
      if (!frame) frame = requestAnimationFrame(pintar);
    };
    const onResize = () => {
      medir();
      medirScroll();
      const p = tl.progress();
      tl.progress(0).invalidate().progress(p); // re-evalúa los valores-función (destinos)
      onScroll();
    };
    // Solo escucha el scroll mientras la sección está cerca del viewport;
    // will-change vive exactamente ese tiempo.
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting === activo) return;
        activo = entrada.isIntersecting;
        gsap.set(animados, { willChange: activo ? 'transform, opacity' : 'auto' });
        if (activo) {
          window.addEventListener('scroll', onScroll, { passive: true });
          onScroll();
        } else {
          window.removeEventListener('scroll', onScroll);
          onScroll(); // termina de asentar el estado (inicio o final)
        }
      },
      { rootMargin: '50% 0px' },
    );
    medirScroll();
    leerScroll();
    actual = objetivo;
    tl.progress(actual);
    io.observe(seccion);
    window.addEventListener('resize', onResize, { passive: true });
    // Las fuentes web cambian alturas del documento: recalcula al cargarlas
    document.fonts?.ready.then(onResize);
    window.addEventListener('load', onResize, { once: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('load', onResize);
      cancelAnimationFrame(frame);
      tl.kill();
      gsap.set(animados, { clearProps: 'all' });
      seccion.querySelectorAll('[data-anim]').forEach((el) => gsap.set(el, { clearProps: 'all' }));
    };
  });
}

function arrancar() {
  const secciones = document.querySelectorAll<HTMLElement>('[data-historia]');
  if (!secciones.length) return;
  const mq = window.matchMedia(MEDIA_SCRUB);
  const cargar = async () => {
    if (!mq.matches) return;
    mq.removeEventListener('change', cargar);
    gsap = (await import('gsap')).default;
    secciones.forEach(iniciar);
  };
  // Si la ventana entra al modo escritorio después (resize), se carga entonces.
  if (mq.matches) void cargar();
  else mq.addEventListener('change', cargar);
}

// Después del primer paint: no compite con la apertura del hero.
requestAnimationFrame(() => setTimeout(arrancar, 0));
