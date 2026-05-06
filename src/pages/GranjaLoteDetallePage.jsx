import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  obtenerLoteGranjaPorId,
  actualizarLoteGranja,
  eliminarLoteGranja,
  registrarPesajeGranja,
  registrarMortandadGranja,
  registrarEgresoGranja,
  obtenerClientes,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GRANJAS = [
  { value: "cañete",    label: "Cañete",    galpones: 6 },
  { value: "los_pinos", label: "Los Pinos", galpones: 8 },
];

const nombreGranja = (g) => (g === "cañete" ? "Cañete" : "Los Pinos");

const diasDeVida = (fechaIngreso) =>
  Math.floor((Date.now() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24));

const colorDiferencia = (dif, esperado) => {
  if (dif == null || !esperado) return "";
  const pct = dif / esperado;
  if (pct >= -0.05) return "text-success fw-bold";
  if (pct >= -0.15) return "text-warning fw-bold";
  return "text-danger fw-bold";
};

const formatPeso = (g) => {
  if (g == null) return "-";
  return g >= 1000
    ? `${(g / 1000).toFixed(3).replace(".", ",")} kg`
    : `${g} g`;
};

const formatARS = (n) =>
  n != null
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n)
    : "-";

const GranjaLoteDetallePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const puedeEditar  = rolUsuario === "superadmin" || rolUsuario === "frigorifico";
  const esSuperAdmin = rolUsuario === "superadmin";

  const [lote, setLote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);

  // Secciones visibles
  const [showPesaje, setShowPesaje] = useState(false);
  const [showMortandad, setShowMortandad] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);

  // Formularios
  const [pesajeForm, setPesajeForm] = useState({ pesoPromedio: "", observaciones: "" });
  const [mortandadForm, setMortandadForm] = useState({ cantidad: "", causa: "", observaciones: "" });
  const [egresoForm, setEgresoForm] = useState({
    tipo: "",
    cantidad: "",
    fecha: obtenerFechaHoy(),
    pesoTotalKg: "",
    precioPorKg: "",
    cliente: "",
    observaciones: "",
  });

  const [savingPesaje, setSavingPesaje]     = useState(false);
  const [savingMortandad, setSavingMortandad] = useState(false);
  const [savingEgreso, setSavingEgreso]     = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm]           = useState({});
  const [savingEdit, setSavingEdit]       = useState(false);

  const cargarLote = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerLoteGranjaPorId(id);
      setLote(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargarLote();
  }, [cargarLote]);

  useEffect(() => {
    if (showEgreso && egresoForm.tipo === "vivo" && clientes.length === 0) {
      obtenerClientes().then(setClientes).catch(console.error);
    }
  }, [showEgreso, egresoForm.tipo]);

  const handlePesaje = async (e) => {
    e.preventDefault();
    if (!pesajeForm.pesoPromedio) return;
    setSavingPesaje(true);
    try {
      await registrarPesajeGranja(id, {
        pesoPromedio: Number(pesajeForm.pesoPromedio),
        observaciones: pesajeForm.observaciones || undefined,
      });
      setPesajeForm({ pesoPromedio: "", observaciones: "" });
      setShowPesaje(false);
      await cargarLote();
      Swal.fire({ icon: "success", title: "Pesaje registrado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSavingPesaje(false);
    }
  };

  const handleMortandad = async (e) => {
    e.preventDefault();
    if (!mortandadForm.cantidad) return;
    setSavingMortandad(true);
    try {
      await registrarMortandadGranja(id, {
        cantidad: Number(mortandadForm.cantidad),
        causa: mortandadForm.causa || undefined,
        observaciones: mortandadForm.observaciones || undefined,
      });
      setMortandadForm({ cantidad: "", causa: "", observaciones: "" });
      setShowMortandad(false);
      await cargarLote();
      Swal.fire({ icon: "success", title: "Mortandad registrada", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSavingMortandad(false);
    }
  };

  const handleEgreso = async (e) => {
    e.preventDefault();
    if (!egresoForm.tipo || !egresoForm.cantidad) {
      Swal.fire("Faltan datos", "Indicá el tipo de egreso y la cantidad.", "warning");
      return;
    }
    if (egresoForm.tipo === "vivo" && (!egresoForm.pesoTotalKg || !egresoForm.precioPorKg || !egresoForm.cliente)) {
      Swal.fire("Faltan datos", "Para venta en vivo completá peso, precio y cliente.", "warning");
      return;
    }
    const confirmar = await Swal.fire({
      title: "¿Confirmar egreso?",
      text: `${egresoForm.cantidad} pollos — ${egresoForm.tipo === "frigorifico" ? "al Frigorifico" : "Venta en vivo"}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmar.isConfirmed) return;

    setSavingEgreso(true);
    try {
      const payload = {
        tipo: egresoForm.tipo,
        cantidad: Number(egresoForm.cantidad),
        fecha: ajustarFechaParaGuardar(egresoForm.fecha),
        observaciones: egresoForm.observaciones || undefined,
      };
      if (egresoForm.tipo === "vivo") {
        payload.pesoTotalKg = Number(egresoForm.pesoTotalKg);
        payload.precioPorKg = Number(egresoForm.precioPorKg);
        payload.cliente = egresoForm.cliente;
      }
      await registrarEgresoGranja(id, payload);
      await cargarLote();
      setShowEgreso(false);
      Swal.fire({ icon: "success", title: "Egreso registrado", text: "El lote fue finalizado.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSavingEgreso(false);
    }
  };

  const abrirEditar = () => {
    setEditForm({
      granja:          lote.granja,
      galpon:          lote.galpon,
      fechaIngreso:    lote.fechaIngreso?.split("T")[0] ?? "",
      cantidadIngreso: lote.cantidadIngreso,
      proveedor:       lote.proveedor || "",
      observaciones:   lote.observaciones || "",
    });
    setShowEditModal(true);
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await actualizarLoteGranja(lote._id, {
        ...editForm,
        galpon:          Number(editForm.galpon),
        cantidadIngreso: Number(editForm.cantidadIngreso),
      });
      setShowEditModal(false);
      await cargarLote();
      Swal.fire({ icon: "success", title: "Ingreso actualizado", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEliminar = async () => {
    const confirm = await Swal.fire({
      title: "¿Eliminar este lote?",
      html: `Se eliminará el lote <strong>#${lote.numeroLote}</strong> y todos sus registros (pesajes, mortandad, egreso).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarLoteGranja(lote._id);
      Swal.fire("Eliminado", "El lote fue eliminado.", "success");
      navigate("/granja/galpones");
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
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

  if (!lote) return <Layout><div className="container-fluid pt-4 text-muted">Lote no encontrado.</div></Layout>;

  const dias = diasDeVida(lote.fechaIngreso);
  const semanaActual = Math.max(1, Math.ceil(dias / 7));
  const progresoPct = Math.min(100, Math.round((dias / 45) * 100));
  const bajasTotales = lote.mortandad.reduce((s, m) => s + m.cantidad, 0);
  const pctMortandad = lote.cantidadIngreso > 0
    ? ((bajasTotales / lote.cantidadIngreso) * 100).toFixed(1)
    : 0;
  const totalVivo = egresoForm.tipo === "vivo" && egresoForm.pesoTotalKg && egresoForm.precioPorKg
    ? Number(egresoForm.pesoTotalKg) * Number(egresoForm.precioPorKg)
    : null;

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/granja/galpones")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0 flex-grow-1">
            Lote #{lote.numeroLote} — {nombreGranja(lote.granja)}, Galpón {lote.galpon}
          </h1>
          <span className={`badge ms-1 ${lote.estado === "en_crianza" ? "bg-success" : "bg-secondary"}`}>
            {lote.estado === "en_crianza" ? "En crianza" : "Finalizado"}
          </span>
          {puedeEditar && (
            <button className="btn btn-outline-primary btn-sm" onClick={abrirEditar}>
              <i className="bi bi-pencil me-1"></i>Editar ingreso
            </button>
          )}
          {esSuperAdmin && (
            <button className="btn btn-outline-danger btn-sm" onClick={handleEliminar}>
              <i className="bi bi-trash me-1"></i>Eliminar
            </button>
          )}
        </div>

        {/* Card de resumen */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-3 text-center mb-3">
              <div className="col-6 col-md-3">
                <div className="text-muted small">Ingreso</div>
                <div className="fw-bold">{formatearFechaLocal(lote.fechaIngreso)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Días / Semana</div>
                <div className="fw-bold">{dias} / {semanaActual}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Pollitos ingresados</div>
                <div className="fw-bold">{lote.cantidadIngreso.toLocaleString("es-AR")}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Pollos actuales</div>
                <div className="fw-bold text-success">{lote.cantidadActual.toLocaleString("es-AR")}</div>
              </div>
            </div>

            <div className="row g-3 text-center mb-3">
              <div className="col-6 col-md-3">
                <div className="text-muted small">Bajas totales</div>
                <div className={`fw-bold ${bajasTotales > 0 ? "text-danger" : ""}`}>
                  {bajasTotales} ({pctMortandad}%)
                </div>
              </div>
              {lote.proveedor && (
                <div className="col-6 col-md-3">
                  <div className="text-muted small">Proveedor</div>
                  <div className="fw-bold">{lote.proveedor}</div>
                </div>
              )}
              {lote.pesajes.length > 0 && (
                <div className="col-6 col-md-3">
                  <div className="text-muted small">Último peso</div>
                  <div className="fw-bold">
                    {formatPeso(lote.pesajes[lote.pesajes.length - 1].pesoPromedio)}
                  </div>
                </div>
              )}
            </div>

            {/* Barra de progreso */}
            {lote.estado === "en_crianza" && (
              <div>
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Día 0</span>
                  <span className="fw-semibold">{dias} días de vida</span>
                  <span>Día 45 (objetivo)</span>
                </div>
                <div className="progress" style={{ height: "10px" }}>
                  <div
                    className={`progress-bar ${progresoPct >= 100 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${progresoPct}%` }}
                  ></div>
                </div>
                {progresoPct >= 100 && (
                  <div className="text-warning small mt-1">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Los pollos superaron los 45 días — revisá el egreso
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* === PESAJES === */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white d-flex align-items-center justify-content-between border-bottom">
            <h5 className="mb-0">
              <i className="bi bi-speedometer2 me-2 text-primary"></i>
              Pesajes semanales
            </h5>
            {puedeEditar && lote.estado === "en_crianza" && (
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowPesaje((v) => !v)}
              >
                <i className={`bi bi-${showPesaje ? "x" : "plus"}-circle me-1`}></i>
                {showPesaje ? "Cancelar" : "Registrar pesaje"}
              </button>
            )}
          </div>
          <div className="card-body p-0">
            {showPesaje && (
              <div className="border-bottom p-3 bg-light">
                <form onSubmit={handlePesaje}>
                  <p className="text-muted small mb-2">
                    Semana actual: <strong>{semanaActual}</strong>
                  </p>
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-sm-5">
                      <label className="form-label fw-semibold">Peso promedio (gramos)</label>
                      <input
                        type="number"
                        className="form-control form-control-lg"
                        placeholder="Ej: 1350"
                        value={pesajeForm.pesoPromedio}
                        onChange={(e) => setPesajeForm({ ...pesajeForm, pesoPromedio: e.target.value })}
                        min="1"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="col-12 col-sm-5">
                      <label className="form-label">Observaciones (opcional)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Cualquier nota..."
                        value={pesajeForm.observaciones}
                        onChange={(e) => setPesajeForm({ ...pesajeForm, observaciones: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-sm-2">
                      <button type="submit" className="btn btn-primary w-100" disabled={savingPesaje}>
                        {savingPesaje ? <span className="spinner-border spinner-border-sm"></span> : "Guardar"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {lote.pesajes.length === 0 ? (
              <div className="text-center text-muted py-4 small">Sin pesajes registrados todavía</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Semana</th>
                      <th>Fecha</th>
                      <th>Peso real</th>
                      <th>Peso esperado</th>
                      <th>Diferencia</th>
                      <th className="d-none d-md-table-cell">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lote.pesajes].reverse().map((p) => (
                      <tr key={p._id}>
                        <td className="fw-semibold">Sem. {p.semana}</td>
                        <td>{formatearFechaLocal(p.fecha)}</td>
                        <td className="fw-bold">{formatPeso(p.pesoPromedio)}</td>
                        <td className="text-muted">{p.pesoEsperado ? formatPeso(p.pesoEsperado) : "-"}</td>
                        <td className={colorDiferencia(p.diferencia, p.pesoEsperado)}>
                          {p.diferencia != null
                            ? `${p.diferencia >= 0 ? "+" : ""}${p.diferencia} g`
                            : "-"}
                        </td>
                        <td className="d-none d-md-table-cell text-muted small">{p.observaciones || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* === MORTANDAD === */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white d-flex align-items-center justify-content-between border-bottom">
            <h5 className="mb-0">
              <i className="bi bi-heartbreak me-2 text-danger"></i>
              Mortandad
            </h5>
            {puedeEditar && lote.estado === "en_crianza" && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowMortandad((v) => !v)}
              >
                <i className={`bi bi-${showMortandad ? "x" : "plus"}-circle me-1`}></i>
                {showMortandad ? "Cancelar" : "Registrar bajas"}
              </button>
            )}
          </div>
          <div className="card-body p-0">
            {showMortandad && (
              <div className="border-bottom p-3 bg-light">
                <form onSubmit={handleMortandad}>
                  <p className="text-muted small mb-2">
                    Pollos actuales: <strong>{lote.cantidadActual.toLocaleString("es-AR")}</strong>
                  </p>
                  <div className="row g-2 align-items-end">
                    <div className="col-6 col-sm-3">
                      <label className="form-label fw-semibold">Cantidad de bajas</label>
                      <input
                        type="number"
                        className="form-control form-control-lg"
                        placeholder="0"
                        value={mortandadForm.cantidad}
                        onChange={(e) => setMortandadForm({ ...mortandadForm, cantidad: e.target.value })}
                        min="1"
                        max={lote.cantidadActual}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="col-6 col-sm-4">
                      <label className="form-label">Causa (opcional)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: enfermedad, aplaste..."
                        value={mortandadForm.causa}
                        onChange={(e) => setMortandadForm({ ...mortandadForm, causa: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-sm-3">
                      <label className="form-label">Observaciones (opcional)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={mortandadForm.observaciones}
                        onChange={(e) => setMortandadForm({ ...mortandadForm, observaciones: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-sm-2">
                      <button type="submit" className="btn btn-danger w-100" disabled={savingMortandad}>
                        {savingMortandad ? <span className="spinner-border spinner-border-sm"></span> : "Guardar"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {lote.mortandad.length === 0 ? (
              <div className="text-center text-muted py-4 small">Sin bajas registradas</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Semana</th>
                      <th>Fecha</th>
                      <th>Bajas</th>
                      <th>Causa</th>
                      <th className="d-none d-md-table-cell">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lote.mortandad].reverse().map((m) => (
                      <tr key={m._id}>
                        <td className="fw-semibold">Sem. {m.semana}</td>
                        <td>{formatearFechaLocal(m.fecha)}</td>
                        <td className="text-danger fw-bold">{m.cantidad}</td>
                        <td>{m.causa || "-"}</td>
                        <td className="d-none d-md-table-cell text-muted small">{m.observaciones || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={2} className="fw-semibold">Total</td>
                      <td className="text-danger fw-bold">{bajasTotales}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* === EGRESO === */}
        {lote.estado === "en_crianza" && puedeEditar && (
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white d-flex align-items-center justify-content-between border-bottom">
              <h5 className="mb-0">
                <i className="bi bi-box-arrow-right me-2 text-warning"></i>
                Egreso de pollos
              </h5>
              <button
                className="btn btn-outline-warning btn-sm"
                onClick={() => setShowEgreso((v) => !v)}
              >
                <i className={`bi bi-${showEgreso ? "x" : "plus"}-circle me-1`}></i>
                {showEgreso ? "Cancelar" : "Registrar egreso"}
              </button>
            </div>

            {showEgreso && (
              <div className="card-body">
                <form onSubmit={handleEgreso}>
                  {/* Tipo */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Destino de los pollos</label>
                    <div className="d-flex gap-3">
                      <div
                        className={`card flex-grow-1 text-center p-3 ${egresoForm.tipo === "frigorifico" ? "border-primary bg-primary bg-opacity-10" : "border"}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => setEgresoForm({ ...egresoForm, tipo: "frigorifico" })}
                      >
                        <i className="bi bi-snow fs-3 text-primary"></i>
                        <div className="fw-semibold mt-1">Frigorifico</div>
                        <div className="text-muted small">Van a faena</div>
                      </div>
                      <div
                        className={`card flex-grow-1 text-center p-3 ${egresoForm.tipo === "vivo" ? "border-success bg-success bg-opacity-10" : "border"}`}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setEgresoForm({ ...egresoForm, tipo: "vivo" });
                          if (clientes.length === 0) obtenerClientes().then(setClientes).catch(console.error);
                        }}
                      >
                        <i className="bi bi-egg fs-3 text-success"></i>
                        <div className="fw-semibold mt-1">Venta en vivo</div>
                        <div className="text-muted small">Se venden sin faenar</div>
                      </div>
                    </div>
                  </div>

                  {egresoForm.tipo && (
                    <>
                      <div className="row g-3 mb-3">
                        <div className="col-6 col-md-3">
                          <label className="form-label fw-semibold">Cantidad de pollos</label>
                          <input
                            type="number"
                            className="form-control form-control-lg"
                            value={egresoForm.cantidad}
                            onChange={(e) => setEgresoForm({ ...egresoForm, cantidad: e.target.value })}
                            min="1"
                            max={lote.cantidadActual}
                            placeholder="0"
                            required
                          />
                          <div className="form-text">Máx: {lote.cantidadActual.toLocaleString("es-AR")}</div>
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label fw-semibold">Fecha de salida</label>
                          <input
                            type="date"
                            className="form-control form-control-lg"
                            value={egresoForm.fecha}
                            onChange={(e) => setEgresoForm({ ...egresoForm, fecha: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      {egresoForm.tipo === "vivo" && (
                        <div className="card bg-light border mb-3">
                          <div className="card-body">
                            <h6 className="mb-3">Datos de la venta en vivo</h6>
                            <div className="row g-3">
                              <div className="col-12 col-md-4">
                                <label className="form-label fw-semibold">Cliente</label>
                                <select
                                  className="form-select"
                                  value={egresoForm.cliente}
                                  onChange={(e) => setEgresoForm({ ...egresoForm, cliente: e.target.value })}
                                  required
                                >
                                  <option value="">Seleccioná un cliente...</option>
                                  {clientes.map((c) => (
                                    <option key={c._id} value={c._id}>{c.nombre}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-6 col-md-4">
                                <label className="form-label fw-semibold">Peso total (kg)</label>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={egresoForm.pesoTotalKg}
                                  onChange={(e) => setEgresoForm({ ...egresoForm, pesoTotalKg: e.target.value })}
                                  min="0.01"
                                  step="0.01"
                                  placeholder="0,00"
                                  required
                                />
                              </div>
                              <div className="col-6 col-md-4">
                                <label className="form-label fw-semibold">Precio por kg ($ ARS)</label>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={egresoForm.precioPorKg}
                                  onChange={(e) => setEgresoForm({ ...egresoForm, precioPorKg: e.target.value })}
                                  min="0.01"
                                  step="0.01"
                                  placeholder="0,00"
                                  required
                                />
                              </div>
                            </div>
                            {totalVivo != null && (
                              <div className="alert alert-success py-2 mt-3 mb-0">
                                <span className="text-muted">Total venta: </span>
                                <strong className="fs-5">{formatARS(totalVivo)}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="form-label">Observaciones (opcional)</label>
                        <textarea
                          className="form-control"
                          value={egresoForm.observaciones}
                          onChange={(e) => setEgresoForm({ ...egresoForm, observaciones: e.target.value })}
                          rows={2}
                        />
                      </div>

                      <button type="submit" className="btn btn-warning btn-lg" disabled={savingEgreso}>
                        {savingEgreso && <span className="spinner-border spinner-border-sm me-2"></span>}
                        <i className="bi bi-check-circle me-1"></i>
                        Confirmar egreso y cerrar lote
                      </button>
                    </>
                  )}
                </form>
              </div>
            )}
          </div>
        )}

        {/* Detalle del egreso si ya está finalizado */}
        {lote.estado === "finalizado" && lote.egreso && (
          <div className="card border-0 shadow-sm mb-3 border-start border-4 border-secondary">
            <div className="card-header bg-white border-bottom">
              <h5 className="mb-0">
                <i className="bi bi-check-circle me-2 text-secondary"></i>
                Egreso registrado
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <div className="text-muted small">Tipo</div>
                  <div className="fw-bold">{lote.egreso.tipo === "frigorifico" ? "Frigorifico" : "Venta en vivo"}</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="text-muted small">Fecha</div>
                  <div className="fw-bold">{formatearFechaLocal(lote.egreso.fecha)}</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="text-muted small">Pollos</div>
                  <div className="fw-bold">{lote.egreso.cantidad?.toLocaleString("es-AR")}</div>
                </div>
                {lote.egreso.tipo === "vivo" && (
                  <>
                    <div className="col-6 col-md-3">
                      <div className="text-muted small">Peso total</div>
                      <div className="fw-bold">{lote.egreso.pesoTotalKg} kg</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-muted small">Precio / kg</div>
                      <div className="fw-bold">{formatARS(lote.egreso.precioPorKg)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-muted small">Total venta</div>
                      <div className="fw-bold text-success fs-5">{formatARS(lote.egreso.total)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-muted small">Cliente</div>
                      <div className="fw-bold">{lote.egreso.cliente?.nombre || "-"}</div>
                    </div>
                  </>
                )}
                {lote.egreso.observaciones && (
                  <div className="col-12">
                    <div className="text-muted small">Observaciones</div>
                    <div>{lote.egreso.observaciones}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal Editar Ingreso ── */}
      {showEditModal && (
        <>
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-pencil me-2"></i>Editar ingreso — Lote #{lote.numeroLote}
                  </h5>
                  <button className="btn-close" onClick={() => setShowEditModal(false)} disabled={savingEdit}></button>
                </div>
                <div className="modal-body">
                  <form id="form-editar-lote" onSubmit={handleEditar}>
                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">Granja</label>
                        <select
                          className="form-select"
                          value={editForm.granja}
                          onChange={(e) => setEditForm({ ...editForm, granja: e.target.value, galpon: 1 })}
                          required
                        >
                          {GRANJAS.map((g) => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Galpón</label>
                        <input
                          type="number"
                          className="form-control"
                          value={editForm.galpon}
                          onChange={(e) => setEditForm({ ...editForm, galpon: e.target.value })}
                          min="1"
                          max={GRANJAS.find((g) => g.value === editForm.granja)?.galpones || 8}
                          required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Fecha de ingreso</label>
                        <input
                          type="date"
                          className="form-control"
                          value={editForm.fechaIngreso}
                          onChange={(e) => setEditForm({ ...editForm, fechaIngreso: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Cantidad</label>
                        <input
                          type="number"
                          className="form-control"
                          value={editForm.cantidadIngreso}
                          onChange={(e) => setEditForm({ ...editForm, cantidadIngreso: e.target.value })}
                          min="1"
                          required
                        />
                        <div className="form-text">Cantidad × kg — Actual: {lote.cantidadIngreso}</div>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Proveedor (opcional)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editForm.proveedor}
                          onChange={(e) => setEditForm({ ...editForm, proveedor: e.target.value })}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Observaciones (opcional)</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={editForm.observaciones}
                          onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                        />
                      </div>
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowEditModal(false)} disabled={savingEdit}>
                    Cancelar
                  </button>
                  <button type="submit" form="form-editar-lote" className="btn btn-primary" disabled={savingEdit}>
                    {savingEdit && <span className="spinner-border spinner-border-sm me-1"></span>}
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show"></div>
        </>
      )}

    </Layout>
  );
};

export default GranjaLoteDetallePage;
