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

const diasDeVida = (f) =>
  Math.floor((Date.now() - new Date(f).getTime()) / (1000 * 60 * 60 * 24));

const semana = (f) => Math.max(1, Math.ceil(diasDeVida(f) / 7));

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
    if (!form.pesoPromedio && !form.mortandad) {
      Swal.fire("Faltan datos", "Ingresá al menos el peso promedio o la mortandad.", "warning");
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
      if (form.mortandad) {
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

          return (
            <div className="card border-0 shadow mb-4 border-start border-4 border-warning" style={{ maxWidth: "90%" }}>
              <div className="card-header bg-warning text-dark d-flex align-items-center justify-content-between">
                <div>
                  <span className="fw-bold fs-5">Galpón {galponLabel}</span>
                  <span className="ms-3 small">
                    Día {dias} — Semana {sem} &nbsp;·&nbsp;
                    {loteSeleccionado.cantidadActual.toLocaleString("es-AR")} pollos
                    {bajas > 0 && ` · ${bajas} bajas`}
                  </span>
                </div>
                <button className="btn btn-sm btn-outline-dark" onClick={() => setLoteSeleccionado(null)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="card-body">
                <form onSubmit={handleGuardar}>
                  <div className="row g-3">
                    <div className="col-12 col-sm-6 col-md-3">
                      <label className="form-label fw-semibold">Fecha</label>
                      <input
                        type="date"
                        className="form-control form-control-lg"
                        value={form.fecha}
                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-sm-6 col-md-3">
                      <label className="form-label fw-semibold">
                        Peso promedio <span className="text-muted fw-normal">(kg)</span>
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-lg"
                        placeholder="Ej: 1.350"
                        value={form.pesoPromedio}
                        onChange={(e) => setForm({ ...form, pesoPromedio: e.target.value })}
                        min="0.001"
                        step="0.001"
                      />
                    </div>
                    <div className="col-12 col-sm-6 col-md-3">
                      <label className="form-label fw-semibold">Mortandad</label>
                      <input
                        type="number"
                        className="form-control form-control-lg"
                        placeholder="0"
                        value={form.mortandad}
                        onChange={(e) => setForm({ ...form, mortandad: e.target.value })}
                        min="1"
                        max={loteSeleccionado.cantidadActual}
                      />
                    </div>
                    <div className="col-12 col-sm-6 col-md-3">
                      <label className="form-label">Observaciones <span className="text-muted">(opcional)</span></label>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        placeholder="Cualquier nota..."
                        value={form.observaciones}
                        onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button className="btn btn-warning btn-lg px-5" disabled={saving}>
                      {saving
                        ? <span className="spinner-border spinner-border-sm me-2"></span>
                        : <i className="bi bi-check-circle me-2"></i>
                      }
                      Aceptar
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
