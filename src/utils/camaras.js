/**
 * Las dos cámaras de donde sale la mercadería y su COLOR.
 *
 * El color es para que el personal no confunda de dónde se carga una orden: la
 * mayoría sale de Cañete, pero a veces sale de Trigotuc, y si las dos se ven
 * iguales es fácil ir a buscar a la cámara equivocada. Cada cámara tiene SU color
 * en todas las pantallas y en lo impreso — cambiar solo acá.
 */
export const CAMARAS = [
  { value: "cañete",   label: "Cañete"   },
  { value: "trigotuc", label: "Trigotuc" },
];

const ESTILOS = {
  "cañete":   { color: "#0d6efd", fondo: "#e7f1ff", rgb: [13, 110, 253] }, // azul
  "trigotuc": { color: "#e8590c", fondo: "#fff4e6", rgb: [232, 89, 12] },  // naranja
};
const ESTILO_NEUTRO = { color: "#6c757d", fondo: "#f8f9fa", rgb: [108, 117, 125] };

export const camaraLbl = (v) => CAMARAS.find((c) => c.value === v)?.label || v || "—";

/** `{ color, fondo, rgb, label }` de la cámara. `rgb` es para jsPDF. */
export const estiloCamara = (v) => ({ ...(ESTILOS[v] || ESTILO_NEUTRO), label: camaraLbl(v) });

/** Estilo de la tarjeta de una orden: borde del color de su cámara. */
export const bordeCamara = (v) => ({ border: `2px solid ${estiloCamara(v).color}`, overflow: "hidden" });
