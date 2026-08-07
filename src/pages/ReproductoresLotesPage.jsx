import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import HistorialReproductor from "../components/HistorialReproductor";
import MudanzaPosturaModal from "../components/MudanzaPosturaModal";
import {
  obtenerConstantesReproductores,
  obtenerLotesReproductores,
  obtenerResumenProduccion,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import {
  formatearNumero,
  formatearPorcentaje,
  textoDesglose,
  ESTADO_LOTE,
  SECTOR_LABEL,
  nombreGalpon,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

// ── Modal: detalle de producción del lote ───────────────────────────────────
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
                <i className="bi bi-graph-up me-2"></i>Producción — lote #{lote.numeroLote}
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
                        <div className="text-muted small">A incubar</div>
                        <div className="fw-bold text-success">
                          {formatearNumero(resumen.totales.inoculables)}
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
                          {formatearNumero(resumen.totales.descarte1)}
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
                      Todavía no hay recolecciones cargadas para este lote.
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
                {galponLabel} — Lote #{lote.numeroLote}
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
const ReproductoresLotesPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verFinalizados, setVerFinalizados] = useState(false);
  const [mudanzaLote, setMudanzaLote] = useState(null);
  const [produccionLote, setProduccionLote] = useState(null);
  const [datosLote, setDatosLote] = useState(null);

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

  const semanasCiclo = constantes?.semanasCicloVida ?? 65;
  const semanaPostura = constantes?.semanaInicioPostura ?? 24;

  // Un galpón por tarjeta: si tiene lote activo muestra el lote, si no queda libre.
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
    const progreso = Math.min(100, Math.round((semana / semanasCiclo) * 100));
    const enProduccion = lote.sector === "postura" && semana >= semanaPostura;
    const faltanSemanas = semanaPostura - semana;

    return (
      <div className="col-12 col-md-6 col-xl-3" key={`${sector}-${galpon.numero}`}>
        <div className="card shadow-sm h-100">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-bold">{galpon.nombre}</span>
            <span className={`badge ${estado.clase}`}>{estado.label}</span>
          </div>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-baseline mb-2">
              <span className="fw-bold">Lote #{lote.numeroLote}</span>
              <small className="text-muted">
                Semana {semana}/{semanasCiclo}
              </small>
            </div>

            <div className="progress mb-3" style={{ height: "6px" }}>
              <div
                className={`progress-bar ${enProduccion ? "bg-success" : "bg-info"}`}
                style={{ width: `${progreso}%` }}
              ></div>
            </div>

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
              {lote.sector === "postura" && !enProduccion && faltanSemanas > 0 && (
                <div className="text-warning">
                  <i className="bi bi-hourglass-split me-1"></i>
                  Empieza a poner en {faltanSemanas} semana{faltanSemanas === 1 ? "" : "s"}
                </div>
              )}
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
              Recría y postura — ciclo de {semanasCiclo} semanas, postura desde la semana{" "}
              {semanaPostura}
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
                    <i className="bi bi-archive me-1"></i>Lotes finalizados ({finalizados.length})
                  </span>
                  <i className={`bi bi-chevron-${verFinalizados ? "up" : "down"}`}></i>
                </div>
                {verFinalizados && (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Lote</th>
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
    </Layout>
  );
};

export default ReproductoresLotesPage;
