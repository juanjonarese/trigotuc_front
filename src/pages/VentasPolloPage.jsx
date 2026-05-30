import React, { useState, useEffect, useCallback, useRef } from "react";
import Layout from "../components/Layout";
import CalibreTable from "../components/CalibreTable";
import {
  obtenerPedidosFrigorifico,
  crearPedidoFrigorifico,
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

const fmtNum = (n) => n != null
  ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n)
  : "—";

const fmtARS = (n) => n != null
  ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
  : "—";

// ── PDF comprobante de retiro ─────────────────────────────────────────────────
const imprimirOrdenRetiro = ({ numeroOrden, codigoRetiro }, pedido) => {
  const cliente  = pedido.cliente?.razonSocial || "—";
  const camara   = pedido.camara === "cañete" ? "Cañete" : "Trigotuc";
  const calibres = (pedido.calibres || []).map((c) =>
    `<tr>
      <td style="padding:4px 12px;border:1px solid #dee2e6;text-align:center">Cal. ${c.calibre}</td>
      <td style="padding:4px 12px;border:1px solid #dee2e6;text-align:right">${fmtNum(c.cajones)} cajones</td>
      <td style="padding:4px 12px;border:1px solid #dee2e6;text-align:right">${fmtARS(c.subtotal)}</td>
    </tr>`
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
      <th style="padding:4px 12px;background:#f8f9fa;border:1px solid #dee2e6;text-align:right">Subtotal</th>
    </tr></thead><tbody>${calibres}</tbody></table>
    <div class="codigo-box">
      <div class="codigo-lbl">Código de retiro — presentar al frigorifico</div>
      <div class="codigo-val">${codigoRetiro || "—"}</div>
    </div>
    <div class="alerta">⚠️ El frigorifico necesita este código para confirmar la entrega. Sin el código no se realizará el despacho.</div>
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const win = window.open("", "_blank", "width=720,height=700");
  if (!win) throw new Error("popup_blocked");
  win.document.write(html);
  win.document.close();
};

// ── Modal nueva orden ──────────────────────────────────────────────────────────
const NuevaOrdenModal = ({ clientes, resumen, onClose, onCreada }) => {
  const [form, setForm]     = useState({ cliente: "", camara: "cañete", descuento: "0", fecha: obtenerFechaHoy(), observaciones: "" });
  const [lineas, setLineas] = useState([]);
  const [saving, setSaving] = useState(false);
  const calibreRef          = useRef(null);


  const stockCamara = resumen
    ? (form.camara === "cañete" ? resumen.stockCañete : resumen.stockTrigotuc)
    : null;

  const subtotalBruto    = lineas.reduce((a, l) => a + (Number(l.cajones) * Number(l.precioPorCajon || 0)), 0);
  const descuentoNum     = Number(form.descuento || 0);
  const descuentoImporte = subtotalBruto * (descuentoNum / 100);
  const total            = subtotalBruto - descuentoImporte;

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
      const resultado = await crearPedidoFrigorifico({
        cliente:       form.cliente,
        camara:        form.camara,
        calibres:      lineasFinales.map((l) => ({
          calibre:       Number(l.calibre),
          cajones:       Number(l.cajones),
          precioPorCajon: Number(l.precioPorCajon || 0),
        })),
        descuento:     descuentoNum,
        fechaPedido:   form.fecha,
        observaciones: form.observaciones || undefined,
      });

      const ordenRetiro = resultado?._ordenRetiro;
      onCreada();

      // Imprimir PDF con el código
      if (ordenRetiro?.codigoRetiro) {
        try {
          imprimirOrdenRetiro(ordenRetiro, { ...resultado, calibres: lineasFinales });
        } catch {
          await Swal.fire({
            icon: "success",
            title: "Orden creada",
            html: `<p class="text-muted small">El popup fue bloqueado. Código de retiro:</p>
              <div style="font-size:2.2rem;font-weight:bold;letter-spacing:0.35em;color:#b45309;
                border:3px solid #f59e0b;border-radius:8px;padding:14px;background:#fffbeb;margin:8px 0">
                ${ordenRetiro.codigoRetiro}
              </div>
              <p class="text-muted small">N° Orden: ${ordenRetiro.numeroOrden}</p>`,
          });
          return;
        }
      }

      Swal.fire({ icon: "success", title: "Orden creada", text: "El comprobante con el código fue generado.", timer: 2000, showConfirmButton: false });
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
                    <select className="form-select" value={form.cliente}
                      onChange={(e) => { setLineas([]); setForm({ ...form, cliente: e.target.value }); }} required>
                      <option value="">— Seleccioná el cliente —</option>
                      {clientes.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.razonSocial || c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Cámara <span className="text-danger">*</span></label>
                    <div className="d-flex gap-2">
                      {CAMARAS.map((c) => (
                        <button key={c.value} type="button"
                          className={`btn flex-grow-1 ${form.camara === c.value ? "btn-primary" : "btn-outline-secondary"}`}
                          onClick={() => { setLineas([]); setForm({ ...form, camara: c.value }); }}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Descuento %</label>
                    <input type="number" className="form-control" min="0" max="100" step="0.1"
                      value={form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Fecha</label>
                    <input type="date" className="form-control" value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                  </div>
                  <div className="col-12 col-md-9">
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

                <label className="form-label fw-semibold">Calibres y precios</label>
                <CalibreTable
                  ref={calibreRef}
                  lineas={lineas}
                  onChange={setLineas}
                  inputCajones={true}
                  showPrecio={true}
                  stockCalibres={stockCamara}
                />

                {subtotalBruto > 0 && (
                  <div className="alert alert-success py-2 mt-2 mb-0 text-center">
                    {descuentoNum > 0 && (
                      <div className="small text-muted">
                        Subtotal: {fmtARS(subtotalBruto)} — Descuento {descuentoNum}%: -{fmtARS(descuentoImporte)}
                      </div>
                    )}
                    <div className="fw-bold fs-5">Total: {fmtARS(total)}</div>
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-nueva-orden-venta" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-send me-1"></i>Crear orden y generar código
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página principal ───────────────────────────────────────────────────────────
const VentasPolloPage = () => {
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const esSuperAdmin = rolUsuario === "superadmin";
  const esAdmin      = rolUsuario === "superadmin" || rolUsuario === "administracion";

  const [pedidos, setPedidos]     = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [resumen, setResumen]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showNueva, setShowNueva] = useState(false);
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

  const handleEliminar = async (pedido) => {
    const ok = await Swal.fire({
      title: "¿Eliminar orden?", text: `${pedido.numero} — ${pedido.cliente?.razonSocial}`,
      icon: "warning", showCancelButton: true, confirmButtonColor: "#dc3545",
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

  const handleReimprimir = (pedido) => {
    if (!pedido.codigoRetiro) {
      Swal.fire("Sin código", "Esta orden no tiene código generado.", "info"); return;
    }
    try {
      imprimirOrdenRetiro(
        { numeroOrden: pedido._ordenRetiroNum || `OR`, codigoRetiro: pedido.codigoRetiro },
        pedido
      );
    } catch {
      Swal.fire({
        icon: "info",
        title: `Código: ${pedido.codigoRetiro}`,
        text: "Habilitá los popups para imprimir el comprobante.",
      });
    }
  };

  const pendientes = pedidos.filter((p) => p.estado === "pendiente");
  const cerradas   = pedidos.filter((p) => p.estado === "cerrada");

  const pedidosFiltrados = filtroPedido === "pendiente" ? pendientes
    : filtroPedido === "cerrada" ? cerradas
    : pedidos;

  const badgeEstado = (p) =>
    p.estado === "cerrada"
      ? <span className="badge bg-success"><i className="bi bi-check2 me-1"></i>Entregada</span>
      : <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>Pendiente</span>;

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
            {[
              { key: "cañete",   label: "Cañete",   stock: resumen.stockCañete },
              { key: "trigotuc", label: "Trigotuc",  stock: resumen.stockTrigotuc },
            ].map(({ key, label, stock }) => (
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
            {/* ── Filtros ── */}
            <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
              <h6 className="fw-bold mb-0">Órdenes</h6>
              <div className="d-flex gap-1">
                {[
                  { v: "pendiente", l: `Pendientes (${pendientes.length})` },
                  { v: "cerrada",   l: `Entregadas (${cerradas.length})` },
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
                          <th>Código</th>
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
                                  <span key={c.calibre} className="badge bg-primary">
                                    Cal.{c.calibre}: {fmtNum(c.cajones)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="text-muted small">{formatearFechaLocal(p.fechaPedido)}</td>
                            <td>{badgeEstado(p)}</td>
                            <td className="text-end fw-semibold">
                              {p.total ? fmtARS(p.total) : <span className="text-muted">—</span>}
                            </td>
                            <td>
                              {p.codigoRetiro && (
                                <span className="badge bg-warning text-dark fw-bold" style={{ letterSpacing: "0.15em" }}>
                                  {p.codigoRetiro}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                {p.estado === "pendiente" && p.codigoRetiro && (
                                  <button className="btn btn-sm btn-outline-secondary" onClick={() => handleReimprimir(p)} title="Reimprimir comprobante">
                                    <i className="bi bi-printer"></i>
                                  </button>
                                )}
                                {esSuperAdmin && p.estado !== "cerrada" && (
                                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleEliminar(p)} title="Eliminar">
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
    </Layout>
  );
};

export default VentasPolloPage;
