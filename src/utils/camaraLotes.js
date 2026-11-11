// Helpers del trozado en cámara y del envío a render (2026-11-11), compartidos
// por TrozarCamaraModal y RenderCamaraModal.
import { trozadoLabel } from "../components/TrozadoTable";

export const KG_POR_CAJON = 20;
export const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n || 0);

// "Hoy" del navegador (Argentina) como AAAA-MM-DD, sin pasar por UTC.
export const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const fmtFecha = (iso) => new Date(iso).toLocaleDateString("es-AR");
// Hoy = ahora; otro día = mediodía de Argentina de ese día.
export const fechaParaEnviar = (fecha) =>
  fecha && fecha !== hoyLocal() ? { fecha: `${fecha}T12:00:00-03:00` } : {};

export const nombreCorteCorto = (c) =>
  `${trozadoLabel(c.tipo)}${c.clase && ["filet", "pata", "alita"].includes(c.tipo) ? ` ${c.clase}` : ""}`;
