import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { formatearFechaLocal, obtenerFechaHoy } from "../../utils/dateUtils";
import {
  obtenerConstantesPlanta,
  obtenerStockPlanta,
  obtenerMateriasPrimas,
  guardarMateriaPrima,
  obtenerMovimientosMateriaPrima,
  ingresarMateriaPrima,
  obtenerFormulas,
  guardarFormula,
  guardarAlimentoBalanceado,
  obtenerOrdenesElaboracion,
  crearOrdenElaboracion,
  registrarTandaElaboracion,
  anularTandaElaboracion,
  cerrarOrdenElaboracion,
  anularOrdenElaboracion,
  obtenerOrdenesEnvio,
  crearOrdenEnvio,
  anularOrdenEnvio,
} from "../../services/api";

/**
 * Planta de alimento de Forratuc (2026-11-04, pedido del usuario).
 *
 *   Materia prima (kg) → Fórmula (% por alimento + kg de la bolsa)
 *     → Orden de elaboración (N bolsas), producida POR TANDAS: cada tanda
 *       descuenta su materia prima y suma bolsas a la planta
 *     → Orden de envío: de la planta a un depósito o galpón (la Forrajería es
 *       la del mostrador).
 *
 * ⚠️ La materia prima y uno de los galpones van EMULADOS hasta tener los
 * nombres reales (se editan acá y en utils/forratuc.js del back).
 */

const fmt = (n, dec = 0) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: dec });
const ESTADO = {
  pendiente: { texto: "Pendiente", clase: "bg-secondary" },
  en_proceso: { texto: "En proceso", clase: "bg-warning text-dark" },
  completa: { texto: "Completa", clase: "bg-success" },
  anulada: { texto: "Anulada", clase: "bg-light text-muted border" },
};
const fechaInput = (d) => (d ? String(d).slice(0, 10) : obtenerFechaHoy());

// Modal genérico (Bootstrap sin JS, como el resto de las pantallas).
const Modal = ({ titulo, onClose, onSubmit, saving, children, ancho = "", textoOk = "Guardar" }) => (
  <>
    <div className="modal d-block" tabIndex="-1" role="dialog">
      <div className={`modal-dialog ${ancho}`} role="document">
        <form className="modal-content" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
          <div className="modal-header">
            <h5 className="modal-title">{titulo}</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <div className="modal-body">{children}</div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
              {onSubmit ? "Cancelar" : "Cerrar"}
            </button>
            {onSubmit && (
              <button type="submit" className="btn btn-success" disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check-lg me-1"></i>}
                {textoOk}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
    <div className="modal-backdrop show"></div>
  </>
);

const ForratucPlantaPage = () => {
  const navigate = useNavigate();
  const [solapa, setSolapa] = useState("elaboracion");
  const [loading, setLoading] = useState(true);
  const [constantes, setConstantes] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [stockPlanta, setStockPlanta] = useState([]);
  const [modal, setModal] = useState(null); // { tipo, ...datos }
  const [saving, setSaving] = useState(false);
  const [abierta, setAbierta] = useState(null); // orden con las tandas a la vista

  const cargar = useCallback(async () => {
    try {
      const [cs, mps, fs, os, es, sp] = await Promise.all([
        obtenerConstantesPlanta(), obtenerMateriasPrimas(), obtenerFormulas(),
        obtenerOrdenesElaboracion(), obtenerOrdenesEnvio(), obtenerStockPlanta(),
      ]);
      setConstantes(cs);
      setMaterias(mps);
      setFormulas(fs);
      setOrdenes(os);
      setEnvios(es);
      setStockPlanta(sp);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar la planta.", "error");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const mpPorId = useMemo(() => new Map(materias.map((m) => [String(m._id), m])), [materias]);
  // Las bolsas que se pueden elaborar: cada una con la fórmula de su alimento
  // (la receta es del alimento; los kg, de la bolsa — 2026-11-06).
  const bolsas = useMemo(() => formulas.flatMap((f) => (f.bolsas || []).map((b) => ({
    ...b, alimentoActivo: f.activo, formula: f.formula, conFormula: !!f.formula?.ingredientes?.length,
  }))), [formulas]);
  const formulaDe = useMemo(() => new Map(bolsas.map((b) => [b.producto, b])), [bolsas]);
  const destinos = constantes?.depositosDestino || [];
  const etiquetaDestino = (k) => destinos.find((d) => d.key === k)?.etiqueta || k;

  // Ejecuta una acción con el spinner del modal, recarga y avisa.
  const hacer = async (fn, exito) => {
    setSaving(true);
    try {
      await fn();
      setModal(null);
      await cargar();
      if (exito) Swal.fire({ icon: "success", title: exito, timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };
  const confirmar = async (titulo, texto, fn, exito) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning", title: titulo, text: texto, showCancelButton: true,
      confirmButtonText: "Sí", cancelButtonText: "Volver", confirmButtonColor: "#dc3545",
    });
    if (isConfirmed) await hacer(fn, exito);
  };
  const set = (cambios) => setModal((m) => ({ ...m, ...cambios }));

  // Lo que consume una tanda (o una orden) de N bolsas, contra el stock.
  const consumoDe = (kgPorBolsa, ingredientes, bolsas) =>
    (ingredientes || []).map((i) => {
      const id = String(i.materiaPrima?._id || i.materiaPrima);
      const kg = Math.round(((Number(bolsas) || 0) * kgPorBolsa * i.porcentaje) / 100 * 100) / 100;
      const hay = mpPorId.get(id)?.kg || 0;
      return { id, nombre: i.nombre || mpPorId.get(id)?.nombre || "?", kg, hay, falta: kg > hay };
    });

  const TablaConsumo = ({ filas }) => (
    <table className="table table-sm small mb-0">
      <thead><tr><th>Materia prima</th><th className="text-end">Usa</th><th className="text-end">Hay</th></tr></thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.id} className={f.falta ? "table-danger" : ""}>
            <td>{f.nombre}</td>
            <td className="text-end">{fmt(f.kg, 2)} kg</td>
            <td className="text-end">{fmt(f.hay, 2)} kg</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ══════════ Solapas ══════════
  const SOLAPAS = [
    ["elaboracion", "bi-gear", "Elaboración"],
    ["envios", "bi-truck", "Envíos"],
    ["formulas", "bi-journal-richtext", "Alimentos y fórmulas"],
    ["materia", "bi-basket2", "Materia prima"],
  ];

  const conFormula = bolsas.filter((b) => b.conFormula && b.activo && b.alimentoActivo);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h1 className="h3 mb-0">
            <button className="btn btn-outline-secondary btn-sm me-2 align-middle" onClick={() => navigate("/forratuc")}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <i className="bi bi-gear-wide-connected me-2 text-secondary"></i>
            Planta de alimento
          </h1>
        </div>

        <ul className="nav nav-tabs mb-3">
          {SOLAPAS.map(([k, icono, texto]) => (
            <li className="nav-item" key={k}>
              <button className={`nav-link ${solapa === k ? "active" : ""}`} onClick={() => setSolapa(k)}>
                <i className={`bi ${icono} me-1`}></i>{texto}
              </button>
            </li>
          ))}
        </ul>

        {loading ? (
          <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>
        ) : (
          <>
            {/* ─────────── ELABORACIÓN ─────────── */}
            {solapa === "elaboracion" && (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="small text-muted">
                      Se pide una cantidad de bolsas; a medida que se produce se cargan las tandas, y cada una descuenta su materia prima.
                    </div>
                    <button className="btn btn-primary btn-sm" disabled={conFormula.length === 0}
                      title={conFormula.length === 0 ? "Primero cargá la fórmula de un alimento (y que tenga su bolsa en Productos)" : undefined}
                      onClick={() => setModal({ tipo: "orden", producto: conFormula[0]?.producto || "", bolsas: "", fecha: obtenerFechaHoy(), observaciones: "" })}>
                      <i className="bi bi-plus-lg me-1"></i>Nueva orden
                    </button>
                  </div>
                  {ordenes.length === 0 ? (
                    <div className="text-muted text-center py-4">Todavía no hay órdenes de elaboración.</div>
                  ) : (
                    <table className="table table-sm table-hover align-middle">
                      <thead>
                        <tr>
                          <th>N°</th><th>Fecha</th><th>Alimento</th>
                          <th className="text-end">Pedidas</th><th style={{ width: "22%" }}>Producidas</th><th>Estado</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenes.map((o) => {
                          const pct = Math.min(100, Math.round((o.bolsasProducidas / o.bolsasPedidas) * 100));
                          const vivas = o.tandas.filter((t) => !t.anulada);
                          return (
                            <React.Fragment key={o._id}>
                              <tr className={o.estado === "anulada" ? "text-muted" : ""}>
                                <td className="fw-semibold">{o.numero}</td>
                                <td>{formatearFechaLocal(o.fecha)}</td>
                                <td>{o.productoNombre}<div className="small text-muted">bolsa de {fmt(o.kgPorBolsa, 2)} kg</div></td>
                                <td className="text-end">{fmt(o.bolsasPedidas)}</td>
                                <td>
                                  <div className="small">{fmt(o.bolsasProducidas)} bolsas</div>
                                  <div className="progress" style={{ height: 6 }}>
                                    <div className={`progress-bar ${o.estado === "completa" ? "bg-success" : "bg-warning"}`} style={{ width: `${pct}%` }}></div>
                                  </div>
                                </td>
                                <td><span className={`badge ${ESTADO[o.estado]?.clase}`}>{ESTADO[o.estado]?.texto}</span></td>
                                <td className="text-end text-nowrap">
                                  {["pendiente", "en_proceso"].includes(o.estado) && (
                                    <button className="btn btn-sm btn-success me-1"
                                      onClick={() => setModal({ tipo: "tanda", orden: o, bolsas: String(o.bolsasPedidas - o.bolsasProducidas), fecha: obtenerFechaHoy() })}>
                                      <i className="bi bi-plus-circle me-1"></i>Tanda
                                    </button>
                                  )}
                                  {vivas.length > 0 && (
                                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setAbierta(abierta === o._id ? null : o._id)}>
                                      {vivas.length} tanda{vivas.length === 1 ? "" : "s"} <i className={`bi bi-chevron-${abierta === o._id ? "up" : "down"}`}></i>
                                    </button>
                                  )}
                                  {o.estado === "en_proceso" && (
                                    <button className="btn btn-sm btn-outline-primary me-1" title="Cerrar con menos de lo pedido"
                                      onClick={() => confirmar(`¿Cerrar ${o.numero}?`, `Se dio por terminada con ${o.bolsasProducidas} de ${o.bolsasPedidas} bolsas.`,
                                        () => cerrarOrdenElaboracion(o._id), "Orden cerrada")}>
                                      Cerrar
                                    </button>
                                  )}
                                  {o.estado === "pendiente" && (
                                    <button className="btn btn-sm btn-outline-danger" title="Anular la orden"
                                      onClick={() => confirmar(`¿Anular ${o.numero}?`, "No tiene nada producido.", () => anularOrdenElaboracion(o._id), "Orden anulada")}>
                                      <i className="bi bi-x-lg"></i>
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {abierta === o._id && vivas.map((t) => (
                                <tr key={t._id} className="table-light small">
                                  <td></td>
                                  <td>{formatearFechaLocal(t.fecha)}</td>
                                  <td colSpan={3}>
                                    <strong>{fmt(t.bolsas)} bolsas</strong> ({fmt(t.kg, 2)} kg) — usó{" "}
                                    {t.consumos.map((c) => `${c.nombre} ${fmt(c.kg, 2)} kg`).join(" · ")}
                                    {t.registradoPor?.nombreUsuario && <span className="text-muted"> · {t.registradoPor.nombreUsuario}</span>}
                                  </td>
                                  <td colSpan={2} className="text-end">
                                    <button className="btn btn-sm btn-link text-danger p-0"
                                      onClick={() => confirmar("¿Anular la tanda?", "Se devuelve la materia prima y las bolsas salen de la planta.",
                                        () => anularTandaElaboracion(o._id, t._id), "Tanda anulada")}>
                                      anular tanda
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ─────────── ENVÍOS ─────────── */}
            {solapa === "envios" && (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div className="small">
                      <span className="text-muted me-2">En la planta:</span>
                      {stockPlanta.length === 0 ? (
                        <span className="text-muted">nada para enviar</span>
                      ) : (
                        stockPlanta.map((s) => (
                          <span key={s.producto} className="badge text-bg-light border me-1">{s.nombre}: {fmt(s.bolsas)} bolsas</span>
                        ))
                      )}
                    </div>
                    <button className="btn btn-primary btn-sm" disabled={stockPlanta.length === 0}
                      onClick={() => setModal({ tipo: "envio", destino: destinos.find((d) => d.key === "forrajeria")?.key || destinos[0]?.key, fecha: obtenerFechaHoy(), observaciones: "", lineas: [{ producto: stockPlanta[0]?.producto, bolsas: "" }] })}>
                      <i className="bi bi-truck me-1"></i>Nuevo envío
                    </button>
                  </div>
                  {envios.length === 0 ? (
                    <div className="text-muted text-center py-4">Todavía no hay envíos.</div>
                  ) : (
                    <table className="table table-sm table-hover align-middle">
                      <thead><tr><th>N°</th><th>Fecha</th><th>Destino</th><th>Lleva</th><th>Estado</th><th></th></tr></thead>
                      <tbody>
                        {envios.map((e) => (
                          <tr key={e._id} className={e.estado === "anulada" ? "text-muted" : ""}>
                            <td className="fw-semibold">{e.numero}</td>
                            <td>{formatearFechaLocal(e.fecha)}</td>
                            <td>{etiquetaDestino(e.destino)}</td>
                            <td className="small">{e.lineas.map((l) => `${l.nombre}: ${fmt(l.bolsas)} bolsas`).join(" · ")}</td>
                            <td>{e.estado === "anulada" ? <span className="badge bg-light text-muted border">Anulado</span> : <span className="badge bg-success">Enviado</span>}</td>
                            <td className="text-end">
                              {e.estado !== "anulada" && (
                                <button className="btn btn-sm btn-link text-danger p-0"
                                  onClick={() => confirmar(`¿Anular ${e.numero}?`, "Sale del destino y vuelve a la planta (si el destino todavía lo tiene).",
                                    () => anularOrdenEnvio(e._id), "Envío anulado")}>
                                  anular
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ─────────── FÓRMULAS ─────────── */}
            {solapa === "formulas" && (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div className="small text-muted" style={{ maxWidth: 720 }}>
                      El <strong>alimento</strong> es la receta: su nombre es el mismo en toda la app (planta, stock, ventas
                      y envío a granjas) y se cambia acá. Lleva su fórmula en <strong>porcentajes</strong> (suman 100).
                      Las <strong>bolsas</strong> (40 kg, 25 kg…) se dan de alta en Productos, cada una con su precio y su stock:
                      una tanda de N bolsas usa N × kg de la bolsa × % de cada materia prima.
                    </div>
                    <button className="btn btn-outline-primary btn-sm" onClick={() => setModal({ tipo: "alimento", _id: null, nombre: "", activo: true })}>
                      <i className="bi bi-plus-lg me-1"></i>Nuevo alimento
                    </button>
                  </div>
                  <table className="table table-sm table-hover align-middle">
                    <thead><tr><th>Alimento</th><th>Bolsas</th><th>Fórmula</th><th></th></tr></thead>
                    <tbody>
                      {formulas.map((f) => (
                        <tr key={f.alimento} className={f.activo ? "" : "text-muted"}>
                          <td>{f.nombre}{!f.activo && <span className="badge bg-secondary ms-2">Inactivo</span>}</td>
                          <td className="small">
                            {f.bolsas?.length
                              ? f.bolsas.map((b) => `${b.codigo} · ${fmt(b.kgBolsa, 2)} kg`).join(" / ")
                              : <span className="text-warning-emphasis">sin bolsa (alta en Productos)</span>}
                          </td>
                          <td className="small">
                            {f.formula?.ingredientes?.length
                              ? f.formula.ingredientes.map((i) => `${i.materiaPrima?.nombre || "?"} ${fmt(i.porcentaje, 2)}%`).join(" · ")
                              : <span className="badge bg-warning text-dark">Sin fórmula</span>}
                          </td>
                          <td className="text-end text-nowrap">
                            <button className="btn btn-sm btn-link p-0 me-3" title="Fórmula"
                              onClick={() => setModal({
                                tipo: "formula", alimento: f,
                                ingredientes: f.formula?.ingredientes?.length
                                  ? f.formula.ingredientes.map((i) => ({ materiaPrima: String(i.materiaPrima?._id || i.materiaPrima), porcentaje: String(i.porcentaje) }))
                                  : [{ materiaPrima: "", porcentaje: "" }],
                                observaciones: f.formula?.observaciones || "",
                              })}>
                              <i className="bi bi-journal-richtext"></i>
                            </button>
                            <button className="btn btn-sm btn-link p-0" title="Nombre y activo"
                              onClick={() => setModal({ tipo: "alimento", _id: f._id, nombre: f.nombre, activo: f.activo })}>
                              <i className="bi bi-pencil"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─────────── MATERIA PRIMA ─────────── */}
            {solapa === "materia" && (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div className="small text-warning-emphasis">
                      <i className="bi bi-info-circle me-1"></i>
                      Los nombres son de ejemplo hasta tener los reales: se cambian con el lápiz.
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setModal({ tipo: "mp", _id: null, codigo: "", nombre: "", activo: true })}>
                        <i className="bi bi-plus-lg me-1"></i>Nueva materia prima
                      </button>
                      <button className="btn btn-primary btn-sm"
                        onClick={() => setModal({ tipo: "ingresoMP", materiaPrima: materias.find((m) => m.activo)?._id || "", kg: "", fecha: obtenerFechaHoy(), observaciones: "" })}>
                        <i className="bi bi-box-arrow-in-down me-1"></i>Ingresar materia prima
                      </button>
                    </div>
                  </div>
                  <table className="table table-sm table-hover align-middle">
                    <thead><tr><th>Código</th><th>Nombre</th><th className="text-end">Stock</th><th></th></tr></thead>
                    <tbody>
                      {materias.map((m) => (
                        <tr key={m._id} className={m.activo ? "" : "text-muted"}>
                          <td className="fw-semibold">{m.codigo}</td>
                          <td>{m.nombre}{!m.activo && <span className="badge bg-secondary ms-2">Inactiva</span>}</td>
                          <td className={`text-end ${m.kg < 0 ? "text-danger" : ""}`}>{fmt(m.kg, 2)} kg</td>
                          <td className="text-end text-nowrap">
                            <button className="btn btn-sm btn-link p-0 me-3" title="Movimientos"
                              onClick={async () => {
                                try {
                                  setModal({ tipo: "movsMP", mp: m, movs: await obtenerMovimientosMateriaPrima(m._id) });
                                } catch (err) {
                                  Swal.fire("Error", err.message, "error");
                                }
                              }}>
                              <i className="bi bi-list-ul"></i>
                            </button>
                            <button className="btn btn-sm btn-link p-0" title="Editar"
                              onClick={() => setModal({ tipo: "mp", _id: m._id, codigo: m.codigo, nombre: m.nombre, activo: m.activo })}>
                              <i className="bi bi-pencil"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ MODALES ══════════ */}
        {modal?.tipo === "orden" && (() => {
          const b = formulaDe.get(modal.producto);
          const f = b?.formula;
          const kgBolsa = b?.kgBolsa || 0;
          const filas = f ? consumoDe(kgBolsa, f.ingredientes, modal.bolsas) : [];
          return (
            <Modal titulo="Nueva orden de elaboración" saving={saving} onClose={() => setModal(null)} textoOk="Pedir"
              onSubmit={() => hacer(() => crearOrdenElaboracion({
                producto: modal.producto, bolsas: Number(modal.bolsas), fecha: modal.fecha, observaciones: modal.observaciones,
              }), "Orden creada")}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-semibold small mb-1">Alimento y bolsa</label>
                  <select className="form-select" value={modal.producto} onChange={(e) => set({ producto: e.target.value })}>
                    {bolsas.filter((x) => (x.activo && x.alimentoActivo) || x.producto === modal.producto).map((x) => (
                      <option key={x.producto} value={x.producto} disabled={!x.conFormula}>
                        {x.codigo} · {x.nombre}{!x.conFormula ? " (sin fórmula)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">Bolsas</label>
                  <input type="number" min="1" step="1" className="form-control" value={modal.bolsas} required autoFocus
                    onChange={(e) => set({ bolsas: e.target.value })} />
                  {f && <div className="form-text">Bolsa de {fmt(kgBolsa, 2)} kg = {fmt((Number(modal.bolsas) || 0) * kgBolsa, 2)} kg</div>}
                </div>
                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" value={modal.fecha} onChange={(e) => set({ fecha: e.target.value })} />
                </div>
                <div className="col-12">
                  <input className="form-control form-control-sm" placeholder="Observaciones (opcional)" value={modal.observaciones}
                    onChange={(e) => set({ observaciones: e.target.value })} />
                </div>
                {Number(modal.bolsas) > 0 && filas.length > 0 && (
                  <div className="col-12">
                    <div className="small fw-semibold mb-1">Materia prima para toda la orden</div>
                    <TablaConsumo filas={filas} />
                    {filas.some((x) => x.falta) && (
                      <div className="small text-danger mt-1">
                        Hoy no alcanza para toda la orden: se puede pedir igual, pero cada tanda se controla al producirla.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Modal>
          );
        })()}

        {modal?.tipo === "tanda" && (() => {
          const o = modal.orden;
          const filas = consumoDe(o.kgPorBolsa, o.ingredientes, modal.bolsas);
          const faltan = o.bolsasPedidas - o.bolsasProducidas;
          return (
            <Modal titulo={`Tanda de ${o.numero} — ${o.productoNombre}`} saving={saving} onClose={() => setModal(null)} textoOk="Registrar tanda"
              onSubmit={() => hacer(() => registrarTandaElaboracion(o._id, { bolsas: Number(modal.bolsas), fecha: modal.fecha }), "Tanda registrada")}>
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">Bolsas producidas</label>
                  <input type="number" min="1" max={faltan} step="1" className="form-control" value={modal.bolsas} required autoFocus
                    onChange={(e) => set({ bolsas: e.target.value })} />
                  <div className="form-text">Faltan {fmt(faltan)} de {fmt(o.bolsasPedidas)}.</div>
                </div>
                <div className="col-6">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" max={obtenerFechaHoy()} value={modal.fecha} onChange={(e) => set({ fecha: e.target.value })} />
                </div>
                <div className="col-12">
                  <div className="small fw-semibold mb-1">Se descuenta</div>
                  <TablaConsumo filas={filas} />
                  {filas.some((x) => x.falta) && <div className="small text-danger mt-1">No alcanza la materia prima marcada en rojo.</div>}
                </div>
              </div>
            </Modal>
          );
        })()}

        {modal?.tipo === "envio" && (() => {
          const hayDe = (p) => stockPlanta.find((s) => s.producto === p)?.bolsas || 0;
          const setLinea = (i, c) => set({ lineas: modal.lineas.map((l, j) => (j === i ? { ...l, ...c } : l)) });
          return (
            <Modal titulo="Nuevo envío desde la planta" ancho="modal-lg" saving={saving} onClose={() => setModal(null)} textoOk="Enviar"
              onSubmit={() => hacer(() => crearOrdenEnvio({
                destino: modal.destino, fecha: modal.fecha, observaciones: modal.observaciones,
                lineas: modal.lineas.filter((l) => l.producto && Number(l.bolsas) > 0).map((l) => ({ producto: l.producto, bolsas: Number(l.bolsas) })),
              }), "Envío registrado")}>
              <div className="row g-3">
                <div className="col-md-7">
                  <label className="form-label fw-semibold small mb-1">Destino</label>
                  <select className="form-select" value={modal.destino} onChange={(e) => set({ destino: e.target.value })}>
                    {destinos.map((d) => <option key={d.key} value={d.key}>{d.etiqueta}</option>)}
                  </select>
                </div>
                <div className="col-md-5">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" max={obtenerFechaHoy()} value={modal.fecha} onChange={(e) => set({ fecha: e.target.value })} />
                </div>
                <div className="col-12">
                  <table className="table table-sm align-middle mb-1">
                    <thead><tr><th>Alimento</th><th style={{ width: "9rem" }}>Bolsas</th><th className="text-end">En planta</th><th></th></tr></thead>
                    <tbody>
                      {modal.lineas.map((l, i) => (
                        <tr key={i} className={Number(l.bolsas) > hayDe(l.producto) ? "table-danger" : ""}>
                          <td>
                            <select className="form-select form-select-sm" value={l.producto || ""} onChange={(e) => setLinea(i, { producto: e.target.value })}>
                              {stockPlanta.map((s) => <option key={s.producto} value={s.producto}>{s.codigo} · {s.nombre}</option>)}
                            </select>
                          </td>
                          <td>
                            <input type="number" min="1" step="1" className="form-control form-control-sm" value={l.bolsas}
                              onChange={(e) => setLinea(i, { bolsas: e.target.value })} />
                          </td>
                          <td className="text-end small">{fmt(hayDe(l.producto))}</td>
                          <td className="text-end">
                            {modal.lineas.length > 1 && (
                              <button type="button" className="btn btn-sm btn-link text-danger p-0"
                                onClick={() => set({ lineas: modal.lineas.filter((_, j) => j !== i) })}>
                                <i className="bi bi-x-lg"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    onClick={() => set({ lineas: [...modal.lineas, { producto: stockPlanta[0]?.producto, bolsas: "" }] })}>
                    <i className="bi bi-plus-lg me-1"></i>Otro alimento
                  </button>
                </div>
                <div className="col-12">
                  <input className="form-control form-control-sm" placeholder="Observaciones (opcional)" value={modal.observaciones}
                    onChange={(e) => set({ observaciones: e.target.value })} />
                </div>
              </div>
            </Modal>
          );
        })()}

        {modal?.tipo === "formula" && (() => {
          const total = modal.ingredientes.reduce((a, i) => a + (Number(i.porcentaje) || 0), 0);
          const cierra = Math.abs(total - 100) < 0.01;
          const setIng = (i, c) => set({ ingredientes: modal.ingredientes.map((x, j) => (j === i ? { ...x, ...c } : x)) });
          return (
            <Modal titulo={`Fórmula — ${modal.alimento.nombre}`} ancho="modal-lg" saving={saving} onClose={() => setModal(null)}
              onSubmit={() => hacer(() => guardarFormula(modal.alimento.alimento, {
                ingredientes: modal.ingredientes.filter((i) => i.materiaPrima).map((i) => ({ materiaPrima: i.materiaPrima, porcentaje: Number(i.porcentaje) })),
                observaciones: modal.observaciones,
              }), "Fórmula guardada")}>
              <div className="row g-3">
                <div className="col-12">
                  <table className="table table-sm align-middle mb-1">
                    <thead><tr><th>Materia prima</th><th style={{ width: "8rem" }}>%</th>
                      <th className="text-end" style={{ width: "9rem" }}>Kg en 100 kg</th><th></th></tr></thead>
                    <tbody>
                      {modal.ingredientes.map((ing, i) => (
                        <tr key={i}>
                          <td>
                            <select className="form-select form-select-sm" value={ing.materiaPrima} onChange={(e) => setIng(i, { materiaPrima: e.target.value })}>
                              <option value="">Elegí…</option>
                              {materias.filter((m) => m.activo || String(m._id) === ing.materiaPrima).map((m) => (
                                <option key={m._id} value={String(m._id)}>{m.codigo} · {m.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input type="number" min="0" step="0.01" className="form-control form-control-sm" value={ing.porcentaje}
                              onChange={(e) => setIng(i, { porcentaje: e.target.value })} />
                          </td>
                          <td className="text-end small">
                            {fmt(Number(ing.porcentaje) || 0, 2)} kg
                          </td>
                          <td className="text-end">
                            {modal.ingredientes.length > 1 && (
                              <button type="button" className="btn btn-sm btn-link text-danger p-0"
                                onClick={() => set({ ingredientes: modal.ingredientes.filter((_, j) => j !== i) })}>
                                <i className="bi bi-x-lg"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="text-end fw-semibold">Total</td>
                        <td className={`fw-semibold ${cierra ? "text-success" : "text-danger"}`}>{fmt(total, 2)}%</td>
                        <td colSpan={2} className="small text-muted">{cierra ? "" : "tiene que dar 100%"}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    onClick={() => set({ ingredientes: [...modal.ingredientes, { materiaPrima: "", porcentaje: "" }] })}>
                    <i className="bi bi-plus-lg me-1"></i>Otro ingrediente
                  </button>
                </div>
                <div className="col-12">
                  <input className="form-control form-control-sm" placeholder="Observaciones (opcional)" value={modal.observaciones}
                    onChange={(e) => set({ observaciones: e.target.value })} />
                  <div className="form-text">Cambiar la fórmula no cambia las órdenes ya pedidas: cada una guarda la que tenía al pedirse.</div>
                </div>
              </div>
            </Modal>
          );
        })()}

        {modal?.tipo === "alimento" && (
          <Modal titulo={modal._id ? "Editar alimento" : "Nuevo alimento"} saving={saving} onClose={() => setModal(null)}
            onSubmit={() => hacer(() => guardarAlimentoBalanceado(modal._id, { nombre: modal.nombre, activo: modal.activo }), "Alimento guardado")}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-semibold small mb-1">Nombre</label>
                <input className="form-control" value={modal.nombre} required autoFocus maxLength={80}
                  placeholder="Ej.: Postura Fase 1 (sin el peso: los kg son de la bolsa)"
                  onChange={(e) => set({ nombre: e.target.value })} />
                <div className="form-text">
                  Cambia en toda la app: el nombre de sus bolsas, la planta, el stock, las ventas y el envío a granjas.
                  Lo ya emitido (presupuestos, órdenes) queda como se imprimió.
                </div>
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input id="alimActivo" type="checkbox" className="form-check-input" checked={modal.activo}
                    onChange={(e) => set({ activo: e.target.checked })} />
                  <label htmlFor="alimActivo" className="form-check-label">Activo</label>
                </div>
                {!modal.activo && modal._id && (
                  <div className="form-text text-warning-emphasis">Dado de baja: sus bolsas dejan de venderse y no se elabora ni se envía.</div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {modal?.tipo === "mp" && (
          <Modal titulo={modal._id ? "Editar materia prima" : "Nueva materia prima"} saving={saving} onClose={() => setModal(null)}
            onSubmit={() => hacer(() => guardarMateriaPrima(modal._id, { codigo: modal.codigo, nombre: modal.nombre, activo: modal.activo }), "Guardada")}>
            <div className="row g-3">
              <div className="col-4">
                <label className="form-label fw-semibold small mb-1">Código</label>
                <input className="form-control" value={modal.codigo} required onChange={(e) => set({ codigo: e.target.value })} />
              </div>
              <div className="col-8">
                <label className="form-label fw-semibold small mb-1">Nombre</label>
                <input className="form-control" value={modal.nombre} required autoFocus onChange={(e) => set({ nombre: e.target.value })} />
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input id="mpActivo" type="checkbox" className="form-check-input" checked={modal.activo}
                    onChange={(e) => set({ activo: e.target.checked })} />
                  <label htmlFor="mpActivo" className="form-check-label">Activa (se puede usar en las fórmulas)</label>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {modal?.tipo === "ingresoMP" && (
          <Modal titulo="Ingresar materia prima" saving={saving} onClose={() => setModal(null)} textoOk="Ingresar"
            onSubmit={() => hacer(() => ingresarMateriaPrima({
              materiaPrima: modal.materiaPrima, kg: Number(modal.kg), fecha: modal.fecha, observaciones: modal.observaciones,
            }), "Ingreso registrado")}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-semibold small mb-1">Materia prima</label>
                <select className="form-select" value={modal.materiaPrima} onChange={(e) => set({ materiaPrima: e.target.value })}>
                  {materias.filter((m) => m.activo).map((m) => <option key={m._id} value={m._id}>{m.codigo} · {m.nombre}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold small mb-1">Kg</label>
                <input type="number" min="0.01" step="0.01" className="form-control" value={modal.kg} required autoFocus
                  onChange={(e) => set({ kg: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold small mb-1">Fecha</label>
                <input type="date" className="form-control" max={obtenerFechaHoy()} value={modal.fecha} onChange={(e) => set({ fecha: e.target.value })} />
              </div>
              <div className="col-12">
                <input className="form-control form-control-sm" placeholder="Observaciones (proveedor, remito…)" value={modal.observaciones}
                  onChange={(e) => set({ observaciones: e.target.value })} />
              </div>
            </div>
          </Modal>
        )}

        {modal?.tipo === "movsMP" && (
          <Modal titulo={`${modal.mp.codigo} · ${modal.mp.nombre}`} ancho="modal-lg" onClose={() => setModal(null)}>
            {modal.movs.length === 0 ? (
              <div className="text-muted text-center py-3">Sin movimientos.</div>
            ) : (
              <table className="table table-sm small align-middle mb-0">
                <thead><tr><th>Fecha</th><th>Movimiento</th><th className="text-end">Kg</th><th className="text-end">Saldo</th></tr></thead>
                <tbody>
                  {modal.movs.map((m) => (
                    <tr key={m._id}>
                      <td>{formatearFechaLocal(fechaInput(m.fecha) + "T12:00:00.000Z")}</td>
                      <td>{m.detalle}{m.usuario && <span className="text-muted"> · {m.usuario}</span>}</td>
                      <td className={`text-end ${m.delta < 0 ? "text-danger" : "text-success"}`}>{m.delta > 0 ? "+" : ""}{fmt(m.delta, 2)}</td>
                      <td className="text-end fw-semibold">{fmt(m.saldo, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Modal>
        )}
      </div>
    </Layout>
  );
};

export default ForratucPlantaPage;
