import * as XLSX from "xlsx";
import { obtenerFechaHoy } from "../dateUtils";

/**
 * Planilla de conteo por depósito de Forratuc (2026-11-06, pedido del usuario):
 * lo que dice el sistema y columnas en blanco para lo contado y la diferencia
 * (+/−). Se imprime (imprimirForratuc.js) o se exporta a Excel (acá), y las dos
 * salen de las MISMAS secciones (`seccionesConteo`).
 */

const ETIQUETA_RUBRO = { alimento: "Alimento balanceado", otros: "Otros" };

/**
 * En qué grupo va un producto de depósito (una sola regla para Stock, ingreso,
 * ajuste y conteo). Con categoría — sea de rubro alimento u "otros" (desde el
 * 19/11: muchos alimentos se dieron de alta en "otros") — va con el alimento de
 * esa categoría; sin categoría, el alimento en "Sin categoría" y el resto en "Otros".
 * `p` es un producto de GET /stock-forratuc (alimento.productos).
 */
export const grupoDeposito = (p) =>
  p.categoria || p.rubro !== "otros"
    ? `${ETIQUETA_RUBRO.alimento} — ${p.categoriaEtiqueta || "Sin categoría"}`
    : ETIQUETA_RUBRO.otros;

/**
 * Las secciones de un depósito: primero `extras` (en la Forrajería, los huevos
 * y los pollitos), después los productos de depósito por rubro y al final los
 * extras marcados `alFinal` (en la Forrajería, el pollo de la cámara). Entran todos los activos, aunque estén en cero: un cero que
 * aparece en el depósito también es una diferencia.
 *
 * `rubros` (2026-11-25, pedido del usuario: "elegir lo que voy a controlar"):
 * los títulos de sección que entran; null = todos.
 *
 * @returns [{ titulo, filas: [{ codigo, etiqueta, unidad, sistema }] }]
 */
export const seccionesConteo = (deposito, productos = [], extras = [], rubros = null) => {
  const filas = productos
    .filter((p) => p.activo || (p.porDeposito?.[deposito.key] || 0) !== 0)
    .map((p) => ({
      codigo: p.codigo, etiqueta: p.etiqueta, unidad: p.unidad, sistema: p.porDeposito?.[deposito.key] || 0,
      // El alimento va por categoría (bovinos, parrilleros…; 2026-11-12).
      grupo: grupoDeposito(p),
    }));
  const todas = [
    ...extras.filter((e) => !e.alFinal),
    ...[...new Set(filas.map((p) => p.grupo))].map((g) => ({
      titulo: g,
      filas: filas.filter((p) => p.grupo === g),
    })),
    ...extras.filter((e) => e.alFinal),
  ];
  return rubros ? todas.filter((s) => rubros.includes(s.titulo)) : todas;
};

// Nombre de hoja válido para Excel: sin \ / ? * [ ] :, hasta 31, sin repetir.
const nombreHoja = (texto, usados) => {
  const base = String(texto).replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  let nombre = base;
  for (let n = 2; usados.has(nombre); n++) nombre = `${base.slice(0, 28)} ${n}`;
  usados.add(nombre);
  return nombre;
};

/**
 * Un .xlsx con una hoja por depósito. "Contado" queda en blanco para cargar y
 * "Diferencia" es una fórmula (Contado − Sistema) que se completa sola.
 */
export const exportarConteoExcel = (depositos, productos, { extras = {}, operador = "", rubros = null } = {}) => {
  const wb = XLSX.utils.book_new();
  const usados = new Set();
  const ahora = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

  for (const d of depositos) {
    const filas = [
      [`FORRATUC — Conteo de stock — ${d.etiqueta}`],
      [`Impreso: ${ahora}${operador ? ` · ${operador}` : ""}`, "", "", "", "Fecha del conteo:"],
      [],
      ["Código", "Producto", "Unidad", "Sistema", "Contado", "Diferencia (+/−)", "Observaciones"],
    ];
    const formulas = []; // filas (0-based) que llevan la fórmula de diferencia
    for (const sec of seccionesConteo(d, productos, extras[d.key] || [], rubros)) {
      filas.push(["", sec.titulo.toUpperCase()]);
      if (!sec.filas.length) filas.push(["", "Sin stock en el sistema", "", 0]);
      for (const p of sec.filas) {
        formulas.push(filas.length);
        filas.push([p.codigo || "", p.etiqueta, p.unidad || "", Number(p.sistema) || 0, null, null, ""]);
      }
    }
    filas.push([], ["", "Otros (lo que aparezca y no esté en la lista)"]);
    for (let i = 0; i < 3; i++) {
      formulas.push(filas.length);
      filas.push(["", "", "", null, null, null, ""]);
    }
    filas.push([], ["Diferencia = Contado − Sistema: + sobra, − falta."], [], ["Contó:", "", "", "Controló:"]);

    const ws = XLSX.utils.aoa_to_sheet(filas);
    for (const r of formulas) {
      const fila = r + 1; // Excel cuenta desde 1
      // Con valor vacío: sin `v` la librería no escribe la celda. Excel la calcula al abrir.
      ws[XLSX.utils.encode_cell({ r, c: 5 })] = { t: "s", v: "", f: `IF(E${fila}="","",E${fila}-D${fila})` };
    }
    ws["!cols"] = [{ wch: 10 }, { wch: 42 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 30 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja(d.etiqueta, usados));
  }

  XLSX.writeFile(wb, `Conteo_stock_Forratuc_${obtenerFechaHoy()}.xlsx`);
};
