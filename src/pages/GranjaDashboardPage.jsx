import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { GiRoastChicken, GiChickenLeg } from "react-icons/gi";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { obtenerResumenStock, obtenerLotes, eliminarLote } from "../services/api";
import Swal from "sweetalert2";

const GranjaDashboardPage = () => {
  const navigate = useNavigate();
  const rolUsuario = localStorage.getItem("rolUsuario");
  const esAdmin = rolUsuario === "admin";
  const puedeGestionar = rolUsuario === "superadmin" || rolUsuario === "frigorifico";

  const [resumen, setResumen] = useState({
    totalPollosVivos: 0,
    totalKg: 0,
    cajonesDisponibles: 0,
    porCalibre: [],
    stockCañete: [],
    stockTrigotuc: [],
  });
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const formatNum = (n) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

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
    <p>${lote.observaciones}</p>
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

  const totalPollosTrozados = lotes.reduce((acc, l) => acc + (l.unidadesTrozadas || 0), 0);

  const totalCañeteKg   = (resumen.stockCañete || []).reduce((a, c) => a + c.cajones * 20, 0);
  const totalTrigotucKg = (resumen.stockTrigotuc || []).reduce((a, c) => a + c.cajones * 20, 0);

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
          {puedeGestionar && (
              <button
                className="btn btn-success btn-sm"
                onClick={() => navigate("/frigorifico/lotes/nuevo")}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Nuevo Lote
              </button>
            )}
          {(esAdmin || rolUsuario === "granja") && (
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

      {/* ── Tarjetas resumen ── */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100 text-center">
            <div className="card-body py-3 px-2">
              <GiRoastChicken size={36} className="text-warning" />
              <h3 className="mt-1 mb-0 fs-4">{formatNum(resumen.totalPollosVivos)}</h3>
              <p className="text-muted mb-0 small">Pollos enteros</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100 text-center">
            <div className="card-body py-3 px-2">
              <GiChickenLeg size={36} className="text-secondary" />
              <h3 className="mt-1 mb-0 fs-4">{formatNum(totalPollosTrozados)}</h3>
              <p className="text-muted mb-0 small">Pollos trozados</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100 text-center">
            <div className="card-body py-3 px-2">
              <i className="bi bi-graph-up fs-2 text-success"></i>
              <h3 className="mt-1 mb-0 fs-4">{formatNum(resumen.totalKg)}</h3>
              <p className="text-muted mb-0 small">Kg totales</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm h-100 text-center">
            <div className="card-body py-3 px-2">
              <i className="bi bi-box-seam fs-2 text-primary"></i>
              <h3 className="mt-1 mb-0 fs-4">{formatNum(resumen.cajonesDisponibles)}</h3>
              <p className="text-muted mb-0 small">Cajones</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cajones por calibre (total) ── */}
      {resumen.porCalibre && resumen.porCalibre.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-2">
            <h6 className="mb-0">
              <i className="bi bi-box-seam me-2 text-primary"></i>
              Cajones disponibles por calibre (total)
            </h6>
          </div>
          <div className="card-body pb-2">
            <div className="row g-2">
              {resumen.porCalibre.map((c) => (
                <div key={c.calibre} className="col-6 col-sm-4 col-md-3 col-lg-2">
                  <div className="card border text-center h-100">
                    <div className="card-body py-2 px-1">
                      <span className="badge bg-primary mb-1">Cal. {c.calibre}</span>
                      <div className="fs-5 fw-bold">{formatNum(c.cajones)}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>cajones</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                        {formatNum(c.pollos)} pollos
                      </div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                        {formatNum(c.cajones * 20)} kg
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Stock por cámara ── */}
      {(totalCañeteKg > 0 || totalTrigotucKg > 0) && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white py-2">
                <h6 className="mb-0">
                  <i className="bi bi-snow me-2 text-info"></i>
                  Cámara Cañete
                </h6>
              </div>
              <div className="card-body py-2">
                {(resumen.stockCañete || []).length === 0 ? (
                  <p className="text-muted small mb-0">Sin stock</p>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {(resumen.stockCañete || []).map((c) => (
                      <div key={c.calibre} className="text-center border rounded px-2 py-1">
                        <span className="badge bg-info text-dark d-block mb-1">Cal. {c.calibre}</span>
                        <div className="fw-bold small">{formatNum(c.cajones)} caj</div>
                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(c.cajones * 20)} kg</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-muted small">
                  Total: <strong>{formatNum(totalCañeteKg)} kg</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white py-2">
                <h6 className="mb-0">
                  <i className="bi bi-snow2 me-2 text-primary"></i>
                  Cámara Trigotuc
                </h6>
              </div>
              <div className="card-body py-2">
                {(resumen.stockTrigotuc || []).length === 0 ? (
                  <p className="text-muted small mb-0">Sin stock</p>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {(resumen.stockTrigotuc || []).map((c) => (
                      <div key={c.calibre} className="text-center border rounded px-2 py-1">
                        <span className="badge bg-primary d-block mb-1">Cal. {c.calibre}</span>
                        <div className="fw-bold small">{formatNum(c.cajones)} caj</div>
                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>{formatNum(c.cajones * 20)} kg</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-muted small">
                  Total: <strong>{formatNum(totalTrigotucKg)} kg</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Lotes activos ── */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-2">
          <h6 className="mb-0">Lotes activos</h6>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : lotes.length === 0 ? (
            <p className="text-center text-muted p-4">No hay lotes activos.</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="d-md-none p-3">
                {lotes.map((lote) => {
                  const totalCajones = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
                  const pctDecom = lote.unidadesFaenadas > 0 ? Math.round(lote.unidadesDecomisadas / lote.unidadesFaenadas * 10000) / 100 : null;
                  const pctTroz  = lote.unidadesFaenadas > 0 ? Math.round(lote.unidadesTrozadas  / lote.unidadesFaenadas * 10000) / 100 : null;
                  return (
                    <div key={lote._id} className="card border mb-3">
                      {/* Cabecera */}
                      <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                        <div>
                          {lote.numeroLote && <span className="badge bg-dark me-2">#{lote.numeroLote}</span>}
                          <span className="fw-semibold small">{new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}</span>
                        </div>
                        <div className="d-flex gap-1">
                          <button className="btn btn-outline-secondary btn-sm" title="Imprimir" onClick={() => imprimirLote(lote)}>
                            <i className="bi bi-printer"></i>
                          </button>
                          <button className="btn btn-outline-success btn-sm" title="Exportar Excel" onClick={() => exportarLoteExcel(lote)}>
                            <i className="bi bi-file-earmark-excel"></i>
                          </button>
                          {esAdmin && (
                            <button className="btn btn-outline-danger btn-sm" title="Eliminar" onClick={() => handleEliminarLote(lote)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="card-body py-2 px-3">
                        {/* Stock */}
                        <div className="mb-2">
                          <div className="text-muted small fw-semibold mb-1">Stock en cámara</div>
                          <div className="d-flex flex-wrap gap-1 mb-1">
                            {(lote.calibres || []).map((c) => (
                              <span key={c.calibre} className="badge bg-primary">Cal.{c.calibre}: {formatNum(c.cajones)} caj</span>
                            ))}
                          </div>
                          <div className="text-muted small">
                            <strong className="text-dark">{formatNum(totalCajones)}</strong> cajones ·{" "}
                            <strong className="text-dark">{formatNum(lote.pesoTotal)}</strong> kg
                            {lote.pesoPromedio > 0 && <> · {formatNum(lote.pesoPromedio)} kg/pollo</>}
                          </div>
                        </div>
                        {/* Faena */}
                        {lote.kgVivos > 0 && (
                          <div className="border-top pt-2 small">
                            <div className="text-muted fw-semibold mb-2" style={{fontSize:"0.7rem",textTransform:"uppercase",letterSpacing:"0.05em"}}>Datos de faena</div>
                            <div className="mb-2 text-muted">
                              <strong className="text-dark">{formatNum(lote.kgVivos)} kg</strong> vivos
                              {lote.unidadesFaenadas > 0 && (
                                <span className="ms-2">· {formatNum(Math.round(lote.kgVivos / lote.unidadesFaenadas * 1000) / 1000)} kg/u</span>
                              )}
                            </div>
                            {lote.unidadesDecomisadas > 0 && (
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="badge bg-danger" style={{minWidth:80}}>Decomisados</span>
                                <span className="text-muted">{formatNum(lote.unidadesDecomisadas)} unidades{lote.kgDecomisados > 0 && ` · ${formatNum(lote.kgDecomisados)} kg`}</span>
                                {pctDecom !== null && <span className="ms-auto fw-semibold text-muted">{pctDecom}%</span>}
                              </div>
                            )}
                            {lote.unidadesTrozadas > 0 && (
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-warning text-dark" style={{minWidth:80}}>Trozados</span>
                                <span className="text-muted">{formatNum(lote.unidadesTrozadas)} unidades{lote.kgTrozados > 0 && ` · ${formatNum(lote.kgTrozados)} kg`}</span>
                                {pctTroz !== null && <span className="ms-auto fw-semibold text-muted">{pctTroz}%</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: tabla */}
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Lote</th>
                      <th>Stock en cámara</th>
                      <th>Datos de faena</th>
                      <th className="text-end">Rendimiento</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map((lote) => {
                      const totalCajones = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
                      const pctDecom = lote.unidadesFaenadas > 0 ? Math.round(lote.unidadesDecomisadas / lote.unidadesFaenadas * 10000) / 100 : null;
                      const pctTroz  = lote.unidadesFaenadas > 0 ? Math.round(lote.unidadesTrozadas  / lote.unidadesFaenadas * 10000) / 100 : null;
                      return (
                        <tr key={lote._id}>
                          {/* Lote */}
                          <td>
                            {lote.numeroLote
                              ? <span className="badge bg-dark d-block mb-1">#{lote.numeroLote}</span>
                              : null}
                            <div className="small text-muted">{new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}</div>
                          </td>

                          {/* Stock */}
                          <td>
                            <div className="d-flex flex-wrap gap-1 mb-1">
                              {(lote.calibres || []).map((c) => (
                                <span key={c.calibre} className="badge bg-primary">
                                  Cal.{c.calibre}: {formatNum(c.cajones)} caj
                                </span>
                              ))}
                            </div>
                            <div className="small text-muted">
                              <strong className="text-dark">{formatNum(totalCajones)}</strong> caj ·{" "}
                              <strong className="text-dark">{formatNum(lote.pesoTotal)}</strong> kg
                              {lote.pesoPromedio > 0 && <> · {formatNum(lote.pesoPromedio)} kg/pollo</>}
                            </div>
                          </td>

                          {/* Faena */}
                          <td>
                            {lote.kgVivos > 0 ? (
                              <div className="small">
                                <div className="d-flex align-items-center gap-2 mb-1">
                                  <span className="badge bg-success" style={{minWidth:80}}>Vivos</span>
                                  <span className="text-muted">
                                    {formatNum(lote.kgVivos)} kg
                                    {lote.unidadesFaenadas > 0 && ` · ${formatNum(Math.round(lote.kgVivos / lote.unidadesFaenadas * 1000) / 1000)} kg/u`}
                                  </span>
                                </div>
                                {lote.unidadesDecomisadas > 0 && (
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className="badge bg-danger" style={{minWidth:80}}>Decomisados</span>
                                    <span className="text-muted">{formatNum(lote.unidadesDecomisadas)} unidades{lote.kgDecomisados > 0 && ` · ${formatNum(lote.kgDecomisados)} kg`}</span>
                                    {pctDecom !== null && <span className="ms-auto fw-semibold text-muted">{pctDecom}%</span>}
                                  </div>
                                )}
                                {lote.unidadesTrozadas > 0 && (
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-warning text-dark" style={{minWidth:80}}>Trozados</span>
                                    <span className="text-muted">{formatNum(lote.unidadesTrozadas)} unidades{lote.kgTrozados > 0 && ` · ${formatNum(lote.kgTrozados)} kg`}</span>
                                    {pctTroz !== null && <span className="ms-auto fw-semibold text-muted">{pctTroz}%</span>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>

                          {/* Rendimiento */}
                          <td className="text-end">
                            {lote.rendimientoFaena != null ? (
                              <span className="badge bg-success fs-6">{formatNum(lote.rendimientoFaena)}%</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="text-end">
                            <div className="d-flex gap-1 justify-content-end">
                              <button className="btn btn-outline-secondary btn-sm" title="Imprimir" onClick={() => imprimirLote(lote)}>
                                <i className="bi bi-printer"></i>
                              </button>
                              <button className="btn btn-outline-success btn-sm" title="Exportar Excel" onClick={() => exportarLoteExcel(lote)}>
                                <i className="bi bi-file-earmark-excel"></i>
                              </button>
                              {esAdmin && (
                                <button className="btn btn-outline-danger btn-sm" title="Eliminar" onClick={() => handleEliminarLote(lote)}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
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

      {localStorage.getItem("rolUsuario") !== "frigorifico" && (
        <p className="text-muted mt-2 small">
          <i className="bi bi-clock me-1"></i>
          Se actualiza automáticamente cada 30 segundos.
        </p>
      )}
      </div>
    </Layout>
  );
};

export default GranjaDashboardPage;
