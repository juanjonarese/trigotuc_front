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

const NuevaOrdenModal = ({ onClose, onCreada, lotes }) => {
  const [saving, setSaving]               = useState(false);
  const [busqueda, setBusqueda]           = useState("");
  const [resultados, setResultados]       = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [form, setForm] = useState({
    cliente: "", granja: "", galpon: "", lote: "",
    fechaEmision: obtenerFechaHoy(),
    cantidadEstimada: "", pesoEstimadoKg: "",
    observaciones: "",
  });

  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(busqueda);
        setResultados(data.clientes || data || []);
      } catch { setResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const seleccionarCliente = (c) => {
    setClienteSeleccionado(c);
    setBusqueda(c.razonSocial || c.nombre || "");
    setResultados([]);
    setForm((f) => ({ ...f, cliente: c._id }));
  };

  const granjaLabel = (g) => g === "cañete" ? "Cañete" : "Los Pinos";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente || !form.granja || !form.cantidadEstimada || !form.pesoEstimadoKg) {
      Swal.fire("Faltan datos", "Completá todos los campos obligatorios.", "warning");
      return;
    }
    setSaving(true);
    try {
      const orden = await crearOrdenCarga({
        ...form,
        fechaEmision:     ajustarFechaParaGuardar(form.fechaEmision),
        cantidadEstimada: Number(form.cantidadEstimada),
        pesoEstimadoKg:   Number(form.pesoEstimadoKg),
        galpon:           form.galpon ? Number(form.galpon) : undefined,
        lote:             form.lote || undefined,
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
      if (isConfirmed) {
        generarPDF({ ...orden, cliente: clienteSeleccionado });
      }
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const lotesFiltrados = form.granja ? lotes.filter((l) => l.granja === form.granja) : lotes;

  const GALPONES_MAX = { cañete: 6, los_pinos: 8 };
  const maxGalpones = form.granja ? (GALPONES_MAX[form.granja] || 8) : 0;

  const seleccionarLote = (loteId) => {
    const lote = lotes.find((l) => l._id === loteId);
    setForm((f) => ({ ...f, lote: loteId, galpon: lote ? String(lote.galpon) : f.galpon }));
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
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold">Cliente <span className="text-danger">*</span></label>
                    <div className="position-relative">
                      <input
                        type="text"
                        className={`form-control ${clienteSeleccionado ? "is-valid" : ""}`}
                        placeholder="Escribí el nombre del cliente..."
                        value={busqueda}
                        onChange={(e) => { setBusqueda(e.target.value); setClienteSeleccionado(null); setForm((f) => ({ ...f, cliente: "" })); }}
                        autoComplete="off"
                      />
                      {resultados.length > 0 && (
                        <div className="position-absolute w-100 bg-white border rounded shadow-sm" style={{ zIndex: 1055, maxHeight: "200px", overflowY: "auto" }}>
                          {resultados.map((c) => (
                            <div
                              key={c._id}
                              className="px-3 py-2 border-bottom"
                              style={{ cursor: "pointer" }}
                              onMouseDown={() => seleccionarCliente(c)}
                            >
                              {c.razonSocial || c.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {clienteSeleccionado && (
                      <div className="form-text text-success"><i className="bi bi-check-circle me-1"></i>{clienteSeleccionado.nombre}</div>
                    )}
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Granja <span className="text-danger">*</span></label>
                    <select className="form-select" value={form.granja} onChange={(e) => setForm({ ...form, granja: e.target.value, galpon: "", lote: "" })} required>
                      <option value="">Seleccioná...</option>
                      {GRANJAS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Galpón <span className="text-danger">*</span></label>
                    <input
                      type="number" className="form-control"
                      placeholder="Nº"
                      value={form.galpon}
                      onChange={(e) => setForm({ ...form, galpon: e.target.value })}
                      min="1" max={maxGalpones}
                      disabled={!form.granja}
                      required
                    />
                    {form.granja && <div className="form-text">1 – {maxGalpones}</div>}
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Fecha emisión <span className="text-danger">*</span></label>
                    <input type="date" className="form-control" value={form.fechaEmision} onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Lote activo (opcional — auto-completa galpón)</label>
                    <select className="form-select" value={form.lote} onChange={(e) => seleccionarLote(e.target.value)} disabled={!form.granja}>
                      <option value="">Sin lote específico</option>
                      {lotesFiltrados.map((l) => (
                        <option key={l._id} value={l._id}>
                          #{l.numeroLote} — Galpón {l.galpon}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label fw-semibold">Cant. estimada <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" placeholder="pollos" min="1" value={form.cantidadEstimada} onChange={(e) => setForm({ ...form, cantidadEstimada: e.target.value })} required />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label fw-semibold">Peso est. (kg) <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" placeholder="0" min="0.01" step="0.01" value={form.pesoEstimadoKg} onChange={(e) => setForm({ ...form, pesoEstimadoKg: e.target.value })} required />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Observaciones (opcional)</label>
                    <textarea className="form-control" rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                  </div>

                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-nueva-orden" className="btn btn-success" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Confirmar valores de carga
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
  const fecha = new Date(o.fechaEmision).toLocaleDateString("es-AR");
  const W = 210; // ancho A4

  // Header
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("Trigotuc Avícola", 14, 20);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text("Orden de Retiro", 14, 27);

  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(26, 122, 26);
  doc.text(o.numero, W - 14, 20, { align: "right" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text(`Fecha: ${fecha}`, W - 14, 27, { align: "right" });

  doc.setDrawColor(50); doc.setLineWidth(0.5);
  doc.line(14, 31, W - 14, 31);

  // Código de retiro — destacado
  if (o.codigoRetiro) {
    doc.setFillColor(26, 122, 26);
    doc.roundedRect(14, 35, W - 28, 16, 3, 3, "F");
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(200, 255, 200);
    doc.text("CÓDIGO DE RETIRO — presentar al momento de retirar", W / 2, 41, { align: "center" });
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(o.codigoRetiro, W / 2, 48, { align: "center" });
  }

  // Cliente
  doc.setTextColor(0);
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("CLIENTE", 14, 59);
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text(clienteNombre, 14, 66);

  // Granja + Galpón
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("GRANJA / GALPÓN", 14, 76);
  doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
  const galponStr = o.galpon ? `${granjaStr} — Galpón ${o.galpon}` : granjaStr;
  doc.text(galponStr, 14, 83);

  // Tabla
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
  doc.text("DETALLE", 14, 92);
  doc.setDrawColor(200); doc.setLineWidth(0.3);
  doc.line(14, 94, W - 14, 94);

  // Header tabla (sin precio ni total)
  doc.setFillColor(245, 245, 245);
  doc.rect(14, 96, W - 28, 8, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(80);
  doc.text("Descripción", 16, 101);
  doc.text("Cant. estimada (pollos)", 130, 101, { align: "right" });
  doc.text("Peso estimado (kg)", W - 16, 101, { align: "right" });

  // Fila datos (sin precio ni total)
  doc.setFont("helvetica", "normal"); doc.setTextColor(0); doc.setFontSize(9);
  doc.text(`Pollos gordos — ${galponStr}`, 16, 111);
  doc.text(Number(o.cantidadEstimada).toLocaleString("es-AR"), 130, 111, { align: "right" });
  doc.text(`${o.pesoEstimadoKg} kg`, W - 16, 111, { align: "right" });

  doc.setDrawColor(200); doc.line(14, 115, W - 14, 115);

  // Nota
  doc.setFillColor(255, 251, 234);
  doc.setDrawColor(240, 230, 140); doc.setLineWidth(0.3);
  doc.roundedRect(14, 118, W - 28, 10, 2, 2, "FD");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(133, 100, 4);
  doc.text("Los valores de cantidad y peso son estimados. Se confirmarán al momento de la entrega.", 17, 124);

  // Observaciones
  if (o.observaciones) {
    doc.setTextColor(0); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(130);
    doc.text("OBSERVACIONES", 14, 135);
    doc.setFont("helvetica", "normal"); doc.setTextColor(0);
    doc.text(o.observaciones, 14, 141);
  }

  // Firmas
  const yFirma = 230;
  doc.setDrawColor(80); doc.setLineWidth(0.4);
  doc.line(14, yFirma, 90, yFirma);
  doc.line(120, yFirma, W - 14, yFirma);
  doc.setFontSize(8); doc.setTextColor(100);
  doc.text("Firma empresa", 52, yFirma + 5, { align: "center" });
  doc.text("Conformidad cliente", 155, yFirma + 5, { align: "center" });

  // Footer
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`Trigotuc Avícola — ${o.numero} — Emitida: ${fecha}`, W / 2, 285, { align: "center" });

  doc.save(`OrdenCarga_${o.numero}.pdf`);
};

const EditarOrdenModal = ({ orden, lotes, onClose, onGuardado }) => {
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState(orden.cliente?.razonSocial || orden.cliente?.nombre || "");
  const [resultados, setResultados] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(orden.cliente);
  const [form, setForm] = useState({
    cliente:          orden.cliente?._id || "",
    granja:           orden.granja || "",
    lote:             orden.lote?._id || "",
    fechaEmision:     orden.fechaEmision?.split("T")[0] || "",
    cantidadEstimada: orden.cantidadEstimada || "",
    pesoEstimadoKg:   orden.pesoEstimadoKg || "",
    observaciones:    orden.observaciones || "",
  });

  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(busqueda);
        setResultados(data.clientes || data || []);
      } catch { setResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const seleccionarCliente = (c) => {
    setClienteSeleccionado(c);
    setBusqueda(c.razonSocial || c.nombre || "");
    setResultados([]);
    setForm((f) => ({ ...f, cliente: c._id }));
  };

  const granjaLabel = (g) => g === "cañete" ? "Cañete" : "Los Pinos";
  const lotesFiltrados = form.granja ? lotes.filter((l) => l.granja === form.granja) : lotes;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await actualizarOrdenCarga(orden._id, {
        ...form,
        cantidadEstimada: Number(form.cantidadEstimada),
        pesoEstimadoKg:   Number(form.pesoEstimadoKg),
        lote:             form.lote || undefined,
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
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold">Cliente</label>
                    <div className="position-relative">
                      <input type="text" className={`form-control ${clienteSeleccionado ? "is-valid" : ""}`}
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
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Granja</label>
                    <select className="form-select" value={form.granja} onChange={(e) => setForm({ ...form, granja: e.target.value, lote: "" })} required>
                      <option value="">Seleccioná...</option>
                      {[{ value: "cañete", label: "Cañete" }, { value: "los_pinos", label: "Los Pinos" }].map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Fecha emisión</label>
                    <input type="date" className="form-control" value={form.fechaEmision} onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Lote (opcional)</label>
                    <select className="form-select" value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} disabled={!form.granja}>
                      <option value="">Sin lote específico</option>
                      {lotesFiltrados.map((l) => (
                        <option key={l._id} value={l._id}>#{l.numeroLote} — {granjaLabel(l.granja)} Galpón {l.galpon}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label fw-semibold">Cant. estimada</label>
                    <input type="number" className="form-control" min="1" value={form.cantidadEstimada} onChange={(e) => setForm({ ...form, cantidadEstimada: e.target.value })} required />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label fw-semibold">Peso est. (kg)</label>
                    <input type="number" className="form-control" min="0.01" step="0.01" value={form.pesoEstimadoKg} onChange={(e) => setForm({ ...form, pesoEstimadoKg: e.target.value })} required />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Observaciones (opcional)</label>
                    <textarea className="form-control" rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                  </div>
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
      const data = await obtenerOrdenesCarga(filtroEstado ? { estado: filtroEstado } : {});
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
                            {(puedeCrear && o.estado === "pendiente" || esSuperAdmin) && (
                              <button className="btn btn-outline-primary btn-sm" onClick={(ev) => { ev.stopPropagation(); setEditOrden(o); }} title="Editar">
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            {esSuperAdmin && (
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
                          <td className="text-end">{o.pesoEstimadoKg} kg</td>
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
                              {(puedeCrear && o.estado === "pendiente" || esSuperAdmin) && (
                                <button className="btn btn-outline-primary btn-sm" onClick={() => setEditOrden(o)} title="Editar">
                                  <i className="bi bi-pencil"></i>
                                </button>
                              )}
                              {esSuperAdmin && (
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
