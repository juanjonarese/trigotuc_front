import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import {
  obtenerLotesGranja,
  registrarPesajeGranja,
  registrarMortandadGranja,
  editarPesajeGranja,
  eliminarPesajeGranja,
  editarMortandadGranja,
  eliminarMortandadGranja,
  mudarPollosGranja,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GRANJAS = [
  { key: "cañete",    label: "Cañete",    prefix: "C" },
  { key: "los_pinos", label: "Los Pinos", prefix: "P" },
];

// Objetivo de peso por semana (kg), según la tabla del productor.
const TABLA_REF_KG = {
  1: 0.162,
  2: 0.410,
  3: 0.800,
  4: 1.320,
  5: 1.930,
  6: 2.560,
  7: 3.180,
};

const validarPeso = (val) => {
  const n = Number(val);
  if (!val || isNaN(n)) return null;
  if (n > 15) return "error";
  if (n > 6)  return "warning";
  return "ok";
};

const diasDeVida = (f) =>
  Math.floor((Date.now() - new Date(f).getTime()) / (1000 * 60 * 60 * 24));
const semanaActual = (f) => Math.max(1, Math.ceil(diasDeVida(f) / 7));

const formatPeso = (g) => {
  if (g == null) return "—";
  return `${(g / 1000).toFixed(3).replace(".", ",")} kg`;
};

// Mayor peso semanal registrado (no día 1 / día 4)
const ultimoPeso = (lote) => {
  const semanales = (lote.pesajes || []).filter((p) => !p.tipo || p.tipo === "semanal");
  return semanales.length ? Math.max(...semanales.map((p) => p.pesoPromedio)) : null;
};

const semanaParaFecha = (fechaIngreso, fechaPesaje) => {
  const ref  = new Date(`${fechaPesaje}T12:00:00.000Z`);
  const base = new Date(fechaIngreso);
  const dias = Math.floor((ref.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil(dias / 7));
};

const tipoParaFecha = (fechaIngreso, fechaPesaje) => {
  const ref  = new Date(`${fechaPesaje}T12:00:00.000Z`);
  const base = new Date(fechaIngreso);
  const dias = Math.floor((ref.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 2) return "dia1";
  if (dias <= 5) return "dia4";
  return "semanal";
};

// Solo pesajes semanales con su mortandad, para la tabla de referencia
const buildSemanas = (lote) => {
  const mapa = {};

  for (const p of lote.pesajes || []) {
    if (p.tipo === "dia1" || p.tipo === "dia4") continue;
    if (!mapa[p.semana]) mapa[p.semana] = { semana: p.semana, pesaje: null, mortandad: null };
    // Varias tomas por semana: mostrar siempre la de mayor peso.
    if (!mapa[p.semana].pesaje || p.pesoPromedio > mapa[p.semana].pesaje.pesoPromedio) {
      mapa[p.semana].pesaje = p;
    }
  }
  for (const m of lote.mortandad || []) {
    if (m.semana === 0) continue; // bajas de ingreso, no semanales
    if (!mapa[m.semana]) mapa[m.semana] = { semana: m.semana, pesaje: null, mortandad: null };
    if (!mapa[m.semana].mortandad) mapa[m.semana].mortandad = m;
  }

  return Object.values(mapa).sort((a, b) => a.semana - b.semana);
};

// Pesajes de día 1 y día 4
const buildIniciales = (lote) =>
  (lote.pesajes || [])
    .filter((p) => p.tipo === "dia1" || p.tipo === "dia4")
    .sort((a) => (a.tipo === "dia1" ? -1 : 1));

// ── Modal editar semana / día inicial ─────────────────────────────────────
const EditarSemanaModal = ({ lote, fila, onClose, onGuardado, puedeEliminar = true, label, hideBajas = false }) => {
  const tituloModal = label ?? `Semana ${fila.semana}`;
  const pesoInicial = fila.pesaje
    ? (fila.pesaje.pesoPromedio / 1000).toFixed(3)
    : "";
  const bajasInicial = fila.mortandad ? String(fila.mortandad.cantidad) : "0";
  const fechaInicial = (fila.pesaje?.fecha || fila.mortandad?.fecha || "").split("T")[0];

  const [peso, setPeso]     = useState(pesoInicial);
  const [bajas, setBajas]   = useState(bajasInicial);
  const [fecha, setFecha]   = useState(fechaInicial);
  const [saving, setSaving] = useState(false);

  const handleGuardar = async () => {
    const pesoVal  = peso !== "" ? Number(peso) : null;
    const bajasVal = Number(bajas);

    if (pesoVal !== null && (isNaN(pesoVal) || pesoVal <= 0 || pesoVal > 15)) {
      Swal.fire("Error", "Peso inválido. Ingresá en kg (ej: 1.350).", "warning"); return;
    }
    if (!hideBajas && (isNaN(bajasVal) || bajasVal < 0)) {
      Swal.fire("Error", "Cantidad de bajas inválida.", "warning"); return;
    }
    if (!fecha) {
      Swal.fire("Error", "La fecha es obligatoria.", "warning"); return;
    }
    const fechaIngresoStr = lote.fechaIngreso?.split("T")[0];
    if (fechaIngresoStr && fecha < fechaIngresoStr) {
      Swal.fire("Error", `La fecha no puede ser anterior al ingreso del lote (${formatearFechaLocal(lote.fechaIngreso)}).`, "warning"); return;
    }
    const fechaGuardar = ajustarFechaParaGuardar(fecha);

    setSaving(true);
    try {
      const promesas = [];

      if (fila.pesaje) {
        const payloadPesaje = { fecha: fechaGuardar };
        if (pesoVal !== null) payloadPesaje.pesoPromedio = Math.round(pesoVal * 1000);
        promesas.push(editarPesajeGranja(lote._id, fila.pesaje._id, payloadPesaje));
      }

      if (!hideBajas) {
        if (fila.mortandad) {
          if (bajasVal === 0) {
            promesas.push(eliminarMortandadGranja(lote._id, fila.mortandad._id));
          } else {
            promesas.push(editarMortandadGranja(lote._id, fila.mortandad._id, { cantidad: bajasVal, fecha: fechaGuardar }));
          }
        } else if (bajasVal > 0) {
          promesas.push(registrarMortandadGranja(lote._id, {
            fecha: fechaGuardar,
            cantidad: bajasVal,
          }));
        }
      }

      await Promise.all(promesas);
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async () => {
    const ok = await Swal.fire({
      title: `¿Eliminar ${tituloModal}?`,
      text: hideBajas ? "Se eliminará el pesaje." : "Se eliminarán el pesaje y las bajas.",
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#dc3545", confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      const promesas = [];
      if (fila.pesaje)                  promesas.push(eliminarPesajeGranja(lote._id, fila.pesaje._id));
      if (!hideBajas && fila.mortandad) promesas.push(eliminarMortandadGranja(lote._id, fila.mortandad._id));
      await Promise.all(promesas);
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const ref = !hideBajas ? TABLA_REF_KG[fila.semana] : null;

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-sm modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header py-2 bg-light">
              <h6 className="modal-title fw-bold">{tituloModal}</h6>
              <button className="btn-close btn-sm" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-semibold small mb-1">Fecha</label>
                <input
                  type="date" className="form-control"
                  value={fecha} onChange={(e) => setFecha(e.target.value)}
                  min={lote.fechaIngreso?.split("T")[0]}
                  max={obtenerFechaHoy()}
                />
                <div className="form-text">Cambiar la fecha puede mover el registro de semana.</div>
              </div>
              <div className={hideBajas ? "" : "mb-3"}>
                <label className="form-label fw-semibold small mb-1">
                  Peso promedio <span className="text-muted fw-normal">(kg)</span>
                </label>
                <input
                  type="number" className="form-control" step="0.001" min="0.001" max="15"
                  value={peso} onChange={(e) => setPeso(e.target.value)}
                  autoFocus disabled={!fila.pesaje}
                />
                {ref != null && (
                  <div className="form-text">Objetivo: {ref.toFixed(3)} kg</div>
                )}
                {!fila.pesaje && (
                  <div className="form-text text-muted">No hay pesaje registrado.</div>
                )}
              </div>
              {!hideBajas && (
                <div>
                  <label className="form-label fw-semibold small mb-1">Bajas</label>
                  <input
                    type="number" className="form-control" min="0"
                    value={bajas} onChange={(e) => setBajas(e.target.value)}
                  />
                  <div className="form-text">Poné 0 para eliminar las bajas de esta semana.</div>
                </div>
              )}
            </div>
            <div className="modal-footer py-2 d-flex justify-content-between">
              {puedeEliminar && (
                <button className="btn btn-outline-danger btn-sm" onClick={handleEliminar} disabled={saving}>
                  <i className="bi bi-trash me-1"></i>Eliminar
                </button>
              )}
              {!puedeEliminar && <div></div>}
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleGuardar} disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal mudar pollos ─────────────────────────────────────────────────────
const MudarPollosModal = ({ lotes, lotePresel, onClose, onGuardado }) => {
  const GRANJAS_OPT = [
    { key: "cañete",    label: "Cañete",    prefix: "C", galpones: 6 },
    { key: "los_pinos", label: "Los Pinos", prefix: "P", galpones: 8 },
  ];

  const [form, setForm] = useState({
    granjaOrigen:  lotePresel?.granja  || "",
    galponOrigen:  lotePresel?.galpon  ? String(lotePresel.galpon) : "",
    granjaDestino: "",
    galponDestino: "",
    cantidad:      "",
    pesoPromedio:  "",
    fecha:         obtenerFechaHoy(),
    observaciones: "",
  });
  const [saving, setSaving] = useState(false);

  const loteOrigen  = lotes.find((l) => l.granja === form.granjaOrigen  && l.galpon === Number(form.galponOrigen)  && l.cantidadActual > 0);
  const loteDestino = lotes.find((l) => l.granja === form.granjaDestino && l.galpon === Number(form.galponDestino));
  const disponible  = loteOrigen ? loteOrigen.cantidadActual - (loteOrigen.cantidadComprometida || 0) : null;

  const prefixG = (g) => GRANJAS_OPT.find((x) => x.key === g)?.prefix || "";

  const galponesDisp = (granja) =>
    GRANJAS_OPT.find((x) => x.key === granja)?.galpones || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.granjaOrigen || !form.galponOrigen || !form.granjaDestino || !form.galponDestino) {
      Swal.fire("Faltan datos", "Seleccioná galpón de origen y destino.", "warning"); return;
    }
    if (form.granjaOrigen === form.granjaDestino && form.galponOrigen === form.galponDestino) {
      Swal.fire("Error", "El galpón de origen y destino no pueden ser el mismo.", "warning"); return;
    }
    if (!form.cantidad || Number(form.cantidad) <= 0) {
      Swal.fire("Faltan datos", "Ingresá la cantidad de pollos a mudar.", "warning"); return;
    }
    setSaving(true);
    try {
      await mudarPollosGranja({
        granjaOrigen:  form.granjaOrigen,
        galponOrigen:  Number(form.galponOrigen),
        granjaDestino: form.granjaDestino,
        galponDestino: Number(form.galponDestino),
        cantidad:      Number(form.cantidad),
        pesoPromedio:  form.pesoPromedio ? Number(form.pesoPromedio) : undefined,
        fecha:         form.fecha,
        observaciones: form.observaciones || undefined,
      });
      onGuardado();
      Swal.fire({
        icon: "success",
        title: "Mudanza registrada",
        html: `<strong>${Number(form.cantidad).toLocaleString("es-AR")} pollos</strong> mudados de ${prefixG(form.granjaOrigen)}${form.galponOrigen} a ${prefixG(form.granjaDestino)}${form.galponDestino}`,
        timer: 2000, showConfirmButton: false,
      });
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
            <div className="modal-header bg-warning text-dark">
              <h5 className="modal-title">
                <i className="bi bi-arrow-left-right me-2"></i>Mudar pollos entre galpones
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-mudar" onSubmit={handleSubmit}>
                <div className="row g-3">

                  {/* Galpón origen */}
                  <div className="col-12">
                    <div className="fw-semibold small text-uppercase text-muted mb-2" style={{ letterSpacing: "0.05em" }}>Origen</div>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Granja <span className="text-danger">*</span></label>
                        <select className="form-select form-select-sm" value={form.granjaOrigen}
                          onChange={(e) => setForm({ ...form, granjaOrigen: e.target.value, galponOrigen: "" })} required>
                          <option value="">— Seleccionar —</option>
                          {GRANJAS_OPT.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Galpón <span className="text-danger">*</span></label>
                        <select className="form-select form-select-sm" value={form.galponOrigen}
                          onChange={(e) => setForm({ ...form, galponOrigen: e.target.value })}
                          disabled={!form.granjaOrigen} required>
                          <option value="">— —</option>
                          {Array.from({ length: galponesDisp(form.granjaOrigen) }, (_, i) => i + 1).map((n) => {
                            const lote = lotes.find((l) => l.granja === form.granjaOrigen && l.galpon === n && l.cantidadActual > 0);
                            return (
                              <option key={n} value={String(n)} disabled={!lote}>
                                {prefixG(form.granjaOrigen)}{n}{lote ? ` — ${(lote.cantidadActual - (lote.cantidadComprometida || 0)).toLocaleString("es-AR")} disp.` : " (vacío)"}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    {loteOrigen && (
                      <div className="mt-2 rounded px-3 py-2 small" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                        <span className="fw-semibold text-warning">{loteOrigen.cantidadActual.toLocaleString("es-AR")}</span> pollos totales ·{" "}
                        <span className="fw-semibold text-success">{disponible.toLocaleString("es-AR")}</span> disponibles
                        {(loteOrigen.cantidadComprometida || 0) > 0 && <> · <span className="text-muted">{loteOrigen.cantidadComprometida.toLocaleString("es-AR")} comprometidos</span></>}
                      </div>
                    )}
                  </div>

                  {/* Galpón destino */}
                  <div className="col-12">
                    <div className="fw-semibold small text-uppercase text-muted mb-2" style={{ letterSpacing: "0.05em" }}>Destino</div>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Granja <span className="text-danger">*</span></label>
                        <select className="form-select form-select-sm" value={form.granjaDestino}
                          onChange={(e) => setForm({ ...form, granjaDestino: e.target.value, galponDestino: "" })} required>
                          <option value="">— Seleccionar —</option>
                          {GRANJAS_OPT.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold small">Galpón <span className="text-danger">*</span></label>
                        <select className="form-select form-select-sm" value={form.galponDestino}
                          onChange={(e) => setForm({ ...form, galponDestino: e.target.value })}
                          disabled={!form.granjaDestino} required>
                          <option value="">— —</option>
                          {Array.from({ length: galponesDisp(form.granjaDestino) }, (_, i) => i + 1).map((n) => {
                            const lote = lotes.find((l) => l.granja === form.granjaDestino && l.galpon === n);
                            return (
                              <option key={n} value={String(n)}>
                                {prefixG(form.granjaDestino)}{n}{lote ? ` — ${lote.cantidadActual.toLocaleString("es-AR")} pollos` : " — vacío (nuevo lote)"}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    {loteDestino && (
                      <div className="mt-2 rounded px-3 py-2 small" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <span className="fw-semibold text-success">{loteDestino.cantidadActual.toLocaleString("es-AR")}</span> pollos actuales
                      </div>
                    )}
                  </div>

                  {/* Cantidad + Peso */}
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Cantidad de pollos <span className="text-danger">*</span></label>
                    <input type="number" className="form-control form-control-sm" min="1"
                      max={disponible ?? undefined}
                      value={form.cantidad}
                      onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                      placeholder="0" required />
                    {disponible != null && form.cantidad && Number(form.cantidad) > disponible && (
                      <div className="form-text text-danger">Supera los disponibles ({disponible.toLocaleString("es-AR")})</div>
                    )}
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Peso promedio (kg) <span className="text-muted fw-normal">opcional</span></label>
                    <input type="number" className="form-control form-control-sm" min="0.1" step="0.001"
                      value={form.pesoPromedio}
                      onChange={(e) => setForm({ ...form, pesoPromedio: e.target.value })}
                      placeholder="ej: 2.500" />
                  </div>

                  {/* Fecha */}
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Fecha</label>
                    <input type="date" className="form-control form-control-sm" value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                      min={loteOrigen ? loteOrigen.fechaIngreso?.split("T")[0] : undefined}
                      max={obtenerFechaHoy()}
                      required />
                  </div>

                  {/* Observaciones */}
                  <div className="col-12">
                    <label className="form-label small">Observaciones <span className="text-muted">(opcional)</span></label>
                    <input type="text" className="form-control form-control-sm"
                      value={form.observaciones}
                      onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                      placeholder="Motivo de la mudanza..." />
                  </div>

                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-mudar" className="btn btn-warning btn-sm px-4" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-arrow-left-right me-1"></i>Confirmar mudanza
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página principal ───────────────────────────────────────────────────────
const GranjaCargaDatosPage = () => {
  const rolUsuario  = localStorage.getItem("rolUsuario");
  const puedeEliminar = ["superadmin", "administracion_granja"].includes(rolUsuario);

  const [lotes, setLotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);
  // modo: null = elegir acción | "cargar" | "editar"
  const [modo, setModo]         = useState(null);
  const [editFila, setEditFila] = useState(null);
  const [editInicial, setEditInicial] = useState(null); // { pesaje, label }
  const [showMudar, setShowMudar]         = useState(false);
  const [lotePreselMudar, setLotePreselMudar] = useState(null);

  const [form, setForm] = useState({ fecha: obtenerFechaHoy(), pesoPromedio: "", mortandad: "", observaciones: "" });
  const [saving, setSaving] = useState(false);

  const cargarLotes = async () => {
    const data = await obtenerLotesGranja({ estado: "en_crianza" });
    setLotes(data);
    return data;
  };

  useEffect(() => {
    cargarLotes().catch(console.error).finally(() => setLoading(false));
  }, []);

  const recargarYSincronizar = async () => {
    const data = await cargarLotes();
    if (loteSeleccionado) {
      const actualizado = data.find((l) => l._id === loteSeleccionado._id);
      if (actualizado) setLoteSeleccionado(actualizado);
    }
  };

  const seleccionar = (lote) => {
    setLoteSeleccionado(lote);
    setModo(null);
    setForm({ fecha: obtenerFechaHoy(), pesoPromedio: "", mortandad: "", observaciones: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prefixDeGranja = (g) => GRANJAS.find((x) => x.key === g)?.prefix || "";

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.pesoPromedio) {
      Swal.fire("Faltan datos", "El peso promedio es obligatorio.", "warning"); return;
    }
    const pesoVal = Number(form.pesoPromedio);
    if (pesoVal > 15) {
      Swal.fire({
        icon: "error", title: "Peso inválido",
        html: `<strong>${pesoVal} kg</strong> es imposible.<br>El campo es en <strong>kg</strong>. Ej: <strong>0.450</strong> para 450 g`,
      }); return;
    }
    if (pesoVal > 6) {
      const { isConfirmed } = await Swal.fire({
        icon: "warning", title: "Peso inusualmente alto",
        html: `Ingresaste <strong>${pesoVal} kg</strong>. ¿Es correcto?`,
        showCancelButton: true, confirmButtonText: "Sí, es correcto", cancelButtonText: "Corregir",
      });
      if (!isConfirmed) return;
    }
    if (form.mortandad === "") {
      Swal.fire("Faltan datos", "Ingresá la mortandad. Si no hubo bajas, poné 0.", "warning"); return;
    }
    setSaving(true);
    try {
      const fecha = ajustarFechaParaGuardar(form.fecha);
      const promesas = [
        registrarPesajeGranja(loteSeleccionado._id, {
          fecha,
          pesoPromedio: Math.round(pesoVal * 1000),
          observaciones: form.observaciones || undefined,
        }),
      ];
      if (Number(form.mortandad) > 0) {
        promesas.push(
          registrarMortandadGranja(loteSeleccionado._id, {
            fecha,
            cantidad: Number(form.mortandad),
            observaciones: form.observaciones || undefined,
          })
        );
      }
      await Promise.all(promesas);
      await recargarYSincronizar();
      await Swal.fire({ icon: "success", title: "Datos guardados", timer: 1400, showConfirmButton: false });
      setForm({ fecha: obtenerFechaHoy(), pesoPromedio: "", mortandad: "", observaciones: "" });
      setModo(null);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <h1 className="h3 mb-0">Datos semanales</h1>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-warning btn-sm"
              onClick={() => { setLotePreselMudar(null); setShowMudar(true); }}
            >
              <i className="bi bi-arrow-left-right me-1"></i>Mudar pollos
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={() => {
                if (!loteSeleccionado) {
                  Swal.fire({ icon: "info", title: "Seleccioná un galpón", text: "Hacé click en el galpón al que querés cargarle datos.", timer: 2000, showConfirmButton: false });
                  return;
                }
                setModo("cargar");
                setForm({ fecha: obtenerFechaHoy(), pesoPromedio: "", mortandad: "", observaciones: "" });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <i className="bi bi-plus-circle me-1"></i>Cargar datos
            </button>
          </div>
        </div>

        {/* Panel del galpón seleccionado */}
        {loteSeleccionado && (() => {
          const dias = diasDeVida(loteSeleccionado.fechaIngreso);
          const sem  = semanaActual(loteSeleccionado.fechaIngreso);
          const galponLabel = `${prefixDeGranja(loteSeleccionado.granja)}${loteSeleccionado.galpon}`;
          const totalBajas  = loteSeleccionado.mortandad.reduce((s, m) => s + m.cantidad, 0);
          const pesoActual  = ultimoPeso(loteSeleccionado);
          const iniciales   = buildIniciales(loteSeleccionado);
          const pesajeDia1  = iniciales.find((p) => p.tipo === "dia1");
          const pesajeDia4  = iniciales.find((p) => p.tipo === "dia4");

          return (
            <div className="card border-0 shadow mb-4 border-start border-4 border-warning">
              {/* Header */}
              <div className="card-header bg-warning text-dark py-2 d-flex align-items-start justify-content-between flex-wrap gap-1">
                <div className="me-2" style={{ minWidth: 0 }}>
                  <span className="fw-bold">Galpón {galponLabel}</span>
                  <div className="small">
                    Día {dias} — Sem. {sem} &nbsp;·&nbsp;
                    {loteSeleccionado.cantidadActual.toLocaleString("es-AR")} pollos
                    {totalBajas > 0 && ` · ${totalBajas} bajas`}
                    {pesoActual != null && ` · Último: ${formatPeso(pesoActual)}`}
                  </div>
                  {(pesajeDia1 || pesajeDia4) && (
                    <div className="small mt-1 opacity-75">
                      {pesajeDia1 && <span>D1: {formatPeso(pesajeDia1.pesoPromedio)}</span>}
                      {pesajeDia1 && pesajeDia4 && <span> &nbsp;·&nbsp; </span>}
                      {pesajeDia4 && <span>D4: {formatPeso(pesajeDia4.pesoPromedio)}</span>}
                    </div>
                  )}
                </div>
                <button className="btn btn-sm btn-outline-dark"
                  onClick={() => { setLoteSeleccionado(null); setModo(null); }}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="card-body py-3">

                {/* ── Elegir acción ── */}
                {modo === null && (
                  <div className="d-flex gap-3 justify-content-center py-2 flex-wrap">
                    <button
                      className="btn btn-success px-4 py-3"
                      style={{ minWidth: "150px" }}
                      onClick={() => setModo("cargar")}
                    >
                      <i className="bi bi-plus-circle fs-4 d-block mb-1"></i>
                      Cargar datos
                    </button>
                    <button
                      className="btn btn-outline-primary px-4 py-3"
                      style={{ minWidth: "150px" }}
                      onClick={() => setModo("editar")}
                      disabled={buildSemanas(loteSeleccionado).length === 0}
                    >
                      <i className="bi bi-pencil-square fs-4 d-block mb-1"></i>
                      Editar datos
                    </button>
                    <button
                      className="btn btn-outline-warning px-4 py-3"
                      style={{ minWidth: "150px" }}
                      onClick={() => { setLotePreselMudar(loteSeleccionado); setShowMudar(true); }}
                    >
                      <i className="bi bi-arrow-left-right fs-4 d-block mb-1"></i>
                      Mudar pollos
                    </button>
                  </div>
                )}

                {/* ── Cargar datos ── */}
                {modo === "cargar" && (() => {
                  const fechaIngresoStr = loteSeleccionado.fechaIngreso?.split("T")[0];
                  const antesDeLIngreso = form.fecha && form.fecha < fechaIngresoStr;
                  const tipoPesaje = form.fecha && !antesDeLIngreso
                    ? tipoParaFecha(loteSeleccionado.fechaIngreso, form.fecha)
                    : null;
                  const semFecha = tipoPesaje === "semanal" && form.fecha
                    ? semanaParaFecha(loteSeleccionado.fechaIngreso, form.fecha)
                    : null;
                  const yaHayPesaje = !antesDeLIngreso && tipoPesaje && (
                    tipoPesaje === "semanal"
                      ? loteSeleccionado.pesajes?.some((p) => (!p.tipo || p.tipo === "semanal") && p.semana === semFecha)
                      : loteSeleccionado.pesajes?.some((p) => p.tipo === tipoPesaje)
                  );
                  const tipoBadge = tipoPesaje === "dia1" ? "Día 1"
                    : tipoPesaje === "dia4" ? "Día 4"
                    : semFecha ? `Semana ${semFecha}` : null;

                  return (
                    <form onSubmit={handleGuardar}>
                      <button type="button" className="btn btn-link btn-sm text-muted p-0 mb-3"
                        onClick={() => setModo(null)}>
                        <i className="bi bi-arrow-left me-1"></i>Volver
                      </button>

                      {antesDeLIngreso && (
                        <div className="alert alert-danger py-2 px-3 mb-2 small">
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>
                          Fecha anterior al ingreso del lote ({formatearFechaLocal(loteSeleccionado.fechaIngreso)}).
                        </div>
                      )}
                      {!antesDeLIngreso && tipoBadge && (() => {
                        // Día 1 / Día 4 siguen siendo únicos; los semanales admiten varias tomas.
                        const duplicadoDia = yaHayPesaje && tipoPesaje !== "semanal";
                        return (
                          <div className={`alert py-2 px-3 mb-2 small ${duplicadoDia ? "alert-warning" : "alert-info"}`}>
                            {duplicadoDia
                              ? <><i className="bi bi-exclamation-triangle me-1"></i><strong>{tipoBadge}</strong> ya tiene datos. Usá <strong>Editar datos</strong> para corregir.</>
                              : yaHayPesaje
                                ? <><i className="bi bi-calendar-check me-1"></i>Ya hay una toma en <strong>{tipoBadge}</strong>. Se agregará otra; la tabla mostrará el <strong>mayor peso</strong>.</>
                                : <><i className="bi bi-calendar-check me-1"></i>Cargando <strong>{tipoBadge}</strong>.</>
                            }
                          </div>
                        );
                      })()}

                      <div className="row g-2">
                        <div className="col-6 col-md-3">
                          <label className="form-label fw-semibold small mb-1">Fecha</label>
                          <input type="date" className="form-control form-control-sm"
                            value={form.fecha}
                            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                            min={fechaIngresoStr}
                            max={obtenerFechaHoy()}
                            required />
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label fw-semibold small mb-1">
                            Peso promedio <span className="text-muted fw-normal">(kg)</span>
                          </label>
                          {(() => {
                            const nivel = validarPeso(form.pesoPromedio);
                            const ref   = semFecha ? TABLA_REF_KG[semFecha] : null;
                            const placeholder = tipoPesaje === "dia1" ? "Ej: 0.040"
                              : tipoPesaje === "dia4" ? "Ej: 0.100"
                              : ref != null ? `Ej: ${ref.toFixed(3)}` : "Ej: 1.350";
                            return (
                              <>
                                <input type="number"
                                  className={`form-control form-control-sm ${nivel === "error" ? "is-invalid" : nivel === "warning" ? "border-warning" : ""}`}
                                  placeholder={placeholder}
                                  value={form.pesoPromedio}
                                  onChange={(e) => setForm({ ...form, pesoPromedio: e.target.value })}
                                  min="0.001" max="15" step="0.001" />
                                {nivel === "error" && (
                                  <div className="invalid-feedback d-block small">
                                    ¿En gramos? El campo es en <strong>kg</strong>.
                                  </div>
                                )}
                                {nivel === "warning" && (
                                  <div className="text-warning small mt-1">Verificá que sea en kg.</div>
                                )}
                                {tipoPesaje === "dia1" && nivel !== "error" && (
                                  <div className="form-text">Ref: ~0,040 kg (40 g)</div>
                                )}
                                {(nivel === "ok" || nivel === null) && ref != null && tipoPesaje === "semanal" && (
                                  <div className="form-text">Objetivo: {ref.toFixed(3)} kg</div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label fw-semibold small mb-1">Mortandad <span className="text-muted fw-normal">(cant.)</span></label>
                          <input type="number" className="form-control form-control-sm"
                            placeholder="0" value={form.mortandad}
                            onChange={(e) => setForm({ ...form, mortandad: e.target.value })}
                            min="0" max={loteSeleccionado.cantidadActual} />
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label small mb-1">Obs. <span className="text-muted">(opcional)</span></label>
                          <input type="text" className="form-control form-control-sm"
                            placeholder="Nota..." value={form.observaciones}
                            onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <button className="btn btn-warning btn-sm px-4" disabled={saving}>
                          {saving
                            ? <span className="spinner-border spinner-border-sm me-1"></span>
                            : <i className="bi bi-check-circle me-1"></i>}
                          Guardar
                        </button>
                      </div>
                    </form>
                  );
                })()}

                {/* ── Editar datos ── */}
                {modo === "editar" && (() => {
                  const semanas  = buildSemanas(loteSeleccionado);
                  const inicalesEdit = buildIniciales(loteSeleccionado);
                  return (
                    <div>
                      <button type="button" className="btn btn-link btn-sm text-muted p-0 mb-3"
                        onClick={() => setModo(null)}>
                        <i className="bi bi-arrow-left me-1"></i>Volver
                      </button>

                      {/* Pesajes iniciales día 1 / día 4 */}
                      {inicalesEdit.length > 0 && (
                        <div className="mb-3">
                          <div className="small fw-semibold text-muted text-uppercase mb-1" style={{ letterSpacing: "0.05em" }}>
                            Pesajes iniciales
                          </div>
                          <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th className="text-center">Tipo</th>
                                  <th className="text-center">Peso prom.</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {inicalesEdit.map((p) => (
                                  <tr key={p._id}>
                                    <td className="text-center fw-semibold">
                                      {p.tipo === "dia1" ? "Día 1" : "Día 4"}
                                    </td>
                                    <td className="text-center">{formatPeso(p.pesoPromedio)}</td>
                                    <td className="text-center">
                                      <button className="btn btn-outline-primary btn-sm"
                                        onClick={() => setEditInicial({ pesaje: p, label: p.tipo === "dia1" ? "Día 1" : "Día 4" })}>
                                        <i className="bi bi-pencil me-1"></i>Editar
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Pesajes semanales */}
                      {semanas.length > 0 && (
                        <>
                          <div className="small fw-semibold text-muted text-uppercase mb-1" style={{ letterSpacing: "0.05em" }}>
                            Semanas
                          </div>
                          <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th className="text-center">Sem.</th>
                                  <th className="text-center">Peso prom.</th>
                                  <th className="text-center">Bajas</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {semanas.map((fila) => (
                                  <tr key={fila.semana}>
                                    <td className="text-center fw-semibold">Sem. {fila.semana}</td>
                                    <td className="text-center">
                                      {fila.pesaje ? formatPeso(fila.pesaje.pesoPromedio) : <span className="text-muted">—</span>}
                                    </td>
                                    <td className="text-center">
                                      {fila.mortandad
                                        ? <span className="text-danger fw-semibold">{fila.mortandad.cantidad.toLocaleString("es-AR")}</span>
                                        : <span className="text-muted">0</span>}
                                    </td>
                                    <td className="text-center">
                                      <button className="btn btn-outline-primary btn-sm"
                                        onClick={() => setEditFila(fila)}>
                                        <i className="bi bi-pencil me-1"></i>Editar
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}

                      {semanas.length === 0 && inicalesEdit.length === 0 && (
                        <p className="text-muted small">No hay datos cargados aún.</p>
                      )}
                    </div>
                  );
                })()}

              </div>
            </div>
          );
        })()}

        {/* Selección de galpón */}
        <p className="text-muted mb-3">
          {loteSeleccionado
            ? "Seleccioná otro galpón:"
            : "Seleccioná el galpón:"}
        </p>

        {lotes.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>No hay galpones activos
          </div>
        ) : (
          GRANJAS.map(({ key, label, prefix }) => {
            const lotesGranja = lotes.filter((l) => l.granja === key);
            if (lotesGranja.length === 0) return null;
            return (
              <div key={key} className="mb-4">
                <h6 className="text-muted fw-semibold mb-2">{label}</h6>
                <div className="row g-2">
                  {lotesGranja.map((lote) => {
                    const dias = diasDeVida(lote.fechaIngreso);
                    const sem  = semanaActual(lote.fechaIngreso);
                    const seleccionado = loteSeleccionado?._id === lote._id;
                    const barColor = dias < 30 ? "#198754" : dias < 45 ? "#fd7e14" : "#dc3545";
                    return (
                      <div key={lote._id} className="col-6 col-sm-4 col-md-3 col-lg-2">
                        <div
                          className={`card text-center p-3 ${seleccionado ? "border-primary border-2 shadow" : "border-0 shadow-sm"}`}
                          style={{
                            cursor: "pointer",
                            background: seleccionado ? "#eff6ff" : "#f8f9fa",
                            borderLeft: `4px solid ${seleccionado ? "#0d6efd" : barColor}`,
                          }}
                          onClick={() => seleccionar(lote)}
                        >
                          <div className="fw-bold fs-5" style={{ color: seleccionado ? "#0d6efd" : barColor }}>
                            {prefix}{lote.galpon}
                          </div>
                          <div className="small text-muted">Día {dias} / Sem. {sem}</div>
                          <div className="small text-muted">
                            {lote.cantidadActual.toLocaleString("es-AR")} pollos
                          </div>
                          {ultimoPeso(lote) != null && (
                            <div className="small text-muted">{formatPeso(ultimoPeso(lote))}</div>
                          )}
                          {seleccionado && (
                            <div className="mt-1"><span className="badge bg-primary">Seleccionado</span></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

      </div>

      {/* Modal editar semana */}
      {editFila && loteSeleccionado && (
        <EditarSemanaModal
          lote={loteSeleccionado}
          fila={editFila}
          onClose={() => setEditFila(null)}
          onGuardado={() => { setEditFila(null); recargarYSincronizar(); }}
          puedeEliminar={puedeEliminar}
        />
      )}

      {/* Modal editar día 1 / día 4 */}
      {editInicial && loteSeleccionado && (
        <EditarSemanaModal
          lote={loteSeleccionado}
          fila={{ pesaje: editInicial.pesaje, mortandad: null }}
          label={editInicial.label}
          hideBajas={true}
          onClose={() => setEditInicial(null)}
          onGuardado={() => { setEditInicial(null); recargarYSincronizar(); }}
          puedeEliminar={puedeEliminar}
        />
      )}

      {/* Modal mudar pollos */}
      {showMudar && (
        <MudarPollosModal
          lotes={lotes}
          lotePresel={lotePreselMudar}
          onClose={() => { setShowMudar(false); setLotePreselMudar(null); }}
          onGuardado={() => { setShowMudar(false); setLotePreselMudar(null); recargarYSincronizar(); }}
        />
      )}
    </Layout>
  );
};

export default GranjaCargaDatosPage;
