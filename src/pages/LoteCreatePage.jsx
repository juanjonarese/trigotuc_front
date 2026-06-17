import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import {
  actualizarLote,
  obtenerLotes,
  eliminarLote,
} from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmtNum = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

// ── Modal editar lote ───────────────────────────────────────────────────────
const EditarLoteModal = ({ lote, onClose, onGuardado }) => {
  const [form, setForm] = useState({
    fechaIngreso:        lote.fechaIngreso?.slice(0, 10) ?? obtenerFechaHoy(),
    unidadesFaenadas:    lote.unidadesFaenadas    != null ? String(lote.unidadesFaenadas)    : "",
    kgVivos:             lote.kgVivos             != null ? String(lote.kgVivos)             : "",
    muertos:             lote.muertos             != null ? String(lote.muertos)             : "",
    kgMuertos:           lote.kgMuertos           != null ? String(lote.kgMuertos)           : "",
    unidadesDecomisadas: lote.unidadesDecomisadas != null ? String(lote.unidadesDecomisadas) : "",
    kgDecomisados:       lote.kgDecomisados       != null ? String(lote.kgDecomisados)       : "",
    unidadesTrozadas:    lote.unidadesTrozadas    != null ? String(lote.unidadesTrozadas)    : "",
    kgTrozados:          lote.kgTrozados          != null ? String(lote.kgTrozados)          : "",
    observaciones:       lote.observaciones ?? "",
  });
  const [lineas, setLineas]   = useState(
    (lote.calibres || []).map((c) => ({ calibre: c.calibre, pollos: c.pollos }))
  );
  const [saving, setSaving]   = useState(false);
  const calibreRef            = useRef(null);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lineasFinales = calibreRef.current?.getLineas() ?? lineas;
    const calibresPayload = lineasFinales
      .map((l) => ({ calibre: Number(l.calibre), pollos: Number(l.pollos), cajones: calcularCajones(l.pollos, l.calibre) }))
      .filter((l) => l.cajones > 0);
    if (calibresPayload.length === 0) {
      Swal.fire("Error", "Agregá al menos un calibre con pollos.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fechaIngreso: form.fechaIngreso,
        calibres:     calibresPayload,
        observaciones: form.observaciones || undefined,
      };
      if (form.unidadesFaenadas)    payload.unidadesFaenadas    = Number(form.unidadesFaenadas);
      if (form.kgVivos)             payload.kgVivos             = Number(form.kgVivos);
      if (form.muertos)             payload.muertos             = Number(form.muertos);
      if (form.kgMuertos)           payload.kgMuertos           = Number(form.kgMuertos);
      if (form.unidadesDecomisadas) payload.unidadesDecomisadas = Number(form.unidadesDecomisadas);
      if (form.kgDecomisados)       payload.kgDecomisados       = Number(form.kgDecomisados);
      if (form.unidadesTrozadas)    payload.unidadesTrozadas    = Number(form.unidadesTrozadas);
      if (form.kgTrozados)          payload.kgTrozados          = Number(form.kgTrozados);

      await actualizarLote(lote._id, payload);
      onGuardado();
      Swal.fire({ icon: "success", title: "Lote actualizado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo actualizar el lote.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-sm-down">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="bi bi-pencil-square me-2"></i>
                Editar Lote {lote.numeroLote ? `#${lote.numeroLote}` : ""}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-editar-lote" onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Fecha de faena</label>
                    <input type="date" className="form-control" value={form.fechaIngreso} onChange={f("fechaIngreso")} required />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Unidades faenadas</label>
                    <input type="number" className="form-control" value={form.unidadesFaenadas} onChange={f("unidadesFaenadas")} min="0" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label fw-semibold">Kg vivos</label>
                    <input type="number" className="form-control" value={form.kgVivos} onChange={f("kgVivos")} min="0" step="0.01" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Muertos (u)</label>
                    <input type="number" className="form-control" value={form.muertos} onChange={f("muertos")} min="0" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Muertos (kg)</label>
                    <input type="number" className="form-control" value={form.kgMuertos} onChange={f("kgMuertos")} min="0" step="0.01" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Decomisados (u)</label>
                    <input type="number" className="form-control" value={form.unidadesDecomisadas} onChange={f("unidadesDecomisadas")} min="0" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Decomisados (kg)</label>
                    <input type="number" className="form-control" value={form.kgDecomisados} onChange={f("kgDecomisados")} min="0" step="0.01" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Trozados (u)</label>
                    <input type="number" className="form-control" value={form.unidadesTrozadas} onChange={f("unidadesTrozadas")} min="0" placeholder="0" />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Trozados (kg)</label>
                    <input type="number" className="form-control" value={form.kgTrozados} onChange={f("kgTrozados")} min="0" step="0.01" placeholder="0" />
                  </div>
                  <div className="col-12 col-md-9">
                    <label className="form-label">Observaciones</label>
                    <input type="text" className="form-control" value={form.observaciones} onChange={f("observaciones")} />
                  </div>
                </div>

                <label className="form-label fw-semibold">Calibres</label>
                <p className="text-muted small mb-2">El calibre indica cuántos pollos entran en un cajón de 20 kg.</p>
                <CalibreTable ref={calibreRef} lineas={lineas} onChange={setLineas} />
              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-editar-lote" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-floppy me-1"></i>Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página principal ────────────────────────────────────────────────────────
const LoteCreatePage = () => {
  const navigate = useNavigate();

  const rolUsuario    = localStorage.getItem("rolUsuario");
  const puedeCrear    = rolUsuario === "superadmin" || rolUsuario === "frigorifico";
  const esSuperAdmin  = rolUsuario === "superadmin";

  const [lotes, setLotes]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loteEditando, setLoteEditando] = useState(null);
  const [pagina, setPagina]             = useState(1);
  const POR_PAGINA = 15;

  const cargarLotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerLotes();
      setLotes(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  const handleEliminar = async (lote) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar carga?",
      html: `Se eliminará el lote <strong>#${lote.numeroLote || ""}</strong> y todas sus ventas y actualizaciones.`,
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#dc3545", confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarLote(lote._id);
      await cargarLotes();
      Swal.fire({ icon: "success", title: "Eliminado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const totalPaginas  = Math.ceil(lotes.length / POR_PAGINA);
  const lotesPagina   = lotes.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-seam me-2 text-success"></i>
            Lotes de Faena
          </h1>
          {puedeCrear && (
            <button className="btn btn-success btn-sm" onClick={() => navigate("/frigorifico/lotes/crear")}>
              <i className="bi bi-plus-circle me-1"></i>Nuevo Lote
            </button>
          )}
        </div>

        {/* Lista de lotes */}
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : lotes.length === 0 ? (
          <p className="text-center text-muted py-5 mb-0">No hay lotes registrados.</p>
        ) : (
          <>
            {/* ── TARJETAS — mobile ── */}
            <div className="d-md-none d-flex flex-column gap-3">
              {lotesPagina.map((lote) => {
                const totalCajones     = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
                const tieneMuertos     = lote.muertos || lote.kgMuertos;
                const tieneDecomisados = lote.unidadesDecomisadas || lote.kgDecomisados;
                const tieneTrozados    = (lote.trozados || []).length > 0 || lote.kgTrozados;
                const kgCalibes        = totalCajones * 20;
                const kgTrozadosReal   = (lote.trozados || []).reduce((s, t) => s + (t.kgTotal || 0), 0) || Number(lote.kgTrozados) || 0;
                const kgTotalCamara    = kgCalibes + kgTrozadosReal;
                return (
                  <div key={lote._id} className="card border-0 shadow-sm"
                    style={{ borderLeft: "4px solid #198754" }}>
                    <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        {lote.numeroLote && (
                          <span className="badge bg-dark fs-6 px-3">#{lote.numeroLote}</span>
                        )}
                        <span className="text-muted small">
                          <i className="bi bi-calendar3 me-1"></i>
                          {new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}
                        </span>
                        <span className={`badge ${lote.estado === "activo" ? "bg-success" : "bg-secondary"}`}>
                          {lote.estado === "activo" ? "Activo" : "Cerrado"}
                        </span>
                      </div>
                      <div className="d-flex gap-1">
                        {puedeCrear && (
                          <button className="btn btn-outline-primary btn-sm" onClick={() => setLoteEditando(lote)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                        {esSuperAdmin && (
                          <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(lote)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="card-body py-2 px-3">
                      <div className="row g-0 text-center mb-2 pb-2" style={{ borderBottom: "1px solid #e9ecef" }}>
                        {/* 1 — Faenados */}
                        {lote.unidadesFaenadas && (
                          <div className="col border-end py-1">
                            <div className="text-muted text-uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.05em" }}>Faenados</div>
                            <div className="fw-bold" style={{ fontSize: "1rem" }}>{fmtNum(lote.unidadesFaenadas)}</div>
                          </div>
                        )}
                        {/* 2 — Muertos */}
                        {tieneMuertos && (
                          <div className="col border-end py-1">
                            <div className="text-muted text-uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.05em" }}>Muertos</div>
                            <div className="fw-bold text-secondary" style={{ fontSize: "1rem" }}>
                              {lote.muertos ? `${fmtNum(lote.muertos)} u` : `${fmtNum(lote.kgMuertos)} kg`}
                            </div>
                            {lote.muertos && lote.kgMuertos && (
                              <div className="text-muted" style={{ fontSize: "0.6rem" }}>{fmtNum(lote.kgMuertos)} kg</div>
                            )}
                          </div>
                        )}
                        {/* 3 — Decomisados */}
                        {tieneDecomisados && (
                          <div className="col border-end py-1">
                            <div className="text-muted text-uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.05em" }}>Decomisados</div>
                            <div className="fw-bold text-danger" style={{ fontSize: "1rem" }}>
                              {lote.kgDecomisados ? `${fmtNum(lote.kgDecomisados)} kg` : `${fmtNum(lote.unidadesDecomisadas)} u`}
                            </div>
                            {lote.unidadesDecomisadas && lote.kgDecomisados && (
                              <div className="text-muted" style={{ fontSize: "0.6rem" }}>{fmtNum(lote.unidadesDecomisadas)} u</div>
                            )}
                          </div>
                        )}
                        {/* 4 — Cajones */}
                        <div className="col border-end py-1">
                          <div className="text-muted text-uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.05em" }}>Cajones</div>
                          <div className="fw-bold text-primary" style={{ fontSize: "1rem" }}>{fmtNum(totalCajones)}</div>
                        </div>
                        {/* 5 — Kg cámara */}
                        <div className="col py-1">
                          <div className="text-muted text-uppercase" style={{ fontSize: "0.6rem", letterSpacing: "0.05em" }}>Kg cámara</div>
                          <div className="fw-bold" style={{ fontSize: "1rem" }}>{fmtNum(kgTotalCamara || lote.pesoTotal)}</div>
                        </div>
                      </div>
                      <div className="row g-3">
                        {(lote.calibres || []).length > 0 && (
                          <div className={tieneTrozados ? "col-12 col-sm-7" : "col-12"}>
                            <div className="text-muted text-uppercase fw-semibold mb-2" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                              <i className="bi bi-grid-3x3-gap me-1"></i>Calibres
                            </div>
                            <div className="d-flex flex-wrap gap-2">
                              {lote.calibres.map((c) => {
                                const pct = totalCajones > 0 ? Math.round(c.cajones / totalCajones * 100) : null;
                                return (
                                  <div key={c.calibre}
                                    className="d-flex flex-column align-items-center rounded px-3 py-2"
                                    style={{ background: "#eff6ff", border: "1px solid #bfdbfe", minWidth: 72 }}>
                                    <span className="fw-bold text-primary" style={{ fontSize: "0.75rem" }}>Cal. {c.calibre}</span>
                                    <span className="fw-semibold text-dark">{fmtNum(c.cajones)} caj</span>
                                    <span className="text-muted" style={{ fontSize: "0.7rem" }}>{fmtNum(c.cajones * 20)} kg</span>
                                    {pct != null && (
                                      <span className="text-primary fw-semibold" style={{ fontSize: "0.7rem" }}>{pct}%</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {tieneTrozados && (
                          <div className={(lote.calibres || []).length > 0 ? "col-12 col-sm-5" : "col-12"}>
                            <div className="text-muted text-uppercase fw-semibold mb-2" style={{ fontSize: "0.65rem", letterSpacing: "0.05em" }}>
                              <i className="bi bi-scissors me-1"></i>Trozados
                            </div>
                            <div className="d-flex flex-wrap gap-2">
                              {(lote.trozados || []).map((t) => {
                                const pct = kgTrozadosReal > 0 ? Math.round(t.kgTotal / kgTrozadosReal * 100) : null;
                                return (
                                  <div key={t.tipo}
                                    className="d-flex flex-column align-items-center rounded px-3 py-2"
                                    style={{ background: "#fffbeb", border: "1px solid #fde68a", minWidth: 72 }}>
                                    <span className="fw-bold" style={{ fontSize: "0.75rem", color: "#b45309" }}>
                                      {t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)}
                                    </span>
                                    <span className="fw-semibold text-dark">{fmtNum(t.cajas)} caj</span>
                                    <span className="text-muted" style={{ fontSize: "0.7rem" }}>{fmtNum(t.kgTotal)} kg</span>
                                    {pct != null && (
                                      <span className="fw-semibold" style={{ fontSize: "0.7rem", color: "#b45309" }}>{pct}%</span>
                                    )}
                                  </div>
                                );
                              })}
                              {lote.kgTrozados && !(lote.trozados || []).length && (
                                <div className="d-flex flex-column align-items-center rounded px-3 py-2"
                                  style={{ background: "#fffbeb", border: "1px solid #fde68a", minWidth: 72 }}>
                                  <span className="fw-bold" style={{ fontSize: "0.75rem", color: "#b45309" }}>Trozados</span>
                                  <span className="fw-semibold text-dark">{fmtNum(lote.kgTrozados)} kg</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {lote.observaciones && (
                        <div className="mt-3 p-2 rounded small"
                          style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                          <i className="bi bi-info-circle me-1 text-warning"></i>{lote.observaciones}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── TABLA — desktop ── */}
            <div className="d-none d-md-block card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.82rem" }}>
                    <thead>
                      <tr className="table-light">
                        <th rowSpan={2} className="align-middle">Lote</th>
                        <th rowSpan={2} className="align-middle">Fecha</th>
                        <th colSpan={2} className="text-center border-start">Vivos</th>
                        <th colSpan={3} className="text-center border-start">Muertos</th>
                        <th colSpan={3} className="text-center border-start">Decomisados</th>
                        <th rowSpan={2} className="text-center align-middle border-start">Cajones</th>
                        <th colSpan={3} className="text-center border-start">Trozados</th>
                        <th rowSpan={2} className="text-end align-middle border-start">Ingreso<br/>Cámara</th>
                        <th rowSpan={2} className="text-end align-middle border-start">Rend.</th>
                        <th rowSpan={2} className="align-middle"></th>
                      </tr>
                      <tr className="table-light" style={{ fontSize: "0.7rem", color: "#6c757d" }}>
                        <th className="text-end border-start fw-normal">und</th>
                        <th className="text-end fw-normal">%</th>
                        <th className="text-end border-start fw-normal">und</th>
                        <th className="text-end fw-normal">kg</th>
                        <th className="text-end fw-normal">%</th>
                        <th className="text-end border-start fw-normal">und</th>
                        <th className="text-end fw-normal">kg</th>
                        <th className="text-end fw-normal">%</th>
                        <th className="text-end border-start fw-normal">und</th>
                        <th className="text-end fw-normal">kg</th>
                        <th className="text-end fw-normal">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotesPagina.map((lote) => {
                        const totalCajones    = (lote.calibres || []).reduce((a, c) => a + c.cajones, 0);
                        const kgCalibes       = totalCajones * 20;
                        const kgTrozadosReal  = (lote.trozados || []).reduce((s, t) => s + (t.kgTotal || 0), 0) || Number(lote.kgTrozados) || 0;
                        const kgTotalCamara   = kgCalibes + kgTrozadosReal;
                        const base            = Number(lote.unidadesFaenadas) || 0;
                        const calibresPollos  = (lote.calibres || []).reduce((a, c) => a + (c.pollos || 0), 0);
                        const pctVivos        = base > 0 && calibresPollos > 0 ? +(calibresPollos / base * 100).toFixed(1) : null;
                        const pctMuertos      = base > 0 && lote.muertos        ? +(lote.muertos / base * 100).toFixed(1)               : null;
                        const pctDecomisados  = base > 0 && lote.unidadesDecomisadas ? +(lote.unidadesDecomisadas / base * 100).toFixed(1) : null;
                        const pctTrozados     = base > 0 && lote.unidadesTrozadas    ? +(lote.unidadesTrozadas / base * 100).toFixed(1)    : null;
                        return (
                          <tr key={lote._id}>
                            <td>
                              {lote.numeroLote
                                ? <span className="badge bg-dark">#{lote.numeroLote}</span>
                                : <span className="text-muted">—</span>}
                            </td>
                            <td className="text-muted" style={{ whiteSpace: "nowrap" }}>
                              {new Date(lote.fechaIngreso).toLocaleDateString("es-AR")}
                            </td>

                            {/* Vivos und */}
                            <td className="text-end border-start fw-semibold">
                              {base > 0 ? fmtNum(base) : "—"}
                            </td>
                            {/* Vivos % (calibres/vivos) */}
                            <td className="text-end text-muted">
                              {pctVivos != null ? `${pctVivos}%` : "—"}
                            </td>

                            {/* Muertos und */}
                            <td className="text-end border-start">
                              {lote.muertos ? fmtNum(lote.muertos) : "—"}
                            </td>
                            {/* Muertos kg */}
                            <td className="text-end text-muted">
                              {lote.kgMuertos ? `${fmtNum(lote.kgMuertos)} kg` : "—"}
                            </td>
                            {/* Muertos % */}
                            <td className="text-end" style={{ color: pctMuertos > 3 ? "#dc2626" : "#6c757d" }}>
                              {pctMuertos != null ? `${pctMuertos}%` : "—"}
                            </td>

                            {/* Decomisados und */}
                            <td className="text-end border-start">
                              {lote.unidadesDecomisadas ? fmtNum(lote.unidadesDecomisadas) : "—"}
                            </td>
                            {/* Decomisados kg */}
                            <td className="text-end text-muted">
                              {lote.kgDecomisados ? `${fmtNum(lote.kgDecomisados)} kg` : "—"}
                            </td>
                            {/* Decomisados % */}
                            <td className="text-end" style={{ color: pctDecomisados > 1 ? "#dc2626" : "#6c757d" }}>
                              {pctDecomisados != null ? `${pctDecomisados}%` : "—"}
                            </td>

                            {/* Cajones + calibres */}
                            <td className="border-start">
                              <div className="fw-semibold text-primary text-center mb-1">{fmtNum(totalCajones)} caj</div>
                              <div className="d-flex flex-wrap gap-1 justify-content-center">
                                {(lote.calibres || []).map((c) => (
                                  <span key={c.calibre} className="badge" style={{ background: "#eff6ff", color: "#1d4ed8", fontSize: "0.65rem" }}>
                                    {c.calibre}: {fmtNum(c.cajones)}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Trozados und */}
                            <td className="text-end border-start">
                              {lote.unidadesTrozadas ? fmtNum(lote.unidadesTrozadas) : "—"}
                            </td>
                            {/* Trozados kg */}
                            <td className="text-end text-muted">
                              {kgTrozadosReal > 0 ? `${fmtNum(kgTrozadosReal)} kg` : "—"}
                            </td>
                            {/* Trozados % */}
                            <td className="text-end text-muted">
                              {pctTrozados != null ? `${pctTrozados}%` : "—"}
                            </td>

                            {/* Ingreso Cámara */}
                            <td className="text-end fw-semibold border-start">
                              {kgTotalCamara > 0 ? `${fmtNum(kgTotalCamara)} kg` : fmtNum(lote.pesoTotal) ? `${fmtNum(lote.pesoTotal)} kg` : "—"}
                            </td>

                            {/* Rendimiento */}
                            <td className="text-end border-start">
                              {lote.rendimientoFaena != null
                                ? <span className="fw-semibold text-success">{fmtNum(lote.rendimientoFaena)}%</span>
                                : "—"}
                            </td>

                            {/* Acciones */}
                            <td>
                              <div className="d-flex gap-1">
                                {puedeCrear && (
                                  <button className="btn btn-outline-primary btn-sm" onClick={() => setLoteEditando(lote)}>
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                )}
                                {esSuperAdmin && (
                                  <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(lote)}>
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
              </div>
            </div>

            {/* ── Paginador ── */}
            {totalPaginas > 1 && (
              <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`btn btn-sm ${pagina === p ? "btn-dark" : "btn-outline-secondary"}`}
                    onClick={() => setPagina(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}

      </div>

      {loteEditando && (
        <EditarLoteModal
          lote={loteEditando}
          onClose={() => setLoteEditando(null)}
          onGuardado={() => { setLoteEditando(null); cargarLotes(); }}
        />
      )}
    </Layout>
  );
};

export default LoteCreatePage;
