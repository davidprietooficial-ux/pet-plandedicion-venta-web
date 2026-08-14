/**
 * Corte de la oferta, recurrente cada semana (el webinar es cada lunes):
 * arranca lunes 6:00pm, corta martes 10:00pm. Un solo mecanismo genérico:
 *
 *   [data-cta-compra]              → su href se pone en el enlace correcto
 *   [data-oferta-estado="activa"]  → visible solo mientras la oferta corre
 *   [data-oferta-estado="vencida"] → visible solo después del corte
 *   [data-cuenta-regresiva]        → texto "23:59:59" (HH:MM:SS), tic cada segundo
 *   [data-cuenta-progreso]         → barra de progreso, % transcurrido de la ventana
 *   [data-modulos-grid]            → pierde la columna del bono (clase
 *                                     .sin-destacado) cuando la oferta vence
 *   [data-checkout-frame]          → su src cambia de data-src-activa a
 *                                     data-src-vencida cuando la oferta vence
 *
 * Se usa en el hero, en el bloque de precio y en la tarjeta del bono de IA:
 * los cuatro leen el mismo estado, no hay implementaciones distintas.
 *
 * No hay una fecha fija guardada en ningún lado: calcularVentanaActual()
 * recalcula el lunes/martes de la semana en curso contra la hora real en
 * cada tic (cada segundo), así que el corte se repite solo cada semana sin
 * tocar código ni desplegar de nuevo.
 *
 * ?vista=vencida en la URL fuerza el estado vencido sin esperar al corte
 * real — para poder previsualizar cómo queda la página pasada la ventana
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

import {
  DIA_INICIO_OFERTA,
  HORA_INICIO_OFERTA,
  DIA_FIN_OFERTA,
  HORA_FIN_OFERTA,
  OFFSET_BOGOTA_HORAS,
  ENLACE_OFERTA,
  ENLACE_REGULAR,
} from '../datos/oferta';

const OFFSET_BOGOTA_MS = OFFSET_BOGOTA_HORAS * 3600_000;

/**
 * Ventana [inicio, fin) de la oferta de la semana que contiene "ahora",
 * calculada en cada llamada — no hay fecha fija que se quede vieja.
 *
 * Trampa estándar para una zona horaria sin horario de verano: se resta
 * el offset de Bogotá a "ahora" y se leen los campos con los getters
 * *UTC*, tratándolos como si ya fueran hora local de Bogotá. Así el
 * cálculo del día de la semana no depende de en qué zona horaria esté
 * corriendo el navegador de quien visita.
 */
function calcularVentanaActual(ahoraMs: number): { inicio: number; fin: number } {
  const bogota = new Date(ahoraMs + OFFSET_BOGOTA_MS);
  const diaSemana = bogota.getUTCDay(); // 0=domingo … 6=sábado
  const diasDesdeInicio = (diaSemana - DIA_INICIO_OFERTA + 7) % 7;

  const medianocheLunesComoUTC = Date.UTC(
    bogota.getUTCFullYear(),
    bogota.getUTCMonth(),
    bogota.getUTCDate() - diasDesdeInicio,
  );
  // medianocheLunesComoUTC está en "hora Bogotá leída como UTC" — se resta
  // el offset (negativo) para volver a un timestamp real en UTC.
  const medianocheLunesReal = medianocheLunesComoUTC - OFFSET_BOGOTA_MS;

  const inicio = medianocheLunesReal + HORA_INICIO_OFERTA * 3600_000;
  const diasHastaFin = ((DIA_FIN_OFERTA - DIA_INICIO_OFERTA + 7) % 7) * 86_400_000;
  const fin = medianocheLunesReal + diasHastaFin + HORA_FIN_OFERTA * 3600_000;

  return { inicio, fin };
}

function ofertaActiva(ventana: { inicio: number; fin: number }, ahoraMs: number): boolean {
  if (new URLSearchParams(location.search).get('vista') === 'vencida') return false;
  return ahoraMs >= ventana.inicio && ahoraMs < ventana.fin;
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
  const ahora = Date.now();
  const ventana = calcularVentanaActual(ahora);
  const activa = ofertaActiva(ventana, ahora);

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

  const restanteMs = ventana.fin - ahora;
  const restanteTexto = formatearRestante(restanteMs);
  document.querySelectorAll<HTMLElement>('[data-cuenta-regresiva]').forEach((el) => {
    el.textContent = restanteTexto;
  });

  // % transcurrido de la ventana de la oferta. Antes de que arranque (poco
  // probable: el QR solo se comparte al cerrar el webinar) se clampa a 0.
  const duracionTotalMs = ventana.fin - ventana.inicio;
  const transcurridoMs = Math.min(Math.max(ahora - ventana.inicio, 0), duracionTotalMs);
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
