import React, { useState } from "react";
import { trasladarAvesReproductor, eliminarTrasladoReproductor } from "../services/api";
import { ajustarFechaParaGuardar, obtenerFechaHoy, formatearFechaLocal } from "../utils/dateUtils";
import { formatearNumero, nombreGalpon, SEXO_LABEL } from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

/**
 * Traslado de aves entre planteles (2026-10-27). Las aves pasan vivas de un
 * galpón a otro: resta acá y suma en el destino, y NO cuenta como mortandad.
 * Abajo, los traslados del plantel, con la opción de deshacerlos.
 */
const TrasladoAvesModal = ({ lote, constantes, lotes = [], onClose, onHecho }) => {
  const [sexo, setSexo] = useState("macho");
  const [cantidad, setCantidad] = useState("");
  const [destino, setDestino] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const destinos = lotes.filter((l) => l._id !== lote._id && l.estado !== "finalizado");
  const disponible = sexo === "hembra" ? lote.hembras?.actual || 0 : lote.machos?.actual || 0;
  const traslados = [...(lote.traslados || [])].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const galpon = (sector, numero) => nombreGalpon(constantes?.galpones, sector, numero);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cant = Number(cantidad);
    if (!destino) {
      Swal.fire("Falta el destino", "Elegí a qué galpón van las aves.", "warning");
      return;
    }
    if (!Number.isInteger(cant) || cant <= 0 || cant > disponible) {
      Swal.fire("Cantidad", `Cargá un número entre 1 y ${formatearNumero(disponible)}.`, "warning");
      return;
    }
    setSaving(true);
    try {
      await trasladarAvesReproductor({
        origen: lote._id,
        destino,
        sexo,
        cantidad: cant,
        fecha: ajustarFechaParaGuardar(fecha),
        observaciones: observaciones || undefined,
      });
      const dest = destinos.find((l) => l._id === destino);
      onHecho();
      Swal.fire({
        icon: "success",
        title: "Traslado registrado",
        text: `${formatearNumero(cant)} ${sexo === "hembra" ? "hembras" : "machos"} → ${galpon(dest?.sector, dest?.galpon)}`,
        timer: 2400,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el traslado.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deshacer = async (t) => {
    const r = await Swal.fire({
      icon: "question",
      title: "¿Deshacer el traslado?",
      text: `Vuelven ${formatearNumero(t.cantidad)} ${t.sexo === "hembra" ? "hembras" : "machos"} al plantel de origen.`,
      showCancelButton: true,
      confirmButtonText: "Deshacer",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    setSaving(true);
    try {
      await eliminarTrasladoReproductor(lote._id, t._id);
      onHecho();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo deshacer el traslado.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="bi bi-arrow-left-right me-2"></i>Trasladar aves
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-traslado" onSubmit={handleSubmit}>
                <div className="alert alert-light border small">
                  Las aves pasan <strong>vivas</strong> del plantel #{lote.numeroLote} a otro galpón: no
                  cuentan como mortandad. Hoy hay {formatearNumero(lote.hembras?.actual)} hembras y{" "}
                  {formatearNumero(lote.machos?.actual)} machos.
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Sexo</label>
                  <div className="btn-group w-100">
                    {["macho", "hembra"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`btn ${sexo === s ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setSexo(s)}
                      >
                        {SEXO_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Galpón de destino</label>
                  {destinos.length === 0 ? (
                    <div className="text-muted small">No hay otro plantel activo.</div>
                  ) : (
                    <div className="d-flex flex-wrap gap-2">
                      {destinos.map((l) => (
                        <button
                          key={l._id}
                          type="button"
                          className={`btn ${destino === l._id ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setDestino(l._id)}
                        >
                          {galpon(l.sector, l.galpon)} · #{l.numeroLote}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      max={disponible}
                      className="form-control"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      required
                    />
                    <div className="form-text">Hay {formatearNumero(disponible)}</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label fw-semibold">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </form>

              {traslados.length > 0 && (
                <>
                  <hr />
                  <div className="fw-semibold small mb-2">Traslados de este plantel</div>
                  <ul className="list-group list-group-flush small">
                    {traslados.map((t) => (
                      <li key={t._id} className="list-group-item px-0 d-flex justify-content-between align-items-center gap-2">
                        <span>
                          {formatearFechaLocal(t.fecha)} · sem {t.semana} ·{" "}
                          <span className={t.tipo === "entrada" ? "text-success" : "text-danger"}>
                            {t.tipo === "entrada" ? "+" : "−"}
                            {formatearNumero(t.cantidad)} {t.sexo === "hembra" ? "hembras" : "machos"}
                          </span>{" "}
                          {t.tipo === "entrada" ? "del" : "al"} galpón {t.galponRelacionado} (#{t.numeroLoteRelacionado})
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deshacer(t)}
                          disabled={saving}
                          title="Deshacer"
                        >
                          <i className="bi bi-arrow-counterclockwise"></i>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cerrar
              </button>
              <button type="submit" form="form-traslado" className="btn btn-primary" disabled={saving || !destinos.length}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Trasladar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default TrasladoAvesModal;
