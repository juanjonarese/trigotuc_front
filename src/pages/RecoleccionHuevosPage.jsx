import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerConstantesReproductores,
  obtenerLotesEnProduccion,
  obtenerRecoleccionesHuevos,
  crearRecoleccionHuevos,
  editarRecoleccionHuevos,
  eliminarRecoleccionHuevos,
} from "../services/api";
import {
  formatearFechaLocal,
  formatearHoraLocal,
  ajustarFechaParaGuardar,
  obtenerFechaHoy,
  obtenerHoraAhora,
} from "../utils/dateUtils";
import {
  formatearNumero,
  formatearPorcentaje,
  textoDesglose,
  nombreGalpon,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 20;

// Lo recolectado se reparte en tres destinos y los tres se cargan en unidades
// (huevos), que es como se cuenta en el galpón y la unidad en la que se lleva el
// stock. El total es la suma: no se carga aparte, así no puede quedar
// descuadrado. Cajones y bandejas quedan solo como lectura derivada.
const FORM_VACIO = {
  fecha: obtenerFechaHoy(),
  hora: "",      // hora de la pasada; se precarga con la de ahora
  aIncubar: "",  // los que están bien, van a la incubadora
  aVenta: "",    // con algún problema pero vendibles (sucios, etc.)
  perdida: "",   // rotos y demás: se tiran
  observaciones: "",
};

// ── Modal: carga y edición de la recolección de un galpón ───────────────────
// El galpón ya viene elegido desde la tarjeta, así que el formulario no vuelve
// a preguntarlo. Con `recoleccion` edita esa carga; sin ella, da de alta una.
// `previoDelDia` son los huevos ya cargados ese mismo día en otras pasadas: el
// límite del 100% de postura se mide contra el total del día, igual que en el
// backend, no contra cada carga suelta.
const RecoleccionModal = ({
  lote,
  galponLabel,
  constantes,
  recoleccion,
  previoDelDia = 0,
  onClose,
  onHecho,
}) => {
  const edicion = !!recoleccion;

  // En alta la fecha se toma al abrir el modal, no al cargar la página.
  const [form, setForm] = useState(() =>
    edicion
      ? {
          fecha: (recoleccion.fecha || "").slice(0, 10),
          // Las cargas viejas no tienen hora: se cae al horario del alta.
          hora: formatearHoraLocal(recoleccion.fechaHora || recoleccion.createdAt),
          aIncubar: recoleccion.inoculables ? String(recoleccion.inoculables) : "",
          aVenta: recoleccion.descarte1 ? String(recoleccion.descarte1) : "",
          perdida: recoleccion.descartePerdida ? String(recoleccion.descartePerdida) : "",
          observaciones: recoleccion.observaciones || "",
        }
      : { ...FORM_VACIO, fecha: obtenerFechaHoy(), hora: obtenerHoraAhora() }
  );
  const [saving, setSaving] = useState(false);

  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  const huevosPorBandeja = constantes?.huevosPorBandeja ?? 12;

  const inoculables = Number(form.aIncubar) || 0;
  const aVenta = Number(form.aVenta) || 0;
  const perdida = Number(form.perdida) || 0;
  const huevosTotales = inoculables + aVenta + perdida;

  // Una gallina pone como mucho un huevo por día: más del 100% de postura es
  // imposible y casi siempre significa que las hembras del plantel están mal cargadas.
  // Se avisa acá para no tener que esperar el rechazo del backend.
  // Al editar se usa la cantidad de hembras congelada en la recolección, contra la que
  // valida el backend: el actual pudo cambiar por mortandad posterior.
  const hembras = edicion
    ? recoleccion.hembrasEnPostura ?? 0
    : lote?.hembras?.actual ?? 0;
  const totalDelDia = huevosTotales + previoDelDia;
  const porcentajePostura = hembras > 0 ? (totalDelDia / hembras) * 100 : null;
  const posturaImposible = totalDelDia > 0 && hembras > 0 && totalDelDia > hembras;

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
        `${formatearNumero(totalDelDia)} huevos en el día` +
          (previoDelDia > 0
            ? ` (${formatearNumero(previoDelDia)} ya cargados + ${formatearNumero(huevosTotales)})`
            : "") +
          ` con ${formatearNumero(hembras)} hembras da ${porcentajePostura.toFixed(2)}% de postura. ` +
          `Una gallina pone como máximo un huevo por día (100%). ` +
          `Revisá las hembras del plantel o la cantidad recolectada.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      if (edicion) {
        // La fecha no se toca en la edición: define la partida FIFO y el índice
        // único (plantel, fecha). Para corregirla hay que borrar y volver a cargar.
        await editarRecoleccionHuevos(recoleccion._id, {
          hora: form.hora || undefined,
          inoculables,
          descarte1: aVenta,
          descartePerdida: perdida,
          observaciones: form.observaciones || undefined,
        });
      } else {
        await crearRecoleccionHuevos({
          lote: lote._id,
          fecha: ajustarFechaParaGuardar(form.fecha),
          hora: form.hora || undefined,
          inoculables,
          descarte1: aVenta,
          descartePerdida: perdida,
          observaciones: form.observaciones || undefined,
        });
      }
      await onHecho();
      Swal.fire({
        icon: "success",
        title: edicion ? "Recolección corregida" : "Recolección cargada",
        text: `${formatearNumero(inoculables)} a incubar · ${formatearNumero(aVenta)} a venta · ${formatearNumero(perdida)} descarte`,
        timer: 2400,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.message || `No se pudo ${edicion ? "corregir" : "cargar"} la recolección.`,
        "error"
      );
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className={`modal-header text-white ${edicion ? "bg-primary" : "bg-success"}`}>
              <h5 className="modal-title">
                <i className={`bi ${edicion ? "bi-pencil-square" : "bi-basket"} me-2`}></i>
                {edicion ? "Corregir recolección — " : ""}
                {galponLabel} — Plantel #{lote.numeroLote}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="text-muted small mb-3">
                Semana {lote.semanaVida} de vida · {formatearNumero(hembras)} hembras
                {edicion ? " al momento de la carga" : " en el galpón"}
              </div>
              <form id="form-recoleccion" onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-md-8">
                    <label className="form-label fw-semibold">Fecha</label>
                    <input
                      type="date"
                      name="fecha"
                      className="form-control"
                      value={form.fecha}
                      onChange={handleChange}
                      required
                      disabled={edicion}
                    />
                    {edicion && (
                      <div className="form-text">
                        La fecha no se puede cambiar: define el orden de consumo de los huevos.
                        Si está mal, borrá la recolección y volvé a cargarla.
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Hora</label>
                    <input
                      type="time"
                      name="hora"
                      className="form-control"
                      value={form.hora}
                      onChange={handleChange}
                      required
                    />
                    <div className="form-text">De qué pasada del día es</div>
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mb-2">Huevos recolectados</h6>

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <div className="border rounded p-3 h-100">
                      <div className="fw-semibold mb-2">
                        <i className="bi bi-thermometer-half text-primary me-1"></i>A incubadora
                        <span className="text-muted fw-normal small"> — los que están bien</span>
                      </div>
                      <label className="form-label fw-semibold small">Huevos (unidades)</label>
                      <input
                        type="number"
                        name="aIncubar"
                        className="form-control"
                        min="0"
                        value={form.aIncubar}
                        onChange={handleChange}
                        placeholder="0"
                      />
                      <div className="form-text">
                        {inoculables > 0
                          ? textoDesglose(inoculables, huevosPorCajon, huevosPorBandeja)
                          : "Van al stock incubable."}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
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
                  <div className="col-md-4">
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
                        <strong>Esta carga:</strong> {formatearNumero(huevosTotales)}
                        <span className="text-muted">
                          {" "}
                          ({textoDesglose(huevosTotales, huevosPorCajon, huevosPorBandeja)})
                        </span>
                      </div>
                      {previoDelDia > 0 && (
                        <div className="col-12">
                          <strong>Total del día:</strong> {formatearNumero(totalDelDia)}
                          <span className="text-muted">
                            {" "}
                            — ya había {formatearNumero(previoDelDia)} cargados en otras pasadas
                          </span>
                        </div>
                      )}
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
                        por día, así que la postura no puede pasar del 100%. Revisá las hembras
                        del plantel o la cantidad recolectada.
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
                className={`btn ${edicion ? "btn-primary" : "btn-success"}`}
                disabled={saving || posturaImposible}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-lg me-1"></i>
                {edicion ? "Guardar cambios" : "Cargar recolección"}
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
  const [editando, setEditando] = useState(null); // { recoleccion, lote }

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

  // Un galpón de postura por tarjeta. Solo los que tienen plantel poniendo se
  // pueden abrir: el resto queda a la vista pero sin acción.
  // En el galpón se junta varias veces al día, así que la tarjeta muestra la
  // suma de todas las pasadas de hoy y cuántas fueron.
  const hoy = obtenerFechaHoy();
  const galponesPostura = (constantes?.galpones?.postura || []).map((g) => {
    const lote = lotes.find((l) => l.galpon === g.numero);
    const delDia = lote
      ? recolecciones.filter(
          (r) => (r.lote?._id || r.lote) === lote._id && String(r.fecha).slice(0, 10) === hoy
        )
      : [];
    const sumar = (campo) => delDia.reduce((s, r) => s + (r[campo] || 0), 0);
    const hoyResumen = delDia.length
      ? {
          pasadas: delDia.length,
          huevosTotales: sumar("huevosTotales"),
          inoculables: sumar("inoculables"),
          descarte1: sumar("descarte1"),
          descartePerdida: sumar("descartePerdida"),
        }
      : null;
    return { galpon: g, lote, hoyResumen };
  });

  // Huevos cargados para ese plantel en esa fecha, sin contar una recolección dada.
  const totalDelDia = (loteId, fecha, excluirId = null) =>
    recolecciones
      .filter(
        (r) =>
          (r.lote?._id || r.lote) === loteId &&
          String(r.fecha).slice(0, 10) === String(fecha).slice(0, 10) &&
          r._id !== excluirId
      )
      .reduce((s, r) => s + (r.huevosTotales || 0), 0);

  // Para editar se arma el plantel a partir de la propia recolección: la semana y el
  // plantel son los del día de la carga, no los de hoy.
  const handleEditar = (rec) => {
    const loteRec = rec.lote || {};
    setEditando({
      recoleccion: rec,
      lote: { ...loteRec, semanaVida: rec.semanaVida },
      previoDelDia: totalDelDia(loteRec._id || rec.lote, rec.fecha, rec._id),
    });
  };

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
                  {galponesPostura.map(({ galpon, lote, hoyResumen }) => {
                    if (!lote) {
                      return (
                        <div className="col-12 col-md-6 col-xl-3" key={galpon.numero}>
                          <div className="card shadow-sm h-100" style={{ borderStyle: "dashed" }}>
                            <div className="card-body text-center text-muted py-4">
                              <i className="bi bi-door-open fs-2 d-block mb-2"></i>
                              <div className="fw-semibold">{galpon.nombre}</div>
                              <small>Sin plantel en producción</small>
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
                            {hoyResumen ? (
                              <span className="badge bg-success">
                                <i className="bi bi-check-lg me-1"></i>
                                {hoyResumen.pasadas === 1
                                  ? "1 recolección hoy"
                                  : `${hoyResumen.pasadas} recolecciones hoy`}
                              </span>
                            ) : (
                              <span className="badge bg-warning text-dark">Sin cargar hoy</span>
                            )}
                          </div>
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-baseline mb-2">
                              <span className="fw-bold">Plantel #{lote.numeroLote}</span>
                              <small className="text-muted">Semana {lote.semanaVida}</small>
                            </div>
                            <div className="small text-muted mb-3">
                              <i className="bi bi-gender-female me-1"></i>
                              {formatearNumero(lote.hembras?.actual)} hembras
                            </div>

                            {hoyResumen ? (
                              <div className="border rounded p-2 small mb-3">
                                <div className="fw-semibold mb-1">
                                  Hoy: {formatearNumero(hoyResumen.huevosTotales)} huevos
                                  {hoyResumen.pasadas > 1 && (
                                    <span className="text-muted fw-normal">
                                      {" "}
                                      en {hoyResumen.pasadas} pasadas
                                    </span>
                                  )}
                                </div>
                                <div className="text-muted">
                                  <span className="text-success">
                                    {formatearNumero(hoyResumen.inoculables)} a incubar
                                  </span>{" "}
                                  ·{" "}
                                  <span className="text-warning">
                                    {formatearNumero(hoyResumen.descarte1)} a venta
                                  </span>{" "}
                                  ·{" "}
                                  <span className="text-danger">
                                    {formatearNumero(hoyResumen.descartePerdida)} descarte
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
                                {hoyResumen ? "Cargar otra recolección" : "Cargar recolección"}
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
                          <th>Plantel</th>
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
                            <td>
                              {formatearFechaLocal(r.fecha)}
                              <span className="text-muted small d-block">
                                <i className="bi bi-clock me-1"></i>
                                {formatearHoraLocal(r.fechaHora || r.createdAt)}
                              </span>
                            </td>
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
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => handleEditar(r)}
                                  title="Corregir"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleEliminar(r)}
                                  title="Eliminar"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
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
                          <strong>
                            {formatearFechaLocal(r.fecha)}
                            <span className="text-muted fw-normal small ms-2">
                              <i className="bi bi-clock me-1"></i>
                              {formatearHoraLocal(r.fechaHora || r.createdAt)}
                            </span>
                          </strong>
                          <span className="text-muted small">
                            Plantel #{r.lote?.numeroLote ?? "?"} · G{r.galpon}
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
                        <div className="d-flex gap-2 mt-3">
                          <button
                            className="btn btn-sm btn-outline-primary flex-fill"
                            onClick={() => handleEditar(r)}
                          >
                            <i className="bi bi-pencil me-1"></i>Corregir
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger flex-fill"
                            onClick={() => handleEliminar(r)}
                          >
                            <i className="bi bi-trash me-1"></i>Eliminar
                          </button>
                        </div>
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
          previoDelDia={totalDelDia(galponAbierto._id, hoy)}
          onClose={() => setGalponAbierto(null)}
          onHecho={async () => {
            setGalponAbierto(null);
            await cargar();
          }}
        />
      )}

      {editando && (
        <RecoleccionModal
          lote={editando.lote}
          galponLabel={nombreGalpon(constantes?.galpones, "postura", editando.lote.galpon)}
          constantes={constantes}
          recoleccion={editando.recoleccion}
          previoDelDia={editando.previoDelDia}
          onClose={() => setEditando(null)}
          onHecho={async () => {
            setEditando(null);
            await cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default RecoleccionHuevosPage;
