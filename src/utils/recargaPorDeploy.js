import { lazy } from "react";

/**
 * Pantallas que no se pueden bajar después de un deploy (2026-11-16).
 *
 * Cada pantalla se baja recién al entrar (`React.lazy`) y cada deploy le cambia
 * el nombre al archivo (`ForratucInicioPage-9Oi4AMQM.js`). Una pestaña abierta
 * desde ANTES del deploy pide el nombre viejo, que ya no existe, y falla
 * ("Failed to fetch dynamically imported module" / MIME "text/html"). Se arregla
 * recargando: esto lo hace solo, UNA vez. Si vuelve a fallar enseguida (sin
 * internet, u otro problema), no recarga en loop: deja ver el error.
 */
const CLAVE = "recargaPorDeploy";
const VENTANA_MS = 30_000;

export const recargarPorDeploy = () => {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) || 0);
    if (Date.now() - ultima < VENTANA_MS) return false; // ya se recargó recién
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin sessionStorage no hay traba: mejor no recargar.
    return false;
  }
  window.location.reload();
  return true;
};

/** `React.lazy` que, si la pantalla no se puede bajar, recarga una vez. */
export const lazyConRecarga = (importar) =>
  lazy(() =>
    importar().catch((err) => {
      // Mientras recarga, una promesa que no termina: no se muestra el error.
      if (recargarPorDeploy()) return new Promise(() => {});
      throw err;
    })
  );
