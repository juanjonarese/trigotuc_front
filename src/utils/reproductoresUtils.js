/**
 * Helpers de presentación del módulo Reproductores.
 *
 * El stock de huevos se lleva en unidades; cajones y bandejas son solo forma de
 * mostrarlo. Los valores de referencia (12 huevos por bandeja, 12 bandejas por
 * cajón) los manda el backend en /lotes-reproductores/constantes — acá quedan
 * como fallback para el primer render, antes de que llegue la respuesta.
 */

export const HUEVOS_POR_BANDEJA_DEFAULT = 12;
export const BANDEJAS_POR_CAJON_DEFAULT = 12;
export const HUEVOS_POR_CAJON_DEFAULT = HUEVOS_POR_BANDEJA_DEFAULT * BANDEJAS_POR_CAJON_DEFAULT;

export const formatearNumero = (valor) =>
  valor == null ? "-" : Number(valor).toLocaleString("es-AR");

export const formatearMoneda = (valor) =>
  valor == null
    ? "-"
    : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(valor);

export const formatearPorcentaje = (valor) =>
  valor == null ? "-" : `${Number(valor).toFixed(2).replace(".", ",")}%`;

/** Descompone una cantidad de huevos en cajones / bandejas / sueltos. */
export const desglosarHuevos = (huevos, huevosPorCajon = HUEVOS_POR_CAJON_DEFAULT, huevosPorBandeja = HUEVOS_POR_BANDEJA_DEFAULT) => {
  const total = Math.max(0, Number(huevos) || 0);
  const cajones = Math.floor(total / huevosPorCajon);
  const resto = total % huevosPorCajon;
  const bandejas = Math.floor(resto / huevosPorBandeja);
  const sueltos = resto % huevosPorBandeja;
  return { total, cajones, bandejas, sueltos };
};

/** "400 cajones" / "6 cajones + 11 bandejas + 4" */
export const textoDesglose = (huevos, huevosPorCajon, huevosPorBandeja) => {
  const { cajones, bandejas, sueltos } = desglosarHuevos(huevos, huevosPorCajon, huevosPorBandeja);
  const partes = [];
  if (cajones) partes.push(`${cajones} ${cajones === 1 ? "cajón" : "cajones"}`);
  if (bandejas) partes.push(`${bandejas} ${bandejas === 1 ? "bandeja" : "bandejas"}`);
  if (sueltos) partes.push(`${sueltos} suelto${sueltos === 1 ? "" : "s"}`);
  return partes.length ? partes.join(" + ") : "0 cajones";
};

export const SECTOR_LABEL = { recria: "Recría", postura: "Postura" };

// ── Tipos de huevo ──────────────────────────────────────────────────────────
// Los cuatro tipos que se clasifican en el galpón y viajan en el remito a
// Trigotuc. Las claves son las de recoleccion.tipos y remito.lineas[].tipo —
// espejo de utils/reproductores.js en el backend, no cambiar de un lado solo.
// El huevo roto no es un tipo: se tira en la granja (descartePerdida).
export const TIPOS_HUEVO = [
  { key: "api",       label: "API",        corto: "API",   ayuda: "Incubable — es el único que entra a la incubadora", clase: "text-success",       icono: "bi-thermometer-half" },
  { key: "dobleYema", label: "Doble yema", corto: "D.yema", ayuda: "No incubable, va a venta",                          clase: "text-warning",       icono: "bi-egg-fried" },
  { key: "regular",   label: "Regular",    corto: "Reg.",   ayuda: "No incubable, va a venta",                          clase: "text-primary",       icono: "bi-egg" },
  { key: "bebe",      label: "Huevo bebé", corto: "Bebé",   ayuda: "No incubable, va a venta",                          clase: "text-info",          icono: "bi-egg-fill" },
];

export const TIPOS_HUEVO_KEYS = TIPOS_HUEVO.map((t) => t.key);
export const TIPO_HUEVO_INCUBABLE = "api";

export const etiquetaTipoHuevo = (key) =>
  TIPOS_HUEVO.find((t) => t.key === key)?.label || key;

/** { api: 0, dobleYema: 0, regular: 0, bebe: 0 } */
export const tiposHuevoEnCero = () =>
  TIPOS_HUEVO_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {});

/** Suma de un objeto por tipo, tolerando campos vacíos. */
export const sumarTiposHuevo = (porTipo = {}) =>
  TIPOS_HUEVO_KEYS.reduce((acc, k) => acc + (Number(porTipo[k]) || 0), 0);

export const ESTADO_LOTE = {
  recria:     { label: "En recría",  clase: "bg-info text-dark" },
  postura:    { label: "En postura", clase: "bg-success" },
  finalizado: { label: "Finalizado", clase: "bg-secondary" },
};

export const ESTADO_TANDA = {
  en_incubadora: { label: "En incubadora", clase: "bg-warning text-dark", icono: "bi-thermometer-half" },
  en_nacedora:   { label: "En nacedora",   clase: "bg-info text-dark",    icono: "bi-egg" },
  nacida:        { label: "Nacida",        clase: "bg-success",           icono: "bi-sunrise" },
  cancelada:     { label: "Cancelada",     clase: "bg-secondary",         icono: "bi-x-circle" },
};

// Las claves son los valores guardados en stockHuevo.origen — no se tocan.
// Solo cambian las etiquetas que ve el usuario.
export const ORIGEN_DESCARTE = {
  clasificacion: "Descarte de clasificación",
  inoculacion:   "Descarte de carga a incubadora",
  miraje:        "Descarte de miraje",
};

export const SEXO_LABEL = { hembra: "Hembras", macho: "Machos" };

/** Nombre del galpón según el mapa de constantes que devuelve el backend. */
export const nombreGalpon = (galpones, sector, numero) => {
  const entrada = (galpones?.[sector] || []).find((g) => g.numero === Number(numero));
  return entrada ? entrada.nombre : `${SECTOR_LABEL[sector] || sector} ${numero}`;
};

// ── Granjas de engorde ──────────────────────────────────────────────────────
// A dónde pueden ir los pollitos propios. Lo usan las pantallas de Proyección y
// Asignaciones.
export const GRANJAS = [
  { key: "cañete", label: "Cañete", prefix: "C", galpones: 6 },
  { key: "los_pinos", label: "Los Pinos", prefix: "P", galpones: 8 },
];

export const labelGranja = (key) => GRANJAS.find((g) => g.key === key)?.label || key;
export const prefijoGranja = (key) => GRANJAS.find((g) => g.key === key)?.prefix || "";

/** Días que faltan (positivo) o que pasaron (negativo) hasta una fecha. */
export const diasHasta = (fecha) => {
  const ms = new Date(fecha).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

/** "en 6 días" / "hoy" / "hace 3 días" */
export const textoDias = (dias, corto = false) => {
  if (dias === 0) return "hoy";
  const unidad = (n) => (corto ? "d" : `día${n === 1 ? "" : "s"}`);
  if (dias > 0) return `en ${dias} ${unidad(dias)}`;
  const n = Math.abs(dias);
  return `hace ${n} ${unidad(n)}`;
};
