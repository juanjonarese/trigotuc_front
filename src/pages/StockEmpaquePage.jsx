import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerStockArticulos,
  obtenerStockEstadisticas,
  crearStockArticulo,
  actualizarStockArticulo,
  eliminarStockArticulo,
  registrarStockMovimiento,
  obtenerStockMovimientos,
  obtenerProveedoresEmpaque,
  crearProveedorEmpaque,
  actualizarProveedorEmpaque,
  eliminarProveedorEmpaque,
} from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const rolUsuario  = () => localStorage.getItem("rolUsuario");
const esAdmin     = () => ["superadmin", "administracion"].includes(rolUsuario());
const esSuperAdmin = () => rolUsuario() === "superadmin";

const fmtNum   = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";

const nivelStock = (a) => {
  if (a.stockActual < 0)                                     return "negativo";
  if (a.stockActual === 0)                                   return "sinstock";
  if (a.stockCritico > 0 && a.stockActual <= a.stockCritico) return "critico";
  return "ok";
};

const NIVEL_CFG = {
  ok:       { bg: "#f0fdf4", border: "#16a34a", numColor: "#15803d", icon: "bi-check-circle-fill",        iconColor: "#16a34a", badge: null },
  critico:  { bg: "#fef2f2", border: "#dc2626", numColor: "#b91c1c", icon: "bi-exclamation-triangle-fill", iconColor: "#dc2626", badge: { text: "Hacer pedido",   cls: "bg-danger"    } },
  sinstock: { bg: "#f3f4f6", border: "#6b7280", numColor: "#4b5563", icon: "bi-dash-circle-fill",          iconColor: "#6b7280", badge: { text: "Sin stock",      cls: "bg-secondary" } },
  negativo: { bg: "#fff1f2", border: "#be123c", numColor: "#be123c", icon: "bi-exclamation-octagon-fill",  iconColor: "#be123c", badge: { text: "Stock negativo", cls: "bg-danger"    } },
};

const colorPorStock = (a) => NIVEL_CFG[nivelStock(a)];

const badgeTipo = (tipo) => {
  if (tipo === "entrada")  return <span className="badge bg-success">Entrada</span>;
  if (tipo === "salida")   return <span className="badge bg-danger">Salida</span>;
  if (tipo === "descarte") return <span className="badge bg-warning text-dark">Descarte</span>;
  return <span className="badge bg-secondary">Ajuste</span>;
};

// ── Tarjeta artículo ───────────────────────────────────────────────────────────
const ArticuloCard = ({ articulo, onClick }) => {
  const nivel = nivelStock(articulo);
  const cfg   = NIVEL_CFG[nivel];

  return (
    <div
      className="card border-0 shadow-sm"
      style={{ cursor: "pointer", background: cfg.bg, borderLeft: `5px solid ${cfg.border}` }}
      onClick={() => onClick(articulo)}
    >
      <div className="p-3">
        <div className="d-flex align-items-start justify-content-between gap-1 mb-2">
          <div className="fw-semibold small lh-sm text-start" title={articulo.nombre} style={{ wordBreak: "break-word" }}>
            {articulo.nombre}
          </div>
          <i className={`bi ${cfg.icon} flex-shrink-0`} style={{ color: cfg.iconColor, fontSize: "1.1rem" }}></i>
        </div>
        <div className="fw-bold text-center" style={{ fontSize: "2.2rem", color: cfg.numColor, lineHeight: 1 }}>
          {fmtNum(articulo.stockActual)}
        </div>
        <div className="text-muted small text-center mt-1">{articulo.unidad}</div>
        {cfg.badge && (
          <div className="text-center mt-2">
            <span className={`badge ${cfg.badge.cls}`}>{cfg.badge.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Modal detalle + historial ──────────────────────────────────────────────────
const ArticuloModal = ({ articulo, onClose, onMovimiento, onEditar, onEliminar }) => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ tipo: "entrada", cantidad: "", motivo: "", fecha: obtenerFechaHoy() });
  const [submitting, setSubmitting]   = useState(false);

  const cargarMovimientos = useCallback(async () => {
    try {
      const data = await obtenerStockMovimientos(articulo._id);
      setMovimientos(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [articulo._id]);

  useEffect(() => { cargarMovimientos(); }, [cargarMovimientos]);

  const handleMovimiento = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await registrarStockMovimiento({
        articulo: articulo._id,
        tipo:     form.tipo,
        cantidad: Number(form.cantidad),
        motivo:   form.motivo || undefined,
        fecha:    form.fecha,
      });
      onMovimiento(result.articulo);
      setShowForm(false);
      setForm({ tipo: "entrada", cantidad: "", motivo: "", fecha: obtenerFechaHoy() });
      await cargarMovimientos();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const { border } = colorPorStock(articulo);

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header" style={{ borderTop: `4px solid ${border}` }}>
            <div>
              <h5 className="modal-title mb-0">{articulo.nombre}</h5>
              <div className="small text-muted mt-1">
                Stock actual: <strong>{fmtNum(articulo.stockActual)} {articulo.unidad}</strong>
                {articulo.stockCritico > 0 && ` · stock crítico: ${fmtNum(articulo.stockCritico)}`}
                {articulo.descripcion && <> · {articulo.descripcion}</>}
              </div>
            </div>
            <button className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {/* Botón registrar movimiento + acciones */}
            <div className="d-flex gap-2 mb-3">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowForm(!showForm)}
              >
                <i className={`bi bi-${showForm ? "dash" : "plus"}-circle me-1`}></i>
                {showForm ? "Cancelar" : "Registrar movimiento"}
              </button>
              {esAdmin() && (
                <button className="btn btn-outline-secondary btn-sm" onClick={() => onEditar(articulo)} title="Editar">
                  <i className="bi bi-pencil"></i>
                </button>
              )}
              {esSuperAdmin() && (
                <button className="btn btn-outline-danger btn-sm" onClick={() => onEliminar(articulo)} title="Eliminar">
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>

            {/* Formulario movimiento */}
            {showForm && (
              <div className="card border-primary mb-3">
                <div className="card-body py-3">
                  <form onSubmit={handleMovimiento}>
                    <div className="row g-3">
                      <div className="col-12 col-sm-4">
                        <label className="form-label fw-semibold small">Tipo</label>
                        <select
                          className="form-select form-select-sm"
                          value={form.tipo}
                          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                        >
                          <option value="entrada">Entrada</option>
                          <option value="salida">Salida</option>
                          <option value="ajuste">Ajuste (nuevo total)</option>
                        </select>
                      </div>
                      <div className="col-6 col-sm-4">
                        <label className="form-label fw-semibold small">
                          {form.tipo === "ajuste" ? "Nuevo total" : "Cantidad"}
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={form.cantidad}
                          onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                          min="0"
                          step="1"
                          placeholder="0"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="col-6 col-sm-4">
                        <label className="form-label fw-semibold small">Fecha</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={form.fecha}
                          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label small">Motivo <span className="text-muted">(opcional)</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={form.motivo}
                          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                          placeholder="Ej: Compra, Consumo faena..."
                        />
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-3">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                        {submitting && <span className="spinner-border spinner-border-sm me-1"></span>}
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setShowForm(false)}
                        disabled={submitting}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Historial */}
            <h6 className="fw-semibold mb-2">
              <i className="bi bi-clock-history me-1"></i>Historial de movimientos
            </h6>
            {loading ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-primary"></div>
              </div>
            ) : movimientos.length === 0 ? (
              <p className="text-muted text-center py-3 small mb-0">Sin movimientos registrados.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th className="text-end">Cantidad</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m._id}>
                        <td className="small text-muted">{fmtFecha(m.fecha)}</td>
                        <td>{badgeTipo(m.tipo)}</td>
                        <td className="text-end fw-semibold">{fmtNum(m.cantidad)}</td>
                        <td className="small text-muted">{m.motivo || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal crear / editar artículo ─────────────────────────────────────────────
const ArticuloFormModal = ({ articulo, onClose, onGuardado }) => {
  const isEdit = !!articulo;
  const [form, setForm] = useState({
    nombre:       articulo?.nombre       || "",
    descripcion:  articulo?.descripcion  || "",
    unidad:       articulo?.unidad       || "u",
    stockActual:  articulo?.stockActual  ?? 0,
    stockCritico: articulo?.stockCritico ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await actualizarStockArticulo(articulo._id, form);
      } else {
        await crearStockArticulo(form);
      }
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" style={{ zIndex: 1060 }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className={`bi bi-${isEdit ? "pencil" : "plus-circle"} me-2`}></i>
                {isEdit ? "Editar artículo" : "Nuevo artículo"}
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-articulo-stock" onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Nombre <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Ej: Bolsas, Cajas, Cajones..."
                      required
                      autoFocus
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Descripción <span className="text-muted">(opcional)</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.descripcion}
                      onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                      placeholder="Detalle adicional..."
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Unidad <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.unidad}
                      onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                      placeholder="u, kg, paq, rollo..."
                      required
                    />
                    <div className="form-text">u = unidades, paq = paquetes...</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Stock crítico</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.stockCritico}
                      onChange={(e) => setForm({ ...form, stockCritico: e.target.value })}
                      min="0"
                      placeholder="0"
                    />
                    <div className="form-text">La tarjeta se pone roja cuando el stock llega a este valor</div>
                  </div>
                  {!isEdit && (
                    <div className="col-6">
                      <label className="form-label fw-semibold">Stock inicial</label>
                      <input
                        type="number"
                        className="form-control"
                        value={form.stockActual}
                        onChange={(e) => setForm({ ...form, stockActual: e.target.value })}
                        min="0"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-articulo-stock" className="btn btn-primary" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                {isEdit ? "Guardar cambios" : "Crear artículo"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" style={{ zIndex: 1055 }}></div>
    </>
  );
};

// ── Normalizar número WhatsApp argentino ──────────────────────────────────────
const normalizarWhatsapp = (num) => {
  // Elimina todo lo que no sea dígito
  let n = num.replace(/\D/g, "");
  // Si empieza con +, ya está eliminado. Si empieza con 54, OK.
  // Si empieza con 0, quitar el 0 inicial y agregar 54
  if (n.startsWith("0")) n = "54" + n.slice(1);
  // Si no empieza con 54, agregar prefijo
  if (!n.startsWith("54")) n = "54" + n;
  return n;
};

// ── Modal hacer pedido por WhatsApp ──────────────────────────────────────────
const PedidoWhatsAppModal = ({ articulos, onClose }) => {
  const [tab, setTab]                     = useState("presupuesto"); // "presupuesto" | "pedido"
  const [proveedores, setProveedores]     = useState([]);
  const [proveedorId, setProveedorId]     = useState("");
  const [loadingProv, setLoadingProv]     = useState(true);

  // — tab presupuesto —
  const [seleccionados, setSeleccionados] = useState({});

  // — tab pedido —
  const [cantidades, setCantidades]       = useState({});

  useEffect(() => {
    obtenerProveedoresEmpaque()
      .then((data) => {
        setProveedores(data);
        if (data.length === 1) setProveedorId(data[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingProv(false));
  }, []);

  // Pre-tilda artículos con stock bajo para el tab presupuesto
  useEffect(() => {
    const init = {};
    articulos.forEach((a) => { init[a._id] = nivelStock(a) !== "ok"; });
    setSeleccionados(init);
  }, [articulos]);

  const proveedor = proveedores.find((p) => p._id === proveedorId);

  // — Presupuesto —
  const toggleArticulo = (id) =>
    setSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }));
  const marcarTodos = (val) => {
    const nuevo = {};
    articulos.forEach((a) => { nuevo[a._id] = val; });
    setSeleccionados(nuevo);
  };
  const seleccionadosList = articulos.filter((a) => seleccionados[a._id]);

  const abrirWAPresupuesto = () => {
    if (!proveedor) { Swal.fire("Seleccioná un proveedor", "", "warning"); return; }
    if (seleccionadosList.length === 0) { Swal.fire("Tildá al menos un artículo", "", "warning"); return; }
    const lista = seleccionadosList.map((a) => `• ${a.nombre}`).join("\n");
    const msg =
      `Hola ${proveedor.nombre}! 👋 Soy Trigotuc Avícola.\n` +
      `Quisiera consultar precios de los siguientes artículos:\n\n${lista}\n\nMuchas gracias!`;
    window.open(`https://wa.me/${normalizarWhatsapp(proveedor.whatsapp)}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // — Pedido —
  const setCantidad = (id, val) =>
    setCantidades((prev) => ({ ...prev, [id]: val }));

  const autocompletarPedido = () => {
    const nuevo = {};
    articulos.forEach((a) => {
      const falta = (a.stockObjetivo || 0) - a.stockActual;
      nuevo[a._id] = falta > 0 ? String(falta) : (cantidades[a._id] || "");
    });
    setCantidades(nuevo);
  };

  const lineasPedido = articulos.filter((a) => Number(cantidades[a._id]) > 0);

  const abrirWAPedido = () => {
    if (!proveedor) { Swal.fire("Seleccioná un proveedor", "", "warning"); return; }
    if (lineasPedido.length === 0) { Swal.fire("Ingresá al menos una cantidad", "", "warning"); return; }
    const lista = lineasPedido
      .map((a) => `• ${a.nombre}: ${fmtNum(Number(cantidades[a._id]))} ${a.unidad}`)
      .join("\n");
    const msg =
      `Hola ${proveedor.nombre}! 👋 Soy Trigotuc Avícola.\n` +
      `Quisiera hacer el siguiente pedido:\n\n${lista}\n\nMuchas gracias!`;
    window.open(`https://wa.me/${normalizarWhatsapp(proveedor.whatsapp)}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const selectorProveedor = (
    <div className="mb-3">
      <label className="form-label fw-semibold">Proveedor</label>
      {loadingProv ? (
        <div className="text-muted small">Cargando proveedores...</div>
      ) : proveedores.length === 0 ? (
        <div className="alert alert-warning py-2 small mb-0">
          <i className="bi bi-exclamation-triangle me-1"></i>
          No hay proveedores cargados. Cerrá este modal y usá "Gestionar proveedores".
        </div>
      ) : (
        <select
          className="form-select"
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
        >
          <option value="">— Seleccionar proveedor —</option>
          {proveedores.map((p) => (
            <option key={p._id} value={p._id}>{p.nombre} — {p.whatsapp}</option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header" style={{ borderTop: "4px solid #25d366" }}>
            <h5 className="modal-title mb-0">
              <i className="bi bi-whatsapp me-2" style={{ color: "#25d366" }}></i>
              WhatsApp — Empaque
            </h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>

          {/* Tabs */}
          <div className="px-3 pt-3 pb-0 border-bottom">
            <ul className="nav nav-tabs border-0">
              <li className="nav-item">
                <button
                  className={`nav-link ${tab === "presupuesto" ? "active fw-semibold" : "text-muted"}`}
                  onClick={() => setTab("presupuesto")}
                >
                  <i className="bi bi-tag me-1"></i>Pedir precios
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${tab === "pedido" ? "active fw-semibold" : "text-muted"}`}
                  onClick={() => setTab("pedido")}
                >
                  <i className="bi bi-cart me-1"></i>Hacer pedido
                </button>
              </li>
            </ul>
          </div>

          <div className="modal-body">
            {selectorProveedor}

            {/* ── Tab: Presupuesto ── */}
            {tab === "presupuesto" && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-semibold mb-0">Artículos a consultar</label>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => marcarTodos(true)}>
                      Todos
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => marcarTodos(false)}>
                      Ninguno
                    </button>
                  </div>
                </div>

                {articulos.length === 0 ? (
                  <p className="text-muted text-center py-3 small">No hay artículos cargados.</p>
                ) : (
                  <div className="list-group list-group-flush border rounded">
                    {articulos.map((a) => {
                      const cfg = NIVEL_CFG[nivelStock(a)];
                      return (
                        <label
                          key={a._id}
                          className="list-group-item list-group-item-action d-flex align-items-center gap-3 py-2 px-3"
                          style={{ cursor: "pointer" }}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input flex-shrink-0 mt-0"
                            checked={!!seleccionados[a._id]}
                            onChange={() => toggleArticulo(a._id)}
                          />
                          <span className="flex-grow-1 fw-semibold small">{a.nombre}</span>
                          <span className="text-muted small">{fmtNum(a.stockActual)} {a.unidad}</span>
                          {cfg.badge
                            ? <span className={`badge ${cfg.badge.cls}`} style={{ fontSize: "0.7rem" }}>{cfg.badge.text}</span>
                            : <span className="badge bg-success" style={{ fontSize: "0.7rem" }}>OK</span>}
                        </label>
                      );
                    })}
                  </div>
                )}

                {seleccionadosList.length > 0 && proveedor && (
                  <div className="alert alert-success mt-3 py-2 small mb-0">
                    <i className="bi bi-check-circle me-1"></i>
                    Se consultará a <strong>{proveedor.nombre}</strong> por {seleccionadosList.length} artículo{seleccionadosList.length !== 1 ? "s" : ""}
                  </div>
                )}
              </>
            )}

            {/* ── Tab: Pedido ── */}
            {tab === "pedido" && (
              <>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-semibold mb-0">Cantidades a pedir</label>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={autocompletarPedido}
                    title="Completa con la cantidad necesaria para llegar al stock objetivo"
                  >
                    <i className="bi bi-lightning-charge me-1"></i>Auto según objetivo
                  </button>
                </div>

                {articulos.length === 0 ? (
                  <p className="text-muted text-center py-3 small">No hay artículos cargados.</p>
                ) : (
                  <div className="list-group list-group-flush border rounded">
                    {articulos.map((a) => {
                      const cfg       = NIVEL_CFG[nivelStock(a)];
                      const cantidad  = cantidades[a._id] || "";
                      const conCant   = Number(cantidad) > 0;
                      return (
                        <div
                          key={a._id}
                          className={`list-group-item d-flex align-items-center gap-3 py-2 px-3 ${conCant ? "list-group-item-success" : ""}`}
                        >
                          <div className="flex-grow-1">
                            <div className="fw-semibold small">{a.nombre}</div>
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              Stock actual: {fmtNum(a.stockActual)} {a.unidad}
                              {a.stockObjetivo > 0 && ` · objetivo: ${fmtNum(a.stockObjetivo)}`}
                            </div>
                          </div>
                          {cfg.badge
                            ? <span className={`badge ${cfg.badge.cls} d-none d-sm-inline`} style={{ fontSize: "0.7rem" }}>{cfg.badge.text}</span>
                            : null}
                          <div className="d-flex align-items-center gap-1" style={{ minWidth: 110 }}>
                            <input
                              type="number"
                              className="form-control form-control-sm text-end"
                              style={{ width: 80 }}
                              value={cantidad}
                              onChange={(e) => setCantidad(a._id, e.target.value)}
                              min="0"
                              placeholder="0"
                            />
                            <span className="text-muted small">{a.unidad}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {lineasPedido.length > 0 && proveedor && (
                  <div className="alert alert-success mt-3 py-2 small mb-0">
                    <i className="bi bi-check-circle me-1"></i>
                    Se pedirá a <strong>{proveedor.nombre}</strong>:{" "}
                    {lineasPedido.map((a) => `${fmtNum(Number(cantidades[a._id]))} ${a.unidad} de ${a.nombre}`).join(" · ")}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cerrar</button>
            {tab === "presupuesto" ? (
              <button
                className="btn fw-semibold"
                style={{ background: "#25d366", color: "#fff", borderColor: "#25d366" }}
                onClick={abrirWAPresupuesto}
                disabled={!proveedorId || seleccionadosList.length === 0}
              >
                <i className="bi bi-whatsapp me-1"></i>
                Consultar precios{seleccionadosList.length > 0 ? ` (${seleccionadosList.length})` : ""}
              </button>
            ) : (
              <button
                className="btn fw-semibold"
                style={{ background: "#25d366", color: "#fff", borderColor: "#25d366" }}
                onClick={abrirWAPedido}
                disabled={!proveedorId || lineasPedido.length === 0}
              >
                <i className="bi bi-whatsapp me-1"></i>
                Enviar pedido{lineasPedido.length > 0 ? ` (${lineasPedido.length})` : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal ABM proveedores ─────────────────────────────────────────────────────
const ProveedoresModal = ({ onClose }) => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [form, setForm]               = useState(null); // null = cerrado, {} = nuevo, {...} = editar
  const [saving, setSaving]           = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerProveedoresEmpaque();
      setProveedores(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form._id) {
        await actualizarProveedorEmpaque(form._id, { nombre: form.nombre, whatsapp: form.whatsapp });
      } else {
        await crearProveedorEmpaque({ nombre: form.nombre, whatsapp: form.whatsapp });
      }
      setForm(null);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (p) => {
    const ok = await Swal.fire({
      title: `¿Eliminar "${p.nombre}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await eliminarProveedorEmpaque(p._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  return (
    <>
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 1060 }}
        onClick={(e) => e.target === e.currentTarget && !form && onClose()}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header" style={{ borderTop: "4px solid #25d366" }}>
              <h5 className="modal-title mb-0">
                <i className="bi bi-person-lines-fill me-2" style={{ color: "#25d366" }}></i>
                Proveedores de empaque
              </h5>
              <button className="btn-close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              {/* Formulario inline */}
              {form && (
                <div className="card border-primary mb-3">
                  <div className="card-body py-3">
                    <h6 className="fw-semibold mb-3">{form._id ? "Editar proveedor" : "Nuevo proveedor"}</h6>
                    <form onSubmit={handleGuardar}>
                      <div className="mb-2">
                        <label className="form-label fw-semibold small">Nombre</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={form.nombre || ""}
                          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                          placeholder="Nombre del proveedor"
                          required
                          autoFocus
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-semibold small">Número WhatsApp</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={form.whatsapp || ""}
                          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                          placeholder="Ej: 3412345678 o 549XXXXXXXXXX"
                          required
                        />
                        <div className="form-text">
                          Ingresá el número sin espacios. Ej: <code>3412345678</code> (Rosario) o <code>1155556666</code> (CABA)
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                          {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                          {form._id ? "Guardar cambios" : "Crear proveedor"}
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setForm(null)} disabled={saving}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Lista */}
              {loading ? (
                <div className="text-center py-3">
                  <div className="spinner-border spinner-border-sm text-primary"></div>
                </div>
              ) : proveedores.length === 0 ? (
                <p className="text-muted text-center py-3 small mb-0">No hay proveedores cargados.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {proveedores.map((p) => (
                    <li key={p._id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div>
                        <div className="fw-semibold small">{p.nombre}</div>
                        <div className="text-muted small">
                          <i className="bi bi-whatsapp me-1" style={{ color: "#25d366" }}></i>
                          {p.whatsapp}
                        </div>
                      </div>
                      {esAdmin() && (
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => setForm({ _id: p._id, nombre: p.nombre, whatsapp: p.whatsapp })}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          {esSuperAdmin() && (
                            <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(p)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="modal-footer">
              {esAdmin() && !form && (
                <button className="btn btn-primary btn-sm me-auto" onClick={() => setForm({ nombre: "", whatsapp: "" })}>
                  <i className="bi bi-plus-circle me-1"></i>Agregar proveedor
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Modal carga masiva ────────────────────────────────────────────────────────
const CargaMasivaModal = ({ articulos, onClose, onGuardado }) => {
  const hoy = obtenerFechaHoy();
  const [lineas, setLineas]         = useState(
    articulos.map((a) => ({ _id: a._id, nombre: a.nombre, unidad: a.unidad, stockActual: a.stockActual, stockObjetivo: a.stockObjetivo, cantidad: "", motivo: "" }))
  );
  const [fecha, setFecha]           = useState(hoy);
  const [motivoGlobal, setMotivoGlobal] = useState("Recepción de pedido");
  const [submitting, setSubmitting] = useState(false);

  const setLinea = (id, campo, valor) =>
    setLineas((prev) => prev.map((l) => l._id === id ? { ...l, [campo]: valor } : l));

  // Pre-llenar con la diferencia hasta el objetivo
  const autocompletar = () => {
    setLineas((prev) => prev.map((l) => ({
      ...l,
      cantidad: l.stockObjetivo > 0 && l.stockActual < l.stockObjetivo
        ? String(l.stockObjetivo - l.stockActual)
        : l.cantidad,
    })));
  };

  const lineasConCantidad = lineas.filter((l) => Number(l.cantidad) > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lineasConCantidad.length === 0) {
      Swal.fire("Sin datos", "Ingresá al menos una cantidad a cargar.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        lineasConCantidad.map((l) =>
          registrarStockMovimiento({
            articulo: l._id,
            tipo:     "entrada",
            cantidad: Number(l.cantidad),
            motivo:   l.motivo || motivoGlobal || "Recepción de pedido",
            fecha,
          })
        )
      );
      onGuardado();
      Swal.fire({
        icon: "success",
        title: `${lineasConCantidad.length} artículo${lineasConCantidad.length > 1 ? "s" : ""} cargado${lineasConCantidad.length > 1 ? "s" : ""}`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header" style={{ borderTop: "4px solid #198754" }}>
              <div>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-box-arrow-in-down me-2 text-success"></i>Recepción de pedido
                </h5>
                <div className="small text-muted mt-1">
                  Ingresá las cantidades recibidas para actualizar el stock.
                </div>
              </div>
              <button className="btn-close" onClick={onClose} disabled={submitting}></button>
            </div>

            <div className="modal-body">
              <div className="row g-3 mb-3">
                <div className="col-12 col-sm-5">
                  <label className="form-label fw-semibold small">Fecha de recepción</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
                <div className="col-12 col-sm-7">
                  <label className="form-label fw-semibold small">Motivo <span className="text-muted fw-normal">(aplica a todos)</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={motivoGlobal}
                    onChange={(e) => setMotivoGlobal(e.target.value)}
                    placeholder="Recepción de pedido"
                  />
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Artículo</th>
                      <th className="text-center">Stock actual</th>
                      <th style={{ minWidth: 110 }}>Cant. recibida</th>
                      <th style={{ minWidth: 160 }}>Motivo <span className="text-muted fw-normal">(opc.)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l._id} className={Number(l.cantidad) > 0 ? "table-success table-success-subtle" : ""}>
                        <td className="fw-semibold small">{l.nombre}</td>
                        <td className="text-center small">
                          <span className="text-muted">{fmtNum(l.stockActual)}</span>
                          <span className="text-muted small ms-1">{l.unidad}</span>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={l.cantidad}
                            onChange={(e) => setLinea(l._id, "cantidad", e.target.value)}
                            min="0"
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={l.motivo}
                            onChange={(e) => setLinea(l._id, "motivo", e.target.value)}
                            placeholder={motivoGlobal || "Motivo..."}
                            disabled={!Number(l.cantidad)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {lineasConCantidad.length > 0 && (
                <div className="alert alert-success mt-3 py-2 small mb-0">
                  <i className="bi bi-check-circle me-1"></i>
                  Se van a cargar: {lineasConCantidad.map((l) => `${fmtNum(Number(l.cantidad))} ${l.unidad} de ${l.nombre}`).join(" · ")}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={submitting || lineasConCantidad.length === 0}
              >
                {submitting && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-box-arrow-in-down me-1"></i>
                Confirmar recepción{lineasConCantidad.length > 0 ? ` (${lineasConCantidad.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Tarjeta descarte ──────────────────────────────────────────────────────────
const DescarteCard = ({ onClick }) => (
  <div
    className="card border-0 shadow-sm text-center"
    style={{
      cursor: "pointer",
      minHeight: "130px",
      background: "#f8f9fa",
      borderLeft: "4px solid #6c757d",
      borderStyle: "dashed",
      opacity: 0.85,
    }}
    onClick={onClick}
  >
    <div className="p-3 d-flex flex-column align-items-center justify-content-center h-100">
      <i className="bi bi-trash3 fs-2 text-secondary mb-2"></i>
      <div className="fw-bold small text-secondary">Descarte</div>
      <div className="text-muted" style={{ fontSize: "0.72rem" }}>Rotura / defecto</div>
    </div>
  </div>
);

// ── Modal descarte múltiple ───────────────────────────────────────────────────
const DescarteModal = ({ articulos, onClose, onGuardado }) => {
  const hoy = obtenerFechaHoy();
  const [lineas, setLineas]       = useState(
    articulos.map((a) => ({ _id: a._id, nombre: a.nombre, unidad: a.unidad, stockActual: a.stockActual, cantidad: "", motivo: "" }))
  );
  const [fecha, setFecha]         = useState(hoy);
  const [submitting, setSubmitting] = useState(false);

  const setLinea = (id, campo, valor) =>
    setLineas((prev) => prev.map((l) => l._id === id ? { ...l, [campo]: valor } : l));

  const lineasConCantidad = lineas.filter((l) => Number(l.cantidad) > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lineasConCantidad.length === 0) {
      Swal.fire("Sin datos", "Ingresá al menos una cantidad a descartar.", "warning");
      return;
    }
    const errores = lineasConCantidad.filter((l) => Number(l.cantidad) > l.stockActual);
    if (errores.length > 0) {
      Swal.fire("Stock insuficiente", `${errores.map((l) => l.nombre).join(", ")} no tiene stock suficiente.`, "error");
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        lineasConCantidad.map((l) =>
          registrarStockMovimiento({
            articulo: l._id,
            tipo:     "descarte",
            cantidad: Number(l.cantidad),
            motivo:   l.motivo || "Descarte por rotura/defecto",
            fecha,
          })
        )
      );
      onGuardado();
      Swal.fire({
        icon: "success",
        title: `${lineasConCantidad.length} descarte${lineasConCantidad.length > 1 ? "s" : ""} registrado${lineasConCantidad.length > 1 ? "s" : ""}`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header" style={{ borderTop: "4px solid #6c757d" }}>
              <div>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-trash3 me-2"></i>Registrar descarte
                </h5>
                <div className="small text-muted mt-1">
                  Rotura, defecto o pérdida de materiales. Descuenta del stock real.
                </div>
              </div>
              <button className="btn-close" onClick={onClose} disabled={submitting}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-semibold small">Fecha del descarte</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ maxWidth: 200 }}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Artículo</th>
                      <th className="text-end">Stock actual</th>
                      <th style={{ minWidth: 110 }}>Cant. a descartar</th>
                      <th style={{ minWidth: 180 }}>Motivo <span className="text-muted fw-normal">(opc.)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l._id} className={Number(l.cantidad) > l.stockActual ? "table-danger" : ""}>
                        <td className="fw-semibold small">{l.nombre}</td>
                        <td className="text-end small text-muted">
                          {fmtNum(l.stockActual)} {l.unidad}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={l.cantidad}
                            onChange={(e) => setLinea(l._id, "cantidad", e.target.value)}
                            min="0"
                            max={l.stockActual}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={l.motivo}
                            onChange={(e) => setLinea(l._id, "motivo", e.target.value)}
                            placeholder="Rotura, defecto..."
                            disabled={!Number(l.cantidad)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lineasConCantidad.length > 0 && (
                <div className="alert alert-warning mt-3 py-2 small mb-0">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Se van a descartar: {lineasConCantidad.map((l) => `${fmtNum(Number(l.cantidad))} ${l.unidad} de ${l.nombre}`).join(" · ")}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
              <button
                className="btn btn-secondary"
                onClick={handleSubmit}
                disabled={submitting || lineasConCantidad.length === 0}
              >
                {submitting && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-trash3 me-1"></i>
                Confirmar descarte{lineasConCantidad.length > 0 ? ` (${lineasConCantidad.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Tabla de consumo ──────────────────────────────────────────────────────────
const iconTendencia = (t) => {
  if (t === "sube")   return <i className="bi bi-arrow-up-right text-danger ms-1" title="Consumo en alza"></i>;
  if (t === "baja")   return <i className="bi bi-arrow-down-right text-success ms-1" title="Consumo en baja"></i>;
  if (t === "nuevo")  return <i className="bi bi-star text-primary ms-1" title="Primer mes con datos"></i>;
  return <i className="bi bi-arrow-right text-muted ms-1" title="Estable"></i>;
};

const clsDias = (dias) => {
  if (dias === null) return "text-muted";
  if (dias <= 7)  return "text-danger fw-bold";
  if (dias <= 14) return "text-warning fw-bold";
  return "text-success fw-bold";
};

const TablaConsumo = ({ estadisticas, onClickArticulo }) => {
  if (!estadisticas || estadisticas.length === 0) return null;

  return (
    <div className="card border-0 shadow-sm mt-4">
      <div className="card-header bg-white py-2">
        <h6 className="mb-0">
          <i className="bi bi-bar-chart-line me-2 text-primary"></i>
          Resumen de consumo
        </h6>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Artículo</th>
              <th className="text-center">Stock actual</th>
              <th className="text-center">Consumo semanal</th>
              <th className="text-center">Consumo mensual</th>
              <th className="text-center">Última entrada</th>
              <th className="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {estadisticas.map((e) => {
              const nivel = nivelStock(e);
              return (
                <tr
                  key={e._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => onClickArticulo(e)}
                >
                  <td className="fw-semibold">{e.nombre}</td>
                  <td className="text-center">
                    {fmtNum(e.stockActual)}
                    <span className="text-muted small ms-1">{e.unidad}</span>
                  </td>
                  <td className="text-center">
                    {e.consumoSemanal > 0 ? fmtNum(e.consumoSemanal) : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-center">
                    {e.consumoMensual > 0
                      ? <>{fmtNum(e.consumoMensual)}</>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-center small text-muted">{fmtFecha(e.ultimaEntrada)}</td>
                  <td className="text-center">
                    {nivel === "ok"       && <span className="badge bg-success">OK</span>}
                    {nivel === "pedido"   && <span className="badge bg-warning text-dark">Hacer pedido</span>}
                    {nivel === "critico"  && <span className="badge bg-danger">Crítico</span>}
                    {nivel === "sinstock" && <span className="badge bg-secondary">Sin stock</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Página principal ───────────────────────────────────────────────────────────
const StockEmpaquePage = () => {
  const [articulos, setArticulos]         = useState([]);
  const [estadisticas, setEstadisticas]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [modalArticulo, setModalArticulo]       = useState(null);
  const [formArticulo, setFormArticulo]         = useState(null);
  const [showDescarte, setShowDescarte]         = useState(false);
  const [showPedido, setShowPedido]             = useState(false);
  const [showCargaMasiva, setShowCargaMasiva]   = useState(false);
  const [showProveedores, setShowProveedores]   = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [arts, stats] = await Promise.all([
        obtenerStockArticulos(),
        obtenerStockEstadisticas(),
      ]);
      setArticulos(arts);
      setEstadisticas(stats);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleMovimiento = (articuloActualizado) => {
    setArticulos((prev) =>
      prev.map((a) => a._id === articuloActualizado._id ? articuloActualizado : a)
    );
    if (modalArticulo?._id === articuloActualizado._id) {
      setModalArticulo(articuloActualizado);
    }
    // refrescar estadísticas en background
    obtenerStockEstadisticas().then(setEstadisticas).catch(() => {});
  };

  const handleEditar = (articulo) => {
    setModalArticulo(null);
    setFormArticulo(articulo);
  };

  const handleEliminar = async (articulo) => {
    const ok = await Swal.fire({
      title: `¿Eliminar "${articulo.nombre}"?`,
      text: "El artículo quedará inactivo y no aparecerá en el listado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await eliminarStockArticulo(articulo._id);
      setModalArticulo(null);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const conAlerta = articulos.filter((a) => nivelStock(a) !== "ok").length;

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="h3 mb-0">
              <i className="bi bi-box-seam me-2 text-primary"></i>
              Stock de Empaque
            </h1>
            {conAlerta > 0 && (
              <div className="small text-warning mt-1">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                {conAlerta} artículo{conAlerta !== 1 ? "s" : ""} con stock bajo o agotado
              </div>
            )}
          </div>
          {esAdmin() && (
            <div className="d-flex gap-2 flex-wrap">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowProveedores(true)}>
                <i className="bi bi-person-lines-fill me-1"></i>Proveedores
              </button>
              <button className="btn btn-outline-success btn-sm" onClick={() => setShowCargaMasiva(true)}>
                <i className="bi bi-box-arrow-in-down me-1"></i>Carga masiva
              </button>
              <button
                className="btn btn-sm fw-semibold"
                style={{ background: "#25d366", color: "#fff", borderColor: "#25d366" }}
                onClick={() => setShowPedido(true)}
              >
                <i className="bi bi-whatsapp me-1"></i>Pedir precios
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setFormArticulo("nuevo")}>
                <i className="bi bi-plus-circle me-1"></i>Nuevo artículo
              </button>
            </div>
          )}
        </div>

        {/* Grid */}
        {articulos.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-box-seam fs-1 d-block mb-2 opacity-25"></i>
            <p className="mb-0">No hay artículos de empaque cargados.</p>
            {esAdmin() && (
              <button
                className="btn btn-outline-primary btn-sm mt-3"
                onClick={() => setFormArticulo("nuevo")}
              >
                <i className="bi bi-plus-circle me-1"></i>Agregar el primero
              </button>
            )}
          </div>
        ) : (
          <div className="row g-3">
            {articulos.map((a) => (
              <div key={a._id} className="col-6 col-sm-4 col-md-3 col-lg-2">
                <ArticuloCard articulo={a} onClick={setModalArticulo} />
              </div>
            ))}
            {esAdmin() && (
              <div className="col-6 col-sm-4 col-md-3 col-lg-2">
                <DescarteCard onClick={() => setShowDescarte(true)} />
              </div>
            )}
          </div>
        )}

        {/* Leyenda */}
        {articulos.length > 0 && (
          <div className="d-flex gap-3 flex-wrap mt-4 small text-muted">
            <span><span className="text-success fw-bold me-1">●</span>Stock OK</span>
            <span><span className="text-danger fw-bold me-1">●</span>Hacer pedido</span>
            <span><span className="text-secondary fw-bold me-1">●</span>Sin stock</span>
            <span><span style={{ color: "#be123c" }} className="fw-bold me-1">●</span>Stock negativo</span>
          </div>
        )}

        {/* Tabla de consumo */}
        <TablaConsumo
          estadisticas={estadisticas}
          onClickArticulo={setModalArticulo}
        />

      </div>

      {/* Modal detalle */}
      {modalArticulo && !formArticulo && (
        <ArticuloModal
          articulo={modalArticulo}
          onClose={() => setModalArticulo(null)}
          onMovimiento={handleMovimiento}
          onEditar={handleEditar}
          onEliminar={handleEliminar}
        />
      )}

      {/* Modal carga masiva */}
      {showCargaMasiva && (
        <CargaMasivaModal
          articulos={articulos}
          onClose={() => setShowCargaMasiva(false)}
          onGuardado={async () => {
            setShowCargaMasiva(false);
            await cargar();
          }}
        />
      )}

      {/* Modal pedido WhatsApp */}
      {showPedido && (
        <PedidoWhatsAppModal
          articulos={articulos}
          onClose={() => setShowPedido(false)}
        />
      )}

      {/* Modal proveedores */}
      {showProveedores && (
        <ProveedoresModal onClose={() => setShowProveedores(false)} />
      )}

      {/* Modal descarte */}
      {showDescarte && (
        <DescarteModal
          articulos={articulos}
          onClose={() => setShowDescarte(false)}
          onGuardado={async () => {
            setShowDescarte(false);
            await cargar();
          }}
        />
      )}

      {/* Modal crear / editar */}
      {formArticulo && (
        <ArticuloFormModal
          articulo={formArticulo === "nuevo" ? null : formArticulo}
          onClose={() => setFormArticulo(null)}
          onGuardado={async () => {
            setFormArticulo(null);
            await cargar();
            Swal.fire({
              icon: "success",
              title: formArticulo === "nuevo" ? "Artículo creado" : "Artículo actualizado",
              timer: 1500,
              showConfirmButton: false,
            });
          }}
        />
      )}

    </Layout>
  );
};

export default StockEmpaquePage;
