// Normaliza un número de teléfono argentino al formato esperado por wa.me (54 + número, sin 0 inicial)
export const normalizarWhatsapp = (num) => {
  let n = String(num || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("0")) n = "54" + n.slice(1);
  if (!n.startsWith("54")) n = "54" + n;
  return n;
};
