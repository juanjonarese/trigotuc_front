import React from "react";

/**
 * Botón estándar de descarga a Excel. La pantalla arma las columnas y llama a
 * `exportarTablaExcel` (src/utils/exportarExcel.js); esto es solo el markup,
 * para que el botón se vea igual en todas las secciones.
 */
const BotonExcel = ({ onClick, disabled = false, className = "", titulo = "Descargar Excel" }) => (
  <button
    type="button"
    className={`btn btn-outline-success btn-sm ${className}`}
    onClick={onClick}
    disabled={disabled}
    title={disabled ? "No hay datos para exportar" : titulo}
  >
    <i className="bi bi-file-earmark-excel me-1"></i>Excel
  </button>
);

export default BotonExcel;
