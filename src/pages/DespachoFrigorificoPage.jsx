import React, { useState, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import {
  obtenerDespachosFrigorifico,
  crearDespachoFrigorifico,
  actualizarDespachoFrigorifico,
  eliminarDespachoFrigorifico,
  obtenerStockDisponibleFrigorifico,
  buscarClientes,
  obtenerChoferes,
  obtenerCamiones,
} from "../services/api";
import { normalizarWhatsapp } from "../utils/whatsappUtils";
import Swal from "sweetalert2";

const TIPOS_TROZADO = [
  { tipo: "filet",   label: "Filet"      },
  { tipo: "pata",    label: "Pata/muslo" },
  { tipo: "alita",   label: "Alita"      },
  { tipo: "menudo",  label: "Menudo"     },
  { tipo: "carcaza", label: "Carcaza"    },
];

const fmt       = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n ?? 0);
const fmtFecha  = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";
const camaraLbl = (v) => v === "cañete" ? "Cañete" : v === "trigotuc" ? "Trigotuc" : v;
const tipoLbl   = (tipo) => TIPOS_TROZADO.find((x) => x.tipo === tipo)?.label || tipo;

// ── Badge de estado ───────────────────────────────────────────────────────────
const estadoBadge = (d) => {
  if (d.estado !== "completada") {
    return <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>Pendiente</span>;
  }
  if (d.modalidadEntrega === "delivery_chofer") {
    if (d.entregado)       return <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>Entregado</span>;
    if (d.confirmadaCarga) return <span className="badge bg-info text-dark"><i className="bi bi-truck me-1"></i>En camión</span>;
    return <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>Listo para cargar</span>;
  }
  return <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>Completada</span>;
};

// ── PDF de la orden (para descargar / compartir por WhatsApp) ────────────────
const construirPDFDespacho = (d) => {
  const doc = new jsPDF();
  const cliente = d.cliente?.razonSocial || d.cliente?.nombre || "—";
  const camara  = camaraLbl(d.camara);
  const fecha   = fmtFecha(d.fecha);
  const W = 210;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("Trigotuc Avícola", 14, 20);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text("Orden de Carga — Frigorífico", 14, 27);

  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 122, 26);
  doc.text(d.numeroOrden, W - 14, 20, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text(`Fecha: ${fecha}`, W - 14, 27, { align: "right" });

  doc.setDrawColor(50); doc.setLineWidth(0.5);
  doc.line(14, 31, W - 14, 31);

  let y = 35;

  // ── Código de retiro ────────────────────────────────────────────────────────
  if (d.codigoRetiro) {
    doc.setFillColor(29, 78, 216);
    doc.roundedRect(14, y, W - 28, 22, 3, 3, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(220, 230, 255);
    doc.text("CÓDIGO DE RETIRO — presentar en el frigorífico", W / 2, y + 7, { align: "center" });
    doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(d.codigoRetiro, W / 2, y + 17, { align: "center" });
    y += 28;
  }

  // ── Cliente ─────────────────────────────────────────────────────────────────
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("CLIENTE", 14, y + 4);
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text(cliente, 14, y + 11);
  y += 18;

  // ── Cámara / Turno ──────────────────────────────────────────────────────────
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("CÁMARA", 14, y + 4);
  if (d.turno) doc.text("TURNO", W / 2, y + 4);
  doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
  doc.text(camara, 14, y + 11);
  if (d.turno) {
    doc.setFont("helvetica", "bold");
    doc.text(d.turno, W / 2, y + 11);
    doc.setFont("helvetica", "normal");
  }
  y += 18;

  // ── Pollos faenados (por calibre) ──────────────────────────────────────────
  const calibres = (d.calibres || []).filter((c) => Number(c.cajones) > 0);
  if (calibres.length > 0) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("POLLOS FAENADOS (POR CALIBRE)", 14, y + 4);
    y += 7;
    doc.setDrawColor(200); doc.setLineWidth(0.3);
    doc.line(14, y, W - 14, y);
    y += 2;

    doc.setFillColor(245, 245, 245);
    doc.rect(14, y, W - 28, 8, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(80);
    doc.text("Calibre", 16, y + 5.5);
    doc.text("Cajones", W / 2, y + 5.5, { align: "right" });
    doc.text("Kg total", W - 16, y + 5.5, { align: "right" });
    y += 8;

    calibres.forEach((c, i) => {
      if (i % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(14, y, W - 28, 7, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(`Cal. ${c.calibre}`, 16, y + 5);
      doc.text(fmt(c.cajones), W / 2, y + 5, { align: "right" });
      doc.text(`${fmt(c.cajones * 20)} kg`, W - 16, y + 5, { align: "right" });
      y += 7;
    });
    y += 5;
  }

  // ── Trozados ────────────────────────────────────────────────────────────────
  const trozados = (d.trozados || []).filter((t) => Number(t.cajas) > 0);
  if (trozados.length > 0) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("TROZADOS", 14, y + 4);
    y += 7;
    doc.setDrawColor(200); doc.setLineWidth(0.3);
    doc.line(14, y, W - 14, y);
    y += 2;

    doc.setFillColor(245, 245, 245);
    doc.rect(14, y, W - 28, 8, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(80);
    doc.text("Tipo", 16, y + 5.5);
    doc.text("Cajas", W / 2, y + 5.5, { align: "right" });
    doc.text("Kg total", W - 16, y + 5.5, { align: "right" });
    y += 8;

    trozados.forEach((t, i) => {
      if (i % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(14, y, W - 28, 7, "F"); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0);
      doc.text(tipoLbl(t.tipo), 16, y + 5);
      doc.text(fmt(t.cajas), W / 2, y + 5, { align: "right" });
      doc.text(`${fmt(t.kgTotal)} kg`, W - 16, y + 5, { align: "right" });
      y += 7;
    });
    y += 5;
  }

  // ── Observaciones ───────────────────────────────────────────────────────────
  if (d.observaciones) {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("OBSERVACIONES", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(0);
    const obsLines = doc.splitTextToSize(d.observaciones, W - 28);
    doc.text(obsLines, 14, y);
    y += obsLines.length * 5 + 5;
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`Trigotuc Avícola — ${d.numeroOrden} — Emitida: ${fecha}`, W / 2, 285, { align: "center" });

  return doc;
};

const descargarPDFDespacho = (d) => {
  construirPDFDespacho(d).save(`OrdenCarga_${d.numeroOrden}.pdf`);
};

// Comparte el PDF de la orden por WhatsApp usando el selector nativo (Web Share API) en celulares.
// En escritorio descarga el PDF y abre WhatsApp Web directamente.
const compartirPDFDespachoWhatsApp = async (d) => {
  const doc = construirPDFDespacho(d);
  const filename = `OrdenCarga_${d.numeroOrden}.pdf`;
  const cliente = d.cliente?.razonSocial || d.cliente?.nombre || "";
  const mensaje = `Orden de Carga ${d.numeroOrden}${cliente ? ` - ${cliente}` : ""}${d.codigoRetiro ? ` - Código de retiro: ${d.codigoRetiro}` : ""}`;

  const esMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (esMobile && navigator.canShare) {
    const file = new File([doc.output("blob")], filename, { type: "application/pdf" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename, text: mensaje });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
  }

  doc.save(filename);
  const telefono = normalizarWhatsapp(d.cliente?.telefono);
  if (!telefono) {
    Swal.fire({
      icon: "info",
      title: "PDF descargado",
      text: "El cliente no tiene un teléfono registrado. Abrí WhatsApp y adjuntá el PDF descargado manualmente.",
      confirmButtonColor: "#0d6efd",
    });
    return;
  }
  window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, "_blank");
};

// ── Modal nueva orden ────────────────────────────────────────────────────────
const NuevaOrdenModal = ({ onClose, onCreada }) => {
  const [saving, setSaving]                 = useState(false);
  const [busqueda, setBusqueda]             = useState("");
  const [resultados, setResultados]         = useState([]);
  const [clienteSel, setClienteSel]         = useState(null);
  const [camara, setCamara]                 = useState("");
  const [turno, setTurno]                   = useState("");
  const [lineas, setLineas]                 = useState([]);
  const [trozadosLineas, setTrozadosLineas] = useState([]);
  const [modalidad, setModalidad]           = useState("retiro_cliente");
  const [choferes, setChoferes]             = useState([]);
  const [camiones, setCamiones]             = useState([]);
  const [choferSel, setChoferSel]           = useState("");
  const [stockCalibres, setStockCalibres]   = useState(null);
  const [trozadosDisp, setTrozadosDisp]     = useState([]);
  const [loadingStock, setLoadingStock]     = useState(false);
  const [form, setForm] = useState({
    fecha:         new Date().toISOString().split("T")[0],
    observaciones: "",
  });

  useEffect(() => {
    Promise.all([obtenerChoferes(), obtenerCamiones()])
      .then(([data, cams]) => {
        setChoferes(data.choferes || []);
        setCamiones(cams.camiones || cams || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (busqueda.length < 2 || clienteSel) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(busqueda);
        setResultados(data.clientes || data || []);
      } catch { setResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, clienteSel]);

  const seleccionarCliente = (c) => {
    setClienteSel(c);
    setBusqueda(c.razonSocial || c.nombre || "");
    setResultados([]);
  };

  const handleCamara = (val) => {
    if (val === camara) return;
    setCamara(val);
    setLineas([]);
    setTrozadosLineas([]);
  };

  // ── Stock disponible de la cámara seleccionada (físico - comprometido por otras órdenes) ──
  useEffect(() => {
    if (!camara) { setStockCalibres(null); setTrozadosDisp([]); return; }
    setLoadingStock(true);
    obtenerStockDisponibleFrigorifico(camara)
      .then((data) => {
        setStockCalibres(data.stockCalibres || []);
        setTrozadosDisp((data.trozadosDisp || []).filter((t) => t.cajas > 0));
      })
      .catch(() => { setStockCalibres([]); setTrozadosDisp([]); })
      .finally(() => setLoadingStock(false));
  }, [camara]);

  const totalCajCam = (stockCalibres || []).reduce((a, c) => a + c.cajones, 0);
  const lineasCalc  = lineas.map((l) => ({ ...l, cajones: calcularCajones(l.pollos, l.calibre) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteSel) { Swal.fire("Faltan datos", "Seleccioná un cliente.", "warning"); return; }
    if (!camara)     { Swal.fire("Faltan datos", "Seleccioná la cámara de origen.", "warning"); return; }
    if (!turno)      { Swal.fire("Faltan datos", "Indicá si la carga es por la mañana o por la tarde.", "warning"); return; }
    if (modalidad === "delivery_chofer" && !choferSel) { Swal.fire("Faltan datos", "Seleccioná el chofer para la entrega.", "warning"); return; }

    const lineasValidas   = lineasCalc.filter((l) => l.cajones > 0);
    const trozadosValidos = trozadosLineas.filter((t) => Number(t.cajas) > 0 && Number(t.kgCaja) > 0);

    if (lineasValidas.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Faltan datos", "Seleccioná al menos un calibre o un trozado a cargar.", "warning");
      return;
    }

    for (const t of trozadosValidos) {
      const disp = trozadosDisp.find((d) => d.tipo === t.tipo && d.clase === t.clase)?.cajas || 0;
      if (Number(t.cajas) > disp) {
        Swal.fire("Error", `Stock insuficiente de ${tipoLbl(t.tipo)} clase ${t.clase || "A"}. Disponible: ${disp} cajas.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      const camionDelChofer = camiones.find((c) => c.choferes?.some((ch) => String(ch?._id || ch) === String(choferSel)));

      const despacho = await crearDespachoFrigorifico({
        fecha:            form.fecha,
        camara,
        turno,
        cliente:          clienteSel._id,
        calibres:         lineasValidas.map(({ calibre, cajones }) => ({ calibre: Number(calibre), cajones })),
        trozados:         trozadosValidos.map((t) => ({ tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas), clase: t.clase })),
        observaciones:    form.observaciones || undefined,
        modalidadEntrega: modalidad,
        chofer:           modalidad === "delivery_chofer" ? choferSel : undefined,
        camion:           modalidad === "delivery_chofer" ? (camionDelChofer?._id || undefined) : undefined,
      });
      onCreada(despacho);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear la orden.", "error");
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
              <h5 className="modal-title">
                <i className="bi bi-clipboard2-plus me-2"></i>Nueva Orden de Carga
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-despacho" onSubmit={handleSubmit}>

                {/* Cliente + Fecha */}
                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">
                      Cliente <span className="text-danger">*</span>
                    </label>
                    <div className="position-relative">
                      <input
                        type="text"
                        className={`form-control ${clienteSel ? "is-valid" : ""}`}
                        placeholder="Escribí el nombre del cliente..."
                        value={busqueda}
                        onChange={(e) => { setBusqueda(e.target.value); setClienteSel(null); }}
                        autoComplete="off"
                        autoFocus
                      />
                      {resultados.length > 0 && (
                        <div className="position-absolute w-100 bg-white border rounded shadow-sm"
                          style={{ zIndex: 1055, maxHeight: "200px", overflowY: "auto" }}>
                          {resultados.map((c) => (
                            <div key={c._id} className="px-3 py-2 border-bottom"
                              style={{ cursor: "pointer" }}
                              onMouseDown={() => seleccionarCliente(c)}>
                              {c.razonSocial || c.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">
                      Fecha <span className="text-danger">*</span>
                    </label>
                    <input type="date" className="form-control" value={form.fecha}
                      onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">
                      Turno <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex gap-2">
                      {[
                        { value: "mañana", label: "Mañana", icon: "bi-sunrise" },
                        { value: "tarde",  label: "Tarde",  icon: "bi-sunset"  },
                      ].map((t) => (
                        <button key={t.value} type="button"
                          className={`btn flex-grow-1 py-2 ${turno === t.value ? "btn-success" : "btn-outline-secondary"}`}
                          onClick={() => setTurno(t.value)}>
                          <i className={`bi ${t.icon} me-1`}></i>{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modalidad de entrega */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Modalidad de entrega <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-2">
                    {[
                      { value: "retiro_cliente", label: "Retiro cliente",  icon: "bi-person-walking" },
                      { value: "delivery_chofer", label: "Camión Trigotuc", icon: "bi-truck"          },
                    ].map((m) => (
                      <button key={m.value} type="button"
                        className={`btn flex-grow-1 py-2 ${modalidad === m.value ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => { setModalidad(m.value); setChoferSel(""); }}>
                        <i className={`bi ${m.icon} me-1`}></i>{m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector de chofer (solo delivery) */}
                {modalidad === "delivery_chofer" && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Chofer <span className="text-danger">*</span>
                    </label>
                    {choferes.length === 0 ? (
                      <div className="alert alert-warning py-2 small mb-0">
                        No hay choferes registrados. Creá un usuario con rol <strong>chofer</strong>.
                      </div>
                    ) : (
                      <select
                        className={`form-select ${modalidad === "delivery_chofer" && !choferSel ? "is-invalid" : ""}`}
                        value={choferSel}
                        onChange={(e) => setChoferSel(e.target.value)}
                      >
                        <option value="">Seleccioná un chofer...</option>
                        {choferes.map((c) => {
                          const cam = camiones.find((k) => k.choferes?.some((ch) => String(ch?._id || ch) === String(c._id)) && k.activo);
                          return (
                            <option key={c._id} value={c._id}>
                              {c.nombreUsuario}{cam ? ` — ${cam.marca} ${cam.patente}` : " (sin camión asignado)"}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                )}

                {/* Cámara */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Cámara de origen <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-2">
                    {[
                      { value: "cañete",   label: "Cañete"   },
                      { value: "trigotuc", label: "Trigotuc" },
                    ].map((c) => (
                      <button key={c.value} type="button"
                        className={`btn flex-grow-1 py-2 ${camara === c.value ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={() => handleCamara(c.value)}>
                        <i className="bi bi-snow me-1"></i>{c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel de stock — tarjetitas */}
                {camara && (
                  <div className="mb-3">
                    {loadingStock ? (
                      <div className="text-center py-2 text-muted small">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Calculando stock disponible...
                      </div>
                    ) : totalCajCam === 0 && trozadosDisp.length === 0 ? (
                      <div className="rounded px-3 py-2 small text-muted"
                        style={{ background: "#fef9c3", border: "1px solid #fde68a" }}>
                        <i className="bi bi-exclamation-triangle me-1 text-warning"></i>
                        La cámara {camaraLbl(camara)} no tiene stock disponible.
                      </div>
                    ) : (
                      <div className="rounded p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <div className="small fw-semibold text-success mb-2">
                          <i className="bi bi-snow me-1"></i>Stock disponible en {camaraLbl(camara)}
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {(stockCalibres || []).filter((c) => c.cajones > 0).map((c) => (
                            <div key={c.calibre} className="text-center rounded border"
                              style={{ background: "#eff6ff", minWidth: "80px", padding: "6px 10px" }}>
                              <div className="fw-bold text-primary" style={{ fontSize: "1rem" }}>Cal. {c.calibre}</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>{fmt(c.cajones)} cajones</div>
                              <div className="text-muted" style={{ fontSize: "0.68rem" }}>{fmt(c.cajones * 20)} kg</div>
                            </div>
                          ))}
                          {trozadosDisp.map((t) => (
                            <div key={`${t.tipo}-${t.clase || "A"}`} className="text-center rounded border"
                              style={{ background: "#fffbeb", minWidth: "80px", padding: "6px 10px" }}>
                              <div className="fw-bold text-warning" style={{ fontSize: "0.85rem" }}>{tipoLbl(t.tipo)} {t.clase || "A"}</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>{fmt(t.cajas)} cajas</div>
                              <div className="text-muted" style={{ fontSize: "0.68rem" }}>{fmt(t.kgTotal)} kg</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detalle a cargar */}
                {camara && !loadingStock && (totalCajCam > 0 || trozadosDisp.length > 0) && (
                  <>
                    <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                      Detalle a cargar
                    </div>

                    {totalCajCam > 0 && (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Cajones por calibre</label>
                        <CalibreTable
                          lineas={lineas}
                          onChange={setLineas}
                          inputCajones
                          showPollos={false}
                          stockCalibres={stockCalibres}
                        />
                      </div>
                    )}

                    {trozadosDisp.length > 0 && (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Trozados</label>
                        <table className="table table-sm table-bordered align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Tipo</th>
                              <th>Clase</th>
                              <th className="text-end">Disponible</th>
                              <th style={{ width: "9rem" }}>Cajas a cargar</th>
                              <th>kg/caja</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trozadosDisp.map((t) => {
                              const linea = trozadosLineas.find((l) => l.tipo === t.tipo && l.clase === t.clase) || { cajas: "", kgCaja: t.kgCaja, clase: t.clase };
                              return (
                                <tr key={`${t.tipo}-${t.clase || "A"}`}>
                                  <td className="fw-semibold">{tipoLbl(t.tipo)}</td>
                                  <td><span className="badge bg-secondary">Clase {t.clase || "A"}</span></td>
                                  <td className="text-end text-muted">{fmt(t.cajas)} cajas</td>
                                  <td>
                                    <input type="number" min="0" max={t.cajas} step="1"
                                      className="form-control form-control-sm text-center"
                                      placeholder="0"
                                      value={linea.cajas}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTrozadosLineas((prev) => {
                                          const idx = prev.findIndex((l) => l.tipo === t.tipo && l.clase === t.clase);
                                          const nueva = { tipo: t.tipo, clase: t.clase, cajas: val, kgCaja: t.kgCaja };
                                          return idx === -1 ? [...prev, nueva] : prev.map((l, i) => i === idx ? nueva : l);
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="text-muted small">{t.kgCaja} kg</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Observaciones */}
                <div className="mb-1">
                  <label className="form-label">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea className="form-control" rows={2}
                    value={form.observaciones}
                    onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                    placeholder="Cualquier dato adicional..." />
                </div>

              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-despacho" className="btn btn-success" disabled={saving || loadingStock}>
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

// ── Modal editar orden ───────────────────────────────────────────────────────
const EditarDespachoModal = ({ despacho, onClose, onGuardado }) => {
  const [saving, setSaving]                 = useState(false);
  const [busqueda, setBusqueda]             = useState(despacho.cliente?.razonSocial || despacho.cliente?.nombre || "");
  const [resultados, setResultados]         = useState([]);
  const [clienteSel, setClienteSel]         = useState(despacho.cliente || null);
  const [camara, setCamara]                 = useState(despacho.camara || "");
  const [turno, setTurno]                   = useState(despacho.turno || "");
  const [lineas, setLineas]                 = useState(
    (despacho.calibres || []).map((c) => ({
      calibre: Number(c.calibre),
      cajones: Number(c.cajones),
      pollos:  Number(c.cajones) * Number(c.calibre),
    }))
  );
  const [trozadosLineas, setTrozadosLineas] = useState(
    (despacho.trozados || []).map((t) => ({ tipo: t.tipo, cajas: String(t.cajas), kgCaja: t.kgCaja, clase: t.clase }))
  );
  const [modalidad, setModalidad]           = useState(despacho.modalidadEntrega || "retiro_cliente");
  const [choferes, setChoferes]             = useState([]);
  const [camiones, setCamiones]             = useState([]);
  const [choferSel, setChoferSel]           = useState(despacho.chofer?._id || "");
  const [stockCalibres, setStockCalibres]   = useState(null);
  const [trozadosDisp, setTrozadosDisp]     = useState([]);
  const [loadingStock, setLoadingStock]     = useState(false);
  const [form, setForm] = useState({
    fecha:         despacho.fecha ? new Date(despacho.fecha).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    observaciones: despacho.observaciones || "",
  });

  useEffect(() => {
    Promise.all([obtenerChoferes(), obtenerCamiones()])
      .then(([data, cams]) => {
        setChoferes(data.choferes || []);
        setCamiones(cams.camiones || cams || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (busqueda.length < 2 || clienteSel) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(busqueda);
        setResultados(data.clientes || data || []);
      } catch { setResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, clienteSel]);

  const seleccionarCliente = (c) => {
    setClienteSel(c);
    setBusqueda(c.razonSocial || c.nombre || "");
    setResultados([]);
  };

  const handleCamara = (val) => {
    if (val === camara) return;
    setCamara(val);
    setLineas([]);
    setTrozadosLineas([]);
  };

  // ── Stock disponible de la cámara seleccionada (físico - comprometido por otras órdenes) ──
  // Se excluye esta misma orden del cálculo de "comprometido" para poder reasignar su propio stock.
  useEffect(() => {
    if (!camara) { setStockCalibres(null); setTrozadosDisp([]); return; }
    setLoadingStock(true);
    obtenerStockDisponibleFrigorifico(camara, despacho._id)
      .then((data) => {
        setStockCalibres(data.stockCalibres || []);
        setTrozadosDisp((data.trozadosDisp || []).filter((t) => t.cajas > 0));
      })
      .catch(() => { setStockCalibres([]); setTrozadosDisp([]); })
      .finally(() => setLoadingStock(false));
  }, [camara, despacho._id]);

  const totalCajCam = (stockCalibres || []).reduce((a, c) => a + c.cajones, 0);
  const lineasCalc  = lineas.map((l) => ({ ...l, cajones: calcularCajones(l.pollos, l.calibre) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteSel) { Swal.fire("Faltan datos", "Seleccioná un cliente.", "warning"); return; }
    if (!camara)     { Swal.fire("Faltan datos", "Seleccioná la cámara de origen.", "warning"); return; }
    if (!turno)      { Swal.fire("Faltan datos", "Indicá si la carga es por la mañana o por la tarde.", "warning"); return; }
    if (modalidad === "delivery_chofer" && !choferSel) { Swal.fire("Faltan datos", "Seleccioná el chofer para la entrega.", "warning"); return; }

    const lineasValidas   = lineasCalc.filter((l) => l.cajones > 0);
    const trozadosValidos = trozadosLineas.filter((t) => Number(t.cajas) > 0 && Number(t.kgCaja) > 0);

    if (lineasValidas.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Faltan datos", "Seleccioná al menos un calibre o un trozado a cargar.", "warning");
      return;
    }

    for (const t of trozadosValidos) {
      const disp = trozadosDisp.find((d) => d.tipo === t.tipo && d.clase === t.clase)?.cajas || 0;
      if (Number(t.cajas) > disp) {
        Swal.fire("Error", `Stock insuficiente de ${tipoLbl(t.tipo)} clase ${t.clase || "A"}. Disponible: ${disp} cajas.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      const camionDelChofer = camiones.find((c) => c.choferes?.some((ch) => String(ch?._id || ch) === String(choferSel)));

      const actualizado = await actualizarDespachoFrigorifico(despacho._id, {
        fecha:            form.fecha,
        camara,
        turno,
        cliente:          clienteSel._id,
        calibres:         lineasValidas.map(({ calibre, cajones }) => ({ calibre: Number(calibre), cajones })),
        trozados:         trozadosValidos.map((t) => ({ tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas), clase: t.clase })),
        observaciones:    form.observaciones || undefined,
        modalidadEntrega: modalidad,
        chofer:           modalidad === "delivery_chofer" ? choferSel : undefined,
        camion:           modalidad === "delivery_chofer" ? (camionDelChofer?._id || undefined) : undefined,
      });
      onGuardado(actualizado);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar los cambios.", "error");
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
              <h5 className="modal-title">
                <i className="bi bi-pencil me-2"></i>Editar Orden {despacho.numeroOrden}
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-editar-despacho" onSubmit={handleSubmit}>

                {/* Cliente + Fecha */}
                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">
                      Cliente <span className="text-danger">*</span>
                    </label>
                    <div className="position-relative">
                      <input
                        type="text"
                        className={`form-control ${clienteSel ? "is-valid" : ""}`}
                        placeholder="Escribí el nombre del cliente..."
                        value={busqueda}
                        onChange={(e) => { setBusqueda(e.target.value); setClienteSel(null); }}
                        autoComplete="off"
                        autoFocus
                      />
                      {resultados.length > 0 && (
                        <div className="position-absolute w-100 bg-white border rounded shadow-sm"
                          style={{ zIndex: 1055, maxHeight: "200px", overflowY: "auto" }}>
                          {resultados.map((c) => (
                            <div key={c._id} className="px-3 py-2 border-bottom"
                              style={{ cursor: "pointer" }}
                              onMouseDown={() => seleccionarCliente(c)}>
                              {c.razonSocial || c.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">
                      Fecha <span className="text-danger">*</span>
                    </label>
                    <input type="date" className="form-control" value={form.fecha}
                      onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">
                      Turno <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex gap-2">
                      {[
                        { value: "mañana", label: "Mañana", icon: "bi-sunrise" },
                        { value: "tarde",  label: "Tarde",  icon: "bi-sunset"  },
                      ].map((t) => (
                        <button key={t.value} type="button"
                          className={`btn flex-grow-1 py-2 ${turno === t.value ? "btn-success" : "btn-outline-secondary"}`}
                          onClick={() => setTurno(t.value)}>
                          <i className={`bi ${t.icon} me-1`}></i>{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modalidad de entrega */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Modalidad de entrega <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-2">
                    {[
                      { value: "retiro_cliente", label: "Retiro cliente",  icon: "bi-person-walking" },
                      { value: "delivery_chofer", label: "Camión Trigotuc", icon: "bi-truck"          },
                    ].map((m) => (
                      <button key={m.value} type="button"
                        className={`btn flex-grow-1 py-2 ${modalidad === m.value ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => { setModalidad(m.value); setChoferSel(""); }}>
                        <i className={`bi ${m.icon} me-1`}></i>{m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector de chofer (solo delivery) */}
                {modalidad === "delivery_chofer" && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Chofer <span className="text-danger">*</span>
                    </label>
                    {choferes.length === 0 ? (
                      <div className="alert alert-warning py-2 small mb-0">
                        No hay choferes registrados. Creá un usuario con rol <strong>chofer</strong>.
                      </div>
                    ) : (
                      <select
                        className={`form-select ${modalidad === "delivery_chofer" && !choferSel ? "is-invalid" : ""}`}
                        value={choferSel}
                        onChange={(e) => setChoferSel(e.target.value)}
                      >
                        <option value="">Seleccioná un chofer...</option>
                        {choferes.map((c) => {
                          const cam = camiones.find((k) => k.choferes?.some((ch) => String(ch?._id || ch) === String(c._id)) && k.activo);
                          return (
                            <option key={c._id} value={c._id}>
                              {c.nombreUsuario}{cam ? ` — ${cam.marca} ${cam.patente}` : " (sin camión asignado)"}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                )}

                {/* Cámara */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Cámara de origen <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-2">
                    {[
                      { value: "cañete",   label: "Cañete"   },
                      { value: "trigotuc", label: "Trigotuc" },
                    ].map((c) => (
                      <button key={c.value} type="button"
                        className={`btn flex-grow-1 py-2 ${camara === c.value ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={() => handleCamara(c.value)}>
                        <i className="bi bi-snow me-1"></i>{c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel de stock — tarjetitas */}
                {camara && (
                  <div className="mb-3">
                    {loadingStock ? (
                      <div className="text-center py-2 text-muted small">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Calculando stock disponible...
                      </div>
                    ) : totalCajCam === 0 && trozadosDisp.length === 0 ? (
                      <div className="rounded px-3 py-2 small text-muted"
                        style={{ background: "#fef9c3", border: "1px solid #fde68a" }}>
                        <i className="bi bi-exclamation-triangle me-1 text-warning"></i>
                        La cámara {camaraLbl(camara)} no tiene stock disponible.
                      </div>
                    ) : (
                      <div className="rounded p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <div className="small fw-semibold text-success mb-2">
                          <i className="bi bi-snow me-1"></i>Stock disponible en {camaraLbl(camara)}
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {(stockCalibres || []).filter((c) => c.cajones > 0).map((c) => (
                            <div key={c.calibre} className="text-center rounded border"
                              style={{ background: "#eff6ff", minWidth: "80px", padding: "6px 10px" }}>
                              <div className="fw-bold text-primary" style={{ fontSize: "1rem" }}>Cal. {c.calibre}</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>{fmt(c.cajones)} cajones</div>
                              <div className="text-muted" style={{ fontSize: "0.68rem" }}>{fmt(c.cajones * 20)} kg</div>
                            </div>
                          ))}
                          {trozadosDisp.map((t) => (
                            <div key={`${t.tipo}-${t.clase || "A"}`} className="text-center rounded border"
                              style={{ background: "#fffbeb", minWidth: "80px", padding: "6px 10px" }}>
                              <div className="fw-bold text-warning" style={{ fontSize: "0.85rem" }}>{tipoLbl(t.tipo)} {t.clase || "A"}</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>{fmt(t.cajas)} cajas</div>
                              <div className="text-muted" style={{ fontSize: "0.68rem" }}>{fmt(t.kgTotal)} kg</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detalle a cargar */}
                {camara && !loadingStock && (totalCajCam > 0 || trozadosDisp.length > 0) && (
                  <>
                    <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                      Detalle a cargar
                    </div>

                    {totalCajCam > 0 && (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Cajones por calibre</label>
                        <CalibreTable
                          lineas={lineas}
                          onChange={setLineas}
                          inputCajones
                          showPollos={false}
                          stockCalibres={stockCalibres}
                        />
                      </div>
                    )}

                    {trozadosDisp.length > 0 && (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Trozados</label>
                        <table className="table table-sm table-bordered align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Tipo</th>
                              <th>Clase</th>
                              <th className="text-end">Disponible</th>
                              <th style={{ width: "9rem" }}>Cajas a cargar</th>
                              <th>kg/caja</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trozadosDisp.map((t) => {
                              const linea = trozadosLineas.find((l) => l.tipo === t.tipo && l.clase === t.clase) || { cajas: "", kgCaja: t.kgCaja, clase: t.clase };
                              return (
                                <tr key={`${t.tipo}-${t.clase || "A"}`}>
                                  <td className="fw-semibold">{tipoLbl(t.tipo)}</td>
                                  <td><span className="badge bg-secondary">Clase {t.clase || "A"}</span></td>
                                  <td className="text-end text-muted">{fmt(t.cajas)} cajas</td>
                                  <td>
                                    <input type="number" min="0" max={t.cajas} step="1"
                                      className="form-control form-control-sm text-center"
                                      placeholder="0"
                                      value={linea.cajas}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTrozadosLineas((prev) => {
                                          const idx = prev.findIndex((l) => l.tipo === t.tipo && l.clase === t.clase);
                                          const nueva = { tipo: t.tipo, clase: t.clase, cajas: val, kgCaja: t.kgCaja };
                                          return idx === -1 ? [...prev, nueva] : prev.map((l, i) => i === idx ? nueva : l);
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="text-muted small">{t.kgCaja} kg</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Observaciones */}
                <div className="mb-1">
                  <label className="form-label">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea className="form-control" rows={2}
                    value={form.observaciones}
                    onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                    placeholder="Cualquier dato adicional..." />
                </div>

              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-editar-despacho" className="btn btn-primary" disabled={saving || loadingStock}>
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

// ── Página principal ─────────────────────────────────────────────────────────
const DespachoFrigorificoPage = () => {
  const rolUsuario    = localStorage.getItem("rolUsuario");
  const esSuperAdmin  = rolUsuario === "superadmin";
  const esAdmin       = ["superadmin", "administracion_frigorifico"].includes(rolUsuario);

  const [despachos, setDespachos]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editDespacho, setEditDespacho] = useState(null);
  const [filtro, setFiltro]             = useState("pendiente");

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const desp = await obtenerDespachosFrigorifico();
      setDespachos(desp);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleCreada = async (despacho) => {
    setModalAbierto(false);
    cargarDatos();
    const result = await Swal.fire({
      icon: "success",
      title: "Orden creada",
      html: `<div>Orden <strong>${despacho.numeroOrden}</strong> generada${despacho.codigoRetiro ? ` con código <strong style="letter-spacing:0.2em">${despacho.codigoRetiro}</strong>` : ""}.</div>
             <div class="mt-2 text-muted" style="font-size:0.9rem">¿Qué querés hacer con la orden?</div>`,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-whatsapp me-1"></i>Enviar por WhatsApp',
      denyButtonText: '<i class="bi bi-file-earmark-arrow-down me-1"></i>Bajar PDF',
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#25D366",
      denyButtonColor: "#6c757d",
    });
    if (result.isConfirmed) await compartirPDFDespachoWhatsApp(despacho);
    else if (result.isDenied) descargarPDFDespacho(despacho);
  };

  const handleEditado = () => {
    setEditDespacho(null);
    cargarDatos();
    Swal.fire({ icon: "success", title: "Orden actualizada", timer: 1500, showConfirmButton: false });
  };

  const handleEliminar = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar orden?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarDespachoFrigorifico(id);
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const despachosVisibles = filtro ? despachos.filter((d) => d.estado === filtro) : despachos;

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-clipboard2-check me-2 text-primary"></i>
            Órdenes de Carga
          </h1>
          <div className="d-flex gap-2 flex-wrap">
            {[
              { v: "pendiente",  l: "Pendientes" },
              { v: "completada", l: "Completadas" },
              { v: "",           l: "Todas"      },
            ].map(({ v, l }) => (
              <button key={v}
                className={`btn btn-sm ${filtro === v ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltro(v)}>
                {l}
              </button>
            ))}
            {esAdmin && (
              <button className="btn btn-success btn-sm" onClick={() => setModalAbierto(true)}>
                <i className="bi bi-plus-circle me-1"></i>Nueva orden
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
        ) : despachosVisibles.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            No hay órdenes en este estado.
          </div>
        ) : (
          <div className="row g-3">
            {despachosVisibles.map((d) => (
              <div key={d._id} className="col-12 col-md-6 col-lg-4">
                <div className="card border-0 shadow-sm h-100"
                  style={{ borderLeft: `4px solid ${d.estado === "pendiente" ? "#ffc107" : "#198754"}` }}>
                  <div className="card-body">

                    {/* Número + badges */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-dark fs-6">{d.numeroOrden}</span>
                      <div className="d-flex gap-1 flex-wrap justify-content-end">
                        <span className="badge bg-secondary">
                          <i className="bi bi-snow me-1"></i>{camaraLbl(d.camara)}
                        </span>
                        {d.modalidadEntrega === "delivery_chofer" ? (
                          <span className="badge bg-info text-dark">
                            <i className="bi bi-truck me-1"></i>
                            Camión{d.chofer?.nombreUsuario ? `: ${d.chofer.nombreUsuario}` : ""}
                          </span>
                        ) : (
                          <span className="badge bg-light text-dark border">
                            <i className="bi bi-person-walking me-1"></i>Retiro cliente
                          </span>
                        )}
                        {d.turno && (
                          <span className={`badge ${d.turno === "mañana" ? "bg-warning text-dark" : "bg-info text-dark"}`}>
                            <i className={`bi bi-${d.turno === "mañana" ? "sunrise" : "sunset"} me-1`}></i>
                            {d.turno === "mañana" ? "Mañana" : "Tarde"}
                          </span>
                        )}
                        {estadoBadge(d)}
                      </div>
                    </div>

                    {/* Cliente + fecha */}
                    <div className="fw-semibold mb-1">
                      <i className="bi bi-person me-1 text-muted"></i>
                      {d.cliente?.razonSocial || "—"}
                    </div>
                    <div className="text-muted small mb-2">
                      <i className="bi bi-calendar me-1"></i>{fmtFecha(d.fecha)}
                    </div>

                    {/* Detalle calibres + trozados */}
                    {(d.calibres?.length > 0 || d.trozados?.length > 0) && (
                      <div className="mb-2 rounded overflow-hidden" style={{ border: "1px solid #d1fae5" }}>
                        {d.calibres?.map((c, idx) => (
                          <div key={idx}
                            className="d-flex justify-content-between align-items-center px-2 py-1"
                            style={{
                              borderBottom: (idx < d.calibres.length - 1 || d.trozados?.length > 0)
                                ? "1px solid #d1fae5" : "none",
                              background: "#f0fdf4",
                            }}>
                            <span className="fw-semibold text-success">Cal. {c.calibre}</span>
                            <span className="text-muted small">{fmt(c.cajones)} cajones · {fmt(c.cajones * 20)} kg</span>
                          </div>
                        ))}
                        {d.trozados?.map((t, idx) => (
                          <div key={`t${idx}`}
                            className="d-flex justify-content-between align-items-center px-2 py-1"
                            style={{
                              borderBottom: idx < d.trozados.length - 1 ? "1px solid #fef9c3" : "none",
                              background: "#fffbeb",
                            }}>
                            <span className="fw-semibold text-warning">{tipoLbl(t.tipo)}</span>
                            <span className="text-muted small">{fmt(t.cajas)} cajas · {fmt(t.kgTotal)} kg</span>
                          </div>
                        ))}
                        <div className="d-flex justify-content-between align-items-center px-2 py-1 fw-bold"
                          style={{ background: "#dcfce7" }}>
                          <span className="text-success small">Total</span>
                          <span className="text-muted small">
                            {d.totalCajones > 0 ? `${fmt(d.totalCajones)} cajones` : ""}
                            {d.totalCajones > 0 && d.totalKgTrozados > 0 ? " · " : ""}
                            {d.totalKgTrozados > 0 ? `${fmt(d.totalKgTrozados)} kg trozados` : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Observaciones */}
                    {d.observaciones && (
                      <div className="mb-2 p-2 rounded"
                        style={{ background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.85rem" }}>
                        <i className="bi bi-info-circle me-1 text-warning"></i>{d.observaciones}
                      </div>
                    )}

                    {/* Liberada sin código */}
                    {d.liberada && (
                      <div className="alert alert-warning py-1 px-2 mb-0 small text-center">
                        <i className="bi bi-unlock-fill me-1"></i>Liberada — sin código
                      </div>
                    )}
                  </div>

                  <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-success btn-sm flex-grow-1" title="Enviar por WhatsApp"
                        onClick={() => compartirPDFDespachoWhatsApp(d)}>
                        <i className="bi bi-whatsapp"></i>
                      </button>
                      <button className="btn btn-outline-secondary btn-sm flex-grow-1" title="Descargar PDF"
                        onClick={() => descargarPDFDespacho(d)}>
                        <i className="bi bi-file-earmark-arrow-down"></i>
                      </button>
                      {esAdmin && d.estado === "pendiente" && (
                        <button className="btn btn-outline-primary btn-sm flex-grow-1" title="Editar"
                          onClick={() => setEditDespacho(d)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                      )}
                      {esSuperAdmin && d.estado === "pendiente" && (
                        <button className="btn btn-outline-danger btn-sm flex-grow-1" title="Eliminar"
                          onClick={() => handleEliminar(d._id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {modalAbierto && (
        <NuevaOrdenModal
          onClose={() => setModalAbierto(false)}
          onCreada={handleCreada}
        />
      )}

      {editDespacho && (
        <EditarDespachoModal
          despacho={editDespacho}
          onClose={() => setEditDespacho(null)}
          onGuardado={handleEditado}
        />
      )}
    </Layout>
  );
};

export default DespachoFrigorificoPage;
