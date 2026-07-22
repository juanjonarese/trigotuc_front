import React, { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import { obtenerLotesGranja, obtenerMovimientosGalpon } from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GRANJA_OPTS = [
  { value: "cañete",    label: "Cañete",    galpones: 6 },
  { value: "los_pinos", label: "Los Pinos", galpones: 8 },
];

const GRANJAS_LABEL = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJAS_PREFIX = { cañete: "C", los_pinos: "P" };

// Estilo por tipo de movimiento
const TIPO_META = {
  ingreso:            { label: "Ingreso",              icon: "bi-box-arrow-in-down", badge: "bg-primary" },
  ingreso_mudanza:    { label: "Ingreso (mudanza)",    icon: "bi-arrow-left-right",  badge: "bg-primary" },
  mortandad:          { label: "Mortandad",            icon: "bi-heartbreak",        badge: "bg-danger" },
  mudanza_entrada:    { label: "Mudanza (entrada)",    icon: "bi-arrow-down-left",   badge: "bg-info text-dark" },
  mudanza_salida:     { label: "Mudanza (salida)",     icon: "bi-arrow-up-right",    badge: "bg-info text-dark" },
  pedido_frigorifico: { label: "Pedido frigorífico",   icon: "bi-truck",             badge: "bg-warning text-dark" },
  venta_gordos:       { label: "Venta gordos",         icon: "bi-cash-coin",         badge: "bg-success" },
  egreso:             { label: "Egreso",               icon: "bi-box-arrow-up",      badge: "bg-secondary" },
};

const GranjaMovimientosPage = () => {
  const rolUsuario = localStorage.getItem("rolUsuario");
  const [granja, setGranja] = useState("");
  const [galpon, setGalpon] = useState("");
  const [lotesGranja, setLotesGranja] = useState([]);
  const [loteSel, setLoteSel] = useState(null);
  const [data, setData] = useState(null);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [loadingMov, setLoadingMov] = useState(false);

  // Cargar TODOS los lotes de la granja elegida (para saber qué galpones tienen stock)
  const cargarLotesGranja = useCallback(async () => {
    if (!granja) { setLotesGranja([]); return; }
    setLoadingLotes(true);
    setData(null);
    try {
      const res = await obtenerLotesGranja({ granja });
      setLotesGranja(res); // ya viene ordenado por fechaIngreso desc
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoadingLotes(false);
    }
  }, [granja]);

  useEffect(() => { cargarLotesGranja(); }, [cargarLotesGranja]);

  // Solo galpones con un lote en crianza y con pollos (>0)
  const galponesConStock = [...new Set(
    lotesGranja
      .filter((l) => l.estado === "en_crianza" && l.cantidadActual > 0)
      .map((l) => l.galpon)
  )].sort((a, b) => a - b);

  // Lotes del galpón elegido (historial completo del galpón)
  const lotes = galpon
    ? lotesGranja.filter((l) => l.galpon === Number(galpon))
    : [];

  // Al cambiar de galpón (o recargar la granja), seleccionar el lote más reciente
  useEffect(() => {
    if (!galpon) { setLoteSel(null); setData(null); return; }
    const delGalpon = lotesGranja.filter((l) => l.galpon === Number(galpon));
    setLoteSel(delGalpon.length > 0 ? delGalpon[0]._id : null);
    setData(null);
  }, [galpon, lotesGranja]);

  // Cargar movimientos del lote seleccionado
  useEffect(() => {
    if (!loteSel) { setData(null); return; }
    let activo = true;
    (async () => {
      setLoadingMov(true);
      try {
        const res = await obtenerMovimientosGalpon(loteSel);
        if (activo) setData(res);
      } catch (e) {
        if (activo) Swal.fire("Error", e.message, "error");
      } finally {
        if (activo) setLoadingMov(false);
      }
    })();
    return () => { activo = false; };
  }, [loteSel]);

  if (rolUsuario !== "superadmin") return <Navigate to="/dashboard" replace />;

  const resumen = data?.resumen;
  const cuadra = resumen && resumen.diferencia === 0;

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-clock-history me-2 text-success"></i>
            Movimientos por Galpón
          </h1>
        </div>

        {/* Selectores */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="row g-2 align-items-end">
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1 text-muted">Granja</label>
                <select
                  className="form-select form-select-sm"
                  value={granja}
                  onChange={(e) => { setGranja(e.target.value); setGalpon(""); }}
                >
                  <option value="">Elegir granja…</option>
                  {GRANJA_OPTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1 text-muted">Galpón</label>
                <select
                  className="form-select form-select-sm"
                  value={galpon}
                  onChange={(e) => setGalpon(e.target.value)}
                  disabled={!granja || galponesConStock.length === 0}
                >
                  <option value="">Elegir galpón…</option>
                  {galponesConStock.map((n) => (
                    <option key={n} value={n}>
                      {GRANJAS_PREFIX[granja]}{n}
                    </option>
                  ))}
                </select>
              </div>
              {lotes.length > 0 && (
                <div className="col-12 col-md-6">
                  <label className="form-label small mb-1 text-muted">Lote (crianza)</label>
                  <select
                    className="form-select form-select-sm"
                    value={loteSel || ""}
                    onChange={(e) => setLoteSel(e.target.value)}
                  >
                    {lotes.map((l) => (
                      <option key={l._id} value={l._id}>
                        #{l.numeroLote} · {formatearFechaLocal(l.fechaIngreso)} · {l.estado === "en_crianza" ? "En crianza" : "Finalizado"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estados vacíos / carga */}
        {!granja && (
          <p className="text-center text-muted p-4">Elegí una granja y un galpón para ver su historial.</p>
        )}
        {granja && loadingLotes && (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        )}
        {granja && !loadingLotes && galponesConStock.length === 0 && (
          <p className="text-center text-muted p-4">No hay galpones en crianza (con pollos) en esta granja.</p>
        )}
        {granja && !loadingLotes && galponesConStock.length > 0 && !galpon && (
          <p className="text-center text-muted p-4">Elegí un galpón para ver su historial.</p>
        )}

        {/* Banner de conciliación */}
        {resumen && !loadingMov && (
          <div className={`card border-0 shadow-sm mb-3 ${cuadra ? "border-start border-4 border-success" : "border-start border-4 border-danger"}`}>
            <div className="card-body">
              <div className="row g-3 text-center">
                <div className="col-4">
                  <div className="text-muted small">Saldo teórico</div>
                  <div className="h4 mb-0">{resumen.saldoTeorico.toLocaleString("es-AR")}</div>
                  <div className="text-muted small">según movimientos</div>
                </div>
                <div className="col-4">
                  <div className="text-muted small">Stock real</div>
                  <div className="h4 mb-0">{resumen.cantidadActualReal.toLocaleString("es-AR")}</div>
                  <div className="text-muted small">cantidadActual del lote</div>
                </div>
                <div className="col-4">
                  <div className="text-muted small">Diferencia</div>
                  <div className={`h4 mb-0 ${cuadra ? "text-success" : "text-danger"}`}>
                    {resumen.diferencia > 0 ? "+" : ""}{resumen.diferencia.toLocaleString("es-AR")}
                  </div>
                  <div className="text-muted small">{cuadra ? "cuadra ✓" : "descuadre ⚠"}</div>
                </div>
              </div>
              {!cuadra && (
                <div className="alert alert-warning mb-0 mt-3 small">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  El stock real no coincide con la suma de los movimientos registrados.
                  Una diferencia positiva significa que faltan movimientos de salida sin registrar
                  (ej. un ajuste manual del stock); una negativa, movimientos de entrada faltantes.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabla de movimientos */}
        {loadingMov && (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        )}
        {data && !loadingMov && (
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white">
              <span className="fw-semibold">
                {GRANJAS_LABEL[data.lote.granja]} — Galpón {GRANJAS_PREFIX[data.lote.granja]}{data.lote.galpon}
              </span>
              <span className="text-muted ms-2 small">
                Lote #{data.lote.numeroLote} · ingreso {formatearFechaLocal(data.lote.fechaIngreso)} · {data.movimientos.length} movimientos
              </span>
            </div>
            <div className="card-body p-0">
              {data.movimientos.length === 0 ? (
                <p className="text-center text-muted p-4 mb-0">Sin movimientos.</p>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="d-md-none p-3">
                    {data.movimientos.map((m, i) => {
                      const meta = TIPO_META[m.tipo] || { label: m.tipo, icon: "bi-dot", badge: "bg-secondary" };
                      return (
                        <div key={i} className="card border mb-2">
                          <div className="card-body py-2 px-3">
                            <div className="d-flex justify-content-between align-items-start">
                              <span className={`badge ${meta.badge}`}><i className={`bi ${meta.icon} me-1`}></i>{meta.label}</span>
                              <span className={`fw-semibold ${m.signo > 0 ? "text-success" : "text-danger"}`}>
                                {m.signo > 0 ? "+" : "−"}{m.cantidad.toLocaleString("es-AR")}
                              </span>
                            </div>
                            <div className="small mt-1">{m.detalle}</div>
                            <div className="d-flex justify-content-between small text-muted">
                              <span>{formatearFechaLocal(m.fecha)}{m.referencia ? ` · ${m.referencia}` : ""}</span>
                              <span>Saldo: {m.saldoAcumulado.toLocaleString("es-AR")}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop */}
                  <div className="d-none d-md-block table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th>
                          <th>Movimiento</th>
                          <th>Detalle</th>
                          <th className="text-end">Cantidad</th>
                          <th className="text-end">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.movimientos.map((m, i) => {
                          const meta = TIPO_META[m.tipo] || { label: m.tipo, icon: "bi-dot", badge: "bg-secondary" };
                          return (
                            <tr key={i}>
                              <td className="text-nowrap">{formatearFechaLocal(m.fecha)}</td>
                              <td><span className={`badge ${meta.badge}`}><i className={`bi ${meta.icon} me-1`}></i>{meta.label}</span></td>
                              <td>
                                {m.detalle}
                                {m.referencia && <span className="text-muted small ms-1">({m.referencia})</span>}
                              </td>
                              <td className={`text-end fw-semibold ${m.signo > 0 ? "text-success" : "text-danger"}`}>
                                {m.signo > 0 ? "+" : "−"}{m.cantidad.toLocaleString("es-AR")}
                              </td>
                              <td className="text-end">{m.saldoAcumulado.toLocaleString("es-AR")}</td>
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
        )}

      </div>
    </Layout>
  );
};

export default GranjaMovimientosPage;
