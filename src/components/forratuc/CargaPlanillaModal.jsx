import React, { useState } from "react";
import { obtenerFechaHoy } from "../../utils/dateUtils";

/**
 * Cargar lo producido de una PLANILLA DE DOSIFICACIÓN (2026-11-21): una tanda.
 * Lo usa Producción (y la Planta). Los insumos salen por las BACHADAS hechas ×
 * kg por bachada de la fórmula (decisión del usuario):
 *   · en bolsa  → las bolsas que salieron, que entran al Depósito Producción;
 *   · a granel  → solo las bachadas: queda LISTA PARA CARGAR; el camión se carga
 *                 después (a la noche) con el peso de la balanza (PlanillasProduccion).
 * Por insumo se puede anotar el LOTE (la columna de la planilla de papel).
 *
 * Props: orden, insumos ({ [materiaPrima]: kg en stock }), saving,
 *        onClose(), onGuardar(data) — data va tal cual a la API.
 */
const fmt = (n, dec = 2) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: dec });
const redondear = (n) => Math.round(n * 100) / 100;

const CargaPlanillaModal = ({ orden, insumos = {}, saving, onClose, onGuardar }) => {
  const faltan = redondear(orden.bachadas - (orden.bachadasHechas || 0));
  const granel = orden.envase === "granel";
  const [f, setF] = useState({ fecha: obtenerFechaHoy(), bachadas: String(faltan), bolsas: "", observaciones: "", lotes: {} });
  const set = (c) => setF((x) => ({ ...x, ...c }));

  const bach = Number(f.bachadas) || 0;
  const kgTeorico = redondear(bach * orden.kgBachada);
  const bolsasEsperadas = !granel && orden.kgPorBolsa ? Math.floor(kgTeorico / orden.kgPorBolsa) : null;
  const filas = (orden.ingredientes || []).map((i) => {
    const id = String(i.materiaPrima);
    const usa = redondear(bach * (i.kgBachada || 0));
    const hay = insumos[id] ?? 0;
    return { id, nombre: i.nombre, usa, hay, falta: usa > hay };
  });
  const faltaAlgo = filas.some((x) => x.falta);

  const guardar = (e) => {
    e.preventDefault();
    onGuardar({
      fecha: f.fecha, bachadas: bach, observaciones: f.observaciones, lotes: f.lotes,
      ...(granel ? {} : { bolsas: Number(f.bolsas) }),
    });
  };

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg" role="document">
          <form className="modal-content" onSubmit={guardar}>
            <div className="modal-header">
              <h5 className="modal-title">
                Cargar producción — {orden.numero}
                <div className="small text-muted fw-normal">{orden.productoNombre}</div>
              </h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" max={obtenerFechaHoy()} value={f.fecha} onChange={(e) => set({ fecha: e.target.value })} required />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small mb-1">Bachadas hechas</label>
                  <input type="number" min="0.01" step="0.01" max={faltan} className="form-control" value={f.bachadas} required
                    onChange={(e) => set({ bachadas: e.target.value })} />
                  <div className="form-text">Faltan {fmt(faltan)} de {fmt(orden.bachadas)}.</div>
                </div>
                {granel ? (
                  <div className="col-12 col-md-6">
                    <div className="alert alert-info small py-2 mb-0">
                      <i className="bi bi-truck me-1"></i>
                      {fmt(kgTeorico)} kg a granel. Queda <strong>listo para cargar</strong>: cuando el camión cargue, se anota el peso de la balanza y sale a {orden.galpones?.length ? `los galpones ${orden.galpones.join(", ")}` : "la granja"}.
                    </div>
                  </div>
                ) : (
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small mb-1">Bolsas que salieron</label>
                    <input type="number" min="1" step="1" className="form-control" value={f.bolsas} required autoFocus
                      onChange={(e) => set({ bolsas: e.target.value })} />
                    <div className="form-text">
                      {fmt(kgTeorico)} kg ≈ {fmt(bolsasEsperadas, 0)} bolsas de {fmt(orden.kgPorBolsa)} kg. Entran al Depósito Producción.
                    </div>
                  </div>
                )}
                <div className="col-12">
                  <table className="table table-sm small align-middle mb-1">
                    <thead><tr><th>Insumo</th><th style={{ width: "28%" }}>Lote</th><th className="text-end">Usa</th><th className="text-end">Hay</th></tr></thead>
                    <tbody>
                      {filas.map((x) => (
                        <tr key={x.id} className={x.falta ? "table-danger" : ""}>
                          <td>{x.nombre}</td>
                          <td>
                            <input className="form-control form-control-sm" maxLength={60} value={f.lotes[x.id] || ""}
                              onChange={(e) => set({ lotes: { ...f.lotes, [x.id]: e.target.value } })} />
                          </td>
                          <td className="text-end text-nowrap">{fmt(x.usa)} kg</td>
                          <td className="text-end text-nowrap">{fmt(x.hay)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {faltaAlgo && <div className="small text-danger">No alcanza el insumo marcado en rojo: cargá antes el remito de compra.</div>}
                </div>
                <div className="col-12">
                  <input className="form-control form-control-sm" placeholder="Observaciones (opcional)" value={f.observaciones}
                    onChange={(e) => set({ observaciones: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-success" disabled={saving || faltaAlgo}>
                {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check-lg me-1"></i>}
                {granel ? "Listo para cargar" : "Cargar bolsas"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default CargaPlanillaModal;
