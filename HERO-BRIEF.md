# HERO-BRIEF — Animación de apertura y scroll del hero de Klokk

Eres el orquestador de este trabajo. Tu modelo es Fable 5.1. No escribas el código tú: tu trabajo es leer este brief, inspeccionar el repo, repartir el trabajo entre subagentes y verificar el resultado. Cada subagente que lances debe correr con `model: "opus"` (Opus 5.5).

Stack, estructura y convenciones del repo mandan. Nada en este brief asume un framework; el primer paso es descubrirlo.

---

## 1. Qué vamos a construir

Un solo momento estrella en el hero de la landing de Klokk, en tres partes:

**A. Apertura (1.5 s, al cargar, sin clic).**
El logo de Klokk aparece como un mensaje que llega y una K que se dibuja.

**B. Secuencia de scroll (tres pasos).**
Un mensaje de WhatsApp se convierte en evidencia legal. La palomita del logo cae en cada paso.

**C. Detalles de mouse (solo desktop).**
La burbuja se inclina un poco hacia el cursor. Los botones dibujan la palomita al pasar el mouse.

Fuera de alcance: cualquier video, cualquier generación con IA, cualquier cambio fuera del hero y del componente del logo. El checador explotando (fase 2, Higgsfield) NO va en este trabajo.

---

## 2. El logo

Archivo: `klokk-logo.svg` (viewBox 0 0 1024 1024). Tiene cinco capas con id:

| id | Qué es | Cómo se anima |
|---|---|---|
| `fondo` | cuadro verde redondeado | opacidad |
| `burbuja` | burbuja blanca con cola | escala + opacidad |
| `palo` | trazo vertical de la K | stroke-dashoffset |
| `brazo` | trazo superior derecho de la K | stroke-dashoffset |
| `palomita` | trazo inferior que termina en check | stroke-dashoffset |

Los tres trazos de la K son `<path>` con `stroke-width="72"`, `stroke-linecap="round"`, `fill="none"`. Están dibujados en el orden en que se "escriben": palo de arriba a abajo, brazo del cruce hacia arriba-derecha, palomita del cruce hacia abajo y luego hacia arriba-derecha.

Colores: verde `#4AB378`, blanco `#EDF1F5`. No los cambies.

El SVG se usa **inline** en el DOM (no `<img>`), para que los ids sean accesibles al script. Guarda también una copia en la carpeta de estáticos del proyecto para favicon/OG si no existe.

Para los dashes usa `path.getTotalLength()` en runtime; no hardcodees longitudes.

---

## 3. Apertura — especificación

Duración total: ≤ 1500 ms. Corre una vez al cargar la página. Sin pantalla de entrada, sin clic, sin bloquear el scroll.

| Tiempo | Qué pasa | Easing |
|---|---|---|
| 0–400 ms | `fondo` aparece (opacidad). `burbuja` entra desde escala 0.6 con origen en la cola (abajo-izquierda), hasta 1.0 con un rebote chico | back.out(1.4) |
| 400–750 ms | `palo` se dibuja de arriba a abajo | power2.inOut |
| 700–1000 ms | `brazo` se dibuja desde el cruce hacia afuera | power2.inOut |
| 1000–1450 ms | `palomita` se dibuja; al terminar, el logo completo hace un pop a escala 1.04 y regresa | power2.out → elastic suave |

Reglas que no se negocian:

- **El titular y el CTA son visibles desde el primer frame.** Hacen fade-in en paralelo con la apertura (0–600 ms), nunca después. La animación acompaña al pitch, no lo sustituye.
- Nada de pantalla negra, nada de "entrar", nada de esperar.
- Si `prefers-reduced-motion: reduce`, se muestra el logo en estado final sin animación y el resto de la página carga normal.
- Cero CLS: el espacio del logo y del titular está reservado antes de que corra el script.

---

## 4. Secuencia de scroll — especificación

Sección inmediatamente debajo del hero. En desktop: sección pinned con scrub (la animación avanza con el scroll, no con el tiempo). En móvil: tres bloques apilados con reveal al entrar en viewport, **sin pin ni scrub**.

Una burbuja de WhatsApp baja por la sección y se transforma en tres pasos. La `palomita` del logo se desprende de la K y cae en cada paso como si lo aprobara.

| Paso | Visual | Texto de apoyo (puedes ajustar al copy existente del sitio) |
|---|---|---|
| 1 | Burbuja de chat estilo WhatsApp: "Ya llegué", hora 8:02 a.m., doble palomita | "Tu empleado manda un mensaje. Nada que instalar, nada que aprender." |
| 2 | La burbuja se convierte en una tarjeta de registro: nombre, hora, ubicación aproximada, "Entrada registrada" | "Klokk lo convierte en un registro con hora y ubicación." |
| 3 | La tarjeta se convierte en un documento con encabezado "Registro de asistencia" y un sello que cae encima (texto del sello: "NOM-151") | "Y lo sella como evidencia válida ante la STPS." |

Al final del paso 3, la palomita regresa a su lugar y el logo se rearma completo junto al CTA de cierre de la sección.

Los nombres, horas y textos del mockup son ficticios y genéricos ("María López", "8:02 a.m.", "Mérida, Yuc."). No uses datos de clientes reales.

---

## 5. Detalles de mouse — especificación

Solo cuando `(hover: hover) and (pointer: fine)`. En touch no existen.

- El logo del hero se inclina hacia el cursor con rotación 3D máxima de 6° en cada eje, con suavizado (lerp). Vuelve al centro cuando el cursor sale.
- Botones primarios: al hacer hover, una palomita pequeña (misma forma que `palomita`, misma animación de dash) se dibuja junto al texto del botón en ~250 ms.

---

## 6. Restricciones técnicas

- **Primero el stack que ya existe.** Si el repo ya tiene GSAP, Motion/Framer Motion o similar, úsalo. Si no tiene nada, instala GSAP + ScrollTrigger (es lo más sólido para scrub con pin).
- Anima solo `transform`, `opacity` y `stroke-dashoffset`. Nada que dispare layout.
- Todo lo del hero es inline (SVG, estilos críticos). Cero requests extra para la apertura.
- JS agregado al bundle: objetivo ≤ 40 KB gzip incluyendo la librería.
- El script de animación no bloquea el render: se monta después del primer paint.
- `will-change` solo en los elementos que se están animando, y se quita al terminar.
- Accesibilidad: el SVG lleva `role="img"` y `aria-label="Klokk"`. Los mockups de scroll son `aria-hidden`; su texto de apoyo sí es legible por lector de pantalla.
- Móvil es ciudadano de primera: todo se prueba en 390 px de ancho antes de darlo por terminado.

---

## 7. Plan de orquestación

Lanza subagentes con `model: "opus"`. Respeta este orden; los pasos 2 y 3 pueden ir en paralelo si el paso 1 confirma que el hero y la sección de scroll viven en componentes separados.

**Paso 1 — Explorador (lectura, no escribe).**
Reporta: framework y versión, dónde vive el hero, qué librería de animación existe (si alguna), cómo están los estilos (Tailwind, CSS modules, etc.), cómo se corre `dev`, `build` y `lint`, y si hay Playwright o similar configurado. Entrega un mapa de archivos a tocar. No tocar nada.

**Paso 2 — Apertura + logo.**
Crea el componente del logo con el SVG inline y las capas con id. Implementa la sección 3 completa, incluyendo `prefers-reduced-motion` y el fade-in paralelo del titular y CTA. Entrega: archivos cambiados, cómo ajustar los tiempos (que vivan en un solo objeto de configuración).

**Paso 3 — Scroll + mouse.**
Implementa las secciones 4 y 5. Reutiliza el componente del logo del paso 2 (si corren en paralelo, acuerda primero la interfaz del componente: nombre, props, ids de las capas).

**Paso 4 — QA independiente.**
Un subagente que NO haya visto los pasos 2 y 3. Le pasas este brief y nada más. Verifica con Playwright (Chromium ya está instalado, no corras `playwright install`):

- Captura a 390 px y a 1440 px: frame 0, 800 ms, 1500 ms de la apertura. En el frame 0 debe verse el titular y el CTA.
- Captura de cada paso de scroll en desktop y móvil.
- Con `prefers-reduced-motion: reduce` emulado: el logo se ve completo, nada se mueve.
- Consola sin errores. `build` y `lint` pasan.
- Reporta CLS del hero y el peso agregado al bundle contra los límites de la sección 6.
- Entrega lista de lo que cumple y lo que no, con capturas. No arregla nada: reporta.

Si el QA reporta fallas, regresa al subagente del paso correspondiente con el reporte, y vuelve a correr el QA. Máximo dos vueltas; si a la tercera sigue fallando, para y repórtalo.

---

## 8. Entrega

- Rama `feat/hero-animation` a partir de la rama principal. Nunca commits directos a main.
- Commits chicos y descriptivos.
- Un PR con: descripción corta, GIF o capturas de la apertura y de los tres pasos de scroll (desktop y móvil), y el reporte del QA.
- Un archivo `docs/HERO-ANIMATION.md` con: dónde viven los tiempos, cómo desactivar la apertura, cómo agregar un cuarto paso al scroll.

Al terminar, resume en cinco líneas: qué quedó, qué no, y qué recomiendas para la fase 2.
