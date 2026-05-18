import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerVentasGranja,
  emitirVentaGranja,
  eliminarVentaGranja,
  obtenerOrdenesCarga,
  crearOrdenCarga,
  obtenerClientes,
  obtenerLotesGranja,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const rolUsuario   = () => localStorage.getItem("rolUsuario");
const esSuperAdmin = () => rolUsuario() === "superadmin";

const GRANJA_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtARS = (n) => n != null
  ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
  : "—";

const GRANJAS = [
  { key: "cañete",    label: "Cañete",    galpones: 6 },
  { key: "los_pinos", label: "Los Pinos", galpones: 8 },
];

// ── Modal nueva orden de retiro ──────────────────────────────────────────────
const NuevaOrdenModal = ({ onClose, onCreada }) => {
  const [clientes, setClientes]   = useState([]);
  const [lotes, setLotes]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({
    cliente: "", granja: "", lote: "", galpon: "",
    cantidadEstimada: "", pesoEstimadoKg: "",
    fechaEmision: obtenerFechaHoy(), observaciones: "",
  });

  useEffect(() => {
    Promise.all([
      obtenerClientes(),
      obtenerLotesGranja({ estado: "en_crianza" }),
    ]).then(([c, l]) => {
      setClientes(c.clientes || c);
      setLotes(l);
    }).catch(() => {});
  }, []);

  const lotesFiltrados   = form.granja ? lotes.filter((l) => l.granja === form.granja) : lotes;
  const loteSeleccionado = lotes.find((l) => l._id === form.lote) || null;

  const handleSeleccionarLote = (e) => {
    const lote = lotes.find((l) => l._id === e.target.value) || null;
    setForm((f) => ({ ...f, lote: e.target.value, galpon: lote ? String(lote.galpon) : "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente || !form.granja || !form.cantidadEstimada || !form.pesoEstimadoKg) {
      Swal.fire("Faltan datos", "Completá cliente, granja, cantidad y peso.", "warning"); return;
    }
    setSaving(true);
    try {
      await crearOrdenCarga({
        tipo:             "venta_gordos",
        cliente:          form.cliente,
        granja:           form.granja,
        galpon:           form.galpon ? Number(form.galpon) : undefined,
        lote:             form.lote   || undefined,
        fechaEmision:     ajustarFechaParaGuardar(form.fechaEmision),
        cantidadEstimada: Number(form.cantidadEstimada),
        pesoEstimadoKg:   Number(form.pesoEstimadoKg),
        observaciones:    form.observaciones || undefined,
      });
      onCreada();
      Swal.fire({ icon: "success", title: "Orden creada", text: "La orden llegará a la granja para su confirmación.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
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
              <h5 className="modal-title"><i className="bi bi-clipboard2-plus me-2"></i>Nueva orden de retiro</h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-nueva-orden" onSubmit={handleSubmit}>
                <div className="row g-3">

                  <div className="col-12">
                    <label className="form-label fw-semibold">Cliente <span className="text-danger">*</span></label>
                    <select className="form-select" value={form.cliente}
                      onChange={(e) => setForm({ ...form, cliente: e.target.value })} required>
                      <option value="">— Seleccioná el cliente —</option>
                      {clientes.map((c) => <option key={c._id} value={c._id}>{c.razonSocial || c.nombre}</option>)}
                    </select>
                  </div>

                  <div className="col-6">
                    <label className="form-label fw-semibold">Granja <span className="text-danger">*</span></label>
                    <div className="d-flex gap-2">
                      {GRANJAS.map((g) => (
                        <button key={g.key} type="button"
                          className={`btn flex-grow-1 ${form.granja === g.key ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setForm((f) => ({ ...f, granja: g.key, lote: "", galpon: "" }))}>
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-6">
                    <label className="form-label fw-semibold">Galpón</label>
                    <select className="form-select" value={form.lote} onChange={handleSeleccionarLote} disabled={!form.granja}>
                      <option value="">— Sin galpón específico —</option>
                      {lotesFiltrados.map((l) => (
                        <option key={l._id} value={l._id}>
                          G{l.galpon} — {fmtNum(l.cantidadActual)} pollos
                        </option>
                      ))}
                    </select>
                    {loteSeleccionado && (
                      <div className="form-text text-success">
                        Stock actual: <strong>{fmtNum(loteSeleccionado.cantidadActual)}</strong> pollos
                      </div>
                    )}
                  </div>

                  <div className="col-6 col-md-4">
                    <label className="form-label fw-semibold">Fecha emisión</label>
                    <input type="date" className="form-control" value={form.fechaEmision}
                      onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required />
                  </div>

                  <div className="col-6 col-md-4">
                    <label className="form-label fw-semibold">Cantidad estimada <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" placeholder="pollos" min="1"
                      value={form.cantidadEstimada}
                      onChange={(e) => setForm({ ...form, cantidadEstimada: e.target.value })} required />
                  </div>

                  <div className="col-6 col-md-4">
                    <label className="form-label fw-semibold">Peso estimado (kg) <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" placeholder="0" min="0.01" step="0.01"
                      value={form.pesoEstimadoKg}
                      onChange={(e) => setForm({ ...form, pesoEstimadoKg: e.target.value })} required />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Observaciones</label>
                    <textarea className="form-control" rows={2} value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-nueva-orden" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-send me-1"></i>Emitir orden a granja
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal emitir venta ───────────────────────────────────────────────────────
const EmitirVentaModal = ({ orden, onClose, onEmitida }) => {
  const [precioPorKg, setPrecioPorKg]     = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving]               = useState(false);

  const totalEstimado = precioPorKg && orden.pesoRealKg
    ? (Number(precioPorKg) * orden.pesoRealKg).toFixed(2)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!precioPorKg) { Swal.fire("Falta el precio", "Ingresá el precio por kg.", "warning"); return; }
    setSaving(true);
    try {
      await emitirVentaGranja(orden._id, { precioPorKg: Number(precioPorKg), observaciones: observaciones || undefined });
      onEmitida();
      Swal.fire({ icon: "success", title: "Venta emitida", text: totalEstimado ? `Total: ${fmtARS(Number(totalEstimado))}` : "", timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const granja = orden.granja === "cañete" ? "Cañete" : "Los Pinos";
  const galpon = orden.galpon ? ` — Galpón ${orden.galpon}` : "";

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <div>
                <h5 className="modal-title mb-0"><i className="bi bi-receipt me-2"></i>Emitir venta</h5>
                <div className="small opacity-75 mt-1">{orden.numero} — {granja}{galpon}</div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">

              {/* Datos confirmados por la granja */}
              <div className="card border-0 bg-light mb-3">
                <div className="card-body py-2 px-3">
                  <div className="small text-muted fw-semibold mb-2 text-uppercase" style={{ letterSpacing: "0.05em" }}>
                    Cantidades confirmadas por la granja
                  </div>
                  <div className="d-flex gap-4">
                    <div>
                      <div className="fw-bold fs-5 text-success">{fmtNum(orden.cantidadReal)}</div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>pollos reales</div>
                    </div>
                    <div>
                      <div className="fw-bold fs-5 text-success">{orden.pesoRealKg} kg</div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>kg vivos reales</div>
                    </div>
                    {orden.cantidadEstimada !== orden.cantidadReal && (
                      <div>
                        <div className="fw-bold text-warning">
                          {orden.cantidadReal - orden.cantidadEstimada > 0 ? "+" : ""}
                          {orden.cantidadReal - orden.cantidadEstimada}
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>diferencia</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <form id="form-emitir-venta" onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Precio por kg <span className="text-danger">*</span></label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input type="number" className="form-control form-control-lg" min="0.01" step="0.01"
                      placeholder="0,00" value={precioPorKg}
                      onChange={(e) => setPrecioPorKg(e.target.value)}
                      required autoFocus />
                    <span className="input-group-text">/kg</span>
                  </div>
                </div>

                {totalEstimado && (
                  <div className="alert alert-success py-2 text-center mb-3">
                    <div className="small text-muted">Total a cobrar</div>
                    <div className="fw-bold fs-4">{fmtARS(Number(totalEstimado))}</div>
                    <div className="small text-muted">{orden.pesoRealKg} kg × ${Number(precioPorKg).toLocaleString("es-AR")}/kg</div>
                  </div>
                )}

                <div>
                  <label className="form-label">Observaciones <span className="text-muted">(opcional)</span></label>
                  <textarea className="form-control" rows={2} value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)} />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-emitir-venta" className="btn btn-success btn-lg px-4" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                <i className="bi bi-check-circle me-1"></i>Emitir venta
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página principal ─────────────────────────────────────────────────────────
const VentasGranjaPage = () => {
  const [ventas, setVentas]             = useState([]);
  const [pendientes, setPendientes]     = useState([]); // OrdenCarga entregadas sin venta
  const [enEspera, setEnEspera]         = useState([]); // OrdenCarga pendientes (esperando granja)
  const [loading, setLoading]           = useState(true);
  const [showNuevaOrden, setShowNuevaOrden] = useState(false);
  const [ordenEmitir, setOrdenEmitir]   = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [v, entregadas, enPendiente] = await Promise.all([
        obtenerVentasGranja(),
        obtenerOrdenesCarga({ estado: "entregada", tipo: "venta_gordos" }),
        obtenerOrdenesCarga({ estado: "pendiente", tipo: "venta_gordos" }),
      ]);
      setVentas(v);
      setPendientes(entregadas.filter((o) => !o.ventaGranjaAsociada));
      setEnEspera(enPendiente);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleEliminar = async (venta) => {
    const ok = await Swal.fire({
      title: "¿Eliminar venta?", text: venta.numeroVenta, icon: "warning",
      showCancelButton: true, confirmButtonColor: "#dc3545",
      confirmButtonText: "Eliminar", cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await eliminarVentaGranja(venta._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-bag-check me-2 text-success"></i>
            Ventas Gordos
          </h1>
          <button className="btn btn-primary" onClick={() => setShowNuevaOrden(true)}>
            <i className="bi bi-clipboard2-plus me-1"></i>Nueva orden de retiro
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : (
          <>
            {/* ── En espera de confirmación ── */}
            {enEspera.length > 0 && (
              <>
                <h6 className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: "0.75rem", letterSpacing: "0.06em" }}>
                  <i className="bi bi-clock me-1 text-secondary"></i>
                  Esperando confirmación de la granja ({enEspera.length})
                </h6>
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>N° Orden</th>
                            <th>Granja / Galpón</th>
                            <th>Cliente</th>
                            <th className="text-end">Cant. estimada</th>
                            <th className="text-end">Peso est.</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enEspera.map((o) => (
                            <tr key={o._id}>
                              <td><span className="badge bg-secondary">{o.numero}</span></td>
                              <td className="small">{GRANJA_LABEL[o.granja]}{o.galpon ? ` G${o.galpon}` : ""}</td>
                              <td className="small">{o.cliente?.razonSocial || o.cliente?.nombre || <span className="text-muted">—</span>}</td>
                              <td className="text-end">{fmtNum(o.cantidadEstimada)}</td>
                              <td className="text-end">{o.pesoEstimadoKg} kg</td>
                              <td className="small text-muted">{formatearFechaLocal(o.fechaEmision)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Pendientes de emitir ── */}
            <h6 className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: "0.75rem", letterSpacing: "0.06em" }}>
              <i className="bi bi-hourglass-split me-1 text-warning"></i>
              Órdenes confirmadas — pendientes de emitir venta ({pendientes.length})
            </h6>

            {pendientes.length === 0 ? (
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body text-center text-muted py-4">
                  <i className="bi bi-inbox fs-3 d-block mb-2"></i>
                  No hay órdenes confirmadas pendientes de emitir.
                </div>
              </div>
            ) : (
              <div className="row g-3 mb-4">
                {pendientes.map((o) => (
                  <div key={o._id} className="col-12 col-md-6 col-lg-4">
                    <div className="card border-0 shadow-sm h-100" style={{ borderLeft: "4px solid #f59e0b" }}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <span className="badge bg-dark">{o.numero}</span>
                          <span className="badge bg-warning text-dark">Pendiente</span>
                        </div>
                        <div className="fw-bold mb-1">
                          {GRANJA_LABEL[o.granja]}{o.galpon ? ` — Galpón ${o.galpon}` : ""}
                        </div>
                        <div className="small text-muted mb-2">{formatearFechaLocal(o.fechaEntrega || o.fechaEmision)}</div>
                        <div className="d-flex gap-3 p-2 rounded mb-2" style={{ background: "#f0fdf4" }}>
                          <div>
                            <div className="fw-bold text-success">{fmtNum(o.cantidadReal)}</div>
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>pollos reales</div>
                          </div>
                          <div>
                            <div className="fw-bold text-success">{o.pesoRealKg} kg</div>
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>kg vivos</div>
                          </div>
                        </div>
                        {o.observacionesEntrega && (
                          <div className="small text-muted mb-2"><i className="bi bi-info-circle me-1"></i>{o.observacionesEntrega}</div>
                        )}
                      </div>
                      <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
                        <button className="btn btn-success w-100" onClick={() => setOrdenEmitir(o)}>
                          <i className="bi bi-receipt me-1"></i>Emitir venta
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Ventas emitidas ── */}
            <h6 className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: "0.75rem", letterSpacing: "0.06em" }}>
              <i className="bi bi-check-circle me-1 text-success"></i>
              Ventas emitidas ({ventas.length})
            </h6>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                {ventas.length === 0 ? (
                  <p className="text-center text-muted p-4 mb-0">No hay ventas emitidas.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>N° Venta</th>
                          <th>N° Orden</th>
                          <th>Granja / Galpón</th>
                          <th>Cliente</th>
                          <th className="text-end">Pollos</th>
                          <th className="text-end">Kg vivos</th>
                          <th className="text-end">$/kg</th>
                          <th className="text-end">Total</th>
                          <th>Fecha</th>
                          {esSuperAdmin() && <th></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {ventas.map((v) => {
                          const o = v.ordenCarga;
                          return (
                            <tr key={v._id}>
                              <td><span className="badge bg-success">{v.numeroVenta}</span></td>
                              <td><span className="badge bg-dark">{o?.numero || "—"}</span></td>
                              <td className="text-muted small">
                                {o ? `${GRANJA_LABEL[o.granja]}${o.galpon ? ` G${o.galpon}` : ""}` : "—"}
                              </td>
                              <td>{v.cliente?.razonSocial || <span className="text-muted">—</span>}</td>
                              <td className="text-end">{fmtNum(o?.cantidadReal)}</td>
                              <td className="text-end">{o?.pesoRealKg ? `${o.pesoRealKg} kg` : "—"}</td>
                              <td className="text-end">{fmtARS(v.precioPorKg)}</td>
                              <td className="text-end fw-semibold text-success">{fmtARS(v.precioTotalReal)}</td>
                              <td className="text-muted small">{formatearFechaLocal(v.fecha)}</td>
                              {esSuperAdmin() && (
                                <td>
                                  <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(v)}>
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
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showNuevaOrden && (
        <NuevaOrdenModal
          onClose={() => setShowNuevaOrden(false)}
          onCreada={() => { setShowNuevaOrden(false); cargar(); }}
        />
      )}

      {ordenEmitir && (
        <EmitirVentaModal
          orden={ordenEmitir}
          onClose={() => setOrdenEmitir(null)}
          onEmitida={() => { setOrdenEmitir(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default VentasGranjaPage;
