// Helpers de los pagos de Forratuc (2026-10-21), compartidos por el presupuesto
// de contado y el cobro de cuenta corriente. El editor es components/PagosForratuc.jsx.

let siguienteId = 1;
export const pagoVacio = (medio = "efectivo", importe = "") => ({ id: siguienteId++, medio, importe: String(importe) });

// Lo que se manda al back: solo el medio, el importe y los campos de ese medio.
export const pagosParaEnviar = (pagos, medios) =>
  pagos.map((p) => {
    const m = medios.find((x) => x.key === p.medio);
    const limpio = { medio: p.medio, importe: Number(p.importe) };
    for (const c of m?.campos || []) if (p[c] !== undefined && p[c] !== "") limpio[c] = p[c];
    return limpio;
  });

export const sumaPagos = (pagos) =>
  Math.round(pagos.reduce((a, p) => a + (Number(p.importe) || 0), 0) * 100) / 100;
