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
