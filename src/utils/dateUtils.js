/**
 * Utilidades para manejo de fechas en la aplicación
 */

/**
 * Ajusta una fecha al mediodía UTC para evitar problemas de zona horaria
 * cuando se almacenan en MongoDB.
 *
 * @param {string} fechaString - Fecha en formato YYYY-MM-DD
 * @returns {string|null} - Fecha en formato ISO (UTC) o null si no hay fecha
 *
 * Ejemplo:
 * ajustarFechaParaGuardar("2025-12-17") => "2025-12-17T12:00:00.000Z"
 */
export const ajustarFechaParaGuardar = (fechaString) => {
  if (!fechaString) return null;
  // Crear la fecha directamente en UTC a las 12:00 para evitar problemas de zona horaria
  return `${fechaString}T12:00:00.000Z`;
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD para inputs tipo date
 *
 * @returns {string} - Fecha actual en formato YYYY-MM-DD
 */
export const obtenerFechaHoy = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Formatea una fecha ISO a formato local legible
 *
 * @param {string} fechaISO - Fecha en formato ISO
 * @param {string} locale - Locale para el formato (default: 'es-AR')
 * @returns {string} - Fecha formateada
 */
export const formatearFechaLocal = (fechaISO, locale = 'es-AR') => {
  if (!fechaISO) return '-';
  return new Date(fechaISO).toLocaleDateString(locale);
};
