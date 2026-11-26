/**
 * Datos del alta de clientes (2026-11-26, "alta clientes/Clientes Datos.xlsx").
 * Copia de trigotuc_back/utils/clientes.js: cambiar en los dos.
 */
export const TIPOS_CLIENTE = [
  { key: "cuenta_corriente", etiqueta: "Cuenta corriente" },
  { key: "consumidor_final", etiqueta: "Consumidor final" },
];

export const CONDICIONES_IVA = [
  { key: "responsable_inscripto", etiqueta: "Responsable inscripto" },
  { key: "monotributo", etiqueta: "Monotributo" },
  { key: "consumidor_final", etiqueta: "Consumidor final" },
  { key: "exento", etiqueta: "Exento" },
  { key: "no_inscripto", etiqueta: "Responsable no inscripto" },
];

export const RUBROS_CLIENTE = [
  { key: "alimentos", etiqueta: "Alimentos balanceados" },
  { key: "pollitos", etiqueta: "Pollitos BB" },
  { key: "pollos", etiqueta: "Pollos eviscerados" },
];

// Los de antes no tienen tipo: son de cuenta corriente.
export const tipoCliente = (c) => c?.tipo || "cuenta_corriente";
export const esConsumidorFinal = (c) => tipoCliente(c) === "consumidor_final";

/**
 * Localidades por provincia (datos de Georef, datos.gob.ar, bajados el
 * 26/11/2026). Se cargan recién cuando se abre el formulario.
 */
let _localidades = null;
export const cargarLocalidades = async () => {
  if (!_localidades) _localidades = (await import("../data/localidadesArgentina.json")).default;
  return _localidades;
};
