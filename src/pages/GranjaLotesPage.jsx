import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { obtenerLotesGranja } from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";

const GRANJAS = [
  { key: "cañete",    label: "Cañete",    prefix: "C", galpones: 6 },
  { key: "los_pinos", label: "Los Pinos", prefix: "P", galpones: 8 },
];

const TABLA_REF = [
  { semana: 1, min: 175, max: 190 },
  { semana: 2, min: 450, max: 480 },
  { semana: 3, min: 900, max: 950 },
  { semana: 4, min: 1500, max: 1600 },
  { semana: 5, min: 2200, max: 2300 },
  { semana: 6, min: 2900, max: 3000 },
];

const GRANJA_OPTS = [
  { value: "cañete",    label: "Cañete",    galpones: 6 },
  { value: "los_pinos", label: "Los Pinos", galpones: 8 },
];

const diasDeVida = (f) =>
  Math.floor((Date.now() - new Date(f).getTime()) / (1000 * 60 * 60 * 24));

const semana = (f) => Math.max(1, Math.ceil(diasDeVida(f) / 7));

const formatPeso = (g) => {
  if (g == null) return "-";
  return g >= 1000 ? `${(g / 1000).toFixed(3).replace(".", ",")} kg` : `${g} g`;
};

const formatRango = (min, max) => {
  if (max >= 1000) {
    const minK = (min / 1000).toFixed(1).replace(".", ",");
    const maxK = (max / 1000).toFixed(1).replace(".", ",");
    return `${minK}–${maxK} kg`;
  }
  return `${min}–${max} g`;
};

const clsPeso = (peso, ref) => {
  if (peso == null || !ref) return "text-muted";
  if (peso >= ref.min && peso <= ref.max) return "text-success fw-bold";
  if (peso > ref.max) return peso <= ref.max * 1.10 ? "text-warning fw-bold" : "text-danger fw-bold";
  return peso >= ref.min * 0.90 ? "text-warning fw-bold" : "text-danger fw-bold";
};

const pesoEnSemana = (pesajes, sem) =>
  [...pesajes].filter((p) => p.semana === sem).pop() || null;

// Peso ideal semana 6: 2900-3000 g
const PESO_IDEAL_MIN = 2900;
const PESO_IDEAL_MAX = 3000;

const estadoEgreso = (lote) => {
  const sem = semana(lote.fechaIngreso);
  if (sem < 6) return null;
  const lastPesaje = lote.pesajes?.length > 0
    ? lote.pesajes[lote.pesajes.length - 1]
    : null;
  const peso = lastPesaje?.pesoPromedio ?? null;
  if (peso === null) return sem >= 6 ? "sin-pesaje" : null;
  if (peso >= PESO_IDEAL_MIN && peso <= PESO_IDEAL_MAX) return "ideal";
  if (peso > PESO_IDEAL_MAX) return "excede";
  return "bajo";  // sem >= 6 pero peso aún no alcanzó el ideal
};

const badgeDif = (dif, ref, peso) => {
  if (dif == null || ref == null || peso == null) return null;
  const cls = (() => {
    if (peso >= ref.min && peso <= ref.max) return "bg-success";
    if (peso > ref.max) return peso <= ref.max * 1.10 ? "bg-warning text-dark" : "bg-danger";
    return peso >= ref.min * 0.90 ? "bg-warning text-dark" : "bg-danger";
  })();
  return <span className={`badge ${cls}`}>{dif >= 0 ? "+" : ""}{dif} g</span>;
};

// ── Modal lectura (desde galpón card) ─────────────────────────────────────────
const GalponModal = ({ lote, galponLabel, onClose }) => {
  const [tab, setTab] = useState("pesaje");
  const dias   = diasDeVida(lote.fechaIngreso);
  const sem    = semana(lote.fechaIngreso);
  const bajas  = lote.mortandad.reduce((s, m) => s + m.cantidad, 0);
  const egreso = estadoEgreso(lote);
  const cfg    = egreso ? EGRESO_CONFIG[egreso] : null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <div>
              <h5 className="modal-title mb-0">
                Galpón {galponLabel} — Lote #{lote.numeroLote}
              </h5>
              <div className="small mt-1 opacity-75">
                Ingreso: {formatearFechaLocal(lote.fechaIngreso)} · Día {dias} / Semana {sem} · {lote.cantidadActual.toLocaleString("es-AR")} pollos
                {(lote.cantidadComprometida || 0) > 0 && (
                  <> · <span className="text-warning">{lote.cantidadComprometida.toLocaleString("es-AR")} comprometidos</span> · <span className="text-white fw-semibold">{(lote.cantidadActual - lote.cantidadComprometida).toLocaleString("es-AR")} disponibles</span></>
                )}
                {bajas > 0 && ` · ${bajas} bajas`}
              </div>
            </div>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-0">
            {/* Banner de egreso */}
            {egreso === "ideal" && (
              <div className="alert alert-warning rounded-0 mb-0 d-flex align-items-center gap-2 px-3 py-2">
                <i className="bi bi-star-fill fs-5 text-warning"></i>
                <div>
                  <strong>¡Peso ideal alcanzado!</strong> — Este lote está listo para faena o venta.
                  <div className="small text-muted">Rango ideal: {(PESO_IDEAL_MIN/1000).toFixed(3)}–{(PESO_IDEAL_MAX/1000).toFixed(3)} kg · Último pesaje: {formatPeso(lote.pesajes[lote.pesajes.length-1]?.pesoPromedio)}</div>
                </div>
              </div>
            )}
            {egreso === "excede" && (
              <div className="alert alert-danger rounded-0 mb-0 d-flex align-items-center gap-2 px-3 py-2">
                <i className="bi bi-exclamation-circle-fill fs-5"></i>
                <div>
                  <strong>Excede el peso ideal</strong> — Se recomienda sacar urgente para no perder calidad.
                  <div className="small">Último pesaje: <strong>{formatPeso(lote.pesajes[lote.pesajes.length-1]?.pesoPromedio)}</strong> · Ideal: hasta {(PESO_IDEAL_MAX/1000).toFixed(3)} kg</div>
                </div>
              </div>
            )}
            {egreso === "sin-pesaje" && (
              <div className="alert alert-primary rounded-0 mb-0 d-flex align-items-center gap-2 px-3 py-2">
                <i className="bi bi-question-circle fs-5"></i>
                <div>
                  <strong>Semana 6 sin pesaje registrado</strong> — Registrá un pesaje para evaluar si está listo para egreso.
                </div>
              </div>
            )}
            <ul className="nav nav-tabs px-3 pt-2 bg-light border-bottom">
              <li className="nav-item">
                <button className={`nav-link ${tab === "pesaje" ? "active" : ""}`} onClick={() => setTab("pesaje")}>
                  <i className="bi bi-speedometer2 me-1"></i>Pesajes
                </button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${tab === "mortandad" ? "active" : ""}`} onClick={() => setTab("mortandad")}>
                  <i className="bi bi-heartbreak me-1"></i>Mortandad
                  {bajas > 0 && <span className="badge bg-danger ms-1">{bajas}</span>}
                </button>
              </li>
            </ul>
            <div className="p-3">
              {tab === "pesaje" && (() => {
                const semMaxRef = Math.max(...TABLA_REF.map((r) => r.semana));
                const pesajesExtra = lote.pesajes
                  .filter((p) => p.semana > semMaxRef)
                  .reduce((acc, p) => {
                    acc[p.semana] = acc[p.semana] || [];
                    acc[p.semana].push(p);
                    return acc;
                  }, {});
                const semanasExtra = Object.keys(pesajesExtra).map(Number).sort((a, b) => a - b);

                return (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Semana</th>
                          <th>Objetivo</th>
                          <th>Peso real</th>
                          <th>Estado</th>
                          <th className="d-none d-sm-table-cell">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TABLA_REF.map((ref) => {
                          const p = pesoEnSemana(lote.pesajes, ref.semana);
                          const esSemActual = ref.semana === sem;
                          return (
                            <tr key={ref.semana} className={esSemActual ? "table-primary" : ""}>
                              <td className="fw-semibold">
                                Sem. {ref.semana}
                                {esSemActual && (
                                  <span className="badge bg-primary ms-1" style={{ fontSize: "0.65rem" }}>actual</span>
                                )}
                              </td>
                              <td className="text-muted small">{formatRango(ref.min, ref.max)}</td>
                              {p ? (
                                <>
                                  <td className={clsPeso(p.pesoPromedio, ref)}>{formatPeso(p.pesoPromedio)}</td>
                                  <td>{badgeDif(p.diferencia, ref, p.pesoPromedio)}</td>
                                  <td className="d-none d-sm-table-cell text-muted small">{formatearFechaLocal(p.fecha)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="text-muted">—</td>
                                  <td><span className="text-muted small">Pendiente</span></td>
                                  <td className="d-none d-sm-table-cell"></td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                        {semanasExtra.map((s) => {
                          const p = [...pesajesExtra[s]].pop();
                          const esSemActual = s === sem;
                          return (
                            <tr key={s} className={esSemActual ? "table-primary" : ""}>
                              <td className="fw-semibold">
                                Sem. {s}
                                {esSemActual && (
                                  <span className="badge bg-primary ms-1" style={{ fontSize: "0.65rem" }}>actual</span>
                                )}
                              </td>
                              <td className="text-muted small">—</td>
                              <td className="fw-bold text-primary">{formatPeso(p.pesoPromedio)}</td>
                              <td>—</td>
                              <td className="d-none d-sm-table-cell text-muted small">{formatearFechaLocal(p.fecha)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {lote.pesajes.length === 0 && (
                      <div className="text-center text-muted py-3 small">Sin pesajes registrados todavía</div>
                    )}
                  </div>
                );
              })()}
              {tab === "mortandad" && (
                lote.mortandad.length === 0
                  ? <p className="text-muted text-center py-4">Sin bajas registradas</p>
                  : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead className="table-light">
                          <tr><th>Semana</th><th>Fecha</th><th>Bajas</th><th>Causa</th></tr>
                        </thead>
                        <tbody>
                          {[...lote.mortandad].reverse().map((m) => (
                            <tr key={m._id}>
                              <td className="fw-semibold">Sem. {m.semana}</td>
                              <td>{formatearFechaLocal(m.fecha)}</td>
                              <td className="text-danger fw-bold">{m.cantidad}</td>
                              <td>{m.causa || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-light">
                          <tr><td colSpan={2} className="fw-semibold">Total bajas</td><td className="text-danger fw-bold">{bajas}</td><td></td></tr>
                        </tfoot>
                      </table>
                    </div>
                  )
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Tarjeta galpón ─────────────────────────────────────────────────────────────
const EGRESO_CONFIG = {
  ideal:       { bg: "#fefce8", border: "#ca8a04", text: "#854d0e", badge: "bg-warning text-dark", icono: "bi-star-fill",        label: "¡Peso ideal! Listo para sacar" },
  excede:      { bg: "#fff7ed", border: "#ea580c", text: "#9a3412", badge: "bg-danger",             icono: "bi-exclamation-circle-fill", label: "Excede peso ideal — Sacar urgente" },
  "sin-pesaje":{ bg: "#f5f3ff", border: "#7c3aed", text: "#5b21b6", badge: "bg-primary",            icono: "bi-question-circle", label: "Sem. 6 — Registrar pesaje" },
  bajo:        { bg: "#f0fdf4", border: "#16a34a", text: "#166534", badge: null,                    icono: null,                 label: null },
};

const GalponCard = ({ label, lote, onClick }) => {
  if (!lote) {
    return (
      <div className="card border-0 text-center p-3" style={{ border: "1px dashed #ced4da", opacity: 0.5, minHeight: "140px" }}>
        <div className="fw-bold fs-4 text-muted">{label}</div>
        <i className="bi bi-dash-circle fs-4 text-muted mt-1"></i>
        <div className="text-muted small mt-1">Vacío</div>
      </div>
    );
  }
  const dias    = diasDeVida(lote.fechaIngreso);
  const sem     = semana(lote.fechaIngreso);
  const bajas   = lote.mortandad.reduce((s, m) => s + m.cantidad, 0);
  const egreso  = estadoEgreso(lote);
  const cfg     = egreso ? EGRESO_CONFIG[egreso] : null;

  const alerta   = dias >= 40 && !egreso;
  const barColor = egreso ? cfg.border : (dias < 30 ? "#198754" : dias < 40 ? "#fd7e14" : "#dc3545");
  const bgColor  = egreso ? cfg.bg : (alerta ? "#fff9e6" : "#f0fdf4");
  const progresoPct = Math.min(100, Math.round((dias / 45) * 100));
  const lastPeso = lote.pesajes?.length > 0
    ? lote.pesajes[lote.pesajes.length - 1].pesoPromedio
    : null;

  return (
    <div
      className="card border-0 shadow-sm text-center"
      style={{ cursor: "pointer", minHeight: "140px", background: bgColor, borderLeft: `4px solid ${barColor}`, overflow: "hidden", position: "relative" }}
      onClick={() => onClick(lote)}
    >
      <div className="p-3 pb-2">
        <div className="fw-bold fs-4" style={{ color: barColor }}>{label}</div>
        <div className="fw-semibold small mt-1">Día {dias} — Sem. {sem}</div>
        <div className="text-muted small">{lote.cantidadActual.toLocaleString("es-AR")} pollos</div>
        {(lote.cantidadComprometida || 0) > 0 ? (
          <div className="small mt-1">
            <span className="badge bg-warning text-dark">{lote.cantidadComprometida.toLocaleString("es-AR")} comprometidos</span>
            <div className="fw-semibold" style={{ color: "#16a34a" }}>{(lote.cantidadActual - lote.cantidadComprometida).toLocaleString("es-AR")} disponibles</div>
          </div>
        ) : (
          <div className="small fw-semibold" style={{ color: "#16a34a" }}>todos disponibles</div>
        )}
        {lastPeso != null && (
          <div className="small mt-1" style={{ color: egreso ? cfg.text : "#0d6efd" }}>
            <i className="bi bi-speedometer2 me-1"></i>{formatPeso(lastPeso)}
          </div>
        )}
        <div className="text-muted small mt-1"><i className="bi bi-calendar-event me-1"></i>{formatearFechaLocal(lote.fechaIngreso)}</div>
        {bajas > 0 && <div className="mt-1"><span className="badge bg-danger bg-opacity-75">{bajas} bajas</span></div>}
        {egreso && cfg.badge && (
          <div className="mt-1">
            <span className={`badge ${cfg.badge}`} style={{ whiteSpace: "normal" }}>
              {cfg.icono && <i className={`bi ${cfg.icono} me-1`}></i>}
              {cfg.label}
            </span>
          </div>
        )}
        {alerta && <div className="mt-1"><span className="badge bg-warning text-dark">¡Revisar egreso!</span></div>}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "5px", background: "#e9ecef" }}>
        <div style={{ height: "100%", width: `${progresoPct}%`, background: barColor, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
};

// ── Modal editar ingreso ───────────────────────────────────────────────────────
const EditarIngresoModal = ({ lote, onClose, onGuardado }) => {
  const [form, setForm] = useState({
    granja:          lote.granja,
    galpon:          lote.galpon,
    fechaIngreso:    lote.fechaIngreso?.split("T")[0] ?? "",
    cantidadIngreso: lote.cantidadIngreso,
    proveedor:       lote.proveedor || "",
    observaciones:   lote.observaciones || "",
  });
  const [saving, setSaving] = useState(false);

  const maxGalpones = GRANJA_OPTS.find((g) => g.value === form.granja)?.galpones || 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await actualizarLoteGranja(lote._id, {
        ...form,
        galpon:          Number(form.galpon),
        cantidadIngreso: Number(form.cantidadIngreso),
      });
      onGuardado();
      Swal.fire({ icon: "success", title: "Ingreso actualizado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-pencil me-2"></i>Editar ingreso — Lote #{lote.numeroLote}</h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-editar-ingreso" onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Granja</label>
                    <select
                      className="form-select"
                      value={form.granja}
                      onChange={(e) => setForm({ ...form, granja: e.target.value, galpon: 1 })}
                      required
                    >
                      {GRANJA_OPTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Galpón</label>
                    <input
                      type="number" className="form-control"
                      value={form.galpon}
                      onChange={(e) => setForm({ ...form, galpon: e.target.value })}
                      min="1" max={maxGalpones} required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha de ingreso</label>
                    <input
                      type="date" className="form-control"
                      value={form.fechaIngreso}
                      onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad</label>
                    <input
                      type="number" className="form-control"
                      value={form.cantidadIngreso}
                      onChange={(e) => setForm({ ...form, cantidadIngreso: e.target.value })}
                      min="1" required
                    />
                    <div className="form-text">Cantidad × kg — Actual: {lote.cantidadIngreso}</div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Enviado por (opcional)</label>
                    <input
                      type="text" className="form-control"
                      value={form.proveedor}
                      onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Observaciones (opcional)</label>
                    <textarea
                      className="form-control" rows={2}
                      value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-editar-ingreso" className="btn btn-primary" disabled={saving}>
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

// ── Página principal ───────────────────────────────────────────────────────────
const GranjaLotesPage = () => {
  const navigate    = useNavigate();
  const rolUsuario  = localStorage.getItem("rolUsuario");
  const puedeEditar  = rolUsuario === "superadmin" || rolUsuario === "frigorifico";
  const esSuperAdmin = rolUsuario === "superadmin";

  const [lotes, setLotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalLote, setModalLote] = useState(null);

  const cargarLotes = useCallback(async () => {
    try {
      const activos = await obtenerLotesGranja({ estado: "en_crianza" });
      setLotes(activos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  const loteDeGalpon = (granja, galpon) =>
    lotes.find((l) => l.granja === granja && l.galpon === galpon) || null;

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-5">
          <div className="spinner-border text-success"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-house-door me-2 text-success"></i>
            Galpones
          </h1>
          <button className="btn btn-outline-primary btn-sm" onClick={() => navigate("/granja/cargar-datos")}>
            <i className="bi bi-pencil-square me-1"></i>Datos Semanales
          </button>
        </div>

        {/* Grid de galpones por granja */}
        {GRANJAS.map(({ key, label, prefix, galpones }) => (
          <div key={key} className="mb-4">
            <h5 className="fw-bold mb-3 text-secondary border-bottom pb-2">
              <i className="bi bi-geo-alt me-1"></i>{label}
              <span className="text-muted fw-normal fs-6 ms-2">
                {lotes.filter((l) => l.granja === key).length} / {galpones} galpones activos
              </span>
            </h5>
            <div className="row g-3">
              {Array.from({ length: galpones }, (_, i) => i + 1).map((n) => (
                <div key={n} className="col-6 col-sm-4 col-md-3 col-lg-2">
                  <GalponCard
                    label={`${prefix}${n}`}
                    lote={loteDeGalpon(key, n)}
                    onClick={setModalLote}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Referencia */}
        <div className="d-flex gap-3 flex-wrap mb-4 small text-muted">
          <span><span className="badge bg-success me-1">●</span>En crianza</span>
          <span><span className="badge bg-warning text-dark me-1">●</span>≥ 40 días — revisar egreso</span>
          <span style={{ color: "#ca8a04" }}><i className="bi bi-star-fill me-1"></i>Peso ideal — listo para sacar</span>
          <span className="text-danger"><i className="bi bi-exclamation-circle-fill me-1"></i>Excede peso ideal</span>
          <span><span className="badge bg-light text-muted border me-1">●</span>Vacío</span>
        </div>

        {/* Tabla comparativa de crecimiento */}
        {lotes.length > 0 && (() => {
          const semMaxRef = Math.max(...TABLA_REF.map((r) => r.semana));
          const todasLasSemanas = [...new Set(
            lotes.flatMap((l) => l.pesajes.map((p) => p.semana))
          )].sort((a, b) => a - b);
          const semanasExtra = todasLasSemanas.filter((s) => s > semMaxRef);

          return (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-white py-2">
                <h6 className="mb-0">
                  <i className="bi bi-bar-chart-line me-2 text-success"></i>
                  Comparativa de crecimiento por galpón
                </h6>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-bordered align-middle mb-0">
                  <thead className="table-light text-center">
                    <tr>
                      <th className="text-start">Galpón</th>
                      {TABLA_REF.map((r) => (
                        <th key={r.semana}>
                          Sem. {r.semana}
                          <div className="text-muted fw-normal" style={{ fontSize: "0.7rem" }}>
                            {formatRango(r.min, r.max)}
                          </div>
                        </th>
                      ))}
                      {semanasExtra.map((s) => (
                        <th key={s}>
                          Sem. {s}
                          <div className="text-muted fw-normal" style={{ fontSize: "0.7rem" }}>sin ref.</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lotes.map((lote) => {
                      const prefix = GRANJAS.find((g) => g.key === lote.granja)?.prefix;
                      const semActual = semana(lote.fechaIngreso);
                      return (
                        <tr key={lote._id}>
                          <td className="fw-semibold" style={{ whiteSpace: "nowrap" }}>
                            {prefix}{lote.galpon}
                            <div className="text-muted fw-normal" style={{ fontSize: "0.7rem" }}>
                              Sem. {semActual} actual
                            </div>
                          </td>
                          {TABLA_REF.map((ref) => {
                            const p = pesoEnSemana(lote.pesajes, ref.semana);
                            if (!p) return <td key={ref.semana} className="text-center text-muted">—</td>;
                            return (
                              <td key={ref.semana} className={`text-center ${clsPeso(p.pesoPromedio, ref)}`}>
                                {formatPeso(p.pesoPromedio)}
                              </td>
                            );
                          })}
                          {semanasExtra.map((s) => {
                            const p = pesoEnSemana(lote.pesajes, s);
                            if (!p) return <td key={s} className="text-center text-muted">—</td>;
                            return (
                              <td key={s} className="text-center fw-bold text-primary">
                                {formatPeso(p.pesoPromedio)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}


      </div>

      {modalLote && (
        <GalponModal
          lote={modalLote}
          galponLabel={`${GRANJAS.find((g) => g.key === modalLote.granja)?.prefix}${modalLote.galpon}`}
          onClose={() => setModalLote(null)}
        />
      )}

    </Layout>
  );
};

export default GranjaLotesPage;
