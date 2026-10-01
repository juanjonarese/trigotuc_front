import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerConstantesAlimento,
  obtenerStockSilos,
  ajustarSilo,
  obtenerAjustesSilo,
  obtenerEnviosAlimento,
} from "../services/api";
import RecepcionAlimentoModal from "../components/RecepcionAlimentoModal";
import { formatearFechaLocal, obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmt = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

/**
 * Stock de alimento en los silos, y su ajuste contra el recuento real.
 *
 * ⚠️ El saldo que muestra esta pantalla es una ESTIMACIÓN: lo que entró se pesa,
 * pero el consumo se declara por semana. Por eso existe el ajuste — y por eso la
 * pantalla lo dice en voz alta en vez de mostrar el número como si fuera exacto.
 *
 * Desde el 2026-09-30 la RECEPCIÓN vive acá (antes era su propia página): el
 * alimento se recibe donde están los silos, y lo que se pesa al camión es lo que
 * entra. Las diferencias contra lo despachado quedan en el historial de abajo.
 */
const AlimentoSilosPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [stock, setStock] = useState(null);
  const [ajustes, setAjustes] = useState([]);
  const [enViaje, setEnViaje] = useState([]);
  const [recibidos, setRecibidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ajustando, setAjustando] = useState(null); // { silo, tipo?, kgSistema }
  const [recibiendo, setRecibiendo] = useState(null); // envío abierto para recibir

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, st, aj, viaje, rec] = await Promise.all([
        obtenerConstantesAlimento(),
        obtenerStockSilos("reproductoras"),
        obtenerAjustesSilo({ destino: "reproductoras", limite: 30 }),
        obtenerEnviosAlimento({ destino: "reproductoras", estado: "en_viaje" }),
        obtenerEnviosAlimento({ destino: "reproductoras", estado: "aceptado", limite: 30 }),
      ]);
      setConstantes(cons);
      setStock(st);
      setAjustes(aj);
      setEnViaje(viaje);
      setRecibidos(rec);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el stock de los silos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const tipos = constantes?.tipos || [];
  const etiquetaTipo = (key) => tipos.find((t) => t.key === key)?.etiqueta || key;

  return (
    <Layout>
      <div className="container-fluid py-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h4 className="mb-0">
              <i className="bi bi-database me-2"></i>Silos — {stock?.etiquetaDestino || "Reproductoras"}
            </h4>
            <div className="text-muted small">
              Entra por la recepción (lo que se pesa acá), sale por el consumo semanal.
            </div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
              <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
            </button>
            <button className="btn btn-warning" onClick={() => setAjustando({})}>
              <i className="bi bi-sliders me-1"></i>Ajustar por recuento
            </button>
          </div>
        </div>

        {/* El número es estimativo y la pantalla lo dice: el consumo se declara,
            no se mide, así que el saldo se despega con el tiempo. */}
        <div className="alert alert-light border py-2 small">
          <i className="bi bi-info-circle me-1"></i>
          Estos kg son <strong>estimativos</strong>: lo que entró se pesó, pero el consumo
          se carga por semana. Cuando midas un silo, usá <strong>Ajustar por recuento</strong> y
          queda registrado quién lo ajustó y por qué.
        </div>

        {loading ? (
          <div className="card shadow-sm"><div className="card-body text-center text-muted py-5">
            <span className="spinner-border spinner-border-sm me-2"></span>Cargando…
          </div></div>
        ) : (
          <>
            {/* ── Por recibir: lo despachado que todavía no entró a los silos ── */}
            {enViaje.length > 0 && (
              <div className="card shadow-sm mb-3 border-warning">
                <div className="card-header bg-warning-subtle py-2 fw-semibold">
                  <i className="bi bi-truck me-1"></i>
                  Por recibir ({enViaje.length})
                </div>
                <div className="list-group list-group-flush">
                  {enViaje.map((e) => (
                    <div
                      key={e._id}
                      className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
                    >
                      <div>
                        <div className="fw-semibold">
                          {e.numero}
                          <span className="text-muted fw-normal small">
                            {" "}· salió el {formatearFechaLocal(e.fechaEnvio)}
                            {e.numeroRemito && <> · remito {e.numeroRemito}</>}
                            {e.camion && <> · {e.camion.marca} {e.camion.patente}</>}
                          </span>
                        </div>
                        <div className="small text-muted">
                          {(e.lineas || [])
                            .map((l) =>
                              `${etiquetaTipo(l.tipo)} ` +
                              (l.presentacion === "bolsa"
                                ? `(${fmt(l.bolsas)} bolsas × ${fmt(l.kgPorBolsa)} kg)`
                                : `(${fmt(l.kg)} kg granel)`)
                            )
                            .join(" · ")}
                          {" — "}<strong>{fmt(e.kgTotales)} kg</strong> despachados
                        </div>
                      </div>
                      <button className="btn btn-success btn-sm" onClick={() => setRecibiendo(e)}>
                        <i className="bi bi-box-arrow-in-down me-1"></i>Recibir y pesar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card shadow-sm mb-3 border-primary">
              <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
                <div>
                  <span className="text-muted small me-2">Total en los silos</span>
                  <span className="fs-4 fw-bold">{fmt(stock?.kgTotal)}</span>
                  <span className="text-muted small"> de {fmt(stock?.capacidadTotalKg)} kg</span>
                </div>
                <div className="text-muted small">
                  {(stock?.silos || []).length} silos de {fmt(stock?.silos?.[0]?.capacidadKg)} kg
                </div>
              </div>
            </div>

            {/* Un bloque por galpón (o pareja): cada galpón come solo de sus silos,
                así que es la unidad con la que se decide cuándo mandar más. */}
            <div className="row g-3 mb-3">
              {(stock?.grupos || []).map((g) => (
                <div className="col-12 col-lg-6" key={g.clave}>
                  <div className="card shadow-sm h-100">
                    <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                      <span className="fw-bold">
                        <i className="bi bi-house me-1"></i>{g.nombre}
                      </span>
                      <span className="badge bg-primary">
                        {fmt(g.kg)} / {fmt(g.capacidadKg)} kg
                      </span>
                    </div>
                    <div className="card-body">
                      {g.proximo && (
                        <div className="alert alert-info py-1 px-2 small mb-2">
                          <i className="bi bi-arrow-down-circle me-1"></i>
                          Lo próximo que come: <strong>{etiquetaTipo(g.proximo.tipo)}</strong>{" "}
                          del silo {g.proximo.silo} ({fmt(g.proximo.kg)} kg)
                        </div>
                      )}
                      <div className="row g-2">
                        {(stock?.silos || [])
                          .filter((s) => g.silos.includes(s.silo))
                          .map((s) => {
                            const pct = s.capacidadKg ? Math.min(100, (s.kg / s.capacidadKg) * 100) : 0;
                            return (
                              <div className={g.silos.length > 1 ? "col-12 col-sm-6" : "col-12"} key={s.silo}>
                                <div className="border rounded p-2 h-100">
                                  <div className="d-flex justify-content-between align-items-baseline">
                                    <span className="fw-semibold small">{s.nombre}</span>
                                    <span className="small">
                                      <strong>{fmt(s.kg)}</strong>
                                      <span className="text-muted"> / {fmt(s.capacidadKg)} kg</span>
                                    </span>
                                  </div>
                                  <div className="progress my-1" style={{ height: 8 }}>
                                    <div
                                      className={`progress-bar ${pct >= 90 ? "bg-success" : pct <= 15 ? "bg-danger" : "bg-primary"}`}
                                      style={{ width: `${pct}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-muted mb-1" style={{ fontSize: ".72rem" }}>
                                    libre {fmt(s.libreKg)} kg
                                  </div>
                                  {s.tipos.length === 0 ? (
                                    <div className="text-muted small">Vacío</div>
                                  ) : (
                                    s.tipos.map((t) => (
                                      <div
                                        key={t.tipo}
                                        className="d-flex justify-content-between align-items-center border-top py-1"
                                      >
                                        <div>
                                          <div className="small fw-semibold">{t.etiqueta}</div>
                                          <div className="text-muted" style={{ fontSize: ".72rem" }}>
                                            desde {formatearFechaLocal(t.desde)}
                                          </div>
                                        </div>
                                        <div className="text-end">
                                          <div className="fw-semibold small">{fmt(t.kg)} kg</div>
                                          <button
                                            className="btn btn-link btn-sm p-0 text-decoration-none"
                                            style={{ fontSize: ".72rem" }}
                                            onClick={() => setAjustando({ silo: s.silo, tipo: t.tipo, kgSistema: t.kg })}
                                          >
                                            ajustar
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Recepciones: lo despachado contra lo que se pesó acá ── */}
            <div className="card shadow-sm mb-3">
              <div className="card-header bg-white py-2 fw-semibold">
                Recepciones
              </div>
              <div className="card-body p-0">
                {recibidos.length === 0 ? (
                  <div className="p-4 text-center text-muted small">
                    Todavía no se recibió ningún envío.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="small">Recibido</th>
                          <th className="small">Envío</th>
                          <th className="small">Qué</th>
                          <th className="small text-end">Despachado</th>
                          <th className="small text-end">Pesado</th>
                          <th className="small text-end">Diferencia</th>
                          <th className="small">Motivo</th>
                          <th className="small">Quién</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recibidos.map((e) => {
                          // Los recibidos antes del 2026-09-30 no tienen la diferencia
                          // guardada: se deriva para mostrarla igual.
                          const dif = e.diferenciaKg ?? (e.kgTotalesReales ?? 0) - (e.kgTotales ?? 0);
                          return (
                            <tr key={e._id}>
                              <td className="small">{formatearFechaLocal(e.fechaAcepta)}</td>
                              <td className="small fw-semibold">{e.numero}</td>
                              <td className="small">
                                {(e.lineas || []).map((l) => (
                                  <div key={l._id}>
                                    {etiquetaTipo(l.tipo)}
                                    {l.reparto?.length ? (
                                      <span className="text-muted">
                                        {" → "}{l.reparto.map((t) => `silo ${t.silo}`).join(" + ")}
                                      </span>
                                    ) : null}
                                  </div>
                                ))}
                              </td>
                              <td className="small text-end text-muted">{fmt(e.kgTotales)}</td>
                              <td className="small text-end fw-semibold">{fmt(e.kgTotalesReales)}</td>
                              <td
                                className={`small text-end fw-semibold ${
                                  dif === 0 ? "text-muted" : dif < 0 ? "text-danger" : "text-success"
                                }`}
                              >
                                {dif === 0 ? "—" : `${dif > 0 ? "+" : ""}${fmt(dif)}`}
                              </td>
                              <td className="small">{e.motivoDiferencia || ""}</td>
                              <td className="small text-muted">{e.aceptadoPor?.nombreUsuario || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Historial de ajustes: el rastro de las correcciones ── */}
            <div className="card shadow-sm">
              <div className="card-header bg-white py-2 fw-semibold">
                Ajustes registrados
              </div>
              <div className="card-body p-0">
                {ajustes.length === 0 ? (
                  <div className="p-4 text-center text-muted small">
                    Todavía no se ajustó ningún silo.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="small">Fecha</th>
                          <th className="small">Silo</th>
                          <th className="small">Tipo</th>
                          <th className="small text-end">Decía</th>
                          <th className="small text-end">Se contó</th>
                          <th className="small text-end">Diferencia</th>
                          <th className="small">Motivo</th>
                          <th className="small">Quién</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ajustes.map((a) => (
                          <tr key={a._id}>
                            <td className="small">{formatearFechaLocal(a.fecha)}</td>
                            <td className="small">Silo {a.silo}</td>
                            <td className="small">{etiquetaTipo(a.tipo)}</td>
                            <td className="small text-end text-muted">{fmt(a.kgSistema)}</td>
                            <td className="small text-end fw-semibold">{fmt(a.kgReal)}</td>
                            <td className={`small text-end fw-semibold ${a.diferencia < 0 ? "text-danger" : "text-success"}`}>
                              {a.diferencia > 0 ? "+" : ""}{fmt(a.diferencia)}
                            </td>
                            <td className="small">{a.motivo}</td>
                            <td className="small text-muted">{a.registradoPor?.nombreUsuario || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {ajustando && (
        <AjusteModal
          inicial={ajustando}
          silos={(constantes?.destinos || []).find((d) => d.key === "reproductoras")?.silos || []}
          tipos={tipos}
          stock={stock}
          onClose={() => setAjustando(null)}
          onHecho={async () => { setAjustando(null); await cargar(); }}
        />
      )}

      {recibiendo && (
        <RecepcionAlimentoModal
          envio={recibiendo}
          silos={(constantes?.destinos || []).find((d) => d.key === recibiendo.destino)?.silos || []}
          grupos={(constantes?.destinos || []).find((d) => d.key === recibiendo.destino)?.grupos || []}
          stock={stock}
          etiquetaTipo={etiquetaTipo}
          onClose={() => setRecibiendo(null)}
          onHecho={async () => { setRecibiendo(null); await cargar(); }}
        />
      )}
    </Layout>
  );
};

// ── Modal: ajuste por recuento ──────────────────────────────────────────────
// Se carga LO QUE SE MIDIÓ, no la diferencia: es más difícil equivocarse anotando
// un recuento que una corrección con signo. El sistema hace la resta.
const AjusteModal = ({ inicial, silos, tipos, stock, onClose, onHecho }) => {
  const [silo, setSilo] = useState(inicial.silo ? String(inicial.silo) : "");
  const [tipo, setTipo] = useState(inicial.tipo || "");
  const [kgReal, setKgReal] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [saving, setSaving] = useState(false);

  // Lo que el sistema cree que hay de ese (silo, tipo), para mostrar la resta
  // antes de confirmar.
  const kgSistema = (() => {
    if (!silo || !tipo) return null;
    const s = (stock?.silos || []).find((x) => x.silo === Number(silo));
    return s?.tipos.find((t) => t.tipo === tipo)?.kg ?? 0;
  })();

  const real = Number(kgReal);
  const hayReal = kgReal !== "" && Number.isFinite(real) && real >= 0;
  const diferencia = hayReal && kgSistema != null ? real - kgSistema : null;
  const puedeGuardar = !!silo && !!tipo && hayReal && !!motivo.trim() && diferencia !== 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setSaving(true);
    try {
      await ajustarSilo({
        destino: "reproductoras",
        silo: Number(silo),
        tipo,
        kgReal: real,
        motivo: motivo.trim(),
        fecha: ajustarFechaParaGuardar(fecha),
      });
      await onHecho();
      Swal.fire({
        icon: "success",
        title: "Silo ajustado",
        html:
          `Quedó en <strong>${fmt(real)} kg</strong>` +
          `<br/><span class="text-muted">${diferencia > 0 ? "+" : ""}${fmt(diferencia)} kg respecto de lo que decía el sistema.</span>`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo ajustar.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-warning py-2">
              <h5 className="modal-title fs-6">
                <i className="bi bi-sliders me-2"></i>Ajustar por recuento
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="d-flex flex-column flex-grow-1"
              style={{ minHeight: 0 }}
            >
              <div className="modal-body py-2">
                <p className="small text-muted">
                  Cargá <strong>los kg que medís</strong>, no la diferencia: el sistema hace la
                  resta contra lo que tenía calculado.
                </p>

                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1">Silo</label>
                    <select
                      className="form-select form-select-sm"
                      value={silo}
                      onChange={(e) => setSilo(e.target.value)}
                      disabled={saving}
                    >
                      <option value="">— Elegí —</option>
                      {silos.map((s) => (
                        <option key={s.numero} value={s.numero}>
                          {s.nombre} (galpón {(s.galpones || []).join(" y ")})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small mb-1">Tipo de alimento</label>
                    <select
                      className="form-select form-select-sm"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      disabled={saving}
                    >
                      <option value="">— Elegí —</option>
                      {tipos.map((t) => (
                        <option key={t.key} value={t.key}>{t.etiqueta}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {kgSistema != null && (
                  <div className="alert alert-light border py-1 px-2 small mb-2">
                    El sistema tiene <strong>{fmt(kgSistema)} kg</strong> de eso en ese silo.
                  </div>
                )}

                <label className="form-label fw-semibold small mb-1">
                  ¿Cuántos kg contaste?
                </label>
                <input
                  type="number" min="0" step="0.1"
                  className="form-control form-control-sm mb-2"
                  value={kgReal}
                  onChange={(e) => setKgReal(e.target.value)}
                  disabled={saving || !silo || !tipo}
                  placeholder="0"
                />

                <label className="form-label fw-semibold small mb-1">Fecha del recuento</label>
                <input
                  type="date" className="form-control form-control-sm mb-2"
                  value={fecha} onChange={(e) => setFecha(e.target.value)}
                  disabled={saving} required
                />

                <label className="form-label fw-semibold small mb-1">
                  Por qué se ajusta <span className="text-danger">*</span>
                </label>
                <input
                  type="text" className="form-control form-control-sm"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  disabled={saving}
                  placeholder="Ej: medición con varilla"
                />
                <div className="form-text">
                  Es obligatorio: sin el motivo, después no se puede saber de dónde venía
                  el descuadre.
                </div>

                {diferencia != null && (
                  <div
                    className={`alert py-2 mt-3 mb-0 small ${
                      diferencia === 0 ? "alert-secondary" : diferencia < 0 ? "alert-danger" : "alert-success"
                    }`}
                  >
                    {diferencia === 0 ? (
                      "Es el mismo valor que ya tiene: no hay nada que ajustar."
                    ) : diferencia < 0 ? (
                      <>
                        Se van a <strong>dar de baja {fmt(Math.abs(diferencia))} kg</strong> que el
                        sistema tenía y no están.
                      </>
                    ) : (
                      <>
                        Se van a <strong>sumar {fmt(diferencia)} kg</strong> que aparecieron y el
                        sistema no tenía.
                      </>
                    )}
                  </div>
                )}

                <div className="alert alert-warning py-2 mt-2 mb-0 small">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  Un ajuste no se edita ni se borra. Si te equivocás, se hace otro.
                </div>
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-warning" disabled={saving || !puedeGuardar}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-check2-circle me-1"></i>Registrar ajuste
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

export default AlimentoSilosPage;
