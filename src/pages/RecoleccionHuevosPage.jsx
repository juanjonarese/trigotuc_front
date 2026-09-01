import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import BotonExcel from "../components/BotonExcel";
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
  TIPOS_HUEVO,
  TIPOS_HUEVO_KEYS,
  sumarTiposHuevo,
} from "../utils/reproductoresUtils";
import { exportarTablaExcel } from "../utils/exportarExcel";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 20;

// Lo recolectado se clasifica en el galpón en los cuatro tipos que después
// viajan en el remito a Trigotuc, más los rotos que se tiran. Todo en unidades
// (huevos), que es como se cuenta en el galpón y la unidad en la que se lleva el
// stock. El total es la suma: no se carga aparte, así no puede quedar
// descuadrado. Cajones y bandejas quedan solo como lectura derivada.
//
// Ojo: cargar la recolección NO manda los huevos a Trigotuc — quedan en stock en
// la granja hasta que salen en un remito.

// Los inputs por tipo se manejan como texto para poder dejarlos vacíos.
const tiposVacios = () => TIPOS_HUEVO_KEYS.reduce((acc, k) => ({ ...acc, [k]: "" }), {});

const tiposDesdeRecoleccion = (rec) =>
  TIPOS_HUEVO_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: rec.tipos?.[k] ? String(rec.tipos[k]) : "" }),
    {}
  );

// Pasa los inputs de texto a números para mandarlos al backend.
const tiposANumeros = (tipos) =>
  TIPOS_HUEVO_KEYS.reduce((acc, k) => ({ ...acc, [k]: Number(tipos[k]) || 0 }), {});

const FORM_VACIO = {
  fecha: obtenerFechaHoy(),
  hora: "",       // hora de la pasada; se precarga con la de ahora
  tipos: tiposVacios(),
  perdida: "",    // rotos y demás: se tiran
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
          tipos: tiposDesdeRecoleccion(recoleccion),
          perdida: recoleccion.descartePerdida ? String(recoleccion.descartePerdida) : "",
          observaciones: recoleccion.observaciones || "",
        }
      : { ...FORM_VACIO, tipos: tiposVacios(), fecha: obtenerFechaHoy(), hora: obtenerHoraAhora() }
  );
  const [saving, setSaving] = useState(false);

  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  const huevosPorBandeja = constantes?.huevosPorBandeja ?? 12;

  const clasificados = sumarTiposHuevo(form.tipos);
  const perdida = Number(form.perdida) || 0;
  const huevosTotales = clasificados + perdida;

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

  const handleTipoChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, tipos: { ...prev.tipos, [name]: value } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (huevosTotales <= 0) {
      Swal.fire(
        "Faltan huevos",
        "Cargá la recolección del día en alguno de los tipos o en el descarte.",
        "warning"
      );
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
          tipos: tiposANumeros(form.tipos),
          descartePerdida: perdida,
          observaciones: form.observaciones || undefined,
        });
      } else {
        await crearRecoleccionHuevos({
          lote: lote._id,
          fecha: ajustarFechaParaGuardar(form.fecha),
          hora: form.hora || undefined,
          tipos: tiposANumeros(form.tipos),
          descartePerdida: perdida,
          observaciones: form.observaciones || undefined,
        });
      }
      await onHecho();
      Swal.fire({
        icon: "success",
        title: edicion ? "Recolección corregida" : "Recolección cargada",
        text:
          `${formatearNumero(clasificados)} clasificados · ${formatearNumero(perdida)} descarte — ` +
          `quedan en la granja hasta que salgan por remito`,
        timer: 2600,
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

                <h6 className="fw-bold text-secondary mb-2">
                  Huevos recolectados
                  <span className="text-muted fw-normal small ms-2">
                    clasificados como van a viajar en el remito
                  </span>
                </h6>

                <div className="row g-3 mb-3">
                  {TIPOS_HUEVO.map((tipo) => {
                    const cantidad = Number(form.tipos[tipo.key]) || 0;
                    return (
                      <div className="col-6 col-lg-3" key={tipo.key}>
                        <div className="border rounded p-3 h-100">
                          <div className="fw-semibold mb-2">
                            <i className={`bi ${tipo.icono} ${tipo.clase} me-1`}></i>
                            {tipo.label}
                          </div>
                          <label className="form-label fw-semibold small">Huevos (unidades)</label>
                          <input
                            type="number"
                            name={tipo.key}
                            className="form-control"
                            min="0"
                            value={form.tipos[tipo.key]}
                            onChange={handleTipoChange}
                            placeholder="0"
                          />
                          <div className="form-text">
                            {cantidad > 0
                              ? textoDesglose(cantidad, huevosPorCajon, huevosPorBandeja)
                              : tipo.ayuda}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="row g-3 mb-3">
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
                        Rotos y cualquier otro motivo. Se tiran en la granja: no generan stock
                        ni viajan en el remito.
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
                      {TIPOS_HUEVO.map((tipo) => (
                        <div className="col-md-6" key={tipo.key}>
                          <strong>{tipo.label}:</strong>{" "}
                          {formatearNumero(Number(form.tipos[tipo.key]) || 0)}
                          {tipo.key === "api" && (
                            <span className="text-muted">
                              {" "}
                              ({formatearPorcentaje(
                                ((Number(form.tipos.api) || 0) / huevosTotales) * 100
                              )})
                            </span>
                          )}
                        </div>
                      ))}
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
    const sumarTipo = (tipo) => delDia.reduce((s, r) => s + (r.tipos?.[tipo] || 0), 0);
    const hoyResumen = delDia.length
      ? {
          pasadas: delDia.length,
          huevosTotales: sumar("huevosTotales"),
          descartePerdida: sumar("descartePerdida"),
          porTipo: TIPOS_HUEVO_KEYS.reduce(
            (acc, k) => ({ ...acc, [k]: sumarTipo(k) }),
            {}
          ),
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
  // Excel: el historial entero, no solo la página. Los porcentajes van con el
  // mismo número que muestra la pantalla (85,3 = 85,3%), no como fracción.
  const exportarExcel = () => exportarTablaExcel({
    filas: recolecciones,
    nombreHoja: "Recolecciones",
    nombreArchivo: "Reproductoras_recoleccion",
    columnas: [
      { header: "Fecha",              valor: (r) => formatearFechaLocal(r.fecha) },
      { header: "Hora",               valor: (r) => formatearHoraLocal(r.fechaHora || r.createdAt) },
      { header: "Plantel",            valor: (r) => r.lote?.numeroLote ?? "" },
      { header: "Galpón",             valor: (r) => r.galpon ?? "" },
      { header: "Sem. producción",    valor: (r) => r.semanaProduccion ?? "" },
      { header: "Sem. vida",          valor: (r) => r.semanaVida ?? "" },
      { header: "Total huevos",       valor: (r) => r.huevosTotales ?? 0 },
      ...TIPOS_HUEVO.map((t) => ({
        header: t.label,
        valor: (r) => r.tipos?.[t.key] ?? 0,
      })),
      { header: "Descarte pérdida",   valor: (r) => r.descartePerdida || 0 },
      { header: "Fertilidad (%)",     valor: (r) => r.porcentajeFertilidad ?? "" },
      { header: "Postura (%)",        valor: (r) => r.porcentajeProduccion ?? "" },
      ...TIPOS_HUEVO.map((t) => ({
        header: `En granja ${t.corto}`,
        valor: (r) => r.disponibles?.[t.key] ?? 0,
      })),
      { header: "Observaciones",      valor: (r) => r.observaciones },
    ],
  });


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
                                  {TIPOS_HUEVO.filter((t) => hoyResumen.porTipo[t.key] > 0).map(
                                    (t) => (
                                      <span key={t.key}>
                                        <span className={t.clase}>
                                          {formatearNumero(hoyResumen.porTipo[t.key])} {t.corto}
                                        </span>{" "}
                                        ·{" "}
                                      </span>
                                    )
                                  )}
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

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-secondary mb-0">Historial</h5>
              <BotonExcel
                onClick={exportarExcel}
                disabled={recolecciones.length === 0}
                titulo="Descargar el historial de recolecciones"
              />
            </div>
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
                          {TIPOS_HUEVO.map((t) => (
                            <th className="text-end" key={t.key} title={t.label}>
                              {t.corto}
                            </th>
                          ))}
                          <th className="text-end">Descarte</th>
                          <th className="text-end">% fert.</th>
                          <th className="text-end">% postura</th>
                          <th className="text-end" title="Huevos que siguen en la granja, sin remitir">
                            En granja
                          </th>
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
                            {TIPOS_HUEVO.map((t) => (
                              <td className={`text-end ${t.clase}`} key={t.key}>
                                {formatearNumero(r.tipos?.[t.key] || 0)}
                              </td>
                            ))}
                            <td className="text-end text-danger">
                              {formatearNumero(r.descartePerdida || 0)}
                            </td>
                            <td className="text-end">{formatearPorcentaje(r.porcentajeFertilidad)}</td>
                            <td className="text-end">{formatearPorcentaje(r.porcentajeProduccion)}</td>
                            <td className="text-end">
                              {sumarTiposHuevo(r.disponibles) > 0 ? (
                                <span
                                  className="badge bg-info text-dark"
                                  title="Sin remitir: siguen en la granja"
                                >
                                  {formatearNumero(sumarTiposHuevo(r.disponibles))}
                                </span>
                              ) : (
                                <span className="text-muted small">todo remitido</span>
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
                          {TIPOS_HUEVO.map((t) => (
                            <div className="col-6" key={t.key}>
                              <span className="text-muted">{t.label}:</span>{" "}
                              <strong className={t.clase}>
                                {formatearNumero(r.tipos?.[t.key] || 0)}
                              </strong>
                            </div>
                          ))}
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
                          <div className="col-12">
                            <span className="text-muted">En la granja (sin remitir):</span>{" "}
                            <strong>{formatearNumero(sumarTiposHuevo(r.disponibles))}</strong>
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
