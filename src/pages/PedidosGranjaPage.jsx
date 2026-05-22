import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerLotesGranja,
  obtenerOrdenesCarga,
  crearOrdenCarga,
  actualizarOrdenCarga,
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

const semanaActual = (f) => Math.max(1, Math.ceil(diasDeVida(f) / 7));

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
  const [lotes, setLotes]   = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    granja:        lotePresel?.granja || "",
    galpon:        lotePresel?.galpon ? String(lotePresel.galpon) : "",
    lote:          lotePresel?._id    || "",
    fechaEmision:  obtenerFechaHoy(),
    observaciones: "",
  });
  const [lineas, setLineas] = useState([{ cantidad: "", pesoMin: "", pesoMax: "" }]);

  useEffect(() => {
    obtenerLotesGranja({ estado: "en_crianza" }).then(setLotes).catch(() => {});
  }, []);

  const granjaInfo       = GRANJAS.find((g) => g.key === form.granja) || null;
  const loteSeleccionado = lotes.find((l) => l._id === form.lote) || lotePresel || null;

  const totalPollos = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const totalKg     = lineas.reduce((s, l) => {
    const cant = Number(l.cantidad) || 0;
    const pMin = Number(l.pesoMin)  || 0;
    const pMax = Number(l.pesoMax)  || pMin;
    return s + cant * ((pMin + pMax) / 2);
  }, 0);

  const actualizarLinea = (idx, campo, valor) =>
    setLineas((prev) => prev.map((l, i) => i === idx ? { ...l, [campo]: valor } : l));
  const agregarLinea  = () => setLineas((prev) => [...prev, { cantidad: "", pesoMin: "", pesoMax: "" }]);
  const eliminarLinea = (idx) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const handleSeleccionarGalpon = (n) => {
    const loteAuto = lotes.find((l) => l.granja === form.granja && l.galpon === n)?._id || "";
    setForm((f) => ({ ...f, galpon: String(n), lote: loteAuto }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.granja) {
      Swal.fire("Faltan datos", "Seleccioná la granja.", "warning"); return;
    }
    const lineasValidas = lineas.filter((l) => Number(l.cantidad) > 0 && Number(l.pesoMin) > 0);
    if (lineasValidas.length === 0) {
      Swal.fire("Faltan datos", "Completá al menos una línea con cantidad y peso mínimo.", "warning"); return;
    }
    setSaving(true);
    try {
      await crearOrdenCarga({
        granja:           form.granja,
        galpon:           form.galpon ? Number(form.galpon) : undefined,
        lote:             form.lote   || undefined,
        fechaEmision:     ajustarFechaParaGuardar(form.fechaEmision),
        cantidadEstimada: totalPollos,
        pesoEstimadoKg:   Math.round(totalKg * 10) / 10,
        detalle:          lineasValidas.map((l) => ({
          cantidad: Number(l.cantidad),
          pesoMin:  Number(l.pesoMin),
          pesoMax:  l.pesoMax ? Number(l.pesoMax) : undefined,
        })),
        observaciones: form.observaciones || undefined,
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
                    <div className="small text-muted fw-semibold mb-1 text-uppercase" style={{ letterSpacing: "0.05em" }}>Stock del galpón</div>
                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <div className="fw-bold fs-5">{granjaPrefix(loteSeleccionado.granja)}{loteSeleccionado.galpon}</div>
                      <div>
                        <span className="fw-bold text-success">{loteSeleccionado.cantidadActual?.toLocaleString("es-AR")}</span>
                        <span className="text-muted small ms-1">totales</span>
                      </div>
                      {(loteSeleccionado.cantidadComprometida || 0) > 0 && (
                        <>
                          <div>
                            <span className="fw-semibold text-warning">{loteSeleccionado.cantidadComprometida.toLocaleString("es-AR")}</span>
                            <span className="text-muted small ms-1">comprometidos</span>
                          </div>
                          <div>
                            <span className="fw-semibold text-success">{(loteSeleccionado.cantidadActual - loteSeleccionado.cantidadComprometida).toLocaleString("es-AR")}</span>
                            <span className="text-muted small ms-1">disponibles</span>
                          </div>
                        </>
                      )}
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

                {/* Granja */}
                <div className="mb-3">
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

                {/* Galpón */}
                {granjaInfo && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Galpón</label>
                    <div className="d-flex flex-wrap gap-2">
                      {Array.from({ length: granjaInfo.galpones }, (_, i) => i + 1).map((n) => {
                        const lg = lotes.find((l) => l.granja === form.granja && l.galpon === n);
                        const disp = lg ? lg.cantidadActual - (lg.cantidadComprometida || 0) : null;
                        return (
                          <button key={n} type="button"
                            disabled={!lg}
                            onClick={() => handleSeleccionarGalpon(n)}
                            className={`btn btn-sm ${form.galpon === String(n) ? "btn-success" : "btn-outline-secondary"}`}
                            style={{ minWidth: "58px", opacity: lg ? 1 : 0.4 }}>
                            <div className="fw-bold">{granjaInfo.prefix}{n}</div>
                            {lg
                              ? <div style={{ fontSize: "0.6rem" }}>{disp?.toLocaleString("es-AR")}</div>
                              : <div><i className="bi bi-lock-fill" style={{ fontSize: "0.7rem" }}></i></div>
                            }
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fecha */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha emisión</label>
                  <input type="date" className="form-control" value={form.fechaEmision}
                    onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} required />
                </div>

                {/* Composición */}
                <div className="mb-3">
                  <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                    Composición estimada
                  </div>
                  <table className="table table-sm table-bordered align-middle mb-2">
                    <thead className="table-light">
                      <tr>
                        <th>Cantidad (pollos)</th>
                        <th>Peso mín (kg) <span className="text-danger">*</span></th>
                        <th>Peso máx (kg)</th>
                        <th style={{ width: "2.5rem" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((linea, idx) => (
                        <tr key={idx}>
                          <td>
                            <input type="number" className="form-control form-control-sm" min="1" placeholder="ej: 12000"
                              value={linea.cantidad}
                              onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm" min="0.1" step="0.1" placeholder="ej: 3.6"
                              value={linea.pesoMin}
                              onChange={(e) => actualizarLinea(idx, "pesoMin", e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm" min="0.1" step="0.1" placeholder="ej: 3.9"
                              value={linea.pesoMax}
                              onChange={(e) => actualizarLinea(idx, "pesoMax", e.target.value)} />
                          </td>
                          <td className="text-center">
                            {lineas.length > 1 && (
                              <button type="button" className="btn btn-outline-danger btn-sm p-0 px-1" onClick={() => eliminarLinea(idx)}>
                                <i className="bi bi-x-lg"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="btn btn-outline-success btn-sm" onClick={agregarLinea}>
                    <i className="bi bi-plus-circle me-1"></i>Agregar línea
                  </button>
                </div>

                {/* Totales calculados */}
                {totalPollos > 0 && (
                  <div className="rounded px-3 py-2 mb-3 d-flex gap-4" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div>
                      <div className="fw-bold fs-5 text-success">{totalPollos.toLocaleString("es-AR")}</div>
                      <div className="text-muted small">pollos totales</div>
                    </div>
                    <div>
                      <div className="fw-bold fs-5 text-success">{(Math.round(totalKg * 10) / 10).toLocaleString("es-AR")} kg</div>
                      <div className="text-muted small">kg estimados (prom.)</div>
                    </div>
                  </div>
                )}

                {/* Observaciones */}
                <div className="mb-1">
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

// ── Modal editar pedido ─────────────────────────────────────────────────────
const EditarPedidoModal = ({ orden, onClose, onGuardado }) => {
  const [lotes, setLotes]   = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    granja:        orden.granja || "",
    galpon:        orden.galpon ? String(orden.galpon) : "",
    lote:          orden.lote?._id || orden.lote || "",
    fechaEmision:  orden.fechaEmision?.split("T")[0] || obtenerFechaHoy(),
    observaciones: orden.observaciones || "",
  });
  const [lineas, setLineas] = useState(
    orden.detalle?.length > 0
      ? orden.detalle.map((l) => ({ cantidad: String(l.cantidad), pesoMin: String(l.pesoMin), pesoMax: l.pesoMax && Math.abs(l.pesoMax - l.pesoMin) > 0.01 ? String(l.pesoMax) : "" }))
      : [{ cantidad: "", pesoMin: "", pesoMax: "" }]
  );

  useEffect(() => {
    obtenerLotesGranja({ estado: "en_crianza" }).then(setLotes).catch(() => {});
  }, []);

  const granjaInfo       = GRANJAS.find((g) => g.key === form.granja) || null;
  const loteSeleccionado = lotes.find((l) => l._id === form.lote) || null;

  const totalPollos = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  const totalKg     = lineas.reduce((s, l) => {
    const cant = Number(l.cantidad) || 0;
    const pMin = Number(l.pesoMin)  || 0;
    const pMax = Number(l.pesoMax)  || pMin;
    return s + cant * ((pMin + pMax) / 2);
  }, 0);

  const actualizarLinea = (idx, campo, valor) =>
    setLineas((prev) => prev.map((l, i) => i === idx ? { ...l, [campo]: valor } : l));
  const agregarLinea  = () => setLineas((prev) => [...prev, { cantidad: "", pesoMin: "", pesoMax: "" }]);
  const eliminarLinea = (idx) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const handleSeleccionarGalpon = (n) => {
    const loteAuto = lotes.find((l) => l.granja === form.granja && l.galpon === n)?._id || "";
    setForm((f) => ({ ...f, galpon: String(n), lote: loteAuto }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lineasValidas = lineas.filter((l) => Number(l.cantidad) > 0 && Number(l.pesoMin) > 0);
    if (lineasValidas.length === 0) {
      Swal.fire("Faltan datos", "Completá al menos una línea con cantidad y peso mínimo.", "warning"); return;
    }
    setSaving(true);
    try {
      await actualizarOrdenCarga(orden._id, {
        granja:           form.granja,
        galpon:           form.galpon ? Number(form.galpon) : undefined,
        lote:             form.lote   || undefined,
        fechaEmision:     ajustarFechaParaGuardar(form.fechaEmision),
        cantidadEstimada: totalPollos,
        pesoEstimadoKg:   Math.round(totalKg * 10) / 10,
        detalle:          lineasValidas.map((l) => ({
          cantidad: Number(l.cantidad),
          pesoMin:  Number(l.pesoMin),
          pesoMax:  l.pesoMax ? Number(l.pesoMax) : undefined,
        })),
        observaciones: form.observaciones || undefined,
      });
      onGuardado();
      Swal.fire({ icon: "success", title: "Pedido actualizado", timer: 1500, showConfirmButton: false });
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
            <div className="modal-header bg-warning text-dark">
              <h5 className="modal-title">
                <i className="bi bi-pencil-square me-2"></i>Editar pedido — {orden.numero}
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              {loteSeleccionado && (
                <div className="card bg-light border-0 mb-3">
                  <div className="card-body py-2 px-3">
                    <div className="small text-muted fw-semibold mb-1 text-uppercase" style={{ letterSpacing: "0.05em" }}>Stock del galpón</div>
                    <div className="d-flex flex-wrap gap-3 align-items-center">
                      <div className="fw-bold fs-5">{granjaPrefix(loteSeleccionado.granja)}{loteSeleccionado.galpon}</div>
                      <div>
                        <span className="fw-bold text-success">{loteSeleccionado.cantidadActual?.toLocaleString("es-AR")}</span>
                        <span className="text-muted small ms-1">totales</span>
                      </div>
                      {(loteSeleccionado.cantidadComprometida || 0) > 0 && (
                        <div>
                          <span className="fw-semibold text-warning">{loteSeleccionado.cantidadComprometida.toLocaleString("es-AR")}</span>
                          <span className="text-muted small ms-1">comprometidos</span>
                        </div>
                      )}
                      {ultimoPeso(loteSeleccionado) && (
                        <div>
                          <i className="bi bi-speedometer2 me-1 text-primary"></i>
                          <span className="text-primary fw-semibold">{formatPeso(ultimoPeso(loteSeleccionado))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <form id="form-editar-pedido" onSubmit={handleSubmit}>

                {/* Granja */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Granja</label>
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

                {/* Galpón */}
                {granjaInfo && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Galpón</label>
                    <div className="d-flex flex-wrap gap-2">
                      {Array.from({ length: granjaInfo.galpones }, (_, i) => i + 1).map((n) => {
                        const lg = lotes.find((l) => l.granja === form.granja && l.galpon === n);
                        const disp = lg ? lg.cantidadActual - (lg.cantidadComprometida || 0) : null;
                        return (
                          <button key={n} type="button"
                            disabled={!lg}
                            onClick={() => handleSeleccionarGalpon(n)}
                            className={`btn btn-sm ${form.galpon === String(n) ? "btn-success" : "btn-outline-secondary"}`}
                            style={{ minWidth: "58px", opacity: lg ? 1 : 0.4 }}>
                            <div className="fw-bold">{granjaInfo.prefix}{n}</div>
                            {lg
                              ? <div style={{ fontSize: "0.6rem" }}>{disp?.toLocaleString("es-AR")}</div>
                              : <div><i className="bi bi-lock-fill" style={{ fontSize: "0.7rem" }}></i></div>
                            }
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fecha */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha emisión</label>
                  <input type="date" className="form-control" value={form.fechaEmision}
                    onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })} />
                </div>

                {/* Composición */}
                <div className="mb-3">
                  <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>Composición estimada</div>
                  <table className="table table-sm table-bordered align-middle mb-2">
                    <thead className="table-light">
                      <tr>
                        <th>Cantidad (pollos)</th>
                        <th>Peso mín (kg) <span className="text-danger">*</span></th>
                        <th>Peso máx (kg)</th>
                        <th style={{ width: "2.5rem" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((linea, idx) => (
                        <tr key={idx}>
                          <td>
                            <input type="number" className="form-control form-control-sm" min="1" placeholder="ej: 12000"
                              value={linea.cantidad} onChange={(e) => actualizarLinea(idx, "cantidad", e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm" min="0.1" step="0.1" placeholder="ej: 3.6"
                              value={linea.pesoMin} onChange={(e) => actualizarLinea(idx, "pesoMin", e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className="form-control form-control-sm" min="0.1" step="0.1" placeholder="ej: 3.9"
                              value={linea.pesoMax} onChange={(e) => actualizarLinea(idx, "pesoMax", e.target.value)} />
                          </td>
                          <td className="text-center">
                            {lineas.length > 1 && (
                              <button type="button" className="btn btn-outline-danger btn-sm p-0 px-1" onClick={() => eliminarLinea(idx)}>
                                <i className="bi bi-x-lg"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="btn btn-outline-success btn-sm" onClick={agregarLinea}>
                    <i className="bi bi-plus-circle me-1"></i>Agregar línea
                  </button>
                </div>

                {/* Totales */}
                {totalPollos > 0 && (
                  <div className="rounded px-3 py-2 mb-3 d-flex gap-4" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div>
                      <div className="fw-bold fs-5 text-success">{totalPollos.toLocaleString("es-AR")}</div>
                      <div className="text-muted small">pollos totales</div>
                    </div>
                    <div>
                      <div className="fw-bold fs-5 text-success">{(Math.round(totalKg * 10) / 10).toLocaleString("es-AR")} kg</div>
                      <div className="text-muted small">kg estimados (prom.)</div>
                    </div>
                  </div>
                )}

                {/* Observaciones */}
                <div className="mb-1">
                  <label className="form-label">Observaciones (opcional)</label>
                  <textarea className="form-control" rows={2} value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-editar-pedido" className="btn btn-warning" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-circle me-1"></i>Guardar cambios
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
  const rolUsuario = localStorage.getItem("rolUsuario");
  const esAdmin    = rolUsuario === "superadmin" || rolUsuario === "administracion";

  const [lotes, setLotes]               = useState([]);
  const [pedidos, setPedidos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [lotePresel, setLotePresel]     = useState(null);
  const [ordenRecepcion, setOrdenRecepcion] = useState(null);
  const [ordenEditar, setOrdenEditar]   = useState(null);
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
          <span title={lotes.length === 0 ? "No hay galpones con pollos en crianza" : ""}>
            <button
              className="btn btn-success"
              onClick={() => abrirModal()}
              disabled={lotes.length === 0}
            >
              {lotes.length === 0
                ? <><i className="bi bi-lock me-1"></i>Sin stock en granja</>
                : <><i className="bi bi-plus-circle me-1"></i>Nuevo pedido</>
              }
            </button>
          </span>
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
                      const comprometidos = lote?.cantidadComprometida || 0;
                      const disponibles   = lote ? lote.cantidadActual - comprometidos : 0;
                      const pedidosPendientes = pedidos.filter(
                        (p) => p.estado === "pendiente" && p.granja === key && p.galpon === n
                      ).length;
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
                                  {comprometidos > 0 && (
                                    <>
                                      <div className="small text-warning fw-semibold">
                                        {comprometidos.toLocaleString("es-AR")} comprometidos
                                      </div>
                                      <div className="small fw-semibold" style={{ color: "#16a34a" }}>
                                        {disponibles.toLocaleString("es-AR")} disponibles
                                      </div>
                                    </>
                                  )}
                                  {peso && (
                                    <div className="small text-primary">{formatPeso(peso)}</div>
                                  )}
                                  {pedidosPendientes > 0 && (
                                    <div className="mt-1">
                                      <span className="badge bg-primary" style={{ fontSize: "0.6rem" }}>
                                        <i className="bi bi-clipboard2-check me-1"></i>
                                        {pedidosPendientes} pedido{pedidosPendientes > 1 ? "s" : ""} activo{pedidosPendientes > 1 ? "s" : ""}
                                      </span>
                                    </div>
                                  )}
                                  <div className="mt-1">
                                    <span className="badge bg-success bg-opacity-75" style={{ fontSize: "0.6rem" }}>
                                      <i className="bi bi-plus me-1"></i>Pedir
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-lock-fill text-secondary mt-1" style={{ fontSize: "1.4rem" }}></i>
                                  <div className="small text-muted mt-1">Vacío</div>
                                </>
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

            {/* ── Alertas de diferencias (solo admin) ── */}
            {esAdmin && (() => {
              const conDif = pedidos.filter((o) =>
                o.estado === "entregada" && (
                  (o.diferenciaCantidad != null && o.diferenciaCantidad !== 0) ||
                  (o.diferenciaKg != null && Math.abs(o.diferenciaKg) > 0.01)
                )
              );
              if (conDif.length === 0) return null;
              return (
                <div className="mb-4">
                  <h6 className="fw-semibold mb-2" style={{ color: "#b45309" }}>
                    <i className="bi bi-exclamation-triangle-fill me-2 text-warning"></i>
                    Diferencias en recepciones ({conDif.length})
                  </h6>
                  <div className="card border-warning border-0 shadow-sm">
                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead style={{ background: "#fef9c3" }}>
                            <tr>
                              <th>N° Pedido</th>
                              <th>Granja / Galpón</th>
                              <th>Fecha recepción</th>
                              <th className="text-end">Cant. pedida</th>
                              <th className="text-end">Cant. recibida</th>
                              <th className="text-end">Dif. unidades</th>
                              <th className="text-end">Kg pedidos</th>
                              <th className="text-end">Kg recibidos</th>
                              <th className="text-end">Dif. kg</th>
                              <th>Motivo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {conDif.map((o) => (
                              <tr key={o._id} style={{ background: "#fffbeb" }}>
                                <td><span className="badge bg-warning text-dark">{o.numero}</span></td>
                                <td className="small">
                                  {(o.granja === "cañete" ? "C" : "P")}{o.galpon || ""}
                                </td>
                                <td className="small text-muted">{formatearFechaLocal(o.fechaEntrega)}</td>
                                <td className="text-end">{o.cantidadEstimada?.toLocaleString("es-AR")}</td>
                                <td className="text-end fw-semibold">{o.cantidadReal?.toLocaleString("es-AR")}</td>
                                <td className="text-end fw-bold" style={{ color: o.diferenciaCantidad < 0 ? "#dc2626" : "#16a34a" }}>
                                  {o.diferenciaCantidad > 0 ? "+" : ""}{o.diferenciaCantidad}
                                </td>
                                <td className="text-end">{o.pesoEstimadoKg} kg</td>
                                <td className="text-end fw-semibold">{o.pesoRealKg} kg</td>
                                <td className="text-end fw-bold" style={{ color: o.diferenciaKg < 0 ? "#dc2626" : "#16a34a" }}>
                                  {o.diferenciaKg > 0 ? "+" : ""}{o.diferenciaKg?.toFixed(1)} kg
                                </td>
                                <td className="small text-muted" style={{ maxWidth: "180px" }}>
                                  {o.observacionesEntrega || <span className="text-muted fst-italic">Sin motivo</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                          const entregada = o.estado === "entregada";
                          const dcant = o.cantidadReal != null ? (o.diferenciaCantidad ?? (o.cantidadReal - o.cantidadEstimada)) : null;
                          const dkg   = o.pesoRealKg  != null ? (o.diferenciaKg      ?? (o.pesoRealKg  - o.pesoEstimadoKg))   : null;
                          return (
                          <tr key={o._id}>
                            <td><span className="badge bg-dark">{o.numero}</span></td>
                            <td className="text-muted small">
                              {(o.granja === "cañete" ? "C" : "P")}{o.galpon || ""}
                            </td>
                            <td className="text-muted small">{formatearFechaLocal(o.fechaEmision)}</td>
                            <td className="text-end">{o.cantidadEstimada?.toLocaleString("es-AR")}</td>
                            <td className={`text-end fw-semibold ${entregada && dcant !== 0 ? "text-warning" : ""}`}>
                              {o.cantidadReal != null ? (
                                <>
                                  {o.cantidadReal.toLocaleString("es-AR")}
                                  <span className={`ms-1 small ${dcant === 0 ? "text-success" : "text-warning"}`}>
                                    ({dcant > 0 ? "+" : ""}{dcant})
                                  </span>
                                </>
                              ) : "—"}
                            </td>
                            <td className="text-end">{o.pesoEstimadoKg} kg</td>
                            <td className={`text-end fw-semibold ${entregada && Math.abs(dkg) > 0.01 ? "text-warning" : ""}`}>
                              {o.pesoRealKg != null ? (
                                <>
                                  {o.pesoRealKg} kg
                                  <span className={`ms-1 small ${Math.abs(dkg) <= 0.01 ? "text-success" : "text-warning"}`}>
                                    ({dkg > 0 ? "+" : ""}{dkg?.toFixed(1)})
                                  </span>
                                </>
                              ) : "—"}
                            </td>
                            <td>{estadoBadgePedido(o)}</td>
                            <td>
                              {o.estado === "pendiente" && (
                                <div className="d-flex gap-1">
                                  <button className="btn btn-outline-warning btn-sm" onClick={() => setOrdenEditar(o)}>
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                  <button className="btn btn-primary btn-sm" onClick={() => setOrdenRecepcion(o)}>
                                    <i className="bi bi-box-arrow-in-down me-1"></i>Recepcionar
                                  </button>
                                </div>
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

      {ordenEditar && (
        <EditarPedidoModal
          orden={ordenEditar}
          onClose={() => setOrdenEditar(null)}
          onGuardado={() => { setOrdenEditar(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default PedidosGranjaPage;
