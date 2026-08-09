/**
 * Alto dinámico del checkout de Hotmart, vía postMessage.
 *
 * Hotmart emite un mensaje no documentado oficialmente pero real y
 * consistente — { action: "elements_document_height_update", data: "NNNNpx" }
 * — desde el origen del propio checkout cada vez que su contenido cambia
 * de alto: al cargar, y otra vez si el comprador despliega más campos
 * (por ejemplo, elige "Débito/Crédito" y aparecen tarjeta, vencimiento,
 * CVV, más los order bumps). Escucharlo evita adivinar un alto fijo a
 * ciegas: ni deja espacio en blanco de sobra ni le sale su propia barra
 * de scroll interna (la "doble barra") si el formulario crece después
 * de la carga inicial.
 *
 * evento.source se compara contra el contentWindow exacto del iframe
 * (no alcanza con mirar evento.origin) porque el checkout de Hotmart
 * anida OTROS iframes propios (ej. pci-pay.hotmart.com para el formulario
 * de tarjeta) que mandan el mismo tipo de mensaje con SU propio alto,
 * mucho menor — atender esos por error encogería el marco de golpe.
 *
 * Medido en vivo (Playwright, escuchando el mensaje real): Hotmart no
 * manda un valor final estable — sigue emitiendo el mismo mensaje cada
 * ~170ms, bajando ~2px cada vez, de forma continua durante minutos (algo
 * propio, probablemente una animación interna suya que también dispara
 * su observer de alto, no cambios reales de contenido). Y ese primer
 * valor ya viene inflado: con el checkout recién cargado, el contenido
 * real (medido con getBoundingClientRect del último elemento visible
 * dentro del iframe) termina en ~2880px, pero el mensaje reporta
 * ~4196px — más de 1300px que nunca tienen nada dibujado encima, no un
 * "todavía no cargó". Aplicar cada mensaje tal cual — como hacía la
 * versión anterior — dejaba ese sobrante Y ADEMÁS se sentía como que la
 * página se "recortaba" sola de forma continua.
 *
 * Cinco correcciones (la segunda y la cuarta corrigen bugs reales de
 * versiones anteriores de este archivo — ver abajo):
 *   1. El techo (TECHO_INICIAL_*_PX, por encima del contenido real
 *      medido, con margen) se aplica a TODOS los mensajes que reporten
 *      un alto por debajo de esa zona de ruido, no solo al primero.
 *   2. BUG YA CORREGIDO: una versión anterior solo recortaba el PRIMER
 *      mensaje y dejaba pasar los siguientes tal cual. Como Hotmart sigue
 *      reportando su número inflado (bajando ~2px cada vez, no de
 *      golpe), el SEGUNDO mensaje —apenas 1.2s después— todavía traía
 *      un valor grande sin recortar, y volvía a inflar el marco que ya
 *      se había achicado bien. Eso es exactamente el hueco en blanco que
 *      seguía apareciendo. Se corrigió recordando el menor alto visto y
 *      recortando CUALQUIER mensaje nuevo, no solo el primero.
 *   3. Excepción: si un mensaje reporta un alto MUCHO mayor que el menor
 *      visto hasta ahora (> UMBRAL_CRECIMIENTO_REAL_PX), se toma como
 *      crecimiento real de contenido (el comprador eligió "Débito/
 *      Crédito" y aparecieron más campos).
 *   4. BUG YA CORREGIDO (el más reciente, reportado por el cliente como
 *      "volvió la doble barra"): tras detectar ese crecimiento real
 *      (punto 3), la versión anterior seguía comparando los mensajes
 *      SIGUIENTES contra el techo — así que en cuanto Hotmart mandaba un
 *      número apenas menor al recién crecido (su propio goteo de ruido,
 *      no un achique real), el código lo tomaba como "nuevo mínimo" y lo
 *      volvía a recortar al techo viejo, cortando los campos de tarjeta
 *      que recién se habían mostrado — la barra de scroll interna volvía
 *      a aparecer. Ahora, una vez confirmado un crecimiento real, techoActivo
 *      pasa a false PARA SIEMPRE en esa visita: de ahí en más se confía
 *      en el número de Hotmart tal cual, sin volver a recortarlo nunca.
 *      El techo es una mejor estimación de PARTIDA, no algo que deba
 *      poder reaparecer después de saber que el contenido real es mayor.
 *   5. Throttle: como mucho un ajuste cada MIN_INTERVALO_MS, para no
 *      perseguir el goteo continuo de 2px. Junto con la transición CSS en
 *      sitio.css ([data-checkout-marco]), cualquier ajuste que sí ocurra
 *      se ve como un asentamiento suave, no un salto.
 *
 * [data-checkout-marco] arranca en un alto por CSS (--checkout-alto-movil
 * / --checkout-alto-tablet en sitio.css — el fallback antes de que llegue
 * el primer mensaje, o si Hotmart alguna vez deja de mandarlo) y este
 * listener lo ajusta al valor real apenas lo sabe. Esos dos valores de
 * CSS DEBEN ser iguales a los TECHO_INICIAL_*_PX de acá: si no coinciden,
 * el primer mensaje corrige el alto de golpe apenas carga la página y
 * empuja todo el contenido de más abajo en un salto grande — ver el
 * comentario largo en sitio.css para el bug real que causó.
 */
const MIN_INTERVALO_MS = 1200;
const TECHO_INICIAL_MOVIL_PX = 3000;
const TECHO_INICIAL_TABLET_PX = 2450;
const PUNTO_CORTE_TABLET_PX = 768;
const UMBRAL_CRECIMIENTO_REAL_PX = 150;

export function iniciarAltoCheckout(): void {
  const marco = document.querySelector<HTMLElement>('[data-checkout-marco]');
  const frame = document.querySelector<HTMLIFrameElement>('[data-checkout-frame]');
  if (!marco || !frame) return;

  const techo = window.innerWidth < PUNTO_CORTE_TABLET_PX ? TECHO_INICIAL_MOVIL_PX : TECHO_INICIAL_TABLET_PX;
  let ultimoAjusteEn = 0;
  let menorAlturaVista = Infinity;
  let techoActivo = true;

  window.addEventListener('message', (evento) => {
    if (evento.source !== frame.contentWindow) return;
    if (!evento.origin.endsWith('.hotmart.com')) return;

    const datos = evento.data as { action?: string; data?: unknown } | undefined;
    if (datos?.action !== 'elements_document_height_update') return;

    const alto = parseInt(String(datos.data), 10);
    if (!Number.isFinite(alto) || alto <= 0) return;

    const ahora = Date.now();
    if (ultimoAjusteEn !== 0 && ahora - ultimoAjusteEn < MIN_INTERVALO_MS) return;

    let altoAplicado: number;
    if (!techoActivo) {
      // Ya sabemos que el contenido real supera el techo — se confía en
      // Hotmart sin volver a recortar nunca, pase lo que pase con el
      // goteo de ruido.
      altoAplicado = alto;
    } else if (alto < menorAlturaVista) {
      // Nuevo mínimo: el goteo de Hotmart sigue bajando (o el contenido
      // genuinamente se achicó). Se recorta al techo por si el número
      // crudo todavía sigue inflado.
      menorAlturaVista = alto;
      altoAplicado = Math.min(alto, techo);
    } else if (alto - menorAlturaVista > UMBRAL_CRECIMIENTO_REAL_PX) {
      // Salto grande hacia arriba respecto al mínimo ya visto: contenido
      // nuevo real, no ruido — se aplica sin techo y se apaga el techo
      // para el resto de la visita (ver punto 4 del comentario de arriba).
      techoActivo = false;
      altoAplicado = alto;
    } else {
      // Ni un mínimo nuevo ni un salto real: es el goteo de ~2px de
      // Hotmart rebotando cerca del mismo número. Se ignora.
      return;
    }

    ultimoAjusteEn = ahora;
    marco.style.height = `${altoAplicado}px`;
  });
}
