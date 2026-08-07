import React, { useState } from "react";
import { guardarConfigGalpon } from "../services/api";
import Swal from "sweetalert2";

const GRANJA_LABEL = { "cañete": "Cañete", los_pinos: "Los Pinos" };

// Capacidades de los galpones de engorde y cuáles están fuera de servicio.
// Sin capacidad cargada la proyección no puede decir si los pollitos que nacen
// entran en lo que se libera.
const ConfigModal = ({ galpones, onClose, onGuardado }) => {
  const [filas, setFilas] = useState(
    galpones.map((g) => ({
      ...g,
      capacidad: g.capacidad != null ? String(g.capacidad) : "",
    }))
  );
  const [saving, setSaving] = useState(false);

  const setFila = (i, campo, valor) =>
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));

  const handleGuardar = async () => {
    setSaving(true);
    try {
      // Van de a uno: son 14 upserts sobre la misma colección.
      for (const f of filas) {
        await guardarConfigGalpon({
          granja: f.granja,
          galpon: f.galpon,
          capacidad: f.capacidad === "" ? null : Number(f.capacidad),
          fueraDeServicio: f.fueraDeServicio,
        });
      }
      onGuardado();
      Swal.fire({
        icon: "success",
        title: "Capacidades guardadas",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="bi bi-sliders me-2"></i>Capacidad de los galpones
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-light border small">
                Cuántos pollitos entran en cada galpón. Sin este dato la proyección no puede
                decir si los pollitos que nacen entran o sobran. Los galpones fuera de servicio
                no cuentan para nada.
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Galpón</th>
                      <th>Granja</th>
                      <th style={{ width: "160px" }}>Capacidad</th>
                      <th className="text-center">Fuera de servicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={`${f.granja}-${f.galpon}`} className={f.fueraDeServicio ? "text-muted" : ""}>
                        <td className="fw-semibold">{f.etiqueta}</td>
                        <td className="small text-muted">{GRANJA_LABEL[f.granja]}</td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min="0"
                            placeholder="pollitos"
                            value={f.capacidad}
                            disabled={f.fueraDeServicio}
                            onChange={(e) => setFila(i, "capacidad", e.target.value)}
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={f.fueraDeServicio}
                            onChange={(e) => setFila(i, "fueraDeServicio", e.target.checked)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};
export default ConfigModal;
