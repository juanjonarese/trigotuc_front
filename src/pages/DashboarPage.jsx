import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../css/DashboardPage.css";
import {
  obtenerResumenStock,
  obtenerLotesGranja,
  obtenerLotes,
  obtenerOrdenesRetiro,
} from "../services/api";
import Layout from "../components/Layout";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

const fmtNum  = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n ?? 0);
const fmtPct  = (n) => (n != null ? `${Number(n).toFixed(1)}%` : "—");
const granjaLabel = (g) => g === "cañete" ? "Cañete" : "Los Pinos";

const KpiCard = ({ icon, label, value, sub, color = "text-dark", onClick }) => (
  <div className={`card border-0 shadow-sm h-100 ${onClick ? "cursor-pointer" : ""}`}
    style={{ borderTop: `3px solid var(--bs-${color.replace("text-", "")}, #198754)` }}
    onClick={onClick}>
    <div className="card-body py-3">
      <div className="d-flex align-items-center gap-2 mb-1">
        <i className={`bi bi-${icon} fs-5 ${color}`}></i>
        <span className="text-muted small text-uppercase fw-semibold" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div className={`fw-bold fs-4 ${color}`}>{value}</div>
      {sub && <div className="text-muted small mt-1">{sub}</div>}
    </div>
  </div>
);

const SectionTitle = ({ icon, title, color }) => (
  <div className="d-flex align-items-center gap-2 mb-3">
    <i className={`bi bi-${icon} fs-5 ${color}`}></i>
    <h5 className="mb-0 fw-semibold">{title}</h5>
  </div>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [stockGranja, setStockGranja] = useState(null);
  const [lotesGranja, setLotesGranja] = useState([]);
  const [lotesFaena, setLotesFaena]   = useState([]);
  const [retiroPendiente, setRetiroPendiente] = useState([]);

  useEffect(() => {
    const rol = localStorage.getItem("rolUsuario");
    if (rol === "frigorifico") { navigate("/frigorifico/lotes/nuevo"); return; }
    if (rol === "chofer") { navigate("/chofer"); return; }
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [resStock, resGranja, resFaena, resRetiro] = await Promise.all([
        obtenerResumenStock().catch(() => null),
        obtenerLotesGranja({ estado: "en_crianza" }).catch(() => []),
        obtenerLotes().catch(() => []),
        obtenerOrdenesRetiro({ status: "pendiente" }).catch(() => []),
      ]);
      setStockGranja(resStock);
      setLotesGranja(Array.isArray(resGranja) ? resGranja : []);
      setLotesFaena(Array.isArray(resFaena) ? resFaena : []);
      setRetiroPendiente(Array.isArray(resRetiro) ? resRetiro : []);
      setError("");
    } catch {
      setError("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ── Cálculos granja ────────────────────────────────────────────────────────
  const totalPollosGranja = lotesGranja.reduce((a, l) => a + (l.cantidadActual || 0), 0);
  const galponesPorGranja = lotesGranja.reduce((map, l) => {
    const key = l.granja;
    if (!map[key]) map[key] = 0;
    map[key]++;
    return map;
  }, {});
  const galonesConStats = lotesGranja
    .slice()
    .sort((a, b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso))
    .map((l) => {
      const dias         = Math.floor((Date.now() - new Date(l.fechaIngreso)) / 86400000);
      const mortTotal    = (l.bajasIngreso || 0) + (l.mortandad || []).reduce((s, m) => s + m.cantidad, 0);
      const pctMort      = l.cantidadIngreso > 0 ? (mortTotal / l.cantidadIngreso * 100) : 0;
      const ultimoPesaje = l.pesajes?.length ? l.pesajes[l.pesajes.length - 1] : null;
      const pesoGr       = ultimoPesaje?.pesoPromedio ?? null;
      return { ...l, dias, mortTotal, pctMort, pesoGr };
    });

  const totalIngresadosGranja   = lotesGranja.reduce((a, l) => a + (l.cantidadIngreso || 0), 0);
  const totalMortandadGranja    = galonesConStats.reduce((a, l) => a + l.mortTotal, 0);
  const pctMortGlobal           = totalIngresadosGranja > 0 ? (totalMortandadGranja / totalIngresadosGranja * 100) : 0;

  // ── Cálculos faena ─────────────────────────────────────────────────────────
  const lotesFaenaConDatos = lotesFaena
    .filter((l) => l.unidadesFaenadas > 0)
    .slice(0, 10);

  const promRendimiento = (() => {
    const c = lotesFaenaConDatos.filter((l) => l.rendimientoFaena != null);
    return c.length ? c.reduce((a, l) => a + l.rendimientoFaena, 0) / c.length : null;
  })();
  const promDecomisados = (() => {
    const c = lotesFaenaConDatos.filter((l) => l.unidadesDecomisadas > 0);
    return c.length ? c.reduce((a, l) => a + (l.unidadesDecomisadas / l.unidadesFaenadas * 100), 0) / c.length : null;
  })();
  const promMuertos = (() => {
    const c = lotesFaenaConDatos.filter((l) => l.muertos > 0);
    return c.length ? c.reduce((a, l) => a + (l.muertos / l.unidadesFaenadas * 100), 0) / c.length : null;
  })();

  const ultimosFaena = lotesFaena.slice(0, 5);

  // ── Gráfico stock por calibre ──────────────────────────────────────────────
  const dataBarStock = (() => {
    if (!stockGranja) return [];
    const calibres = new Set([
      ...(stockGranja.stockCañete   || []).map((c) => c.calibre),
      ...(stockGranja.stockTrigotuc || []).map((c) => c.calibre),
    ]);
    const mCañete   = Object.fromEntries((stockGranja.stockCañete   || []).map((c) => [c.calibre, c.cajones]));
    const mTrigotuc = Object.fromEntries((stockGranja.stockTrigotuc || []).map((c) => [c.calibre, c.cajones]));
    return [...calibres].sort((a, b) => a - b).map((cal) => ({
      calibre: `Cal. ${cal}`,
      Cañete:   mCañete[cal]   || 0,
      Trigotuc: mTrigotuc[cal] || 0,
    }));
  })();

  const trozadosStock = (() => {
    if (!stockGranja) return [];
    const map = {};
    for (const t of [...(stockGranja.trozadosCañete || []), ...(stockGranja.trozadosTrigotuc || [])]) {
      if (!map[t.tipo]) map[t.tipo] = { tipo: t.tipo, cajas: 0, kgTotal: 0 };
      map[t.tipo].cajas   += t.cajas || 0;
      map[t.tipo].kgTotal += t.kgTotal || 0;
    }
    return Object.values(map);
  })();

  if (loading) return (
    <Layout>
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <div className="spinner-border text-success" style={{ width: "3rem", height: "3rem" }}></div>
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="container-fluid">
        <div className="alert alert-danger"><i className="bi bi-exclamation-triangle me-2"></i>{error}</div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="container-fluid">

        {/* Header */}
        <div className="mb-4">
          <h1 className="h3 mb-0"><i className="bi bi-speedometer2 me-2"></i>Dashboard</h1>
          <p className="text-muted mb-0 small">Resumen general — Granja y Frigorifico</p>
        </div>

        {/* ── KPIs ── */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <KpiCard icon="egg-fried" label="Pollos en crianza" value={fmtNum(totalPollosGranja)}
              sub={`${lotesGranja.length} galpón${lotesGranja.length !== 1 ? "es" : ""} activo${lotesGranja.length !== 1 ? "s" : ""}`}
              color="text-success" onClick={() => navigate("/granja/lotes")} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="snow" label="Cajones en cámara" value={fmtNum(stockGranja?.cajonesDisponibles ?? 0)}
              sub={`${fmtNum(stockGranja?.totalKg ?? 0)} kg`}
              color="text-primary" onClick={() => navigate("/frigorifico/stock")} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="box-arrow-right" label="Entregas pendientes" value={retiroPendiente.length}
              sub="órdenes de retiro"
              color={retiroPendiente.length > 0 ? "text-warning" : "text-secondary"}
              onClick={() => navigate("/frigorifico/entregas")} />
          </div>
        </div>

        {/* ══ GRANJA ══ */}
        <div className="mb-4">
          <SectionTitle icon="house-heart-fill" title="Granja — Crianza activa" color="text-success" />
          {lotesGranja.length === 0 ? (
            <div className="alert alert-light text-muted small">No hay galpones en crianza.</div>
          ) : (
            <div className="row g-3">

              {/* Tabla galpones */}
              <div className="col-12 col-xl-8">
                <div className="card border-0 shadow-sm">
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.875rem" }}>
                        <thead className="table-light">
                          <tr>
                            <th>Granja / Galpón</th>
                            <th className="text-end">Pollos actuales</th>
                            <th className="text-end">Días crianza</th>
                            <th className="text-end">Último peso</th>
                            <th className="text-end">Mortandad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {galonesConStats.map((l) => (
                            <tr key={l._id}>
                              <td>
                                <span className={`badge me-1 ${l.granja === "cañete" ? "bg-success" : "bg-info text-dark"}`}>
                                  {granjaLabel(l.granja)}
                                </span>
                                <span className="fw-semibold">G{l.galpon}</span>
                                {l.numeroLote && <span className="text-muted ms-1 small">#{l.numeroLote}</span>}
                              </td>
                              <td className="text-end fw-semibold">{fmtNum(l.cantidadActual)}</td>
                              <td className="text-end text-muted">{l.dias} d</td>
                              <td className="text-end">
                                {l.pesoGr
                                  ? <span className="fw-semibold">{(l.pesoGr / 1000).toFixed(3)} kg</span>
                                  : <span className="text-muted">—</span>}
                              </td>
                              <td className="text-end">
                                {l.mortTotal > 0
                                  ? <span className={`fw-semibold ${l.pctMort > 3 ? "text-danger" : l.pctMort > 1.5 ? "text-warning" : "text-success"}`}>
                                      {l.mortTotal} ({fmtPct(l.pctMort)})
                                    </span>
                                  : <span className="text-success">0</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats granja */}
              <div className="col-12 col-xl-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                      Resumen crianza
                    </h6>
                    <div className="d-flex flex-column gap-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Pollos ingresados</span>
                        <span className="fw-bold">{fmtNum(totalIngresadosGranja)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Pollos actuales</span>
                        <span className="fw-bold text-success">{fmtNum(totalPollosGranja)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Mortandad total</span>
                        <span className={`fw-bold ${pctMortGlobal > 3 ? "text-danger" : pctMortGlobal > 1.5 ? "text-warning" : "text-success"}`}>
                          {fmtNum(totalMortandadGranja)} ({fmtPct(pctMortGlobal)})
                        </span>
                      </div>
                      <hr className="my-1" />
                      {Object.entries(galponesPorGranja).map(([granja, count]) => (
                        <div key={granja} className="d-flex justify-content-between align-items-center">
                          <span className="text-muted small">{granjaLabel(granja)}</span>
                          <span className="fw-semibold">{count} galpón{count !== 1 ? "es" : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ══ FRIGORIFICO ══ */}
        <div className="mb-4">
          <SectionTitle icon="snow-fill" title="Frigorifico — Stock y faena" color="text-primary" />
          <div className="row g-3">

            {/* Stock por calibre — bar chart */}
            <div className="col-12 col-lg-7">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="text-muted text-uppercase fw-semibold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                    Stock por calibre y cámara
                  </h6>
                  {dataBarStock.length === 0 ? (
                    <p className="text-muted small mt-3">Sin stock en cámara.</p>
                  ) : (
                    <>
                      <div className="row g-0 text-center mb-3 mt-2 pb-2" style={{ borderBottom: "1px solid #e9ecef" }}>
                        <div className="col border-end">
                          <div className="text-muted" style={{ fontSize: "0.65rem" }}>Cajones totales</div>
                          <div className="fw-bold text-primary fs-5">{fmtNum(stockGranja?.cajonesDisponibles)}</div>
                        </div>
                        <div className="col border-end">
                          <div className="text-muted" style={{ fontSize: "0.65rem" }}>Kg totales</div>
                          <div className="fw-bold fs-5">{fmtNum(stockGranja?.totalKg)}</div>
                        </div>
                        <div className="col">
                          <div className="text-muted" style={{ fontSize: "0.65rem" }}>Pollos</div>
                          <div className="fw-bold fs-5">{fmtNum(stockGranja?.totalPollosVivos)}</div>
                        </div>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={dataBarStock} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="calibre" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v, n) => [`${fmtNum(v)} caj`, n]} contentStyle={{ fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Cañete"   fill="#0dcaf0" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Trigotuc" fill="#0d6efd" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      {trozadosStock.length > 0 && (
                        <div className="mt-3">
                          <div className="text-muted text-uppercase fw-semibold mb-2" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                            <i className="bi bi-scissors me-1"></i>Trozados en stock
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            {trozadosStock.map((t) => (
                              <div key={t.tipo} className="rounded px-2 py-1 text-center"
                                style={{ background: "#fffbeb", border: "1px solid #fde68a", minWidth: 70 }}>
                                <div className="fw-bold" style={{ fontSize: "0.75rem", color: "#b45309" }}>
                                  {t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)}
                                </div>
                                <div className="fw-semibold small">{fmtNum(t.cajas)} caj</div>
                                <div className="text-muted" style={{ fontSize: "0.65rem" }}>{fmtNum(t.kgTotal)} kg</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Stats de faena */}
            <div className="col-12 col-lg-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="text-muted text-uppercase fw-semibold mb-3" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                    Promedios últimas 10 faenas
                  </h6>
                  <div className="d-flex flex-column gap-3 mb-4">
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted small"><i className="bi bi-graph-up-arrow me-1 text-success"></i>Rendimiento prom.</span>
                      <span className="fw-bold text-success fs-5">{promRendimiento != null ? fmtPct(promRendimiento) : "—"}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted small"><i className="bi bi-x-circle me-1 text-danger"></i>Decomisados prom.</span>
                      <span className={`fw-bold ${promDecomisados != null && promDecomisados > 2 ? "text-danger" : "text-secondary"}`}>
                        {promDecomisados != null ? fmtPct(promDecomisados) : "—"}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-muted small"><i className="bi bi-heartbreak me-1 text-secondary"></i>Muertos prom.</span>
                      <span className="fw-bold text-secondary">
                        {promMuertos != null ? fmtPct(promMuertos) : "—"}
                      </span>
                    </div>
                  </div>

                  <h6 className="text-muted text-uppercase fw-semibold mb-2" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                    Últimos lotes
                  </h6>
                  {ultimosFaena.length === 0 ? (
                    <p className="text-muted small">Sin lotes registrados.</p>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {ultimosFaena.map((l) => {
                        const totalCaj = (l.calibres || []).reduce((a, c) => a + c.cajones, 0);
                        return (
                          <div key={l._id} className="d-flex justify-content-between align-items-center py-1 px-2 rounded"
                            style={{ background: "#f8fafc", border: "1px solid #e9ecef" }}>
                            <div>
                              <span className="badge bg-dark me-1">#{l.numeroLote}</span>
                              <span className="text-muted small">{new Date(l.fechaIngreso).toLocaleDateString("es-AR")}</span>
                            </div>
                            <div className="d-flex gap-2 align-items-center small">
                              <span className="fw-semibold">{fmtNum(totalCaj)} caj</span>
                              {l.rendimientoFaena != null && (
                                <span className="text-success fw-semibold">{fmtPct(l.rendimientoFaena)}</span>
                              )}
                              <span className={`badge ${l.estado === "activo" ? "bg-success" : "bg-secondary"}`} style={{ fontSize: "0.6rem" }}>
                                {l.estado === "activo" ? "Activo" : "Cerrado"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>


      </div>
    </Layout>
  );
};

export default DashboardPage;
