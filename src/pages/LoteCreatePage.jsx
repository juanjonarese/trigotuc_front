import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import {
  crearLote,
  obtenerOrdenesCarga,
  obtenerLotes,
  eliminarLote,
} from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmtNum = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

const GRANJA_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJA_PREFIX = { cañete: "C", los_pinos: "P" };

const FORM_VACIO = {
  fechaIngreso:     obtenerFechaHoy(),
  unidadesFaenadas: "",
  kgVivos:          "",
  unidadesTrozadas: "",
  kgTrozados:       "",
  observaciones:    "",
};

// ── Modal nuevo lote ────────────────────────────────────────────────────────
const NuevoLoteModal = ({ onClose, onCreado }) => {
  const [recepciones, setRecepciones]         = useState([]);
  const [loadingRec, setLoadingRec]           = useState(true);
  const [recepcionSel, setRecepcionSel]       = useState(null);
  const [form, setForm]     = useState(FORM_VACIO);
  const [lineas, setLineas] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingRec(true);
    obtenerOrdenesCarga({ estado: "entregada" })
      .then((data) => setRecepciones(data.filter((o) => !o.loteAsociado)))
      .catch(() => {})
      .finally(() => setLoadingRec(false));
  }, []);

  const handleSeleccionarRecepcion = (e) => {
    const id = e.target.value;
    if (!id) {
      setRecepcionSel(null);
      setForm((f) => ({ ...f, kgVivos: "", unidadesFaenadas: "" }));
      return;
    }
    const rec = recepciones.find((o) => o._id === id) || null;
    setRecepcionSel(rec);
    if (rec) {
      setForm((f) => ({
        ...f,
        kgVivos:          rec.pesoRealKg   != null ? String(rec.pesoRealKg)   : "",
        unidadesFaenadas: rec.cantidadReal  != null ? String(rec.cantidadReal) : "",
      }));
    }
  };

  const lineasCalculadas = lineas.map((l) => ({
    ...l, cajones: calcularCajones(l.pollos, l.calibre),
  }));
  const totalPollos  = lineasCalculadas.reduce((acc, l) => acc + Number(l.pollos || 0), 0);
  const totalCajones = lineasCalculadas.reduce((acc, l) => acc + l.cajones, 0);
  const totalKg      = totalCajones * 20;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalCajones === 0) {
      Swal.fire("Error", "Ingresá al menos una línea con pollos.", "error");
      return;
    }
    setSaving(true);
    try {
      const calibresPayload = lineasCalculadas
        .filter((l) => l.pollos && l.cajones > 0)
        .map(({ calibre, pollos, cajones }) => ({ calibre: Number(calibre), pollos: Number(pollos), cajones }));

      const payload = {
        fechaIngreso:  form.fechaIngreso,
        calibres:      calibresPayload,
        observaciones: form.observaciones || undefined,
      };
      if (form.kgVivos)           payload.kgVivos           = Number(form.kgVivos);
      if (form.unidadesFaenadas)  payload.unidadesFaenadas  = Number(form.unidadesFaenadas);
      if (form.unidadesTrozadas)  payload.unidadesTrozadas  = Number(form.unidadesTrozadas);
      if (form.kgTrozados)        payload.kgTrozados        = Number(form.kgTrozados);
      if (recepcionSel)           payload.ordenCarga        = recepcionSel._id;

      const loteCreado = await crearLote(payload);
      onCreado();
      Swal.fire({
        icon: "success",
        title: `Lote #${loteCreado.numeroLote} creado`,
        html:  `${fmtNum(totalPollos)} pollos · ${fmtNum(totalCajones)} cajones · ${fmtNum(totalKg)} kg`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el lote.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-plus-circle me-2"></i>Nuevo Lote de Faena
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              {/* Selector de recepción */}
              <div className="mb-3">
                <label className="form-label fw-semibold">
                  <i className="bi bi-box-arrow-in-down me-1 text-primary"></i>
                  Vincular recepción de granja <span className="fw-normal text-muted">(opcional)</span>
                </label>
                {loadingRec ? (
                  <div className="d-flex align-items-center gap-2 text-muted small">
                    <div className="spinner-border spinner-border-sm"></div>Cargando recepciones...
                  </div>
                ) : recepciones.length === 0 ? (
                  <p className="text-muted small mb-0">No hay recepciones pendientes de faena.</p>
                ) : (
                  <select className="form-select" value={recepcionSel?._id || ""} onChange={handleSeleccionarRecepcion}>
                    <option value="">— Sin vincular —</option>
                    {recepciones.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.numero} · {o.granja === "cañete" ? "Cañete" : "Los Pinos"}{o.galpon ? ` G${o.galpon}` : ""} · {fmtNum(o.cantidadReal)} pollos · {o.pesoRealKg} kg
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Banner recepción seleccionada */}
              {recepcionSel && (
                <div className="alert alert-primary border-start border-4 border-primary mb-3 py-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-box-arrow-in-down fs-5"></i>
                    <strong>Recepción {recepcionSel.numero}</strong>
                    <span className="text-muted small">
                      — {recepcionSel.granja === "cañete" ? "Cañete" : "Los Pinos"}
                      {recepcionSel.galpon && ` G${recepcionSel.galpon}`}
                    </span>
                  </div>
                  <div className="d-flex flex-wrap gap-3">
                    <div className="text-center px-3 border-end">
                      <div className="text-muted small">Pollos pedidos</div>
                      <div className="fw-bold">{fmtNum(recepcionSel.cantidadEstimada)}</div>
                    </div>
                    <div className="text-center px-3 border-end">
                      <div className="text-muted small">Pollos recibidos</div>
                      <div className="fw-bold text-success fs-5">{fmtNum(recepcionSel.cantidadReal)}</div>
                    </div>
                    <div className="text-center px-3 border-end">
                      <div className="text-muted small">Kg pedidos</div>
                      <div className="fw-bold">{recepcionSel.pesoEstimadoKg} kg</div>
                    </div>
                    <div className="text-center px-3">
                      <div className="text-muted small">Kg recibidos (vivos)</div>
                      <div className="fw-bold text-success fs-5">{recepcionSel.pesoRealKg} kg</div>
                    </div>
                  </div>
                  {recepcionSel.diferenciaCantidad !== 0 && (
                    <div className="mt-2 small text-warning fw-semibold">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Diferencia: {recepcionSel.diferenciaCantidad > 0 ? "+" : ""}{recepcionSel.diferenciaCantidad} pollos · {recepcionSel.diferenciaKg > 0 ? "+" : ""}{recepcionSel.diferenciaKg?.toFixed(1)} kg
                      {recepcionSel.observacionesEntrega && ` — ${recepcionSel.observacionesEntrega}`}
                    </div>
                  )}
                </div>
              )}

              <form id="form-nuevo-lote" onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Fecha de faena</label>
                    <input type="date" className="form-control"
                      value={form.fechaIngreso}
                      onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                      required />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Unidades faenadas</label>
                    <input type="number" className="form-control"
                      value={form.unidadesFaenadas}
                      onChange={(e) => setForm({ ...form, unidadesFaenadas: e.target.value })}
                      min="0" placeholder={recepcionSel ? fmtNum(recepcionSel.cantidadReal) : "0"} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Kg vivos</label>
                    <input type="number" className="form-control"
                      value={form.kgVivos}
                      onChange={(e) => setForm({ ...form, kgVivos: e.target.value })}
                      min="0" step="0.01" placeholder={recepcionSel ? recepcionSel.pesoRealKg : "0"} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Trozados (u)</label>
                    <input type="number" className="form-control"
                      value={form.unidadesTrozadas}
                      onChange={(e) => setForm({ ...form, unidadesTrozadas: e.target.value })}
                      min="0" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Trozados (kg)</label>
                    <input type="number" className="form-control"
                      value={form.kgTrozados}
                      onChange={(e) => setForm({ ...form, kgTrozados: e.target.value })}
                      min="0" step="0.01" placeholder="0" />
                  </div>
                  <div className="col-12 col-md-9">
                    <label className="form-label">Observaciones</label>
                    <input type="text" className="form-control"
                      value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                  </div>
                </div>

                <label className="form-label fw-semibold">
                  Calibres (resultado de la faena)
                  {recepcionSel && (
                    <span className="text-muted fw-normal ms-2 small">referencia: {fmtNum(recepcionSel.cantidadReal)} pollos recibidos</span>
                  )}
                </label>
                <p className="text-muted small mb-2">El calibre indica cuántos pollos entran en un cajón de 20 kg.</p>
                <CalibreTable lineas={lineas} onChange={setLineas} />

                {totalCajones > 0 && (
                  <div className="alert alert-info py-2 mt-3 mb-0">
                    <div className="row text-center g-0">
                      <div className="col-4">
                        <div className="text-muted small">Pollos</div>
                        <div className="fw-bold">{fmtNum(totalPollos)}</div>
                      </div>
                      <div className="col-4 border-start border-end">
                        <div className="text-muted small">Cajones</div>
                        <div className="fw-bold">{fmtNum(totalCajones)}</div>
                      </div>
                      <div className="col-4">
                        <div className="text-muted small">Kg</div>
                        <div className="fw-bold">{fmtNum(totalKg)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" form="form-nuevo-lote" className="btn btn-success" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-plus-circle me-1"></i>Crear Lote
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página principal ────────────────────────────────────────────────────────
const LoteCreatePage = () => {
  const navigate = useNavigate();

  const rolUsuario    = localStorage.getItem("rolUsuario");
  const puedeCrear    = rolUsuario === "superadmin" || rolUsuario === "frigorifico";
  const esSuperAdmin  = rolUsuario === "superadmin";

  const [lotes, setLotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("activo");

  const cargarLotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerLotes();
      setLotes(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  const handleEliminar = async (lote) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar carga?",
      html: `Se eliminará el lote <strong>#${lote.numeroLote || ""}</strong> y todas sus ventas y actualizaciones.`,
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#dc3545", confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarLote(lote._id);
      await cargarLotes();
      Swal.fire({ icon: "success", title: "Eliminado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const lotesFiltrados = lotes.filter((l) =>
    filtroEstado === "" || l.estado === filtroEstado
  );

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-seam me-2 text-success"></i>
            Lotes de Faena
          </h1>
          <div className="d-flex align-items-center gap-2">
            {/* Filtro estado */}
            <div className="d-flex gap-1">
              {[{ v: "activo", l: "Activos" }, { v: "cerrado", l: "Cerrados" }, { v: "", l: "Todos" }].map(({ v, l }) => (
                <button
                  key={v}
                  className={`btn btn-sm ${filtroEstado === v ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setFiltroEstado(v)}
                >
                  {l}
                </button>
              ))}
            </div>
            {puedeCrear && (
              <button className="btn btn-success btn-sm" onClick={() => setShowModal(true)}>
                <i className="bi bi-plus-circle me-1"></i>Nuevo Lote
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
            ) : lotesFiltrados.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">No hay lotes registrados.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {lotesFiltrados.map((lote) => {
                    const totalCajones = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
                    return (
                      <div key={lote._id} className="card border mb-3">
                        <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                          <div>
                            {lote.numeroLote && <span className="badge bg-dark me-2">#{lote.numeroLote}</span>}
                            <span className="fw-semibold small">
                              {new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}
                            </span>
                            <span className={`badge ms-2 ${lote.estado === "activo" ? "bg-success" : "bg-secondary"}`}>
                              {lote.estado === "activo" ? "Activo" : "Cerrado"}
                            </span>
                          </div>
                          <div className="d-flex gap-1">
                            {esSuperAdmin && (
                              <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(lote)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="card-body py-2 px-3 small">
                          <div className="d-flex flex-wrap gap-1 mb-1">
                            {(lote.calibres || []).map((c) => (
                              <span key={c.calibre} className="badge bg-primary">Cal.{c.calibre}: {fmtNum(c.cajones)} caj</span>
                            ))}
                          </div>
                          <div className="text-muted">
                            <strong className="text-dark">{fmtNum(totalCajones)}</strong> cajones ·{" "}
                            <strong className="text-dark">{fmtNum(lote.pesoTotal)}</strong> kg
                          </div>
                          {lote.rendimientoFaena != null && (
                            <div className="text-muted mt-1">Rendimiento: <strong className="text-dark">{fmtNum(lote.rendimientoFaena)}%</strong></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>#Lote</th>
                        <th>Fecha faena</th>
                        <th>Estado</th>
                        <th>Calibres / Stock</th>
                        <th className="text-end">Cajones</th>
                        <th className="text-end">Kg totales</th>
                        <th className="text-end">Rendimiento</th>
                        {esSuperAdmin && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {lotesFiltrados.map((lote) => {
                        const totalCajones = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
                        return (
                          <tr key={lote._id}>
                            <td>
                              {lote.numeroLote
                                ? <span className="badge bg-dark">#{lote.numeroLote}</span>
                                : <span className="text-muted">—</span>
                              }
                            </td>
                            <td className="text-muted small">
                              {new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}
                            </td>
                            <td>
                              <span className={`badge ${lote.estado === "activo" ? "bg-success" : "bg-secondary"}`}>
                                {lote.estado === "activo" ? "Activo" : "Cerrado"}
                              </span>
                            </td>
                            <td>
                              <div className="d-flex flex-wrap gap-1">
                                {(lote.calibres || []).map((c) => (
                                  <span key={c.calibre} className="badge bg-primary">
                                    Cal.{c.calibre}: {fmtNum(c.cajones)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="text-end fw-semibold">{fmtNum(totalCajones)}</td>
                            <td className="text-end">{fmtNum(lote.pesoTotal)} kg</td>
                            <td className="text-end">
                              {lote.rendimientoFaena != null
                                ? <span className="fw-semibold text-success">{fmtNum(lote.rendimientoFaena)}%</span>
                                : <span className="text-muted">—</span>
                              }
                            </td>
                            {esSuperAdmin && (
                              <td>
                                <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(lote)}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {showModal && (
        <NuevoLoteModal
          onClose={() => { setShowModal(false); navigate("/frigorifico/lotes/nuevo", { replace: true }); }}
          onCreado={() => { setShowModal(false); cargarLotes(); navigate("/frigorifico/lotes/nuevo", { replace: true }); }}
        />
      )}
    </Layout>
  );
};

export default LoteCreatePage;
