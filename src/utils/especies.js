/**
 * Especies que se faenan y conviven en cámara: pollo, gallina y gallo.
 *
 * Las tres usan los MISMOS calibres (5 a 11, cajón de 20 kg) y los mismos cinco
 * cortes, así que en las pantallas el calibre solo no alcanza para identificar
 * una fila: puede haber "calibre 7" de pollo y "calibre 7" de gallina, y son dos
 * stocks distintos. Siempre que se liste stock hay que mostrar la especie.
 *
 * ⚠️ Lo faenado antes de que se faenaran gallinas no tiene el campo y es pollo:
 * leer siempre con `especieDe()`, nunca `linea.especie` pelado.
 *
 * Espejo de `utils/especies.js` del back — cambiar en los dos lados.
 */

export const ESPECIES = ["pollo", "gallina", "gallo"];
export const ESPECIE_DEFAULT = "pollo";

export const ETIQUETA_ESPECIE = {
  pollo:   "Pollo",
  gallina: "Gallina",
  gallo:   "Gallo",
};

export const ETIQUETA_ESPECIE_PLURAL = {
  pollo:   "pollos",
  gallina: "gallinas",
  gallo:   "gallos",
};

// Color del badge de cada especie. Nunca se usa el color solo para distinguir:
// siempre va acompañado del texto.
export const BADGE_ESPECIE = {
  pollo:   "bg-primary-subtle text-primary-emphasis",
  gallina: "bg-warning-subtle text-warning-emphasis",
  gallo:   "bg-danger-subtle text-danger-emphasis",
};

// Calibres posibles de cada especie. El pollo va de 5 a 11; la gallina sale
// SOLO en calibre 6 y 7 (definición del cliente, 2026-09-30). El gallo, por
// ahora, con los del pollo hasta que se defina.
const CALIBRES_POLLO = [5, 6, 7, 8, 9, 10, 11];
export const CALIBRES_POR_ESPECIE = {
  pollo:   CALIBRES_POLLO,
  gallina: [6, 7],
  gallo:   CALIBRES_POLLO,
};

export const calibresDeEspecie = (especie) =>
  CALIBRES_POR_ESPECIE[especie || ESPECIE_DEFAULT] || CALIBRES_POLLO;

export const especieDe = (linea) => linea?.especie || ESPECIE_DEFAULT;

export const etiquetaEspecie = (especie) =>
  ETIQUETA_ESPECIE[especie || ESPECIE_DEFAULT] || especie;

export const etiquetaEspeciePlural = (especie, cantidad) => {
  const plural = ETIQUETA_ESPECIE_PLURAL[especie || ESPECIE_DEFAULT] || "unidades";
  return cantidad === 1 ? plural.slice(0, -1) : plural;
};

/**
 * La especie que produce una orden de carga. No se elige al faenar: la dice la
 * orden, porque una de Reproductoras lleva un solo sexo.
 */
export const especieDeOrden = (orden) => {
  if (!orden || orden.origen !== "reproductoras") return ESPECIE_DEFAULT;
  return orden.sexo === "macho" ? "gallo" : "gallina";
};

export const claveEntero  = (l) => `${especieDe(l)}|${l.calibre}`;
export const claveTrozado = (l) => `${especieDe(l)}|${l.tipo}|${l.clase || ""}`;

export const mismoEntero = (a, b) =>
  especieDe(a) === especieDe(b) && Number(a.calibre) === Number(b.calibre);

/** ¿La lista tiene más de una especie? Si no, no hace falta ensuciar la tabla. */
export const hayVariasEspecies = (lineas = []) =>
  new Set((lineas || []).map(especieDe)).size > 1;

// ── La especie en las ÓRDENES (2026-10-01) ──────────────────────────────────
// En una orden (impresa, en PDF o en su detalle) "Cal. 7" no alcanza: el que
// carga en la cámara tiene que saber si es pollo o gallina. La regla para las
// órdenes NO es `hayVariasEspecies`: una orden que lleva SOLO gallina tiene una
// sola especie y sin el nombre se leería como pollo. Se nombra la especie en
// cada renglón siempre que haya algo que no sea pollo; una orden solo de pollo
// se ve como siempre.

/** ¿Hay que decir la especie en cada renglón de esta orden? */
export const nombrarEspecie = (lineas = []) =>
  (lineas || []).some((l) => especieDe(l) !== ESPECIE_DEFAULT);

/** Lo mismo, mirando los calibres y los trozados de una orden juntos. */
export const nombrarEspecieOrden = (orden) =>
  nombrarEspecie([...(orden?.calibres || []), ...(orden?.trozados || [])]);

/** "Cal. 7", o "Gallina · Cal. 7" si la orden lleva algo que no es pollo. */
export const textoCalibre = (linea, conEspecie) =>
  conEspecie
    ? `${etiquetaEspecie(especieDe(linea))} · Cal. ${linea.calibre}`
    : `Cal. ${linea.calibre}`;

/** Antepone la especie a un texto ya armado (el corte de un trozado, por ejemplo). */
export const conEspecie = (linea, texto, nombrar) =>
  nombrar ? `${etiquetaEspecie(especieDe(linea))} · ${texto}` : texto;

/**
 * Las líneas agrupadas por especie (pollo, gallina, gallo), conservando el orden
 * dentro de cada una: así el "calibre 7" de pollo y el de gallina no quedan
 * intercalados en el papel.
 */
export const ordenarPorEspecie = (lineas = []) =>
  [...(lineas || [])].sort(
    (a, b) => ESPECIES.indexOf(especieDe(a)) - ESPECIES.indexOf(especieDe(b))
  );

/**
 * La especie de un lote de faena. Un lote sale de UNA orden de carga, así que
 * todas sus líneas son de lo mismo: alcanza con mirar la primera que haya.
 */
export const especieDelLote = (lote) =>
  especieDe(
    (lote?.calibres || [])[0] ||
    (lote?.calibresPendientes || [])[0] ||
    (lote?.trozados || [])[0] ||
    (lote?.trozadosPendientes || [])[0]
  );
