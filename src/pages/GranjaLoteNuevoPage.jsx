import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  crearLoteGranja,
  obtenerLotesGranja,
  actualizarLoteGranja,
  eliminarLoteGranja,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GALPONES        = { cañete: 6, los_pinos: 8 };
const GRANJA_OPTS     = [
  { value: "cañete",    label: "Cañete",    galpones: 6 },
  { value: "los_pinos", label: "Los Pinos", galpones: 8 },
];
const GRANJAS_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJAS_PREFIX = { cañete: "C", los_pinos: "P" };
const ITEMS_POR_PAGINA = 30;

const FORM_VACIO = {
  granja: "", galpon: "", fechaIngreso: obtenerFechaHoy(),
  cantidadIngreso: "", bajasIngreso: "", motivoBajas: "",
  proveedor: "", observaciones: "",
};

// ── Modal nuevo ingreso ─────────────────────────────────────────────────────
const NuevoIngresoModal = ({ onClose, onCreado, ocupados }) => {
  const [form, setForm]     = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);

  const maxGalpones  = form.granja ? GALPONES[form.granja] : 0;
  const estaOcupado  = (granja, galpon) => !!(ocupados[granja]?.has(galpon));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value, ...(name === "granja" ? { galpon: "" } : {}) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.granja || !form.galpon || !form.cantidadIngreso) {
      Swal.fire("Faltan datos", "Completá granja, galpón y cantidad.", "warning");
      return;
    }
    if (Number(form.bajasIngreso) > 0 && !form.motivoBajas.trim()) {
      Swal.fire("Faltan datos", "Indicá el motivo de las bajas.", "warning");
      return;
    }
    setSaving(true);
    try {
      const lote = await crearLoteGranja({
        granja:          form.granja,
        galpon:          Number(form.galpon),
        fechaIngreso:    ajustarFechaParaGuardar(form.fechaIngreso),
        cantidadIngreso: Number(form.cantidadIngreso),
        bajasIngreso:    form.bajasIngreso ? Number(form.bajasIngreso) : undefined,
        motivoBajas:     form.motivoBajas.trim() || undefined,
        proveedor:       form.proveedor || undefined,
        observaciones:   form.observaciones || undefined,
      });
      onCreado();
      Swal.fire({
        icon: "success",
        title: `Lote #${lote.numeroLote} creado`,
        text: `${Number(form.cantidadIngreso).toLocaleString("es-AR")} pollitos — ${GRANJAS_LABEL[form.granja]}, Galpón ${form.galpon}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el lote.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-plus-circle me-2"></i>Nuevo ingreso de pollitos
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-nuevo-ingreso" onSubmit={handleSubmit}>

                {/* Granja */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Granja</label>
                  <div className="d-flex gap-2">
                    {GRANJA_OPTS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        className={`btn flex-grow-1 py-2 ${form.granja === g.value ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={() => setForm((p) => ({ ...p, granja: g.value, galpon: "" }))}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Galpón */}
                <div className="mb-3">
                  <label className={`form-label fw-semibold ${!form.granja ? "text-muted" : ""}`}>Galpón</label>
                  {!form.granja ? (
                    <p className="text-muted small mb-0">Primero elegí la granja</p>
                  ) : (
                    <>
                      <div className="d-flex flex-wrap gap-2">
                        {Array.from({ length: maxGalpones }, (_, i) => i + 1).map((n) => {
                          const ocupado     = estaOcupado(form.granja, n);
                          const seleccionado = form.galpon == n;
                          return (
                            <button
                              key={n}
                              type="button"
                              className={`btn ${ocupado ? "btn-danger disabled" : seleccionado ? "btn-success" : "btn-outline-secondary"}`}
                              style={{ minWidth: "3rem" }}
                              disabled={ocupado}
                              onClick={() => !ocupado && setForm((p) => ({ ...p, galpon: n }))}
                              title={ocupado ? "Galpón ocupado" : `Galpón ${n}`}
                            >
                              {ocupado ? <i className="bi bi-lock-fill"></i> : n}
                            </button>
                          );
                        })}
                      </div>
                      {Object.keys(ocupados).length > 0 && (
                        <div className="mt-2 small text-muted">
                          <span className="badge bg-danger me-1"><i className="bi bi-lock-fill"></i></span>
                          Galpón ocupado — en crianza activa
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Fecha + Cantidad */}
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha de ingreso</label>
                    <input type="date" name="fechaIngreso" className="form-control"
                      value={form.fechaIngreso} onChange={handleChange} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad</label>
                    <input type="number" name="cantidadIngreso" className="form-control"
                      value={form.cantidadIngreso} onChange={handleChange}
                      min="1" placeholder="Ej: 12000" required />
                    <div className="form-text">Pollitos</div>
                  </div>
                </div>

                {/* Bajas */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Bajas en el ingreso</label>
                  <input type="number" name="bajasIngreso" className="form-control"
                    value={form.bajasIngreso} onChange={handleChange}
                    min="0" placeholder="0 si no hubo bajas" />
                </div>

                {Number(form.bajasIngreso) > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Motivo de las bajas <span className="text-danger">*</span>
                    </label>
                    <input type="text" name="motivoBajas" className="form-control"
                      value={form.motivoBajas} onChange={handleChange}
                      placeholder="Ej: muertos en transporte, aplaste..." required autoFocus />
                    <div className="form-text text-danger">Campo obligatorio cuando hay bajas.</div>
                  </div>
                )}

                {/* Enviado por */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Enviado por <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input type="text" name="proveedor" className="form-control"
                    value={form.proveedor} onChange={handleChange}
                    placeholder="Nombre de quien envía los pollitos" />
                </div>

                {/* Observaciones */}
                <div className="mb-2">
                  <label className="form-label fw-semibold">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea name="observaciones" className="form-control" rows={2}
                    value={form.observaciones} onChange={handleChange}
                    placeholder="Cualquier dato adicional..." />
                </div>

              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" form="form-nuevo-ingreso" className="btn btn-success" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-circle me-1"></i>Registrar ingreso
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal editar ingreso ────────────────────────────────────────────────────
const EditarIngresoModal = ({ lote, onClose, onGuardado }) => {
  const [form, setForm]     = useState({
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
                    <select className="form-select" value={form.granja}
                      onChange={(e) => setForm({ ...form, granja: e.target.value, galpon: 1 })} required>
                      {GRANJA_OPTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Galpón</label>
                    <input type="number" className="form-control" value={form.galpon}
                      onChange={(e) => setForm({ ...form, galpon: e.target.value })}
                      min="1" max={maxGalpones} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha de ingreso</label>
                    <input type="date" className="form-control" value={form.fechaIngreso}
                      onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad</label>
                    <input type="number" className="form-control" value={form.cantidadIngreso}
                      onChange={(e) => setForm({ ...form, cantidadIngreso: e.target.value })}
                      min="1" required />
                    <div className="form-text">Actual: {lote.cantidadIngreso}</div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Enviado por (opcional)</label>
                    <input type="text" className="form-control" value={form.proveedor}
                      onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Observaciones (opcional)</label>
                    <textarea className="form-control" rows={2} value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
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

// ── Página principal ────────────────────────────────────────────────────────
const GranjaLoteNuevoPage = () => {
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const puedeEditar  = rolUsuario === "superadmin" || rolUsuario === "frigorifico";
  const esSuperAdmin = rolUsuario === "superadmin";

  const [lotes, setLotes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [ocupados, setOcupados] = useState({});
  const [showNuevo, setShowNuevo] = useState(false);
  const [editLote, setEditLote]   = useState(null);
  const [pagina, setPagina]       = useState(1);

  // Filtros
  const [filtroGranja, setFiltroGranja] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroGalpon, setFiltroGalpon] = useState("");
  const [filtroTexto, setFiltroTexto]   = useState("");

  const cargarLotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerLotesGranja();
      setLotes(data);
      // Armar mapa de galpones ocupados (en_crianza)
      const mapa = {};
      for (const l of data) {
        if (l.estado !== "en_crianza") continue;
        if (!mapa[l.granja]) mapa[l.granja] = new Set();
        mapa[l.granja].add(l.galpon);
      }
      setOcupados(mapa);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);
  useEffect(() => { setPagina(1); }, [filtroGranja, filtroEstado, filtroGalpon, filtroTexto]);

  const handleEliminar = async (lote) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar ingreso?",
      html: `Se eliminará el lote <strong>#${lote.numeroLote}</strong> y todos sus registros.`,
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#dc3545", confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar",
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

  const lotesFiltrados = lotes.filter((l) => {
    if (filtroGranja && l.granja !== filtroGranja) return false;
    if (filtroEstado && l.estado !== filtroEstado) return false;
    if (filtroGalpon && l.galpon !== Number(filtroGalpon)) return false;
    if (filtroTexto) {
      const txt = filtroTexto.toLowerCase();
      if (!String(l.numeroLote).includes(txt) && !(l.proveedor || "").toLowerCase().includes(txt))
        return false;
    }
    return true;
  });

  const totalFiltrados = lotesFiltrados.length;
  const inicio         = (pagina - 1) * ITEMS_POR_PAGINA;
  const lotesPagina    = lotesFiltrados.slice(inicio, inicio + ITEMS_POR_PAGINA);
  const hayFiltros     = filtroGranja || filtroEstado || filtroGalpon || filtroTexto;
  const maxGalponesGranja = filtroGranja
    ? GRANJA_OPTS.find((g) => g.value === filtroGranja)?.galpones || 8
    : 8;

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-seam me-2 text-success"></i>
            Ingreso de Pollitos
          </h1>
          <div className="d-flex align-items-center gap-3">
            <span className="text-muted small">{totalFiltrados} registros</span>
            {puedeEditar && (
              <button className="btn btn-success" onClick={() => setShowNuevo(true)}>
                <i className="bi bi-plus-circle me-1"></i>Nuevo ingreso
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label small mb-1 text-muted">Buscar</label>
                <input type="text" className="form-control form-control-sm"
                  placeholder="N° lote o enviado por..."
                  value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small mb-1 text-muted">Granja</label>
                <select className="form-select form-select-sm" value={filtroGranja}
                  onChange={(e) => { setFiltroGranja(e.target.value); setFiltroGalpon(""); }}>
                  <option value="">Todas</option>
                  {GRANJA_OPTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small mb-1 text-muted">Galpón</label>
                <select className="form-select form-select-sm" value={filtroGalpon}
                  onChange={(e) => setFiltroGalpon(e.target.value)}>
                  <option value="">Todos</option>
                  {Array.from({ length: maxGalponesGranja }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {filtroGranja ? `${GRANJAS_PREFIX[filtroGranja]}${n}` : n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small mb-1 text-muted">Estado</label>
                <select className="form-select form-select-sm" value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="en_crianza">En crianza</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                {hayFiltros && (
                  <button className="btn btn-outline-secondary btn-sm w-100"
                    onClick={() => { setFiltroGranja(""); setFiltroEstado(""); setFiltroGalpon(""); setFiltroTexto(""); }}>
                    <i className="bi bi-x-circle me-1"></i>Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla / lista */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
            ) : lotesPagina.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">
                {hayFiltros ? "No hay registros que coincidan con los filtros." : "Sin ingresos registrados."}
              </p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {lotesPagina.map((lote) => (
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
                              <button className="btn btn-outline-primary btn-sm" onClick={() => setEditLote(lote)}>
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
                        <div className="small text-muted">
                          {GRANJAS_LABEL[lote.granja]} — Galpón {GRANJAS_PREFIX[lote.granja]}{lote.galpon}
                        </div>
                        <div className="small">
                          {formatearFechaLocal(lote.fechaIngreso)} · {lote.cantidadIngreso.toLocaleString("es-AR")} ingresados
                          {lote.bajasIngreso > 0 && (
                            <span className="text-danger"> · {lote.bajasIngreso.toLocaleString("es-AR")} bajas</span>
                          )}
                        </div>
                        {lote.proveedor && <div className="small text-muted">{lote.proveedor}</div>}
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
                        <th className="text-end">Bajas ing.</th>
                        <th>Enviado por</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lotesPagina.map((lote) => (
                        <tr key={lote._id}>
                          <td><span className="badge bg-dark">#{lote.numeroLote}</span></td>
                          <td>{GRANJAS_LABEL[lote.granja] || lote.granja}</td>
                          <td className="fw-semibold">{GRANJAS_PREFIX[lote.granja]}{lote.galpon}</td>
                          <td>{formatearFechaLocal(lote.fechaIngreso)}</td>
                          <td className="text-end">{lote.cantidadIngreso.toLocaleString("es-AR")}</td>
                          <td className="text-end">
                            {lote.bajasIngreso > 0
                            ? <span className="text-danger fw-semibold">{lote.bajasIngreso.toLocaleString("es-AR")}</span>
                            : <span className="text-muted">—</span>
                          }
                          </td>
                          <td className="text-muted small">{lote.proveedor || "—"}</td>
                          <td>
                            <span className={`badge ${lote.estado === "en_crianza" ? "bg-success" : "bg-secondary"}`}>
                              {lote.estado === "en_crianza" ? "En crianza" : "Finalizado"}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              {puedeEditar && (
                                <button className="btn btn-outline-primary btn-sm" onClick={() => setEditLote(lote)}>
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
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-3 pb-3">
                  <Pagination
                    currentPage={pagina}
                    totalItems={totalFiltrados}
                    itemsPerPage={ITEMS_POR_PAGINA}
                    onPageChange={setPagina}
                  />
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {showNuevo && (
        <NuevoIngresoModal
          ocupados={ocupados}
          onClose={() => setShowNuevo(false)}
          onCreado={() => { setShowNuevo(false); cargarLotes(); }}
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

export default GranjaLoteNuevoPage;
