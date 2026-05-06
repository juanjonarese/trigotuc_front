import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import {
  obtenerRemitosGranja,
  confirmarRecepcionRemito,
  ingresarLoteDesdeRemito,
  eliminarRemitoGranja,
} from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const rolUsuario   = () => localStorage.getItem("rolUsuario");
const esSuperAdmin = () => rolUsuario() === "superadmin";

const GRANJA_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJA_PREFIX = { cañete: "C", los_pinos: "P" };

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";

const badgeEstado = (estado) => {
  if (estado === "en_transito")    return <span className="badge bg-warning text-dark">En tránsito</span>;
  if (estado === "recibido")       return <span className="badge bg-success">Recibido ✓</span>;
  if (estado === "con_diferencia") return <span className="badge bg-danger">Con diferencia ⚠</span>;
  return <span className="badge bg-secondary">{estado}</span>;
};

const RecepcionRemitosPage = () => {
  const [remitos, setRemitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("en_transito");

  // Modal recepción
  const [remitoRec, setRemitoRec]             = useState(null);
  const [formRec, setFormRec]                 = useState({ cantidadRecibida: "", observaciones: "" });
  const [submittingRec, setSubmittingRec]     = useState(false);

  // Modal ingreso calibres
  const [remitoLote, setRemitoLote]           = useState(null);
  const [lineas, setLineas]                   = useState([]);
  const [formFaena, setFormFaena]             = useState({
    fechaIngreso: obtenerFechaHoy(),
    unidadesDecomisadas: "", kgDecomisados: "",
    unidadesTrozadas: "", kgTrozados: "", observaciones: "",
  });
  const [submittingLote, setSubmittingLote]   = useState(false);

  const cargar = useCallback(async () => {
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
  const handleRecepcion = async (e) => {
    e.preventDefault();
    setSubmittingRec(true);
    try {
      await confirmarRecepcionRemito(remitoRec._id, {
        cantidadRecibida: Number(formRec.cantidadRecibida),
        observaciones:    formRec.observaciones || undefined,
      });
      const dif = remitoRec.cantidadEnviada - Number(formRec.cantidadRecibida);
      setRemitoRec(null);
      await cargar();
      if (dif !== 0) {
        Swal.fire({
          icon: "warning",
          title: "Diferencia registrada",
          html: `Enviados: <strong>${fmtNum(remitoRec.cantidadEnviada)}</strong> — Recibidos: <strong>${fmtNum(Number(formRec.cantidadRecibida))}</strong><br/>
                 <span class="text-danger fw-bold">Diferencia: ${fmtNum(dif)} pollos</span>`,
        });
      } else {
        Swal.fire({ icon: "success", title: "Recepción confirmada. Cantidades coinciden.", timer: 1800, showConfirmButton: false });
      }
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmittingRec(false);
    }
  };

  // ── Ingresar calibres ──
  const abrirIngresoCalibre = (remito) => {
    setRemitoLote(remito);
    setLineas([]);
    setFormFaena({ fechaIngreso: obtenerFechaHoy(), unidadesDecomisadas: "", kgDecomisados: "", unidadesTrozadas: "", kgTrozados: "", observaciones: "" });
  };

  const lineasConCajones = lineas.map((l) => ({
    ...l, cajones: calcularCajones(l.pollos, l.calibre),
  }));
  const totalPollos  = lineasConCajones.reduce((acc, l) => acc + Number(l.pollos || 0), 0);
  const totalCajones = lineasConCajones.reduce((acc, l) => acc + l.cajones, 0);
  const totalKg      = totalCajones * 20;

  const handleIngresarLote = async (e) => {
    e.preventDefault();
    const lineasValidas = lineasConCajones.filter((l) => l.cajones > 0);
    if (lineasValidas.length === 0) {
      Swal.fire("Error", "Ingresá al menos un calibre con cajones.", "error");
      return;
    }
    setSubmittingLote(true);
    try {
      const lote = await ingresarLoteDesdeRemito(remitoLote._id, {
        fechaIngreso:        formFaena.fechaIngreso,
        calibres:            lineasValidas.map(({ calibre, pollos, cajones }) => ({ calibre: Number(calibre), pollos: Number(pollos), cajones })),
        unidadesDecomisadas: formFaena.unidadesDecomisadas ? Number(formFaena.unidadesDecomisadas) : 0,
        kgDecomisados:       formFaena.kgDecomisados       ? Number(formFaena.kgDecomisados)       : 0,
        unidadesTrozadas:    formFaena.unidadesTrozadas     ? Number(formFaena.unidadesTrozadas)    : 0,
        kgTrozados:          formFaena.kgTrozados           ? Number(formFaena.kgTrozados)          : 0,
        observaciones:       formFaena.observaciones        || undefined,
      });
      setRemitoLote(null);
      setFiltroEstado("");
      await cargar();
      Swal.fire({
        icon: "success",
        title: `Lote #${lote.numeroLote} ingresado`,
        html: `${fmtNum(totalPollos)} pollos · ${fmtNum(totalCajones)} cajones · ${fmtNum(totalKg)} kg`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmittingLote(false);
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
            { v: "con_diferencia", l: "Con diferencia" },
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
              <p className="text-center text-muted p-4 mb-0">No hay remitos.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Código</th>
                      <th>Origen</th>
                      <th>Fecha envío</th>
                      <th className="text-end">Enviados</th>
                      <th className="text-end">Recibidos</th>
                      <th className="text-end">Dif.</th>
                      <th>Estado</th>
                      <th>Lote ingresado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {remitos.map((r) => {
                      const lote = r.loteGranja;
                      return (
                        <tr key={r._id} className={r.estado === "con_diferencia" ? "table-warning" : ""}>
                          <td><span className="badge bg-primary fs-6">{r.numeroRemito}</span></td>
                          <td className="small">
                            {lote ? `${GRANJA_LABEL[lote.granja]} G${GRANJA_PREFIX[lote.granja]}${lote.galpon}` : "—"}
                          </td>
                          <td className="small">{fmtFecha(r.fechaEnvio)}</td>
                          <td className="text-end fw-semibold">{fmtNum(r.cantidadEnviada)}</td>
                          <td className="text-end">{r.cantidadRecibida != null ? fmtNum(r.cantidadRecibida) : <span className="text-muted">—</span>}</td>
                          <td className="text-end">
                            {r.diferencia != null
                              ? <span className={r.diferencia !== 0 ? "text-danger fw-bold" : "text-success"}>{r.diferencia !== 0 ? `−${fmtNum(r.diferencia)}` : "✓"}</span>
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
                                <button className="btn btn-warning btn-sm" onClick={() => { setRemitoRec(r); setFormRec({ cantidadRecibida: r.cantidadEnviada, observaciones: "" }); }}>
                                  Confirmar recepción
                                </button>
                              )}
                              {(r.estado === "recibido" || r.estado === "con_diferencia") && !r.loteIngresado && (
                                <button className="btn btn-success btn-sm" onClick={() => abrirIngresoCalibre(r)}>
                                  <i className="bi bi-plus-circle me-1"></i>Ingresar calibres
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
                  <div className="alert alert-info py-2 mb-3">
                    Granja envió: <strong>{fmtNum(remitoRec.cantidadEnviada)} pollos</strong>
                    {remitoRec.pesoEstimadoKg && <> · {fmtNum(remitoRec.pesoEstimadoKg)} kg est.</>}
                  </div>
                  <form id="form-recepcion" onSubmit={handleRecepcion}>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Cantidad recibida en frigorífico</label>
                      <input type="number" className="form-control form-control-lg" value={formRec.cantidadRecibida}
                        onChange={(e) => setFormRec({ ...formRec, cantidadRecibida: e.target.value })} min="0" required autoFocus />
                      {formRec.cantidadRecibida !== "" && Number(formRec.cantidadRecibida) !== remitoRec.cantidadEnviada && (
                        <div className="text-danger fw-semibold mt-1">
                          ⚠ Diferencia: {fmtNum(remitoRec.cantidadEnviada - Number(formRec.cantidadRecibida))} pollos
                        </div>
                      )}
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Observaciones <span className="text-muted">(requerido si hay diferencia)</span></label>
                      <textarea className="form-control" rows={2} value={formRec.observaciones}
                        onChange={(e) => setFormRec({ ...formRec, observaciones: e.target.value })} />
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setRemitoRec(null)} disabled={submittingRec}>Cancelar</button>
                  <button type="submit" form="form-recepcion" className="btn btn-warning" disabled={submittingRec}>
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

      {/* Modal ingresar calibres */}
      {remitoLote && (
        <>
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header bg-success text-white">
                  <div>
                    <h5 className="modal-title mb-0">Ingresar calibres — {remitoLote.numeroRemito}</h5>
                    <div className="small mt-1 opacity-75">
                      {remitoLote.cantidadRecibida != null
                        ? `${fmtNum(remitoLote.cantidadRecibida)} pollos recibidos`
                        : `${fmtNum(remitoLote.cantidadEnviada)} pollos enviados`}
                      {remitoLote.diferencia !== 0 && remitoLote.diferencia != null &&
                        <span className="ms-2 badge bg-warning text-dark">⚠ Diferencia: {fmtNum(remitoLote.diferencia)}</span>}
                    </div>
                  </div>
                  <button className="btn-close btn-close-white" onClick={() => setRemitoLote(null)} disabled={submittingLote}></button>
                </div>
                <div className="modal-body">
                  <form id="form-calibres" onSubmit={handleIngresarLote}>
                    <div className="row g-3 mb-3">
                      <div className="col-6 col-md-3">
                        <label className="form-label fw-semibold">Fecha de ingreso</label>
                        <input type="date" className="form-control" value={formFaena.fechaIngreso}
                          onChange={(e) => setFormFaena({ ...formFaena, fechaIngreso: e.target.value })} required />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Decomisados (u)</label>
                        <input type="number" className="form-control" value={formFaena.unidadesDecomisadas}
                          onChange={(e) => setFormFaena({ ...formFaena, unidadesDecomisadas: e.target.value })} min="0" placeholder="0" />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Decomisados (kg)</label>
                        <input type="number" className="form-control" value={formFaena.kgDecomisados}
                          onChange={(e) => setFormFaena({ ...formFaena, kgDecomisados: e.target.value })} min="0" step="0.01" placeholder="0" />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Trozados (u)</label>
                        <input type="number" className="form-control" value={formFaena.unidadesTrozadas}
                          onChange={(e) => setFormFaena({ ...formFaena, unidadesTrozadas: e.target.value })} min="0" placeholder="0" />
                      </div>
                      <div className="col-6 col-md-3">
                        <label className="form-label">Trozados (kg)</label>
                        <input type="number" className="form-control" value={formFaena.kgTrozados}
                          onChange={(e) => setFormFaena({ ...formFaena, kgTrozados: e.target.value })} min="0" step="0.01" placeholder="0" />
                      </div>
                      <div className="col-12 col-md-9">
                        <label className="form-label">Observaciones</label>
                        <input type="text" className="form-control" value={formFaena.observaciones}
                          onChange={(e) => setFormFaena({ ...formFaena, observaciones: e.target.value })} />
                      </div>
                    </div>

                    <label className="form-label fw-semibold">Calibres (resultado de la faena)</label>
                    <CalibreTable lineas={lineas} onChange={setLineas} />

                    {totalCajones > 0 && (
                      <div className="alert alert-success py-2 mt-2 mb-0">
                        <span className="me-3">{fmtNum(totalPollos)} pollos</span>
                        <span className="me-3">{fmtNum(totalCajones)} cajones</span>
                        <span>{fmtNum(totalKg)} kg</span>
                      </div>
                    )}
                  </form>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setRemitoLote(null)} disabled={submittingLote}>Cancelar</button>
                  <button type="submit" form="form-calibres" className="btn btn-success" disabled={submittingLote}>
                    {submittingLote && <span className="spinner-border spinner-border-sm me-1"></span>}
                    <i className="bi bi-check-circle me-1"></i>Ingresar lote al sistema
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
