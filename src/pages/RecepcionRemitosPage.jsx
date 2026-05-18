import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  obtenerRemitosGranja,
  confirmarRecepcionRemito,
  eliminarRemitoGranja,
} from "../services/api";
import Swal from "sweetalert2";

const rolUsuario   = () => localStorage.getItem("rolUsuario");
const esSuperAdmin = () => rolUsuario() === "superadmin";

const GRANJA_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJA_PREFIX = { cañete: "C", los_pinos: "P" };

const fmtNum   = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";

const badgeEstado = (estado) => {
  if (estado === "en_transito") return <span className="badge bg-warning text-dark">En tránsito</span>;
  if (estado === "recibido")    return <span className="badge bg-success">Recibido ✓</span>;
  return <span className="badge bg-secondary">{estado}</span>;
};

const RecepcionRemitosPage = () => {
  const navigate = useNavigate();
  const [remitos, setRemitos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("en_transito");

  // Modal recepción
  const [remitoRec, setRemitoRec]         = useState(null);
  const [formRec, setFormRec]             = useState({ muertos: "0", kgMuertos: "", decomisados: "0", kgDecomisados: "", observaciones: "" });
  const [submittingRec, setSubmittingRec] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerRemitosGranja(filtroEstado ? { estado: filtroEstado } : {});
      setRemitos(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Confirmar recepción ──
  const netosRecepcion = remitoRec
    ? remitoRec.cantidadEnviada - Number(formRec.muertos || 0) - Number(formRec.decomisados || 0)
    : 0;

  const handleRecepcion = async (e) => {
    e.preventDefault();
    const muertos     = Number(formRec.muertos     || 0);
    const decomisados = Number(formRec.decomisados || 0);
    if (muertos + decomisados > remitoRec.cantidadEnviada) {
      Swal.fire("Error", "La suma de muertos y decomisados supera la cantidad enviada.", "error");
      return;
    }
    setSubmittingRec(true);
    try {
      await confirmarRecepcionRemito(remitoRec._id, {
        muertos,
        kgMuertos:    formRec.kgMuertos    ? Number(formRec.kgMuertos)    : 0,
        decomisados,
        kgDecomisados: formRec.kgDecomisados ? Number(formRec.kgDecomisados) : 0,
        observaciones: formRec.observaciones || undefined,
      });
      setRemitoRec(null);
      await cargar();
      Swal.fire({
        icon: "success",
        title: "Recepción confirmada",
        html: `Enviados: <strong>${fmtNum(remitoRec.cantidadEnviada)}</strong><br/>
               Muertos: <strong>${fmtNum(muertos)}</strong> · Decomisados: <strong>${fmtNum(decomisados)}</strong><br/>
               <span class="text-success fw-bold">Netos para faena: ${fmtNum(remitoRec.cantidadEnviada - muertos - decomisados)}</span>`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmittingRec(false);
    }
  };

  const handleEliminar = async (remito) => {
    const ok = await Swal.fire({ title: "¿Eliminar remito?", text: remito.numeroRemito, icon: "warning", showCancelButton: true, confirmButtonColor: "#dc3545", confirmButtonText: "Eliminar", cancelButtonText: "Cancelar" });
    if (!ok.isConfirmed) return;
    try { await eliminarRemitoGranja(remito._id); await cargar(); }
    catch (err) { Swal.fire("Error", err.message, "error"); }
  };

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-arrow-in-down me-2 text-primary"></i>
            Recepción de Remitos
          </h1>
        </div>

        {/* Filtros */}
        <div className="d-flex gap-2 mb-3 flex-wrap">
          {[
            { v: "en_transito", l: "En tránsito" },
            { v: "recibido",    l: "Recibidos" },
            { v: "",            l: "Todos" },
          ].map(({ v, l }) => (
            <button key={v} className={`btn btn-sm ${filtroEstado === v ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => setFiltroEstado(v)}>{l}</button>
          ))}
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4"><div className="spinner-border text-primary"></div></div>
            ) : remitos.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">
                {filtroEstado === "en_transito" ? "No hay remitos en tránsito." : filtroEstado === "recibido" ? "No hay remitos recibidos." : "No hay remitos registrados."}
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Código</th>
                      <th>Origen</th>
                      <th>Fecha envío</th>
                      <th className="text-end">Enviados</th>
                      <th className="text-end">Muertos</th>
                      <th className="text-end">Decomis.</th>
                      <th className="text-end">Netos</th>
                      <th>Estado</th>
                      <th>Lote ingresado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {remitos.map((r) => {
                      const lote = r.loteGranja;
                      return (
                        <tr key={r._id}>
                          <td><span className="badge bg-primary fs-6">{r.numeroRemito}</span></td>
                          <td className="small">
                            {lote ? `${GRANJA_LABEL[lote.granja]} G${GRANJA_PREFIX[lote.granja]}${lote.galpon}` : "—"}
                          </td>
                          <td className="small">{fmtFecha(r.fechaEnvio)}</td>
                          <td className="text-end fw-semibold">{fmtNum(r.cantidadEnviada)}</td>
                          <td className="text-end">
                            {r.muertos != null && r.estado !== "en_transito"
                              ? <span className={r.muertos > 0 ? "text-danger" : "text-muted"}>{fmtNum(r.muertos)}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className="text-end">
                            {r.decomisados != null && r.estado !== "en_transito"
                              ? <span className={r.decomisados > 0 ? "text-warning" : "text-muted"}>{fmtNum(r.decomisados)}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className="text-end">
                            {r.netos != null
                              ? <span className="fw-bold text-success">{fmtNum(r.netos)}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>{badgeEstado(r.estado)}</td>
                          <td>
                            {r.loteIngresado
                              ? <span className="badge bg-success">Lote #{r.loteIngresado?.numeroLote ?? "✓"}</span>
                              : <span className="text-muted small">—</span>}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              {r.estado === "en_transito" && (
                                <button className="btn btn-warning btn-sm" onClick={() => { setRemitoRec(r); setFormRec({ muertos: "0", decomisados: "0", observaciones: "" }); }}>
                                  Recepcionar
                                </button>
                              )}
                              {r.estado === "recibido" && !r.loteIngresado && (
                                <button className="btn btn-success btn-sm" onClick={() => navigate(`/frigorifico/lotes/nuevo?remito=${r._id}`)}>
                                  <i className="bi bi-plus-circle me-1"></i>Ingresar lote
                                </button>
                              )}
                              {esSuperAdmin() && (
                                <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(r)}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal confirmar recepción */}
      {remitoRec && (
        <>
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header bg-warning text-dark">
                  <h5 className="modal-title">Recepción — {remitoRec.numeroRemito}</h5>
                  <button className="btn-close" onClick={() => setRemitoRec(null)} disabled={submittingRec}></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-primary py-2 mb-3">
                    Enviados desde granja: <strong>{fmtNum(remitoRec.cantidadEnviada)} pollos</strong>
                    {remitoRec.pesoEstimadoKg && <> · {fmtNum(remitoRec.pesoEstimadoKg)} kg est.</>}
                  </div>
                  <form id="form-recepcion" onSubmit={handleRecepcion}>
                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold text-danger">Muertos (u)</label>
                        <input
                          type="number" className="form-control"
                          value={formRec.muertos}
                          onChange={(e) => setFormRec({ ...formRec, muertos: e.target.value })}
                          min="0" max={remitoRec.cantidadEnviada} required autoFocus
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold text-danger">Muertos (kg)</label>
                        <input
                          type="number" className="form-control"
                          value={formRec.kgMuertos}
                          onChange={(e) => setFormRec({ ...formRec, kgMuertos: e.target.value })}
                          min="0" step="0.01" placeholder="0"
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold text-warning">Decomisados (u)</label>
                        <input
                          type="number" className="form-control"
                          value={formRec.decomisados}
                          onChange={(e) => setFormRec({ ...formRec, decomisados: e.target.value })}
                          min="0" max={remitoRec.cantidadEnviada} required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold text-warning">Decomisados (kg)</label>
                        <input
                          type="number" className="form-control"
                          value={formRec.kgDecomisados}
                          onChange={(e) => setFormRec({ ...formRec, kgDecomisados: e.target.value })}
                          min="0" step="0.01" placeholder="0"
                        />
                      </div>
                      <div className="col-12">
                        <div className={`alert py-2 mb-0 ${netosRecepcion < 0 ? "alert-danger" : "alert-success"}`}>
                          <span className="me-2">Netos para faena:</span>
                          <strong className="fs-5">{netosRecepcion >= 0 ? fmtNum(netosRecepcion) : "⚠ Error"} pollos</strong>
                          <span className="text-muted ms-2 small">
                            ({fmtNum(remitoRec.cantidadEnviada)} − {fmtNum(Number(formRec.muertos || 0))} − {fmtNum(Number(formRec.decomisados || 0))})
                          </span>
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Observaciones <span className="text-muted">(opcional)</span></label>
                        <textarea className="form-control" rows={2} value={formRec.observaciones}
                          onChange={(e) => setFormRec({ ...formRec, observaciones: e.target.value })} />
                      </div>
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setRemitoRec(null)} disabled={submittingRec}>Cancelar</button>
                  <button type="submit" form="form-recepcion" className="btn btn-warning" disabled={submittingRec || netosRecepcion < 0}>
                    {submittingRec && <span className="spinner-border spinner-border-sm me-1"></span>}
                    Confirmar recepción
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show"></div>
        </>
      )}

    </Layout>
  );
};

export default RecepcionRemitosPage;
