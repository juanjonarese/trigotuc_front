import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from "recharts";
import Layout from "../../components/Layout";
import { obtenerFechaHoy } from "../../utils/dateUtils";
import { obtenerDashboardForratuc } from "../../services/api";
import { colorEmpresa } from "../../utils/empresas";

/**
 * Inicio de Forratuc = dashboard de VENTAS (2026-11-16, pedido del usuario:
 * reemplaza las tarjetas de acceso que había). Todo viene del back
 * (`GET /presupuestos-forratuc/dashboard`): los presupuestos emitidos del
 * período y la cobranza, los mismos números que el cierre de caja.
 *
 * Colores: los de la paleta validada (dataviz) — contado y cuenta corriente son
 * las dos series; los gráficos de una sola serie van en el primer color.
 */
const SERIE_1 = "#2a78d6"; // contado / serie única
const SERIE_2 = "#eb6834"; // cuenta corriente
const GRILLA = "#e9ecef";
const TEXTO_EJE = "#6c757d";

const pesos = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(n || 0));
const num = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(Number(n || 0));
// Para los ejes: $ 1,2 M / $ 350 mil.
const pesosCorto = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return `$ ${num(v / 1e6)} M`;
  if (Math.abs(v) >= 1e3) return `$ ${num(v / 1e3)} mil`;
  return `$ ${num(v)}`;
};

// Los períodos de un clic, en días de Argentina ("AAAA-MM-DD").
const sumarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const periodos = () => {
  const hoy = obtenerFechaHoy();
  const [a, m] = hoy.split("-").map(Number);
  const primero = `${hoy.slice(0, 7)}-01`;
  const antIni = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
  const antFin = sumarDias(primero, -1);
  return {
    hoy: { etiqueta: "Hoy", desde: hoy, hasta: hoy },
    semana: { etiqueta: "Últimos 7 días", desde: sumarDias(hoy, -6), hasta: hoy },
    mes: { etiqueta: "Este mes", desde: primero, hasta: hoy },
    anterior: { etiqueta: "Mes anterior", desde: antIni, hasta: antFin },
  };
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiquetaFecha = (f, agrupado) =>
  agrupado === "mes" ? `${MESES[Number(f.slice(5, 7)) - 1]} ${f.slice(2, 4)}` : `${f.slice(8, 10)}/${f.slice(5, 7)}`;

// Un número clave.
const Tile = ({ titulo, valor, sub }) => (
  <div className="col-6 col-md-4 col-xl-2">
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body py-3">
        <div className="text-muted small mb-1">{titulo}</div>
        <div className="fs-4 fw-bold text-dark">{valor}</div>
        {sub && <div className="text-muted" style={{ fontSize: "0.75rem" }}>{sub}</div>}
      </div>
    </div>
  </div>
);

const Panel = ({ titulo, children, vacio }) => (
  <div className="card border-0 shadow-sm h-100">
    <div className="card-header bg-white border-0 pt-3 pb-0">
      <h6 className="mb-0 fw-semibold">{titulo}</h6>
    </div>
    <div className="card-body">
      {vacio ? <div className="text-muted small text-center py-5">Sin ventas en este período.</div> : children}
    </div>
  </div>
);

// Tooltip con el total del día y cada parte.
const TooltipDia = ({ active, payload, label, agrupado }) => {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  return (
    <div className="bg-white border rounded shadow-sm px-3 py-2 small">
      <div className="fw-semibold mb-1">{etiquetaFecha(label, agrupado)}</div>
      <div><span style={{ color: SERIE_1 }}>■</span> Contado: {pesos(f.contado)}</div>
      <div><span style={{ color: SERIE_2 }}>■</span> Cuenta corriente: {pesos(f.cuentaCorriente)}</div>
      <div className="border-top mt-1 pt-1 fw-semibold">Total: {pesos(f.contado + f.cuentaCorriente)} · {f.cantidad} presup.</div>
    </div>
  );
};
const TooltipSimple = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  return (
    <div className="bg-white border rounded shadow-sm px-3 py-2 small">
      <div className="fw-semibold">{label}</div>
      <div>{pesos(payload[0].value)}{f.cantidad != null ? ` · ${num(f.cantidad)} ${f.unidadTooltip || ""}` : ""}</div>
    </div>
  );
};

// Barras horizontales de una serie, con el importe al final de cada una.
const BarrasH = ({ datos, campo }) => (
  <ResponsiveContainer width="100%" height={Math.max(140, datos.length * 44)}>
    <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 90, bottom: 0, left: 0 }}>
      <CartesianGrid horizontal={false} stroke={GRILLA} />
      <XAxis type="number" tickFormatter={pesosCorto} tick={{ fill: TEXTO_EJE, fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis type="category" dataKey={campo} width={120} tick={{ fill: "#212529", fontSize: 12 }} axisLine={false} tickLine={false} />
      <Tooltip content={<TooltipSimple />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
      <Bar dataKey="importe" fill={SERIE_1} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
        <LabelList dataKey="importe" position="right" formatter={pesos} style={{ fill: "#212529", fontSize: 12 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

const ForratucInicioPage = () => {
  const [periodo, setPeriodo] = useState("mes");
  const [desde, setDesde] = useState(periodos().mes.desde);
  const [hasta, setHasta] = useState(periodos().mes.hasta);
  // Los datos y de qué período son: "cargando" = los que hay no son los del período elegido.
  const [cargado, setCargado] = useState({ clave: null, datos: null });
  const clave = `${desde}|${hasta}`;
  const datos = cargado.datos;
  const loading = cargado.clave !== clave;

  const elegir = (clave) => {
    setPeriodo(clave);
    if (clave !== "otro") {
      const p = periodos()[clave];
      setDesde(p.desde);
      setHasta(p.hasta);
    }
  };

  useEffect(() => {
    if (!desde || !hasta || desde > hasta) return;
    let vigente = true;
    obtenerDashboardForratuc({ desde, hasta })
      .then((d) => vigente && setCargado({ clave: `${desde}|${hasta}`, datos: d }))
      .catch((err) => {
        if (!vigente) return;
        setCargado((c) => ({ ...c, clave: `${desde}|${hasta}` }));
        Swal.fire("Error", err.message || "No se pudo cargar el tablero.", "error");
      });
    return () => { vigente = false; };
  }, [desde, hasta]);

  const t = datos?.totales;
  const sinVentas = !t?.presupuestos;
  const PERIODOS = periodos();

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h1 className="h3 mb-0">
            <i className="bi bi-graph-up-arrow me-2" style={{ color: colorEmpresa("forratuc") }}></i>
            Ventas
          </h1>
          {loading && <span className="spinner-border spinner-border-sm text-secondary ms-2" role="status"></span>}
        </div>

        {/* ── Período: los filtros, en una fila arriba de todo ── */}
        <div className="d-flex flex-wrap align-items-end gap-2 mb-4">
          <div className="btn-group btn-group-sm flex-wrap">
            {Object.entries(PERIODOS).map(([k, p]) => (
              <button key={k} type="button" className={`btn ${periodo === k ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => elegir(k)}>
                {p.etiqueta}
              </button>
            ))}
            <button type="button" className={`btn ${periodo === "otro" ? "btn-dark" : "btn-outline-secondary"}`} onClick={() => elegir("otro")}>
              Otro…
            </button>
          </div>
          {periodo === "otro" && (
            <>
              <input type="date" className="form-control form-control-sm" style={{ width: "auto" }} value={desde} max={hasta}
                onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
              <span className="small text-muted pb-1">a</span>
              <input type="date" className="form-control form-control-sm" style={{ width: "auto" }} value={hasta} min={desde}
                onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
            </>
          )}
        </div>

        {datos && (
          <>
            {/* ── Números clave ── */}
            <div className="row g-3 mb-3">
              <Tile titulo="Ventas" valor={pesos(t.ventas)} sub={`${pesos(t.contado)} contado`} />
              <Tile titulo="Presupuestos" valor={num(t.presupuestos)} sub="emitidos (sin anulados)" />
              <Tile titulo="Ticket promedio" valor={pesos(t.ticketPromedio)} />
              <Tile titulo="A cuenta corriente" valor={pesos(t.cuentaCorriente)} sub="vendido en el período" />
              <Tile titulo="Cobranza" valor={pesos(t.cobranza)} sub="pagos de cuenta corriente" />
              <Tile titulo="Deuda de clientes" valor={pesos(t.deudaCuentasCorrientes)} sub={`hoy · ${t.clientesConDeuda} ${t.clientesConDeuda === 1 ? "cliente" : "clientes"}`} />
            </div>

            {/* ── Ventas por día (o por mes) ── */}
            <div className="mb-3">
              <Panel titulo={datos.agrupado === "mes" ? "Ventas por mes" : "Ventas por día"} vacio={sinVentas}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={datos.porFecha} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                    <CartesianGrid vertical={false} stroke={GRILLA} />
                    <XAxis dataKey="fecha" tickFormatter={(f) => etiquetaFecha(f, datos.agrupado)}
                      tick={{ fill: TEXTO_EJE, fontSize: 11 }} axisLine={{ stroke: GRILLA }} tickLine={false} minTickGap={8} />
                    <YAxis tickFormatter={pesosCorto} tick={{ fill: TEXTO_EJE, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={<TooltipDia agrupado={datos.agrupado} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                    <Legend verticalAlign="top" align="right" iconType="square" height={28}
                      formatter={(v) => <span className="small text-dark">{v}</span>} />
                    <Bar dataKey="contado" name="Contado" stackId="v" fill={SERIE_1} stroke="#fff" strokeWidth={1} maxBarSize={28} isAnimationActive={false} />
                    <Bar dataKey="cuentaCorriente" name="Cuenta corriente" stackId="v" fill={SERIE_2} stroke="#fff" strokeWidth={1}
                      radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>

            {/* ── Por rubro y por forma de pago ── */}
            <div className="row g-3 mb-3">
              <div className="col-12 col-lg-6">
                <Panel titulo="Por rubro" vacio={sinVentas}>
                  <BarrasH datos={datos.porRubro} campo="rubro" />
                </Panel>
              </div>
              <div className="col-12 col-lg-6">
                <Panel titulo="Por forma de pago" vacio={sinVentas}>
                  <BarrasH datos={datos.porFormaPago.map((f) => ({ ...f, unidadTooltip: "presup." }))} campo="forma" />
                </Panel>
              </div>
            </div>

            {/* ── Alimento por categoría ── */}
            <div className="mb-3">
              <Panel titulo="Alimento por categoría" vacio={!datos.porCategoriaAlimento.length}>
                <BarrasH datos={datos.porCategoriaAlimento.map((c) => ({ ...c, unidadTooltip: "bolsas" }))} campo="categoria" />
              </Panel>
            </div>

            {/* ── Lo más vendido y los que más compran ── */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-xl-7">
                <Panel titulo="Productos más vendidos" vacio={sinVentas}>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>Código</th><th>Producto</th><th>Rubro</th><th className="text-end">Cantidad</th><th className="text-end">Importe</th></tr>
                      </thead>
                      <tbody>
                        {datos.topProductos.map((p, i) => (
                          <tr key={i}>
                            <td className="text-muted small">{p.codigo}</td>
                            <td>{p.nombre}</td>
                            <td className="small text-muted">{p.rubro}</td>
                            <td className="text-end text-nowrap">{num(p.cantidad)} {p.unidad}</td>
                            <td className="text-end fw-semibold text-nowrap">{pesos(p.importe)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
              <div className="col-12 col-xl-5">
                <Panel titulo="Clientes que más compraron" vacio={sinVentas}>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>Cliente</th><th className="text-end">Presup.</th><th className="text-end">Importe</th></tr>
                      </thead>
                      <tbody>
                        {datos.topClientes.map((c, i) => (
                          <tr key={i}>
                            <td>
                              {c.nombre}
                              {c.consumidorFinal && <span className="badge bg-light text-secondary border ms-1">cons. final</span>}
                            </td>
                            <td className="text-end">{c.cantidad}</td>
                            <td className="text-end fw-semibold text-nowrap">{pesos(c.importe)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ForratucInicioPage;
