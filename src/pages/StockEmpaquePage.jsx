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
  enviarPedidoStock,
} from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const rolUsuario  = () => localStorage.getItem("rolUsuario");
const esAdmin     = () => ["superadmin", "administracion"].includes(rolUsuario());
const esSuperAdmin = () => rolUsuario() === "superadmin";

const fmtNum   = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";

const nivelStock = (a) => {
  if (a.stockActual <= 0)                                                    return "sinstock";
  if (a.stockMinimo  > 0 && a.stockActual <= a.stockMinimo)                  return "critico";
  if (a.stockCritico > 0 && a.stockActual <= a.stockCritico)                 return "pedido";
  return "ok";
};

const COLORES = {
  ok:       { bg: "#f0fdf4", border: "#198754", text: "#198754" },
  pedido:   { bg: "#fffbeb", border: "#fd7e14", text: "#fd7e14" },
  critico:  { bg: "#fff5f5", border: "#dc3545", text: "#dc3545" },
  sinstock: { bg: "#f8f8f8", border: "#6c757d", text: "#6c757d" },
};

const colorPorStock = (a) => COLORES[nivelStock(a)];

const badgeTipo = (tipo) => {
  if (tipo === "entrada")  return <span className="badge bg-success">Entrada</span>;
  if (tipo === "salida")   return <span className="badge bg-danger">Salida</span>;
  if (tipo === "descarte") return <span className="badge bg-warning text-dark">Descarte</span>;
  return <span className="badge bg-secondary">Ajuste</span>;
};

// ── Tarjeta artículo ───────────────────────────────────────────────────────────
const ArticuloCard = ({ articulo, onClick }) => {
  const { bg, border, text } = colorPorStock(articulo);
  const nivel = nivelStock(articulo);

  return (
    <div
      className="card border-0 shadow-sm text-center"
      style={{ cursor: "pointer", minHeight: "130px", background: bg, borderLeft: `4px solid ${border}` }}
      onClick={() => onClick(articulo)}
    >
      <div className="p-3">
        <div className="fw-bold text-truncate mb-2 small" title={articulo.nombre}>
          {articulo.nombre}
        </div>
        <div className="fw-bold" style={{ fontSize: "2rem", color: text, lineHeight: 1 }}>
          {fmtNum(articulo.stockActual)}
        </div>
        <div className="text-muted small mb-1">{articulo.unidad}</div>
        {articulo.stockCritico > 0 && (
          <div className="small text-muted">
            pedido: {fmtNum(articulo.stockCritico)}
          </div>
        )}
        {nivel === "pedido"   && <div className="mt-1"><span className="badge bg-warning text-dark">Hacer pedido</span></div>}
        {nivel === "critico"  && <div className="mt-1"><span className="badge bg-danger">Stock crítico</span></div>}
        {nivel === "sinstock" && <div className="mt-1"><span className="badge bg-secondary">Sin stock</span></div>}
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
                {articulo.stockCritico > 0 && ` · pedido en: ${fmtNum(articulo.stockCritico)}`}
                {articulo.stockMinimo  > 0 && ` · mín: ${fmtNum(articulo.stockMinimo)}`}
                {articulo.descripcion && <> · {articulo.descripcion}</>}
              </div>
            </div>
            <div className="d-flex gap-2 align-items-center">
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
              <button className="btn-close" onClick={onClose}></button>
            </div>
          </div>

          <div className="modal-body">
            {/* Botón registrar movimiento */}
            <div className="mb-3">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowForm(!showForm)}
              >
                <i className={`bi bi-${showForm ? "dash" : "plus"}-circle me-1`}></i>
                {showForm ? "Cancelar" : "Registrar movimiento"}
              </button>
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
    nombre:         articulo?.nombre         || "",
    descripcion:    articulo?.descripcion    || "",
    unidad:         articulo?.unidad         || "u",
    stockActual:    articulo?.stockActual    ?? 0,
    stockObjetivo:  articulo?.stockObjetivo  ?? 0,
    stockCritico:   articulo?.stockCritico   ?? 0,
    stockMinimo:    articulo?.stockMinimo    ?? 0,
    tipoConsumo:    articulo?.tipoConsumo    || "ninguno",
    consumoPorCajon:articulo?.consumoPorCajon ?? 0,
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
                    <label className="form-label fw-semibold">Nombre</label>
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
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Unidad</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.unidad}
                      onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                      placeholder="u, kg, paq, rollo..."
                      required
                    />
                    <div className="form-text">u = unidades, paq = paquetes, rollo...</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Stock objetivo <span className="text-muted">(para pedido)</span></label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.stockObjetivo}
                      onChange={(e) => setForm({ ...form, stockObjetivo: e.target.value })}
                      min="0"
                    />
                    <div className="form-text">Nivel al que se repone con "Hacer pedido"</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Stock crítico <span className="text-muted">(hacer pedido)</span></label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.stockCritico}
                      onChange={(e) => setForm({ ...form, stockCritico: e.target.value })}
                      min="0"
                    />
                    <div className="form-text">Alarma amarilla — pedir reposición</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Stock mínimo <span className="text-muted">(urgente)</span></label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.stockMinimo}
                      onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                      min="0"
                    />
                    <div className="form-text">Alarma roja — nivel crítico</div>
                  </div>
                  <div className="col-12"><hr className="my-1"/><p className="text-muted small mb-2 fw-semibold">Consumo en faena</p></div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label fw-semibold">Tipo de consumo por cajón</label>
                    <select
                      className="form-select"
                      value={form.tipoConsumo}
                      onChange={(e) => setForm({ ...form, tipoConsumo: e.target.value, consumoPorCajon: 0 })}
                    >
                      <option value="ninguno">No aplica</option>
                      <option value="fijo">Fijo por cajón (ej: cajones, etiquetas)</option>
                      <option value="por_calibre">Por calibre (ej: bolsas individuales)</option>
                    </select>
                    <div className="form-text">
                      {form.tipoConsumo === "fijo"        && "Se descuenta X unidades por cada cajón faenado."}
                      {form.tipoConsumo === "por_calibre" && "Se descuenta según el calibre: cal.5 = 5 u/cajón, cal.7 = 7 u/cajón, etc."}
                      {form.tipoConsumo === "ninguno"     && "No se descuenta automáticamente al crear un lote."}
                    </div>
                  </div>
                  {form.tipoConsumo === "fijo" && (
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">Unidades por cajón</label>
                      <input
                        type="number"
                        className="form-control"
                        value={form.consumoPorCajon}
                        onChange={(e) => setForm({ ...form, consumoPorCajon: e.target.value })}
                        min="0"
                        step="1"
                        placeholder="1"
                      />
                      <div className="form-text">Ej: cajones = 1 · etiquetas = 1</div>
                    </div>
                  )}
                  {!isEdit && (
                    <div className="col-6">
                      <label className="form-label">Stock inicial</label>
                      <input
                        type="number"
                        className="form-control"
                        value={form.stockActual}
                        onChange={(e) => setForm({ ...form, stockActual: e.target.value })}
                        min="0"
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

// ── Modal hacer pedido ────────────────────────────────────────────────────────
const PedidoModal = ({ articulos, estadisticas, onClose }) => {
  const emailDefault = "";
  const [destinatario, setDestinatario] = useState(emailDefault);
  const [enviando, setEnviando]         = useState(false);

  // Armar items a pedir: stockObjetivo > 0 && stockActual < stockObjetivo
  const statsMap = Object.fromEntries((estadisticas || []).map((e) => [e._id.toString(), e]));

  const items = articulos
    .filter((a) => a.stockObjetivo > 0 && a.stockActual < a.stockObjetivo)
    .map((a) => {
      const st = statsMap[a._id] || {};
      return {
        _id:            a._id,
        nombre:         a.nombre,
        unidad:         a.unidad,
        stockActual:    a.stockActual,
        stockObjetivo:  a.stockObjetivo,
        cantidadPedido: a.stockObjetivo - a.stockActual,
        consumoSemanal: st.consumoSemanal || 0,
        consumoMensual: st.consumoMensual || 0,
      };
    });

  const handleEnviar = async () => {
    if (!destinatario.trim()) {
      Swal.fire("Email requerido", "Ingresá el email del destinatario.", "warning");
      return;
    }
    setEnviando(true);
    try {
      await enviarPedidoStock({ destinatario: destinatario.trim(), items });
      onClose();
      Swal.fire({
        icon: "success",
        title: "Pedido enviado",
        text: `Mail enviado a ${destinatario}`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header" style={{ borderTop: "4px solid #1d4ed8" }}>
            <div>
              <h5 className="modal-title mb-0">
                <i className="bi bi-envelope-check me-2 text-primary"></i>Hacer pedido
              </h5>
              <div className="small text-muted mt-1">
                Artículos por debajo del stock objetivo — se enviará un mail de reposición
              </div>
            </div>
            <button className="btn-close" onClick={onClose} disabled={enviando}></button>
          </div>

          <div className="modal-body">
            {items.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-check-circle fs-2 text-success d-block mb-2"></i>
                Todos los artículos tienen stock objetivo configurado y están en nivel correcto.
                <div className="small mt-1">
                  Configurá el <strong>stock objetivo</strong> en cada artículo para usar esta función.
                </div>
              </div>
            ) : (
              <>
                <div className="table-responsive mb-3">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Artículo</th>
                        <th className="text-center">Stock actual</th>
                        <th className="text-center">Objetivo</th>
                        <th className="text-center text-muted small">Cons. semanal</th>
                        <th className="text-center text-muted small">Cons. mensual</th>
                        <th className="text-center text-primary fw-bold">A pedir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i._id}>
                          <td className="fw-semibold">{i.nombre}</td>
                          <td className="text-center text-danger fw-semibold">
                            {fmtNum(i.stockActual)} <span className="text-muted fw-normal small">{i.unidad}</span>
                          </td>
                          <td className="text-center text-muted">{fmtNum(i.stockObjetivo)}</td>
                          <td className="text-center text-muted small">{i.consumoSemanal > 0 ? fmtNum(i.consumoSemanal) : "—"}</td>
                          <td className="text-center text-muted small">{i.consumoMensual > 0 ? fmtNum(i.consumoMensual) : "—"}</td>
                          <td className="text-center fw-bold text-primary fs-6">{fmtNum(i.cantidadPedido)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Email destinatario</label>
                  <input
                    type="email"
                    className="form-control"
                    value={destinatario}
                    onChange={(e) => setDestinatario(e.target.value)}
                    placeholder="proveedor@ejemplo.com"
                    autoFocus
                  />
                  <div className="form-text">El pedido se enviará a esta dirección.</div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={enviando}>Cerrar</button>
            {items.length > 0 && (
              <button
                className="btn btn-primary"
                onClick={handleEnviar}
                disabled={enviando || !destinatario.trim()}
              >
                {enviando
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Enviando...</>
                  : <><i className="bi bi-send me-1"></i>Enviar pedido ({items.length})</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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

              <div className="d-flex justify-content-end mb-2">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={autocompletar}
                  title="Completa automáticamente con la cantidad necesaria para llegar al stock objetivo"
                >
                  <i className="bi bi-lightning-charge me-1"></i>Auto-completar según objetivo
                </button>
              </div>

              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Artículo</th>
                      <th className="text-center">Stock actual</th>
                      <th className="text-center text-muted small">Objetivo</th>
                      <th style={{ minWidth: 110 }}>Cant. recibida</th>
                      <th style={{ minWidth: 160 }}>Motivo <span className="text-muted fw-normal">(opc.)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l._id} className={Number(l.cantidad) > 0 ? "table-success table-success-subtle" : ""}>
                        <td className="fw-semibold small">{l.nombre}</td>
                        <td className="text-center small">
                          <span className={l.stockObjetivo > 0 && l.stockActual < l.stockObjetivo ? "text-danger fw-semibold" : "text-muted"}>
                            {fmtNum(l.stockActual)}
                          </span>
                          <span className="text-muted small ms-1">{l.unidad}</span>
                        </td>
                        <td className="text-center small text-muted">
                          {l.stockObjetivo > 0 ? fmtNum(l.stockObjetivo) : "—"}
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
              <th className="text-end">Stock actual</th>
              <th className="text-end">Consumo semanal</th>
              <th className="text-end">Consumo mensual</th>
              <th className="text-end">Días de stock</th>
              <th>Última entrada</th>
              <th>Estado</th>
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
                  <td className="text-end">
                    {fmtNum(e.stockActual)}
                    <span className="text-muted small ms-1">{e.unidad}</span>
                  </td>
                  <td className="text-end">
                    {e.consumoSemanal > 0 ? fmtNum(e.consumoSemanal) : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-end">
                    {e.consumoMensual > 0
                      ? <>{fmtNum(e.consumoMensual)}{iconTendencia(e.tendencia)}</>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-end">
                    {e.diasStock !== null
                      ? <span className={clsDias(e.diasStock)}>{e.diasStock} días</span>
                      : <span className="text-muted small">sin datos</span>}
                  </td>
                  <td className="small text-muted">{fmtFecha(e.ultimaEntrada)}</td>
                  <td>
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
      <div className="card-footer bg-white small text-muted d-flex gap-3 flex-wrap py-2">
        <span><i className="bi bi-arrow-up-right text-danger me-1"></i>Consumo en alza vs mes anterior</span>
        <span><i className="bi bi-arrow-down-right text-success me-1"></i>Consumo en baja</span>
        <span><i className="bi bi-arrow-right text-muted me-1"></i>Estable</span>
        <span className="ms-auto"><span className={`${clsDias(5)} me-1`}>■</span>≤ 7 días&nbsp;&nbsp;<span className={`${clsDias(10)} me-1`}>■</span>≤ 14 días&nbsp;&nbsp;<span className={`${clsDias(30)} me-1`}>■</span>&gt; 14 días</span>
      </div>
    </div>
  );
};

// ── Página principal ───────────────────────────────────────────────────────────
const StockEmpaquePage = () => {
  const [articulos, setArticulos]         = useState([]);
  const [estadisticas, setEstadisticas]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [modalArticulo, setModalArticulo] = useState(null);
  const [formArticulo, setFormArticulo]   = useState(null);
  const [showDescarte, setShowDescarte]     = useState(false);
  const [showPedido, setShowPedido]         = useState(false);
  const [showCargaMasiva, setShowCargaMasiva] = useState(false);

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
              <button className="btn btn-outline-success btn-sm" onClick={() => setShowCargaMasiva(true)}>
                <i className="bi bi-box-arrow-in-down me-1"></i>Carga masiva
              </button>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setShowPedido(true)}>
                <i className="bi bi-envelope-check me-1"></i>Hacer pedido
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
            <span><span className="text-warning fw-bold me-1">●</span>Hacer pedido</span>
            <span><span className="text-danger fw-bold me-1">●</span>Stock crítico</span>
            <span><span className="text-secondary fw-bold me-1">●</span>Sin stock</span>
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

      {/* Modal pedido */}
      {showPedido && (
        <PedidoModal
          articulos={articulos}
          estadisticas={estadisticas}
          onClose={() => setShowPedido(false)}
        />
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
