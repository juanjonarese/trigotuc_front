import React, { useState, useEffect, useCallback, useRef } from "react";
import Layout from "../components/Layout";
import CalibreTable from "../components/CalibreTable";
import {
  obtenerPedidosFrigorifico,
  crearPedidoFrigorifico,
  confirmarEntregaPedidoFrigorifico,
  emitirVentaPedidoFrigorifico,
  eliminarPedidoFrigorifico,
  obtenerClientes,
  obtenerResumenStock,
} from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const CAMARAS = [
  { value: "cañete",   label: "Cañete" },
  { value: "trigotuc", label: "Trigotuc" },
];

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

const imprimirOrdenRetiro = ({ numeroOrden, codigoRetiro }, pedido) => {
  const cliente = pedido.cliente?.razonSocial || "—";
  const camara  = pedido.camara === "cañete" ? "Cañete" : "Trigotuc";
  const calibres = (pedido.calibres || []).map((c) =>
    `<tr><td style="padding:4px 12px;border:1px solid #dee2e6;text-align:center">Cal. ${c.calibre}</td>
         <td style="padding:4px 12px;border:1px solid #dee2e6;text-align:right">${fmtNum(c.cajones)} cajones</td></tr>`
  ).join("");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Orden ${numeroOrden}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;color:#222;max-width:600px;margin:0 auto}
      .logo{font-size:22px;font-weight:bold;margin-bottom:4px}.logo span{color:#f59e0b}
      h2{font-size:16px;border-bottom:2px solid #222;padding-bottom:6px;margin:20px 0 12px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-bottom:16px}
      .fila{display:flex;flex-direction:column}
      .lbl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px}
      .val{font-size:14px;font-weight:600}
      .codigo-box{text-align:center;margin:24px 0;border:3px solid #f59e0b;border-radius:8px;padding:16px;background:#fffbeb}
      .codigo-lbl{font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
      .codigo-val{font-size:42px;font-weight:bold;color:#b45309;letter-spacing:8px}
      .alerta{background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:10px 14px;font-size:12px;color:#166534;margin-top:20px}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="logo">Trigotuc <span>Avícola</span></div>
    <p style="font-size:13px;color:#666;margin-bottom:24px">Orden de Retiro — Pollos Faenados</p>
    <h2>Datos del pedido</h2>
    <div class="grid">
      <div class="fila"><span class="lbl">N° Orden</span><span class="val">${numeroOrden}</span></div>
      <div class="fila"><span class="lbl">Cámara</span><span class="val">${camara}</span></div>
      <div class="fila"><span class="lbl">Cliente</span><span class="val">${cliente}</span></div>
    </div>
    <table><thead><tr>
      <th style="padding:4px 12px;background:#f8f9fa;border:1px solid #dee2e6;text-align:center">Calibre</th>
      <th style="padding:4px 12px;background:#f8f9fa;border:1px solid #dee2e6;text-align:right">Cajones</th>
    </tr></thead><tbody>${calibres}</tbody></table>
    <div class="codigo-box">
      <div class="codigo-lbl">Código de retiro — presentar al frigorifico</div>
      <div class="codigo-val">${codigoRetiro || "—"}</div>
    </div>
    <div class="alerta">⚠️ El frigorifico necesita este código para confirmar la entrega. Sin el código no se realizará el despacho.</div>
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;
  const win = window.open("", "_blank", "width=720,height=700");
  win.document.write(html);
  win.document.close();
};

const fmtARS = (n) => n != null
  ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
  : "—";

// ── Modal nueva orden ────────────────────────────────────────────────────────
const NuevaOrdenModal = ({ clientes, resumen, onClose, onCreada }) => {
  const [form, setForm] = useState({ cliente: "", camara: "cañete", fecha: obtenerFechaHoy(), observaciones: "" });
  const [lineas, setLineas] = useState([]);
  const [saving, setSaving] = useState(false);
  const calibreRef = useRef(null);

  const stockCamara = resumen
    ? (form.camara === "cañete" ? resumen.stockCañete : resumen.stockTrigotuc)
    : null;

  const totalCajones = lineas.reduce((a, l) => a + Number(l.cajones || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lineasFinales = calibreRef.current?.getLineas() ?? lineas;
    if (!lineasFinales.length) {
      Swal.fire("Faltan calibres", "Agregá al menos un calibre con cajones.", "warning"); return;
    }
    if (!form.cliente) {
      Swal.fire("Falta el cliente", "Seleccioná el cliente.", "warning"); return;
    }
    setSaving(true);
    try {
      await crearPedidoFrigorifico({
        cliente:       form.cliente,
        camara:        form.camara,
        calibres:      lineasFinales.map((l) => ({ calibre: Number(l.calibre), cajones: Number(l.cajones) })),
        fechaPedido:   form.fecha,
        observaciones: form.observaciones || undefined,
      });
      onCreada();
      Swal.fire({ icon: "success", title: "Orden creada", text: "Queda pendiente de confirmación por el frigorifico.", timer: 2000, showConfirmButton: false });
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
              <h5 className="modal-title"><i className="bi bi-clipboard2-plus me-2"></i>Nueva orden de venta</h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-nueva-orden-venta" onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold">Cliente <span className="text-danger">*</span></label>
                    <select className="form-select" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} required>
                      <option value="">— Seleccioná el cliente —</option>
                      {clientes.map((c) => <option key={c._id} value={c._id}>{c.razonSocial || c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Cámara <span className="text-danger">*</span></label>
                    <div className="d-flex gap-2">
                      {CAMARAS.map((c) => (
                        <button key={c.value} type="button"
                          className={`btn flex-grow-1 ${form.camara === c.value ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => setForm({ ...form, camara: c.value })}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Fecha</label>
                    <input type="date" className="form-control" value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Observaciones</label>
                    <input type="text" className="form-control" value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                  </div>
                </div>

                {/* Stock disponible */}
                {stockCamara && (
                  <div className="alert alert-light border mb-3 py-2">
                    <div className="small text-muted fw-semibold mb-1">
                      Stock {form.camara === "cañete" ? "Cañete" : "Trigotuc"} disponible
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      {stockCamara.map((s) => (
                        <span key={s.calibre} className={`badge ${s.cajones > 0 ? "bg-success" : "bg-secondary"}`}>
                          Cal.{s.calibre}: {fmtNum(s.cajones)} caj
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <label className="form-label fw-semibold">Calibres (cajones)</label>
                <CalibreTable
                  ref={calibreRef}
                  lineas={lineas}
                  onChange={setLineas}
                  inputCajones={true}
                  stockCalibres={stockCamara}
                />

                {totalCajones > 0 && (
                  <div className="alert alert-info py-2 mt-2 mb-0 text-center">
                    <strong>{fmtNum(totalCajones)}</strong> cajones · <strong>{fmtNum(totalCajones * 20)}</strong> kg
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-nueva-orden-venta" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-send me-1"></i>Enviar al frigorifico
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal emitir venta ────────────────────────────────────────────────────────
const EmitirVentaModal = ({ pedido, onClose, onEmitida }) => {
  const [lineas, setLineas] = useState(
    (pedido.calibres || []).map((c) => ({ calibre: c.calibre, cajones: c.cajones, pollos: c.cajones * c.calibre, precioPorCajon: 0 }))
  );
  const [descuento, setDescuento]     = useState(0);
  const [fecha, setFecha]             = useState(obtenerFechaHoy());
  const [observaciones, setObs]       = useState("");
  const [saving, setSaving]           = useState(false);
  const calibreRef                    = useRef(null);

  const totalCajones     = lineas.reduce((a, l) => a + Number(l.cajones || 0), 0);
  const subtotal         = lineas.reduce((a, l) => a + (Number(l.cajones) * Number(l.precioPorCajon || 0)), 0);
  const descuentoImporte = subtotal * (Number(descuento) / 100);
  const total            = subtotal - descuentoImporte;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lineasFinales = calibreRef.current?.getLineas() ?? lineas;
    if (!lineasFinales.some((l) => Number(l.precioPorCajon) > 0)) {
      Swal.fire("Falta el precio", "Ingresá el precio por cajón para al menos un calibre.", "warning"); return;
    }
    setSaving(true);
    try {
      const resultado = await emitirVentaPedidoFrigorifico(pedido._id, {
        calibres:      lineasFinales.map((l) => ({ calibre: Number(l.calibre), cajones: Number(l.cajones), precioPorCajon: Number(l.precioPorCajon || 0) })),
        descuento:     Number(descuento),
        fecha,
        observaciones: observaciones || undefined,
      });
      // Imprimir comprobante con código si viene en la respuesta
      if (resultado?._ordenRetiro?.codigoRetiro) {
        imprimirOrdenRetiro(resultado._ordenRetiro, pedido);
      }
      onEmitida();
      Swal.fire({ icon: "success", title: "Venta emitida", text: `Total: ${fmtARS(total)}`, timer: 2000, showConfirmButton: false });
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
            <div className="modal-header bg-success text-white">
              <div>
                <h5 className="modal-title mb-0"><i className="bi bi-receipt me-2"></i>Emitir venta</h5>
                <div className="small opacity-75 mt-1">{pedido.numero} — {pedido.cliente?.razonSocial} — {pedido.camara === "cañete" ? "Cañete" : "Trigotuc"}</div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                Confirmá los cajones entregados e ingresá el precio por cajón para cada calibre.
              </p>
              <form id="form-emitir-venta-pollo" onSubmit={handleSubmit}>
                <CalibreTable
                  ref={calibreRef}
                  lineas={lineas}
                  onChange={setLineas}
                  inputCajones={true}
                  showPrecio={true}
                />

                {totalCajones > 0 && (
                  <div className="row g-3 mt-2">
                    <div className="col-6 col-md-3">
                      <label className="form-label">Descuento %</label>
                      <input type="number" className="form-control" min="0" max="100" step="0.1"
                        value={descuento} onChange={(e) => setDescuento(e.target.value)} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label">Fecha</label>
                      <input type="date" className="form-control" value={fecha}
                        onChange={(e) => setFecha(e.target.value)} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Observaciones</label>
                      <input type="text" className="form-control" value={observaciones}
                        onChange={(e) => setObs(e.target.value)} />
                    </div>
                  </div>
                )}

                {total > 0 && (
                  <div className="alert alert-success py-2 mt-3 text-center">
                    <div className="small text-muted">Subtotal: {fmtARS(subtotal)} {Number(descuento) > 0 && `— Descuento ${descuento}%: -${fmtARS(descuentoImporte)}`}</div>
                    <div className="fw-bold fs-4">{fmtARS(total)}</div>
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-emitir-venta-pollo" className="btn btn-success btn-lg px-4" disabled={saving}>
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

// ── Página principal ──────────────────────────────────────────────────────────
const VentasPolloPage = () => {
  const rolUsuario  = localStorage.getItem("rolUsuario");
  const esSuperAdmin = rolUsuario === "superadmin";
  const esAdmin      = rolUsuario === "superadmin" || rolUsuario === "administracion";

  const [pedidos, setPedidos]       = useState([]);
  const [clientes, setClientes]     = useState([]);
  const [resumen, setResumen]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showNueva, setShowNueva]   = useState(false);
  const [pedidoEmitir, setPedidoEmitir] = useState(null);
  const [filtroPedido, setFiltroPedido] = useState("pendiente");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, r] = await Promise.all([
        obtenerPedidosFrigorifico(),
        obtenerClientes(),
        obtenerResumenStock(),
      ]);
      setPedidos(p);
      setClientes(c.clientes || c);
      setResumen(r);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleConfirmar = async (pedido) => {
    const ok = await Swal.fire({
      title: `¿Confirmar entrega ${pedido.numero}?`,
      text: `${pedido.cliente?.razonSocial} — ${pedido.camara === "cañete" ? "Cañete" : "Trigotuc"}`,
      icon: "question", showCancelButton: true,
      confirmButtonText: "Confirmar", cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await confirmarEntregaPedidoFrigorifico(pedido._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Entrega confirmada", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleEliminar = async (pedido) => {
    const ok = await Swal.fire({
      title: "¿Eliminar orden?", text: pedido.numero, icon: "warning",
      showCancelButton: true, confirmButtonColor: "#dc3545",
      confirmButtonText: "Eliminar", cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await eliminarPedidoFrigorifico(pedido._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const pendientes  = pedidos.filter((p) => p.estado === "pendiente");
  const entregadas  = pedidos.filter((p) => p.estado === "entregada");
  const cerradas    = pedidos.filter((p) => p.estado === "cerrada");

  const pedidosFiltrados = filtroPedido === "pendiente" ? pendientes
    : filtroPedido === "entregada" ? entregadas
    : filtroPedido === "cerrada"   ? cerradas
    : pedidos;

  const badgeEstado = (p) => {
    if (p.estado === "cerrada")   return <span className="badge bg-success">Emitida</span>;
    if (p.estado === "entregada") return <span className="badge bg-warning text-dark">Pendiente emisión</span>;
    return <span className="badge bg-secondary">Pendiente entrega</span>;
  };

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-cart3 me-2 text-success"></i>
            Ventas Pollos Faenados
          </h1>
          {esAdmin && (
            <button className="btn btn-primary" onClick={() => setShowNueva(true)}>
              <i className="bi bi-plus-circle me-1"></i>Nueva orden
            </button>
          )}
        </div>

        {/* Stock rápido */}
        {resumen && (
          <div className="row g-3 mb-4">
            {[{ key: "cañete", label: "Cañete", stock: resumen.stockCañete }, { key: "trigotuc", label: "Trigotuc", stock: resumen.stockTrigotuc }].map(({ key, label, stock }) => (
              <div key={key} className="col-12 col-md-6">
                <div className="card border-0 shadow-sm">
                  <div className="card-body py-2">
                    <div className="small text-muted fw-semibold mb-1">{label} — Stock disponible</div>
                    <div className="d-flex flex-wrap gap-2">
                      {(stock || []).map((s) => (
                        <span key={s.calibre} className={`badge ${s.cajones > 0 ? "bg-success" : "bg-secondary"}`}>
                          Cal.{s.calibre}: {fmtNum(s.cajones)} caj
                        </span>
                      ))}
                      {(!stock || stock.length === 0) && <span className="text-muted small">Sin stock</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : (
          <>
            {/* ── Pendientes de emisión (cards) ── */}
            {entregadas.length > 0 && (
              <div className="mb-4">
                <h6 className="fw-semibold mb-2" style={{ color: "#b45309" }}>
                  <i className="bi bi-exclamation-circle me-1 text-warning"></i>
                  Confirmadas por frigorifico — pendientes de emitir ({entregadas.length})
                </h6>
                <div className="row g-3">
                  {entregadas.map((p) => (
                    <div key={p._id} className="col-12 col-md-6 col-lg-4">
                      <div className="card border-0 shadow-sm h-100" style={{ borderLeft: "4px solid #f59e0b" }}>
                        <div className="card-body">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="badge bg-dark">{p.numero}</span>
                            <span className="badge bg-warning text-dark">Pendiente emisión</span>
                          </div>
                          <div className="fw-bold mb-1">{p.cliente?.razonSocial}</div>
                          <div className="small text-muted mb-2">
                            {p.camara === "cañete" ? "Cañete" : "Trigotuc"} · {formatearFechaLocal(p.fechaEntrega || p.fechaPedido)}
                          </div>
                          <div className="d-flex flex-wrap gap-1 mb-2">
                            {(p.calibres || []).map((c) => (
                              <span key={c.calibre} className="badge bg-primary">Cal.{c.calibre}: {fmtNum(c.cajones)} caj</span>
                            ))}
                          </div>
                        </div>
                        <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
                          <button className="btn btn-success w-100" onClick={() => setPedidoEmitir(p)}>
                            <i className="bi bi-receipt me-1"></i>Emitir venta
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tabla general con filtros ── */}
            <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
              <h6 className="fw-bold mb-0">Órdenes</h6>
              <div className="d-flex gap-1">
                {[
                  { v: "pendiente", l: `Pendientes (${pendientes.length})` },
                  { v: "entregada", l: `Confirmadas (${entregadas.length})` },
                  { v: "cerrada",   l: `Emitidas (${cerradas.length})` },
                  { v: "",          l: "Todas" },
                ].map(({ v, l }) => (
                  <button key={v}
                    className={`btn btn-sm ${filtroPedido === v ? "btn-dark" : "btn-outline-secondary"}`}
                    onClick={() => setFiltroPedido(v)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                {pedidosFiltrados.length === 0 ? (
                  <p className="text-center text-muted py-4 mb-0">No hay órdenes en este estado.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>N° Orden</th>
                          <th>Cliente</th>
                          <th>Cámara</th>
                          <th>Calibres / Cajones</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th className="text-end">Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosFiltrados.map((p) => (
                          <tr key={p._id}>
                            <td><span className="badge bg-dark">{p.numero}</span></td>
                            <td className="fw-semibold">{p.cliente?.razonSocial}</td>
                            <td>{p.camara === "cañete" ? "Cañete" : "Trigotuc"}</td>
                            <td>
                              <div className="d-flex flex-wrap gap-1">
                                {(p.calibres || []).map((c) => (
                                  <span key={c.calibre} className="badge bg-primary">Cal.{c.calibre}: {fmtNum(c.cajones)}</span>
                                ))}
                              </div>
                            </td>
                            <td className="text-muted small">{formatearFechaLocal(p.fechaPedido)}</td>
                            <td>{badgeEstado(p)}</td>
                            <td className="text-end fw-semibold">
                              {p.ventaAsociada?.total ? fmtARS(p.ventaAsociada.total) : <span className="text-muted">—</span>}
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                {p.estado === "pendiente" && esAdmin && (
                                  <button className="btn btn-sm btn-outline-success" onClick={() => handleConfirmar(p)} title="Confirmar entrega">
                                    <i className="bi bi-check2-circle"></i>
                                  </button>
                                )}
                                {p.estado === "entregada" && esAdmin && (
                                  <button className="btn btn-sm btn-success" onClick={() => setPedidoEmitir(p)}>
                                    <i className="bi bi-receipt me-1"></i>Emitir
                                  </button>
                                )}
                                {esSuperAdmin && p.estado !== "cerrada" && (
                                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(p)}>
                                    <i className="bi bi-trash"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showNueva && (
        <NuevaOrdenModal
          clientes={clientes}
          resumen={resumen}
          onClose={() => setShowNueva(false)}
          onCreada={() => { setShowNueva(false); cargar(); }}
        />
      )}

      {pedidoEmitir && (
        <EmitirVentaModal
          pedido={pedidoEmitir}
          onClose={() => setPedidoEmitir(null)}
          onEmitida={() => { setPedidoEmitir(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default VentasPolloPage;
