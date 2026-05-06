import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { crearLoteGranja } from "../services/api";
import { ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const GALPONES = { cañete: 6, los_pinos: 8 };

const GranjaLoteNuevoPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    granja: searchParams.get("granja") || "",
    galpon: searchParams.get("galpon") || "",
    fechaIngreso: obtenerFechaHoy(),
    cantidadIngreso: "",
    proveedor: "",
    observaciones: "",
  });
  const [loading, setLoading] = useState(false);

  const maxGalpones = form.granja ? GALPONES[form.granja] : 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "granja" ? { galpon: "" } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.granja || !form.galpon || !form.cantidadIngreso) {
      Swal.fire("Faltan datos", "Completá granja, galpón y cantidad.", "warning");
      return;
    }
    setLoading(true);
    try {
      const lote = await crearLoteGranja({
        granja: form.granja,
        galpon: Number(form.galpon),
        fechaIngreso: ajustarFechaParaGuardar(form.fechaIngreso),
        cantidadIngreso: Number(form.cantidadIngreso),
        proveedor: form.proveedor || undefined,
        observaciones: form.observaciones || undefined,
      });
      await Swal.fire({
        icon: "success",
        title: `Lote #${lote.numeroLote} creado`,
        text: `${Number(form.cantidadIngreso).toLocaleString("es-AR")} en ${form.granja === "cañete" ? "Cañete" : "Los Pinos"} — Galpón ${form.galpon}`,
        timer: 2000,
        showConfirmButton: false,
      });
      navigate("/granja/galpones");
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el lote.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate("/granja/galpones")}
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">Ingreso de Pollitos</h1>
        </div>

        <div className="row justify-content-center">
          <div className="col-12 col-md-7 col-lg-5">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <form onSubmit={handleSubmit}>

                  {/* Granja */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Granja</label>
                    <select
                      name="granja"
                      className="form-select form-select-lg"
                      value={form.granja}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Seleccioná la granja...</option>
                      <option value="cañete">Cañete</option>
                      <option value="los_pinos">Los Pinos</option>
                    </select>
                  </div>

                  {/* Galpón */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Galpón</label>
                    <select
                      name="galpon"
                      className="form-select form-select-lg"
                      value={form.galpon}
                      onChange={handleChange}
                      required
                      disabled={!form.granja}
                    >
                      <option value="">{form.granja ? "Seleccioná el galpón..." : "Primero elegí la granja"}</option>
                      {Array.from({ length: maxGalpones }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          Galpón {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Fecha de ingreso</label>
                    <input
                      type="date"
                      name="fechaIngreso"
                      className="form-control form-control-lg"
                      value={form.fechaIngreso}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  {/* Cantidad */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Cantidad</label>
                    <input
                      type="number"
                      name="cantidadIngreso"
                      className="form-control form-control-lg"
                      value={form.cantidadIngreso}
                      onChange={handleChange}
                      min="1"
                      placeholder="Ej: 12000"
                      required
                    />
                    <div className="form-text">Cantidad × kg</div>
                  </div>

                  {/* Proveedor */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Proveedor <span className="text-muted fw-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      name="proveedor"
                      className="form-control"
                      value={form.proveedor}
                      onChange={handleChange}
                      placeholder="Nombre del proveedor"
                    />
                  </div>

                  {/* Observaciones */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Observaciones <span className="text-muted fw-normal">(opcional)</span>
                    </label>
                    <textarea
                      name="observaciones"
                      className="form-control"
                      value={form.observaciones}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Cualquier dato adicional..."
                    />
                  </div>

                  <div className="d-grid gap-2 d-sm-flex">
                    <button type="submit" className="btn btn-success btn-lg flex-grow-1" disabled={loading}>
                      {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
                      <i className="bi bi-check-circle me-1"></i>
                      Registrar ingreso
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => navigate("/granja/galpones")}
                    >
                      Cancelar
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GranjaLoteNuevoPage;
