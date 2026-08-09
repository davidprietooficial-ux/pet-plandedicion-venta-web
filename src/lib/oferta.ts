/**
 * Corte de 24h de la oferta. Un solo mecanismo genérico:
 *
 *   [data-cta-compra]              → su href se pone en el enlace correcto
 *   [data-oferta-estado="activa"]  → visible solo mientras la oferta corre
 *   [data-oferta-estado="vencida"] → visible solo después del corte
 *   [data-cuenta-regresiva]        → texto "23:59:59" (HH:MM:SS), tic cada segundo
 *   [data-cuenta-progreso]         → barra de progreso, % transcurrido de las 24h
 *   [data-modulos-grid]            → pierde la columna del bono (clase
 *                                     .sin-destacado) cuando la oferta vence
 *   [data-checkout-frame]          → su src cambia de data-src-activa a
 *                                     data-src-vencida cuando la oferta vence
 *
 * Se usa en el hero, en el bloque de precio y en la tarjeta del bono de IA:
 * los cuatro leen el mismo estado, no hay implementaciones distintas.
 *
 * ?vista=vencida en la URL fuerza el estado vencido sin esperar al corte
 * real — para poder previsualizar cómo queda la página pasadas las 24h
 * antes de que ocurra de verdad. No se documenta en la UI, es solo para
 * quien construye el sitio.
 *
 * Sin JS (bloqueado o falla), el HTML ya trae por defecto el estado
 * "activa" con el enlace de oferta — es lo correcto para la ventana en la
 * que se comparte el QR. Si alguien entra ya vencida la oferta y tiene JS
 * desactivado, ve el precio de oferta por error; es el único caso borde
 * y lo cubre la garantía de 7 días, no vale la pena un fallback de servidor
 * para una landing estática.
 */

import { INICIO_OFERTA, FIN_OFERTA, ENLACE_OFERTA, ENLACE_REGULAR } from '../datos/oferta';

const inicioOferta = new Date(INICIO_OFERTA).getTime();
const finOferta = new Date(FIN_OFERTA).getTime();
const duracionTotalMs = finOferta - inicioOferta;

function ofertaActiva(): boolean {
  if (new URLSearchParams(location.search).get('vista') === 'vencida') return false;
  return Date.now() < finOferta;
}

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

function formatearRestante(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(totalSeg / 3600);
  const min = Math.floor((totalSeg % 3600) / 60);
  const seg = totalSeg % 60;
  return `${dosDigitos(horas)}:${dosDigitos(min)}:${dosDigitos(seg)}`;
}

function aplicarEstado(): void {
  const activa = ofertaActiva();
  const ahora = Date.now();

  document.querySelectorAll<HTMLAnchorElement>('[data-cta-compra]').forEach((a) => {
    a.href = activa ? ENLACE_OFERTA : ENLACE_REGULAR;
  });

  document.querySelectorAll<HTMLElement>('[data-oferta-estado="activa"]').forEach((el) => {
    el.hidden = !activa;
  });
  document.querySelectorAll<HTMLElement>('[data-oferta-estado="vencida"]').forEach((el) => {
    el.hidden = activa;
  });

  document.querySelectorAll<HTMLElement>('[data-modulos-grid]').forEach((el) => {
    el.classList.toggle('sin-destacado', !activa);
  });

  // El iframe solo recarga si el src realmente cambia — si no, cada tic
  // del contador (cada segundo) reiniciaría el checkout embebido.
  document.querySelectorAll<HTMLIFrameElement>('[data-checkout-frame]').forEach((frame) => {
    const nuevoSrc = activa ? frame.dataset.srcActiva : frame.dataset.srcVencida;
    if (nuevoSrc && frame.src !== nuevoSrc) frame.src = nuevoSrc;
  });

  if (!activa) return;

  const restanteMs = finOferta - ahora;
  const restanteTexto = formatearRestante(restanteMs);
  document.querySelectorAll<HTMLElement>('[data-cuenta-regresiva]').forEach((el) => {
    el.textContent = restanteTexto;
  });

  // % transcurrido de la ventana de 24h. Antes de que arranque (poco
  // probable: el QR solo se comparte al cerrar el webinar) se clampa a 0.
  const transcurridoMs = Math.min(Math.max(ahora - inicioOferta, 0), duracionTotalMs);
  const pct = duracionTotalMs > 0 ? Math.round((transcurridoMs / duracionTotalMs) * 100) : 0;
  document.querySelectorAll<HTMLElement>('[data-cuenta-progreso]').forEach((el) => {
    el.style.width = `${pct}%`;
    el.setAttribute('aria-valuenow', String(pct));
  });
}

export function iniciarOferta(): void {
  aplicarEstado();
  window.setInterval(aplicarEstado, 1000);

  document.querySelectorAll<HTMLAnchorElement>('[data-cta-compra]').forEach((a) => {
    a.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('conversion', { detail: { tipo: 'clic_comprar' } }));
    });
  });
}
