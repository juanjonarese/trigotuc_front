import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerVentasGranja,
  crearVentaGranja,
  confirmarRetiroGranja,
  cancelarVentaGranja,
  eliminarVentaGranja,
  obtenerLotesGranja,
  obtenerClientes,
} from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

// ── Modal confirmación de retiro con cantidades reales ──────────────────────
const ConfirmarRetiroModal = ({ venta, onClose, onConfirmado }) => {
  const [form, setForm] = useState({ cantidadReal: "", pesoRealKg: "", observacionesRetiro: "" });
  const [saving, setSaving] = useState(false);

  const totalReal = form.cantidadReal && form.pesoRealKg
    ? (Number(form.pesoRealKg) * venta.precioPorKg).toFixed(2)
    : null;

  const difCant = form.cantidadReal !== "" && Number(form.cantidadReal) !== venta.cantidadComprometida;
  const difPeso = form.pesoEstimadoKg !== "" && form.pesoRealKg !== "" &&
    venta.pesoEstimadoKg && Math.abs(Number(form.pesoRealKg) - venta.pesoEstimadoKg) > 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cantidadReal || !form.pesoRealKg) {
      Swal.fire("Faltan datos", "Ingresá cantidad real y kg reales.", "warning"); return;
    }
    setSaving(true);
    try {
      await confirmarRetiroGranja(venta._id, {
        cantidadReal:        Number(form.cantidadReal),
        pesoRealKg:          Number(form.pesoRealKg),
        observacionesRetiro: form.observacionesRetiro || undefined,
      });
      onConfirmado();
      Swal.fire({ icon: "success", title: "Retiro confirmado", text: `Total: $${Number(totalReal).toLocaleString("es-AR")}`, timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <div>
                <h5 className="modal-title mb-0"><i className="bi bi-check2-circle me-2"></i>Confirmar retiro</h5>
                <div className="small opacity-75 mt-1">{venta.numeroVenta} — {venta.cliente?.razonSocial}</div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">

              {/* Resumen del pedido */}
              <div className="card border-0 bg-light mb-3">
                <div className="card-body py-2 px-3">
                  <div className="small text-muted fw-semibold mb-1 text-uppercase" style={{ letterSpacing: "0.05em" }}>Pedido original</div>
                  <div className="d-flex gap-4">
                    <div>
                      <div className="fw-bold">{fmtNum(venta.cantidadComprometida)}</div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>pollos comprometidos</div>
                    </div>
                    {venta.pesoEstimadoKg && (
                      <div>
                        <div className="fw-bold">{venta.pesoEstimadoKg} kg</div>
                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>kg estimados</div>
                      </div>
                    )}
                    <div>
                      <div className="fw-bold">{fmtARS(venta.precioPorKg)}/kg</div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>precio pactado</div>
                    </div>
                  </div>
                </div>
              </div>

              <form id="form-confirmar-retiro" onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad real retirada <span className="text-danger">*</span></label>
                    <input type="number" min="1" className={`form-control form-control-lg text-center ${difCant ? "border-warning" : ""}`}
                      placeholder={venta.cantidadComprometida}
                      value={form.cantidadReal}
                      onChange={(e) => setForm({ ...form, cantidadReal: e.target.value })}
                      required autoFocus />
                    {difCant && (
                      <div className="form-text text-warning fw-semibold text-center">
                        Dif: {Number(form.cantidadReal) - venta.cantidadComprometida > 0 ? "+" : ""}
                        {Number(form.cantidadReal) - venta.cantidadComprometida} pollos
                      </div>
                    )}
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Kg reales (peso vivo) <span className="text-danger">*</span></label>
                    <input type="number" min="0.01" step="0.01" className={`form-control form-control-lg text-center ${difPeso ? "border-warning" : ""}`}
                      placeholder={venta.pesoEstimadoKg || "0"}
                      value={form.pesoRealKg}
                      onChange={(e) => setForm({ ...form, pesoRealKg: e.target.value })}
                      required />
                    {difPeso && (
                      <div className="form-text text-warning fw-semibold text-center">
                        Dif: {(Number(form.pesoRealKg) - venta.pesoEstimadoKg) > 0 ? "+" : ""}
                        {(Number(form.pesoRealKg) - venta.pesoEstimadoKg).toFixed(1)} kg
                      </div>
                    )}
                  </div>

                  {totalReal && (
                    <div className="col-12">
                      <div className="alert alert-success py-2 mb-0 text-center">
                        <div className="small text-muted">Total real</div>
                        <div className="fw-bold fs-5">{fmtARS(Number(totalReal))}</div>
                        <div className="small text-muted">{form.pesoRealKg} kg × {fmtARS(venta.precioPorKg)}/kg</div>
                      </div>
                    </div>
                  )}

                  <div className="col-12">
                    <label className="form-label">Observaciones del retiro <span className="text-muted">(opcional)</span></label>
                    <textarea className="form-control" rows={2}
                      value={form.observacionesRetiro}
                      onChange={(e) => setForm({ ...form, observacionesRetiro: e.target.value })}
                      placeholder="Notas sobre el retiro..." />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-confirmar-retiro" className="btn btn-success btn-lg px-4" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                <i className="bi bi-check-circle me-1"></i>Confirmar retiro
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

const rolUsuario   = () => localStorage.getItem("rolUsuario");
const esSuperAdmin = () => rolUsuario() === "superadmin";

const GRANJA_LABEL = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJA_PREFIX = { cañete: "C", los_pinos: "P" };

const badgeEstado = (estado) => {
  if (estado === "pendiente")  return <span className="badge bg-warning text-dark">Pendiente</span>;
  if (estado === "retirado")   return <span className="badge bg-success">Retirado</span>;
  if (estado === "cancelado")  return <span className="badge bg-secondary">Cancelado</span>;
  return <span className="badge bg-light text-dark">{estado}</span>;
};

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtARS = (n) => n != null ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n) : "—";

const FORM_INICIAL = {
  loteGranja: "", cliente: "", cantidadComprometida: "",
  precioPorKg: "", pesoEstimadoKg: "", fechaPactada: obtenerFechaHoy(), observaciones: "",
};

const VentasGranjaPage = () => {
  const [ventas, setVentas]     = useState([]);
  const [lotes, setLotes]       = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");

  const [showModal, setShowModal]         = useState(false);
  const [ventaRetiro, setVentaRetiro]     = useState(null);
  const [form, setForm]                   = useState(FORM_INICIAL);
  const [submitting, setSubmitting]       = useState(false);

  const loteSeleccionado = lotes.find((l) => l._id === form.loteGranja);
  const pesoTotal = form.pesoEstimadoKg && form.precioPorKg
    ? Number(form.pesoEstimadoKg) * Number(form.precioPorKg) : null;

  const cargar = useCallback(async () => {
    try {
      const [v, l, c] = await Promise.all([
        obtenerVentasGranja(filtroEstado ? { estado: filtroEstado } : {}),
        obtenerLotesGranja({ estado: "en_crianza" }),
        obtenerClientes(),
      ]);
      setVentas(v);
      setLotes(l);
      setClientes(c.clientes || c);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const venta = await crearVentaGranja({
        loteGranja:           form.loteGranja,
        cliente:              form.cliente,
        cantidadComprometida: Number(form.cantidadComprometida),
        precioPorKg:          Number(form.precioPorKg),
        pesoEstimadoKg:       form.pesoEstimadoKg ? Number(form.pesoEstimadoKg) : undefined,
        fechaPactada:         form.fechaPactada,
        observaciones:        form.observaciones || undefined,
      });
      setShowModal(false);
      setForm(FORM_INICIAL);
      await cargar();
      imprimirVenta(venta);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const imprimirVenta = (venta) => {
    const cliente = venta.cliente?.razonSocial || "—";
    const lote    = venta.loteGranja;
    const granja  = lote ? `${GRANJA_LABEL[lote.granja] || lote.granja} — Galpón ${GRANJA_PREFIX[lote.granja] || ""}${lote.galpon}` : "—";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
      <title>Venta ${venta.numeroVenta}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
        .logo { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
        .logo span { color: #f59e0b; }
        h2 { font-size: 18px; margin: 16px 0 8px; border-bottom: 2px solid #222; padding-bottom: 6px; }
        .codigo { font-size: 36px; font-weight: bold; color: #f59e0b; letter-spacing: 4px; text-align: center; margin: 20px 0; border: 3px solid #f59e0b; padding: 12px; border-radius: 8px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; }
        .row { display: flex; flex-direction: column; }
        .lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
        .val { font-size: 15px; font-weight: 600; }
        .alerta { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px; margin-top: 20px; font-size: 13px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="logo">Trigotuc <span>Avícola</span></div>
      <div style="font-size:12px;color:#666;margin-bottom:20px;">Comprobante de Venta — Pollos en pie</div>
      <div class="codigo">${venta.numeroVenta}</div>
      <h2>Detalle de la venta</h2>
      <div class="grid">
        <div class="row"><span class="lbl">Cliente</span><span class="val">${cliente}</span></div>
        <div class="row"><span class="lbl">Fecha de registro</span><span class="val">${new Date(venta.fecha).toLocaleDateString("es-AR")}</span></div>
        <div class="row"><span class="lbl">Galpón</span><span class="val">${granja}</span></div>
        <div class="row"><span class="lbl">Fecha pactada de retiro</span><span class="val">${new Date(venta.fechaPactada).toLocaleDateString("es-AR")}</span></div>
        <div class="row"><span class="lbl">Cantidad comprometida</span><span class="val">${fmtNum(venta.cantidadComprometida)} pollos</span></div>
        <div class="row"><span class="lbl">Precio por kg</span><span class="val">${fmtARS(venta.precioPorKg)}/kg</span></div>
        ${venta.pesoEstimadoKg ? `<div class="row"><span class="lbl">Peso estimado</span><span class="val">${fmtNum(venta.pesoEstimadoKg)} kg</span></div>` : ""}
        ${venta.precioTotal    ? `<div class="row"><span class="lbl">Total estimado</span><span class="val">${fmtARS(venta.precioTotal)}</span></div>` : ""}
      </div>
      ${venta.observaciones ? `<div style="font-size:13px;color:#555;margin-bottom:12px;">Observaciones: ${venta.observaciones}</div>` : ""}
      <div class="alerta">⚠️ Presentar este código al momento del retiro. Sin código no se entregará mercadería.</div>
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`;
    const win = window.open("", "_blank", "width=700,height=600");
    win.document.write(html);
    win.document.close();
  };

  const handleConfirmar = (venta) => setVentaRetiro(venta);

  const handleCancelar = async (venta) => {
    const confirm = await Swal.fire({
      title: "¿Cancelar venta?",
      text: `${venta.numeroVenta} — ${venta.cliente?.razonSocial}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "No",
    });
    if (!confirm.isConfirmed) return;
    try {
      await cancelarVentaGranja(venta._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Venta cancelada", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleEliminar = async (venta) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar venta?",
      text: venta.numeroVenta,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
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
          <button className="btn btn-success btn-sm" onClick={() => { setForm(FORM_INICIAL); setShowModal(true); }}>
            <i className="bi bi-plus-circle me-1"></i>Nueva venta
          </button>
        </div>

        {/* Filtro estado */}
        <div className="d-flex gap-2 mb-3">
          {["", "pendiente", "retirado", "cancelado"].map((e) => (
            <button
              key={e}
              className={`btn btn-sm ${filtroEstado === e ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setFiltroEstado(e)}
            >
              {e === "" ? "Todas" : e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4"><div className="spinner-border text-success"></div></div>
            ) : ventas.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">No hay ventas.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {ventas.map((v) => (
                    <div key={v._id} className="card border mb-2">
                      <div className="card-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <div>
                            <span className="badge bg-warning text-dark fs-6 me-2">{v.numeroVenta}</span>
                            {badgeEstado(v.estado)}
                          </div>
                          <div className="d-flex gap-1">
                            {v.estado === "pendiente" && (
                              <>
                                <button className="btn btn-outline-secondary btn-sm" title="Imprimir" onClick={() => imprimirVenta(v)}><i className="bi bi-printer"></i></button>
                                <button className="btn btn-success btn-sm" onClick={() => handleConfirmar(v)}>Retiro</button>
                                <button className="btn btn-outline-warning btn-sm" onClick={() => handleCancelar(v)}>Cancelar</button>
                              </>
                            )}
                            {esSuperAdmin() && <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(v)}><i className="bi bi-trash"></i></button>}
                          </div>
                        </div>
                        <div className="fw-semibold small">{v.cliente?.razonSocial || "—"}</div>
                        <div className="text-muted small">
                          {v.loteGranja ? `${GRANJA_LABEL[v.loteGranja.granja]} G${GRANJA_PREFIX[v.loteGranja.granja]}${v.loteGranja.galpon}` : "—"} · {fmtNum(v.cantidadComprometida)} pollos · {fmtARS(v.precioPorKg)}/kg
                        </div>
                        <div className="text-muted small">Retiro: {formatearFechaLocal(v.fechaPactada)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Código</th>
                        <th>Cliente</th>
                        <th>Galpón</th>
                        <th className="text-end">Cant. comprometida</th>
                        <th className="text-end">Cant. real</th>
                        <th className="text-end">Kg reales</th>
                        <th className="text-end">$/kg</th>
                        <th className="text-end">Total real</th>
                        <th>Fecha retiro</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventas.map((v) => (
                        <tr key={v._id}>
                          <td><span className="badge bg-warning text-dark fs-6">{v.numeroVenta}</span></td>
                          <td className="fw-semibold">{v.cliente?.razonSocial || "—"}</td>
                          <td className="text-muted small">
                            {v.loteGranja ? `${GRANJA_LABEL[v.loteGranja.granja]} — G${GRANJA_PREFIX[v.loteGranja.granja]}${v.loteGranja.galpon}` : "—"}
                          </td>
                          <td className="text-end">{fmtNum(v.cantidadComprometida)}</td>
                          <td className="text-end fw-semibold">{v.cantidadReal != null ? fmtNum(v.cantidadReal) : <span className="text-muted">—</span>}</td>
                          <td className="text-end">{v.pesoRealKg != null ? `${v.pesoRealKg} kg` : <span className="text-muted">—</span>}</td>
                          <td className="text-end">{fmtARS(v.precioPorKg)}</td>
                          <td className="text-end fw-semibold text-success">{v.precioTotalReal ? fmtARS(v.precioTotalReal) : <span className="text-muted">—</span>}</td>
                          <td>{v.fechaRetiro ? formatearFechaLocal(v.fechaRetiro) : formatearFechaLocal(v.fechaPactada)}</td>
                          <td>{badgeEstado(v.estado)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              {v.estado === "pendiente" && (
                                <>
                                  <button className="btn btn-outline-secondary btn-sm" title="Imprimir" onClick={() => imprimirVenta(v)}><i className="bi bi-printer"></i></button>
                                  <button className="btn btn-success btn-sm" onClick={() => handleConfirmar(v)}>Confirmar retiro</button>
                                  <button className="btn btn-outline-warning btn-sm" onClick={() => handleCancelar(v)}>Cancelar</button>
                                </>
                              )}
                              {esSuperAdmin() && <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(v)}><i className="bi bi-trash"></i></button>}
                            </div>
                          </td>
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

      {/* Modal confirmar retiro */}
      {ventaRetiro && (
        <ConfirmarRetiroModal
          venta={ventaRetiro}
          onClose={() => setVentaRetiro(null)}
          onConfirmado={() => { setVentaRetiro(null); cargar(); }}
        />
      )}

      {/* Modal nueva venta */}
      {showModal && (
        <>
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-bag-check me-2"></i>Nueva venta — Pollos en pie</h5>
                  <button className="btn-close" onClick={() => setShowModal(false)} disabled={submitting}></button>
                </div>
                <div className="modal-body">
                  <form id="form-venta-granja" onSubmit={handleSubmit}>
                    <div className="row g-3">

                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">Galpón</label>
                        <select className="form-select" value={form.loteGranja} onChange={(e) => setForm({ ...form, loteGranja: e.target.value })} required>
                          <option value="">— Seleccioná el galpón —</option>
                          {lotes.map((l) => (
                            <option key={l._id} value={l._id}>
                              {GRANJA_LABEL[l.granja]} — G{GRANJA_PREFIX[l.granja]}{l.galpon} ({fmtNum(l.cantidadActual)} pollos)
                            </option>
                          ))}
                        </select>
                        {loteSeleccionado && (
                          <div className="form-text text-success fw-semibold">
                            Lote #{loteSeleccionado.numeroLote} · {fmtNum(loteSeleccionado.cantidadActual)} pollos actuales
                          </div>
                        )}
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold">Cliente</label>
                        <select className="form-select" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required>
                          <option value="">— Seleccioná el cliente —</option>
                          {clientes.map((c) => <option key={c._id} value={c._id}>{c.razonSocial}</option>)}
                        </select>
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label fw-semibold">Cantidad (pollos)</label>
                        <input type="number" className="form-control" value={form.cantidadComprometida}
                          onChange={(e) => setForm({ ...form, cantidadComprometida: e.target.value })}
                          min="1" max={loteSeleccionado?.cantidadActual} placeholder="0" required />
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label fw-semibold">Precio por kg ($)</label>
                        <input type="number" className="form-control" value={form.precioPorKg}
                          onChange={(e) => setForm({ ...form, precioPorKg: e.target.value })}
                          min="0.01" step="0.01" placeholder="0,00" required />
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label">Peso estimado (kg) <span className="text-muted">(opc.)</span></label>
                        <input type="number" className="form-control" value={form.pesoEstimadoKg}
                          onChange={(e) => setForm({ ...form, pesoEstimadoKg: e.target.value })}
                          min="0.01" step="0.01" placeholder="0,00" />
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label fw-semibold">Fecha pactada de retiro</label>
                        <input type="date" className="form-control" value={form.fechaPactada}
                          onChange={(e) => setForm({ ...form, fechaPactada: e.target.value })} required />
                      </div>

                      <div className="col-12">
                        <label className="form-label">Observaciones <span className="text-muted">(opcional)</span></label>
                        <input type="text" className="form-control" value={form.observaciones}
                          onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                      </div>

                      {pesoTotal != null && (
                        <div className="col-12">
                          <div className="alert alert-success py-2 mb-0">
                            Total estimado: <strong>{fmtARS(pesoTotal)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancelar</button>
                  <button type="submit" form="form-venta-granja" className="btn btn-success" disabled={submitting}>
                    {submitting && <span className="spinner-border spinner-border-sm me-1"></span>}
                    <i className="bi bi-check-circle me-1"></i>Registrar e imprimir
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

export default VentasGranjaPage;
