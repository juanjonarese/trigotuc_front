import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  obtenerLotesGranja,
  registrarPesajeGranja,
  registrarMortandadGranja,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GRANJAS = [
  { key: "cañete",    label: "Cañete",    prefix: "C" },
  { key: "los_pinos", label: "Los Pinos", prefix: "P" },
];

// Tabla de referencia en kg (convertida de gramos)
const TABLA_REF_KG = {
  1: { min: 0.175, max: 0.190 },
  2: { min: 0.450, max: 0.480 },
  3: { min: 0.900, max: 0.950 },
  4: { min: 1.500, max: 1.600 },
  5: { min: 2.200, max: 2.300 },
  6: { min: 2.900, max: 3.000 },
};

const validarPeso = (val) => {
  const n = Number(val);
  if (!val || isNaN(n)) return null;
  if (n > 15)  return "error";    // imposible (probablemente en gramos)
  if (n > 6)   return "warning";  // inusualmente alto
  return "ok";
};

const diasDeVida = (f) =>
  Math.floor((Date.now() - new Date(f).getTime()) / (1000 * 60 * 60 * 24));

const semana = (f) => Math.max(1, Math.ceil(diasDeVida(f) / 7));

const formatPeso = (g) => {
  if (g == null) return null;
  return g >= 1000
    ? `${(g / 1000).toFixed(3).replace(".", ",")} kg`
    : `${g} g`;
};

const ultimoPeso = (lote) => {
  if (!lote.pesajes || lote.pesajes.length === 0) return null;
  return lote.pesajes[lote.pesajes.length - 1].pesoPromedio;
};

// Misma lógica que el backend: calcula semana de la fecha del pesaje relativa al ingreso
const semanaParaFecha = (fechaIngreso, fechaPesaje) => {
  const msXDia = 1000 * 60 * 60 * 24;
  // Normalizar a mediodía UTC para coincidir con ajustarFechaParaGuardar
  const ref  = new Date(`${fechaPesaje}T12:00:00.000Z`);
  const base = new Date(fechaIngreso);
  const dias = Math.floor((ref.getTime() - base.getTime()) / msXDia);
  return Math.max(1, Math.ceil(dias / 7));
};

const GranjaCargaDatosPage = () => {
  const navigate = useNavigate();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loteSeleccionado, setLoteSeleccionado] = useState(null);

  const [form, setForm] = useState({ fecha: obtenerFechaHoy(), pesoPromedio: "", mortandad: "", observaciones: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    obtenerLotesGranja({ estado: "en_crianza" })
      .then(setLotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const seleccionar = (lote) => {
    setLoteSeleccionado(lote);
    setForm({ fecha: obtenerFechaHoy(), pesoPromedio: "", mortandad: "", observaciones: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prefixDeGranja = (g) => GRANJAS.find((x) => x.key === g)?.prefix || "";

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.pesoPromedio) {
      Swal.fire("Faltan datos", "El peso promedio es obligatorio.", "warning");
      return;
    }
    const pesoVal = Number(form.pesoPromedio);
    if (pesoVal > 15) {
      Swal.fire({
        icon: "error",
        title: "Peso inválido",
        html: `<strong>${pesoVal} kg</strong> es un peso imposible para un pollo vivo.<br><br>
               El campo es en <strong>kg</strong>, no en gramos.<br>
               Ej: para <em>450 gramos</em> ingresá <strong>0.450</strong>`,
      });
      return;
    }
    if (pesoVal > 6) {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "Peso inusualmente alto",
        html: `Ingresaste <strong>${pesoVal} kg</strong>. ¿Es correcto?<br><br>
               Recordá que el campo es en <strong>kg</strong>. Si quisiste ingresar gramos, escribí el valor dividido por 1000.<br>
               Ej: para <em>6.000 gramos</em> ingresá <strong>6.000</strong>`,
        showCancelButton: true,
        confirmButtonText: "Sí, es correcto",
        cancelButtonText: "Corregir",
      });
      if (!isConfirmed) return;
    }
    if (form.mortandad === "") {
      Swal.fire("Faltan datos", "Ingresá la mortandad. Si no hubo bajas, poné 0.", "warning");
      return;
    }
    setSaving(true);
    try {
      const fecha = ajustarFechaParaGuardar(form.fecha);
      const promesas = [];
      if (form.pesoPromedio) {
        promesas.push(
          registrarPesajeGranja(loteSeleccionado._id, {
            fecha,
            pesoPromedio: Math.round(Number(form.pesoPromedio) * 1000),
            observaciones: form.observaciones || undefined,
          })
        );
      }
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
      setForm({ fecha: obtenerFechaHoy(), pesoPromedio: "", mortandad: "", observaciones: "" });
      const actualizados = await obtenerLotesGranja({ estado: "en_crianza" });
      setLotes(actualizados);
      const nuevo = actualizados.find((l) => l._id === loteSeleccionado._id);
      if (nuevo) setLoteSeleccionado(nuevo);
      Swal.fire({ icon: "success", title: "Datos guardados", timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

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
      <div className="container-fluid">

        <div className="d-flex align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/granja/galpones")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">Cargar datos semanales</h1>
        </div>

        {/* Formulario de carga — aparece al seleccionar un galpón */}
        {loteSeleccionado && (() => {
          const dias = diasDeVida(loteSeleccionado.fechaIngreso);
          const sem  = semana(loteSeleccionado.fechaIngreso);
          const galponLabel = `${prefixDeGranja(loteSeleccionado.granja)}${loteSeleccionado.galpon}`;
          const bajas = loteSeleccionado.mortandad.reduce((s, m) => s + m.cantidad, 0);
          const pesoActual = ultimoPeso(loteSeleccionado);

          return (
            <div className="card border-0 shadow mb-4 border-start border-4 border-warning">
              <div className="card-header bg-warning text-dark py-2 d-flex align-items-center justify-content-between">
                <div>
                  <span className="fw-bold">Galpón {galponLabel}</span>
                  <span className="ms-2 small">
                    Día {dias} — Sem. {sem} &nbsp;·&nbsp;
                    {loteSeleccionado.cantidadActual.toLocaleString("es-AR")} pollos
                    {bajas > 0 && ` · ${bajas} bajas`}
                    {pesoActual != null && ` · Último peso: ${formatPeso(pesoActual)}`}
                  </span>
                </div>
                <button className="btn btn-sm btn-outline-dark" onClick={() => setLoteSeleccionado(null)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="card-body py-3">
                <form onSubmit={handleGuardar}>
                  {(() => {
                    if (!form.fecha) return null;
                    const fechaIngresoStr = loteSeleccionado.fechaIngreso?.split("T")[0];
                    const antesDeLIngreso = form.fecha < fechaIngresoStr;
                    const semFecha = semanaParaFecha(loteSeleccionado.fechaIngreso, form.fecha);
                    const yaHayPesaje = !antesDeLIngreso && loteSeleccionado.pesajes?.some((p) => p.semana === semFecha);
                    if (antesDeLIngreso) {
                      return (
                        <div className="alert alert-danger py-2 px-3 mb-2 small">
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>
                          La fecha elegida es anterior al ingreso del lote (<strong>{formatearFechaLocal(loteSeleccionado.fechaIngreso)}</strong>).
                          Seleccioná una fecha igual o posterior al ingreso.
                        </div>
                      );
                    }
                    return (
                      <div className={`alert py-2 px-3 mb-2 small ${yaHayPesaje ? "alert-warning" : "alert-info"}`}>
                        {yaHayPesaje
                          ? <><i className="bi bi-exclamation-triangle me-1"></i>La semana <strong>{semFecha}</strong> ya tiene un pesaje cargado.</>
                          : <><i className="bi bi-calendar-check me-1"></i>Carga para la <strong>semana {semFecha}</strong> (ingreso: {formatearFechaLocal(loteSeleccionado.fechaIngreso)}).</>
                        }
                      </div>
                    );
                  })()}
                  <div className="row g-2">
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small mb-1">Fecha</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={form.fecha}
                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                        min={loteSeleccionado.fechaIngreso?.split("T")[0]}
                        required
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small mb-1">
                        Peso promedio <span className="text-muted fw-normal">(kg)</span>
                      </label>
                      {(() => {
                        const nivel = validarPeso(form.pesoPromedio);
                        const semFechaLocal = form.fecha
                          ? semanaParaFecha(loteSeleccionado.fechaIngreso, form.fecha)
                          : null;
                        const ref = semFechaLocal ? TABLA_REF_KG[semFechaLocal] : null;
                        return (
                          <>
                            <input
                              type="number"
                              className={`form-control form-control-sm ${nivel === "error" ? "is-invalid" : nivel === "warning" ? "border-warning" : ""}`}
                              placeholder={ref ? `Ej: ${ref.min.toFixed(3)}` : "Ej: 1.350"}
                              value={form.pesoPromedio}
                              onChange={(e) => setForm({ ...form, pesoPromedio: e.target.value })}
                              min="0.001"
                              max="15"
                              step="0.001"
                            />
                            {nivel === "error" && (
                              <div className="invalid-feedback d-block small">
                                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                ¿En gramos? El campo es en <strong>kg</strong>. Ej: <strong>0.450</strong> para 450 g
                              </div>
                            )}
                            {nivel === "warning" && (
                              <div className="text-warning small mt-1">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                Peso alto — verificá que sea en kg
                              </div>
                            )}
                            {nivel === "ok" && ref && (
                              <div className="form-text">
                                Sem. {semFechaLocal}: referencia {ref.min.toFixed(3)}–{ref.max.toFixed(3)} kg
                              </div>
                            )}
                            {nivel === null && ref && (
                              <div className="form-text">
                                Sem. {semFechaLocal}: referencia {ref.min.toFixed(3)}–{ref.max.toFixed(3)} kg
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold small mb-1">Mortandad <span className="text-muted fw-normal">(unidades)</span></label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="0"
                        value={form.mortandad}
                        onChange={(e) => setForm({ ...form, mortandad: e.target.value })}
                        min="0"
                        max={loteSeleccionado.cantidadActual}
                      />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label small mb-1">Observaciones <span className="text-muted">(opcional)</span></label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Cualquier nota..."
                        value={form.observaciones}
                        onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button className="btn btn-warning btn-sm px-4" disabled={saving}>
                      {saving
                        ? <span className="spinner-border spinner-border-sm me-1"></span>
                        : <i className="bi bi-check-circle me-1"></i>
                      }
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Selección de galpón */}
        <p className="text-muted mb-3">
          {loteSeleccionado
            ? "Seleccioná otro galpón para cargar sus datos:"
            : "Seleccioná el galpón para cargar los datos de esta semana:"}
        </p>

        {lotes.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            No hay galpones activos
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
                    const sem  = semana(lote.fechaIngreso);
                    const seleccionado = loteSeleccionado?._id === lote._id;
                    const barColor = dias < 30 ? "#198754" : dias < 40 ? "#fd7e14" : "#dc3545";
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
                            <div className="small text-muted">
                              {formatPeso(ultimoPeso(lote))}
                            </div>
                          )}
                          {seleccionado && (
                            <div className="mt-1">
                              <span className="badge bg-primary">Seleccionado</span>
                            </div>
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
    </Layout>
  );
};

export default GranjaCargaDatosPage;
