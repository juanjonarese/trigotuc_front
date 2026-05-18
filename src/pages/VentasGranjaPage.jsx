import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerVentasGranja,
  emitirVentaGranja,
  eliminarVentaGranja,
  obtenerOrdenesCarga,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const rolUsuario   = () => localStorage.getItem("rolUsuario");
const esSuperAdmin = () => rolUsuario() === "superadmin";

const GRANJA_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtARS = (n) => n != null
  ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
  : "—";

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
  const [ventas, setVentas]         = useState([]);
  const [pendientes, setPendientes] = useState([]); // OrdenCarga entregadas sin venta
  const [loading, setLoading]       = useState(true);
  const [ordenEmitir, setOrdenEmitir] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [v, ordenes] = await Promise.all([
        obtenerVentasGranja(),
        obtenerOrdenesCarga({ estado: "entregada" }),
      ]);
      setVentas(v);
      // Solo órdenes entregadas que aún no tienen venta granja asociada
      setPendientes(ordenes.filter((o) => !o.ventaGranjaAsociada));
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
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : (
          <>
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
