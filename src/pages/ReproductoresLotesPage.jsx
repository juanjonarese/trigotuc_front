import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import HistorialReproductor from "../components/HistorialReproductor";
import MudanzaPosturaModal from "../components/MudanzaPosturaModal";
import {
  obtenerConstantesReproductores,
  obtenerLotesReproductores,
  obtenerResumenProduccion,
  enviarPlantelAFaena,
  sacarSinDestino,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import {
  formatearNumero,
  formatearPorcentaje,
  textoDesglose,
  ESTADO_LOTE,
  SECTOR_LABEL,
  nombreGalpon,
  TIPOS_HUEVO,
  TIPOS_HUEVO_VENTA,
  sumarIncubables,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

// ── Semáforo de las tarjetas ────────────────────────────────────────────────
// Cada tramo se mide contra sí mismo, no contra las 65 semanas del ciclo de
// vida: en recría lo que importa es cuánto falta para mudar a postura, y en
// postura cuánto le queda de vida útil al plantel. Mismo criterio visual que los
// galpones de Granja: fondo tintado y barra de progreso, con el color escalando
// a medida que se acerca el final del tramo. El estado nunca va por color solo
// — siempre lleva ícono y texto.
const PALETA = {
  ok:      { bg: "#f0fdf4", border: "#16a34a", badge: null },
  aviso:   { bg: "#fefce8", border: "#ca8a04", badge: "bg-warning text-dark" },
  ultima:  { bg: "#fff7ed", border: "#ea580c", badge: "bg-warning text-dark" },
  vencido: { bg: "#fef2f2", border: "#dc2626", badge: "bg-danger" },
  espera:  { bg: "#eff6ff", border: "#2563eb", badge: "bg-primary" },
};

const RECRIA_CONFIG = {
  encurso:  { ...PALETA.ok,      icono: null,                           label: null },
  proxima:  { ...PALETA.aviso,   icono: "bi-hourglass-split",           label: null }, // el label se arma con las semanas que faltan
  lista:    { ...PALETA.ultima,  icono: "bi-star-fill",                 label: "Última semana de recría — mudar a postura" },
  atrasada: { ...PALETA.vencido, icono: "bi-exclamation-triangle-fill", label: "Pasó el tiempo de recría — mudar ya" },
};

const POSTURA_CONFIG = {
  espera:   { ...PALETA.espera,  icono: "bi-hourglass-split",           label: null }, // el label se arma con las semanas que faltan
  encurso:  { ...PALETA.ok,      icono: null,                           label: null },
  proxima:  { ...PALETA.aviso,   icono: "bi-hourglass-split",           label: null }, // idem
  ultima:   { ...PALETA.ultima,  icono: "bi-star-fill",                 label: "Última semana de postura — programar la baja del plantel" },
  vencida:  { ...PALETA.vencido, icono: "bi-exclamation-triangle-fill", label: "Pasó el ciclo de vida — dar de baja el plantel" },
};

// Semanas antes del final del tramo en las que la tarjeta empieza a avisar.
const SEMANAS_AVISO = 3;

// semanaMudanza = primera semana de postura (24) ⇒ la recría termina en la 23.
const estadoRecria = (semana, semanaMudanza) => {
  const ultimaSemana = semanaMudanza - 1;
  if (semana > ultimaSemana)                   return "atrasada";
  if (semana === ultimaSemana)                 return "lista";
  if (semana >= ultimaSemana - SEMANAS_AVISO)  return "proxima";
  return "encurso";
};

// El plantel puede estar mudado a postura y todavía no haber llegado a la semana en
// que arranca a poner: ese caso se marca aparte ("espera").
const estadoPostura = (semana, semanaInicio, semanaFin) => {
  if (semana < semanaInicio)                return "espera";
  if (semana > semanaFin)                   return "vencida";
  if (semana === semanaFin)                 return "ultima";
  if (semana >= semanaFin - SEMANAS_AVISO)  return "proxima";
  return "encurso";
};

// ── Modal: detalle de producción del plantel ────────────────────────────────
const ProduccionModal = ({ lote, constantes, onClose }) => {
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setResumen(await obtenerResumenProduccion(lote._id));
      } catch (err) {
        Swal.fire("Error", err.message || "No se pudo cargar la producción.", "error");
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [lote._id, onClose]);

  const cajon = constantes?.huevosPorCajon;
  const bandeja = constantes?.huevosPorBandeja;

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-graph-up me-2"></i>Producción — plantel #{lote.numeroLote}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-success"></div>
                </div>
              ) : !resumen ? null : (
                <>
                  <div className="row g-2 mb-4">
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center h-100">
                        <div className="text-muted small">Huevos totales</div>
                        <div className="fw-bold">{formatearNumero(resumen.totales.huevosTotales)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          {textoDesglose(resumen.totales.huevosTotales, cajon, bandeja)}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center h-100">
                        <div className="text-muted small">API (incubable)</div>
                        <div className="fw-bold text-success">
                          {formatearNumero(sumarIncubables(resumen.totales.porTipo))}
                        </div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          fertilidad {formatearPorcentaje(resumen.totales.porcentajeFertilidad)}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center h-100">
                        <div className="text-muted small">A venta</div>
                        <div className="fw-bold text-warning">
                          {formatearNumero(
                            TIPOS_HUEVO_VENTA.reduce(
                              (acc, k) => acc + (resumen.totales.porTipo?.[k] || 0),
                              0
                            )
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          {TIPOS_HUEVO.filter((t) => !t.incubable)
                            .map((t) => t.label.toLowerCase())
                            .join(" + ")}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center h-100">
                        <div className="text-muted small">Descarte</div>
                        <div className="fw-bold text-danger">
                          {formatearNumero(resumen.totales.descartePerdida)}
                        </div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          rotos y otros
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center h-100">
                        <div className="text-muted small">Promedio diario</div>
                        <div className="fw-bold">{formatearNumero(resumen.totales.promedioDiario)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          {resumen.totales.dias} día{resumen.totales.dias === 1 ? "" : "s"} cargado
                          {resumen.totales.dias === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <h6 className="fw-bold text-secondary mb-2">Por semana de producción</h6>
                  {resumen.semanas.length === 0 ? (
                    <p className="text-muted small mb-0">
                      Todavía no hay recolecciones cargadas para este plantel.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Sem. prod.</th>
                            <th>Sem. vida</th>
                            <th className="text-end">Días</th>
                            <th className="text-end">Huevos</th>
                            <th className="text-end">Prom./día</th>
                            <th className="text-end">% postura</th>
                            <th className="text-end">% fertilidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumen.semanas.map((s) => (
                            <tr key={s.semanaProduccion}>
                              <td className="fw-semibold">{s.semanaProduccion}</td>
                              <td>{s.semanaVida}</td>
                              <td className="text-end">{s.dias}</td>
                              <td className="text-end">{formatearNumero(s.huevosTotales)}</td>
                              <td className="text-end">{formatearNumero(s.promedioDiario)}</td>
                              <td className="text-end">{formatearPorcentaje(s.porcentajeProduccion)}</td>
                              <td className="text-end">{formatearPorcentaje(s.porcentajeFertilidad)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: datos semanales cargados del galpón (solo lectura) ───────────────
const DatosGalponModal = ({ lote, galponLabel, constantes, onClose }) => {
  const semanasCiclo = constantes?.semanasCicloVida ?? 65;
  const bajasHembras = (lote.mortandad || [])
    .filter((m) => m.sexo === "hembra")
    .reduce((s, m) => s + m.cantidad, 0);
  const bajasMachos = (lote.mortandad || [])
    .filter((m) => m.sexo === "macho")
    .reduce((s, m) => s + m.cantidad, 0);

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <div>
              <h5 className="modal-title mb-0">
                {galponLabel} — Plantel #{lote.numeroLote}
              </h5>
              <div className="small mt-1 opacity-75">
                Ingreso: {formatearFechaLocal(lote.fechaIngreso)} · Semana{" "}
                {lote.semanaVida ?? "?"}/{semanasCiclo} ·{" "}
                {formatearNumero(lote.hembras?.actual)} hembras /{" "}
                {formatearNumero(lote.machos?.actual)} machos
              </div>
            </div>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            <div className="row g-2 mb-3">
              <div className="col-6 col-md-3">
                <div className="border rounded p-2 text-center h-100">
                  <div className="text-muted small">Hembras activas</div>
                  <div className="fw-bold">{formatearNumero(lote.hembras?.actual)}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded p-2 text-center h-100">
                  <div className="text-muted small">Machos activos</div>
                  <div className="fw-bold">{formatearNumero(lote.machos?.actual)}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded p-2 text-center h-100">
                  <div className="text-muted small">Bajas hembras</div>
                  <div className="fw-bold text-danger">{formatearNumero(bajasHembras)}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="border rounded p-2 text-center h-100">
                  <div className="text-muted small">Bajas machos</div>
                  <div className="fw-bold text-danger">{formatearNumero(bajasMachos)}</div>
                </div>
              </div>
            </div>

            <HistorialReproductor lote={lote} />
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
// Cada sexo es un botón grande: se toca uno y sale entero. Deshabilitado si de
// ese sexo ya no queda nada en el galpón.
const OpcionSexo = ({ valor, titulo, disponibles, elegido, onElegir, disabled }) => (
  <button
    type="button"
    className={`btn w-100 text-start p-3 ${elegido === valor ? "btn-danger" : "btn-outline-secondary"}`}
    onClick={() => onElegir(valor)}
    disabled={disabled || disponibles <= 0}
  >
    <div className="fw-bold">{titulo}</div>
    <div className={elegido === valor ? "" : "text-muted"}>
      {disponibles > 0 ? `${formatearNumero(disponibles)} en el galpón` : "no quedan en el galpón"}
    </div>
  </button>
);

// ── Modal: enviar a faena ───────────────────────────────────────────────────
// El plantel se levanta POR TANDAS, igual que Granja (cliente, 2026-09-29): se
// elige el sexo y cuántas salen esta vez, y el galpón queda con el resto para
// las próximas. Gallinas y gallos viajan separados.
//
// A diferencia de Granja no hay reserva: el galpón se descuenta en el acto,
// porque el que emite la orden es la misma granja y las aves ya suben al camión.
//
// Vaciar el galpón al final —con los gallos cuyo destino no se definió— es otra
// acción, con su propio botón en la tarjeta del plantel.
const EnviarAFaenaModal = ({ lote, onClose, onHecho }) => {
  const [sexo, setSexo] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const hembras = lote.hembras?.actual || 0;
  const machos  = lote.machos?.actual  || 0;
  const disponible = sexo === "hembra" ? hembras : sexo === "macho" ? machos : 0;

  const salen = Number(cantidad) || 0;
  const invalida = salen <= 0 || salen > disponible;
  const restan = disponible - salen;
  const aves = sexo === "hembra" ? "gallinas" : "gallos";

  // Cambiar de sexo limpia la cantidad: el tope es otro.
  const elegirSexo = (v) => { setSexo(v); setCantidad(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sexo || invalida) return;

    const confirma = await Swal.fire({
      icon: "warning",
      title: `¿Enviar ${formatearNumero(salen)} ${aves} a faena?`,
      html:
        `Salen del galpón del plantel #${lote.numeroLote} en el acto.` +
        (restan > 0
          ? `<br/><span class="text-muted">Quedan ${formatearNumero(restan)} ${aves} para las próximas tandas.</span>`
          : `<br/><span class="text-muted">Con esta tanda no quedan más ${aves} en el galpón.</span>`),
      showCancelButton: true,
      confirmButtonText: "Sí, enviar a faena",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
    });
    if (!confirma.isConfirmed) return;

    setSaving(true);
    try {
      const orden = await enviarPlantelAFaena({
        loteReproductor: lote._id,
        sexo,
        cantidad: salen,
        fechaEmision: fecha,
      });

      await onHecho();
      Swal.fire({
        icon: "success",
        title: `Orden ${orden.numero}`,
        html:
          `<strong class="fs-4">${formatearNumero(orden.cantidadEstimada)}</strong> ${aves} ` +
          `en camino al frigorífico.` +
          (restan > 0
            ? `<br/><span class="text-muted">Quedan ${formatearNumero(restan)} ${aves} en el galpón.</span>`
            : ""),
        confirmButtonText: "Listo",
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo emitir la orden.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-danger text-white py-2">
              <h5 className="modal-title fs-6">
                <i className="bi bi-truck me-2"></i>
                Enviar a faena — plantel #{lote.numeroLote}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="d-flex flex-column flex-grow-1"
              style={{ minHeight: 0 }}
            >
              <div className="modal-body">
                <p className="small text-muted">
                  El plantel se levanta <strong>por tandas</strong>: elegí qué sale y cuántas
                  esta vez. Lo que quede se manda en los viajes siguientes.
                </p>

                <div className="d-grid gap-2 mb-3">
                  <OpcionSexo
                    valor="hembra" titulo="Gallinas" disponibles={hembras}
                    elegido={sexo} onElegir={elegirSexo} disabled={saving}
                  />
                  <OpcionSexo
                    valor="macho" titulo="Gallos" disponibles={machos}
                    elegido={sexo} onElegir={elegirSexo} disabled={saving}
                  />
                </div>

                {sexo && (
                  <>
                    <label className="form-label fw-semibold small mb-1">
                      ¿Cuántas {aves} salen en esta tanda?
                    </label>
                    <div className="input-group input-group-sm mb-1">
                      <input
                        type="number"
                        className={`form-control ${cantidad !== "" && invalida ? "is-invalid" : ""}`}
                        min="1"
                        max={disponible}
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        disabled={saving}
                        placeholder="0"
                        autoFocus
                      />
                      {/* Para la última tanda, que es cuando se lleva lo que queda. */}
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setCantidad(String(disponible))}
                        disabled={saving}
                        title="Llevar todo lo que queda en el galpón"
                      >
                        Todo
                      </button>
                    </div>
                    <div className="form-text mb-3">
                      Hay {formatearNumero(disponible)} {aves} en el galpón.
                    </div>
                  </>
                )}

                <label className="form-label fw-semibold small mb-1">Fecha de salida</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  disabled={saving}
                  required
                />

                {sexo && salen > 0 && (
                  <div className={`alert py-2 mt-3 mb-0 small ${invalida ? "alert-danger" : "alert-warning"}`}>
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    {invalida ? (
                      <>
                        En el galpón hay <strong>{formatearNumero(disponible)}</strong> {aves}: no
                        se pueden sacar {formatearNumero(salen)}.
                      </>
                    ) : (
                      <>
                        Salen <strong>{formatearNumero(salen)}</strong> {aves} del galpón.{" "}
                        {restan > 0
                          ? `Quedan ${formatearNumero(restan)} para las próximas tandas.`
                          : `Con esta no quedan más ${aves}.`}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={saving || !sexo || invalida}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-truck me-1"></i>Enviar a faena
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

const ReproductoresLotesPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verFinalizados, setVerFinalizados] = useState(false);
  const [mudanzaLote, setMudanzaLote] = useState(null);
  const [produccionLote, setProduccionLote] = useState(null);
  const [datosLote, setDatosLote] = useState(null);
  const [faenaLote, setFaenaLote] = useState(null);

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
      Swal.fire("Error", err.message || "No se pudieron cargar los galpones.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /**
   * Cierra el plantel sacando del galpón lo que haya quedado, SIN destino
   * definido. Es lo último del ciclo: las tandas ya se levantaron y queda el
   * resto — hoy, los gallos, cuyo destino todavía no se decidió.
   *
   * No emite orden de carga ni mueve stock de cámara: solo vacía y deja anotado
   * cuántas aves salieron, para ir a buscarlas cuando se defina qué se hace.
   */
  const vaciarGalpon = async (lote) => {
    const hembras = lote.hembras?.actual || 0;
    const machos  = lote.machos?.actual  || 0;
    const partes = [
      hembras > 0 ? `${formatearNumero(hembras)} gallinas` : null,
      machos  > 0 ? `${formatearNumero(machos)} gallos`    : null,
    ].filter(Boolean);

    const { value: motivo, isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Vaciar el galpón del plantel #${lote.numeroLote}?`,
      html:
        `Salen <strong>${partes.join(" y ")}</strong> del galpón y el plantel queda finalizado.` +
        `<br/><span class="text-muted">Quedan anotadas como <u>sin destino definido</u>, ` +
        `para ir a buscarlas cuando se decida qué se hace con ellas.</span>`,
      input: "text",
      inputPlaceholder: "Por qué se vacía (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, vaciar y cerrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#6c757d",
    });
    if (!isConfirmed) return;

    const fecha = new Date().toISOString().slice(0, 10);
    const observaciones = motivo || "Se vació el galpón al cerrar el ciclo; destino a definir";

    // Los dos sexos son dos llamadas: si la segunda falla, la primera ya salió y
    // hay que decirlo en vez de dejar creer que se vació entero.
    const errores = [];
    for (const [sexo, cuantas] of [["hembra", hembras], ["macho", machos]]) {
      if (cuantas <= 0) continue;
      try {
        await sacarSinDestino(lote._id, { sexo, fecha, observaciones });
      } catch (err) {
        errores.push(`${sexo === "hembra" ? "Gallinas" : "Gallos"}: ${err.message}`);
      }
    }

    await cargar();
    if (errores.length) {
      Swal.fire("El galpón no quedó vacío", errores.join("<br/>"), "error");
    } else {
      Swal.fire({
        icon: "success",
        title: "Galpón vacío",
        text: `El plantel #${lote.numeroLote} quedó finalizado.`,
        timer: 2500,
        showConfirmButton: false,
      });
    }
  };

  const semanasCiclo = constantes?.semanasCicloVida ?? 65;
  const semanaPostura = constantes?.semanaInicioPostura ?? 24;

  // Un galpón por tarjeta: si tiene plantel activo lo muestra, si no queda libre.
  const tarjetasSector = (sector) => {
    const galpones = constantes?.galpones?.[sector] || [];
    return galpones.map((g) => ({
      galpon: g,
      lote: lotes.find(
        (l) => l.sector === sector && l.galpon === g.numero && l.estado !== "finalizado"
      ),
    }));
  };

  const finalizados = lotes.filter((l) => l.estado === "finalizado");

  const renderTarjeta = ({ galpon, lote }, sector) => {
    if (!lote) {
      return (
        <div className="col-12 col-md-6 col-xl-3" key={`${sector}-${galpon.numero}`}>
          <div className="card shadow-sm h-100" style={{ borderStyle: "dashed" }}>
            <div className="card-body text-center text-muted py-4">
              <i className="bi bi-door-open fs-2 d-block mb-2"></i>
              <div className="fw-semibold">{galpon.nombre}</div>
              <small>Galpón libre</small>
            </div>
          </div>
        </div>
      );
    }

    const estado = ESTADO_LOTE[lote.estado] || {};
    const semana = lote.semanaVida ?? 0;
    const esRecria = lote.sector === "recria";

    // Cada tramo se mide contra sí mismo: recría va de la semana 1 a la
    // semanaPostura - 1, y postura de la semanaPostura a la última del ciclo.
    const semanasRecria  = semanaPostura - 1;
    const semanasPostura = semanasCiclo - semanaPostura + 1;

    const tope = esRecria ? semanasRecria : semanasPostura;
    // En postura la semana se cuenta desde el inicio de la postura, no desde el
    // ingreso: "semana 5 de postura" es la lectura que usa el cliente.
    const semanaTramo = esRecria ? semana : Math.max(0, semana - semanaPostura + 1);
    const progreso = Math.min(100, Math.round((semanaTramo / tope) * 100));

    const nivel = esRecria
      ? estadoRecria(semana, semanaPostura)
      : estadoPostura(semana, semanaPostura, semanasCiclo);
    const cfg = esRecria ? RECRIA_CONFIG[nivel] : POSTURA_CONFIG[nivel];

    // Los estados de cuenta regresiva arman su texto con las semanas que faltan.
    const faltanParaPoner = semanaPostura - semana;
    const faltanParaFin   = semanasCiclo - semana;
    const plural = (n) => `${n} semana${n === 1 ? "" : "s"}`;
    const aviso =
      nivel === "espera"  ? `Empieza a poner en ${plural(faltanParaPoner)}`
      : nivel === "proxima"
        ? esRecria
          ? `Mudanza a postura en ${plural(faltanParaPoner)}`
          : `Fin del ciclo en ${plural(faltanParaFin)}`
        : cfg?.label;

    const barColor = cfg.border;

    return (
      <div className="col-12 col-md-6 col-xl-3" key={`${sector}-${galpon.numero}`}>
        <div className="card shadow-sm h-100" style={{ background: cfg.bg }}>
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-bold">{galpon.nombre}</span>
            <span className={`badge ${estado.clase}`}>{estado.label}</span>
          </div>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <span className="fw-bold">Plantel #{lote.numeroLote}</span>
              <small className="text-muted">
                Semana {semanaTramo}/{tope} de {esRecria ? "recría" : "postura"}
              </small>
            </div>

            <div className={`progress ${aviso ? "mb-2" : "mb-3"}`} style={{ height: "6px" }}>
              <div
                className="progress-bar"
                style={{ width: `${progreso}%`, background: barColor, transition: "width .4s ease" }}
              ></div>
            </div>

            {/* El estado va con ícono y texto, nunca color solo. */}
            {aviso && (
              <div className="mb-3">
                <span className={`badge ${cfg.badge}`} style={{ whiteSpace: "normal" }}>
                  <i className={`bi ${cfg.icono} me-1`}></i>
                  {aviso}
                </span>
              </div>
            )}

            <div className="row g-2 small mb-3">
              <div className="col-6">
                <div className="border rounded p-2 text-center">
                  <div className="text-muted" style={{ fontSize: ".75rem" }}>
                    Hembras
                  </div>
                  <div className="fw-bold">{formatearNumero(lote.hembras?.actual)}</div>
                </div>
              </div>
              <div className="col-6">
                <div className="border rounded p-2 text-center">
                  <div className="text-muted" style={{ fontSize: ".75rem" }}>
                    Machos
                  </div>
                  <div className="fw-bold">{formatearNumero(lote.machos?.actual)}</div>
                </div>
              </div>
            </div>

            <div className="small text-muted mb-3">
              <div>
                <i className="bi bi-calendar3 me-1"></i>Ingreso:{" "}
                {formatearFechaLocal(lote.fechaIngreso)}
              </div>
              {lote.fechaInicioPostura && (
                <div>
                  <i className="bi bi-egg me-1"></i>En postura desde:{" "}
                  {formatearFechaLocal(lote.fechaInicioPostura)}
                </div>
              )}
              {/* "Empieza a poner en N semanas" ahora lo dice el badge de arriba. */}
            </div>

            <div className="d-grid gap-2">
              <button className="btn btn-sm btn-outline-primary" onClick={() => setDatosLote(lote)}>
                <i className="bi bi-clipboard-data me-1"></i>Ver datos semanales
              </button>
              {lote.sector === "recria" && (
                <button className="btn btn-sm btn-primary" onClick={() => setMudanzaLote(lote)}>
                  <i className="bi bi-arrow-right-circle me-1"></i>Mudar a postura
                </button>
              )}
              {lote.sector === "postura" && (
                <button className="btn btn-sm btn-outline-success" onClick={() => setProduccionLote(lote)}>
                  <i className="bi bi-graph-up me-1"></i>Ver producción
                </button>
              )}
              {/* Al fin de ciclo las aves se faenan. El botón se destaca recién
                  cuando el plantel llegó al final: antes existe igual (puede
                  levantarse por sanidad) pero sin gritar. */}
              {lote.sector === "postura" && (lote.hembras?.actual > 0 || lote.machos?.actual > 0) && (
                <button
                  className={`btn btn-sm ${faltanParaFin <= 0 ? "btn-danger" : "btn-outline-danger"}`}
                  onClick={() => setFaenaLote(lote)}
                >
                  <i className="bi bi-truck me-1"></i>Enviar a faena
                </button>
              )}
              {/* Cerrar el plantel cuando ya se levantaron las tandas. Sale lo que
                  quede aunque su destino no esté definido (hoy, los gallos): si no,
                  el galpón nunca queda vacío. Va aparte del envío a faena porque
                  es otra cosa — acá no se emite ninguna orden. */}
              {lote.sector === "postura" && (lote.hembras?.actual > 0 || lote.machos?.actual > 0) && (
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => vaciarGalpon(lote)}
                >
                  <i className="bi bi-box-arrow-right me-1"></i>Vaciar galpón y cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-list-ul text-success me-2"></i>Galpones Reproductores
            </h1>
            <p className="text-muted mb-0 small">
              Recría de {semanaPostura - 1} semanas, postura desde la semana {semanaPostura} —
              ciclo de vida de {semanasCiclo} semanas
            </p>
          </div>
          <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : (
          <>
            <h5 className="fw-bold text-secondary mb-3">
              <i className="bi bi-house me-1"></i>{SECTOR_LABEL.recria}
            </h5>
            <div className="row g-3 mb-4">
              {tarjetasSector("recria").map((t) => renderTarjeta(t, "recria"))}
            </div>

            <h5 className="fw-bold text-secondary mb-3">
              <i className="bi bi-egg me-1"></i>{SECTOR_LABEL.postura}
            </h5>
            <div className="row g-3 mb-4">
              {tarjetasSector("postura").map((t) => renderTarjeta(t, "postura"))}
            </div>

            {finalizados.length > 0 && (
              <div className="card shadow-sm">
                <div
                  className="card-header bg-white d-flex justify-content-between align-items-center"
                  role="button"
                  onClick={() => setVerFinalizados(!verFinalizados)}
                >
                  <span className="fw-bold text-muted">
                    <i className="bi bi-archive me-1"></i>Planteles finalizados ({finalizados.length})
                  </span>
                  <i className={`bi bi-chevron-${verFinalizados ? "up" : "down"}`}></i>
                </div>
                {verFinalizados && (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Plantel</th>
                          <th>Último galpón</th>
                          <th>Ingreso</th>
                          <th>Egreso</th>
                          <th>Motivo</th>
                          <th className="text-end">Aves al cierre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalizados.map((l) => (
                          <tr key={l._id}>
                            <td className="fw-semibold">#{l.numeroLote}</td>
                            <td>{nombreGalpon(constantes?.galpones, l.sector, l.galpon)}</td>
                            <td>{formatearFechaLocal(l.fechaIngreso)}</td>
                            <td>{l.egreso ? formatearFechaLocal(l.egreso.fecha) : "-"}</td>
                            <td>{l.egreso?.motivo || "-"}</td>
                            <td className="text-end">
                              {l.egreso
                                ? `${formatearNumero(l.egreso.hembras)} H / ${formatearNumero(l.egreso.machos)} M`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {mudanzaLote && (
        <MudanzaPosturaModal
          lote={mudanzaLote}
          constantes={constantes}
          lotes={lotes}
          onClose={() => setMudanzaLote(null)}
          onHecho={() => {
            setMudanzaLote(null);
            cargar();
          }}
        />
      )}
      {produccionLote && (
        <ProduccionModal
          lote={produccionLote}
          constantes={constantes}
          onClose={() => setProduccionLote(null)}
        />
      )}
      {datosLote && (
        <DatosGalponModal
          lote={datosLote}
          galponLabel={nombreGalpon(constantes?.galpones, datosLote.sector, datosLote.galpon)}
          constantes={constantes}
          onClose={() => setDatosLote(null)}
        />
      )}
      {faenaLote && (
        <EnviarAFaenaModal
          lote={faenaLote}
          onClose={() => setFaenaLote(null)}
          onHecho={async () => {
            setFaenaLote(null);
            await cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default ReproductoresLotesPage;
