import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  obtenerLotesReproductores,
  obtenerRecoleccionesHuevos,
  obtenerStockGranja,
  obtenerStockHuevosDescarte,
  obtenerEstadoIncubadora,
  obtenerStockOrdenesPollitos,
  obtenerStockSilos,
  obtenerConstantesReproductores,
} from "../services/api";
import { KpiCard, SectionTitle, CardLabel } from "./DashboardUI";
import { fmtNum, fmtPct } from "../utils/formatoDashboard";

/**
 * Solapa "Reproductoras" del Dashboard: la foto del módulo en una pantalla.
 *
 *   planteles (aves, mortandad, peso, postura) → huevo en la granja → huevo en
 *   Trigotuc → incubadora / nacedora → pollitos libres, más los silos.
 *
 * Todo se lee de endpoints que ya existen; cada uno con su `.catch`, para que si
 * uno falla el resto del tablero se vea igual.
 */

const DIAS_POSTURA = 7;

const ETIQUETA_FASE = { recria: "Recría", postura: "Postura" };

// Último pesaje de un sexo, en gramos.
const ultimoPeso = (lote, sexo) => {
  const p = (lote.pesajes || []).filter((x) => x.sexo === sexo);
  return p.length ? p[p.length - 1].pesoPromedio : null;
};

const mortandadDe = (lote, sexo) =>
  (lote.mortandad || []).filter((m) => m.sexo === sexo).reduce((a, m) => a + (m.cantidad || 0), 0);

const colorMort = (pct) => (pct > 10 ? "text-danger" : pct > 5 ? "text-warning" : "text-success");
const colorPostura = (pct) => (pct >= 75 ? "text-success" : pct >= 60 ? "text-warning" : "text-danger");

const diaClave = (iso) => String(iso).split("T")[0];

const DashboardReproductoras = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_POSTURA);
    const desdeStr = desde.toISOString().split("T")[0];

    Promise.all([
      obtenerLotesReproductores({ activos: "true" }).catch(() => []),
      obtenerRecoleccionesHuevos({ desde: desdeStr }).catch(() => []),
      obtenerStockGranja().catch(() => []),
      obtenerStockHuevosDescarte().catch(() => null),
      obtenerEstadoIncubadora().catch(() => null),
      obtenerStockOrdenesPollitos().catch(() => null),
      obtenerStockSilos().catch(() => null),
      obtenerConstantesReproductores().catch(() => null),
    ]).then(([lotes, recolecciones, stockGranja, stockTrigotuc, incubadora, pollitos, silos, constantes]) => {
      setDatos({
        lotes: Array.isArray(lotes) ? lotes : [],
        recolecciones: Array.isArray(recolecciones) ? recolecciones : [],
        stockGranja: Array.isArray(stockGranja) ? stockGranja : [],
        stockTrigotuc, incubadora, pollitos, silos, constantes,
      });
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="d-flex justify-content-center py-5">
      <div className="spinner-border text-success"></div>
    </div>
  );

  const { lotes, recolecciones, stockGranja, stockTrigotuc, incubadora, pollitos, silos, constantes } = datos;

  // ── Planteles ──────────────────────────────────────────────────────────────
  // Postura de los últimos días: huevos por día cargado sobre las hembras de hoy.
  const recPorLote = {};
  for (const r of recolecciones) {
    const id = r.lote?._id || r.lote;
    if (!recPorLote[id]) recPorLote[id] = { huevos: 0, dias: new Set() };
    recPorLote[id].huevos += r.huevosTotales || 0;
    recPorLote[id].dias.add(diaClave(r.fecha));
  }

  const planteles = [...lotes]
    .sort((a, b) => (a.galpon || 0) - (b.galpon || 0))
    .map((l) => {
      const mortH = mortandadDe(l, "hembra");
      const mortM = mortandadDe(l, "macho");
      const ingreso = (l.hembras?.ingreso || 0) + (l.machos?.ingreso || 0);
      const rec = recPorLote[l._id];
      const huevosDia = rec && rec.dias.size ? rec.huevos / rec.dias.size : null;
      const postura = l.estado === "postura" && huevosDia != null && l.hembras?.actual > 0
        ? (huevosDia / l.hembras.actual) * 100
        : null;
      return {
        ...l,
        mort: mortH + mortM,
        pctMort: ingreso > 0 ? ((mortH + mortM) / ingreso) * 100 : 0,
        pesoH: ultimoPeso(l, "hembra"),
        pesoM: ultimoPeso(l, "macho"),
        huevosDia,
        postura,
      };
    });

  const hembras = lotes.reduce((a, l) => a + (l.hembras?.actual || 0), 0);
  const machos  = lotes.reduce((a, l) => a + (l.machos?.actual || 0), 0);

  const huevosSemana = recolecciones.reduce((a, r) => a + (r.huevosTotales || 0), 0);
  const diasConCarga = new Set(recolecciones.map((r) => diaClave(r.fecha))).size;
  const hembrasPostura = lotes.filter((l) => l.estado === "postura").reduce((a, l) => a + (l.hembras?.actual || 0), 0);
  const posturaGlobal = diasConCarga && hembrasPostura
    ? (huevosSemana / diasConCarga / hembrasPostura) * 100
    : null;

  // ── Huevo ──────────────────────────────────────────────────────────────────
  const etiquetaTipo = Object.fromEntries((stockTrigotuc?.porTipo || []).map((t) => [t.tipo, t.etiqueta]));
  const granjaPorTipo = {};
  for (const g of stockGranja)
    for (const [tipo, n] of Object.entries(g.porTipo || {}))
      granjaPorTipo[tipo] = (granjaPorTipo[tipo] || 0) + n;
  const totalGranja = stockGranja.reduce((a, g) => a + (g.huevosDisponibles || 0), 0);

  // ── Incubación ─────────────────────────────────────────────────────────────
  const capacidad = constantes?.capacidadIncubacion || null;
  const incubando = incubadora?.ocupados || 0;
  const enNacedora = (incubadora?.tandasEnNacedora || [])
    .reduce((a, t) => a + (t.transferencia?.huevosTransferidos || 0), 0);
  const proximasTransferencias = (incubadora?.tandasEnIncubadora || [])
    .filter((t) => t.fechaTransferenciaPrevista)
    .reduce((map, t) => {
      const k = diaClave(t.fechaTransferenciaPrevista);
      map[k] = (map[k] || 0) + (t.huevosIncubando || 0);
      return map;
    }, {});
  const transferencias = Object.entries(proximasTransferencias).sort(([a], [b]) => a.localeCompare(b)).slice(0, 4);

  const fechaCorta = (clave) => {
    const [a, m, d] = clave.split("-");
    return `${d}/${m}/${a.slice(2)}`;
  };

  return (
    <>
      {/* ── KPIs ── */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <KpiCard label="Aves en planteles" value={fmtNum(hembras + machos)}
            sub={`${fmtNum(hembras)} hembras · ${fmtNum(machos)} machos`}
            color="text-success" onClick={() => navigate("/reproductores/galpones")} />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard label={`Huevos (${DIAS_POSTURA} días)`} value={fmtNum(huevosSemana)}
            sub={posturaGlobal != null ? `Postura ${fmtPct(posturaGlobal)}` : "Sin recolecciones"}
            color="text-warning" onClick={() => navigate("/reproductores/recoleccion")} />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard label="En incubadora" value={fmtNum(incubando)}
            sub={capacidad ? `${fmtPct((incubando / capacidad) * 100)} de ${fmtNum(capacidad)}` : `${fmtNum(enNacedora)} en nacedora`}
            color="text-danger" onClick={() => navigate("/reproductores/incubadora")} />
        </div>
        <div className="col-6 col-md-3">
          <KpiCard label="Pollitos libres" value={fmtNum(pollitos?.libre ?? 0)}
            sub={`${fmtNum(pollitos?.total ?? 0)} en stock · ${fmtNum(pollitos?.comprometido ?? 0)} comprometidos`}
            color="text-primary" onClick={() => navigate("/reproductores/ordenes-carga")} />
        </div>
      </div>

      {/* ══ PLANTELES ══ */}
      <div className="mb-4">
        <SectionTitle icon="house-heart-fill" title="Planteles activos" color="text-success" />
        {planteles.length === 0 ? (
          <div className="alert alert-light text-muted small">No hay planteles activos.</div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.875rem" }}>
                <thead className="table-light">
                  <tr>
                    <th>Galpón / Lote</th>
                    <th className="text-end">Semana</th>
                    <th className="text-end">Hembras</th>
                    <th className="text-end">Machos</th>
                    <th className="text-end">Mortandad</th>
                    <th className="text-end">Peso H / M</th>
                    <th className="text-end">Huevos/día</th>
                    <th className="text-end">Postura</th>
                  </tr>
                </thead>
                <tbody>
                  {planteles.map((l) => (
                    <tr key={l._id}>
                      <td>
                        <span className="fw-semibold">G{l.galpon}</span>
                        <span className="text-muted ms-1 small">#{l.numeroLote}</span>
                        <span className={`badge ms-2 ${l.estado === "postura" ? "bg-warning text-dark" : "bg-info text-dark"}`} style={{ fontSize: "0.6rem" }}>
                          {ETIQUETA_FASE[l.estado] || l.estado}
                        </span>
                        {l.egreso && <span className="badge bg-secondary ms-1" style={{ fontSize: "0.6rem" }}>Egreso</span>}
                      </td>
                      <td className="text-end text-muted">{l.semanaVida ?? "—"}</td>
                      <td className="text-end fw-semibold">{fmtNum(l.hembras?.actual)}</td>
                      <td className="text-end fw-semibold">{fmtNum(l.machos?.actual)}</td>
                      <td className="text-end">
                        <span className={`fw-semibold ${colorMort(l.pctMort)}`}>{fmtNum(l.mort)} ({fmtPct(l.pctMort)})</span>
                      </td>
                      <td className="text-end text-nowrap">
                        {l.pesoH ? `${(l.pesoH / 1000).toFixed(2)}` : "—"}
                        <span className="text-muted"> / </span>
                        {l.pesoM ? `${(l.pesoM / 1000).toFixed(2)}` : "—"}
                        {(l.pesoH || l.pesoM) && <span className="text-muted small"> kg</span>}
                      </td>
                      <td className="text-end">{l.huevosDia != null ? fmtNum(Math.round(l.huevosDia)) : "—"}</td>
                      <td className="text-end">
                        {l.postura != null
                          ? <span className={`fw-semibold ${colorPostura(l.postura)}`}>{fmtPct(l.postura)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-footer bg-white text-muted" style={{ fontSize: "0.7rem" }}>
              Huevos/día y postura: promedio de los días con recolección cargada en los últimos {DIAS_POSTURA}, sobre las hembras de hoy.
            </div>
          </div>
        )}
      </div>

      {/* ══ HUEVO E INCUBACIÓN ══ */}
      <div className="mb-4">
        <SectionTitle icon="egg" title="Huevo e incubación" color="text-warning" />
        <div className="row g-3">

          {/* En la granja */}
          <div className="col-12 col-md-6 col-xl-4">
            <div className="card border-0 shadow-sm h-100 cursor-pointer" onClick={() => navigate("/reproductores/remitos")}>
              <div className="card-body">
                <CardLabel>En la granja (sin remitir)</CardLabel>
                <div className="fw-bold fs-4 mb-3">{fmtNum(totalGranja)} <span className="fs-6 text-muted fw-normal">huevos</span></div>
                <div className="d-flex flex-column gap-2">
                  {Object.entries(granjaPorTipo).filter(([, n]) => n > 0).map(([tipo, n]) => (
                    <div key={tipo} className="d-flex justify-content-between small">
                      <span className="text-muted">{etiquetaTipo[tipo] || tipo}</span>
                      <span className="fw-semibold">{fmtNum(n)}</span>
                    </div>
                  ))}
                  {totalGranja === 0 && <span className="text-muted small">Todo lo recolectado ya se remitió.</span>}
                </div>
              </div>
            </div>
          </div>

          {/* En Trigotuc */}
          <div className="col-12 col-md-6 col-xl-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <CardLabel>En Trigotuc</CardLabel>
                <div className="fw-bold fs-4 mb-3">{fmtNum(stockTrigotuc?.total ?? 0)} <span className="fs-6 text-muted fw-normal">huevos</span></div>
                <div className="d-flex flex-column gap-2">
                  {(stockTrigotuc?.porTipo || []).filter((t) => t.cantidad > 0).map((t) => (
                    <div key={t.tipo} className="d-flex justify-content-between small">
                      <span className="text-muted">{t.etiqueta}</span>
                      <span className="fw-semibold">
                        {fmtNum(t.cantidad)} <span className="text-muted fw-normal">({fmtNum(t.maples)} maples)</span>
                      </span>
                    </div>
                  ))}
                  {!stockTrigotuc && <span className="text-muted small">No se pudo leer el stock.</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Incubadora y nacedora */}
          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm h-100 cursor-pointer" onClick={() => navigate("/reproductores/incubadora")}>
              <div className="card-body">
                <CardLabel>Incubadora y nacedora</CardLabel>
                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-muted">Incubando</span>
                  <span className="fw-semibold">{fmtNum(incubando)}{capacidad ? ` / ${fmtNum(capacidad)}` : ""}</span>
                </div>
                {capacidad && (
                  <div className="progress mb-3" style={{ height: 6 }}>
                    <div className="progress-bar bg-danger" style={{ width: `${Math.min(100, (incubando / capacidad) * 100)}%` }}></div>
                  </div>
                )}
                <div className="d-flex justify-content-between small mb-3">
                  <span className="text-muted">En nacedora</span>
                  <span className="fw-semibold">{fmtNum(enNacedora)}</span>
                </div>
                <div className="text-muted text-uppercase fw-semibold mb-2" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                  Próximas transferencias
                </div>
                {transferencias.length === 0 ? (
                  <span className="text-muted small">Nada en la incubadora.</span>
                ) : (
                  <div className="d-flex flex-column gap-1">
                    {transferencias.map(([dia, huevos]) => (
                      <div key={dia} className="d-flex justify-content-between small">
                        <span>{fechaCorta(dia)}</span>
                        <span className="fw-semibold">{fmtNum(huevos)} huevos</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══ SILOS ══ */}
      <div className="mb-4">
        <SectionTitle icon="database" title="Silos de alimento" color="text-secondary" />
        {!silos ? (
          <div className="alert alert-light text-muted small">No se pudo leer el stock de los silos.</div>
        ) : (
          <div className="row g-3">
            {(silos.grupos || []).map((g) => {
              const pct = g.capacidadKg ? (g.kg / g.capacidadKg) * 100 : 0;
              const tipos = {};
              for (const s of (silos.silos || []).filter((x) => g.silos.includes(x.silo)))
                for (const t of s.tipos || [])
                  tipos[t.etiqueta] = (tipos[t.etiqueta] || 0) + t.kg;
              return (
                <div key={g.clave} className="col-6 col-lg-3">
                  <div className="card border-0 shadow-sm h-100 cursor-pointer" onClick={() => navigate("/alimento/silos")}>
                    <div className="card-body">
                      <CardLabel className="mb-2">{g.nombre}</CardLabel>
                      <div className="fw-bold fs-5">{fmtNum(g.kg)} <span className="fs-6 text-muted fw-normal">kg</span></div>
                      <div className="progress my-2" style={{ height: 6 }}>
                        <div className={`progress-bar ${pct < 15 ? "bg-danger" : "bg-secondary"}`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                      </div>
                      <div className="text-muted mb-2" style={{ fontSize: "0.7rem" }}>
                        {fmtPct(pct)} de {fmtNum(g.capacidadKg)} kg
                      </div>
                      {Object.entries(tipos).map(([etiqueta, kg]) => (
                        <div key={etiqueta} className="d-flex justify-content-between" style={{ fontSize: "0.75rem" }}>
                          <span className="text-muted">{etiqueta}</span>
                          <span className="fw-semibold">{fmtNum(kg)}</span>
                        </div>
                      ))}
                      {g.kg === 0 && <span className="text-danger" style={{ fontSize: "0.75rem" }}>Vacío</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default DashboardReproductoras;
