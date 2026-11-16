import * as XLSX from "xlsx";
import { obtenerFechaHoy, formatearFechaLocal } from "../dateUtils";

/**
 * Historial de movimientos del Stock de Forratuc filtrado por rubro y producto
 * (2026-11-16, pedido del usuario), y su exportación a Excel (la impresión está
 * en imprimirForratuc.js y usa lo mismo).
 *
 * Cada fila del back trae `items` (los productos que mueve, con su rubro y su
 * cantidad) y el lugar trae `stockPorProducto`. Al filtrar, cada fila se queda
 * con lo de los productos elegidos y el saldo se REHACE para esos productos:
 * arranca del stock de hoy de lo filtrado y va para atrás, como el original.
 */
export const filtrarHistorial = (historial, { rubro = "", producto = "" } = {}) => {
  if (!historial) return null;
  if (!rubro && !producto) return historial;
  const coincide = (it) => (!rubro || it.rubro === rubro) && (!producto || it.producto === producto);

  const stock = historial.stockPorProducto || {};
  const elegidos = new Set(Object.entries(stock).filter(([k, p]) => coincide({ ...p, producto: k })).map(([k]) => k));
  for (const m of historial.movimientos || []) for (const it of m.items || []) if (coincide(it)) elegidos.add(it.producto);

  // El saldo de hoy de lo filtrado, por unidad.
  const actual = {};
  for (const k of elegidos) if (stock[k]) actual[stock[k].unidad] = (actual[stock[k].unidad] || 0) + stock[k].cantidad;

  const filas = [];
  for (const m of historial.movimientos || []) {
    const its = (m.items || []).filter(coincide);
    if (!its.length) continue;
    const delta = {};
    for (const it of its) for (const [u, n] of Object.entries(it.delta || {})) delta[u] = (delta[u] || 0) + n;
    if (!m.noMueve && !Object.values(delta).some(Boolean)) continue;
    for (const u of Object.keys(delta)) if (!(u in actual)) actual[u] = 0;
    filas.push({
      ...m,
      delta,
      // Si la fila mueve más de lo filtrado, el detalle dice solo lo filtrado.
      detalle: its.length === (m.items || []).length ? m.detalle : its.map((it) => it.texto || it.nombre).join(" · "),
    });
  }

  const unidades = (historial.unidades || []).filter((u) => u.key in actual);
  // Del más nuevo al más viejo: cada fila muestra el saldo después de ella.
  const saldo = { ...actual };
  for (const f of filas) {
    f.saldo = { ...saldo };
    for (const u of unidades) saldo[u.key] -= f.delta[u.key] || 0;
  }
  return { ...historial, unidades, stockActual: actual, saldoAnterior: saldo, movimientos: filas };
};

// Los rubros y productos que se pueden elegir en un historial.
export const opcionesFiltro = (historial, rubro = "") => {
  const rubros = new Set();
  const productos = new Map();
  const sumar = (k, nombre, r) => {
    if (r) rubros.add(r);
    if ((!rubro || r === rubro) && !productos.has(k)) productos.set(k, nombre);
  };
  for (const [k, p] of Object.entries(historial?.stockPorProducto || {})) sumar(k, p.nombre, p.rubro);
  for (const m of historial?.movimientos || []) for (const it of m.items || []) sumar(it.producto, it.nombre, it.rubro);
  return {
    rubros: [...rubros].sort((a, b) => a.localeCompare(b, "es")),
    productos: [...productos].map(([key, nombre]) => ({ key, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true })),
  };
};

// Entrada / salida de una fila, en texto ("3 caj · 2 cajas").
const UNIDAD_CORTA = { cajones: "caj", cajas: "cajas", huevos: "huevos", pollitos: "pollitos", bolsas: "unid." };
export const textoDelta = (m, unidades, signo) =>
  unidades
    .filter((u) => signo * (m.delta?.[u.key] || 0) > 0)
    .map((u) => `${Math.abs(m.delta[u.key]).toLocaleString("es-AR")} ${UNIDAD_CORTA[u.key] || u.key}`)
    .join(" · ");
export const unidadCorta = (key) => UNIDAD_CORTA[key] || key;
export const fechaMovimiento = (m) => (m.soloFecha ? formatearFechaLocal(m.fecha) : new Date(m.fecha).toLocaleString("es-AR"));

/** Excel del historial (lo que se ve: con el filtro aplicado, todas las páginas). */
export const exportarHistorialExcel = (vista, { lugar, filtros = "", operador = "" } = {}) => {
  const unidades = vista.unidades || [];
  const ahora = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  const filas = [
    [`FORRATUC — Historial de movimientos — ${lugar}`],
    [`${filtros ? `Filtro: ${filtros} · ` : ""}Impreso: ${ahora}${operador ? ` · ${operador}` : ""}`],
    [],
    ["Fecha", "Operación", "Rubro", "Detalle", "Usuario", "Entrada", "Salida", ...unidades.map((u) => `Saldo ${unidadCorta(u.key)}`)],
    ...(vista.movimientos || []).map((m) => [
      fechaMovimiento(m),
      m.titulo,
      [...new Set((m.items || []).map((it) => it.rubro))].join(", "),
      m.detalle || "",
      m.usuario || "",
      textoDelta(m, unidades, 1),
      m.noMueve ? "no mueve saldo" : textoDelta(m, unidades, -1),
      ...unidades.map((u) => m.saldo?.[u.key] ?? null),
    ]),
    ["", "Saldo anterior", "", "", "", "", "", ...unidades.map((u) => vista.saldoAnterior?.[u.key] ?? null)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws["!cols"] = [{ wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 50 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, ...unidades.map(() => ({ wch: 12 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
  const nombre = `Movimientos_${String(lugar).replace(/[^\wÁÉÍÓÚáéíóúñÑ]+/g, "_")}_${obtenerFechaHoy()}.xlsx`;
  XLSX.writeFile(wb, nombre);
};
