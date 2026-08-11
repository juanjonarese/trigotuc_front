import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { trozadoLabel } from "../components/TrozadoTable";
import { crearEnvioCamara, obtenerEnviosCamara, obtenerCamiones, obtenerChoferes, eliminarEnvioCamara, obtenerResumenStock } from "../services/api";
import { ajustarFechaParaGuardar } from "../utils/dateUtils";
import { imprimirOrdenEnvio, descargarPDFOrdenEnvio } from "../utils/imprimirOrdenEnvio";
import Swal from "sweetalert2";

const CAMARAS = [
  { value: "cañete", label: "Cañete" },
  { value: "trigotuc", label: "Trigotuc" },
];

const FORM_INICIAL = {
  fecha: new Date().toISOString().split("T")[0],
  camion: "",
  chofer: "",
  camaraOrigen: "",
  camaraDestino: "",
  observaciones: "",
};

const EnvioCamaraPage = () => {
  const navigate = useNavigate();
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const esSuperAdmin = rolUsuario === "superadmin";
  // Administración puede dar de baja un envío cargado por error, pero solo mientras
  // esté pendiente de recepción. Los ya recibidos quedan para superadmin (el backend
  // aplica el mismo límite).
  const puedeEliminar = (e) =>
    esSuperAdmin ||
    (rolUsuario === "administracion_frigorifico" && e.estado === "pendiente");

  const [camiones, setCamiones]     = useState([]);
  const [choferes, setChoferes]     = useState([]);
  const [envios, setEnvios]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resumen, setResumen]       = useState(null);

  const [form, setForm]             = useState(FORM_INICIAL);
  const [lineas, setLineas]         = useState([]);
  const [trozadosLineas, setTrozadosLineas] = useState([]);

  const cargarDatos = async () => {
    try {
      const [camionesData, choferesData, enviosData, resumenData] = await Promise.all([
        obtenerCamiones(),
        obtenerChoferes(),
        obtenerEnviosCamara(),
        obtenerResumenStock(),
      ]);
      setCamiones(camionesData.camiones || []);
      setChoferes(choferesData.choferes || []);
      setEnvios(enviosData);
      setResumen(resumenData);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const handleEliminar = async (e) => {
    const destino = camaraLabel(e.camaraDestino);
    const origen  = camaraLabel(e.camaraOrigen);
    const confirm = await Swal.fire({
      title: "¿Eliminar envío?",
      html:
        `Se va a eliminar el envío <strong>${e.numeroEnvio}</strong> y el stock volverá a <strong>${origen}</strong>.` +
        (e.estado === "recibido"
          ? `<br><br>⚠️ Este envío ya está <strong>recibido en ${destino}</strong>: el stock se descuenta de ${destino}. Si ya se vendió o despachó, la operación se rechaza.`
          : ""),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarEnvioCamara(e._id);
      Swal.fire("Eliminado", `El envío ${e.numeroEnvio} fue eliminado y el stock revertido.`, "success");
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar el envío.", "error");
    }
  };

  const lineasCalculadas = lineas.map((l) => ({
    ...l,
    cajones: calcularCajones(l.pollos, l.calibre),
  }));

  const stockCalibresOrigen = form.camaraOrigen === "cañete"
    ? (resumen?.stockCañete   || [])
    : form.camaraOrigen === "trigotuc"
    ? (resumen?.stockTrigotuc || [])
    : null;

  const formatNum   = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
  const formatFecha = (f) => new Date(f).toLocaleDateString("es-AR");
  const camaraLabel = (v) => CAMARAS.find((c) => c.value === v)?.label || v;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "camaraOrigen") {
      setLineas([]);
      setTrozadosLineas([]);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.camaraOrigen || !form.camaraDestino) {
      Swal.fire("Error", "Seleccioná la cámara de origen y destino.", "error");
      return;
    }
    if (form.camaraOrigen === form.camaraDestino) {
      Swal.fire("Error", "La cámara de origen y destino no pueden ser la misma.", "error");
      return;
    }
    const lineasValidas    = lineasCalculadas.filter((l) => l.cajones > 0);
    const trozadosValidos  = trozadosLineas.filter((t) => Number(t.cajas) > 0 && Number(t.kgCaja) > 0);

    // Validar stock de trozados
    const trozadosDisp = form.camaraOrigen === "cañete"
      ? (resumen?.trozadosCañeteDetalle   || [])
      : (resumen?.trozadosTrigotucDetalle || []);
    for (const t of trozadosValidos) {
      const disponible = trozadosDisp.find((d) => d.tipo === t.tipo && d.clase === t.clase)?.cajas || 0;
      if (Number(t.cajas) > disponible) {
        Swal.fire("Error", `Stock insuficiente de ${trozadoLabel(t.tipo)} clase ${t.clase || "A"}. Disponible: ${disponible} cajas.`, "error");
        return;
      }
    }

    if (lineasValidas.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Error", "Ingresá al menos un calibre o un trozado.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const envio = await crearEnvioCamara({
        fecha:         ajustarFechaParaGuardar(form.fecha),
        camion:        form.camion || null,
        chofer:        form.chofer || null,
        camaraOrigen:  form.camaraOrigen,
        camaraDestino: form.camaraDestino,
        calibres:      lineasValidas.map(({ calibre, pollos, cajones }) => ({
          calibre: Number(calibre), pollos: Number(pollos), cajones,
        })),
        trozados:      trozadosValidos.map((t) => ({
          tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas), clase: t.clase || "A",
        })),
        observaciones: form.observaciones,
      });
      const res = await Swal.fire({
        title: `Envío ${envio.numeroEnvio} registrado`,
        text: `${camaraLabel(form.camaraOrigen)} → ${camaraLabel(form.camaraDestino)}`,
        icon: "success",
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "Imprimir orden",
        confirmButtonColor: "#0d6efd",
        denyButtonText: "Descargar PDF",
        denyButtonColor: "#198754",
        cancelButtonText: "Cerrar",
      });
      if (res.isConfirmed) imprimirOrdenEnvio(envio);
      else if (res.isDenied) descargarPDFOrdenEnvio(envio);
      setForm(FORM_INICIAL);
      setLineas([]);
      setTrozadosLineas([]);
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el envío.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate("/frigorifico")}
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-truck me-2 text-secondary"></i>
            Envío entre Cámaras
          </h1>
        </div>

        {/* ── Formulario ── */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-2">
            <h6 className="mb-0">Registrar envío</h6>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">

                {/* Fecha */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    name="fecha"
                    value={form.fecha}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Camión */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Camión (opcional)</label>
                  <select
                    className="form-select"
                    name="camion"
                    value={form.camion}
                    onChange={handleChange}
                  >
                    <option value="">— Sin especificar —</option>
                    {camiones.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.marca} — {c.patente}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chofer */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Chofer (opcional)</label>
                  <select
                    className="form-select"
                    name="chofer"
                    value={form.chofer}
                    onChange={handleChange}
                  >
                    <option value="">— Sin especificar —</option>
                    {choferes.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.nombreUsuario}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cámara origen */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Cámara origen</label>
                  <select
                    className="form-select"
                    name="camaraOrigen"
                    value={form.camaraOrigen}
                    onChange={handleChange}
                    required
                  >
                    <option value="">— Seleccionar —</option>
                    {CAMARAS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Cámara destino */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Cámara destino</label>
                  <select
                    className="form-select"
                    name="camaraDestino"
                    value={form.camaraDestino}
                    onChange={handleChange}
                    required
                  >
                    <option value="">— Seleccionar —</option>
                    {CAMARAS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Observaciones */}
                <div className="col-12">
                  <label className="form-label">Observaciones (opcional)</label>
                  <input
                    type="text"
                    className="form-control"
                    name="observaciones"
                    value={form.observaciones}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Calibres */}
              {!form.camaraOrigen ? (
                <div className="alert alert-secondary py-2 mb-3">
                  <i className="bi bi-info-circle me-2"></i>
                  Seleccioná la cámara de origen para cargar el stock disponible.
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Cajones por calibre</label>
                  <CalibreTable lineas={lineas} onChange={setLineas} inputCajones showPollos={false} stockCalibres={stockCalibresOrigen} />
                </div>
              )}

              {/* Trozados */}
              {(() => {
                const disponibles = form.camaraOrigen === "cañete"
                  ? (resumen?.trozadosCañeteDetalle   || []).filter((t) => t.cajas > 0)
                  : (resumen?.trozadosTrigotucDetalle || []).filter((t) => t.cajas > 0);
                if (!form.camaraOrigen || disponibles.length === 0) return null;
                return (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Trozados</label>
                    <table className="table table-sm table-bordered align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo</th>
                          <th>Clase</th>
                          <th className="text-end">Disponible (cajas)</th>
                          <th style={{ width: "9rem" }}>Cajas a enviar</th>
                          <th className="text-muted small">kg/caja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disponibles.map((t) => {
                          const linea = trozadosLineas.find((l) => l.tipo === t.tipo && l.clase === t.clase) || { tipo: t.tipo, clase: t.clase, cajas: "", kgCaja: t.kgCaja };
                          return (
                            <tr key={`${t.tipo}-${t.clase || "A"}`}>
                              <td className="fw-semibold">{trozadoLabel(t.tipo)}</td>
                              <td><span className="badge bg-secondary">Clase {t.clase || "A"}</span></td>
                              <td className="text-end text-muted">{formatNum(t.cajas)}</td>
                              <td>
                                <input
                                  type="number" min="0" max={t.cajas} step="1"
                                  className="form-control form-control-sm text-center"
                                  placeholder="0"
                                  value={linea.cajas}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTrozadosLineas((prev) => {
                                      const idx = prev.findIndex((l) => l.tipo === t.tipo && l.clase === t.clase);
                                      const nueva = { tipo: t.tipo, clase: t.clase, cajas: val, kgCaja: t.kgCaja };
                                      if (idx === -1) return [...prev, nueva];
                                      return prev.map((l, i) => i === idx ? nueva : l);
                                    });
                                  }}
                                />
                              </td>
                              <td className="text-muted small">{t.kgCaja} kg</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                )}
                <i className="bi bi-truck me-1"></i>
                Registrar Envío
              </button>
            </form>
          </div>
        </div>

        {/* ── Lista de envíos ── */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white py-2">
            <h6 className="mb-0">Envíos registrados</h6>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : envios.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">No hay envíos registrados.</p>
            ) : (
              <>
                {/* Mobile: cards */}
                <div className="d-md-none p-3">
                  {envios.map((e) => (
                    <div key={e._id} className="card border mb-3">
                      <div className="card-body py-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-dark fs-6">{e.numeroEnvio}</span>
                          {e.estado === "pendiente" && <span className="badge bg-warning text-dark ms-1">Pendiente recepción</span>}
                          <div className="d-flex align-items-center gap-2">
                            <span className="text-muted small">{formatFecha(e.fecha)}</span>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => imprimirOrdenEnvio(e)}
                              title="Imprimir orden"
                            >
                              <i className="bi bi-printer"></i>
                            </button>
                            <button
                              className="btn btn-outline-success btn-sm"
                              onClick={() => descargarPDFOrdenEnvio(e)}
                              title="Descargar PDF"
                            >
                              <i className="bi bi-file-earmark-pdf"></i>
                            </button>
                            {puedeEliminar(e) && (
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleEliminar(e)}
                                title="Eliminar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mb-2">
                          <span className="badge bg-secondary me-1">{camaraLabel(e.camaraOrigen)}</span>
                          <i className="bi bi-arrow-right text-muted mx-1"></i>
                          <span className="badge bg-secondary">{camaraLabel(e.camaraDestino)}</span>
                        </div>
                        {e.camion && (
                          <div className="text-muted small mb-2">
                            <i className="bi bi-truck me-1"></i>
                            {e.camion.marca} — {e.camion.patente}
                          </div>
                        )}
                        {e.chofer && (
                          <div className="text-muted small mb-2">
                            <i className="bi bi-person me-1"></i>
                            {e.chofer.nombreUsuario}
                          </div>
                        )}
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {e.calibres.map((c, i) => (
                            <span key={i} className="badge bg-info text-dark">
                              Cal.{c.calibre}: {formatNum(c.cajones)} caj
                            </span>
                          ))}
                          {(e.trozados || []).map((t, i) => (
                            <span key={`t${i}`} className="badge bg-warning text-dark">
                              {trozadoLabel(t.tipo)}: {formatNum(t.cajas)} caj
                            </span>
                          ))}
                        </div>
                        <div className="row g-0 text-center mb-2">
                          <div className="col-4 border-end">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Pollos</div>
                            <div className="fw-semibold small">{formatNum(e.totalPollos)}</div>
                          </div>
                          <div className="col-4 border-end">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Cajones</div>
                            <div className="fw-semibold small">{formatNum(e.totalCajones)}</div>
                          </div>
                          <div className="col-4">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Kg</div>
                            <div className="fw-semibold small">{formatNum(e.pesoTotalKg)}</div>
                          </div>
                        </div>
                        {e.observaciones && (
                          <div className="text-muted small">{e.observaciones}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Nro</th>
                        <th>Fecha</th>
                        <th>Origen → Destino</th>
                        <th>Camión</th>
                        <th>Chofer</th>
                        <th>Calibres</th>
                        <th className="text-end">Pollos</th>
                        <th className="text-end">Cajones</th>
                        <th className="text-end">Kg</th>
                        <th>Observaciones</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {envios.map((e) => (
                        <tr key={e._id}>
                          <td>
                            <span className="badge bg-dark">{e.numeroEnvio}</span>
                            {e.estado === "pendiente" && <span className="badge bg-warning text-dark ms-1">Pendiente</span>}
                          </td>
                          <td>{formatFecha(e.fecha)}</td>
                          <td>
                            <span className="badge bg-secondary me-1">{camaraLabel(e.camaraOrigen)}</span>
                            <i className="bi bi-arrow-right text-muted mx-1"></i>
                            <span className="badge bg-secondary">{camaraLabel(e.camaraDestino)}</span>
                          </td>
                          <td className="text-muted small">
                            {e.camion ? `${e.camion.marca} — ${e.camion.patente}` : "—"}
                          </td>
                          <td className="text-muted small">
                            {e.chofer ? e.chofer.nombreUsuario : "—"}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {e.calibres.map((c, i) => (
                                <span key={i} className="badge bg-info text-dark">
                                  Cal.{c.calibre}: {formatNum(c.cajones)} caj
                                </span>
                              ))}
                              {(e.trozados || []).map((t, i) => (
                                <span key={`t${i}`} className="badge bg-warning text-dark">
                                  {trozadoLabel(t.tipo)}: {formatNum(t.cajas)} caj
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-end">{formatNum(e.totalPollos)}</td>
                          <td className="text-end">{formatNum(e.totalCajones)}</td>
                          <td className="text-end">{formatNum(e.pesoTotalKg)}</td>
                          <td className="text-muted small">{e.observaciones || "—"}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => imprimirOrdenEnvio(e)}
                                title="Imprimir orden"
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                              <button
                                className="btn btn-outline-success btn-sm"
                                onClick={() => descargarPDFOrdenEnvio(e)}
                                title="Descargar PDF"
                              >
                                <i className="bi bi-file-earmark-pdf"></i>
                              </button>
                              {puedeEliminar(e) && (
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleEliminar(e)}
                                  title="Eliminar"
                                >
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
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EnvioCamaraPage;
