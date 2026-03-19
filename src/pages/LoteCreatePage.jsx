import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { crearLote } from "../services/api";
import Swal from "sweetalert2";

const LoteCreatePage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fechaIngreso:        new Date().toISOString().split("T")[0],
    unidadesFaenadas:    "",
    kgVivos:             "",
    unidadesDecomisadas: "",
    kgDecomisados:       "",
    unidadesTrozadas:    "",
    kgTrozados:          "",
    observaciones:       "",
  });
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(false);

  const lineasCalculadas = lineas.map((l) => ({
    ...l,
    cajones: calcularCajones(l.pollos, l.calibre),
  }));
  const totalPollos  = lineasCalculadas.reduce((acc, l) => acc + Number(l.pollos || 0), 0);
  const totalCajones = lineasCalculadas.reduce((acc, l) => acc + l.cajones, 0);
  const totalKg      = totalCajones * 20;


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalCajones === 0) {
      Swal.fire("Error", "Ingresá al menos una línea con pollos.", "error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        fechaIngreso: form.fechaIngreso,
        calibres: lineasCalculadas
          .filter((l) => l.pollos && l.cajones > 0)
          .map(({ calibre, pollos, cajones }) => ({
            calibre: Number(calibre),
            pollos:  Number(pollos),
            cajones,
          })),
        observaciones: form.observaciones,
      };
      if (form.unidadesFaenadas)    payload.unidadesFaenadas    = Number(form.unidadesFaenadas);
      if (form.kgVivos)             payload.kgVivos             = Number(form.kgVivos);
      if (form.unidadesDecomisadas) payload.unidadesDecomisadas = Number(form.unidadesDecomisadas);
      if (form.kgDecomisados)       payload.kgDecomisados       = Number(form.kgDecomisados);
      if (form.unidadesTrozadas)    payload.unidadesTrozadas    = Number(form.unidadesTrozadas);
      if (form.kgTrozados)          payload.kgTrozados          = Number(form.kgTrozados);
      const loteCreado = await crearLote(payload);
      Swal.fire(
        `Lote #${loteCreado.numeroLote} creado`,
        `${totalPollos} pollos · ${totalCajones} cajones · ${totalKg} kg`,
        "success"
      );
      navigate("/granja");
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el lote.", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatNum = (n) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);

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
        <h1 className="h3 mb-0">Nuevo Lote</h1>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Fecha de ingreso</label>
              <input
                type="date"
                className="form-control"
                value={form.fechaIngreso}
                onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                required
              />
            </div>

            {/* Datos de faena */}
            <div className="card border bg-light mb-3">
              <div className="card-body pb-2 pt-3">
                <h6 className="mb-3">
                  <i className="bi bi-clipboard-data me-2 text-secondary"></i>
                  Datos de faena (opcional)
                </h6>
                {/* Fila 1: totales de faena */}
                <div className="row g-3 mb-2">
                  <div className="col-6">
                    <label className="form-label small">Pollos vivos</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.unidadesFaenadas}
                      onChange={(e) => setForm({ ...form, unidadesFaenadas: e.target.value })}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small">Kg vivos</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.kgVivos}
                      onChange={(e) => setForm({ ...form, kgVivos: e.target.value })}
                      min="0"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                </div>
                {/* Fila 2: breakdown */}
                <div className="row g-3">
                  <div className="col-6 col-md-3">
                    <label className="form-label small">Decomisados (unidades)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.unidadesDecomisadas}
                      onChange={(e) => setForm({ ...form, unidadesDecomisadas: e.target.value })}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small">Decomisados (kg)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.kgDecomisados}
                      onChange={(e) => setForm({ ...form, kgDecomisados: e.target.value })}
                      min="0"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small">Trozados (unidades)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.unidadesTrozadas}
                      onChange={(e) => setForm({ ...form, unidadesTrozadas: e.target.value })}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label small">Trozados (kg)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={form.kgTrozados}
                      onChange={(e) => setForm({ ...form, kgTrozados: e.target.value })}
                      min="0"
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold">
                Pollos por calibre
              </label>
              <p className="text-muted small mb-2">
                El calibre indica cuántos pollos entran en un cajón de 20 kg.
              </p>
              <CalibreTable lineas={lineas} onChange={setLineas} />
            </div>

            {totalCajones > 0 && (
              <div className="alert alert-info py-2 mb-3">
                <div className="row text-center g-0">
                  <div className="col-4">
                    <div className="text-muted small">Pollos</div>
                    <div className="fw-bold">{formatNum(totalPollos)}</div>
                  </div>
                  <div className="col-4 border-start border-end">
                    <div className="text-muted small">Cajones</div>
                    <div className="fw-bold">{formatNum(totalCajones)}</div>
                  </div>
                  <div className="col-4">
                    <div className="text-muted small">Kg</div>
                    <div className="fw-bold">{formatNum(totalKg)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Observaciones (opcional)</label>
              <textarea
                className="form-control"
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                rows={2}
              />
            </div>

            <div className="d-grid gap-2 d-sm-flex">
              <button
                type="submit"
                className="btn btn-success"
                disabled={loading}
              >
                {loading && (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                )}
                <i className="bi bi-plus-circle me-1"></i>
                Crear Lote
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate("/granja")}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </Layout>
  );
};

export default LoteCreatePage;
