import * as XLSX from "xlsx";
import { obtenerFechaHoy } from "./dateUtils";

/**
 * Arma una hoja a partir de filas + columnas declaradas.
 *
 * Las columnas se declaran igual que en la tabla de pantalla: un header y una
 * función que saca el valor de la fila. Devolver un Number (no un string
 * formateado) es importante — Excel tiene que poder sumar la columna.
 *
 * @param {Object[]} filas    Datos ya filtrados (lo que ve el usuario).
 * @param {Object[]} columnas [{ header, valor: (fila) => any, ancho?: number }]
 */
const armarHoja = ({ filas, columnas }) => {
  const headers = columnas.map((c) => c.header);
  const cuerpo  = filas.map((fila) =>
    columnas.map((c) => {
      const v = c.valor(fila);
      return v === null || v === undefined || v === "" ? "—" : v;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...cuerpo]);

  // Ancho de columna: el declarado, o el del contenido más largo (acotado).
  ws["!cols"] = columnas.map((c, i) => ({
    wch: c.ancho ?? Math.min(
      40,
      Math.max(headers[i].length, ...cuerpo.map((f) => String(f[i]).length)) + 2
    ),
  }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: cuerpo.length, c: columnas.length - 1 },
  }) };

  return ws;
};

/** Exporta una sola tabla a un .xlsx de una hoja. */
export const exportarTablaExcel = ({ filas, columnas, nombreHoja = "Datos", nombreArchivo = "export" }) =>
  exportarLibroExcel({ hojas: [{ nombre: nombreHoja, filas, columnas }], nombreArchivo });

/**
 * Exporta varias tablas a un mismo .xlsx, una hoja por tabla. Es lo que usa
 * Proyección: los tres carriles del gráfico son tres tablas distintas y
 * mezclarlas en una sola hoja no se puede leer.
 *
 * @param {Object[]} hojas [{ nombre, filas, columnas }] — las vacías se saltean.
 */
export const exportarLibroExcel = ({ hojas, nombreArchivo = "export" }) => {
  const wb = XLSX.utils.book_new();
  const usados = new Set();

  for (const hoja of hojas) {
    if (!hoja || !hoja.filas?.length) continue;
    // Excel corta los nombres de hoja en 31 y no admite repetidos.
    let nombre = (hoja.nombre || "Datos").slice(0, 31);
    let n = 2;
    while (usados.has(nombre)) nombre = `${(hoja.nombre || "Datos").slice(0, 28)} ${n++}`;
    usados.add(nombre);
    XLSX.utils.book_append_sheet(wb, armarHoja(hoja), nombre);
  }

  if (!wb.SheetNames.length) return false;
  XLSX.writeFile(wb, `${nombreArchivo}_${obtenerFechaHoy()}.xlsx`);
  return true;
};
