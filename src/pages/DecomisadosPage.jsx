import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerDecomisados,
  crearDecomisado,
  eliminarDecomisado,
  obtenerLotes,
} from "../services/api";
import Swal from "sweetalert2";

const formatNum = (n) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n ?? 0);

const DecomisadosPage = () => {
  const rolUsuario     = localStorage.getItem("rolUsuario");
  const esAdmin        = rolUsuario === "superadmin";
  const puedeGestionar = rolUsuario === "superadmin" || rolUsuario === "granja";

  const [decomisados, setDecomisados] = useState([]);
  const [lotes,       setLotes]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [saving,      setSaving]      = useState(false);

  const hoy = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    fecha:         hoy,
    lote:          "",
    unidades:      "",
    causa:         "",
    observaciones: "",
  });

  const cargarDatos = useCallback(async () => {
    try {
      const [decomData, lotesData] = await Promise.all([
        obtenerDecomisados(),
        obtenerLotes(),
      ]);
      setDecomisados(decomData);
      setLotes(lotesData.filter((l) => l.estado === "activo"));
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const loteSeleccionado = lotes.find((l) => l._id === form.lote);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lote) {
      Swal.fire("Error", "Debe seleccionar un lote", "error");
      return;
    }
    if (!form.causa.trim()) {
      Swal.fire("Error", "Debe indicar la causa del decomiso", "error");
      return;
    }
    if (!form.unidades || Number(form.unidades) <= 0) {
      Swal.fire("Error", "Las unidades deben ser mayor a 0", "error");
      return;
    }
    if (loteSeleccionado && Number(form.unidades) > loteSeleccionado.cantidadActual) {
      Swal.fire(
        "Error",
        `Las unidades superan la cantidad actual del lote (${formatNum(loteSeleccionado.cantidadActual)})`,
        "error"
      );
      return;
    }
    setSaving(true);
    try {
      await crearDecomisado({
        fecha:     form.fecha,
        lote:      form.lote,
        unidades:  Number(form.unidades),
        causa:     form.causa,
        observaciones: form.observaciones || undefined,
      });
      Swal.fire("Guardado", "Decomisado registrado correctamente", "success");
      setShowModal(false);
      setForm({ fecha: hoy, lote: "", unidades: "", causa: "", observaciones: "" });
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el decomisado", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (dec) => {
    const conf = await Swal.fire({
      title: "¿Eliminar decomisado?",
      html: `Se restaurarán <strong>${formatNum(dec.unidades)} pollos</strong> al lote.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!conf.isConfirmed) return;
    try {
      await eliminarDecomisado(dec._id);
      Swal.fire("Eliminado", "Decomisado eliminado y lote restaurado", "success");
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar", "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-x-octagon me-2 text-danger"></i>
            Decomisados
          </h1>
          <div className="d-flex flex-wrap gap-2">
            {puedeGestionar && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowModal(true)}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Registrar Decomiso
              </button>
            )}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={cargarDatos}
              title="Refrescar"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        {/* Listado */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : decomisados.length === 0 ? (
              <p className="text-center text-muted p-4">No hay decomisados registrados.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {decomisados.map((dec) => (
                    <div key={dec._id} className="card border mb-3">
                      <div className="card-body py-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <span className="fw-semibold">
                              {new Date(dec.fecha).toLocaleDateString("es-AR")}
                            </span>
                            {dec.lote && (
                              <div className="text-muted small">
                                Lote #{dec.lote.numeroLote || "—"} —{" "}
                                {new Date(dec.lote.fechaIngreso).toLocaleDateString("es-AR")}
                              </div>
                            )}
                          </div>
                          {esAdmin && (
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleEliminar(dec)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                        <div className="row g-2 text-center mb-2">
                          <div className="col-6 border-end">
                            <div className="text-muted small">Unidades</div>
                            <div className="fw-bold text-danger">{formatNum(dec.unidades)}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted small">Causa</div>
                            <div className="fw-bold small">{dec.causa}</div>
                          </div>
                        </div>
                        {dec.observaciones && (
                          <div className="text-muted small">{dec.observaciones}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Fecha</th>
                        <th>Lote</th>
                        <th className="text-end">Unidades</th>
                        <th>Causa</th>
                        <th>Observaciones</th>
                        {esAdmin && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {decomisados.map((dec) => (
                        <tr key={dec._id}>
                          <td>{new Date(dec.fecha).toLocaleDateString("es-AR")}</td>
                          <td>
                            {dec.lote ? (
                              <>
                                {dec.lote.numeroLote ? (
                                  <span className="badge bg-dark me-1">#{dec.lote.numeroLote}</span>
                                ) : null}
                                {new Date(dec.lote.fechaIngreso).toLocaleDateString("es-AR")}
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-end text-danger fw-semibold">
                            {formatNum(dec.unidades)}
                          </td>
                          <td>{dec.causa}</td>
                          <td className="text-muted">{dec.observaciones || "—"}</td>
                          {esAdmin && (
                            <td>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleEliminar(dec)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-fullscreen-sm-down modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Registrar Decomisado</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body" style={{ overflowX: "hidden" }}>
                  <div className="mb-3">
                    <label className="form-label">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      name="fecha"
                      value={form.fecha}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Lote</label>
                    <select
                      className="form-select"
                      name="lote"
                      value={form.lote}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Seleccione un lote activo...</option>
                      {lotes.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.numeroLote ? `#${l.numeroLote} — ` : ""}
                          {new Date(l.fechaIngreso).toLocaleDateString("es-AR")} (
                          {formatNum(l.cantidadActual)} pollos)
                        </option>
                      ))}
                    </select>
                    {loteSeleccionado && (
                      <div className="form-text">
                        Cantidad actual del lote:{" "}
                        <strong>{formatNum(loteSeleccionado.cantidadActual)} pollos</strong>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Unidades decomisadas</label>
                    <input
                      type="number"
                      className="form-control"
                      name="unidades"
                      value={form.unidades}
                      onChange={handleChange}
                      min="1"
                      max={loteSeleccionado?.cantidadActual || undefined}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Causa</label>
                    <input
                      type="text"
                      className="form-control"
                      name="causa"
                      value={form.causa}
                      onChange={handleChange}
                      placeholder="Ej: enfermedad, golpe, falla eléctrica..."
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Observaciones</label>
                    <textarea
                      className="form-control"
                      name="observaciones"
                      value={form.observaciones}
                      onChange={handleChange}
                      rows={2}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-danger" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Guardando...
                      </>
                    ) : (
                      "Registrar Decomiso"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DecomisadosPage;
