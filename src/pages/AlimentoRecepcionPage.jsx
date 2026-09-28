import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerConstantesAlimento,
  obtenerEnviosAlimento,
  aceptarEnvioAlimento,
} from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmt = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

/**
 * Recepción de alimento en la granja.
 *
 * Es el paso que hace nacer el stock: hasta que acá no se acepta, el alimento
 * está "en viaje" y el silo no lo tiene. Se confirma lo que REALMENTE bajó del
 * camión —que puede no ser lo que salió— y a qué silo entró cada cosa.
 */
const AlimentoRecepcionPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aceptando, setAceptando] = useState(null); // envío abierto para aceptar

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, data] = await Promise.all([
        obtenerConstantesAlimento(),
        obtenerEnviosAlimento({ estado: "en_viaje" }),
      ]);
      setConstantes(cons);
      setPendientes(data);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar la recepción.", "error");
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
              <i className="bi bi-box-arrow-in-down me-2"></i>Recepción de alimento
            </h4>
            <div className="text-muted small">
              Confirmá lo que bajó del camión y a qué silo entró. Recién ahí suma al stock.
            </div>
          </div>
          <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
          </button>
        </div>

        {loading ? (
          <div className="card shadow-sm"><div className="card-body text-center text-muted py-5">
            <span className="spinner-border spinner-border-sm me-2"></span>Cargando…
          </div></div>
        ) : pendientes.length === 0 ? (
          <div className="card shadow-sm"><div className="card-body text-center text-muted py-5">
            <i className="bi bi-check2-circle fs-1 d-block mb-2 text-success"></i>
            No hay alimento en viaje. Todo lo despachado ya se recibió.
          </div></div>
        ) : (
          <div className="row g-3">
            {pendientes.map((e) => (
              <div className="col-12 col-xl-6" key={e._id}>
                <div className="card shadow-sm h-100 border-warning">
                  <div className="card-header bg-warning-subtle d-flex justify-content-between align-items-center">
                    <span className="fw-bold">
                      <i className="bi bi-truck me-2"></i>{e.numero}
                    </span>
                    <span className="badge bg-warning text-dark">En viaje</span>
                  </div>
                  <div className="card-body d-flex flex-column">
                    <div className="small text-muted mb-2">
                      Salió el {formatearFechaLocal(e.fechaEnvio)}
                      {e.numeroRemito && <> · remito {e.numeroRemito}</>}
                      {e.camion && <> · {e.camion.marca} {e.camion.patente}</>}
                    </div>

                    <div className="table-responsive mb-3">
                      <table className="table table-sm mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="small">Tipo</th>
                            <th className="small">Viene</th>
                            <th className="small text-end">Kg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(e.lineas || []).map((l) => (
                            <tr key={l._id}>
                              <td className="small">{etiquetaTipo(l.tipo)}</td>
                              <td className="small">
                                {l.presentacion === "bolsa"
                                  ? `${fmt(l.bolsas)} bolsas × ${fmt(l.kgPorBolsa)} kg`
                                  : "granel"}
                              </td>
                              <td className="small text-end fw-semibold">{fmt(l.kg)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <td colSpan={2} className="text-end small fw-semibold">Total</td>
                            <td className="text-end fw-bold">{fmt(e.kgTotales)} kg</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {e.observaciones && (
                      <div className="alert alert-light border py-1 px-2 small mb-3">
                        <i className="bi bi-chat-left-text me-1"></i>{e.observaciones}
                      </div>
                    )}

                    <button
                      className="btn btn-success mt-auto"
                      onClick={() => setAceptando(e)}
                    >
                      <i className="bi bi-check2-circle me-1"></i>Recibir este envío
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aceptando && (
        <AceptarModal
          envio={aceptando}
          silos={(constantes?.destinos || []).find((d) => d.key === aceptando.destino)?.silos || []}
          etiquetaTipo={etiquetaTipo}
          onClose={() => setAceptando(null)}
          onHecho={async () => { setAceptando(null); await cargar(); }}
        />
      )}
    </Layout>
  );
};

// ── Modal: aceptar el envío ─────────────────────────────────────────────────
// Arranca precargado con lo que salió, porque el caso normal es que venga
// completo: así solo hay que tocar lo que no coincide. El silo SÍ es obligatorio
// en cada línea — es el dato que el sistema no puede adivinar.
const AceptarModal = ({ envio, silos, etiquetaTipo, onClose, onHecho }) => {
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [saving, setSaving] = useState(false);
  const [lineas, setLineas] = useState(() =>
    (envio.lineas || []).map((l) => ({
      _id: l._id,
      tipo: l.tipo,
      presentacion: l.presentacion,
      bolsas: l.bolsas,
      kgPorBolsa: l.kgPorBolsa,
      kgEnviados: l.kg,
      // Precargado con lo enviado.
      bolsasReales: l.presentacion === "bolsa" ? String(l.bolsas ?? "") : "",
      kgReales: l.presentacion === "granel" ? String(l.kg ?? "") : "",
      silo: silos.length === 1 ? String(silos[0].numero) : "",
    }))
  );

  const setLinea = (i, campo, valor) =>
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));

  const kgRecibidosDe = (l) =>
    l.presentacion === "bolsa"
      ? (Number(l.bolsasReales) || 0) * (Number(l.kgPorBolsa) || 0)
      : Number(l.kgReales) || 0;

  const kgTotalReal = lineas.reduce((acc, l) => acc + kgRecibidosDe(l), 0);
  const diferencia = kgTotalReal - envio.kgTotales;
  const faltaSilo = lineas.some((l) => kgRecibidosDe(l) > 0 && !l.silo);
  const nadaRecibido = kgTotalReal <= 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (faltaSilo) {
      Swal.fire("Falta el silo", "Decí a qué silo entró cada línea que recibiste.", "warning");
      return;
    }
    if (nadaRecibido) {
      Swal.fire(
        "No se recibió nada",
        "Si el envío no llegó, pedí que lo anulen en lugar de aceptarlo en cero.",
        "warning"
      );
      return;
    }
    setSaving(true);
    try {
      const actualizado = await aceptarEnvioAlimento(envio._id, {
        fechaAcepta: ajustarFechaParaGuardar(fecha),
        lineas: lineas.map((l) => ({
          _id: l._id,
          silo: Number(l.silo),
          ...(l.presentacion === "bolsa"
            ? { bolsasReales: Number(l.bolsasReales) || 0 }
            : { kgReales: Number(l.kgReales) || 0 }),
        })),
      });
      await onHecho();
      Swal.fire({
        icon: "success",
        title: `${envio.numero} recibido`,
        html:
          `Entraron <strong>${fmt(actualizado.kgTotalesReales)} kg</strong> al silo.` +
          (diferencia !== 0
            ? `<br/><span class="text-muted">${diferencia > 0 ? "+" : ""}${fmt(diferencia)} kg respecto de lo despachado.</span>`
            : ""),
        timer: 3500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo aceptar el envío.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white py-2">
              <h5 className="modal-title fs-6">
                <i className="bi bi-box-arrow-in-down me-2"></i>Recibir {envio.numero}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            {/* El form es hijo de modal-content (flex column): sin d-flex y
                minHeight 0 el body no scrollea y el footer queda cortado. */}
            <form
              onSubmit={handleSubmit}
              className="d-flex flex-column flex-grow-1"
              style={{ minHeight: 0 }}
            >
              <div className="modal-body py-2">
                <p className="small text-muted">
                  Viene precargado con lo que salió: tocá solo lo que no coincida. El
                  <strong> silo</strong> hay que indicarlo siempre.
                </p>

                <label className="form-label fw-semibold small mb-1">Fecha de recepción</label>
                <input
                  type="date" className="form-control form-control-sm mb-3"
                  value={fecha} onChange={(ev) => setFecha(ev.target.value)}
                  disabled={saving} required
                />

                <div className="table-responsive">
                  <table className="table table-sm table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="small">Tipo</th>
                        <th className="small text-end">Salió</th>
                        <th className="small" style={{ width: 130 }}>Recibido</th>
                        <th className="small text-end">Kg</th>
                        <th className="small" style={{ width: 120 }}>Silo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l, i) => {
                        const esBolsa = l.presentacion === "bolsa";
                        const kgRec = kgRecibidosDe(l);
                        const dif = kgRec - l.kgEnviados;
                        return (
                          <tr key={l._id}>
                            <td className="small fw-semibold">
                              {etiquetaTipo(l.tipo)}
                              <div className="text-muted" style={{ fontSize: ".72rem" }}>
                                {esBolsa ? `bolsas de ${fmt(l.kgPorBolsa)} kg` : "granel"}
                              </div>
                            </td>
                            <td className="small text-end text-muted">
                              {esBolsa ? `${fmt(l.bolsas)} b` : `${fmt(l.kgEnviados)} kg`}
                            </td>
                            <td>
                              <input
                                type="number" min="0" step={esBolsa ? "1" : "0.1"}
                                className="form-control form-control-sm text-center"
                                value={esBolsa ? l.bolsasReales : l.kgReales}
                                onChange={(ev) =>
                                  setLinea(i, esBolsa ? "bolsasReales" : "kgReales", ev.target.value)
                                }
                                disabled={saving}
                                placeholder="0"
                              />
                            </td>
                            <td className="text-end small fw-semibold">
                              {fmt(kgRec)}
                              {dif !== 0 && (
                                <div className={dif < 0 ? "text-danger" : "text-success"} style={{ fontSize: ".72rem" }}>
                                  {dif > 0 ? "+" : ""}{fmt(dif)}
                                </div>
                              )}
                            </td>
                            <td>
                              <select
                                className={`form-select form-select-sm ${kgRec > 0 && !l.silo ? "is-invalid" : ""}`}
                                value={l.silo}
                                onChange={(ev) => setLinea(i, "silo", ev.target.value)}
                                disabled={saving || kgRec <= 0}
                              >
                                <option value="">—</option>
                                {silos.map((s) => (
                                  <option key={s.numero} value={s.numero}>{s.nombre}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  className={`alert py-2 mt-3 mb-0 small ${
                    nadaRecibido || faltaSilo ? "alert-secondary" : diferencia === 0 ? "alert-success" : "alert-warning"
                  }`}
                >
                  {nadaRecibido ? (
                    "Cargá cuánto recibiste de cada línea."
                  ) : faltaSilo ? (
                    "Falta decir a qué silo entró alguna de las líneas."
                  ) : (
                    <>
                      Entran <strong>{fmt(kgTotalReal)} kg</strong> al silo
                      {diferencia === 0 ? (
                        <> — coincide con lo despachado.</>
                      ) : (
                        <>
                          , contra {fmt(envio.kgTotales)} kg despachados:{" "}
                          <strong>{diferencia > 0 ? "+" : ""}{fmt(diferencia)} kg</strong>.
                          <div className="mt-1">
                            <i className="bi bi-info-circle me-1"></i>
                            La diferencia queda registrada en el envío como dato de control.
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={saving || nadaRecibido || faltaSilo}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-check2-circle me-1"></i>Confirmar recepción
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

export default AlimentoRecepcionPage;
