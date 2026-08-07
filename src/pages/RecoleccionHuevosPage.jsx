import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerConstantesReproductores,
  obtenerLotesEnProduccion,
  obtenerRecoleccionesHuevos,
  crearRecoleccionHuevos,
  eliminarRecoleccionHuevos,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import {
  formatearNumero,
  formatearPorcentaje,
  textoDesglose,
  nombreGalpon,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 20;

// Lo recolectado en el día se reparte en tres destinos. El total es la suma:
// no se carga aparte, así no puede quedar descuadrado.
const FORM_VACIO = {
  fecha: obtenerFechaHoy(),
  // A incubadora: se cuenta como viene del galpón (cajones + bandejas + sueltos)
  cajones: "",
  bandejas: "",
  sueltos: "",
  aVenta: "",   // con algún problema pero vendibles (sucios, etc.)
  perdida: "",  // rotos y demás: se tiran
  observaciones: "",
};

// ── Modal: carga de la recolección de un galpón ─────────────────────────────
// El galpón ya viene elegido desde la tarjeta, así que el formulario no vuelve
// a preguntarlo.
const RecoleccionModal = ({ lote, galponLabel, constantes, onClose, onHecho }) => {
  // La fecha se toma en el momento de abrir el modal, no al cargar la página.
  const [form, setForm] = useState({ ...FORM_VACIO, fecha: obtenerFechaHoy() });
  const [saving, setSaving] = useState(false);

  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  const huevosPorBandeja = constantes?.huevosPorBandeja ?? 12;
  const bandejasPorCajon = constantes?.bandejasPorCajon ?? 12;

  // Los huevos a incubar se cuentan como llegan del galpón (cajones y bandejas)
  // y el sistema los convierte a unidades, que es la unidad de stock.
  const inoculables =
    (Number(form.cajones) || 0) * huevosPorCajon +
    (Number(form.bandejas) || 0) * huevosPorBandeja +
    (Number(form.sueltos) || 0);
  const aVenta = Number(form.aVenta) || 0;
  const perdida = Number(form.perdida) || 0;
  const huevosTotales = inoculables + aVenta + perdida;

  // Una gallina pone como mucho un huevo por día: más del 100% de postura es
  // imposible y casi siempre significa que el plantel del lote está mal cargado.
  // Se avisa acá para no tener que esperar el rechazo del backend.
  const hembras = lote?.hembras?.actual ?? 0;
  const porcentajePostura = hembras > 0 ? (huevosTotales / hembras) * 100 : null;
  const posturaImposible = huevosTotales > 0 && hembras > 0 && huevosTotales > hembras;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (huevosTotales <= 0) {
      Swal.fire("Faltan huevos", "Cargá la recolección del día en alguno de los tres destinos.", "warning");
      return;
    }
    if (posturaImposible) {
      Swal.fire(
        "Postura imposible",
        `${formatearNumero(huevosTotales)} huevos con ${formatearNumero(hembras)} hembras da ` +
          `${porcentajePostura.toFixed(2)}% de postura. Una gallina pone como máximo un huevo por día ` +
          `(100%). Revisá el plantel del lote o la cantidad recolectada.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      await crearRecoleccionHuevos({
        lote: lote._id,
        fecha: ajustarFechaParaGuardar(form.fecha),
        inoculables,
        descarte1: aVenta,
        descartePerdida: perdida,
        observaciones: form.observaciones || undefined,
      });
      await onHecho();
      Swal.fire({
        icon: "success",
        title: "Recolección cargada",
        text: `${formatearNumero(inoculables)} a incubar · ${formatearNumero(aVenta)} a venta · ${formatearNumero(perdida)} descarte`,
        timer: 2400,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar la recolección.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-basket me-2"></i>
                {galponLabel} — Lote #{lote.numeroLote}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="text-muted small mb-3">
                Semana {lote.semanaVida} de vida · {formatearNumero(hembras)} hembras en el galpón
              </div>
              <form id="form-recoleccion" onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha</label>
                  <input
                    type="date"
                    name="fecha"
                    className="form-control"
                    value={form.fecha}
                    onChange={handleChange}
                    required
                  />
                </div>

                <h6 className="fw-bold text-secondary mb-2">Huevos recolectados</h6>

                {/* A incubadora: se cuenta como viene del galpón. */}
                <div className="border rounded p-3 mb-3">
                  <div className="fw-semibold mb-2">
                    <i className="bi bi-thermometer-half text-primary me-1"></i>A incubadora
                    <span className="text-muted fw-normal small"> — los que están bien</span>
                  </div>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Cajones</label>
                      <input
                        type="number"
                        name="cajones"
                        className="form-control"
                        min="0"
                        value={form.cajones}
                        onChange={handleChange}
                        placeholder="0"
                      />
                      <div className="form-text">{huevosPorCajon} huevos c/u</div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Bandejas sueltas</label>
                      <input
                        type="number"
                        name="bandejas"
                        className="form-control"
                        min="0"
                        max={bandejasPorCajon - 1}
                        value={form.bandejas}
                        onChange={handleChange}
                        placeholder="0"
                      />
                      <div className="form-text">{huevosPorBandeja} huevos c/u</div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Huevos sueltos</label>
                      <input
                        type="number"
                        name="sueltos"
                        className="form-control"
                        min="0"
                        value={form.sueltos}
                        onChange={handleChange}
                        placeholder="0"
                      />
                      <div className="form-text">unidades</div>
                    </div>
                  </div>
                  {inoculables > 0 && (
                    <div className="small text-primary mt-2">
                      <i className="bi bi-egg me-1"></i>
                      {formatearNumero(inoculables)} huevos ={" "}
                      {textoDesglose(inoculables, huevosPorCajon, huevosPorBandeja)}
                    </div>
                  )}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="fw-semibold mb-2">
                        <i className="bi bi-cart text-warning me-1"></i>A venta
                        <span className="text-muted fw-normal small"> — con algún problema</span>
                      </div>
                      <label className="form-label fw-semibold small">Huevos (unidades)</label>
                      <input
                        type="number"
                        name="aVenta"
                        className="form-control"
                        min="0"
                        value={form.aVenta}
                        onChange={handleChange}
                        placeholder="0"
                      />
                      <div className="form-text">
                        Sucios y similares: no se incuban, van al stock de venta.
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="fw-semibold mb-2">
                        <i className="bi bi-trash text-danger me-1"></i>Descarte
                        <span className="text-muted fw-normal small"> — se tiran</span>
                      </div>
                      <label className="form-label fw-semibold small">Huevos (unidades)</label>
                      <input
                        type="number"
                        name="perdida"
                        className="form-control"
                        min="0"
                        value={form.perdida}
                        onChange={handleChange}
                        placeholder="0"
                      />
                      <div className="form-text">
                        Rotos y cualquier otro motivo. No generan stock.
                      </div>
                    </div>
                  </div>
                </div>

                {huevosTotales > 0 && (
                  <div className={`alert py-2 mb-3 ${posturaImposible ? "alert-danger" : "alert-success"}`}>
                    <div className="row g-2 small">
                      <div className="col-md-6">
                        <strong>Total del día:</strong> {formatearNumero(huevosTotales)}
                        <span className="text-muted">
                          {" "}
                          ({textoDesglose(huevosTotales, huevosPorCajon, huevosPorBandeja)})
                        </span>
                      </div>
                      <div className="col-md-6">
                        <strong>A incubadora:</strong> {formatearNumero(inoculables)}
                        <span className="text-muted">
                          {" "}
                          ({formatearPorcentaje((inoculables / huevosTotales) * 100)})
                        </span>
                      </div>
                      <div className="col-md-6">
                        <strong>A venta:</strong> {formatearNumero(aVenta)}
                      </div>
                      <div className="col-md-6">
                        <strong>Descarte:</strong> {formatearNumero(perdida)}
                      </div>
                      {porcentajePostura != null && (
                        <div className="col-12">
                          <strong>Postura:</strong> {formatearPorcentaje(porcentajePostura)} sobre{" "}
                          {formatearNumero(hembras)} hembras
                        </div>
                      )}
                    </div>
                    {posturaImposible && (
                      <div className="mt-2 pt-2 border-top small">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        <strong>Esto no puede ser:</strong> una gallina pone como máximo un huevo
                        por día, así que la postura no puede pasar del 100%. Revisá el plantel del
                        lote o la cantidad recolectada.
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="form-label fw-semibold">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    name="observaciones"
                    className="form-control"
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
                form="form-recoleccion"
                className="btn btn-success"
                disabled={saving || posturaImposible}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-lg me-1"></i>Cargar recolección
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

const RecoleccionHuevosPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [recolecciones, setRecolecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [galponAbierto, setGalponAbierto] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, lotesProd, recs] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerLotesEnProduccion(),
        obtenerRecoleccionesHuevos(),
      ]);
      setConstantes(cons);
      setLotes(Array.isArray(lotesProd) ? lotesProd : []);
      setRecolecciones(Array.isArray(recs) ? recs : []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  const bandejasPorCajon = constantes?.bandejasPorCajon ?? 12;

  // Un galpón de postura por tarjeta. Solo los que tienen lote poniendo se
  // pueden abrir: el resto queda a la vista pero sin acción.
  const hoy = obtenerFechaHoy();
  const galponesPostura = (constantes?.galpones?.postura || []).map((g) => {
    const lote = lotes.find((l) => l.galpon === g.numero);
    const recHoy = lote
      ? recolecciones.find(
          (r) => (r.lote?._id || r.lote) === lote._id && String(r.fecha).slice(0, 10) === hoy
        )
      : null;
    return { galpon: g, lote, recHoy };
  });

  const handleEliminar = async (rec) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar la recolección?",
      text: "Solo se puede si sus huevos no entraron a una tanda ni se vendieron.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await eliminarRecoleccionHuevos(rec._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Recolección eliminada", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("No se puede eliminar", err.message, "error");
    }
  };

  const recsPagina = recolecciones.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="mb-4">
          <h1 className="h3 fw-bold mb-1">
            <i className="bi bi-basket text-success me-2"></i>Recolección de Huevos
          </h1>
          <p className="text-muted mb-0 small">
            Carga diaria por galpón de postura — 1 cajón = {bandejasPorCajon} bandejas ={" "}
            {huevosPorCajon} huevos
          </p>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : (
          <>
            {galponesPostura.length === 0 ? (
              <div className="alert alert-warning small">
                <i className="bi bi-exclamation-triangle me-1"></i>
                No hay galpones de postura configurados.
              </div>
            ) : (
              <>
                <h5 className="fw-bold text-secondary mb-3">
                  Galpones de postura
                  <span className="text-muted fw-normal small ms-2">
                    tocá un galpón para cargar la recolección del día
                  </span>
                </h5>
                <div className="row g-3 mb-4">
                  {galponesPostura.map(({ galpon, lote, recHoy }) => {
                    if (!lote) {
                      return (
                        <div className="col-12 col-md-6 col-xl-3" key={galpon.numero}>
                          <div className="card shadow-sm h-100" style={{ borderStyle: "dashed" }}>
                            <div className="card-body text-center text-muted py-4">
                              <i className="bi bi-door-open fs-2 d-block mb-2"></i>
                              <div className="fw-semibold">{galpon.nombre}</div>
                              <small>Sin lote en producción</small>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="col-12 col-md-6 col-xl-3" key={galpon.numero}>
                        <div
                          className="card shadow-sm h-100"
                          style={{ cursor: "pointer" }}
                          onClick={() => setGalponAbierto(lote)}
                          title="Cargar la recolección de este galpón"
                        >
                          <div className="card-header bg-white d-flex justify-content-between align-items-center">
                            <span className="fw-bold">{galpon.nombre}</span>
                            {recHoy ? (
                              <span className="badge bg-success">
                                <i className="bi bi-check-lg me-1"></i>Cargado hoy
                              </span>
                            ) : (
                              <span className="badge bg-warning text-dark">Sin cargar hoy</span>
                            )}
                          </div>
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-baseline mb-2">
                              <span className="fw-bold">Lote #{lote.numeroLote}</span>
                              <small className="text-muted">Semana {lote.semanaVida}</small>
                            </div>
                            <div className="small text-muted mb-3">
                              <i className="bi bi-gender-female me-1"></i>
                              {formatearNumero(lote.hembras?.actual)} hembras
                            </div>

                            {recHoy ? (
                              <div className="border rounded p-2 small mb-3">
                                <div className="fw-semibold mb-1">
                                  Hoy: {formatearNumero(recHoy.huevosTotales)} huevos
                                </div>
                                <div className="text-muted">
                                  <span className="text-success">
                                    {formatearNumero(recHoy.inoculables)} a incubar
                                  </span>{" "}
                                  ·{" "}
                                  <span className="text-warning">
                                    {formatearNumero(recHoy.descarte1)} a venta
                                  </span>{" "}
                                  ·{" "}
                                  <span className="text-danger">
                                    {formatearNumero(recHoy.descartePerdida || 0)} descarte
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="small text-muted mb-3">
                                Todavía no se cargó la recolección de hoy.
                              </div>
                            )}

                            <div className="d-grid">
                              <span className="btn btn-sm btn-success">
                                <i className="bi bi-basket me-1"></i>
                                {recHoy ? "Cargar otra recolección" : "Cargar recolección"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <h5 className="fw-bold text-secondary mb-3">Historial</h5>
            {recolecciones.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  Sin recolecciones cargadas.
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
                          <th>Fecha</th>
                          <th>Lote</th>
                          <th className="text-center">Sem. prod.</th>
                          <th className="text-end">Total</th>
                          <th className="text-end">A incubar</th>
                          <th className="text-end">A venta</th>
                          <th className="text-end">Descarte</th>
                          <th className="text-end">% fert.</th>
                          <th className="text-end">% postura</th>
                          <th className="text-end">Sin incubar</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recsPagina.map((r) => (
                          <tr key={r._id}>
                            <td>{formatearFechaLocal(r.fecha)}</td>
                            <td>
                              #{r.lote?.numeroLote ?? "?"}
                              <span className="text-muted small"> · G{r.galpon}</span>
                            </td>
                            <td className="text-center">{r.semanaProduccion ?? "-"}</td>
                            <td className="text-end fw-semibold">{formatearNumero(r.huevosTotales)}</td>
                            <td className="text-end text-success">{formatearNumero(r.inoculables)}</td>
                            <td className="text-end text-warning">{formatearNumero(r.descarte1)}</td>
                            <td className="text-end text-danger">
                              {formatearNumero(r.descartePerdida || 0)}
                            </td>
                            <td className="text-end">{formatearPorcentaje(r.porcentajeFertilidad)}</td>
                            <td className="text-end">{formatearPorcentaje(r.porcentajeProduccion)}</td>
                            <td className="text-end">
                              {r.inoculablesDisponibles > 0 ? (
                                <span className="badge bg-info text-dark">
                                  {formatearNumero(r.inoculablesDisponibles)}
                                </span>
                              ) : (
                                <span className="text-muted small">todo incubado</span>
                              )}
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleEliminar(r)}
                                title="Eliminar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile */}
                <div className="d-md-none">
                  {recsPagina.map((r) => (
                    <div className="card shadow-sm mb-2" key={r._id}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between mb-2">
                          <strong>{formatearFechaLocal(r.fecha)}</strong>
                          <span className="text-muted small">
                            Lote #{r.lote?.numeroLote ?? "?"} · G{r.galpon}
                          </span>
                        </div>
                        <div className="row g-2 small">
                          <div className="col-6">
                            <span className="text-muted">Total:</span>{" "}
                            <strong>{formatearNumero(r.huevosTotales)}</strong>
                          </div>
                          <div className="col-6">
                            <span className="text-muted">A incubar:</span>{" "}
                            <strong className="text-success">{formatearNumero(r.inoculables)}</strong>
                          </div>
                          <div className="col-6">
                            <span className="text-muted">A venta:</span>{" "}
                            <strong className="text-warning">{formatearNumero(r.descarte1)}</strong>
                          </div>
                          <div className="col-6">
                            <span className="text-muted">Descarte:</span>{" "}
                            <strong className="text-danger">
                              {formatearNumero(r.descartePerdida || 0)}
                            </strong>
                          </div>
                          <div className="col-6">
                            <span className="text-muted">Fertilidad:</span>{" "}
                            {formatearPorcentaje(r.porcentajeFertilidad)}
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-danger w-100 mt-3"
                          onClick={() => handleEliminar(r)}
                        >
                          <i className="bi bi-trash me-1"></i>Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={pagina}
                  totalItems={recolecciones.length}
                  itemsPerPage={ITEMS_POR_PAGINA}
                  onPageChange={setPagina}
                />
              </>
            )}
          </>
        )}
      </div>

      {galponAbierto && (
        <RecoleccionModal
          lote={galponAbierto}
          galponLabel={nombreGalpon(constantes?.galpones, "postura", galponAbierto.galpon)}
          constantes={constantes}
          onClose={() => setGalponAbierto(null)}
          onHecho={async () => {
            setGalponAbierto(null);
            await cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default RecoleccionHuevosPage;
