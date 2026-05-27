import React, { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  obtenerOrdenesCarga,
  crearOrdenCarga,
  actualizarOrdenCarga,
  eliminarOrdenCarga,
  buscarClientes,
  obtenerLotesGranja,
} from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GRANJAS = [
  { value: "cañete",    label: "Cañete" },
  { value: "los_pinos", label: "Los Pinos" },
];

const estadoBadge = (estado) =>
  estado === "entregada"
    ? <span className="badge bg-success">Entregada</span>
    : <span className="badge bg-warning text-dark">Pendiente</span>;

const tieneDiferencia = (o) => {
  if (o.estado !== "entregada") return false;
  const pctCant = o.cantidadEstimada > 0 ? Math.abs(o.diferenciaCantidad ?? 0) / o.cantidadEstimada : 0;
  const pctKg   = o.pesoEstimadoKg   > 0 ? Math.abs(o.diferenciaKg       ?? 0) / o.pesoEstimadoKg   : 0;
  return pctCant > 0.02 || pctKg > 0.02; // alerta si diferencia > 2%
};

const diferenciaLabel = (o) => {
  const parts = [];
  if (o.diferenciaCantidad != null && o.diferenciaCantidad !== 0)
    parts.push(`${o.diferenciaCantidad > 0 ? "+" : ""}${o.diferenciaCantidad} pollos`);
  if (o.diferenciaKg != null && o.diferenciaKg !== 0)
    parts.push(`${o.diferenciaKg > 0 ? "+" : ""}${o.diferenciaKg.toFixed(1)} kg`);
  return parts.join(" · ");
};

const formatARS = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n) : "—";

const GALPONES_MAX = { cañete: 6, los_pinos: 8 };

const calcTotales = (lineas) =>
  lineas.reduce((acc, l) => {
    const cant = Number(l.cantidad) || 0;
    const pMin = Number(l.pesoMin)  || 0;
    const pMax = Number(l.pesoMax)  || pMin;
    return { cant: acc.cant + cant, pesoMin: acc.pesoMin + cant * pMin, pesoMax: acc.pesoMax + cant * pMax };
  }, { cant: 0, pesoMin: 0, pesoMax: 0 });

const NuevaOrdenModal = ({ onClose, onCreada, lotes }) => {
  const [saving, setSaving]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busqueda, setBusqueda]     = useState("");
  const [resultados, setResultados] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [form, setForm] = useState({
    cliente: "", granja: "", galpon: "", lote: "",
    fechaEmision: obtenerFechaHoy(),
    turno: "",
    observaciones: "",
  });
  const [detalle, setDetalle] = useState([{ cantidad: "", pesoMin: "", pesoMax: "" }]);

  const maxGalpones = form.granja ? (GALPONES_MAX[form.granja] || 8) : 0;

  const loteGalpon = form.granja && form.galpon
    ? lotes.find((l) => l.granja === form.granja && l.galpon === Number(form.galpon)) || null
    : null;

  useEffect(() => {
    if (busqueda.length < 2 || clienteSeleccionado) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(busqueda);
        setResultados(data.clientes || data || []);
      } catch { setResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, clienteSeleccionado]);

  const seleccionarCliente = (c) => {
    setClienteSeleccionado(c);
    setBusqueda(c.razonSocial || c.nombre || "");
    setResultados([]);
    setForm((f) => ({ ...f, cliente: c._id }));
  };


  const actualizarLinea = (idx, campo, valor) =>
    setDetalle((prev) => prev.map((l, i) => i === idx ? { ...l, [campo]: valor } : l));

  const agregarLinea  = () => setDetalle((prev) => [...prev, { cantidad: "", pesoMin: "", pesoMax: "" }]);
  const eliminarLinea = (idx) => setDetalle((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!form.cliente) { Swal.fire("Faltan datos", "Seleccioná un cliente de la lista.", "warning"); return; }
    if (!form.granja)  { Swal.fire("Faltan datos", "Seleccioná la granja.", "warning"); return; }
    if (!form.turno)   { Swal.fire("Faltan datos", "Indicá si la carga es por la mañana o por la tarde.", "warning"); return; }

    const lineasValidas = detalle.filter((l) => Number(l.cantidad) > 0 && Number(l.pesoMin) > 0);
    if (lineasValidas.length === 0) {
      Swal.fire("Faltan datos", "Agregá al menos una línea de composición.", "warning");
      return;
    }

    const { cant, pesoMin, pesoMax } = calcTotales(lineasValidas);
    const pesoEstimadoKg  = +pesoMin.toFixed(3);
    const pesoEstimadoMax = +pesoMax.toFixed(3);

    const detalleGuardar = lineasValidas.map((l) => ({
      cantidad: Number(l.cantidad),
      pesoMin:  Number(l.pesoMin),
      pesoMax:  l.pesoMax ? Number(l.pesoMax) : undefined,
    }));

    setSaving(true);
    try {
      const orden = await crearOrdenCarga({
        tipo:             "venta_gordos",
        cliente:          form.cliente,
        granja:           form.granja,
        galpon:           form.galpon ? Number(form.galpon) : undefined,
        lote:             form.lote || undefined,
        fechaEmision:     ajustarFechaParaGuardar(form.fechaEmision),
        turno:            form.turno,
        cantidadEstimada: cant,
        pesoEstimadoKg,
        pesoEstimadoMax:  Math.abs(pesoEstimadoMax - pesoEstimadoKg) > 0.001 ? pesoEstimadoMax : undefined,
        detalle:          detalleGuardar,
        observaciones:    form.observaciones || undefined,
      });
      onCreada(orden);
      const { isConfirmed } = await Swal.fire({
        icon: "success",
        title: `Orden ${orden.numero} creada`,
        text: "¿Querés descargar el PDF para enviar al cliente?",
        showCancelButton: true,
        confirmButtonText: "Descargar PDF",
        cancelButtonText: "No, cerrar",
      });
      if (isConfirmed) generarPDF({ ...orden, cliente: clienteSeleccionado });
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
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-file-earmark-plus me-2"></i>Nueva Orden de Carga</h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-nueva-orden" onSubmit={handleSubmit}>

                {/* ── Cliente + Fecha + Turno ── */}
                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Cliente <span className="text-danger">*</span></label>
                    <div className="position-relative">
                      <input type="text"
                        className={`form-control ${clienteSeleccionado ? "is-valid" : submitted && !clienteSeleccionado ? "is-invalid" : ""}`}
                        placeholder="Escribí el nombre del cliente..."
                        value={busqueda}
                        onChange={(e) => { setBusqueda(e.target.value); setClienteSeleccionado(null); setForm((f) => ({ ...f, cliente: "" })); }}
                        autoComplete="off" autoFocus />
                      {resultados.length > 0 && (
                        <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{ zIndex: 1055, maxHeight: "200px", overflowY: "auto" }}>
                          {resultados.map((c) => (
                            <div key={c._id} className="px-3 py-2 border-bottom" style={{ cursor: "pointer" }} onMouseDown={() => seleccionarCliente(c)}>
                              {c.razonSocial || c.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                      {submitted && !clienteSeleccionado && (
                        <div className="invalid-feedback d-block">Seleccioná un cliente de la lista.</div>
                      )}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha pactada <span className="text-danger">*</span></label>
                    <input type="date" className="form-control" value={form.fechaEmision}
                      onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Turno <span className="text-danger">*</span></label>
                    <div className="d-flex gap-2">
                      {[{ value: "mañana", label: "Mañana", icon: "bi-sunrise" }, { value: "tarde", label: "Tarde", icon: "bi-sunset" }].map((t) => (
                        <button key={t.value} type="button"
                          className={`btn flex-grow-1 py-2 ${form.turno === t.value ? "btn-success" : "btn-outline-secondary"}`}
                          onClick={() => setForm((f) => ({ ...f, turno: t.value }))}>
                          <i className={`bi ${t.icon} me-1`}></i>{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Granja + Galpón ── */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Granja <span className="text-danger">*</span></label>
                  <div className="d-flex gap-2">
                    {GRANJAS.map((g) => (
                      <button key={g.value} type="button"
                        className={`btn flex-grow-1 py-2 ${form.granja === g.value ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={() => setForm((f) => ({ ...f, granja: g.value, galpon: "", lote: "" }))}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                {form.granja && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Galpón</label>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {Array.from({ length: maxGalpones }, (_, i) => i + 1).map((n) => {
                        const lt = lotes.find((l) => l.granja === form.granja && l.galpon === n);
                        const disp = lt ? lt.cantidadActual - (lt.cantidadComprometida || 0) : null;
                        return (
                          <button key={n} type="button"
                            className={`btn ${form.galpon == n ? "btn-success" : "btn-outline-secondary"}`}
                            style={{ minWidth: "3.5rem" }}
                            onClick={() => setForm((f) => ({ ...f, galpon: n }))}>
                            <div>{n}</div>
                            {disp !== null && (
                              <div style={{ fontSize: "0.6rem", lineHeight: 1.2 }}>
                                {disp.toLocaleString("es-AR")}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {loteGalpon && (
                      <div className="rounded px-3 py-2 small d-flex flex-wrap gap-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <span className="text-muted">Lote #{loteGalpon.numeroLote}</span>
                        <span><strong>{loteGalpon.cantidadActual.toLocaleString("es-AR")}</strong> totales</span>
                        {(loteGalpon.cantidadComprometida || 0) > 0 && (
                          <span className="text-warning fw-semibold">{loteGalpon.cantidadComprometida.toLocaleString("es-AR")} comprometidos</span>
                        )}
                        <span className="text-success fw-semibold">
                          {(loteGalpon.cantidadActual - (loteGalpon.cantidadComprometida || 0)).toLocaleString("es-AR")} disponibles
                        </span>
                      </div>
                    )}
                    {form.galpon && !loteGalpon && (
                      <div className="rounded px-3 py-2 small text-muted" style={{ background: "#fef9c3", border: "1px solid #fde68a" }}>
                        <i className="bi bi-exclamation-triangle me-1 text-warning"></i>
                        No hay lote activo en este galpón.
                      </div>
                    )}
                  </div>
                )}

                {/* ── Composición ── */}
                <div className="mb-3">
                  <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                    Composición
                  </div>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle mb-2">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: "30%" }}>Pollos</th>
                          <th>Peso mín (kg)</th>
                          <th>Peso máx (kg)</th>
                          <th style={{ width: "2.5rem" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.map((linea, idx) => (
                          <tr key={idx}>
                            <td>
                              <input type="number" className="form-control form-control-sm" min="1" placeholder="ej: 300"
                                value={linea.cantidad}
                                onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)} />
                            </td>
                            <td>
                              <input type="number" className="form-control form-control-sm" min="0.1" step="0.1" placeholder="ej: 3.5"
                                value={linea.pesoMin}
                                onChange={(e) => actualizarLinea(idx, "pesoMin", e.target.value)} />
                            </td>
                            <td>
                              <input type="number" className="form-control form-control-sm" min="0.1" step="0.1" placeholder="igual al mín"
                                value={linea.pesoMax}
                                onChange={(e) => actualizarLinea(idx, "pesoMax", e.target.value)} />
                            </td>
                            <td className="text-center">
                              {detalle.length > 1 && (
                                <button type="button" className="btn btn-outline-danger btn-sm p-0 px-1" onClick={() => eliminarLinea(idx)}>
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <button type="button" className="btn btn-outline-success btn-sm" onClick={agregarLinea}>
                      <i className="bi bi-plus-circle me-1"></i>Agregar línea
                    </button>
                  </div>
                </div>

                {/* ── Observaciones ── */}
                <div className="mb-1">
                  <label className="form-label">Observaciones <span className="text-muted fw-normal">(opcional)</span></label>
                  <textarea className="form-control" rows={2} value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    placeholder="Cualquier dato adicional..." />
                </div>

              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-nueva-orden" className="btn btn-success" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Confirmar orden de carga
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

const generarPDF = (o) => {
  const doc = new jsPDF();
  const clienteNombre = o.cliente?.razonSocial || o.cliente?.nombre || "";
  const granjaStr = o.granja === "cañete" ? "Cañete" : "Los Pinos";
  const galponStr = o.galpon ? `${granjaStr} — Galpón ${o.galpon}` : granjaStr;
  const fecha     = new Date(o.fechaEmision).toLocaleDateString("es-AR");
  const turnoStr  = o.turno === "mañana" ? "Mañana" : o.turno === "tarde" ? "Tarde" : "";
  const W = 210;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("Trigotuc Avícola", 14, 20);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text("Orden de Retiro", 14, 27);

  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 122, 26);
  doc.text(o.numero, W - 14, 20, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text(`Fecha: ${fecha}`, W - 14, 27, { align: "right" });

  doc.setDrawColor(50); doc.setLineWidth(0.5);
  doc.line(14, 31, W - 14, 31);

  let y = 35;

  // ── Código de retiro ────────────────────────────────────────────────────────
  if (o.codigoRetiro) {
    doc.setFillColor(26, 122, 26);
    doc.roundedRect(14, y, W - 28, 16, 3, 3, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(200, 255, 200);
    doc.text("CÓDIGO DE RETIRO — presentar al momento de retirar", W / 2, y + 6, { align: "center" });
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(o.codigoRetiro, W / 2, y + 13, { align: "center" });
    y += 22;
  }

  // ── Cliente ─────────────────────────────────────────────────────────────────
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("CLIENTE", 14, y + 4);
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text(clienteNombre, 14, y + 11);
  y += 18;

  // ── Granja / Galpón / Turno ─────────────────────────────────────────────────
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("GRANJA / GALPÓN", 14, y + 4);
  if (turnoStr) doc.text("TURNO", W / 2, y + 4);
  doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
  doc.text(galponStr, 14, y + 11);
  if (turnoStr) {
    doc.setFont("helvetica", "bold");
    doc.text(turnoStr, W / 2, y + 11);
    doc.setFont("helvetica", "normal");
  }
  y += 18;

  // ── Composición estimada ─────────────────────────────────────────────────────
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("COMPOSICIÓN ESTIMADA", 14, y + 4);
  y += 7;
  doc.setDrawColor(200); doc.setLineWidth(0.3);
  doc.line(14, y, W - 14, y);
  y += 2;

  // Header columnas
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y, W - 28, 8, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(80);
  doc.text("Cant. (pollos)", 16, y + 5.5);
  doc.text("Peso mín / pollo (kg)", 95, y + 5.5, { align: "right" });
  doc.text("Peso máx / pollo (kg)", 145, y + 5.5, { align: "right" });
  doc.text("Kg estimados", W - 16, y + 5.5, { align: "right" });
  y += 8;

  const lineas = o.detalle?.filter((l) => Number(l.cantidad) > 0) || [];
  let totalPollos = 0, totalKgMin = 0, totalKgMax = 0;

  lineas.forEach((l, i) => {
    const cant = Number(l.cantidad) || 0;
    const pMin = Number(l.pesoMin)  || 0;
    const pMax = Number(l.pesoMax)  || pMin;
    const kgMin = cant * pMin;
    const kgMax = cant * pMax;
    totalPollos += cant;
    totalKgMin  += kgMin;
    totalKgMax  += kgMax;

    if (i % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(14, y, W - 28, 7, "F"); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0);
    doc.text(cant.toLocaleString("es-AR"), 16, y + 5);
    doc.text(pMin.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }), 95, y + 5, { align: "right" });
    doc.text(pMax !== pMin
      ? pMax.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })
      : "—", 145, y + 5, { align: "right" });
    const kgStr = kgMax > kgMin
      ? `${Math.round(kgMin).toLocaleString("es-AR")}–${Math.round(kgMax).toLocaleString("es-AR")} kg`
      : `${Math.round(kgMin).toLocaleString("es-AR")} kg`;
    doc.text(kgStr, W - 16, y + 5, { align: "right" });
    y += 7;
  });

  // Fila de totales
  doc.setDrawColor(180); doc.line(14, y, W - 14, y); y += 1;
  doc.setFillColor(235, 247, 235);
  doc.rect(14, y, W - 28, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(26, 122, 26);
  doc.text(`TOTAL: ${totalPollos.toLocaleString("es-AR")} pollos`, 16, y + 5.5);
  const kgTotalStr = totalKgMax > totalKgMin
    ? `${Math.round(totalKgMin).toLocaleString("es-AR")}–${Math.round(totalKgMax).toLocaleString("es-AR")} kg est.`
    : `${Math.round(totalKgMin).toLocaleString("es-AR")} kg est.`;
  doc.text(kgTotalStr, W - 16, y + 5.5, { align: "right" });
  y += 13;

  // ── Nota ────────────────────────────────────────────────────────────────────
  doc.setFillColor(255, 251, 234);
  doc.setDrawColor(240, 230, 140); doc.setLineWidth(0.3);
  doc.roundedRect(14, y, W - 28, 10, 2, 2, "FD");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(133, 100, 4);
  doc.text("Los valores de cantidad y peso son estimados. Se confirmarán al momento de la entrega.", 17, y + 6);
  y += 15;

  // ── Observaciones ───────────────────────────────────────────────────────────
  if (o.observaciones) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("OBSERVACIONES", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(0);
    const obsLines = doc.splitTextToSize(o.observaciones, W - 28);
    doc.text(obsLines, 14, y);
    y += obsLines.length * 5 + 5;
  }

  // ── Firmas ──────────────────────────────────────────────────────────────────
  const yFirma = Math.max(y + 20, 230);
  doc.setDrawColor(80); doc.setLineWidth(0.4);
  doc.line(14, yFirma, 90, yFirma);
  doc.line(120, yFirma, W - 14, yFirma);
  doc.setFontSize(8); doc.setTextColor(100);
  doc.text("Firma empresa", 52, yFirma + 5, { align: "center" });
  doc.text("Conformidad cliente", 155, yFirma + 5, { align: "center" });

  // ── Footer ──────────────────────────────────────────────────────────────────
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`Trigotuc Avícola — ${o.numero} — Emitida: ${fecha}`, W / 2, 285, { align: "center" });

  doc.save(`OrdenCarga_${o.numero}.pdf`);
};

const EditarOrdenModal = ({ orden, lotes, onClose, onGuardado }) => {
  const [saving, setSaving]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busqueda, setBusqueda] = useState(orden.cliente?.razonSocial || orden.cliente?.nombre || "");
  const [resultados, setResultados]         = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(orden.cliente);
  const [form, setForm] = useState({
    cliente:      orden.cliente?._id || "",
    granja:       orden.granja || "",
    galpon:       orden.galpon || "",
    lote:         orden.lote?._id || "",
    fechaEmision: orden.fechaEmision?.split("T")[0] || "",
    turno:        orden.turno || "",
    observaciones: orden.observaciones || "",
  });
  const [detalle, setDetalle] = useState(
    orden.detalle?.length > 0
      ? orden.detalle.map((l) => ({ cantidad: String(l.cantidad), pesoMin: String(l.pesoMin), pesoMax: l.pesoMax ? String(l.pesoMax) : "" }))
      : [{ cantidad: "", pesoMin: "", pesoMax: "" }]
  );

  const maxGalpones    = form.granja ? (GALPONES_MAX[form.granja] || 8) : 0;
  const lotesFiltrados = form.granja ? lotes.filter((l) => l.granja === form.granja) : lotes;
  const totales        = calcTotales(detalle);
  const pesoRangeStr   = totales.pesoMax > totales.pesoMin + 0.5
    ? `${Math.round(totales.pesoMin).toLocaleString("es-AR")} – ${Math.round(totales.pesoMax).toLocaleString("es-AR")} kg`
    : `${Math.round(totales.pesoMin).toLocaleString("es-AR")} kg`;

  useEffect(() => {
    if (busqueda.length < 2 || clienteSeleccionado) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(busqueda);
        setResultados(data.clientes || data || []);
      } catch { setResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, clienteSeleccionado]);

  const seleccionarCliente = (c) => {
    setClienteSeleccionado(c);
    setBusqueda(c.razonSocial || c.nombre || "");
    setResultados([]);
    setForm((f) => ({ ...f, cliente: c._id }));
  };

  const actualizarLinea = (idx, campo, valor) =>
    setDetalle((prev) => prev.map((l, i) => i === idx ? { ...l, [campo]: valor } : l));
  const agregarLinea  = () => setDetalle((prev) => [...prev, { cantidad: "", pesoMin: "", pesoMax: "" }]);
  const eliminarLinea = (idx) => setDetalle((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!form.cliente) { Swal.fire("Faltan datos", "Seleccioná un cliente de la lista.", "warning"); return; }
    if (!form.granja)  { Swal.fire("Faltan datos", "Seleccioná la granja.", "warning"); return; }
    if (!form.turno)   { Swal.fire("Faltan datos", "Indicá si la carga es por la mañana o por la tarde.", "warning"); return; }
    const lineasValidas = detalle.filter((l) => Number(l.cantidad) > 0 && Number(l.pesoMin) > 0);
    if (lineasValidas.length === 0) {
      Swal.fire("Faltan datos", "Agregá al menos una línea con cantidad y peso.", "warning");
      return;
    }
    const { cant, pesoMin, pesoMax } = calcTotales(lineasValidas);
    const pesoEstimadoKg  = +pesoMin.toFixed(1);
    const pesoEstimadoMax = +pesoMax.toFixed(1);

    setSaving(true);
    try {
      await actualizarOrdenCarga(orden._id, {
        ...form,
        galpon:           form.galpon ? Number(form.galpon) : undefined,
        lote:             form.lote || undefined,
        cantidadEstimada: cant,
        pesoEstimadoKg,
        pesoEstimadoMax:  Math.abs(pesoEstimadoMax - pesoEstimadoKg) > 0.5 ? pesoEstimadoMax : undefined,
        detalle:          lineasValidas.map((l) => ({
          cantidad: Number(l.cantidad),
          pesoMin:  Number(l.pesoMin),
          pesoMax:  l.pesoMax ? Number(l.pesoMax) : undefined,
        })),
      });
      onGuardado();
      Swal.fire({ icon: "success", title: "Orden actualizada", timer: 1400, showConfirmButton: false });
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
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-pencil me-2"></i>Editar Orden {orden.numero}</h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-editar-orden" onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Cliente</label>
                    <div className="position-relative">
                      <input type="text"
                        className={`form-control ${clienteSeleccionado ? "is-valid" : submitted && !clienteSeleccionado ? "is-invalid" : ""}`}
                        placeholder="Escribí el nombre del cliente..." value={busqueda} autoComplete="off"
                        onChange={(e) => { setBusqueda(e.target.value); setClienteSeleccionado(null); setForm((f) => ({ ...f, cliente: "" })); }} />
                      {resultados.length > 0 && (
                        <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{ zIndex: 1055, maxHeight: "200px", overflowY: "auto" }}>
                          {resultados.map((c) => (
                            <div key={c._id} className="px-3 py-2 border-bottom" style={{ cursor: "pointer" }} onMouseDown={() => seleccionarCliente(c)}>
                              {c.razonSocial || c.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                      {submitted && !clienteSeleccionado && (
                        <div className="invalid-feedback d-block">Seleccioná un cliente de la lista.</div>
                      )}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha pactada</label>
                    <input type="date" className="form-control" value={form.fechaEmision}
                      onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Turno</label>
                    <div className="d-flex gap-2">
                      {[
                        { value: "mañana", label: "Mañana", icon: "bi-sunrise" },
                        { value: "tarde",  label: "Tarde",  icon: "bi-sunset"  },
                      ].map((t) => (
                        <button key={t.value} type="button"
                          className={`btn flex-grow-1 ${form.turno === t.value ? "btn-success" : "btn-outline-secondary"}`}
                          onClick={() => setForm((f) => ({ ...f, turno: t.value }))}>
                          <i className={`bi ${t.icon} me-1`}></i>{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Granja</label>
                  <div className="d-flex gap-2">
                    {GRANJAS.map((g) => (
                      <button key={g.value} type="button"
                        className={`btn flex-grow-1 py-2 ${form.granja === g.value ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={() => setForm((f) => ({ ...f, granja: g.value, galpon: "", lote: "" }))}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.granja && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Galpón</label>
                    <div className="d-flex flex-wrap gap-2">
                      {Array.from({ length: maxGalpones }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button"
                          className={`btn ${form.galpon == n ? "btn-success" : "btn-outline-secondary"}`}
                          style={{ minWidth: "3rem" }}
                          onClick={() => setForm((f) => ({ ...f, galpon: n }))}>
                          {n}
                        </button>
                      ))}
                    </div>
                    {lotesFiltrados.length > 0 && (
                      <div className="mt-2">
                        <select className="form-select form-select-sm" value={form.lote}
                          onChange={(e) => {
                            const lote = lotes.find((l) => l._id === e.target.value);
                            setForm((f) => ({ ...f, lote: e.target.value, galpon: lote ? lote.galpon : f.galpon }));
                          }}>
                          <option value="">Sin lote específico</option>
                          {lotesFiltrados.map((l) => (
                            <option key={l._id} value={l._id}>Lote #{l.numeroLote} — Galpón {l.galpon}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-semibold">Detalle de carga</label>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle mb-2">
                      <thead className="table-light">
                        <tr>
                          <th>Cantidad (pollos)</th>
                          <th>Peso mín (kg)</th>
                          <th>Peso máx (kg)</th>
                          <th style={{ width: "2.5rem" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.map((linea, idx) => (
                          <tr key={idx}>
                            <td><input type="number" className="form-control form-control-sm" min="1" value={linea.cantidad} onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)} /></td>
                            <td><input type="number" className="form-control form-control-sm" min="0.1" step="0.1" value={linea.pesoMin} onChange={(e) => actualizarLinea(idx, "pesoMin", e.target.value)} /></td>
                            <td><input type="number" className="form-control form-control-sm" min="0.1" step="0.1" placeholder="igual al mín" value={linea.pesoMax} onChange={(e) => actualizarLinea(idx, "pesoMax", e.target.value)} /></td>
                            <td className="text-center">
                              {detalle.length > 1 && (
                                <button type="button" className="btn btn-outline-danger btn-sm p-0 px-1" onClick={() => eliminarLinea(idx)}>
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" className="btn btn-outline-success btn-sm" onClick={agregarLinea}>
                    <i className="bi bi-plus-circle me-1"></i>Agregar línea
                  </button>
                  {totales.cant > 0 && (
                    <div className="mt-2 p-2 rounded text-center" style={{ background: "#f0fdf4" }}>
                      <span className="fw-bold text-success">{totales.cant.toLocaleString("es-AR")} pollos</span>
                      <span className="text-muted ms-2">· {pesoRangeStr} estimados</span>
                    </div>
                  )}
                </div>

                <div className="mb-1">
                  <label className="form-label">Observaciones (opcional)</label>
                  <textarea className="form-control" rows={2} value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-editar-orden" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

const OrdenCargaListPage = () => {
  const navigate      = useNavigate();
  const rolUsuario    = localStorage.getItem("rolUsuario");
  const puedeCrear   = rolUsuario === "superadmin" || rolUsuario === "administracion" || rolUsuario === "frigorifico";
  const esAdmin      = rolUsuario === "superadmin" || rolUsuario === "administracion";
  const esSuperAdmin = rolUsuario === "superadmin";

  const [ordenes, setOrdenes]   = useState([]);
  const [lotes, setLotes]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editOrden, setEditOrden]   = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerOrdenesCarga({ tipo: "venta_gordos", ...(filtroEstado ? { estado: filtroEstado } : {}) });
      setOrdenes(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    obtenerLotesGranja({ estado: "en_crianza" })
      .then(setLotes)
      .catch(console.error);
  }, []);

  const handleEliminar = async (orden) => {
    const ok = await Swal.fire({
      title: `¿Eliminar orden ${orden.numero}?`,
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#dc3545", confirmButtonText: "Eliminar", cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await eliminarOrdenCarga(orden._id);
      cargar();
      Swal.fire({ icon: "success", title: "Eliminada", timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-file-earmark-text me-2 text-success"></i>
            Órdenes de Carga
          </h1>
          {puedeCrear && (
            <button className="btn btn-success" onClick={() => setShowModal(true)}>
              <i className="bi bi-plus-circle me-1"></i>Nueva orden
            </button>
          )}
        </div>

        {/* Filtro estado */}
        <div className="d-flex gap-2 mb-3">
          {["", "pendiente", "entregada"].map((e) => (
            <button
              key={e}
              className={`btn btn-sm ${filtroEstado === e ? "btn-dark" : "btn-outline-secondary"}`}
              onClick={() => setFiltroEstado(e)}
            >
              {e === "" ? "Todas" : e === "pendiente" ? "Pendientes" : "Entregadas"}
            </button>
          ))}
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
            ) : ordenes.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">No hay órdenes registradas.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {ordenes.map((o) => (
                    <div key={o._id} className="card border mb-2" style={{ cursor: "pointer" }} onClick={() => navigate(`/granja/ordenes-carga/${o._id}`)}>
                      <div className="card-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <div>
                            <span className="badge bg-dark me-1">{o.numero}</span>
                            {estadoBadge(o.estado)}
                            {esAdmin && tieneDiferencia(o) && (
                              <span className="badge bg-danger ms-1" title={diferenciaLabel(o)}>
                                <i className="bi bi-exclamation-triangle-fill"></i>
                              </span>
                            )}
                          </div>
                          <div className="d-flex gap-1">
                            <button className="btn btn-outline-secondary btn-sm" onClick={(ev) => { ev.stopPropagation(); generarPDF(o); }} title="Bajar orden">
                              <i className="bi bi-file-earmark-arrow-down"></i>
                            </button>
                            {o.estado !== "entregada" && (puedeCrear || esSuperAdmin) && (
                              <button className="btn btn-outline-primary btn-sm" onClick={(ev) => { ev.stopPropagation(); setEditOrden(o); }} title="Editar">
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            {o.estado !== "entregada" && esSuperAdmin && (
                              <button className="btn btn-outline-danger btn-sm" onClick={(ev) => { ev.stopPropagation(); handleEliminar(o); }} title="Eliminar">
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="fw-semibold">{o.cliente?.razonSocial || o.cliente?.nombre}</div>
                        <div className="small text-muted">
                          {o.granja === "cañete" ? "Cañete" : "Los Pinos"} · {formatearFechaLocal(o.fechaEmision)}
                        </div>
                        <div className="small text-muted">
                          {o.cantidadEstimada?.toLocaleString("es-AR")} pollos · {o.pesoEstimadoKg} kg est.
                        </div>
                        {o.estado === "entregada" && o.pesoRealKg != null && (
                          <div className="small fw-semibold">
                            <i className="bi bi-check2 me-1 text-success"></i>
                            {o.cantidadReal != null && o.cantidadReal !== o.cantidadEstimada
                              ? `${o.cantidadReal.toLocaleString("es-AR")} pollos · `
                              : ""}
                            {o.pesoRealKg} kg cargados
                            {tieneDiferencia(o) && (
                              <span className="badge bg-danger ms-1" style={{ fontSize: "0.65rem" }}>Dif.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>N° Orden</th>
                        <th>Cliente</th>
                        <th>Granja</th>
                        <th>Fecha</th>
                        <th className="text-end">Cant. est.</th>
                        <th className="text-end">Peso est.</th>
                        <th className="text-end">Cargado</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordenes.map((o) => (
                        <tr key={o._id} style={{ cursor: "pointer" }} onClick={() => navigate(`/granja/ordenes-carga/${o._id}`)}>
                          <td><span className="badge bg-dark">{o.numero}</span></td>
                          <td className="fw-semibold">{o.cliente?.razonSocial || o.cliente?.nombre}</td>
                          <td className="text-muted small">{o.granja === "cañete" ? "Cañete" : "Los Pinos"}</td>
                          <td className="text-muted small">{formatearFechaLocal(o.fechaEmision)}</td>
                          <td className="text-end">{o.cantidadEstimada?.toLocaleString("es-AR")}</td>
                          <td className="text-end text-muted">{o.pesoEstimadoKg} kg</td>
                          <td className="text-end">
                            {o.estado === "entregada" && o.pesoRealKg != null ? (
                              <>
                                {o.cantidadReal != null && o.cantidadReal !== o.cantidadEstimada && (
                                  <div className="fw-bold small">
                                    {o.cantidadReal.toLocaleString("es-AR")} pollos
                                  </div>
                                )}
                                <div className="fw-bold">{o.pesoRealKg} kg</div>
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {estadoBadge(o.estado)}
                            {esAdmin && tieneDiferencia(o) && (
                              <span className="badge bg-danger ms-1" title={diferenciaLabel(o)}>
                                <i className="bi bi-exclamation-triangle-fill me-1"></i>Dif.
                              </span>
                            )}
                          </td>
                          <td onClick={(ev) => ev.stopPropagation()}>
                            <div className="d-flex gap-1">
                              <button className="btn btn-outline-secondary btn-sm" onClick={() => generarPDF(o)} title="Bajar orden">
                                <i className="bi bi-file-earmark-arrow-down"></i>
                              </button>
                              {o.estado !== "entregada" && (puedeCrear || esSuperAdmin) && (
                                <button className="btn btn-outline-primary btn-sm" onClick={() => setEditOrden(o)} title="Editar">
                                  <i className="bi bi-pencil"></i>
                                </button>
                              )}
                              {o.estado !== "entregada" && esSuperAdmin && (
                                <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(o)} title="Eliminar">
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
              </>
            )}
          </div>
        </div>

      </div>

      {showModal && (
        <NuevaOrdenModal
          onClose={() => setShowModal(false)}
          onCreada={() => { setShowModal(false); cargar(); }}
          lotes={lotes}
        />
      )}

      {editOrden && (
        <EditarOrdenModal
          orden={editOrden}
          lotes={lotes}
          onClose={() => setEditOrden(null)}
          onGuardado={() => { setEditOrden(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default OrdenCargaListPage;
