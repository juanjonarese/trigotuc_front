import React, { useState } from "react";
import { guardarConfigGalpon, guardarConfigFaena } from "../services/api";
import Swal from "sweetalert2";

const GRANJA_LABEL = { "cañete": "Cañete", los_pinos: "Los Pinos" };

const formatearNumero = (n) =>
  n == null ? "—" : Number(n).toLocaleString("es-AR");

// Los dos parámetros que el cliente maneja de la proyección:
//
//   1. CAPACIDAD por galpón — cuántos pollitos entran en cada uno.
//   2. OBJETIVO DE FAENA — cuántos pollos por día quiere sacar la planta.
//
// Son distintos en naturaleza y por eso están separados en la pantalla: la
// capacidad es un hecho físico de cada galpón, el objetivo es una decisión de
// negocio que vale para toda la planta y que se va a mover (hoy 4.000, mañana
// más si la planta da).
const ConfigModal = ({ galpones, objetivoFaena, mortandadEngorde, onClose, onGuardado }) => {
  const [filas, setFilas] = useState(
    galpones.map((g) => ({
      ...g,
      capacidad: g.capacidad != null ? String(g.capacidad) : "",
    }))
  );
  const [objetivo, setObjetivo] = useState(
    objetivoFaena?.objetivoFaenaDiario != null ? String(objetivoFaena.objetivoFaenaDiario) : ""
  );
  const [saving, setSaving] = useState(false);

  const objetivoNum = Number(objetivo);
  const objetivoInvalido =
    objetivo.trim() !== "" && (!Number.isInteger(objetivoNum) || objetivoNum <= 0);

  // Qué cambia si toca el objetivo: la capacidad instalada no se mueve, pero
  // los días de planta que cubre sí. Mostrarlo evita el "¿por qué bajó la
  // cobertura?" después de guardar.
  const capacidadTotal = galpones
    .filter((g) => !g.fueraDeServicio)
    .reduce((a, g) => a + (Number(g.capacidad) || 0), 0);
  // La mortandad viene del backend, no se repite acá: es el mismo número con el
  // que el almanaque calcula `diasFaenaQueCubre`, y si quedaran dos copias esta
  // cuenta empezaría a mentir el día que se cambie la de allá.
  const diasQueCubre =
    !objetivoInvalido && objetivoNum > 0 && capacidadTotal > 0 && mortandadEngorde != null
      ? (capacidadTotal * (1 - mortandadEngorde)) / objetivoNum
      : null;

  const setFila = (i, campo, valor) =>
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));

  const handleGuardar = async () => {
    if (objetivoInvalido) {
      Swal.fire(
        "Objetivo inválido",
        "El objetivo de faena tiene que ser un número entero de pollos mayor a cero.",
        "warning"
      );
      return;
    }

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
      // Vacío = volver al valor de fábrica. El backend lo interpreta así.
      await guardarConfigFaena({
        objetivoFaenaDiario: objetivo.trim() === "" ? null : objetivoNum,
      });
      onGuardado();
      Swal.fire({
        icon: "success",
        title: "Configuración guardada",
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
                <i className="bi bi-sliders me-2"></i>Parámetros de la proyección
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              {/* ── 1. Objetivo de faena ── */}
              <h6 className="fw-bold text-secondary mb-2">
                <i className="bi bi-bullseye me-1"></i>Objetivo de faena
              </h6>
              <div className="row g-3 align-items-start mb-2">
                <div className="col-sm-5">
                  <label className="form-label small fw-semibold">Pollos por día</label>
                  <input
                    type="number"
                    className={`form-control ${objetivoInvalido ? "is-invalid" : ""}`}
                    min="1"
                    step="1"
                    value={objetivo}
                    placeholder={String(objetivoFaena?.valorPorDefecto ?? 4000)}
                    onChange={(e) => setObjetivo(e.target.value)}
                  />
                  <div className="form-text">
                    Vacío = volver al valor de fábrica (
                    {formatearNumero(objetivoFaena?.valorPorDefecto)}).
                  </div>
                </div>
                <div className="col-sm-7">
                  <div className="alert alert-light border small mb-0">
                    Cuántos pollos quiere sacar la planta por día de faena. Mueve{" "}
                    <strong>todos</strong> los números del almanaque: la cobertura, los huecos
                    y los días de planta que cubre cada galpón.
                    {diasQueCubre != null && (
                      <div className="mt-1">
                        Con {formatearNumero(capacidadTotal)} pollitos de capacidad instalada,{" "}
                        <strong>{diasQueCubre.toFixed(1)} días</strong> de planta por tanda
                        completa.
                      </div>
                    )}
                    {objetivoFaena?.porDefecto && objetivo.trim() !== "" && (
                      <div className="mt-1 text-muted">
                        Hasta ahora estaba usando el valor de fábrica — nadie lo había
                        configurado.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="my-3" />

              {/* ── 2. Capacidad por galpón ── */}
              <h6 className="fw-bold text-secondary mb-2">
                <i className="bi bi-grid-3x3-gap me-1"></i>Capacidad de los galpones
              </h6>
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
