import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import { obtenerLotesGranja, actualizarLoteGranja, eliminarLoteGranja } from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 30;

const GRANJA_OPTS = [
  { value: "cañete",    label: "Cañete",    galpones: 6 },
  { value: "los_pinos", label: "Los Pinos", galpones: 8 },
];

const GRANJAS_LABEL = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJAS_PREFIX = { cañete: "C", los_pinos: "P" };

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
              <form id="form-hist-editar" onSubmit={handleSubmit}>
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
                    <div className="form-text">Actual: {lote.cantidadIngreso}</div>
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
              <button type="submit" form="form-hist-editar" className="btn btn-primary" disabled={saving}>
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

const GranjaHistorialPage = () => {
  const rolUsuario  = localStorage.getItem("rolUsuario");
  const puedeEditar  = rolUsuario === "superadmin" || rolUsuario === "frigorifico";
  const esSuperAdmin = rolUsuario === "superadmin";

  const [lotes, setLotes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editLote, setEditLote] = useState(null);
  const [pagina, setPagina]     = useState(1);

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
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarLotes(); }, [cargarLotes]);

  // Resetear página al cambiar filtros
  useEffect(() => { setPagina(1); }, [filtroGranja, filtroEstado, filtroGalpon, filtroTexto]);

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

  const lotesFiltrados = lotes.filter((l) => {
    if (filtroGranja && l.granja !== filtroGranja) return false;
    if (filtroEstado && l.estado !== filtroEstado) return false;
    if (filtroGalpon && l.galpon !== Number(filtroGalpon)) return false;
    if (filtroTexto) {
      const txt = filtroTexto.toLowerCase();
      const matchLote = String(l.numeroLote).includes(txt);
      const matchProv = (l.proveedor || "").toLowerCase().includes(txt);
      if (!matchLote && !matchProv) return false;
    }
    return true;
  });

  const totalFiltrados = lotesFiltrados.length;
  const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
  const lotesPagina = lotesFiltrados.slice(inicio, inicio + ITEMS_POR_PAGINA);

  const limpiarFiltros = () => {
    setFiltroGranja("");
    setFiltroEstado("");
    setFiltroGalpon("");
    setFiltroTexto("");
  };

  const hayFiltros = filtroGranja || filtroEstado || filtroGalpon || filtroTexto;

  const maxGalponesGranja = filtroGranja
    ? GRANJA_OPTS.find((g) => g.value === filtroGranja)?.galpones || 8
    : 8;

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-clock-history me-2 text-success"></i>
            Historial de Ingresos
          </h1>
          <span className="text-muted small">{totalFiltrados} registros</span>
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-sm-6 col-md-3">
                <label className="form-label small mb-1 text-muted">Buscar</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="N° lote o enviado por..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                />
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small mb-1 text-muted">Granja</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroGranja}
                  onChange={(e) => { setFiltroGranja(e.target.value); setFiltroGalpon(""); }}
                >
                  <option value="">Todas</option>
                  {GRANJA_OPTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label small mb-1 text-muted">Galpón</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroGalpon}
                  onChange={(e) => setFiltroGalpon(e.target.value)}
                >
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
                <select
                  className="form-select form-select-sm"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="en_crianza">En crianza</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                {hayFiltros && (
                  <button className="btn btn-outline-secondary btn-sm w-100" onClick={limpiarFiltros}>
                    <i className="bi bi-x-circle me-1"></i>Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success"></div>
              </div>
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
                          {formatearFechaLocal(lote.fechaIngreso)} · {lote.cantidadIngreso.toLocaleString("es-AR")} ingresados · {lote.cantidadActual.toLocaleString("es-AR")} actuales
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
                        <th className="text-end">Actuales</th>
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

export default GranjaHistorialPage;
