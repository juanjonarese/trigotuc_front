import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { escapeHtml } from "../utils/escapeHtml";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { obtenerResumenStock, obtenerLotes, eliminarLote, actualizarLote, sincronizarVentasDropbox } from "../services/api";
import Swal from "sweetalert2";

const fmtNum = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

// ── Modal editar lote ────────────────────────────────────────────────────────
const EditarLoteModal = ({ lote, onClose, onGuardado }) => {
  const calibreRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [lineas, setLineas] = useState(
    (lote.calibres || []).map((c) => ({ calibre: c.calibre, pollos: c.pollos }))
  );
  const [form, setForm] = useState({
    unidadesFaenadas:    lote.unidadesFaenadas    != null ? String(lote.unidadesFaenadas)    : "",
    kgVivos:             lote.kgVivos             != null ? String(lote.kgVivos)             : "",
    unidadesDecomisadas: lote.unidadesDecomisadas != null ? String(lote.unidadesDecomisadas) : "",
    kgDecomisados:       lote.kgDecomisados       != null ? String(lote.kgDecomisados)       : "",
    unidadesTrozadas:    lote.unidadesTrozadas     != null ? String(lote.unidadesTrozadas)    : "",
    kgTrozados:          lote.kgTrozados           != null ? String(lote.kgTrozados)          : "",
    observaciones:       lote.observaciones || "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lineasFinales = calibreRef.current?.getLineas() ?? lineas;
    const calibresPayload = lineasFinales
      .filter((l) => Number(l.pollos) > 0)
      .map((l) => ({ calibre: Number(l.calibre), pollos: Number(l.pollos) }));
    if (calibresPayload.length === 0) {
      Swal.fire("Faltan datos", "Ingresá al menos un calibre con pollos.", "warning"); return;
    }
    setSaving(true);
    try {
      await actualizarLote(lote._id, {
        calibres:            calibresPayload,
        unidadesFaenadas:    form.unidadesFaenadas    !== "" ? Number(form.unidadesFaenadas)    : undefined,
        kgVivos:             form.kgVivos             !== "" ? Number(form.kgVivos)             : undefined,
        unidadesDecomisadas: form.unidadesDecomisadas !== "" ? Number(form.unidadesDecomisadas) : undefined,
        kgDecomisados:       form.kgDecomisados       !== "" ? Number(form.kgDecomisados)       : undefined,
        unidadesTrozadas:    form.unidadesTrozadas     !== "" ? Number(form.unidadesTrozadas)    : undefined,
        kgTrozados:          form.kgTrozados           !== "" ? Number(form.kgTrozados)          : undefined,
        observaciones:       form.observaciones || undefined,
      });
      onGuardado();
      Swal.fire({ icon: "success", title: "Lote actualizado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-warning text-dark">
              <h5 className="modal-title">
                <i className="bi bi-pencil-square me-2"></i>
                Editar lote #{lote.numeroLote} — {new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-editar-lote" onSubmit={handleSubmit}>

                {/* Calibres */}
                <div className="mb-4">
                  <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                    Calibres en cámara
                  </div>
                  <CalibreTable ref={calibreRef} lineas={lineas} onChange={setLineas} showTotals />
                </div>

                {/* Datos de faena */}
                <div className="mb-4">
                  <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                    Datos de faena
                  </div>
                  <div className="row g-3">
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small">Pollos faenados</label>
                      <input type="number" className="form-control" min="0" placeholder="0"
                        value={form.unidadesFaenadas} onChange={(e) => set("unidadesFaenadas", e.target.value)} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small">Kg vivos</label>
                      <input type="number" className="form-control" min="0" step="0.01" placeholder="0"
                        value={form.kgVivos} onChange={(e) => set("kgVivos", e.target.value)} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small text-danger">Decomisados (u)</label>
                      <input type="number" className="form-control" min="0" placeholder="0"
                        value={form.unidadesDecomisadas} onChange={(e) => set("unidadesDecomisadas", e.target.value)} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small text-danger">Decomisados (kg)</label>
                      <input type="number" className="form-control" min="0" step="0.01" placeholder="0"
                        value={form.kgDecomisados} onChange={(e) => set("kgDecomisados", e.target.value)} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small text-warning">Trozados (u)</label>
                      <input type="number" className="form-control" min="0" placeholder="0"
                        value={form.unidadesTrozadas} onChange={(e) => set("unidadesTrozadas", e.target.value)} />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small text-warning">Trozados (kg)</label>
                      <input type="number" className="form-control" min="0" step="0.01" placeholder="0"
                        value={form.kgTrozados} onChange={(e) => set("kgTrozados", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className="form-label fw-semibold small">Observaciones</label>
                  <textarea className="form-control" rows={2} value={form.observaciones}
                    onChange={(e) => set("observaciones", e.target.value)} />
                </div>

              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-editar-lote" className="btn btn-warning" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-circle me-1"></i>Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
const GranjaDashboardPage = () => {
  const navigate = useNavigate();
  const rolUsuario = localStorage.getItem("rolUsuario");
  const esSuperAdmin = rolUsuario === "superadmin";
  const puedeGestionar = rolUsuario === "superadmin" || rolUsuario === "frigorifico";
  const puedeActualizarStock = [
    "superadmin", "frigorifico", "camaras",
    "administracion_frigorifico", "administracion_granja",
  ].includes(rolUsuario);

  const [resumen, setResumen] = useState({
    totalPollosVivos: 0,
    totalKg: 0,
    cajonesDisponibles: 0,
    porCalibre: [],
    stockCañete: [],
    stockTrigotuc: [],
    trozadosCañete: [],
    trozadosTrigotuc: [],
  });
  const [lotes, setLotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [loteEditar, setLoteEditar] = useState(null);
  const [actualizandoStock, setActualizandoStock] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      const [resumenData, lotesData] = await Promise.all([
        obtenerResumenStock(),
        obtenerLotes(),
      ]);
      setResumen(resumenData);
      setLotes(lotesData.filter((l) => l.estado === "activo"));
      setError(null);
    } catch {
      setError("Error al cargar datos de la granja");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 30000);
    return () => clearInterval(interval);
  }, [cargarDatos]);

  const formatNum = fmtNum;

  // Trae las ventas nuevas del POS desde Dropbox y descuenta el stock
  const handleActualizarStock = async () => {
    setActualizandoStock(true);
    try {
      const r = await sincronizarVentasDropbox("trigotuc");
      const nuevos = r.procesados?.length || 0;
      const fallidos = r.fallidos?.length || 0;
      await cargarDatos();
      if (nuevos === 0 && fallidos === 0) {
        Swal.fire({ icon: "info", title: "Stock al día", text: "No hay ventas nuevas para descontar.", timer: 2000, showConfirmButton: false });
      } else {
        Swal.fire(
          "Stock actualizado",
          `Ventas nuevas descontadas: ${nuevos}${fallidos ? ` · No aplicadas: ${fallidos}` : ""}`,
          fallidos ? "warning" : "success"
        );
      }
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo actualizar el stock.", "error");
    } finally {
      setActualizandoStock(false);
    }
  };

  const handleEliminarLote = async (lote) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar carga?",
      html: `Se eliminará el lote del <strong>${new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}</strong> y todas sus ventas y actualizaciones asociadas.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarLote(lote._id);
      Swal.fire("Eliminado", "La carga fue eliminada.", "success");
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar la carga.", "error");
    }
  };

  const imprimirLote = (lote) => {
    const totalCajones = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
    const pctDecom = lote.unidadesFaenadas > 0
      ? (lote.unidadesDecomisadas / lote.unidadesFaenadas * 100).toFixed(2)
      : null;
    const pctTroz = lote.unidadesFaenadas > 0
      ? (lote.unidadesTrozadas / lote.unidadesFaenadas * 100).toFixed(2)
      : null;
    const promKg = lote.unidadesFaenadas > 0
      ? (lote.kgVivos / lote.unidadesFaenadas).toFixed(3)
      : null;

    const fmt = (n) => n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

    const calibresHtml = (lote.calibres || []).map(c =>
      `<span class="badge">Cal. ${c.calibre}: ${fmt(c.cajones)} cajones (${fmt(c.cajones * 20)} kg)</span>`
    ).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Lote ${lote.numeroLote ? "#" + lote.numeroLote : ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 32px; }
    .header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #222; padding-bottom: 16px; margin-bottom: 20px; }
    .header img { height: 60px; }
    .header-text h1 { font-size: 20px; font-weight: bold; }
    .header-text p { font-size: 12px; color: #555; }
    .title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; }
    .lote-num { font-size: 22px; font-weight: bold; }
    .fecha { font-size: 13px; color: #555; }
    section { margin-bottom: 18px; }
    section h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
    .row-item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #e0e0e0; }
    .row-item span:first-child { color: #555; }
    .row-item strong { color: #111; }
    .badge { display: inline-block; background: #e8f0fe; color: #1a56db; border: 1px solid #c3d3f5; border-radius: 4px; padding: 2px 8px; margin: 2px; font-size: 12px; }
    .highlight { font-size: 18px; font-weight: bold; color: #16a34a; }
    .danger { color: #dc2626; }
    .warn { color: #d97706; }
    footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #888; text-align: right; }
    @media print { body { padding: 16px; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="/logo_trigotuc.png" alt="Logo Trigotuc"/>
    <div class="header-text">
      <h1>Trigotuc <span style="color:#d97706">Avícola</span></h1>
      <p>Resumen de Lote de Faena</p>
    </div>
  </div>

  <div class="title-row">
    <div class="lote-num">Lote ${lote.numeroLote ? "#" + lote.numeroLote : "(sin número)"}</div>
    <div class="fecha">Fecha de ingreso: ${new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}</div>
  </div>

  <section>
    <h2>Stock en cámara</h2>
    <div style="margin-bottom:8px">${calibresHtml}</div>
    <div class="grid">
      <div class="row-item"><span>Cajones totales</span><strong>${fmt(totalCajones)}</strong></div>
      <div class="row-item"><span>Kg totales</span><strong>${fmt(lote.pesoTotal)}</strong></div>
      ${lote.pesoPromedio > 0 ? `<div class="row-item"><span>Kg por pollo</span><strong>${fmt(lote.pesoPromedio)}</strong></div>` : ""}
    </div>
  </section>

  ${lote.kgVivos > 0 ? `
  <section>
    <h2>Datos de faena</h2>
    <div class="grid">
      ${lote.unidadesFaenadas > 0 ? `<div class="row-item"><span>Pollos vivos</span><strong>${fmt(lote.unidadesFaenadas)}</strong></div>` : ""}
      <div class="row-item"><span>Kg vivos</span><strong>${fmt(lote.kgVivos)}</strong></div>
      ${promKg ? `<div class="row-item"><span>Prom. kg/pollo vivo</span><strong>${promKg}</strong></div>` : ""}
      ${lote.unidadesDecomisadas > 0 ? `<div class="row-item"><span class="danger">Decomisados (u)</span><strong class="danger">${fmt(lote.unidadesDecomisadas)}${pctDecom ? " (" + pctDecom + "%)" : ""}</strong></div>` : ""}
      ${lote.kgDecomisados > 0 ? `<div class="row-item"><span class="danger">Decomisados (kg)</span><strong class="danger">${fmt(lote.kgDecomisados)}</strong></div>` : ""}
      ${lote.unidadesTrozadas > 0 ? `<div class="row-item"><span class="warn">Trozados (u)</span><strong class="warn">${fmt(lote.unidadesTrozadas)}${pctTroz ? " (" + pctTroz + "%)" : ""}</strong></div>` : ""}
      ${lote.kgTrozados > 0 ? `<div class="row-item"><span class="warn">Trozados (kg)</span><strong class="warn">${fmt(lote.kgTrozados)}</strong></div>` : ""}
    </div>
  </section>
  ` : ""}

  ${lote.rendimientoFaena != null ? `
  <section>
    <h2>Rendimiento de faena</h2>
    <div class="highlight">${fmt(lote.rendimientoFaena)}%</div>
  </section>
  ` : ""}

  ${lote.observaciones ? `
  <section>
    <h2>Observaciones</h2>
    <p>${escapeHtml(lote.observaciones)}</p>
  </section>
  ` : ""}

  <footer>Impreso el ${new Date().toLocaleDateString("es-AR")} — Trigotuc Avícola</footer>

  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=800,height=700");
    win.document.write(html);
    win.document.close();
  };

  const exportarLoteExcel = (lote) => {
    const totalCajones = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
    const rows = [
      ["RESUMEN LOTE"],
      [""],
      ["Nro Lote",       lote.numeroLote ? `#${lote.numeroLote}` : "—"],
      ["Fecha ingreso",  new Date(lote.fechaIngreso).toLocaleDateString("es-AR")],
      ["Estado",         lote.estado],
      [""],
      ["STOCK EN CÁMARA"],
      ["Cajones totales", totalCajones],
      ["Kg totales",      lote.pesoTotal],
      ["Kg/pollo",        lote.pesoPromedio || "—"],
      [""],
      ...(lote.calibres || []).map(c => [`Cal. ${c.calibre}`, `${c.cajones} cajones`]),
      [""],
      ["DATOS DE FAENA"],
      ["Pollos vivos",         lote.unidadesFaenadas || "—"],
      ["Kg vivos",             lote.kgVivos          || "—"],
      ["Prom. kg/pollo vivo",  lote.unidadesFaenadas > 0 ? Math.round(lote.kgVivos / lote.unidadesFaenadas * 1000) / 1000 : "—"],
      ["Decomisados (u)",      lote.unidadesDecomisadas || 0],
      ["Decomisados (kg)",     lote.kgDecomisados       || 0],
      ["Decomisados (%)",      lote.unidadesFaenadas > 0 ? `${Math.round(lote.unidadesDecomisadas / lote.unidadesFaenadas * 10000) / 100}%` : "—"],
      ["Trozados (u)",         lote.unidadesTrozadas    || 0],
      ["Trozados (kg)",        lote.kgTrozados          || 0],
      ["Trozados (%)",         lote.unidadesFaenadas > 0 ? `${Math.round(lote.unidadesTrozadas / lote.unidadesFaenadas * 10000) / 100}%` : "—"],
      ["Rendimiento faena",    lote.rendimientoFaena != null ? `${formatNum(lote.rendimientoFaena)}%` : "—"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lote");
    XLSX.writeFile(wb, `Lote_${lote.numeroLote || lote._id}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

const totalCañeteKg          = (resumen.stockCañete || []).reduce((a, c) => a + c.cajones * 20, 0);
  const totalTrigotucKg        = (resumen.stockTrigotuc || []).reduce((a, c) => a + c.cajones * 20, 0);
  const totalCañeteTrozadosKg  = (resumen.trozadosCañete || []).reduce((a, t) => a + t.kgTotal, 0);
  const totalTrigotucTrozadosKg = (resumen.trozadosTrigotuc || []).reduce((a, t) => a + t.kgTotal, 0);
  const TIPOS_LABEL = { filet: "Filet", pata: "Pata/muslo", alita: "Alita", menudo: "Menudo", carcaza: "Carcaza" };
  const TIPOS_ORDER = ["filet", "pata", "alita", "menudo", "carcaza"];

  const trozadosTotalesMap = {};
  for (const t of [...(resumen.trozadosCañete || []), ...(resumen.trozadosTrigotuc || [])]) {
    if (!trozadosTotalesMap[t.tipo]) trozadosTotalesMap[t.tipo] = { cajas: 0, kgTotal: 0 };
    trozadosTotalesMap[t.tipo].cajas   += t.cajas;
    trozadosTotalesMap[t.tipo].kgTotal += t.kgTotal;
  }

  return (
    <Layout>
      <div className="container-fluid">
      {/* ── Header ── */}
      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">
          <i className="bi bi-snow me-2 text-warning"></i>
          Frigorífico — Stock
        </h1>
        <div className="d-flex flex-wrap gap-2">
          {puedeActualizarStock && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleActualizarStock}
              disabled={actualizandoStock}
              title="Trae las ventas del POS y descuenta el stock"
            >
              {actualizandoStock
                ? <><span className="spinner-border spinner-border-sm me-1"></span>Actualizando…</>
                : <><i className="bi bi-arrow-repeat me-1"></i>Actualizar stock</>}
            </button>
          )}
          {puedeGestionar && (
              <button
                className="btn btn-success btn-sm"
                onClick={() => navigate("/frigorifico/lotes/nuevo")}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Nuevo Lote
              </button>
            )}
          {(esSuperAdmin || rolUsuario === "granja") && (
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => navigate("/frigorifico/envios")}
            >
              <i className="bi bi-truck me-1"></i>
              Envíos
            </button>
          )}
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={cargarDatos}
            title="Refrescar"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* ── Stock total ── */}
      <div className="card border-0 shadow-sm mb-2" style={{ background: "#f0f4f8" }}>
        <div className="card-header border-0 py-2" style={{ background: "transparent" }}>
          <h6 className="mb-0 text-secondary fw-semibold">
            <i className="bi bi-layers me-2"></i>
            Stock total — todas las cámaras
          </h6>
        </div>
        <div className="card-body py-3">
          {resumen.cajonesDisponibles === 0 && Object.keys(trozadosTotalesMap).length === 0 ? (
            <p className="text-muted small mb-0">Sin stock en cámara.</p>
          ) : (
            <div className="d-flex flex-wrap gap-4">
              {/* Pollos faenados */}
              {resumen.cajonesDisponibles > 0 && (
                <div>
                  <div className="text-muted small mb-2">Pollos faenados</div>
                  <div className="d-flex flex-wrap gap-2">
                    {(resumen.porCalibre || []).map((c) => (
                      <div key={c.calibre} className="text-center border rounded px-2 py-1">
                        <span className="badge bg-info text-dark d-block mb-1">Cal. {c.calibre}</span>
                        <div className="fw-bold small">{formatNum(c.cajones)} caj</div>
                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(c.cajones * 20)} kg</div>
                      </div>
                    ))}
                    <div className="d-flex flex-column justify-content-center ms-1 border-start ps-3">
                      <div className="fw-bold">{formatNum(resumen.cajonesDisponibles)} caj</div>
                      <div className="text-muted small">{formatNum(resumen.totalKg)} kg</div>
                    </div>
                  </div>
                </div>
              )}
              {/* Trozados */}
              {TIPOS_ORDER.some((tipo) => (trozadosTotalesMap[tipo]?.cajas || 0) > 0) && (
                <div>
                  <div className="text-muted small mb-2">Trozados</div>
                  <div className="d-flex flex-wrap gap-2">
                    {TIPOS_ORDER.filter((tipo) => (trozadosTotalesMap[tipo]?.cajas || 0) > 0).map((tipo) => {
                      const t = trozadosTotalesMap[tipo];
                      return (
                        <div key={tipo} className="text-center border rounded px-2 py-1">
                          <span className="badge bg-warning text-dark d-block mb-1">{TIPOS_LABEL[tipo]}</span>
                          <div className="fw-bold small">{formatNum(t.cajas)} cajas</div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(t.kgTotal)} kg</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Separador sección cámaras ── */}
      {(totalCañeteKg > 0 || totalTrigotucKg > 0 || totalCañeteTrozadosKg > 0 || totalTrigotucTrozadosKg > 0) && (
        <div className="d-flex align-items-center gap-2 mt-4 mb-3">
          <hr className="flex-grow-1 m-0" />
          <span className="text-muted fw-semibold text-uppercase px-2"
            style={{ fontSize: "0.72rem", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            <i className="bi bi-snow me-1"></i>
            Distribución por cámara
          </span>
          <hr className="flex-grow-1 m-0" />
        </div>
      )}

      {/* ── Stock por cámara ── */}
      {(totalCañeteKg > 0 || totalTrigotucKg > 0 || totalCañeteTrozadosKg > 0 || totalTrigotucTrozadosKg > 0) && (
        <div className="row g-3 mb-4">
          {/* Cámara Cañete */}
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white py-2">
                <h6 className="mb-0">
                  <i className="bi bi-snow me-2 text-info"></i>
                  Cámara Cañete
                </h6>
              </div>
              <div className="card-body py-2">
                {(resumen.stockCañete || []).length === 0 && (resumen.trozadosCañete || []).length === 0 ? (
                  <p className="text-muted small mb-0">Sin stock</p>
                ) : (
                  <>
                    {(resumen.stockCañete || []).length > 0 && (
                      <>
                        <div className="text-muted small mb-1">Pollos faenados</div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {(resumen.stockCañete || []).map((c) => (
                            <div key={c.calibre} className="text-center border rounded px-2 py-1">
                              <span className="badge bg-info text-dark d-block mb-1">Cal. {c.calibre}</span>
                              <div className="fw-bold small">{formatNum(c.cajones)} caj</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(c.cajones * 20)} kg</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {(resumen.trozadosCañete || []).filter((t) => t.cajas > 0).length > 0 && (
                      <>
                        <div className="text-muted small mb-1">Trozados</div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {(resumen.trozadosCañete || []).filter((t) => t.cajas > 0).map((t) => (
                            <div key={t.tipo} className="text-center border rounded px-2 py-1">
                              <span className="badge bg-warning text-dark d-block mb-1">{TIPOS_LABEL[t.tipo] || t.tipo}</span>
                              <div className="fw-bold small">{formatNum(t.cajas)} caj</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(t.kgTotal)} kg</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="mt-1 text-muted small">
                  Total: <strong>{formatNum(totalCañeteKg + totalCañeteTrozadosKg)} kg</strong>
                </div>
              </div>
            </div>
          </div>
          {/* Cámara Trigotuc */}
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white py-2">
                <h6 className="mb-0">
                  <i className="bi bi-snow2 me-2 text-primary"></i>
                  Cámara Trigotuc
                </h6>
              </div>
              <div className="card-body py-2">
                {(resumen.stockTrigotuc || []).length === 0 && (resumen.trozadosTrigotuc || []).length === 0 ? (
                  <p className="text-muted small mb-0">Sin stock</p>
                ) : (
                  <>
                    {(resumen.stockTrigotuc || []).length > 0 && (
                      <>
                        <div className="text-muted small mb-1">Pollos faenados</div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {(resumen.stockTrigotuc || []).map((c) => (
                            <div key={c.calibre} className="text-center border rounded px-2 py-1">
                              <span className="badge bg-primary d-block mb-1">Cal. {c.calibre}</span>
                              <div className="fw-bold small">{formatNum(c.cajones)} caj</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(c.cajones * 20)} kg</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {(resumen.trozadosTrigotuc || []).filter((t) => t.cajas > 0).length > 0 && (
                      <>
                        <div className="text-muted small mb-1">Trozados</div>
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {(resumen.trozadosTrigotuc || []).filter((t) => t.cajas > 0).map((t) => (
                            <div key={t.tipo} className="text-center border rounded px-2 py-1">
                              <span className="badge bg-warning text-dark d-block mb-1">{TIPOS_LABEL[t.tipo] || t.tipo}</span>
                              <div className="fw-bold small">{formatNum(t.cajas)} caj</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(t.kgTotal)} kg</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="mt-1 text-muted small">
                  Total: <strong>{formatNum(totalTrigotucKg + totalTrigotucTrozadosKg)} kg</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {localStorage.getItem("rolUsuario") !== "frigorifico" && (
        <p className="text-muted mt-2 small">
          <i className="bi bi-clock me-1"></i>
          Se actualiza automáticamente cada 30 segundos.
        </p>
      )}
      </div>

      {loteEditar && (
        <EditarLoteModal
          lote={loteEditar}
          onClose={() => setLoteEditar(null)}
          onGuardado={() => { setLoteEditar(null); cargarDatos(); }}
        />
      )}
    </Layout>
  );
};

export default GranjaDashboardPage;
