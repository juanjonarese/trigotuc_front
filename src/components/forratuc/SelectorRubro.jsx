import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { crearRubroForratuc, renombrarRubroForratuc } from "../../services/api";

/**
 * Desplegable de Rubro del alta de productos de Forratuc (2026-11-25, pedido del
 * usuario: "que se pueda crear un rubro: cuando se despliega el menú que diga
 * crear, y que se puedan cambiar los existentes con el lápiz").
 *
 * Arriba los del sistema (Alimento balanceado, Otros: fijos), después los que
 * creó el usuario (con el lápiz para renombrar) y al final "Crear rubro".
 * Un rubro propio es, para el sistema, uno de "otros" con `rubroPropio`.
 *
 * Desde el 25/11 también "Mostrar con la avícola" (`vista`: Pollo entero,
 * Trozado, Huevo, Pollitos): uno de "otros" que se agrupa ahí (la "Bolsa de
 * trocitos" en Trozado) sin cambiar de dónde sale su stock.
 *
 * value: { rubro, rubroPropio, rubroVista }  ·  onChange({ rubro, rubroPropio, rubroVista })
 * onRubrosCambiaron(): se llama al crear o renombrar, para recargar listas.
 */
const SelectorRubro = ({ value, onChange, sistema = [], propios = [], vista = [], onRubrosCambiaron }) => {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrar = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierto]);

  const propioActual = value?.rubroPropio ? propios.find((r) => r._id === String(value.rubroPropio)) : null;
  const vistaActual = !value?.rubroPropio && value?.rubroVista ? vista.find((r) => r.key === value.rubroVista) : null;
  const etiqueta = propioActual?.nombre || vistaActual?.etiqueta || sistema.find((r) => r.key === value?.rubro)?.etiqueta || "Elegí el rubro";

  const pedirNombre = (titulo, inicial = "") =>
    Swal.fire({
      title: titulo,
      input: "text",
      inputValue: inicial,
      inputPlaceholder: "Ej.: Mascotas",
      inputAttributes: { maxlength: 60 },
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      inputValidator: (v) => (!v?.trim() ? "Poné el nombre del rubro." : undefined),
    });

  const crear = async () => {
    setAbierto(false);
    const { value: nombre, isConfirmed } = await pedirNombre("Crear rubro");
    if (!isConfirmed) return;
    try {
      const r = await crearRubroForratuc(nombre.trim());
      await onRubrosCambiaron?.();
      onChange({ rubro: "otros", rubroPropio: r._id, rubroVista: null });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el rubro.", "error");
    }
  };

  const renombrar = async (r) => {
    setAbierto(false);
    const { value: nombre, isConfirmed } = await pedirNombre("Cambiar el nombre del rubro", r.nombre);
    if (!isConfirmed || nombre.trim() === r.nombre) return;
    try {
      await renombrarRubroForratuc(r._id, nombre.trim());
      await onRubrosCambiaron?.();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cambiar el rubro.", "error");
    }
  };

  const elegir = (cambios) => {
    onChange(cambios);
    setAbierto(false);
  };

  return (
    <div className="dropdown" ref={caja}>
      <button type="button" className="form-select text-start" onClick={() => setAbierto((a) => !a)}>
        {etiqueta}
      </button>
      {abierto && (
        <ul className="dropdown-menu show w-100 shadow" style={{ maxHeight: 320, overflowY: "auto" }}>
          {sistema.map((r) => (
            <li key={r.key}>
              <button type="button" className={`dropdown-item ${!value?.rubroPropio && !value?.rubroVista && value?.rubro === r.key ? "active" : ""}`}
                onClick={() => elegir({ rubro: r.key, rubroPropio: null, rubroVista: null })}>
                {r.etiqueta}
              </button>
            </li>
          ))}
          {vista.length > 0 && (
            <>
              <li><hr className="dropdown-divider" /></li>
              <li><h6 className="dropdown-header">Mostrar con la avícola</h6></li>
              {vista.map((r) => (
                <li key={r.key}>
                  <button type="button" className={`dropdown-item ${vistaActual?.key === r.key ? "active" : ""}`}
                    onClick={() => elegir({ rubro: "otros", rubroPropio: null, rubroVista: r.key })}>
                    {r.etiqueta}
                  </button>
                </li>
              ))}
            </>
          )}
          {propios.length > 0 && <li><hr className="dropdown-divider" /></li>}
          {propios.map((r) => (
            <li key={r._id} className="d-flex align-items-center">
              <button type="button" className={`dropdown-item flex-grow-1 ${String(value?.rubroPropio) === r._id ? "active" : ""}`}
                onClick={() => elegir({ rubro: "otros", rubroPropio: r._id, rubroVista: null })}>
                {r.nombre}
              </button>
              <button type="button" className="btn btn-sm btn-link text-secondary px-2" title="Cambiar el nombre"
                onClick={() => renombrar(r)}>
                <i className="bi bi-pencil"></i>
              </button>
            </li>
          ))}
          <li><hr className="dropdown-divider" /></li>
          <li>
            <button type="button" className="dropdown-item text-primary fw-semibold" onClick={crear}>
              <i className="bi bi-plus-lg me-1"></i>Crear rubro
            </button>
          </li>
        </ul>
      )}
    </div>
  );
};

export default SelectorRubro;
