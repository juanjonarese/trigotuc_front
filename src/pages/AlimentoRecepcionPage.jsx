import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerConstantesAlimento,
  obtenerEnviosAlimento,
  aceptarEnvioAlimento,
  obtenerStockSilos,
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
 * camión —que puede no ser lo que salió— y a qué galpón va cada cosa, que se
 * reparte en los silos de ese galpón (14.000 kg cada uno).
 */
const AlimentoRecepcionPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  // Lo que ya hay en cada silo: sin esto no se sabe cuánto lugar queda.
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aceptando, setAceptando] = useState(null); // envío abierto para aceptar

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, data, st] = await Promise.all([
        obtenerConstantesAlimento(),
        obtenerEnviosAlimento({ estado: "en_viaje" }),
        obtenerStockSilos("reproductoras"),
      ]);
      setConstantes(cons);
      setPendientes(data);
      setStock(st);
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
              Confirmá lo que bajó del camión y a qué galpón va: se reparte en sus silos. Recién ahí suma al stock.
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
          grupos={(constantes?.destinos || []).find((d) => d.key === aceptando.destino)?.grupos || []}
          stock={stock}
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
// completo: así solo hay que tocar lo que no coincide.
//
// Lo que no se puede adivinar es a qué galpón va cada línea. Al elegirlo, los
// kg se reparten solos entre SUS silos llenando el que tiene lugar (14.000 kg
// cada uno) y el resto al siguiente; el reparto queda editable.
const AceptarModal = ({ envio, silos, grupos, stock, etiquetaTipo, onClose, onHecho }) => {
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
      grupo: "",
      reparto: {}, // { [silo]: "kg" }
    }))
  );

  const kgRecibidosDe = (l) =>
    l.presentacion === "bolsa"
      ? (Number(l.bolsasReales) || 0) * (Number(l.kgPorBolsa) || 0)
      : Number(l.kgReales) || 0;

  const capacidadDe = (silo) => silos.find((s) => s.numero === silo)?.capacidadKg ?? 0;
  const libreEnStock = (silo) =>
    (stock?.silos || []).find((s) => s.silo === silo)?.libreKg ?? capacidadDe(silo);

  // Lo libre de un silo descontando lo que YA le asignaron las otras líneas.
  const libreParaLinea = (todas, idx, silo) =>
    libreEnStock(silo) -
    todas.reduce((acc, l, j) => (j === idx ? acc : acc + (Number(l.reparto[silo]) || 0)), 0);

  // Llena los silos del grupo en orden: el primero hasta donde entra y el resto
  // al siguiente. Lo que no entra en ninguno queda en el último, para que el
  // aviso de "no entra" lo muestre en vez de perderse.
  const autollenar = (todas, idx) => {
    const l = todas[idx];
    const g = grupos.find((x) => x.clave === l.grupo);
    if (!g) return { ...l, reparto: {} };
    let resta = kgRecibidosDe(l);
    const reparto = {};
    g.silos.forEach((silo, k) => {
      const ultimo = k === g.silos.length - 1;
      const entra = ultimo ? resta : Math.max(0, Math.min(resta, libreParaLinea(todas, idx, silo)));
      reparto[silo] = entra > 0 ? String(Math.round(entra * 100) / 100) : "";
      resta -= entra;
    });
    return { ...l, reparto };
  };

  const setLinea = (i, campo, valor) =>
    setLineas((prev) => {
      const nuevas = prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l));
      // Cambiar el galpón o lo recibido rehace el reparto; tocar un silo a mano no.
      if (["grupo", "bolsasReales", "kgReales"].includes(campo)) {
        nuevas[i] = { ...nuevas[i], reparto: {} };
        nuevas[i] = autollenar(nuevas, i);
      }
      return nuevas;
    });

  const setRepartoSilo = (i, silo, valor) =>
    setLineas((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, reparto: { ...l.reparto, [silo]: valor } } : l))
    );

  const sumaReparto = (l) =>
    Object.values(l.reparto).reduce((acc, v) => acc + (Number(v) || 0), 0);

  // Lo que entra a cada silo sumando todas las líneas, contra su lugar libre.
  const entraPorSilo = {};
  for (const l of lineas)
    for (const [silo, v] of Object.entries(l.reparto))
      entraPorSilo[silo] = (entraPorSilo[silo] || 0) + (Number(v) || 0);
  const silosPasados = Object.entries(entraPorSilo)
    .filter(([silo, kg]) => kg > libreEnStock(Number(silo)) + 0.01)
    .map(([silo]) => Number(silo));

  const kgTotalReal = lineas.reduce((acc, l) => acc + kgRecibidosDe(l), 0);
  const diferencia = kgTotalReal - envio.kgTotales;
  const faltaGalpon = lineas.some((l) => kgRecibidosDe(l) > 0 && !l.grupo);
  const repartoDescuadrado = lineas.some(
    (l) => kgRecibidosDe(l) > 0 && l.grupo && Math.abs(sumaReparto(l) - kgRecibidosDe(l)) > 0.01
  );
  const nadaRecibido = kgTotalReal <= 0;
  const bloqueado = nadaRecibido || faltaGalpon || repartoDescuadrado || silosPasados.length > 0;

  const nombreSilo = (n) => silos.find((s) => s.numero === n)?.nombre || `Silo ${n}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (bloqueado) return;
    setSaving(true);
    try {
      const actualizado = await aceptarEnvioAlimento(envio._id, {
        fechaAcepta: ajustarFechaParaGuardar(fecha),
        lineas: lineas.map((l) => ({
          _id: l._id,
          reparto: Object.entries(l.reparto)
            .map(([silo, kg]) => ({ silo: Number(silo), kg: Number(kg) || 0 }))
            .filter((t) => t.kg > 0),
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
          `Entraron <strong>${fmt(actualizado.kgTotalesReales)} kg</strong> a los silos.` +
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
                  Viene precargado con lo que salió: tocá solo lo que no coincida. Elegí
                  a qué <strong>galpón</strong> va cada línea y se reparte sola en sus silos
                  (llena uno y sigue con el otro); el reparto se puede corregir a mano.
                </p>

                <label className="form-label fw-semibold small mb-1">Fecha de recepción</label>
                <input
                  type="date" className="form-control form-control-sm mb-3"
                  value={fecha} onChange={(ev) => setFecha(ev.target.value)}
                  disabled={saving} required
                />

                {lineas.map((l, i) => {
                  const esBolsa = l.presentacion === "bolsa";
                  const kgRec = kgRecibidosDe(l);
                  const dif = kgRec - l.kgEnviados;
                  const g = grupos.find((x) => x.clave === l.grupo);
                  const suma = sumaReparto(l);
                  const descuadre = g && kgRec > 0 && Math.abs(suma - kgRec) > 0.01;
                  return (
                    <div key={l._id} className="border rounded p-2 mb-2">
                      <div className="row g-2 align-items-start">
                        <div className="col-12 col-md-4">
                          <div className="small fw-semibold">{etiquetaTipo(l.tipo)}</div>
                          <div className="text-muted" style={{ fontSize: ".72rem" }}>
                            Salió: {esBolsa
                              ? `${fmt(l.bolsas)} bolsas de ${fmt(l.kgPorBolsa)} kg (${fmt(l.kgEnviados)} kg)`
                              : `${fmt(l.kgEnviados)} kg a granel`}
                          </div>
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label small mb-0">
                            Recibido {esBolsa ? "(bolsas)" : "(kg)"}
                          </label>
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
                          <div className="small text-end">
                            <strong>{fmt(kgRec)} kg</strong>
                            {dif !== 0 && (
                              <span className={`ms-1 ${dif < 0 ? "text-danger" : "text-success"}`}>
                                ({dif > 0 ? "+" : ""}{fmt(dif)})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-6 col-md-5">
                          <label className="form-label small mb-0">Va al</label>
                          <select
                            className={`form-select form-select-sm ${kgRec > 0 && !l.grupo ? "is-invalid" : ""}`}
                            value={l.grupo}
                            onChange={(ev) => setLinea(i, "grupo", ev.target.value)}
                            disabled={saving || kgRec <= 0}
                          >
                            <option value="">— Elegí el galpón —</option>
                            {grupos.map((gr) => (
                              <option key={gr.clave} value={gr.clave}>
                                {gr.nombre} ({gr.silos.length === 1 ? "1 silo" : `${gr.silos.length} silos`})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {g && kgRec > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          {g.silos.map((silo) => {
                            const pasado = silosPasados.includes(silo);
                            return (
                              <div key={silo} style={{ minWidth: 170, flex: "1 1 170px" }}>
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text">{nombreSilo(silo)}</span>
                                  <input
                                    type="number" min="0" step="0.1"
                                    className={`form-control text-end ${pasado ? "is-invalid" : ""}`}
                                    value={l.reparto[silo] ?? ""}
                                    onChange={(ev) => setRepartoSilo(i, silo, ev.target.value)}
                                    disabled={saving}
                                    placeholder="0"
                                  />
                                  <span className="input-group-text">kg</span>
                                </div>
                                <div className={pasado ? "text-danger" : "text-muted"} style={{ fontSize: ".72rem" }}>
                                  {pasado
                                    ? `No entra: tiene lugar para ${fmt(libreEnStock(silo))} kg`
                                    : `libre ${fmt(libreEnStock(silo))} de ${fmt(capacidadDe(silo))} kg`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {descuadre && (
                        <div className="text-danger small mt-1">
                          El reparto suma {fmt(suma)} kg y se recibieron {fmt(kgRec)} kg.
                        </div>
                      )}
                    </div>
                  );
                })}

                <div
                  className={`alert py-2 mt-3 mb-0 small ${
                    bloqueado ? "alert-secondary" : diferencia === 0 ? "alert-success" : "alert-warning"
                  }`}
                >
                  {nadaRecibido ? (
                    "Cargá cuánto recibiste de cada línea."
                  ) : faltaGalpon ? (
                    "Falta decir a qué galpón va alguna de las líneas."
                  ) : repartoDescuadrado ? (
                    "El reparto en los silos no coincide con lo recibido en alguna línea."
                  ) : silosPasados.length > 0 ? (
                    <>
                      No entra en {silosPasados.map(nombreSilo).join(", ")}: pasá lo que sobra
                      al otro silo del galpón.
                    </>
                  ) : (
                    <>
                      Entran <strong>{fmt(kgTotalReal)} kg</strong> a los silos
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
                <button type="submit" className="btn btn-success" disabled={saving || bloqueado}>
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
