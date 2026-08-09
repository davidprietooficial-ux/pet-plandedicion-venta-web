/**
 * Píldora "Ya entraron N" del hero — prueba social.
 *
 * Arranca en 1 y sube siempre de a uno (pasos chicos, pedido explícito)
 * en intervalos aleatorios de 15-25s, hasta un tope de 70. Nunca baja ni
 * se reinicia: sube una sola vez por visita, como una cuenta que avanza
 * mientras el visitante sigue en la página.
 *
 * Sin prefers-reduced-motion no hay nada que animar en el sentido de
 * movimiento visual (es texto, no transform/opacity), pero igual se
 * respeta el espíritu de la preferencia: en vez de hacerlo trepar número
 * por número frente al usuario, se muestra directo el valor final.
 */
const TOPE = 70;
const ESPERA_MIN_MS = 15_000;
const ESPERA_MAX_MS = 25_000;

export function iniciarContadorEntradas(): void {
  const el = document.querySelector<HTMLElement>('[data-contador-vivo-numero]');
  if (!el) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = String(TOPE);
    return;
  }

  let valor = 1;
  el.textContent = String(valor);

  const siguientePaso = () => {
    if (valor >= TOPE) return;
    const espera = ESPERA_MIN_MS + Math.random() * (ESPERA_MAX_MS - ESPERA_MIN_MS);
    setTimeout(() => {
      valor = Math.min(TOPE, valor + 1);
      el.textContent = String(valor);
      siguientePaso();
    }, espera);
  };

  siguientePaso();
}
