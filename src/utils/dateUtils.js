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

/**
 * Zona horaria del negocio. Se fija explícitamente en vez de usar la del
 * navegador: los horarios que se cargan y se muestran son siempre los de la
 * granja, sin importar desde dónde se abra el sistema.
 */
export const ZONA_AR = 'America/Argentina/Buenos_Aires';

/**
 * Hora del día (HH:MM) de una fecha ISO, en hora argentina.
 *
 * @param {string} fechaISO - Fecha en formato ISO
 * @returns {string} - "07:30", o '-' si no hay fecha
 */
export const formatearHoraLocal = (fechaISO) => {
  if (!fechaISO) return '-';
  return new Date(fechaISO).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONA_AR,
  });
};

/**
 * Hora actual (HH:MM) en Argentina, para precargar inputs tipo time.
 *
 * @returns {string} - "07:30"
 */
export const obtenerHoraAhora = () => formatearHoraLocal(new Date().toISOString());
