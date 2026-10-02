// Formatos de números del Dashboard, compartidos por sus tres solapas.
export const fmtNum = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n ?? 0);
export const fmtPct = (n) => (n != null ? `${Number(n).toFixed(1)}%` : "—");
