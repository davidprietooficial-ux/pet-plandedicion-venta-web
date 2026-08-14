/**
 * Config de la oferta: enlaces de compra, precio y la ventana recurrente
 * semanal de la oferta (el webinar se repite cada lunes).
 */

// PLACEHOLDER — el cliente pasa los enlaces reales de Hotmart en la tarde
// del 2026-08-07. Reemplazar antes de desplegar.
export const ENLACE_OFERTA = 'https://pay.hotmart.com/PENDIENTE-OFERTA';
export const ENLACE_REGULAR = 'https://pay.hotmart.com/PENDIENTE-REGULAR';

// Ventana de la oferta: recurrente cada semana, no una fecha fija — el
// webinar se repite cada lunes, así que la oferta también. Arranca el
// lunes 6:00pm y corta el martes 10:00pm (28h), zona horaria America/Bogotá.
// Bogotá no tiene horario de verano, así que el offset -05:00 es fijo todo
// el año — ver calcularVentanaActual() en ../lib/oferta.ts, que recalcula
// el lunes/martes de la semana en curso contra la hora real en cada tic.
export const DIA_INICIO_OFERTA = 1; // lunes (Date#getDay(): 0=domingo)
export const HORA_INICIO_OFERTA = 18; // 6:00pm
export const DIA_FIN_OFERTA = 2; // martes
export const HORA_FIN_OFERTA = 22; // 10:00pm
export const OFFSET_BOGOTA_HORAS = -5;

export const PRECIO_USD = 47;
export const PRECIO_BONO_IA_USD = 27;
