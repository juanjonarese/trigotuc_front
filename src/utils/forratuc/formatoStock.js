// Formato de las pantallas de stock de Forratuc (Stock y Producción, 2026-11-19).
export const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 1 });
export const UNIDADES = { bolsa: "bolsas", unidad: "unidades", caja: "cajas", maple: "maples" };
