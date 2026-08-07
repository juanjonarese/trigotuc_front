import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import HistorialReproductor from "../components/HistorialReproductor";
import MudanzaPosturaModal from "../components/MudanzaPosturaModal";
import {
  obtenerConstantesReproductores,
  obtenerLotesReproductores,
  registrarMortandadReproductor,
  editarMortandadReproductor,
  eliminarMortandadReproductor,
  registrarPesajeReproductor,
  editarPesajeReproductor,
  eliminarPesajeReproductor,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import {
  formatearNumero,
  SEXO_LABEL,
  SECTOR_LABEL,
  nombreGalpon,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const SECTORES = ["recria", "postura"];
const COLOR_SECTOR = { recria: "#0dcaf0", postura: "#198754" };

// El peso se carga en gramos (un reproductor adulto ronda los 2.500–4.000 g).
const PESO_MAX = 8000;
const PESO_MIN_SOSPECHOSO = 100;

const FORM_VACIO = {
  fecha: obtenerFechaHoy(),
  bajasHembras: "",
  bajasMachos: "",
  causa: "",
  pesoHembras: "",
  pesoMachos: "",
};

const soloFecha = (f) => (f || "").split("T")[0];

// ── Tarjeta de galpón ───────────────────────────────────────────────────────
const GalponCard = ({ galpon, sector, lote, seleccionado, onSelect }) => {
  const color = seleccionado ? "#0d6efd" : lote ? COLOR_SECTOR[sector] : "#ced4da";
  const bajas = (lote?.mortandad || []).reduce((s, m) => s + m.cantidad, 0);
  return (
    <div className="col-6 col-sm-4 col-md-3 col-lg-2">
      <div
        className={`card text-center p-3 h-100 ${
          seleccionado ? "border-primary border-2 shadow" : "border-0 shadow-sm"
        }`}
        style={{
          cursor: lote ? "pointer" : "default",
          opacity: lote ? 1 : 0.55,
          background: seleccionado ? "#eff6ff" : "#f8f9fa",
          borderLeft: `4px solid ${color}`,
        }}
        onClick={() => lote && onSelect(lote)}
      >
        <div className="fw-bold" style={{ color }}>
          {galpon.nombre}
        </div>
        {lote ? (
          <>
            <div className="small text-muted">Lote #{lote.numeroLote}</div>
            <div className="small text-muted">Semana {lote.semanaVida ?? "?"}</div>
            <div className="small text-muted">
              {formatearNumero(lote.hembras?.actual)} H / {formatearNumero(lote.machos?.actual)} M
            </div>
            {bajas > 0 && (
              <div className="mt-1">
                <span className="badge bg-danger bg-opacity-75">{formatearNumero(bajas)} bajas</span>
              </div>
            )}
            {seleccionado && (
              <div className="mt-1">
                <span className="badge bg-primary">Seleccionado</span>
              </div>
            )}
          </>
        ) : (
          <div className="small text-muted mt-1">
            <i className="bi bi-dash-circle d-block mb-1"></i>Vacío
          </div>
        )}
      </div>
    </div>
  );
};

// ── Modal: editar una baja ──────────────────────────────────────────────────
const EditarMortandadModal = ({ lote, entrada, onClose, onGuardado }) => {
  const [cantidad, setCantidad] = useState(String(entrada.cantidad));
  const [causa, setCausa] = useState(entrada.causa || "");
  const [fecha, setFecha] = useState(soloFecha(entrada.fecha));
  const [saving, setSaving] = useState(false);

  const handleGuardar = async (e) => {
    e.preventDefault();
    const val = Number(cantidad);
    if (!cantidad || isNaN(val) || val <= 0) {
      Swal.fire("Cantidad inválida", "Tiene que ser mayor a cero.", "warning");
      return;
    }
    if (fecha < soloFecha(lote.fechaIngreso)) {
      Swal.fire(
        "Fecha inválida",
        `No puede ser anterior al ingreso del lote (${formatearFechaLocal(lote.fechaIngreso)}).`,
        "warning"
      );
      return;
    }
    setSaving(true);
    try {
      await editarMortandadReproductor(lote._id, entrada._id, {
        cantidad: val,
        causa: causa || "",
        fecha: ajustarFechaParaGuardar(fecha),
      });
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">
                <i className="bi bi-pencil-square me-2"></i>Editar baja —{" "}
                {SEXO_LABEL[entrada.sexo]}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <form onSubmit={handleGuardar}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Cantidad</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                  <div className="form-text">
                    Si subís la cantidad se descuentan más aves del galpón; si la bajás, vuelven.
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Causa</label>
                  <input
                    type="text"
                    className="form-control"
                    value={causa}
                    onChange={(e) => setCausa(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold small">Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fecha}
                    min={soloFecha(lote.fechaIngreso)}
                    max={obtenerFechaHoy()}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: editar un pesaje ─────────────────────────────────────────────────
const EditarPesajeModal = ({ lote, pesaje, onClose, onGuardado }) => {
  const [peso, setPeso] = useState(String(pesaje.pesoPromedio));
  const [fecha, setFecha] = useState(soloFecha(pesaje.fecha));
  const [saving, setSaving] = useState(false);

  const handleGuardar = async (e) => {
    e.preventDefault();
    const val = Number(peso);
    if (!peso || isNaN(val) || val <= 0 || val > PESO_MAX) {
      Swal.fire("Peso inválido", `Cargá el peso promedio en gramos (hasta ${PESO_MAX}).`, "warning");
      return;
    }
    if (fecha < soloFecha(lote.fechaIngreso)) {
      Swal.fire(
        "Fecha inválida",
        `No puede ser anterior al ingreso del lote (${formatearFechaLocal(lote.fechaIngreso)}).`,
        "warning"
      );
      return;
    }
    setSaving(true);
    try {
      await editarPesajeReproductor(lote._id, pesaje._id, {
        pesoPromedio: val,
        fecha: ajustarFechaParaGuardar(fecha),
      });
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-pencil-square me-2"></i>Editar pesaje —{" "}
                {SEXO_LABEL[pesaje.sexo]}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <form onSubmit={handleGuardar}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Peso promedio (g)</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max={PESO_MAX}
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold small">Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fecha}
                    min={soloFecha(lote.fechaIngreso)}
                    max={obtenerFechaHoy()}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                  <div className="form-text">
                    Si cambiás la fecha, el registro se reubica en la semana que corresponda.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
const ReproductoresDatosPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [loteId, setLoteId] = useState("");
  const [loading, setLoading] = useState(true);
  // modo: null = elegir acción | "cargar" | "editar"
  const [modo, setModo] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [editMortandad, setEditMortandad] = useState(null);
  const [editPesaje, setEditPesaje] = useState(null);
  const [showMudanza, setShowMudanza] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [cons, data] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerLotesReproductores({ activos: "true" }),
      ]);
      setConstantes(cons);
      const activos = Array.isArray(data) ? data : [];
      setLotes(activos);
      // Se mantiene el galpón elegido mientras el lote siga activo.
      setLoteId((prev) => (activos.some((l) => l._id === prev) ? prev : ""));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los lotes.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const lote = lotes.find((l) => l._id === loteId) || null;

  const seleccionar = (l) => {
    setLoteId(l._id);
    setModo(null);
    setForm(FORM_VACIO);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const abrirCarga = () => {
    setModo("cargar");
    setForm(FORM_VACIO);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Carga: bajas y pesos de la fecha elegida, por sexo ────────────────────
  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!lote) return;

    const bajasH = form.bajasHembras === "" ? 0 : Number(form.bajasHembras);
    const bajasM = form.bajasMachos === "" ? 0 : Number(form.bajasMachos);
    const pesoH = form.pesoHembras === "" ? null : Number(form.pesoHembras);
    const pesoM = form.pesoMachos === "" ? null : Number(form.pesoMachos);

    if (!bajasH && !bajasM && pesoH === null && pesoM === null) {
      Swal.fire("Faltan datos", "Cargá al menos una baja o un peso promedio.", "warning");
      return;
    }
    if ([bajasH, bajasM].some((v) => isNaN(v) || v < 0)) {
      Swal.fire("Bajas inválidas", "Las bajas no pueden ser negativas.", "warning");
      return;
    }
    for (const [peso, label] of [
      [pesoH, "hembras"],
      [pesoM, "machos"],
    ]) {
      if (peso === null) continue;
      if (isNaN(peso) || peso <= 0 || peso > PESO_MAX) {
        Swal.fire(
          "Peso inválido",
          `El peso de ${label} se carga en gramos (hasta ${formatearNumero(PESO_MAX)}).`,
          "warning"
        );
        return;
      }
      if (peso < PESO_MIN_SOSPECHOSO) {
        const { isConfirmed } = await Swal.fire({
          icon: "warning",
          title: "Peso muy bajo",
          html: `Cargaste <strong>${peso} g</strong> para ${label}. El campo es en <strong>gramos</strong>. ¿Es correcto?`,
          showCancelButton: true,
          confirmButtonText: "Sí, es correcto",
          cancelButtonText: "Corregir",
        });
        if (!isConfirmed) return;
      }
    }
    if (form.fecha < soloFecha(lote.fechaIngreso)) {
      Swal.fire(
        "Fecha inválida",
        `No puede ser anterior al ingreso del lote (${formatearFechaLocal(lote.fechaIngreso)}).`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const fecha = ajustarFechaParaGuardar(form.fecha);

      // Todas las llamadas escriben el MISMO documento de lote (mortandad y
      // pesajes son subdocumentos), así que van una por una: en paralelo se
      // pisan entre ellas.
      const pasos = [];
      if (bajasH > 0)
        pasos.push(() =>
          registrarMortandadReproductor(lote._id, {
            sexo: "hembra",
            cantidad: bajasH,
            causa: form.causa || undefined,
            fecha,
          })
        );
      if (bajasM > 0)
        pasos.push(() =>
          registrarMortandadReproductor(lote._id, {
            sexo: "macho",
            cantidad: bajasM,
            causa: form.causa || undefined,
            fecha,
          })
        );
      if (pesoH !== null)
        pasos.push(() =>
          registrarPesajeReproductor(lote._id, { sexo: "hembra", pesoPromedio: pesoH, fecha })
        );
      if (pesoM !== null)
        pasos.push(() =>
          registrarPesajeReproductor(lote._id, { sexo: "macho", pesoPromedio: pesoM, fecha })
        );

      for (const paso of pasos) await paso();

      await cargar();
      setForm(FORM_VACIO);
      setModo(null);
      Swal.fire({ icon: "success", title: "Datos guardados", timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron guardar los datos.", "error");
    } finally {
      setSaving(false);
    }
  };

  const borrarMortandad = async (entrada) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar el registro?",
      text: `Se devuelven ${entrada.cantidad} ${SEXO_LABEL[entrada.sexo].toLowerCase()} al galpón.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await eliminarMortandadReproductor(lote._id, entrada._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const borrarPesaje = async (pesaje) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar el pesaje?",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await eliminarPesajeReproductor(lote._id, pesaje._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const bajasPorSexo = (sexo) =>
    (lote?.mortandad || []).filter((m) => m.sexo === sexo).reduce((acc, m) => acc + m.cantidad, 0);

  const totalBajas = bajasPorSexo("hembra") + bajasPorSexo("macho");
  const hayDatos = (lote?.mortandad?.length || 0) + (lote?.pesajes?.length || 0) > 0;

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
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-pencil-square text-success me-2"></i>Datos Semanales —
              Reproductores
            </h1>
            <p className="text-muted mb-0 small">
              Mortandad y peso promedio, siempre discriminados por sexo
            </p>
          </div>
          <button
            className="btn btn-success btn-sm"
            onClick={() => {
              if (!lote) {
                Swal.fire({
                  icon: "info",
                  title: "Seleccioná un galpón",
                  text: "Hacé click en el galpón al que querés cargarle datos.",
                  timer: 2200,
                  showConfirmButton: false,
                });
                return;
              }
              abrirCarga();
            }}
          >
            <i className="bi bi-plus-circle me-1"></i>Cargar datos
          </button>
        </div>

        {lotes.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              No hay lotes reproductores activos.
            </div>
          </div>
        ) : (
          <>
            {/* Panel del galpón seleccionado */}
            {lote && (
              <div className="card border-0 shadow mb-4">
                <div className="card-header bg-warning-subtle text-dark py-2 d-flex align-items-start justify-content-between flex-wrap gap-1">
                  <div className="me-2" style={{ minWidth: 0 }}>
                    <span className="fw-bold">
                      {nombreGalpon(constantes?.galpones, lote.sector, lote.galpon)} — Lote #
                      {lote.numeroLote}
                    </span>
                    <div className="small">
                      Semana {lote.semanaVida ?? "?"}/{constantes?.semanasCicloVida ?? 65}
                      &nbsp;·&nbsp;{formatearNumero(lote.hembras?.actual)} hembras /{" "}
                      {formatearNumero(lote.machos?.actual)} machos
                      {totalBajas > 0 && ` · ${formatearNumero(totalBajas)} bajas`}
                    </div>
                    <div className="small opacity-75">
                      Ingreso: {formatearFechaLocal(lote.fechaIngreso)} ·{" "}
                      {SECTOR_LABEL[lote.sector]}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => {
                      setLoteId("");
                      setModo(null);
                    }}
                  >
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
                        onClick={abrirCarga}
                      >
                        <i className="bi bi-plus-circle fs-4 d-block mb-1"></i>
                        Cargar datos
                      </button>
                      <button
                        className="btn btn-outline-primary px-4 py-3"
                        style={{ minWidth: "150px" }}
                        onClick={() => setModo("editar")}
                        disabled={!hayDatos}
                      >
                        <i className="bi bi-pencil-square fs-4 d-block mb-1"></i>
                        Editar datos
                      </button>
                      {lote.sector === "recria" && (
                        <button
                          className="btn btn-outline-warning px-4 py-3"
                          style={{ minWidth: "150px" }}
                          onClick={() => setShowMudanza(true)}
                        >
                          <i className="bi bi-arrow-right-circle fs-4 d-block mb-1"></i>
                          Mudar a postura
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Cargar datos ── */}
                  {modo === "cargar" && (
                    <form onSubmit={handleGuardar}>
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-muted p-0 mb-3"
                        onClick={() => setModo(null)}
                      >
                        <i className="bi bi-arrow-left me-1"></i>Volver
                      </button>

                      <div className="alert alert-info py-2 px-3 mb-3 small">
                        <i className="bi bi-calendar-check me-1"></i>
                        Todo lo que cargues queda registrado en la fecha elegida (
                        <strong>{formatearFechaLocal(form.fecha)}</strong>) y se agrupa en la semana
                        que corresponda. Dejá vacío lo que no tengas.
                      </div>

                      <div className="row g-3">
                        <div className="col-12 col-md-3">
                          <label className="form-label fw-semibold small mb-1">Fecha</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={form.fecha}
                            min={soloFecha(lote.fechaIngreso)}
                            max={obtenerFechaHoy()}
                            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-12 col-md-9">
                          <label className="form-label fw-semibold small mb-1">
                            Causa de las bajas <span className="text-muted fw-normal">(opcional)</span>
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={form.causa}
                            onChange={(e) => setForm({ ...form, causa: e.target.value })}
                            placeholder="Ej: golpe de calor"
                          />
                        </div>
                      </div>

                      <div className="row g-3 mt-1">
                        <div className="col-12 col-lg-6">
                          <div className="border rounded p-3 h-100">
                            <div className="fw-semibold mb-2">
                              <i className="bi bi-heartbreak text-danger me-1"></i>Mortandad del día
                            </div>
                            <div className="row g-2">
                              <div className="col-6">
                                <label className="form-label small mb-1">{SEXO_LABEL.hembra}</label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min="0"
                                  placeholder="0"
                                  value={form.bajasHembras}
                                  onChange={(e) => setForm({ ...form, bajasHembras: e.target.value })}
                                />
                                <div className="form-text">
                                  Vivas: {formatearNumero(lote.hembras?.actual)}
                                </div>
                              </div>
                              <div className="col-6">
                                <label className="form-label small mb-1">{SEXO_LABEL.macho}</label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min="0"
                                  placeholder="0"
                                  value={form.bajasMachos}
                                  onChange={(e) => setForm({ ...form, bajasMachos: e.target.value })}
                                />
                                <div className="form-text">
                                  Vivos: {formatearNumero(lote.machos?.actual)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="col-12 col-lg-6">
                          <div className="border rounded p-3 h-100">
                            <div className="fw-semibold mb-2">
                              <i className="bi bi-speedometer2 text-success me-1"></i>Peso promedio
                              <span className="text-muted fw-normal small"> (gramos)</span>
                            </div>
                            <div className="row g-2">
                              <div className="col-6">
                                <label className="form-label small mb-1">{SEXO_LABEL.hembra}</label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min="1"
                                  max={PESO_MAX}
                                  placeholder="Ej: 2450"
                                  value={form.pesoHembras}
                                  onChange={(e) => setForm({ ...form, pesoHembras: e.target.value })}
                                />
                              </div>
                              <div className="col-6">
                                <label className="form-label small mb-1">{SEXO_LABEL.macho}</label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min="1"
                                  max={PESO_MAX}
                                  placeholder="Ej: 3600"
                                  value={form.pesoMachos}
                                  onChange={(e) => setForm({ ...form, pesoMachos: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="form-text mt-2">
                              El pesaje es semanal; las bajas se cargan todos los días.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex justify-content-end gap-2 mt-3">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setModo(null)}
                          disabled={saving}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="btn btn-success" disabled={saving}>
                          {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                          Guardar datos
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Editar datos ── */}
                  {modo === "editar" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-muted p-0 mb-3"
                        onClick={() => setModo(null)}
                      >
                        <i className="bi bi-arrow-left me-1"></i>Volver
                      </button>
                      <HistorialReproductor
                        key={lote._id}
                        lote={lote}
                        tabInicial="mortandad"
                        onEditarMortandad={setEditMortandad}
                        onBorrarMortandad={borrarMortandad}
                        onEditarPesaje={setEditPesaje}
                        onBorrarPesaje={borrarPesaje}
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Selección de galpón */}
            <p className="text-muted mb-3">
              {lote ? "Seleccioná otro galpón:" : "Seleccioná el galpón:"}
            </p>
            {SECTORES.map((sector) => {
              const galpones = constantes?.galpones?.[sector] || [];
              if (galpones.length === 0) return null;
              return (
                <div key={sector} className="mb-4">
                  <h6 className="text-muted fw-semibold mb-2">{SECTOR_LABEL[sector]}</h6>
                  <div className="row g-2">
                    {galpones.map((g) => (
                      <GalponCard
                        key={`${sector}-${g.numero}`}
                        galpon={g}
                        sector={sector}
                        lote={lotes.find((l) => l.sector === sector && l.galpon === g.numero)}
                        seleccionado={!!lote && lote.sector === sector && lote.galpon === g.numero}
                        onSelect={seleccionar}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {editMortandad && lote && (
        <EditarMortandadModal
          lote={lote}
          entrada={editMortandad}
          onClose={() => setEditMortandad(null)}
          onGuardado={() => {
            setEditMortandad(null);
            cargar();
          }}
        />
      )}

      {editPesaje && lote && (
        <EditarPesajeModal
          lote={lote}
          pesaje={editPesaje}
          onClose={() => setEditPesaje(null)}
          onGuardado={() => {
            setEditPesaje(null);
            cargar();
          }}
        />
      )}

      {showMudanza && lote && (
        <MudanzaPosturaModal
          lote={lote}
          constantes={constantes}
          lotes={lotes}
          onClose={() => setShowMudanza(false)}
          onHecho={() => {
            setShowMudanza(false);
            setModo(null);
            cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default ReproductoresDatosPage;
