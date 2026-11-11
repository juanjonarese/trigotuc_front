import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  obtenerLotesParaTrozar, crearTrozadoCamara, obtenerTrozadosCamara, anularTrozadoCamara,
} from "../services/api";
import { TrozadoTable, trozadosVacios, trozadosAPayload } from "./TrozadoTable";
import { KG_POR_CAJON, fmt, hoyLocal, fmtFecha, fechaParaEnviar, nombreCorteCorto } from "../utils/camaraLotes";
import { BADGE_ESPECIE, etiquetaEspecie } from "../utils/especies";

// Trozado de enteros que ya están en la cámara de Cañete (2026-11-11).
// Se marcan uno o varios lotes con un check y se cargan los cajones de cada uno;
// los cortes se cargan UNA vez (el total) y el sistema los reparte entre los
// lotes en proporción a los kg que puso cada uno. Lo que no vuelve en cortes es
// merma. Ver services/trozadoCamara.services.js.

// Mismo reparto que el back (resto mayor; en empate, el lote más viejo), solo
// para mostrarlo antes de guardar. El que vale es el del back.
const repartir = (cajas, pesos) => {
  const total = pesos.reduce((a, p) => a + p, 0);
  if (!total) return pesos.map(() => 0);
  const cuotas = pesos.map((p) => (cajas * p) / total);
  const asignadas = cuotas.map(Math.floor);
  let sobran = cajas - asignadas.reduce((a, n) => a + n, 0);
  cuotas
    .map((q, i) => ({ i, resto: q - Math.floor(q) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
    .forEach(({ i }) => { if (sobran > 0) { asignadas[i] += 1; sobran -= 1; } });
  return asignadas;
};

const especieDeLote = (l) => l.calibres[0]?.especie || l.trozados?.[0]?.especie || "pollo";

// Fila de un lote con su check. `children` son los inputs, que aparecen al marcarlo.
export const FilaLote = ({ lote, marcado, onMarcar, resumen, children }) => (
  <div className={`border rounded mb-2 ${marcado ? "border-info" : ""}`}>
    <label className="d-flex align-items-start gap-2 p-2 mb-0" style={{ cursor: "pointer" }}>
      <input type="checkbox" className="form-check-input mt-1" checked={marcado} onChange={(e) => onMarcar(e.target.checked)} />
      <div className="flex-grow-1">
        <span className="fw-semibold">Lote #{lote.numeroLote}</span>
        <span className="text-muted small ms-2">{fmtFecha(lote.fechaIngreso)}</span>
        {especieDeLote(lote) !== "pollo" && (
          <span className={`badge ms-2 ${BADGE_ESPECIE[especieDeLote(lote)]}`}>{etiquetaEspecie(especieDeLote(lote))}</span>
        )}
        <div className="text-muted small">{resumen}</div>
      </div>
    </label>
    {marcado && <div className="px-2 pb-2">{children}</div>}
  </div>
);

// Input de cantidad con botón "todo".
export const InputCantidad = ({ valor, max, onChange }) => {
  const pasado = (Number(valor) || 0) > max;
  return (
    <div className="input-group input-group-sm" style={{ maxWidth: 150 }}>
      <input type="number" min="0" step="1" max={max} placeholder="0"
        className={`form-control ${pasado ? "is-invalid" : ""}`}
        value={valor ?? ""} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="btn btn-outline-secondary" onClick={() => onChange(String(max))}>todo</button>
    </div>
  );
};

export const TrozarCamaraModal = ({ onClose, onGuardado }) => {
  const [lotes, setLotes] = useState(null);
  const [marcados, setMarcados] = useState({}); // { loteId: { calibre: "n" } }
  const [cortes, setCortes] = useState(trozadosVacios());
  const [fecha, setFecha] = useState(hoyLocal());
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerLotesParaTrozar()
      .then(setLotes)
      .catch((e) => { Swal.fire("Error", e.message, "error"); setLotes([]); });
  }, []);

  // Partes en el orden de la lista (del lote más viejo al más nuevo, como el back).
  const partes = useMemo(() => (lotes || [])
    .filter((l) => marcados[l._id])
    .map((l) => {
      const enteros = l.calibres
        .map((c) => ({ calibre: c.calibre, cajones: Number(marcados[l._id][c.calibre]) || 0, max: c.cajones }))
        .filter((c) => c.cajones > 0);
      return { lote: l, enteros, kg: enteros.reduce((a, e) => a + e.cajones * KG_POR_CAJON, 0) };
    }), [lotes, marcados]);
  const conCajones = partes.filter((p) => p.kg > 0);

  const especies = new Set(partes.map((p) => especieDeLote(p.lote)));
  const mezclaEspecies = especies.size > 1;
  const excedido = partes.some((p) => p.enteros.some((e) => e.cajones > e.max));

  const kgEnteros = conCajones.reduce((a, p) => a + p.kg, 0);
  const cortesPayload = trozadosAPayload(cortes);
  const kgCortes = cortesPayload.reduce((a, c) => a + c.kgTotal, 0);
  const merma = kgEnteros - kgCortes;
  const pctMerma = kgEnteros > 0 ? (merma / kgEnteros) * 100 : null;

  const reparto = useMemo(() => {
    if (conCajones.length < 2) return null;
    const pesos = conCajones.map((p) => p.kg);
    return cortesPayload.map((c) => ({ corte: c, cajas: repartir(c.cajas, pesos) }));
  }, [conCajones, cortesPayload]);

  const marcar = (id, si) => {
    const nuevo = { ...marcados };
    if (si) nuevo[id] = {}; else delete nuevo[id];
    setMarcados(nuevo);
  };
  const setCajones = (id, calibre, v) =>
    setMarcados({ ...marcados, [id]: { ...marcados[id], [calibre]: v } });

  const guardar = async (e) => {
    e.preventDefault();
    if (!conCajones.length) return Swal.fire("Faltan cajones", "Marcá los lotes e indicá cuántos cajones se trozan.", "warning");
    if (mezclaEspecies) return Swal.fire("Especies", "Un trozado es de una sola especie.", "warning");
    if (excedido) return Swal.fire("Stock", "Hay calibres con más cajones de los que tiene el lote.", "warning");
    if (!cortesPayload.length) return Swal.fire("Faltan cortes", "Cargá las cajas que salieron del trozado.", "warning");
    if (kgCortes > kgEnteros)
      return Swal.fire("Kg", `Los cortes (${fmt(kgCortes)} kg) pesan más que los cajones (${fmt(kgEnteros)} kg).`, "warning");

    const ok = await Swal.fire({
      title: "¿Confirmás el trozado?",
      html:
        conCajones.map((p) =>
          `Lote <strong>#${p.lote.numeroLote}</strong>: ${p.enteros.map((e) => `${e.cajones} caj. cal. ${e.calibre}`).join(", ")}`
        ).join("<br/>") +
        `<br/><br/>Salen <strong>${fmt(kgEnteros)} kg</strong> de entero y entran <strong>${fmt(kgCortes)} kg</strong> de trozado.<br/>` +
        `Merma: <strong>${fmt(merma)} kg</strong>${pctMerma != null ? ` (${fmt(pctMerma)}%)` : ""}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, trozar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;

    setGuardando(true);
    try {
      const doc = await crearTrozadoCamara({
        lotes: conCajones.map((p) => ({
          lote: p.lote._id,
          enteros: p.enteros.map(({ calibre, cajones }) => ({ calibre, cajones })),
        })),
        cortes: cortesPayload,
        ...fechaParaEnviar(fecha),
        observaciones: observaciones.trim() || undefined,
      });
      Swal.fire("Listo", `Trozado ${doc.numero} cargado.`, "success");
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-scissors me-2 text-info"></i>
                Trozar enteros — Cámara Cañete
              </h5>
              <button className="btn-close" onClick={onClose} disabled={guardando}></button>
            </div>
            <div className="modal-body">
              {lotes === null ? (
                <p className="text-muted small mb-0">Cargando lotes…</p>
              ) : lotes.length === 0 ? (
                <div className="alert alert-light border mb-0">No hay pollo entero en la cámara de Cañete.</div>
              ) : (
                <form id="form-trozar" onSubmit={guardar}>
                  <div className="d-flex justify-content-between align-items-end mb-2 gap-2 flex-wrap">
                    <div className="fw-semibold small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                      1. Marcá los lotes y los cajones de cada uno
                    </div>
                    <div style={{ width: 170 }}>
                      <label className="form-label small mb-0">Fecha</label>
                      <input type="date" className="form-control form-control-sm" value={fecha} max={hoyLocal()}
                        onChange={(e) => setFecha(e.target.value)} />
                    </div>
                  </div>

                  {lotes.map((l) => (
                    <FilaLote key={l._id} lote={l} marcado={!!marcados[l._id]} onMarcar={(si) => marcar(l._id, si)}
                      resumen={l.calibres.map((c) => `cal. ${c.calibre}: ${fmt(c.cajones)} caj`).join(" · ")}>
                      <div className="d-flex flex-wrap gap-3">
                        {l.calibres.map((c) => (
                          <div key={c.calibre}>
                            <div className="small text-muted">Cal. {c.calibre} <span className="ms-1">(hay {fmt(c.cajones)})</span></div>
                            <InputCantidad valor={marcados[l._id]?.[c.calibre]} max={c.cajones}
                              onChange={(v) => setCajones(l._id, c.calibre, v)} />
                          </div>
                        ))}
                      </div>
                    </FilaLote>
                  ))}

                  {mezclaEspecies && (
                    <div className="alert alert-warning small py-2">
                      Marcaste lotes de especies distintas: un trozado es de una sola especie.
                    </div>
                  )}

                  {conCajones.length > 0 && (
                    <>
                      <div className="fw-semibold mt-3 mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                        2. Lo que salió del trozado (kg reales, el total)
                      </div>
                      <TrozadoTable lineas={cortes} onChange={setCortes} />

                      <div className={`alert ${merma < 0 ? "alert-danger" : "alert-light border"} small mt-3 mb-3 py-2`}>
                        Entran a trozar <strong>{fmt(kgEnteros)} kg</strong> ({KG_POR_CAJON} kg por cajón) ·
                        cortes <strong>{fmt(kgCortes)} kg</strong> ·{" "}
                        merma <strong>{fmt(merma)} kg</strong>
                        {pctMerma != null && ` (${fmt(pctMerma)}%)`}
                        {merma < 0 && " — los cortes no pueden pesar más que el entero."}
                      </div>

                      {reparto && reparto.length > 0 && (
                        <div className="mb-3">
                          <div className="small text-muted mb-1">
                            Así se reparten las cajas entre los lotes (según los kg que puso cada uno):
                          </div>
                          <div className="table-responsive">
                            <table className="table table-sm table-bordered align-middle mb-0 small">
                              <thead className="table-light">
                                <tr>
                                  <th>Corte</th>
                                  {conCajones.map((p) => (
                                    <th key={p.lote._id} className="text-end">#{p.lote.numeroLote} <span className="text-muted fw-normal">({fmt(p.kg)} kg)</span></th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {reparto.map((r) => (
                                  <tr key={`${r.corte.tipo}|${r.corte.clase || ""}`}>
                                    <td>{nombreCorteCorto(r.corte)}</td>
                                    {r.cajas.map((n, i) => <td key={i} className="text-end">{n}</td>)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <label className="form-label small fw-semibold">Observaciones</label>
                      <input className="form-control form-control-sm" value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)} maxLength={300} />
                    </>
                  )}
                </form>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="submit" form="form-trozar" className="btn btn-info"
                disabled={guardando || !conCajones.length || merma < 0 || excedido || mezclaEspecies}>
                {guardando ? "Guardando…" : (<><i className="bi bi-scissors me-1"></i>Trozar</>)}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Historial de trozados, con anular ──────────────────────────────────────
export const TrozadosCamaraLista = ({ recargar, puedeAnular, onAnulado }) => {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    obtenerTrozadosCamara({ limite: 100 })
      .then(setLista)
      .catch((e) => { Swal.fire("Error", e.message, "error"); setLista([]); });
  }, [abierto, recargar]);

  const anular = async (t) => {
    const r = await Swal.fire({
      title: `¿Anular ${t.numero}?`,
      html: `Vuelven los cajones a ${t.lotes.length > 1 ? "sus lotes" : `el lote #${t.lotes[0]?.numeroLote}`} y salen las cajas de trozado. ` +
        "Solo se puede si esas cajas siguen en la cámara.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    try {
      await anularTrozadoCamara(t._id, r.value);
      Swal.fire("Anulado", `${t.numero} anulado.`, "success");
      onAnulado();
    } catch (err) {
      Swal.fire("No se pudo anular", err.message, "error");
    }
  };

  return (
    <div className="card border-0 shadow-sm mt-4">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="bi bi-scissors me-2 text-info"></i>
          Trozados en cámara
        </h6>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => setAbierto(!abierto)}>
          {abierto ? "Ocultar" : "Ver trozados"}
        </button>
      </div>
      {abierto && (
        <div className="card-body">
          {lista === null ? (
            <p className="text-muted small mb-0">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="text-muted small mb-0">Todavía no se trozó nada en cámara.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Fecha</th>
                    <th>Lote</th>
                    <th>Salió (entero)</th>
                    <th>Entró (trozado)</th>
                    <th className="text-end">Merma</th>
                    <th>Usuario</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((t) => {
                    const anulado = t.estado === "anulado";
                    return (
                      <tr key={t._id} className={anulado ? "text-muted" : ""}>
                        <td className="text-nowrap">
                          <span style={anulado ? { textDecoration: "line-through" } : {}}>{t.numero}</span>
                          {anulado && <span className="badge bg-secondary ms-1">anulado</span>}
                        </td>
                        <td className="small text-nowrap">{fmtFecha(t.fecha)}</td>
                        <td className="small">
                          {t.lotes.map((p) => (
                            <div key={String(p.lote)} className="text-nowrap">
                              #{p.numeroLote}
                              {t.lotes.length > 1 && (
                                <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                  {" "}→ {p.cortes.map((c) => `${nombreCorteCorto(c)}: ${c.cajas}`).join(", ")}
                                </span>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="small">
                          {t.enteros.map((e) => `cal. ${e.calibre}: ${e.cajones} caj`).join(" · ")}
                          {t.enteros[0]?.especie && t.enteros[0].especie !== "pollo" && ` (${etiquetaEspecie(t.enteros[0].especie)})`}
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>{fmt(t.kgEnteros)} kg</div>
                        </td>
                        <td className="small">
                          {t.cortes.map((c) => `${nombreCorteCorto(c)}: ${c.cajas}`).join(" · ")}
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>{fmt(t.kgCortes)} kg</div>
                        </td>
                        <td className="text-end small">
                          {fmt(t.kgMerma)} kg
                          {t.kgEnteros > 0 && <div className="text-muted" style={{ fontSize: "0.72rem" }}>{fmt((t.kgMerma / t.kgEnteros) * 100)}%</div>}
                        </td>
                        <td className="small">
                          {t.registradoPor?.nombreUsuario || "—"}
                          {anulado && t.motivoAnulacion && (
                            <div className="text-muted" style={{ fontSize: "0.72rem" }}>Motivo: {t.motivoAnulacion}</div>
                          )}
                        </td>
                        <td className="text-end">
                          {puedeAnular && !anulado && (
                            <button className="btn btn-outline-danger btn-sm" onClick={() => anular(t)}>
                              Anular
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrozarCamaraModal;
