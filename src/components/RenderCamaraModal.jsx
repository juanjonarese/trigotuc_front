import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  obtenerLotesParaRender, crearEnvioRender, obtenerEnviosRender, anularEnvioRender,
} from "../services/api";
import { FilaLote, InputCantidad } from "./TrozarCamaraModal";
import { KG_POR_CAJON, fmt, fmtFecha, hoyLocal, fechaParaEnviar, nombreCorteCorto } from "../utils/camaraLotes";
import { etiquetaEspecie } from "../utils/especies";

// Envío a RENDER (2026-11-11): lo de la cámara de Cañete que no se vende o no
// está en condiciones de venta sale de stock hacia la planta de render. Se
// marcan los lotes con un check y se cargan cajones de entero y cajas de
// trozado de cada uno. Ver services/envioRender.services.js.

const claveTroz = (t) => `${t.especie}|${t.tipo}|${t.clase || ""}|${t.kgCaja}`;

export const RenderCamaraModal = ({ onClose, onGuardado }) => {
  const [lotes, setLotes] = useState(null);
  // { loteId: { enteros: { calibre: "n" }, trozados: { clave: "n" } } }
  const [marcados, setMarcados] = useState({});
  const [fecha, setFecha] = useState(hoyLocal());
  const [kgPesados, setKgPesados] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerLotesParaRender()
      .then((ls) => setLotes(ls.map((l) => ({ ...l, calibres: l.calibres.filter((c) => c.cajones > 0) }))
        .filter((l) => l.calibres.length || l.trozados.length)))
      .catch((e) => { Swal.fire("Error", e.message, "error"); setLotes([]); });
  }, []);

  const partes = useMemo(() => (lotes || [])
    .filter((l) => marcados[l._id])
    .map((l) => {
      const m = marcados[l._id];
      const enteros = l.calibres
        .map((c) => ({ calibre: c.calibre, cajones: Number(m.enteros[c.calibre]) || 0, max: c.cajones }))
        .filter((c) => c.cajones > 0);
      const trozados = l.trozados
        .map((t) => ({ ...t, max: t.cajas, cajas: Number(m.trozados[claveTroz(t)]) || 0 }))
        .filter((t) => t.cajas > 0);
      return { lote: l, enteros, trozados };
    })
    .filter((p) => p.enteros.length || p.trozados.length), [lotes, marcados]);

  const excedido = partes.some((p) =>
    p.enteros.some((e) => e.cajones > e.max) || p.trozados.some((t) => t.cajas > t.max));
  const kgEnteros = partes.reduce((a, p) => a + p.enteros.reduce((s, e) => s + e.cajones * KG_POR_CAJON, 0), 0);
  const kgTrozados = partes.reduce((a, p) => a + p.trozados.reduce((s, t) => s + t.cajas * t.kgCaja, 0), 0);

  const marcar = (id, si) => {
    const nuevo = { ...marcados };
    if (si) nuevo[id] = { enteros: {}, trozados: {} }; else delete nuevo[id];
    setMarcados(nuevo);
  };
  const setValor = (id, grupo, clave, v) =>
    setMarcados({ ...marcados, [id]: { ...marcados[id], [grupo]: { ...marcados[id][grupo], [clave]: v } } });

  const guardar = async (e) => {
    e.preventDefault();
    if (!partes.length) return Swal.fire("Falta cargar", "Marcá los lotes e indicá qué va a render.", "warning");
    if (excedido) return Swal.fire("Stock", "Hay cantidades mayores a lo que tiene el lote.", "warning");

    const ok = await Swal.fire({
      title: "¿Mandar a render?",
      html:
        partes.map((p) =>
          `Lote <strong>#${p.lote.numeroLote}</strong>: ` +
          [...p.enteros.map((x) => `${x.cajones} caj. cal. ${x.calibre}`),
           ...p.trozados.map((t) => `${t.cajas} cajas ${nombreCorteCorto(t)}`)].join(", ")
        ).join("<br/>") +
        `<br/><br/>Sale de stock: <strong>${fmt(kgEnteros + kgTrozados)} kg</strong> según cámara` +
        (kgPesados ? ` (pesados: <strong>${fmt(kgPesados)} kg</strong>)` : "") + ".",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, mandar a render",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;

    setGuardando(true);
    try {
      const doc = await crearEnvioRender({
        lotes: partes.map((p) => ({
          lote: p.lote._id,
          enteros: p.enteros.map(({ calibre, cajones }) => ({ calibre, cajones })),
          trozados: p.trozados.map(({ especie, tipo, clase, kgCaja, cajas }) => ({ especie, tipo, clase, kgCaja, cajas })),
        })),
        ...fechaParaEnviar(fecha),
        kgPesados: kgPesados || undefined,
        motivo: motivo.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      Swal.fire("Listo", `Envío a render ${doc.numero} cargado.`, "success");
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
                <i className="bi bi-recycle me-2 text-danger"></i>
                Enviar a render — Cámara Cañete
              </h5>
              <button className="btn-close" onClick={onClose} disabled={guardando}></button>
            </div>
            <div className="modal-body">
              {lotes === null ? (
                <p className="text-muted small mb-0">Cargando lotes…</p>
              ) : lotes.length === 0 ? (
                <div className="alert alert-light border mb-0">No hay stock en la cámara de Cañete.</div>
              ) : (
                <form id="form-render" onSubmit={guardar}>
                  <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                    Marcá los lotes y lo que sale de cada uno
                  </div>

                  {lotes.map((l) => (
                    <FilaLote key={l._id} lote={l} marcado={!!marcados[l._id]} onMarcar={(si) => marcar(l._id, si)}
                      resumen={[
                        ...l.calibres.map((c) => `cal. ${c.calibre}: ${fmt(c.cajones)} caj`),
                        ...l.trozados.map((t) => `${nombreCorteCorto(t)}: ${fmt(t.cajas)} cajas`),
                      ].join(" · ")}>
                      {l.calibres.length > 0 && (
                        <>
                          <div className="small fw-semibold mb-1">Entero (cajones)</div>
                          <div className="d-flex flex-wrap gap-3 mb-2">
                            {l.calibres.map((c) => (
                              <div key={c.calibre}>
                                <div className="small text-muted">Cal. {c.calibre} <span className="ms-1">(hay {fmt(c.cajones)})</span></div>
                                <InputCantidad valor={marcados[l._id]?.enteros[c.calibre]} max={c.cajones}
                                  onChange={(v) => setValor(l._id, "enteros", c.calibre, v)} />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {l.trozados.length > 0 && (
                        <>
                          <div className="small fw-semibold mb-1">Trozado (cajas)</div>
                          <div className="d-flex flex-wrap gap-3">
                            {l.trozados.map((t) => (
                              <div key={claveTroz(t)}>
                                <div className="small text-muted">
                                  {nombreCorteCorto(t)} <span className="ms-1">({fmt(t.kgCaja)} kg · hay {fmt(t.cajas)})</span>
                                </div>
                                <InputCantidad valor={marcados[l._id]?.trozados[claveTroz(t)]} max={t.cajas}
                                  onChange={(v) => setValor(l._id, "trozados", claveTroz(t), v)} />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </FilaLote>
                  ))}

                  {partes.length > 0 && (
                    <>
                      <div className="alert alert-light border small mt-3 mb-3 py-2">
                        Sale de stock: entero <strong>{fmt(kgEnteros)} kg</strong> ({KG_POR_CAJON} kg por cajón) +
                        trozado <strong>{fmt(kgTrozados)} kg</strong> ={" "}
                        <strong>{fmt(kgEnteros + kgTrozados)} kg</strong> según cámara.
                      </div>
                      <div className="row g-2">
                        <div className="col-12 col-md-4">
                          <label className="form-label small fw-semibold">Fecha</label>
                          <input type="date" className="form-control form-control-sm" value={fecha} max={hoyLocal()}
                            onChange={(e) => setFecha(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label small fw-semibold">Kg pesados <span className="text-muted fw-normal">(opcional)</span></label>
                          <input type="number" min="0" step="0.1" className="form-control form-control-sm"
                            value={kgPesados} onChange={(e) => setKgPesados(e.target.value)} />
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label small fw-semibold">Motivo</label>
                          <input className="form-control form-control-sm" list="motivos-render" value={motivo}
                            onChange={(e) => setMotivo(e.target.value)} maxLength={120}
                            placeholder="vencido, golpeado…" />
                          <datalist id="motivos-render">
                            <option value="Vencido" />
                            <option value="No apto para la venta" />
                            <option value="Golpeado / mal estado" />
                            <option value="Sin salida" />
                          </datalist>
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold">Observaciones</label>
                          <input className="form-control form-control-sm" value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)} maxLength={300} />
                        </div>
                      </div>
                    </>
                  )}
                </form>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="submit" form="form-render" className="btn btn-danger"
                disabled={guardando || !partes.length || excedido}>
                {guardando ? "Guardando…" : (<><i className="bi bi-recycle me-1"></i>Mandar a render</>)}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Historial de envíos a render, con anular ───────────────────────────────
export const EnviosRenderLista = ({ recargar, puedeAnular, onAnulado }) => {
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(null);

  useEffect(() => {
    if (!abierto) return;
    obtenerEnviosRender({ limite: 100 })
      .then(setLista)
      .catch((e) => { Swal.fire("Error", e.message, "error"); setLista([]); });
  }, [abierto, recargar]);

  const anular = async (r) => {
    const res = await Swal.fire({
      title: `¿Anular ${r.numero}?`,
      html: "Todo lo que salió vuelve al stock de sus lotes en la cámara de Cañete.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;
    try {
      await anularEnvioRender(r._id, res.value);
      Swal.fire("Anulado", `${r.numero} anulado.`, "success");
      onAnulado();
    } catch (err) {
      Swal.fire("No se pudo anular", err.message, "error");
    }
  };

  return (
    <div className="card border-0 shadow-sm mt-4">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="bi bi-recycle me-2 text-danger"></i>
          Envíos a render
        </h6>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => setAbierto(!abierto)}>
          {abierto ? "Ocultar" : "Ver envíos"}
        </button>
      </div>
      {abierto && (
        <div className="card-body">
          {lista === null ? (
            <p className="text-muted small mb-0">Cargando…</p>
          ) : lista.length === 0 ? (
            <p className="text-muted small mb-0">Todavía no se mandó nada a render.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Fecha</th>
                    <th>Lotes y lo que salió</th>
                    <th className="text-end">Kg cámara</th>
                    <th className="text-end">Kg pesados</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => {
                    const anulado = r.estado === "anulado";
                    return (
                      <tr key={r._id} className={anulado ? "text-muted" : ""}>
                        <td className="text-nowrap">
                          <span style={anulado ? { textDecoration: "line-through" } : {}}>{r.numero}</span>
                          {anulado && <span className="badge bg-secondary ms-1">anulado</span>}
                        </td>
                        <td className="small text-nowrap">{fmtFecha(r.fecha)}</td>
                        <td className="small">
                          {r.lotes.map((p) => (
                            <div key={String(p.lote)}>
                              <strong>#{p.numeroLote}</strong>{" "}
                              {[...p.enteros.map((e) => `cal. ${e.calibre}: ${e.cajones} caj${e.especie !== "pollo" ? ` (${etiquetaEspecie(e.especie)})` : ""}`),
                                ...p.trozados.map((t) => `${nombreCorteCorto(t)}: ${t.cajas} cajas`)].join(" · ")}
                            </div>
                          ))}
                        </td>
                        <td className="text-end small">{fmt(r.kgEnteros + r.kgTrozados)}</td>
                        <td className="text-end small">{r.kgPesados != null ? fmt(r.kgPesados) : "—"}</td>
                        <td className="small">
                          {r.motivo || "—"}
                          {anulado && r.motivoAnulacion && (
                            <div className="text-muted" style={{ fontSize: "0.72rem" }}>Anulado: {r.motivoAnulacion}</div>
                          )}
                        </td>
                        <td className="small">{r.registradoPor?.nombreUsuario || "—"}</td>
                        <td className="text-end">
                          {puedeAnular && !anulado && (
                            <button className="btn btn-outline-danger btn-sm" onClick={() => anular(r)}>Anular</button>
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

export default RenderCamaraModal;
