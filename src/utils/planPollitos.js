// Helpers del Plan de Pollitos, compartidos entre la página (almanaque y lista)
// y la solapa "Por destino" (components/PlanPorDestino.jsx).
//
// ⚠️ Las fechas se manejan como claves "AAAA-MM-DD" que manda el backend, NUNCA
// parseando la fecha ISO: el server corre en UTC y el navegador argentino en
// UTC−3, así que `new Date(iso).getDate()` corre el día para atrás.
import { labelGranja, prefijoGranja } from "./reproductoresUtils";

export const nombreCliente = (c) => c?.razonSocial || c?.nombre || "Cliente";

// ── Claves de día ───────────────────────────────────────────────────────────
// Se arman y se leen como texto. Nunca pasa por Date, así no hay zona horaria.
export const clave = (anio, mes, dia) =>
  `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

export const partesClave = (k) => {
  const [anio, mes, dia] = k.split("-").map(Number);
  return { anio, mes: mes - 1, dia };
};

const NOMBRE_DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// "lun 05/10", a partir de la clave.
export const textoClave = (k) => {
  if (!k) return "-";
  const { anio, mes, dia } = partesClave(k);
  const nombre = NOMBRE_DIA[new Date(anio, mes, dia).getDay()];
  return `${nombre} ${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
};

// Los planteles de una carga real: "#29 · #30".
export const textoLotes = (f) =>
  f.lotes?.length ? f.lotes.map((l) => `#${l.numeroLote ?? "?"}`).join(" · ") : "";

// A quién va una línea, en lo más corto que se entienda dentro de una celda.
export const nombreCorto = (l) =>
  l.destino === "granja"
    ? `${labelGranja(l.granja)}${l.galpon ? ` ${prefijoGranja(l.granja)}${l.galpon}` : ""}`
    : nombreCliente(l.cliente);
