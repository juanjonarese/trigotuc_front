import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { obtenerLotesGranja, actualizarLoteGranja, eliminarLoteGranja } from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GRANJAS = [
  { key: "cañete",    label: "Cañete",    prefix: "C", galpones: 6 },
  { key: "los_pinos", label: "Los Pinos", prefix: "P", galpones: 8 },
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

const badgeDif = (dif, esp) => {
  if (dif == null || !esp) return null;
  const pct = dif / esp;
  const cls = pct >= -0.05 ? "bg-success" : pct >= -0.15 ? "bg-warning text-dark" : "bg-danger";
  return <span className={`badge ${cls}`}>{dif >= 0 ? "+" : ""}{dif} g</span>;
};

// ── Modal lectura (desde galpón card) ─────────────────────────────────────────
const GalponModal = ({ lote, galponLabel, onClose }) => {
  const [tab, setTab] = useState("pesaje");
  const dias  = diasDeVida(lote.fechaIngreso);
  const sem   = semana(lote.fechaIngreso);
  const bajas = lote.mortandad.reduce((s, m) => s + m.cantidad, 0);

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
                {bajas > 0 && ` · ${bajas} bajas`}
              </div>
            </div>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-0">
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
              {tab === "pesaje" && (
                lote.pesajes.length === 0
                  ? <p className="text-muted text-center py-4">Sin pesajes registrados todavía</p>
                  : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead className="table-light">
                          <tr><th>Semana</th><th>Fecha</th><th>Peso real</th><th>Esperado</th><th>Diferencia</th></tr>
                        </thead>
                        <tbody>
                          {[...lote.pesajes].reverse().map((p) => (
                            <tr key={p._id}>
                              <td className="fw-semibold">Sem. {p.semana}</td>
                              <td>{formatearFechaLocal(p.fecha)}</td>
                              <td className="fw-bold">{formatPeso(p.pesoPromedio)}</td>
                              <td className="text-muted">{p.pesoEsperado ? formatPeso(p.pesoEsperado) : "-"}</td>
                              <td>{badgeDif(p.diferencia, p.pesoEsperado)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
              )}
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
const GalponCard = ({ label, lote, onClick }) => {
  if (!lote) {
    return (
      <div className="card border-0 text-center p-3" style={{ border: "1px dashed #ced4da", opacity: 0.5, minHeight: "110px" }}>
        <div className="fw-bold fs-4 text-muted">{label}</div>
        <i className="bi bi-dash-circle fs-4 text-muted mt-1"></i>
        <div className="text-muted small mt-1">Vacío</div>
      </div>
    );
  }
  const dias = diasDeVida(lote.fechaIngreso);
  const sem  = semana(lote.fechaIngreso);
  const bajas = lote.mortandad.reduce((s, m) => s + m.cantidad, 0);
  const alerta = dias >= 40;
  const barColor = dias < 30 ? "#198754" : dias < 40 ? "#fd7e14" : "#dc3545";
  const progresoPct = Math.min(100, Math.round((dias / 45) * 100));

  return (
    <div
      className="card border-0 shadow-sm text-center"
      style={{ cursor: "pointer", minHeight: "110px", background: alerta ? "#fff9e6" : "#f0fdf4", borderLeft: `4px solid ${barColor}`, overflow: "hidden", position: "relative" }}
      onClick={() => onClick(lote)}
    >
      <div className="p-3 pb-2">
        <div className="fw-bold fs-4" style={{ color: barColor }}>{label}</div>
        <div className="fw-semibold small mt-1">Día {dias} — Sem. {sem}</div>
        <div className="text-muted small">{lote.cantidadActual.toLocaleString("es-AR")} pollos</div>
        <div className="text-muted small mt-1"><i className="bi bi-calendar-event me-1"></i>{formatearFechaLocal(lote.fechaIngreso)}</div>
        {bajas > 0 && <div className="mt-1"><span className="badge bg-danger bg-opacity-75">{bajas} bajas</span></div>}
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
                    <label className="form-label">Proveedor (opcional)</label>
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
  const [todosLotes, setTodosLotes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalLote, setModalLote] = useState(null);
  const [editLote, setEditLote]   = useState(null);

  const cargarLotes = useCallback(async () => {
    try {
      const [activos, todos] = await Promise.all([
        obtenerLotesGranja({ estado: "en_crianza" }),
        obtenerLotesGranja(),
      ]);
      setLotes(activos);
      setTodosLotes(todos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  const loteDeGalpon = (granja, galpon) =>
    lotes.find((l) => l.granja === granja && l.galpon === galpon) || null;

  const handleEliminar = async (lote) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar ingreso?",
      html: `Se eliminará el lote <strong>#${lote.numeroLote}</strong> y todos sus registros.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarLoteGranja(lote._id);
      await cargarLotes();
      Swal.fire({ icon: "success", title: "Eliminado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

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
          <span><span className="badge bg-light text-muted border me-1">●</span>Vacío</span>
        </div>

        {/* Tabla de ingresos */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
            <h6 className="mb-0"><i className="bi bi-list-ul me-2 text-success"></i>Historial de ingresos</h6>
            <span className="text-muted small">{todosLotes.length} registros</span>
          </div>
          <div className="card-body p-0">
            {todosLotes.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">Sin ingresos registrados.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {todosLotes.map((lote) => (
                    <div key={lote._id} className="card border mb-2">
                      <div className="card-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <div>
                            <span className="badge bg-dark me-1">#{lote.numeroLote}</span>
                            <span className={`badge ${lote.estado === "en_crianza" ? "bg-success" : "bg-secondary"}`}>
                              {lote.estado === "en_crianza" ? "En crianza" : "Finalizado"}
                            </span>
                          </div>
                          <div className="d-flex gap-1">
                            {puedeEditar && (
                              <button className="btn btn-outline-primary btn-sm" title="Editar" onClick={() => setEditLote(lote)}>
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            {esSuperAdmin && (
                              <button className="btn btn-outline-danger btn-sm" title="Eliminar" onClick={() => handleEliminar(lote)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="small text-muted">
                          {GRANJA_OPTS.find((g) => g.value === lote.granja)?.label} — Galpón {lote.galpon}
                        </div>
                        <div className="small">{formatearFechaLocal(lote.fechaIngreso)} · {lote.cantidadIngreso.toLocaleString("es-AR")} ingresados · {lote.cantidadActual.toLocaleString("es-AR")} actuales</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>#Lote</th>
                        <th>Granja</th>
                        <th>Galpón</th>
                        <th>Fecha ingreso</th>
                        <th className="text-end">Ingresados</th>
                        <th className="text-end">Actuales</th>
                        <th>Proveedor</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {todosLotes.map((lote) => (
                        <tr key={lote._id}>
                          <td><span className="badge bg-dark">#{lote.numeroLote}</span></td>
                          <td>{GRANJA_OPTS.find((g) => g.value === lote.granja)?.label || lote.granja}</td>
                          <td className="fw-semibold">{GRANJAS.find((g) => g.key === lote.granja)?.prefix}{lote.galpon}</td>
                          <td>{formatearFechaLocal(lote.fechaIngreso)}</td>
                          <td className="text-end">{lote.cantidadIngreso.toLocaleString("es-AR")}</td>
                          <td className="text-end fw-semibold">{lote.cantidadActual.toLocaleString("es-AR")}</td>
                          <td className="text-muted small">{lote.proveedor || "—"}</td>
                          <td>
                            <span className={`badge ${lote.estado === "en_crianza" ? "bg-success" : "bg-secondary"}`}>
                              {lote.estado === "en_crianza" ? "En crianza" : "Finalizado"}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              {puedeEditar && (
                                <button className="btn btn-outline-primary btn-sm" title="Editar" onClick={() => setEditLote(lote)}>
                                  <i className="bi bi-pencil"></i>
                                </button>
                              )}
                              {esSuperAdmin && (
                                <button className="btn btn-outline-danger btn-sm" title="Eliminar" onClick={() => handleEliminar(lote)}>
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

      {modalLote && (
        <GalponModal
          lote={modalLote}
          galponLabel={`${GRANJAS.find((g) => g.key === modalLote.granja)?.prefix}${modalLote.galpon}`}
          onClose={() => setModalLote(null)}
        />
      )}

      {editLote && (
        <EditarIngresoModal
          lote={editLote}
          onClose={() => setEditLote(null)}
          onGuardado={() => { setEditLote(null); cargarLotes(); }}
        />
      )}

    </Layout>
  );
};

export default GranjaLotesPage;
