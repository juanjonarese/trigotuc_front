import React, { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import CargaPlanillaModal from "./CargaPlanillaModal";
import { obtenerPlanillasProduccion, cargarTandaPlanilla, cargarCamionPlanilla } from "../../services/api";
import { formatearFechaLocal, obtenerFechaHoy } from "../../utils/dateUtils";
import { imprimirPlanillaDosificacion } from "../../utils/forratuc/imprimirForratuc";

/**
 * Solapa "Planilla de dosificación" de Producción (2026-11-21, pedido del
 * usuario): las planillas que emite la Planta de alimento, por hacer y las
 * últimas terminadas. Producción imprime la planilla y carga lo que hizo
 * (CargaPlanillaModal): en bolsa entra al Depósito Producción, listo para que
 * Forratuc lo pida; a granel queda LISTO PARA CARGAR y, cuando el camión carga
 * (a la noche), se anota el peso de la balanza y sale el Envío de alimento a la
 * granja (que lo recibe en Silos). Anular una carga es de la Planta.
 */
const fmt = (n, dec = 2) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: dec });
const ESTADO = {
  pendiente: { texto: "Por hacer", clase: "bg-secondary" },
  en_proceso: { texto: "En proceso", clase: "bg-warning text-dark" },
  completa: { texto: "Terminada", clase: "bg-success" },
};

const PlanillasProduccion = () => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [carga, setCarga] = useState(null); // planilla en el modal
  const [saving, setSaving] = useState(false);
  const [verTerminadas, setVerTerminadas] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await obtenerPlanillasProduccion());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron leer las planillas.", "error");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const destinos = datos?.destinos || [];
  const etiquetaDestino = (o) => {
    if (o.envase !== "granel") return "Depósito Producción";
    const d = destinos.find((x) => x.key === o.destino)?.etiqueta || o.destino;
    return `${d}${o.galpones?.length ? ` — galpón ${o.galpones.join(", ")}` : ""}`;
  };

  const guardar = async (data) => {
    setSaving(true);
    try {
      const o = await cargarTandaPlanilla(carga._id, data);
      setCarga(null);
      await cargar();
      const granel = o.envase === "granel";
      Swal.fire({
        icon: "success",
        title: granel ? "Listo para cargar" : "Bolsas cargadas",
        text: granel ? "Cuando cargue el camión, tocá \"Cargar camión\" y poné el peso de la balanza." : "Entraron al Depósito Producción, listas para que Forratuc las pida.",
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Granel: el camión de una tanda lista. Con el peso de la balanza sale el envío.
  const cargarCamion = async (o, t) => {
    const kgDosificados = fmt(t.kg);
    const { value, isConfirmed } = await Swal.fire({
      title: `Cargar camión — ${o.numero}`,
      html: `<div class="text-start small mb-2">${fmt(t.bachadas)} bachadas, ${kgDosificados} kg dosificados. Va a <strong>${etiquetaDestino(o)}</strong>.</div>` +
        `<label class="form-label small fw-semibold mb-1 d-block text-start">Kg de la balanza</label>` +
        `<input id="kgBalanza" type="number" min="0.01" step="0.01" class="form-control mb-2">` +
        `<label class="form-label small fw-semibold mb-1 d-block text-start">Fecha</label>` +
        `<input id="fechaCamion" type="date" class="form-control" max="${obtenerFechaHoy()}" value="${obtenerFechaHoy()}">`,
      focusConfirm: false, showCancelButton: true, confirmButtonText: "Cargar", cancelButtonText: "Volver",
      didOpen: () => document.getElementById("kgBalanza")?.focus(),
      preConfirm: () => {
        const kg = Number(document.getElementById("kgBalanza").value);
        if (!(kg > 0)) { Swal.showValidationMessage("Poné los kg que dio la balanza."); return false; }
        return { kgPesados: kg, fecha: document.getElementById("fechaCamion").value };
      },
    });
    if (!isConfirmed) return;
    try {
      const r = await cargarCamionPlanilla(o._id, t._id, value);
      const envio = r.tandas?.find((x) => x._id === t._id)?.envioAlimento;
      await cargar();
      Swal.fire({ icon: "success", title: "Camión cargado", text: `Salió el envío ${envio?.numero || ""} a ${etiquetaDestino(o)}: la granja lo recibe en Silos.` });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el camión.", "error");
    }
  };

  if (cargando) return <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>;
  const planillas = datos?.planillas || [];
  // Una planilla a granel terminada pero con un camión sin cargar sigue a la vista.
  const porCargar = (o) => o.envase === "granel" && (o.tandas || []).some((t) => !t.anulada && !t.envioAlimento);
  const abiertas = planillas.filter((o) => o.estado !== "completa" || porCargar(o));
  const terminadas = planillas.filter((o) => o.estado === "completa" && !porCargar(o));

  const Tarjeta = (o) => {
    const granel = o.envase === "granel";
    const vivas = (o.tandas || []).filter((t) => !t.anulada);
    const pct = Math.min(100, Math.round(((o.bachadasHechas || 0) / o.bachadas) * 100));
    return (
      <div className="col-12 col-xl-6" key={o._id}>
        <div className="card border-0 shadow-sm h-100">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div className="fw-semibold">{o.numero} · {o.productoNombre}</div>
                <div className="small text-muted">
                  {formatearFechaLocal(o.fecha)} · {granel ? <span className="badge bg-info text-dark">Granel</span> : <span className="badge bg-light text-dark border">Bolsa de {fmt(o.kgPorBolsa)} kg</span>}
                  {o.refPedido && <> · Ref. pedido {o.refPedido}</>}
                </div>
                <div className="small"><i className="bi bi-geo-alt me-1"></i>{etiquetaDestino(o)}</div>
              </div>
              <span className={`badge ${ESTADO[o.estado]?.clase}`}>{ESTADO[o.estado]?.texto}</span>
            </div>
            {/* La fórmula, como la planilla de papel (RAB-003): insumo, kg por bachada y producción. */}
            <div className="row g-2 small mt-2 mb-1">
              <div className="col-4"><div className="text-muted">Bachadas</div><div className="fs-5 fw-bold">{fmt(o.bachadas)}</div></div>
              <div className="col-4"><div className="text-muted">Bachada</div><div className="fs-5 fw-bold">{fmt(o.kgBachada)} kg</div></div>
              <div className="col-4"><div className="text-muted">Total</div><div className="fs-5 fw-bold">{fmt(o.bachadas * o.kgBachada)} kg</div></div>
            </div>
            <table className="table table-sm table-bordered small mb-2">
              <thead className="table-light"><tr><th>Insumo</th><th className="text-end">Bachada (kg)</th><th className="text-end">Producción (kg)</th></tr></thead>
              <tbody>
                {(o.ingredientes || []).map((i) => (
                  <tr key={String(i.materiaPrima)}>
                    <td>{i.nombre}</td>
                    <td className="text-end">{fmt(i.kgBachada)}</td>
                    <td className="text-end fw-semibold">{fmt((i.kgBachada || 0) * o.bachadas)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="fw-bold"><td>Total</td><td className="text-end">{fmt(o.kgBachada)}</td><td className="text-end">{fmt(o.kgBachada * o.bachadas)}</td></tr></tfoot>
            </table>
            {o.observaciones && <div className="small mb-2"><i className="bi bi-chat-left-text me-1"></i>{o.observaciones}</div>}
            <div className="small mt-2">
              Hecho: <strong>{fmt(o.bachadasHechas)}</strong> de {fmt(o.bachadas)} bachadas
              {granel ? (o.kgPesados > 0 && <> · {fmt(o.kgPesados)} kg pesados</>) : (o.bolsasProducidas > 0 && <> · {fmt(o.bolsasProducidas, 0)} bolsas</>)}
            </div>
            <div className="progress my-1" style={{ height: 6 }}>
              <div className={`progress-bar ${o.estado === "completa" ? "bg-success" : "bg-warning"}`} style={{ width: `${pct}%` }}></div>
            </div>
            {vivas.length > 0 && (
              <ul className="small text-muted mb-2 ps-3">
                {vivas.map((t) => (
                  <li key={t._id}>
                    {formatearFechaLocal(t.fecha)}: {fmt(t.bachadas)} bachadas →{" "}
                    {!granel && `${fmt(t.bolsas, 0)} bolsas`}
                    {granel && t.envioAlimento && `camión ${fmt(t.kgPesados)} kg (envío ${t.envioAlimento.numero}${t.envioAlimento.estado === "aceptado" ? ", recibido" : ""})`}
                    {granel && !t.envioAlimento && (
                      <>
                        <span className="badge bg-warning text-dark">Listo para cargar · {fmt(t.kg)} kg</span>{" "}
                        <button className="btn btn-sm btn-primary py-0 ms-1" onClick={() => cargarCamion(o, t)}>
                          <i className="bi bi-truck me-1"></i>Cargar camión
                        </button>
                      </>
                    )}
                    {t.registradoPor?.nombreUsuario && ` · ${t.registradoPor.nombreUsuario}`}
                  </li>
                ))}
              </ul>
            )}
            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => imprimirPlanillaDosificacion(o, { destinos })}>
                <i className="bi bi-printer me-1"></i>Imprimir
              </button>
              {o.estado !== "completa" && (
                <button className="btn btn-sm btn-success" onClick={() => setCarga(o)}>
                  <i className="bi bi-check2-circle me-1"></i>{granel ? "Terminé bachadas" : "Cargar bolsas"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div></div>
        <button className="btn btn-sm btn-outline-secondary" onClick={cargar}><i className="bi bi-arrow-clockwise"></i></button>
      </div>
      {abiertas.length === 0 ? (
        <div className="text-muted text-center py-4">No hay planillas por hacer.</div>
      ) : (
        <div className="row g-3">{abiertas.map(Tarjeta)}</div>
      )}
      {terminadas.length > 0 && (
        <div className="mt-3">
          <button className="btn btn-sm btn-link px-0" onClick={() => setVerTerminadas((v) => !v)}>
            {verTerminadas ? "Ocultar" : "Ver"} las últimas terminadas ({terminadas.length})
          </button>
          {verTerminadas && <div className="row g-3 mt-1">{terminadas.map(Tarjeta)}</div>}
        </div>
      )}
      {carga && <CargaPlanillaModal orden={carga} insumos={datos?.insumos} saving={saving} onClose={() => setCarga(null)} onGuardar={guardar} />}
    </>
  );
};

export default PlanillasProduccion;
