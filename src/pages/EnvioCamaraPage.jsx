import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { crearEnvioCamara, obtenerEnviosCamara, obtenerCamiones } from "../services/api";
import Swal from "sweetalert2";

const CAMARAS = [
  { value: "cañete", label: "Cañete" },
  { value: "trigotuc", label: "Trigotuc" },
];

const FORM_INICIAL = {
  fecha: new Date().toISOString().split("T")[0],
  camion: "",
  camaraOrigen: "",
  camaraDestino: "",
  observaciones: "",
};

const EnvioCamaraPage = () => {
  const navigate = useNavigate();
  const [camiones, setCamiones] = useState([]);
  const [envios, setEnvios]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm]     = useState(FORM_INICIAL);
  const [lineas, setLineas] = useState([]);

  const cargarDatos = async () => {
    try {
      const [camionesData, enviosData] = await Promise.all([
        obtenerCamiones(),
        obtenerEnviosCamara(),
      ]);
      setCamiones(camionesData.camiones || []);
      setEnvios(enviosData);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const lineasCalculadas = lineas.map((l) => ({
    ...l,
    cajones: calcularCajones(l.pollos, l.calibre),
  }));
  const totalPollos  = lineasCalculadas.reduce((acc, l) => acc + Number(l.pollos || 0), 0);
  const totalCajones = lineasCalculadas.reduce((acc, l) => acc + l.cajones, 0);
  const totalKg      = totalCajones * 20;

  const formatNum   = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
  const formatFecha = (f) => new Date(f).toLocaleDateString("es-AR");
  const camaraLabel = (v) => CAMARAS.find((c) => c.value === v)?.label || v;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
    const lineasValidas = lineasCalculadas.filter((l) => l.cajones > 0);
    if (lineasValidas.length === 0) {
      Swal.fire("Error", "Ingresá al menos un calibre con cajones.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const envio = await crearEnvioCamara({
        fecha:         form.fecha,
        camion:        form.camion || null,
        camaraOrigen:  form.camaraOrigen,
        camaraDestino: form.camaraDestino,
        calibres:      lineasValidas.map(({ calibre, pollos, cajones }) => ({
          calibre: Number(calibre),
          pollos:  Number(pollos),
          cajones,
        })),
        observaciones: form.observaciones,
      });
      Swal.fire(
        `Envío ${envio.numeroEnvio} registrado`,
        `${camaraLabel(form.camaraOrigen)} → ${camaraLabel(form.camaraDestino)} · ${totalCajones} cajones · ${totalKg} kg`,
        "success"
      );
      setForm(FORM_INICIAL);
      setLineas([]);
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
            onClick={() => navigate("/granja")}
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
              <div className="mb-3">
                <label className="form-label fw-semibold">Cajones por calibre</label>
                <CalibreTable lineas={lineas} onChange={setLineas} inputCajones />
              </div>

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
                          <span className="text-muted small">{formatFecha(e.fecha)}</span>
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
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {e.calibres.map((c, i) => (
                            <span key={i} className="badge bg-info text-dark">
                              Cal.{c.calibre}: {formatNum(c.cajones)} caj
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
                        <th>Calibres</th>
                        <th className="text-end">Pollos</th>
                        <th className="text-end">Cajones</th>
                        <th className="text-end">Kg</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envios.map((e) => (
                        <tr key={e._id}>
                          <td>
                            <span className="badge bg-dark">{e.numeroEnvio}</span>
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
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {e.calibres.map((c, i) => (
                                <span key={i} className="badge bg-info text-dark">
                                  Cal.{c.calibre}: {formatNum(c.cajones)} caj
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-end">{formatNum(e.totalPollos)}</td>
                          <td className="text-end">{formatNum(e.totalCajones)}</td>
                          <td className="text-end">{formatNum(e.pesoTotalKg)}</td>
                          <td className="text-muted small">{e.observaciones || "—"}</td>
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
