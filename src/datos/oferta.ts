/**
 * Config de la oferta de 24h: enlaces de compra, precio y el corte exacto
 * de las primeras 24 horas tras el webinar.
 */

// PLACEHOLDER — el cliente pasa los enlaces reales de Hotmart en la tarde
// del 2026-08-07. Reemplazar antes de desplegar.
export const ENLACE_OFERTA = 'https://pay.hotmart.com/PENDIENTE-OFERTA';
export const ENLACE_REGULAR = 'https://pay.hotmart.com/PENDIENTE-REGULAR';

// Ventana de la oferta: 24h exactas, confirmadas por el cliente lunes 8:30pm
// → martes 8:30pm. Zona horaria America/Bogotá, con offset explícito para
// que el cálculo no dependa de la zona horaria del navegador de quien visita.
export const INICIO_OFERTA = '2026-08-10T20:30:00-05:00';
export const FIN_OFERTA = '2026-08-11T20:30:00-05:00';

export const PRECIO_USD = 37;
export const PRECIO_BONO_IA_USD = 27;
