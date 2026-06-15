// Escapa caracteres HTML para evitar XSS al interpolar datos del usuario
// dentro de HTML que se escribe en ventanas de impresión (document.write).
// Usar SIEMPRE que se interpole texto de origen no controlado (razón social,
// observaciones, direcciones, nombres, etc.) en un template de impresión.
export const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export default escapeHtml;
