import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerConstantesReproductores,
  obtenerLotesReproductores,
  crearLoteReproductor,
  eliminarLoteReproductor,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import { formatearNumero, ESTADO_LOTE, nombreGalpon } from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

const FORM_VACIO = {
  numeroLote: "",
  galpon: "",
  fechaIngreso: obtenerFechaHoy(),
  hembrasIngreso: "",
  machosIngreso: "",
  bajasIngresoHembras: "",
  bajasIngresoMachos: "",
  motivoBajas: "",
  proveedor: "",
  observaciones: "",
};

// ── Modal de ingreso de lote reproductor ────────────────────────────────────
// El lote entra siempre por un galpón de RECRÍA. Cuando esté listo para poner
// se muda a un galpón de postura desde la pantalla de Galpones.
const NuevoLoteModal = ({ onClose, onCreado, constantes, galponesOcupados, numeroSugerido }) => {
  const [form, setForm] = useState({ ...FORM_VACIO, numeroLote: String(numeroSugerido) });
  const [saving, setSaving] = useState(false);

  const galponesRecria = constantes?.galpones?.recria || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const totalAves =
    (Number(form.hembrasIngreso) || 0) + (Number(form.machosIngreso) || 0);
  const totalBajas =
    (Number(form.bajasIngresoHembras) || 0) + (Number(form.bajasIngresoMachos) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Por ahora el número lo carga el usuario a mano (después será correlativo).
    if (!String(form.numeroLote).trim() || Number(form.numeroLote) <= 0) {
      Swal.fire("Falta el número", "Cargá el número de plantel.", "warning");
      return;
    }
    if (!form.galpon) {
      Swal.fire("Falta el galpón", "Elegí en qué galpón de recría entra el plantel.", "warning");
      return;
    }
    if (totalAves <= 0) {
      Swal.fire("Faltan aves", "Cargá la cantidad de hembras y/o machos.", "warning");
      return;
    }
    // Igual que en el ingreso de pollitos de crianza: las bajas son obligatorias
    // (se cargan en cero si no hubo), y si hay bajas hay que decir el motivo.
    if (form.bajasIngresoHembras === "" || form.bajasIngresoMachos === "") {
      Swal.fire(
        "Faltan las bajas",
        "Cargá las bajas recibidas de hembras y de machos (cero si no hubo).",
        "warning"
      );
      return;
    }
    if (totalBajas > 0 && !form.motivoBajas.trim()) {
      Swal.fire("Falta el motivo", "Si hay bajas, indicá el motivo.", "warning");
      return;
    }

    setSaving(true);
    try {
      const lote = await crearLoteReproductor({
        numeroLote: Number(form.numeroLote),
        galpon: Number(form.galpon),
        fechaIngreso: ajustarFechaParaGuardar(form.fechaIngreso),
        hembrasIngreso: Number(form.hembrasIngreso) || 0,
        machosIngreso: Number(form.machosIngreso) || 0,
        bajasIngresoHembras: Number(form.bajasIngresoHembras) || 0,
        bajasIngresoMachos: Number(form.bajasIngresoMachos) || 0,
        motivoBajas: form.motivoBajas || undefined,
        proveedor: form.proveedor || undefined,
        observaciones: form.observaciones || undefined,
      });
      onCreado();
      Swal.fire({
        icon: "success",
        title: `Plantel #${lote.numeroLote} creado`,
        text: `${nombreGalpon(constantes?.galpones, "recria", lote.galpon)} — ${formatearNumero(
          lote.hembras.actual
        )} hembras / ${formatearNumero(lote.machos.actual)} machos`,
        timer: 2600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el plantel.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-egg me-2"></i>Nuevo plantel
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-nuevo-lote-reproductor" onSubmit={handleSubmit}>
                <div className="alert alert-light border small mb-3">
                  <i className="bi bi-info-circle me-1"></i>
                  El plantel entra por un galpón de <strong>recría</strong> y conserva su número
                  toda la vida ({constantes?.semanasCicloVida ?? 65} semanas). Cuando esté listo
                  para poner se muda a un galpón de postura desde <strong>Galpones</strong>.
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">
                      Número de plantel <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      name="numeroLote"
                      className="form-control"
                      value={form.numeroLote}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      required
                    />
                    <div className="form-text">
                      Se carga a mano por ahora — sugerido: #{numeroSugerido}
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Galpón de recría</label>
                  <div className="d-flex flex-wrap gap-2">
                    {galponesRecria.map((g) => {
                      const ocupado = galponesOcupados.has(g.numero);
                      const seleccionado = Number(form.galpon) === g.numero;
                      return (
                        <button
                          key={g.numero}
                          type="button"
                          className={`btn ${
                            ocupado
                              ? "btn-danger disabled"
                              : seleccionado
                              ? "btn-success"
                              : "btn-outline-secondary"
                          }`}
                          disabled={ocupado}
                          onClick={() => !ocupado && setForm((prev) => ({ ...prev, galpon: g.numero }))}
                          title={ocupado ? "Galpón ocupado" : g.nombre}
                        >
                          {ocupado ? <i className="bi bi-lock-fill me-1"></i> : null}
                          {g.nombre}
                        </button>
                      );
                    })}
                  </div>
                  {galponesOcupados.size > 0 && (
                    <div className="mt-2 small text-muted">
                      <span className="badge bg-danger me-1">
                        <i className="bi bi-lock-fill"></i>
                      </span>
                      Galpón ocupado — ya tiene un lote activo
                    </div>
                  )}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Fecha de ingreso</label>
                    <input
                      type="date"
                      name="fechaIngreso"
                      className="form-control"
                      value={form.fechaIngreso}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">
                      Proveedor <span className="text-muted fw-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      name="proveedor"
                      className="form-control"
                      value={form.proveedor}
                      onChange={handleChange}
                      placeholder="Ej: Cabaña Avícola"
                    />
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mt-4 mb-2">
                  <i className="bi bi-gender-ambiguous me-1"></i>Aves ingresadas
                </h6>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Hembras</label>
                    <input
                      type="number"
                      name="hembrasIngreso"
                      className="form-control"
                      value={form.hembrasIngreso}
                      onChange={handleChange}
                      min="0"
                      placeholder="Ej: 9000"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Machos</label>
                    <input
                      type="number"
                      name="machosIngreso"
                      className="form-control"
                      value={form.machosIngreso}
                      onChange={handleChange}
                      min="0"
                      placeholder="Ej: 900"
                    />
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mt-4 mb-2">
                  <i className="bi bi-exclamation-triangle me-1"></i>Bajas recibidas
                </h6>
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Bajas hembras</label>
                    <input
                      type="number"
                      name="bajasIngresoHembras"
                      className="form-control"
                      value={form.bajasIngresoHembras}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Bajas machos</label>
                    <input
                      type="number"
                      name="bajasIngresoMachos"
                      className="form-control"
                      value={form.bajasIngresoMachos}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className={`form-label fw-semibold ${totalBajas > 0 ? "" : "text-muted"}`}>
                      Motivo {totalBajas > 0 && <span className="text-danger">*</span>}
                    </label>
                    <input
                      type="text"
                      name="motivoBajas"
                      className="form-control"
                      value={form.motivoBajas}
                      onChange={handleChange}
                      disabled={totalBajas === 0}
                      placeholder={totalBajas > 0 ? "Ej: muertas en viaje" : "Sin bajas"}
                    />
                  </div>
                </div>

                {totalAves > 0 && (
                  <div className="alert alert-success py-2 small mb-3">
                    Quedan en el galpón:{" "}
                    <strong>
                      {formatearNumero((Number(form.hembrasIngreso) || 0) - (Number(form.bajasIngresoHembras) || 0))}
                    </strong>{" "}
                    hembras y{" "}
                    <strong>
                      {formatearNumero((Number(form.machosIngreso) || 0) - (Number(form.bajasIngresoMachos) || 0))}
                    </strong>{" "}
                    machos ({formatearNumero(totalAves - totalBajas)} aves)
                  </div>
                )}

                <div className="mb-2">
                  <label className="form-label fw-semibold">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea
                    name="observaciones"
                    className="form-control"
                    rows={2}
                    value={form.observaciones}
                    onChange={handleChange}
                  />
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                form="form-nuevo-lote-reproductor"
                className="btn btn-success"
                disabled={saving}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-lg me-1"></i>Ingresar plantel
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
const ReproductorLoteNuevoPage = () => {
  const navigate = useNavigate();
  const [constantes, setConstantes] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, data] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerLotesReproductores(),
      ]);
      setConstantes(cons);
      setLotes(Array.isArray(data) ? data : []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los planteles.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Galpones de recría que ya tienen un lote activo.
  const galponesOcupados = new Set(
    lotes
      .filter((l) => l.sector === "recria" && l.estado !== "finalizado")
      .map((l) => l.galpon)
  );

  const handleEliminar = async (lote) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Eliminar el plantel #${lote.numeroLote}?`,
      text: "Se borra el ingreso completo con su mortandad y pesajes. No se puede deshacer.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;

    try {
      await eliminarLoteReproductor(lote._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Plantel eliminado", timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar el plantel.", "error");
    }
  };

  // Mientras la carga sea manual, sugerimos el siguiente al mayor ya usado.
  const numeroSugerido =
    lotes.reduce((max, l) => Math.max(max, Number(l.numeroLote) || 0), 0) + 1;

  const lotesPagina = lotes.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-egg text-success me-2"></i>Ingreso de Plantel
            </h1>
            <p className="text-muted mb-0 small">
              Alta de planteles de reproductoras (machos y hembras) en los galpones de recría
            </p>
          </div>
          <button className="btn btn-success" onClick={() => setModalAbierto(true)}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo plantel
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : lotes.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              Todavía no hay planteles cargados.
            </div>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="card shadow-sm d-none d-md-block">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Plantel</th>
                      <th>Ubicación</th>
                      <th>Ingreso</th>
                      <th className="text-end">Hembras</th>
                      <th className="text-end">Machos</th>
                      <th className="text-center">Semana</th>
                      <th className="text-center">Estado</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesPagina.map((lote) => {
                      const estado = ESTADO_LOTE[lote.estado] || {};
                      return (
                        <tr key={lote._id}>
                          <td className="fw-bold">#{lote.numeroLote}</td>
                          <td>{nombreGalpon(constantes?.galpones, lote.sector, lote.galpon)}</td>
                          <td>{formatearFechaLocal(lote.fechaIngreso)}</td>
                          <td className="text-end">
                            {formatearNumero(lote.hembras?.actual)}
                            <span className="text-muted small"> / {formatearNumero(lote.hembras?.ingreso)}</span>
                          </td>
                          <td className="text-end">
                            {formatearNumero(lote.machos?.actual)}
                            <span className="text-muted small"> / {formatearNumero(lote.machos?.ingreso)}</span>
                          </td>
                          <td className="text-center">
                            {lote.semanaVida ?? "-"}
                            <span className="text-muted small">/{constantes?.semanasCicloVida ?? 65}</span>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${estado.clase}`}>{estado.label}</span>
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-primary me-1"
                              onClick={() => navigate("/reproductores/galpones")}
                              title="Ver en galpones"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleEliminar(lote)}
                              title="Eliminar"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="d-md-none">
              {lotesPagina.map((lote) => {
                const estado = ESTADO_LOTE[lote.estado] || {};
                return (
                  <div className="card shadow-sm mb-2" key={lote._id}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="fw-bold mb-0">Plantel #{lote.numeroLote}</h6>
                          <small className="text-muted">
                            {nombreGalpon(constantes?.galpones, lote.sector, lote.galpon)}
                          </small>
                        </div>
                        <span className={`badge ${estado.clase}`}>{estado.label}</span>
                      </div>
                      <div className="row g-2 small">
                        <div className="col-6">
                          <span className="text-muted">Hembras:</span>{" "}
                          <strong>{formatearNumero(lote.hembras?.actual)}</strong>
                        </div>
                        <div className="col-6">
                          <span className="text-muted">Machos:</span>{" "}
                          <strong>{formatearNumero(lote.machos?.actual)}</strong>
                        </div>
                        <div className="col-6">
                          <span className="text-muted">Ingreso:</span>{" "}
                          {formatearFechaLocal(lote.fechaIngreso)}
                        </div>
                        <div className="col-6">
                          <span className="text-muted">Semana:</span> {lote.semanaVida ?? "-"}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-danger w-100 mt-3"
                        onClick={() => handleEliminar(lote)}
                      >
                        <i className="bi bi-trash me-1"></i>Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={pagina}
              totalItems={lotes.length}
              itemsPerPage={ITEMS_POR_PAGINA}
              onPageChange={setPagina}
            />
          </>
        )}
      </div>

      {modalAbierto && (
        <NuevoLoteModal
          constantes={constantes}
          galponesOcupados={galponesOcupados}
          numeroSugerido={numeroSugerido}
          onClose={() => setModalAbierto(false)}
          onCreado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default ReproductorLoteNuevoPage;
