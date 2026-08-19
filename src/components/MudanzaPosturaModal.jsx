import React, { useState } from "react";
import { mudarLoteAPostura } from "../services/api";
import { ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import { formatearNumero, nombreGalpon } from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

/**
 * Mudanza de recría a postura. Ocurre una sola vez por plantel: el plantel entero
 * cambia de galpón conservando su número. Se usa desde Galpones y desde la
 * pantalla de carga de datos semanales.
 */
const MudanzaPosturaModal = ({ lote, constantes, lotes = [], onClose, onHecho }) => {
  const [galponDestino, setGalponDestino] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const galponesPostura = constantes?.galpones?.postura || [];
  const ocupados = new Set(
    lotes.filter((l) => l.sector === "postura" && l.estado !== "finalizado").map((l) => l.galpon)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!galponDestino) {
      Swal.fire("Falta el galpón", "Elegí el galpón de postura de destino.", "warning");
      return;
    }
    setSaving(true);
    try {
      await mudarLoteAPostura(lote._id, {
        galponDestino: Number(galponDestino),
        fecha: ajustarFechaParaGuardar(fecha),
        observaciones: observaciones || undefined,
      });
      onHecho();
      Swal.fire({
        icon: "success",
        title: "Plantel mudado a postura",
        text: `Plantel #${lote.numeroLote} → ${nombreGalpon(constantes?.galpones, "postura", galponDestino)}`,
        timer: 2400,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar la mudanza.", "error");
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
                <i className="bi bi-arrow-right-circle me-2"></i>Mudar a postura
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-mudanza" onSubmit={handleSubmit}>
                <div className="alert alert-light border small">
                  Se muda el <strong>plantel #{lote.numeroLote}</strong> completo:{" "}
                  {formatearNumero(lote.hembras?.actual)} hembras y{" "}
                  {formatearNumero(lote.machos?.actual)} machos. El plantel conserva su número y
                  queda habilitado para cargar recolección de huevos desde la semana{" "}
                  {constantes?.semanaInicioPostura ?? 24}.
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Galpón de postura</label>
                  <div className="d-flex flex-wrap gap-2">
                    {galponesPostura.map((g) => {
                      const ocupado = ocupados.has(g.numero);
                      const sel = Number(galponDestino) === g.numero;
                      return (
                        <button
                          key={g.numero}
                          type="button"
                          className={`btn ${
                            ocupado ? "btn-danger disabled" : sel ? "btn-primary" : "btn-outline-secondary"
                          }`}
                          disabled={ocupado}
                          onClick={() => !ocupado && setGalponDestino(g.numero)}
                          title={ocupado ? "Galpón ocupado" : g.nombre}
                        >
                          {ocupado ? <i className="bi bi-lock-fill me-1"></i> : null}
                          {g.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha de la mudanza</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
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
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" form="form-mudanza" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Confirmar mudanza
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default MudanzaPosturaModal;
