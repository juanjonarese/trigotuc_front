import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  crearLoteGranja,
  obtenerLotesGranja,
  actualizarLoteGranja,
  eliminarLoteGranja,
  listarPedidosIngresoPollitos,
  crearPedidoIngresoPollitos,
  confirmarPedidoIngresoPollitos,
  cancelarPedidoIngresoPollitos,
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
const ITEMS_POR_PAGINA = 20;

const FORM_PEDIDO_VACIO = {
  granja: "", galpon: "", fechaIngreso: obtenerFechaHoy(),
  cantidadEnviada: "", observaciones: "",
};

// ── Modal nuevo pedido (admin crea el envío) ────────────────────────────────
const NuevoPedidoModal = ({ onClose, onCreado, ocupados }) => {
  const [form, setForm]     = useState(FORM_PEDIDO_VACIO);
  const [saving, setSaving] = useState(false);

  const maxGalpones = form.granja ? GALPONES[form.granja] : 0;
  const estaOcupado = (granja, galpon) => !!(ocupados[granja]?.has(galpon));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value, ...(name === "granja" ? { galpon: "" } : {}) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.granja || !form.galpon || !form.cantidadEnviada) {
      Swal.fire("Faltan datos", "Completá granja, galpón y cantidad enviada.", "warning");
      return;
    }
    setSaving(true);
    try {
      await crearPedidoIngresoPollitos({
        granja:          form.granja,
        galpon:          Number(form.galpon),
        fechaIngreso:    ajustarFechaParaGuardar(form.fechaIngreso),
        cantidadEnviada: Number(form.cantidadEnviada),
        observaciones:   form.observaciones || undefined,
      });
      onCreado();
      Swal.fire({
        icon: "success",
        title: "Pedido creado",
        text: `Granja ${GRANJAS_LABEL[form.granja]}, Galpón ${form.galpon} — esperando confirmación de granja`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el pedido.", "error");
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
                <i className="bi bi-send me-2"></i>Nuevo ingreso de pollitos
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-nuevo-pedido" onSubmit={handleSubmit}>

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

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha de ingreso</label>
                    <input type="date" name="fechaIngreso" className="form-control"
                      value={form.fechaIngreso} onChange={handleChange} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad enviada</label>
                    <input type="number" name="cantidadEnviada" className="form-control"
                      value={form.cantidadEnviada} onChange={handleChange}
                      min="1" placeholder="Ej: 12000" required />
                    <div className="form-text">Pollitos despachados</div>
                  </div>
                </div>

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
              <button type="submit" form="form-nuevo-pedido" className="btn btn-success" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-send me-1"></i>Enviar pollitos
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Tarjeta de pedido pendiente (granja confirma) ───────────────────────────
const TarjetaPedidoPendiente = ({ pedido, onConfirmado, onCancelado }) => {
  const [bajas, setBajas]         = useState("");
  const [motivo, setMotivo]       = useState("");
  const [saving, setSaving]       = useState(false);
  const [bajasInvalida, setBajasInvalida] = useState(false);

  const bajasNum = Number(bajas);
  const ingresados = bajas !== "" && bajasNum >= 0 && bajasNum < pedido.cantidadEnviada
    ? pedido.cantidadEnviada - bajasNum
    : null;

  const handleBajasChange = (e) => {
    setBajas(e.target.value);
    setBajasInvalida(false);
  };

  const handleConfirmar = async () => {
    if (bajas === "" || bajas === null) {
      setBajasInvalida(true);
      Swal.fire("Campo requerido", "Ingresá la cantidad de bajas. Si no hubo muertes, ingresá 0.", "warning");
      return;
    }
    if (bajasNum >= pedido.cantidadEnviada) {
      Swal.fire("Error", "Las bajas no pueden ser iguales o mayores a la cantidad enviada.", "error");
      return;
    }
    setSaving(true);
    try {
      const { lote } = await confirmarPedidoIngresoPollitos(pedido._id, {
        bajasRecibidas: bajasNum,
        motivoBajas:    motivo.trim() || undefined,
      });
      setBajasInvalida(false);
      onConfirmado();
      Swal.fire({
        icon: "success",
        title: `Lote #${lote.numeroLote} creado`,
        html: `<b>${lote.cantidadIngreso.toLocaleString("es-AR")} pollitos</b> ingresados al galpón ${GRANJAS_PREFIX[pedido.granja]}${pedido.galpon}${bajasNum > 0 ? `<br><span class="text-danger">${bajasNum.toLocaleString("es-AR")} bajas registradas</span>` : ""}`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async () => {
    const ok = await Swal.fire({
      title: "¿Cancelar pedido?",
      text: "No se creará ningún lote en el galpón.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, cancelar",
      cancelButtonText: "Volver",
    });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      await cancelarPedidoIngresoPollitos(pedido._id);
      onCancelado();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-warning shadow-sm mb-3">
      <div className="card-body">
        {/* Encabezado */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <span className="badge bg-warning text-dark me-2 fs-6">Pendiente</span>
            <span className="fw-bold fs-5">
              {GRANJAS_LABEL[pedido.granja]} — Galpón {GRANJAS_PREFIX[pedido.granja]}{pedido.galpon}
            </span>
          </div>
          <span className="text-muted small">{formatearFechaLocal(pedido.fechaIngreso)}</span>
        </div>

        {/* Datos del envío */}
        <div className="row g-2 mb-3">
          <div className="col-6 col-md-4">
            <div className="p-2 bg-light rounded text-center">
              <div className="text-muted small">Enviados</div>
              <div className="fw-bold fs-5">{pedido.cantidadEnviada.toLocaleString("es-AR")}</div>
            </div>
          </div>
          {pedido.creadoPor?.nombreUsuario && (
            <div className="col-12 col-md-8 d-flex align-items-center">
              <span className="text-muted small"><i className="bi bi-person me-1"></i>{pedido.creadoPor.nombreUsuario}</span>
            </div>
          )}
          {pedido.observaciones && (
            <div className="col-12">
              <span className="text-muted small"><i className="bi bi-chat-left-text me-1"></i>{pedido.observaciones}</span>
            </div>
          )}
        </div>

        {/* Formulario de confirmación */}
        <div className="border-top pt-3">
          <p className="fw-semibold mb-2 text-success">
            <i className="bi bi-pencil-square me-1"></i>Confirmar recepción
          </p>
          <div className="row g-2 align-items-start">
            <div className="col-6 col-md-4">
              <label className="form-label small mb-1 fw-semibold">
                Bajas recibidas <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                className={`form-control ${bajasInvalida ? "is-invalid" : ""}`}
                value={bajas}
                onChange={handleBajasChange}
                min="0"
                placeholder="0"
                disabled={saving}
              />
              {bajasInvalida
                ? <div className="invalid-feedback">Requerido — ingresá 0 si no hubo muertes</div>
                : <div className="form-text">0 si no hubo bajas</div>
              }
            </div>
            {ingresados !== null && (
              <div className="col-6 col-md-4 d-flex align-items-center" style={{ paddingTop: "1.6rem" }}>
                <div className="p-2 bg-success bg-opacity-10 rounded text-center w-100">
                  <div className="text-muted small">Ingresarían</div>
                  <div className="fw-bold text-success fs-5">{ingresados.toLocaleString("es-AR")}</div>
                </div>
              </div>
            )}
          </div>

          {bajasNum > 0 && (
            <div className="mt-2">
              <label className="form-label small mb-1">
                Motivo de las bajas <span className="text-muted">(opcional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: muertos en transporte, aplaste..."
                disabled={saving}
              />
            </div>
          )}

          <div className="d-flex gap-2 mt-3">
            <button
              className="btn btn-success flex-grow-1"
              onClick={handleConfirmar}
              disabled={saving}
            >
              {saving
                ? <span className="spinner-border spinner-border-sm me-1"></span>
                : <i className="bi bi-check-circle me-1"></i>
              }
              Confirmar ingreso
            </button>
            <button
              className="btn btn-outline-danger"
              onClick={handleCancelar}
              disabled={saving}
            >
              <i className="bi bi-x-circle me-1"></i>Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal editar lote ────────────────────────────────────────────────────────
const EditarIngresoModal = ({ lote, onClose, onGuardado }) => {
  const [form, setForm]     = useState({
    granja:          lote.granja,
    galpon:          lote.galpon,
    fechaIngreso:    lote.fechaIngreso?.split("T")[0] ?? "",
    cantidadIngreso: lote.cantidadIngreso,
    bajasIngreso:    lote.bajasIngreso || 0,
    motivoBajas:     lote.motivoBajas || "",
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
        bajasIngreso:    Number(form.bajasIngreso),
        motivoBajas:     form.motivoBajas || undefined,
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
                    <label className="form-label fw-semibold">Cantidad enviada</label>
                    <input type="number" className="form-control" value={form.cantidadIngreso}
                      onChange={(e) => setForm({ ...form, cantidadIngreso: e.target.value })}
                      min="1" required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Bajas al ingreso</label>
                    <input type="number" className="form-control" value={form.bajasIngreso}
                      onChange={(e) => setForm({ ...form, bajasIngreso: e.target.value })}
                      min="0" />
                  </div>
                  {Number(form.bajasIngreso) > 0 && (
                    <div className="col-12">
                      <label className="form-label">Motivo de las bajas <span className="text-muted">(opcional)</span></label>
                      <input type="text" className="form-control" value={form.motivoBajas}
                        onChange={(e) => setForm({ ...form, motivoBajas: e.target.value })}
                        placeholder="Ej: muertos en transporte, aplaste..." />
                    </div>
                  )}
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
  const puedeCrear   = ["superadmin", "administracion_granja"].includes(rolUsuario);
  const puedeEditar  = rolUsuario === "superadmin" || rolUsuario === "frigorifico" || rolUsuario === "granja";
  const esSuperAdmin = rolUsuario === "superadmin";

  const [lotes, setLotes]                         = useState([]);
  const [pedidosPendientes, setPedidosPendientes] = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [ocupados, setOcupados]                   = useState({});
  const [showNuevo, setShowNuevo]                 = useState(false);
  const [editLote, setEditLote]                   = useState(null);
  const [tab, setTab]                             = useState("envios");
  const [pagina, setPagina]                       = useState(1);

  const [filtroGranja, setFiltroGranja] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroGalpon, setFiltroGalpon] = useState("");
  const [filtroTexto, setFiltroTexto]   = useState("");

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [lotesData, pedidosData] = await Promise.all([
        obtenerLotesGranja(),
        listarPedidosIngresoPollitos({ estado: "pendiente" }),
      ]);
      setLotes(lotesData);
      setPedidosPendientes(pedidosData);
      const mapa = {};
      for (const l of lotesData) {
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

  useEffect(() => { cargarDatos(); }, [cargarDatos]);
  useEffect(() => { setPagina(1); }, [filtroGranja, filtroEstado, filtroGalpon, filtroTexto]);

  const handleEliminar = async (lote) => {
    const confirm = await Swal.fire({
      title: "¿Cerrar galpón?",
      html: `Se eliminará el lote <strong>#${lote.numeroLote}</strong> y todos sus registros. El galpón quedará libre para un nuevo ingreso.`,
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#dc3545", confirmButtonText: "Sí, cerrar", cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarLoteGranja(lote._id);
      await cargarDatos();
      Swal.fire({ icon: "success", title: "Galpón cerrado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const lotesCrianza    = lotes.filter((l) => l.estado === "en_crianza");
  const lotesFiltrados  = lotes.filter((l) => {
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

  const totalFiltrados    = lotesFiltrados.length;
  const inicio            = (pagina - 1) * ITEMS_POR_PAGINA;
  const lotesPagina       = lotesFiltrados.slice(inicio, inicio + ITEMS_POR_PAGINA);
  const hayFiltros        = filtroGranja || filtroEstado || filtroGalpon || filtroTexto;
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
          {puedeCrear && (
            <button className="btn btn-success btn-sm" onClick={() => setShowNuevo(true)}>
              <i className="bi bi-plus-circle me-1"></i>Nuevo ingreso
            </button>
          )}
        </div>

        {/* Solapas */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "envios" ? "active" : ""}`}
              onClick={() => setTab("envios")}
            >
              <i className="bi bi-send me-1"></i>Envíos
              {pedidosPendientes.length > 0 && (
                <span className="badge bg-warning text-dark ms-2" style={{ fontSize: "0.65rem" }}>
                  {pedidosPendientes.length}
                </span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "crianza" ? "active" : ""}`}
              onClick={() => setTab("crianza")}
            >
              <i className="bi bi-house-door me-1"></i>En crianza
              {lotesCrianza.filter((l) => l.cantidadActual === 0).length > 0 && (
                <span className="badge bg-secondary ms-2" style={{ fontSize: "0.65rem" }}>
                  {lotesCrianza.filter((l) => l.cantidadActual === 0).length} vacío{lotesCrianza.filter((l) => l.cantidadActual === 0).length > 1 ? "s" : ""}
                </span>
              )}
            </button>
          </li>
        </ul>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : (
          <>
            {/* ══ SOLAPA ENVÍOS ══ */}
            {tab === "envios" && (
              <>
                {pedidosPendientes.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                    No hay envíos pendientes de confirmación.
                  </div>
                ) : (
                  <div className="d-flex flex-wrap gap-3">
                    {pedidosPendientes.map((pedido) => (
                      <div key={pedido._id} style={{ width: "min(100%, 380px)" }}>
                        <TarjetaPedidoPendiente
                          pedido={pedido}
                          onConfirmado={cargarDatos}
                          onCancelado={cargarDatos}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ══ SOLAPA EN CRIANZA ══ */}
            {tab === "crianza" && (
              <>
                {/* Historial */}
                <div>

                  {/* Filtros */}
                  <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body py-2">
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-sm-6 col-md-3">
                          <label className="form-label small mb-1 text-muted">Buscar</label>
                          <input type="text" className="form-control form-control-sm"
                            placeholder="N° lote..."
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
                        <div className="col-6 col-sm-4 col-md-2 d-flex align-items-end">
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

                  <div className="card border-0 shadow-sm">
                    <div className="card-body p-0">
                      {lotesPagina.length === 0 ? (
                        <p className="text-center text-muted p-4 mb-0">
                          {hayFiltros ? "No hay registros que coincidan." : "Sin ingresos registrados."}
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
                                    {formatearFechaLocal(lote.fechaIngreso)} · {(lote.cantidadIngreso - (lote.bajasIngreso || 0)).toLocaleString("es-AR")} ingresados
                                    {lote.bajasIngreso > 0 && (
                                      <span className="text-danger"> · {lote.bajasIngreso.toLocaleString("es-AR")} bajas{lote.motivoBajas ? ` (${lote.motivoBajas})` : ""}</span>
                                    )}
                                  </div>
                                  {lote.registradoPor?.nombreUsuario && <div className="small text-muted"><i className="bi bi-person me-1"></i>{lote.registradoPor.nombreUsuario}</div>}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop */}
                          <div className="d-none d-md-block table-responsive">
                            <table className="table table-hover align-middle mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th className="text-center">#Lote</th>
                                  <th className="text-center">Granja</th>
                                  <th className="text-center">Galpón</th>
                                  <th className="text-center">Fecha ingreso</th>
                                  <th className="text-center">Ingresados</th>
                                  <th className="text-center">Bajas ing.</th>
                                  <th className="text-center">Registrado por</th>
                                  <th className="text-center">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lotesPagina.map((lote) => (
                                  <tr key={lote._id}>
                                    <td className="text-center"><span className="badge bg-dark">#{lote.numeroLote}</span></td>
                                    <td className="text-center">{GRANJAS_LABEL[lote.granja] || lote.granja}</td>
                                    <td className="text-center fw-semibold">{GRANJAS_PREFIX[lote.granja]}{lote.galpon}</td>
                                    <td className="text-center">{formatearFechaLocal(lote.fechaIngreso)}</td>
                                    <td className="text-center">{(lote.cantidadIngreso - (lote.bajasIngreso || 0)).toLocaleString("es-AR")}</td>
                                    <td className="text-center">
                                      {lote.bajasIngreso > 0 ? (
                                        <>
                                          <span className="text-danger fw-semibold">{lote.bajasIngreso.toLocaleString("es-AR")}</span>
                                          {lote.motivoBajas && <div className="text-danger small">{lote.motivoBajas}</div>}
                                        </>
                                      ) : (
                                        <span className="text-muted">—</span>
                                      )}
                                    </td>
                                    <td className="text-center text-muted small">{lote.registradoPor?.nombreUsuario || "—"}</td>
                                    <td className="text-center">
                                      <div className="d-flex gap-1 justify-content-center">
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
              </>
            )}
          </>
        )}

      </div>

      {showNuevo && (
        <NuevoPedidoModal
          ocupados={ocupados}
          onClose={() => setShowNuevo(false)}
          onCreado={() => { setShowNuevo(false); cargarDatos(); }}
        />
      )}

      {editLote && (
        <EditarIngresoModal
          lote={editLote}
          onClose={() => setEditLote(null)}
          onGuardado={() => { setEditLote(null); cargarDatos(); }}
        />
      )}
    </Layout>
  );
};

export default GranjaLoteNuevoPage;
