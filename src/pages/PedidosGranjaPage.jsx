import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerLotesGranja,
  obtenerOrdenesCarga,
  crearOrdenCarga,
  entregarOrdenCarga,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GRANJAS = [
  { key: "cañete",    label: "Cañete",    prefix: "C", galpones: 6 },
  { key: "los_pinos", label: "Los Pinos", prefix: "P", galpones: 8 },
];

const diasDeVida = (f) =>
  Math.floor((Date.now() - new Date(f).getTime()) / (1000 * 60 * 60 * 24));

const semanaActual = (f) => Math.max(1, Math.floor(diasDeVida(f) / 7) + 1);

const formatPeso = (g) => {
  if (g == null) return null;
  return g >= 1000 ? `${(g / 1000).toFixed(3).replace(".", ",")} kg` : `${g} g`;
};

const ultimoPeso = (lote) =>
  lote.pesajes?.length ? lote.pesajes[lote.pesajes.length - 1].pesoPromedio : null;

const estadoBadgePedido = (o) => {
  if (o.estado === "entregada")
    return <span className="badge bg-success">Recibido</span>;
  if (o.liberada)
    return <span className="badge bg-warning text-dark"><i className="bi bi-unlock me-1"></i>Liberado</span>;
  return <span className="badge bg-warning text-dark">Pendiente</span>;
};

// ── Modal recepción ─────────────────────────────────────────────────────────
const RecepcionarModal = ({ orden, onClose, onConfirmada }) => {
  const [form, setForm] = useState({
    cantidadReal: "",
    pesoRealKg:   "",
    fechaEntrega: obtenerFechaHoy(),
    observacionesEntrega: "",
  });
  const [saving, setSaving] = useState(false);

  const hayDif = () =>
    (form.cantidadReal !== "" && Number(form.cantidadReal) !== orden.cantidadEstimada) ||
    (form.pesoRealKg   !== "" && Math.abs(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0.01);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cantidadReal || !form.pesoRealKg) {
      Swal.fire("Faltan datos", "Ingresá cantidad y kg recibidos.", "warning"); return;
    }
    if (hayDif() && !form.observacionesEntrega.trim()) {
      Swal.fire("Falta el motivo", "Hay diferencia con el pedido. Explicá el motivo.", "warning"); return;
    }
    setSaving(true);
    try {
      await entregarOrdenCarga(orden._id, {
        cantidadReal:         Number(form.cantidadReal),
        pesoRealKg:           Number(form.pesoRealKg),
        fechaEntrega:         ajustarFechaParaGuardar(form.fechaEntrega),
        observacionesEntrega: form.observacionesEntrega || undefined,
      });
      onConfirmada();
      Swal.fire({ icon: "success", title: "Recepción registrada", timer: 1500, showConfirmButton: false });
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
            <div className="modal-header bg-primary text-white">
              <div>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-box-arrow-in-down me-2"></i>Recepcionar pedido
                </h5>
                <div className="small opacity-75 mt-1">{orden.numero}</div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">

              {/* Resumen del pedido */}
              <div className="card border-0 bg-light mb-3">
                <div className="card-body py-2 px-3">
                  <div className="small text-muted fw-semibold mb-1 text-uppercase" style={{ letterSpacing: "0.05em" }}>Pedido original</div>
                  <div className="d-flex gap-4">
                    <div>
                      <div className="fw-bold">{Number(orden.cantidadEstimada).toLocaleString("es-AR")}</div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>pollos pedidos</div>
                    </div>
                    <div>
                      <div className="fw-bold">{orden.pesoEstimadoKg} kg</div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>kg estimados</div>
                    </div>
                    <div>
                      <div className="fw-bold">{orden.granja === "cañete" ? "Cañete" : "Los Pinos"}{orden.galpon && ` — G${orden.galpon}`}</div>
                      <div className="text-muted" style={{ fontSize: "0.72rem" }}>origen</div>
                    </div>
                  </div>
                </div>
              </div>

              <form id="form-recepcion" onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cantidad recibida <span className="text-danger">*</span></label>
                    <input type="number" min="1" className={`form-control form-control-lg text-center ${hayDif() && form.cantidadReal ? "border-warning" : ""}`}
                      placeholder={orden.cantidadEstimada}
                      value={form.cantidadReal}
                      onChange={(e) => setForm({ ...form, cantidadReal: e.target.value })}
                      required autoFocus />
                    {form.cantidadReal && Number(form.cantidadReal) !== orden.cantidadEstimada && (
                      <div className="form-text text-warning fw-semibold text-center">
                        Dif: {Number(form.cantidadReal) - orden.cantidadEstimada > 0 ? "+" : ""}
                        {Number(form.cantidadReal) - orden.cantidadEstimada} pollos
                      </div>
                    )}
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Kg vivos recibidos <span className="text-danger">*</span></label>
                    <input type="number" min="0.01" step="0.01" className={`form-control form-control-lg text-center ${form.pesoRealKg && Math.abs(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0.01 ? "border-warning" : ""}`}
                      placeholder={orden.pesoEstimadoKg}
                      value={form.pesoRealKg}
                      onChange={(e) => setForm({ ...form, pesoRealKg: e.target.value })}
                      required />
                    {form.pesoRealKg && Math.abs(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0.01 && (
                      <div className="form-text text-warning fw-semibold text-center">
                        Dif: {(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0 ? "+" : ""}
                        {(Number(form.pesoRealKg) - orden.pesoEstimadoKg).toFixed(1)} kg
                      </div>
                    )}
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Fecha de recepción</label>
                    <input type="date" className="form-control" value={form.fechaEntrega}
                      onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })} />
                  </div>
                  <div className="col-12">
                    <label className={`form-label fw-semibold ${hayDif() ? "text-warning" : ""}`}>
                      {hayDif()
                        ? <><i className="bi bi-exclamation-triangle me-1"></i>Motivo de la diferencia <span className="text-danger">*</span></>
                        : "Observaciones (opcional)"
                      }
                    </label>
                    <textarea className={`form-control ${hayDif() && !form.observacionesEntrega.trim() ? "border-warning" : ""}`}
                      rows={2}
                      placeholder={hayDif() ? "Explicá la diferencia con el pedido..." : "Notas adicionales..."}
                      value={form.observacionesEntrega}
                      onChange={(e) => setForm({ ...form, observacionesEntrega: e.target.value })} />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-recepcion" className="btn btn-primary btn-lg px-4" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                <i className="bi bi-check-circle me-1"></i>Confirmar recepción
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal nuevo pedido ──────────────────────────────────────────────────────
const NuevoPedidoModal = ({ lotePresel, onClose, onCreado }) => {
  const [lotes, setLotes] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    granja:           lotePresel?.granja || "",
    galpon:           lotePresel?.galpon ? String(lotePresel.galpon) : "",
    lote:             lotePresel?._id    || "",
    fechaEmision:     obtenerFechaHoy(),
    cantidadEstimada: "",
    pesoEstimadoKg:   "",
    observaciones:    "",
  });

  useEffect(() => {
    obtenerLotesGranja({ estado: "en_crianza" }).then(setLotes).catch(() => {});
  }, []);

  const loteSeleccionado = lotes.find((l) => l._id === form.lote) || lotePresel || null;
  const lotesFiltrados   = form.granja
    ? lotes.filter((l) => l.granja === form.granja)
    : lotes;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.granja || !form.cantidadEstimada || !form.pesoEstimadoKg) {
      Swal.fire("Faltan datos", "Completá granja, cantidad y peso estimado.", "warning");
      return;
    }
    setSaving(true);
    try {
      await crearOrdenCarga({
        granja:           form.granja,
        galpon:           form.galpon ? Number(form.galpon) : undefined,
        lote:             form.lote   || undefined,
        fechaEmision:     ajustarFechaParaGuardar(form.fechaEmision),
        cantidadEstimada: Number(form.cantidadEstimada),
        pesoEstimadoKg:   Number(form.pesoEstimadoKg),
        observaciones:    form.observaciones || undefined,
      });
      onCreado();
      Swal.fire({ icon: "success", title: "Pedido creado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const granjaPrefix = (g) => GRANJAS.find((x) => x.key === g)?.prefix || "";

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-clipboard2-plus me-2"></i>Nuevo pedido a granja
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">

              {/* Info del galpón seleccionado */}
              {loteSeleccionado && (
                <div className="card bg-light border-0 mb-3">
                  <div className="card-body py-2 px-3">
                    <div className="small text-muted fw-semibold mb-1 text-uppercase" style={{ letterSpacing: "0.05em" }}>
                      Stock del galpón
                    </div>
                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <div className="fw-bold fs-5">
                        {granjaPrefix(loteSeleccionado.granja)}{loteSeleccionado.galpon}
                      </div>
                      <div>
                        <span className="fw-bold text-success">{loteSeleccionado.cantidadActual?.toLocaleString("es-AR")}</span>
                        <span className="text-muted small ms-1">pollos actuales</span>
                      </div>
                      <div>
                        <span className="text-muted small">Día {diasDeVida(loteSeleccionado.fechaIngreso)} — Sem. {semanaActual(loteSeleccionado.fechaIngreso)}</span>
                      </div>
                      {ultimoPeso(loteSeleccionado) && (
                        <div>
                          <i className="bi bi-speedometer2 me-1 text-primary"></i>
                          <span className="text-primary fw-semibold">{formatPeso(ultimoPeso(loteSeleccionado))}</span>
                          <span className="text-muted small ms-1">último peso</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <form id="form-nuevo-pedido" onSubmit={handleSubmit}>

                {/* Granja + Galpón */}
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Granja <span className="text-danger">*</span></label>
                    <div className="d-flex gap-2">
                      {GRANJAS.map((g) => (
                        <button key={g.key} type="button"
                          className={`btn flex-grow-1 ${form.granja === g.key ? "btn-success" : "btn-outline-secondary"}`}
                          onClick={() => setForm((f) => ({ ...f, granja: g.key, galpon: "", lote: "" }))}>
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Galpón</label>
                    <select className="form-select" value={form.lote}
                      onChange={(e) => {
                        const lote = lotes.find((l) => l._id === e.target.value);
                        setForm((f) => ({
                          ...f,
                          lote:   e.target.value,
                          galpon: lote ? String(lote.galpon) : "",
                        }));
                      }}
                      disabled={!form.granja}>
                      <option value="">Sin lote específico</option>
                      {lotesFiltrados.map((l) => (
                        <option key={l._id} value={l._id}>
                          {granjaPrefix(l.granja)}{l.galpon} — {l.cantidadActual?.toLocaleString("es-AR")} pollos
                          {ultimoPeso(l) ? ` · ${formatPeso(ultimoPeso(l))}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Fecha + Cantidad + Peso */}
                <div className="row g-3 mb-3">
                  <div className="col-6 col-md-4">
                    <label className="form-label fw-semibold">Fecha emisión</label>
                    <input type="date" className="form-control" value={form.fechaEmision}
                      onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required />
                  </div>
                  <div className="col-6 col-md-4">
                    <label className="form-label fw-semibold">Cantidad estimada <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" placeholder="pollos"
                      value={form.cantidadEstimada}
                      onChange={(e) => setForm({ ...form, cantidadEstimada: e.target.value })}
                      min="1" required />
                    {loteSeleccionado && (
                      <div className="form-text">
                        Stock: {loteSeleccionado.cantidadActual?.toLocaleString("es-AR")} pollos
                      </div>
                    )}
                  </div>
                  <div className="col-6 col-md-4">
                    <label className="form-label fw-semibold">Peso estimado (kg) <span className="text-danger">*</span></label>
                    <input type="number" className="form-control" placeholder="0"
                      value={form.pesoEstimadoKg}
                      onChange={(e) => setForm({ ...form, pesoEstimadoKg: e.target.value })}
                      min="0.01" step="0.01" required />
                  </div>
                </div>

                {/* Observaciones */}
                <div className="mb-2">
                  <label className="form-label">Observaciones (opcional)</label>
                  <textarea className="form-control" rows={2} value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                </div>

              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-nuevo-pedido" className="btn btn-success" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-send me-1"></i>Enviar pedido
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
const PedidosGranjaPage = () => {
  const [lotes, setLotes]               = useState([]);
  const [pedidos, setPedidos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [lotePresel, setLotePresel]     = useState(null);
  const [ordenRecepcion, setOrdenRecepcion] = useState(null);
  const [filtroPedido, setFiltroPedido] = useState("pendiente");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [l, p] = await Promise.all([
        obtenerLotesGranja({ estado: "en_crianza" }),
        obtenerOrdenesCarga({ tipo: "pedido_frigorifico" }),
      ]);
      setLotes(l);
      setPedidos(p);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirModal = (lote = null) => {
    setLotePresel(lote);
    setShowModal(true);
  };

  const pedidosFiltrados = filtroPedido
    ? pedidos.filter((p) => p.estado === filtroPedido)
    : pedidos;

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-clipboard2-check me-2 text-success"></i>
            Pedidos a Granja
          </h1>
          <button className="btn btn-success" onClick={() => abrirModal()}>
            <i className="bi bi-plus-circle me-1"></i>Nuevo pedido
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : (
          <>
            {/* ── Stock por galpón ── */}
            <h6 className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: "0.75rem", letterSpacing: "0.06em" }}>
              Stock actual — click para hacer pedido
            </h6>
            {GRANJAS.map(({ key, label, prefix, galpones }) => {
              const lotesGranja = lotes.filter((l) => l.granja === key);
              return (
                <div key={key} className="mb-4">
                  <h6 className="fw-bold text-secondary mb-2">
                    <i className="bi bi-geo-alt me-1"></i>{label}
                    <span className="fw-normal text-muted ms-2 small">
                      {lotesGranja.length}/{galpones} galpones activos
                    </span>
                  </h6>
                  <div className="row g-2">
                    {Array.from({ length: galpones }, (_, i) => i + 1).map((n) => {
                      const lote = lotesGranja.find((l) => l.galpon === n);
                      const dias   = lote ? diasDeVida(lote.fechaIngreso) : null;
                      const sem    = lote ? semanaActual(lote.fechaIngreso) : null;
                      const peso   = lote ? ultimoPeso(lote) : null;
                      const barColor = !lote ? "#ced4da" : dias < 30 ? "#198754" : dias < 40 ? "#fd7e14" : "#dc3545";

                      return (
                        <div key={n} className="col-6 col-sm-4 col-md-3 col-lg-2">
                          <div
                            className={`card border-0 text-center ${lote ? "shadow-sm" : ""}`}
                            style={{
                              borderLeft: `4px solid ${barColor}`,
                              background: lote ? "#f8f9fa" : "#f0f0f0",
                              cursor: lote ? "pointer" : "default",
                              opacity: lote ? 1 : 0.5,
                              minHeight: "100px",
                            }}
                            onClick={() => lote && abrirModal(lote)}
                          >
                            <div className="p-2">
                              <div className="fw-bold fs-5" style={{ color: barColor }}>
                                {prefix}{n}
                              </div>
                              {lote ? (
                                <>
                                  <div className="small text-muted">Día {dias} / Sem. {sem}</div>
                                  <div className="small fw-semibold">
                                    {lote.cantidadActual?.toLocaleString("es-AR")} pollos
                                  </div>
                                  {peso && (
                                    <div className="small text-primary">{formatPeso(peso)}</div>
                                  )}
                                  <div className="mt-1">
                                    <span className="badge bg-success bg-opacity-75" style={{ fontSize: "0.6rem" }}>
                                      <i className="bi bi-plus me-1"></i>Pedir
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div className="small text-muted mt-1">Vacío</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ── Mis pedidos ── */}
            <div className="d-flex align-items-center justify-content-between mb-2 mt-2">
              <h6 className="fw-bold mb-0">Mis pedidos</h6>
              <div className="d-flex gap-1">
                {[
                  { v: "pendiente", l: "Pendientes" },
                  { v: "entregada", l: "Recibidos" },
                  { v: "",          l: "Todos" },
                ].map(({ v, l }) => (
                  <button key={v}
                    className={`btn btn-sm ${filtroPedido === v ? "btn-dark" : "btn-outline-secondary"}`}
                    onClick={() => setFiltroPedido(v)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                {pedidosFiltrados.length === 0 ? (
                  <p className="text-center text-muted py-4 mb-0">No hay pedidos en este estado.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>N° Pedido</th>
                          <th>Granja / Galpón</th>
                          <th>Fecha</th>
                          <th className="text-end">Cant. pedida</th>
                          <th className="text-end">Recibido</th>
                          <th className="text-end">Kg pedidos</th>
                          <th className="text-end">Kg recibidos</th>
                          <th>Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidosFiltrados.map((o) => {
                          const difCant = o.diferenciaCantidad != null && o.diferenciaCantidad !== 0;
                          const difKg   = o.diferenciaKg != null && Math.abs(o.diferenciaKg) > 0.01;
                          return (
                          <tr key={o._id}>
                            <td><span className="badge bg-dark">{o.numero}</span></td>
                            <td className="text-muted small">
                              {o.granja === "cañete" ? "Cañete" : "Los Pinos"}
                              {o.galpon && ` — G${o.galpon}`}
                            </td>
                            <td className="text-muted small">{formatearFechaLocal(o.fechaEmision)}</td>
                            <td className="text-end">{o.cantidadEstimada?.toLocaleString("es-AR")}</td>
                            <td className={`text-end fw-semibold ${difCant ? "text-warning" : ""}`}>
                              {o.cantidadReal != null ? (
                                <>
                                  {o.cantidadReal.toLocaleString("es-AR")}
                                  {difCant && <span className="ms-1 small">({o.diferenciaCantidad > 0 ? "+" : ""}{o.diferenciaCantidad})</span>}
                                </>
                              ) : "—"}
                            </td>
                            <td className="text-end">{o.pesoEstimadoKg} kg</td>
                            <td className={`text-end fw-semibold ${difKg ? "text-warning" : ""}`}>
                              {o.pesoRealKg != null ? (
                                <>
                                  {o.pesoRealKg} kg
                                  {difKg && <span className="ms-1 small">({o.diferenciaKg > 0 ? "+" : ""}{o.diferenciaKg?.toFixed(1)})</span>}
                                </>
                              ) : "—"}
                            </td>
                            <td>{estadoBadgePedido(o)}</td>
                            <td>
                              {o.estado === "pendiente" && (
                                <button className="btn btn-primary btn-sm" onClick={() => setOrdenRecepcion(o)}>
                                  <i className="bi bi-box-arrow-in-down me-1"></i>Recepcionar
                                </button>
                              )}
                              {o.estado === "entregada" && !o.loteAsociado && (
                                <span className="badge bg-info text-dark">Pendiente faena</span>
                              )}
                              {o.loteAsociado && (
                                <span className="badge bg-success"><i className="bi bi-check2 me-1"></i>Faenado</span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {showModal && (
        <NuevoPedidoModal
          lotePresel={lotePresel}
          onClose={() => { setShowModal(false); setLotePresel(null); }}
          onCreado={() => { setShowModal(false); setLotePresel(null); cargar(); }}
        />
      )}

      {ordenRecepcion && (
        <RecepcionarModal
          orden={ordenRecepcion}
          onClose={() => setOrdenRecepcion(null)}
          onConfirmada={() => { setOrdenRecepcion(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default PedidosGranjaPage;
