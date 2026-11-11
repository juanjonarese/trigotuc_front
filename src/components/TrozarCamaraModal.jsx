import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  obtenerLotesParaTrozar, crearTrozadoCamara, obtenerTrozadosCamara, anularTrozadoCamara,
} from "../services/api";
import { TrozadoTable, trozadosVacios, trozadosAPayload, trozadoLabel } from "./TrozadoTable";
import { BADGE_ESPECIE, etiquetaEspecie } from "../utils/especies";

// Trozado de enteros que ya están en la cámara de Cañete (2026-11-11).
// Salen cajones de UN lote (lo elige el usuario) y entran los cortes al mismo
// lote; lo que no vuelve en cortes es merma. Ver services/trozadoCamara.services.js.

const KG_POR_CAJON = 20;
const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n || 0);

// "Hoy" del navegador (Argentina) como AAAA-MM-DD, sin pasar por UTC.
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtFecha = (iso) => new Date(iso).toLocaleDateString("es-AR");

export const TrozarCamaraModal = ({ onClose, onGuardado }) => {
  const [lotes, setLotes] = useState(null);
  const [loteId, setLoteId] = useState("");
  const [cajones, setCajones] = useState({}); // { calibre: "n" }
  const [cortes, setCortes] = useState(trozadosVacios());
  const [fecha, setFecha] = useState(hoyLocal());
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerLotesParaTrozar()
      .then(setLotes)
      .catch((e) => { Swal.fire("Error", e.message, "error"); setLotes([]); });
  }, []);

  const lote = useMemo(() => (lotes || []).find((l) => l._id === loteId), [lotes, loteId]);
  const especie = lote?.calibres[0]?.especie || "pollo";

  const kgEnteros = (lote?.calibres || []).reduce(
    (a, c) => a + (Number(cajones[c.calibre]) || 0) * KG_POR_CAJON, 0
  );
  const kgCortes = cortes.reduce((a, l) => a + (Number(l.cajas) || 0) * (Number(l.kgCaja) || 0), 0);
  const merma = kgEnteros - kgCortes;
  const pctMerma = kgEnteros > 0 ? (merma / kgEnteros) * 100 : null;

  const excedidos = (lote?.calibres || []).filter((c) => (Number(cajones[c.calibre]) || 0) > c.cajones);

  const elegirLote = (id) => { setLoteId(id); setCajones({}); };

  const guardar = async (e) => {
    e.preventDefault();
    if (!lote) return Swal.fire("Falta el lote", "Elegí de qué lote se troza.", "warning");
    const enteros = lote.calibres
      .map((c) => ({ calibre: c.calibre, cajones: Number(cajones[c.calibre]) || 0 }))
      .filter((c) => c.cajones > 0);
    if (!enteros.length) return Swal.fire("Faltan cajones", "Indicá cuántos cajones se trozan.", "warning");
    if (excedidos.length) return Swal.fire("Stock", "Hay calibres con más cajones de los que tiene el lote.", "warning");
    const cortesPayload = trozadosAPayload(cortes);
    if (!cortesPayload.length) return Swal.fire("Faltan cortes", "Cargá las cajas que salieron del trozado.", "warning");
    if (kgCortes > kgEnteros)
      return Swal.fire("Kg", `Los cortes (${fmt(kgCortes)} kg) pesan más que los cajones (${fmt(kgEnteros)} kg).`, "warning");

    const ok = await Swal.fire({
      title: "¿Confirmás el trozado?",
      html:
        `Lote <strong>#${lote.numeroLote}</strong>: salen <strong>${enteros.map((e) => `${e.cajones} caj. cal. ${e.calibre}`).join(", ")}</strong> ` +
        `(${fmt(kgEnteros)} kg) y entran <strong>${fmt(kgCortes)} kg</strong> de trozado.<br/>` +
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
        lote: lote._id,
        enteros,
        cortes: cortesPayload,
        // Hoy = ahora; otro día = mediodía de Argentina de ese día.
        ...(fecha && fecha !== hoyLocal() ? { fecha: `${fecha}T12:00:00-03:00` } : {}),
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
                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-semibold">Lote</label>
                      <select className="form-select" value={loteId} onChange={(e) => elegirLote(e.target.value)}>
                        <option value="">Elegí el lote…</option>
                        {lotes.map((l) => (
                          <option key={l._id} value={l._id}>
                            #{l.numeroLote} — {fmtFecha(l.fechaIngreso)} —{" "}
                            {l.calibres.map((c) => `cal. ${c.calibre}: ${c.cajones} caj`).join(" · ")}
                            {l.calibres[0]?.especie !== "pollo" ? ` (${etiquetaEspecie(l.calibres[0]?.especie)})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Fecha</label>
                      <input type="date" className="form-control" value={fecha} max={hoyLocal()}
                        onChange={(e) => setFecha(e.target.value)} />
                    </div>
                  </div>

                  {lote && (
                    <>
                      <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                        Cajones que se trozan{" "}
                        <span className={`badge ${BADGE_ESPECIE[especie]}`}>{etiquetaEspecie(especie)}</span>
                      </div>
                      <div className="table-responsive mb-3">
                        <table className="table table-sm align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Calibre</th>
                              <th className="text-end">En el lote</th>
                              <th style={{ width: 140 }}>Cajones a trozar</th>
                              <th className="text-end">Kg</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lote.calibres.map((c) => {
                              const n = Number(cajones[c.calibre]) || 0;
                              const pasado = n > c.cajones;
                              return (
                                <tr key={c.calibre}>
                                  <td className="fw-semibold">Cal. {c.calibre}</td>
                                  <td className="text-end small text-muted">
                                    {fmt(c.cajones)} caj ({fmt(c.pollos)} u.)
                                  </td>
                                  <td>
                                    <div className="input-group input-group-sm">
                                      <input type="number" min="0" step="1" max={c.cajones} placeholder="0"
                                        className={`form-control ${pasado ? "is-invalid" : ""}`}
                                        value={cajones[c.calibre] ?? ""}
                                        onChange={(e) => setCajones({ ...cajones, [c.calibre]: e.target.value })} />
                                      <button type="button" className="btn btn-outline-secondary"
                                        title="Todos" onClick={() => setCajones({ ...cajones, [c.calibre]: String(c.cajones) })}>
                                        todo
                                      </button>
                                    </div>
                                  </td>
                                  <td className="text-end">{n > 0 ? `${fmt(n * KG_POR_CAJON)} kg` : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                        Lo que salió del trozado (kg reales)
                      </div>
                      <TrozadoTable lineas={cortes} onChange={setCortes} />

                      <div className={`alert ${merma < 0 ? "alert-danger" : "alert-light border"} small mt-3 mb-3 py-2`}>
                        Entran a trozar <strong>{fmt(kgEnteros)} kg</strong> ({KG_POR_CAJON} kg por cajón) ·
                        cortes <strong>{fmt(kgCortes)} kg</strong> ·{" "}
                        merma <strong>{fmt(merma)} kg</strong>
                        {pctMerma != null && ` (${fmt(pctMerma)}%)`}
                        {merma < 0 && " — los cortes no pueden pesar más que el entero."}
                      </div>

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
                disabled={guardando || !lote || merma < 0 || excedidos.length > 0}>
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
      html: `Vuelven los cajones al lote #${t.numeroLote} y salen las cajas de trozado. ` +
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
                        <td className="small">#{t.numeroLote}</td>
                        <td className="small">
                          {t.enteros.map((e) => `cal. ${e.calibre}: ${e.cajones} caj`).join(" · ")}
                          {t.enteros[0]?.especie && t.enteros[0].especie !== "pollo" && ` (${etiquetaEspecie(t.enteros[0].especie)})`}
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>{fmt(t.kgEnteros)} kg</div>
                        </td>
                        <td className="small">
                          {t.cortes.map((c) => `${trozadoLabel(c.tipo)}${c.clase && ["filet", "pata", "alita"].includes(c.tipo) ? ` ${c.clase}` : ""}: ${c.cajas}`).join(" · ")}
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
