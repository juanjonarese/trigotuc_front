import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { formatearFechaLocal, obtenerFechaHoy } from "../../utils/dateUtils";
import {
  obtenerConstantesPlanta,
  obtenerMateriasPrimas,
  guardarMateriaPrima,
  obtenerMovimientosMateriaPrima,
  obtenerRemitosMateriaPrima,
  ingresarRemitoMateriaPrima,
  anularRemitoMateriaPrima,
  obtenerFormulas,
  guardarFormula,
  guardarAlimentoBalanceado,
  obtenerOrdenesElaboracion,
  crearOrdenElaboracion,
  anularTandaElaboracion,
  cerrarOrdenElaboracion,
  anularOrdenElaboracion,
} from "../../services/api";
import { imprimirPlanillaDosificacion } from "../../utils/forratuc/imprimirForratuc";

/**
 * Planta de alimento de Forratuc (2026-11-04, pedido del usuario).
 *
 *   Materia prima (kg) → Fórmula (% por alimento + kg de la bolsa)
 *     → Orden de elaboración (N bolsas), producida POR TANDAS: cada tanda
 *       descuenta su materia prima y suma bolsas a la planta
 *     → Orden de envío: de la planta a un depósito o galpón (la Forrajería es
 *       la del mostrador).
 *
 * Desde el 2026-11-21 la orden es la PLANILLA DE DOSIFICACIÓN (RAB-003): se emite
 * EN BACHADAS, en bolsa o a granel (a granel: granja + galpones). La carga
 * Producción en su pantalla (solapa "Planilla de dosificación"); acá se emite,
 * se imprime y se anula. Sin solapa de Envíos (21/11, pedido del usuario): lo
 * embolsado queda en el Depósito Producción y sale con los pedidos de Forratuc.
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

// Cómo se elabora cada alimento (28/11): sin marca, los dos.
const envasesDe = (f) => (f?.envases?.length ? f.envases : ["bolsa", "granel"]);
const enBolsa = (f) => envasesDe(f).includes("bolsa");
const aGranel = (f) => envasesDe(f).includes("granel");
const ENVASES = [["bolsa", "bi-bag", "En bolsa"], ["granel", "bi-truck", "A granel"]];

// Los dos tildes de envase, para la fórmula y el alimento.
const TildesEnvase = ({ valor, onChange, id }) => (
  <div>
    <div className="form-label fw-semibold small mb-1">Se elabora</div>
    <div className="d-flex flex-wrap gap-3">
      {ENVASES.map(([k, ic, txt]) => (
        <div key={k} className="form-check">
          <input id={`${id}-${k}`} type="checkbox" className="form-check-input" checked={valor.includes(k)}
            onChange={(e) => onChange(e.target.checked ? [...new Set([...valor, k])] : valor.filter((x) => x !== k))} />
          <label htmlFor={`${id}-${k}`} className="form-check-label"><i className={`bi ${ic} me-1`}></i>{txt}</label>
        </div>
      ))}
    </div>
    {valor.length === 0 && <div className="form-text text-danger">Marcá al menos uno.</div>}
  </div>
);

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
  const [solapa, setSolapa] = useState("formulas");
  const [loading, setLoading] = useState(true);
  const [constantes, setConstantes] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [remitosMP, setRemitosMP] = useState([]);
  const [modal, setModal] = useState(null); // { tipo, ...datos }
  const [saving, setSaving] = useState(false);
  const [abierta, setAbierta] = useState(null); // orden con las tandas a la vista

  const cargar = useCallback(async () => {
    try {
      const [cs, mps, fs, os, rs] = await Promise.all([
        obtenerConstantesPlanta(), obtenerMateriasPrimas(), obtenerFormulas(),
        obtenerOrdenesElaboracion(), obtenerRemitosMateriaPrima(),
      ]);
      setRemitosMP(rs);
      setConstantes(cs);
      setMaterias(mps);
      setFormulas(fs);
      setOrdenes(os);
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
  // Desde el 28/11 cada alimento dice si se elabora en bolsa, a granel o los dos
  // (`envases`): en bolsa se listan solo los marcados "bolsa"; a granel, los "granel".
  const bolsas = useMemo(() => formulas.filter((f) => enBolsa(f)).flatMap((f) => (f.bolsas || []).map((b) => ({
    ...b, alimentoActivo: f.activo, formula: f.formula, conFormula: !!f.formula?.ingredientes?.length,
  }))), [formulas]);
  const formulaDe = useMemo(() => new Map(bolsas.map((b) => [b.producto, b])), [bolsas]);
  const destinosGranel = constantes?.destinosGranel || [];
  // Alimentos (recetas) con fórmula, para el granel.
  const recetas = useMemo(() => formulas.filter((f) => f.activo && aGranel(f) && f.formula?.ingredientes?.length), [formulas]);
  // Abrir la fórmula de un alimento, con su envase (y la bolsa a crear si hace falta).
  const abrirFormula = (f) => setModal({
    tipo: "formula", alimento: f,
    ingredientes: f.formula?.ingredientes?.length
      ? f.formula.ingredientes.map((i) => ({ materiaPrima: String(i.materiaPrima?._id || i.materiaPrima), kg: String(i.kg) }))
      : [{ materiaPrima: "", kg: "" }],
    observaciones: f.formula?.observaciones || "",
    envases: f.envases?.length ? f.envases : ["bolsa", "granel"],
    bolsa: { codigo: "", kgBolsa: String(constantes?.kgBolsaInicial || 40), categoria: "" },
  });
  const etiquetaOrden = (o) => {
    if (o.envase !== "granel") return "Depósito Producción";
    const d = destinosGranel.find((x) => x.key === o.destino)?.etiqueta || o.destino;
    return `${d}${o.galpones?.length ? ` — galpón ${o.galpones.join(", ")}` : ""}`;
  };

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
    ["formulas", "bi-journal-richtext", "Alimentos y fórmulas"],
    ["elaboracion", "bi-gear", "Pedidos de elaboración"],
    ["materia", "bi-basket2", "Insumos"],
    ["remitos", "bi-receipt", "Remitos de compra"],
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
                    <div></div>
                    <button className="btn btn-primary btn-sm text-nowrap" disabled={recetas.length === 0 && conFormula.length === 0}
                      title={recetas.length === 0 && conFormula.length === 0 ? "Primero cargá la fórmula de un alimento" : undefined}
                      onClick={() => setModal({
                        tipo: "orden", envase: conFormula.length ? "bolsa" : "granel", producto: conFormula[0]?.producto || "", alimento: recetas[0]?.alimento || "",
                        bachadas: "", destino: destinosGranel[0]?.key || "", galpones: [], refPedido: "", fecha: obtenerFechaHoy(), observaciones: "",
                      })}>
                      <i className="bi bi-plus-lg me-1"></i>Nueva planilla
                    </button>
                  </div>
                  {ordenes.length === 0 ? (
                    <div className="text-muted text-center py-4">Todavía no hay órdenes de elaboración.</div>
                  ) : (
                    <table className="table table-sm table-hover align-middle">
                      <thead>
                        <tr>
                          <th>N°</th><th>Fecha</th><th>Alimento</th>
                          <th className="text-end">Pedido</th><th style={{ width: "22%" }}>Hecho</th><th>Estado</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenes.map((o) => {
                          const planilla = o.bachadas != null;
                          const granel = o.envase === "granel";
                          const pct = planilla
                            ? Math.min(100, Math.round(((o.bachadasHechas || 0) / o.bachadas) * 100))
                            : Math.min(100, Math.round((o.bolsasProducidas / o.bolsasPedidas) * 100));
                          const vivas = o.tandas.filter((t) => !t.anulada);
                          return (
                            <React.Fragment key={o._id}>
                              <tr className={o.estado === "anulada" ? "text-muted" : ""}>
                                <td className="fw-semibold">{o.numero}</td>
                                <td>{formatearFechaLocal(o.fecha)}</td>
                                <td>
                                  {o.productoNombre}
                                  <div className="small text-muted">
                                    {granel ? <span className="badge bg-info text-dark me-1">Granel</span> : <>bolsa de {fmt(o.kgPorBolsa, 2)} kg · </>}
                                    {planilla && etiquetaOrden(o)}
                                    {o.refPedido && <> · Ref. {o.refPedido}</>}
                                  </div>
                                </td>
                                <td className="text-end text-nowrap">{planilla ? <>{fmt(o.bachadas, 2)} bach.</> : fmt(o.bolsasPedidas)}</td>
                                <td>
                                  <div className="small">
                                    {planilla
                                      ? <>{fmt(o.bachadasHechas, 2)} bach. · {granel ? `${fmt(o.kgPesados, 2)} kg` : `${fmt(o.bolsasProducidas)} bolsas`}</>
                                      : <>{fmt(o.bolsasProducidas)} bolsas</>}
                                  </div>
                                  <div className="progress" style={{ height: 6 }}>
                                    <div className={`progress-bar ${o.estado === "completa" ? "bg-success" : "bg-warning"}`} style={{ width: `${pct}%` }}></div>
                                  </div>
                                </td>
                                <td><span className={`badge ${ESTADO[o.estado]?.clase}`}>{ESTADO[o.estado]?.texto}</span></td>
                                <td className="text-end text-nowrap">
                                  {planilla && (
                                    <button className="btn btn-sm btn-outline-secondary me-1" title="Imprimir la planilla"
                                      onClick={() => imprimirPlanillaDosificacion(o, { destinos: destinosGranel })}>
                                      <i className="bi bi-printer"></i>
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
                                    {t.bachadas != null && <>{fmt(t.bachadas, 2)} bachadas → </>}
                                    {t.envioAlimento
                                      ? <strong>{fmt(t.kgPesados, 2)} kg en la balanza (envío {t.envioAlimento.numero}{t.envioAlimento.estado === "aceptado" ? ", recibido" : ""})</strong>
                                      : <strong>{fmt(t.bolsas)} bolsas</strong>}{" "}
                                    ({fmt(t.kg, 2)} kg) — usó{" "}
                                    {t.consumos.map((c) => `${c.nombre} ${fmt(c.kg, 2)} kg`).join(" · ")}
                                    {t.registradoPor?.nombreUsuario && <span className="text-muted"> · {t.registradoPor.nombreUsuario}</span>}
                                  </td>
                                  <td colSpan={2} className="text-end">
                                    <button className="btn btn-sm btn-link text-danger p-0"
                                      onClick={() => confirmar("¿Anular la tanda?", t.envioAlimento
                                          ? `Se devuelve la materia prima y se anula el envío ${t.envioAlimento.numero} a la granja (si la granja ya usó ese alimento, no se puede).`
                                          : "Se devuelve la materia prima y las bolsas salen del depósito Producción.",
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

            {/* ─────────── FÓRMULAS ─────────── */}
            {solapa === "formulas" && (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div></div>
                    <button className="btn btn-outline-primary btn-sm" onClick={() => setModal({ tipo: "alimento", _id: null, nombre: "", activo: true, envases: ["bolsa", "granel"] })}>
                      <i className="bi bi-plus-lg me-1"></i>Nuevo alimento
                    </button>
                  </div>
                  <table className="table table-sm table-hover align-middle">
                    <thead><tr><th>Alimento</th><th>Se elabora</th><th>Bolsas</th><th>Fórmula</th><th></th></tr></thead>
                    <tbody>
                      {formulas.map((f) => (
                        <tr key={f.alimento} className={f.activo ? "" : "text-muted"}>
                          <td>{f.nombre}{!f.activo && <span className="badge bg-secondary ms-2">Inactivo</span>}</td>
                          <td className="small text-nowrap">
                            {enBolsa(f) && <span className="badge bg-light text-dark border me-1"><i className="bi bi-bag me-1"></i>Bolsa</span>}
                            {aGranel(f) && <span className="badge bg-info text-dark"><i className="bi bi-truck me-1"></i>Granel</span>}
                          </td>
                          <td className="small">
                            {f.bolsas?.length
                              ? f.bolsas.map((b) => `${b.codigo} · ${fmt(b.kgBolsa, 2)} kg`).join(" / ")
                              : enBolsa(f)
                                ? <span className="text-warning-emphasis">sin bolsa: cargala en la fórmula</span>
                                : <span className="text-muted">—</span>}
                          </td>
                          <td className="small">
                            {f.formula?.ingredientes?.length
                              ? <>
                                  {f.formula.ingredientes.map((i) => `${i.materiaPrima?.nombre || "?"} ${fmt(i.kg, 2)} kg`).join(" · ")}
                                  <span className="text-muted"> — bachada {fmt(f.formula.ingredientes.reduce((a, i) => a + (i.kg || 0), 0), 2)} kg</span>
                                </>
                              : <span className="badge bg-warning text-dark">Sin fórmula</span>}
                          </td>
                          <td className="text-end text-nowrap">
                            <button className={`btn btn-sm me-2 ${f.formula?.ingredientes?.length ? "btn-outline-primary" : "btn-primary"}`} title="Fórmula"
                              onClick={() => abrirFormula(f)}>
                              <i className="bi bi-journal-richtext me-1"></i>{f.formula?.ingredientes?.length ? "Fórmula" : "Cargar fórmula"}
                            </button>
                            <button className="btn btn-sm btn-link p-0" title="Nombre, envase y activo"
                              onClick={() => setModal({ tipo: "alimento", _id: f._id, nombre: f.nombre, activo: f.activo, envases: envasesDe(f) })}>
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
                    <div></div>
                    <button className="btn btn-outline-primary btn-sm" onClick={() => setModal({ tipo: "mp", _id: null, codigo: "", nombre: "", activo: true })}>
                      <i className="bi bi-plus-lg me-1"></i>Nuevo insumo
                    </button>
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

            {/* ─────────── REMITOS DE COMPRA (solapa propia desde el 21/11) ─────────── */}
            {solapa === "remitos" && (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                    <div></div>
                    <button className="btn btn-primary btn-sm"
                      onClick={() => setModal({ tipo: "remitoMP", proveedor: "", numeroRemito: "", fecha: obtenerFechaHoy(), observaciones: "", lineas: [{ materiaPrima: "", kg: "" }] })}>
                      <i className="bi bi-box-arrow-in-down me-1"></i>Ingresar remito de compra
                    </button>
                  </div>
                  {remitosMP.length === 0 ? (
                    <div className="text-muted text-center py-3 small">Todavía no se ingresó ningún remito.</div>
                  ) : (
                    <table className="table table-sm table-hover align-middle small">
                      <thead>
                        <tr><th>N°</th><th>Fecha</th><th>Proveedor</th><th>Remito</th><th>Insumos</th><th className="text-end">Kg</th><th></th></tr>
                      </thead>
                      <tbody>
                        {remitosMP.map((r) => {
                          const anulado = r.estado === "anulado";
                          return (
                            <tr key={r._id} className={anulado ? "text-muted text-decoration-line-through" : ""}>
                              <td className="fw-semibold text-nowrap">{r.numero}</td>
                              <td className="text-nowrap">{formatearFechaLocal(fechaInput(r.fecha) + "T12:00:00.000Z")}</td>
                              <td>{r.proveedor}</td>
                              <td className="text-nowrap">{r.numeroRemito}</td>
                              <td>
                                {r.lineas.map((l) => `${l.nombre} ${fmt(l.kg, 2)} kg`).join(" · ")}
                                {r.observaciones && <div className="text-muted">{r.observaciones}</div>}
                              </td>
                              <td className="text-end text-nowrap">{fmt(r.kgTotales, 2)}</td>
                              <td className="text-end text-nowrap">
                                {anulado ? (
                                  <span className="badge bg-light text-muted border">Anulado</span>
                                ) : (
                                  <button className="btn btn-sm btn-link text-danger p-0" title="Anular remito"
                                    onClick={() => confirmar(`¿Anular el remito ${r.numeroRemito}?`,
                                      "Se descuentan del stock los kg que trajo. Solo se puede si todavía no se usaron en elaboración.",
                                      () => anularRemitoMateriaPrima(r._id), "Remito anulado")}>
                                    <i className="bi bi-x-circle"></i>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ MODALES ══════════ */}
        {modal?.tipo === "orden" && (() => {
          const granel = modal.envase === "granel";
          const b = formulaDe.get(modal.producto);
          const receta = granel ? recetas.find((r) => r.alimento === modal.alimento) : (b ? formulas.find((x) => x.bolsas?.some((y) => y.producto === modal.producto)) : null);
          const ingredientes = (granel ? receta?.formula : b?.formula)?.ingredientes || [];
          const kgBachada = ingredientes.reduce((a, i) => a + (i.kg || 0), 0);
          const bach = Number(modal.bachadas) || 0;
          const filas = ingredientes.map((i) => {
            const id = String(i.materiaPrima?._id || i.materiaPrima);
            const kg = Math.round(bach * i.kg * 100) / 100;
            const hay = mpPorId.get(id)?.kg || 0;
            return { id, nombre: i.materiaPrima?.nombre || mpPorId.get(id)?.nombre || "?", kg, hay, falta: kg > hay };
          });
          const dest = destinosGranel.find((d) => d.key === modal.destino);
          const toggleGalpon = (g) => set({ galpones: modal.galpones.includes(g) ? modal.galpones.filter((x) => x !== g) : [...modal.galpones, g] });
          return (
            <Modal titulo="Nueva planilla de dosificación" ancho="modal-lg" saving={saving} onClose={() => setModal(null)} textoOk="Emitir"
              onSubmit={() => hacer(() => crearOrdenElaboracion({
                envase: modal.envase, bachadas: Number(modal.bachadas), fecha: modal.fecha, refPedido: modal.refPedido, observaciones: modal.observaciones,
                ...(granel ? { alimento: modal.alimento, destino: modal.destino, galpones: modal.galpones } : { producto: modal.producto }),
              }), "Planilla emitida: le aparece a Producción")}>
              <div className="row g-3">
                <div className="col-12">
                  <div className="btn-group w-100" role="group">
                    {[["bolsa", "bi-bag", "En bolsa"], ["granel", "bi-truck", "A granel (camión a la granja)"]].map(([k, ic, txt]) => (
                      <button key={k} type="button" className={`btn btn-sm ${modal.envase === k ? "btn-primary" : "btn-outline-primary"}`} onClick={() => set({ envase: k })}>
                        <i className={`bi ${ic} me-1`}></i>{txt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold small mb-1">{granel ? "Alimento" : "Alimento y bolsa"}</label>
                  {granel ? (
                    <select className="form-select" value={modal.alimento} onChange={(e) => set({ alimento: e.target.value })}>
                      {recetas.map((r) => <option key={r.alimento} value={r.alimento}>{r.nombre}</option>)}
                    </select>
                  ) : (
                    <select className="form-select" value={modal.producto} onChange={(e) => set({ producto: e.target.value })}>
                      {bolsas.filter((x) => (x.activo && x.alimentoActivo) || x.producto === modal.producto).map((x) => (
                        <option key={x.producto} value={x.producto} disabled={!x.conFormula}>
                          {x.codigo} · {x.nombre}{!x.conFormula ? " (sin fórmula)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label fw-semibold small mb-1">Bachadas</label>
                  <input type="number" min="0.01" step="0.01" className="form-control" value={modal.bachadas} required autoFocus
                    onChange={(e) => set({ bachadas: e.target.value })} />
                  {kgBachada > 0 && (
                    <div className="form-text">
                      Bachada de {fmt(kgBachada, 2)} kg = {fmt(bach * kgBachada, 2)} kg
                      {!granel && b?.kgBolsa ? ` ≈ ${fmt(Math.floor((bach * kgBachada) / b.kgBolsa))} bolsas` : ""}
                    </div>
                  )}
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" value={modal.fecha} onChange={(e) => set({ fecha: e.target.value })} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label fw-semibold small mb-1">Ref. pedido N°</label>
                  <input className="form-control" value={modal.refPedido} placeholder="opcional" onChange={(e) => set({ refPedido: e.target.value })} />
                </div>
                {granel && (
                  <>
                    <div className="col-12 col-md-5">
                      <label className="form-label fw-semibold small mb-1">Granja</label>
                      <select className="form-select" value={modal.destino} onChange={(e) => set({ destino: e.target.value, galpones: [] })}>
                        {destinosGranel.map((d) => <option key={d.key} value={d.key}>{d.etiqueta}</option>)}
                      </select>
                    </div>
                    <div className="col-12 col-md-7">
                      <label className="form-label fw-semibold small mb-1">Galpones</label>
                      <div className="d-flex flex-wrap gap-1">
                        {(dest?.galpones || []).map((g) => (
                          <button key={g} type="button" className={`btn btn-sm ${modal.galpones.includes(g) ? "btn-success" : "btn-outline-secondary"}`} onClick={() => toggleGalpon(g)}>
                            G{g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                <div className="col-12">
                  <input className="form-control form-control-sm" placeholder="Observaciones (opcional)" value={modal.observaciones}
                    onChange={(e) => set({ observaciones: e.target.value })} />
                </div>
                {bach > 0 && filas.length > 0 && (
                  <div className="col-12">
                    <div className="small fw-semibold mb-1">Insumos para toda la planilla</div>
                    <TablaConsumo filas={filas} />
                    {filas.some((x) => x.falta) && (
                      <div className="small text-danger mt-1">
                        Hoy no alcanza para toda la planilla: se puede emitir igual, pero cada carga de Producción se controla.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Modal>
          );
        })()}

        {modal?.tipo === "formula" && (() => {
          const total = modal.ingredientes.reduce((a, i) => a + (Number(i.kg) || 0), 0);
          const setIng = (i, c) => set({ ingredientes: modal.ingredientes.map((x, j) => (j === i ? { ...x, ...c } : x)) });
          // En bolsa y sin bolsa a la venta: se crea acá (28/11), sin pasar por Productos.
          const pideBolsa = modal.envases.includes("bolsa") && !modal.alimento.bolsas?.length;
          const setBolsa = (c) => set({ bolsa: { ...modal.bolsa, ...c } });
          return (
            <Modal titulo={`Fórmula — ${modal.alimento.nombre}`} ancho="modal-lg" saving={saving} onClose={() => setModal(null)}
              onSubmit={() => hacer(() => guardarFormula(modal.alimento.alimento, {
                ingredientes: modal.ingredientes.filter((i) => i.materiaPrima).map((i) => ({ materiaPrima: i.materiaPrima, kg: Number(i.kg) })),
                observaciones: modal.observaciones,
                envases: modal.envases,
                ...(pideBolsa ? { bolsa: modal.bolsa } : {}),
              }), "Fórmula guardada")}>
              <div className="row g-3">
                <div className="col-12">
                  <TildesEnvase id="formEnv" valor={modal.envases} onChange={(envases) => set({ envases })} />
                </div>
                {pideBolsa && (
                  <div className="col-12">
                    <div className="border rounded p-2 bg-light">
                      <div className="small fw-semibold mb-2">
                        <i className="bi bi-bag me-1"></i>La bolsa a la venta (no tiene ninguna todavía)
                      </div>
                      <div className="row g-2">
                        <div className="col-4">
                          <label className="form-label small mb-1">Código</label>
                          <input className="form-control form-control-sm" value={modal.bolsa.codigo} required maxLength={20}
                            onChange={(e) => setBolsa({ codigo: e.target.value })} />
                        </div>
                        <div className="col-4">
                          <label className="form-label small mb-1">Kg de la bolsa</label>
                          <input type="number" min="0.01" step="0.01" className="form-control form-control-sm" value={modal.bolsa.kgBolsa} required
                            onChange={(e) => setBolsa({ kgBolsa: e.target.value })} />
                        </div>
                        <div className="col-4">
                          <label className="form-label small mb-1">Categoría</label>
                          <select className="form-select form-select-sm" value={modal.bolsa.categoria}
                            onChange={(e) => setBolsa({ categoria: e.target.value })}>
                            <option value="">— Sin categoría —</option>
                            {(constantes?.categoriasAlimento || []).map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-text">
                        Se da de alta sola en Productos como "{modal.alimento.nombre} x {modal.bolsa.kgBolsa || "?"} kg". El precio se pone en Listas de precios.
                      </div>
                    </div>
                  </div>
                )}
                <div className="col-12">
                  <table className="table table-sm align-middle mb-1">
                    <thead><tr><th>Insumo</th><th style={{ width: "9rem" }}>Kg por bachada</th>
                      <th className="text-end" style={{ width: "7rem" }}>%</th><th></th></tr></thead>
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
                            <input type="number" min="0" step="0.01" className="form-control form-control-sm" value={ing.kg}
                              onChange={(e) => setIng(i, { kg: e.target.value })} />
                          </td>
                          <td className="text-end small text-muted">
                            {total > 0 ? `${fmt(((Number(ing.kg) || 0) / total) * 100, 2)}%` : "—"}
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
                        <td className="text-end fw-semibold">Bachada</td>
                        <td className="fw-semibold">{fmt(total, 2)} kg</td>
                        <td colSpan={2} className="small text-muted">{total > 0 ? "100%" : ""}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    onClick={() => set({ ingredientes: [...modal.ingredientes, { materiaPrima: "", kg: "" }] })}>
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
            onSubmit={async () => {
              const datos = { nombre: modal.nombre, activo: modal.activo, envases: modal.envases };
              if (modal._id) return hacer(() => guardarAlimentoBalanceado(modal._id, datos), "Alimento guardado");
              // Alimento nuevo: se guarda y se abre directo su fórmula (21/11),
              // donde se carga la bolsa si va en bolsa (28/11).
              setSaving(true);
              try {
                const nuevo = await guardarAlimentoBalanceado(null, datos);
                const lista = await obtenerFormulas();
                setFormulas(lista);
                const f = lista.find((x) => String(x._id) === String(nuevo?._id)) || lista.find((x) => x.nombre === modal.nombre.trim());
                if (f) abrirFormula(f); else setModal(null);
              } catch (err) {
                Swal.fire("Error", err.message || "No se pudo guardar.", "error");
              } finally {
                setSaving(false);
              }
            }}>
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
              <div className="col-12">
                <TildesEnvase id="alimEnv" valor={modal.envases} onChange={(envases) => set({ envases })} />
                <div className="form-text">En la planilla de dosificación aparece solo en lo que esté marcado.</div>
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

        {modal?.tipo === "remitoMP" && (() => {
          const setLinea = (i, cambios) => set({ lineas: modal.lineas.map((l, j) => (j === i ? { ...l, ...cambios } : l)) });
          const elegidas = new Set(modal.lineas.map((l) => l.materiaPrima).filter(Boolean));
          const total = modal.lineas.reduce((a, l) => a + (Number(l.kg) || 0), 0);
          return (
            <Modal titulo="Ingresar remito de compra" ancho="modal-lg" saving={saving} onClose={() => setModal(null)} textoOk="Ingresar remito"
              onSubmit={() => hacer(() => ingresarRemitoMateriaPrima({
                proveedor: modal.proveedor, numeroRemito: modal.numeroRemito, fecha: modal.fecha, observaciones: modal.observaciones,
                lineas: modal.lineas.filter((l) => l.materiaPrima).map((l) => ({ materiaPrima: l.materiaPrima, kg: Number(l.kg) })),
              }), "Remito ingresado")}>
              <div className="row g-3">
                <div className="col-md-5">
                  <label className="form-label fw-semibold small mb-1">Proveedor</label>
                  <input className="form-control" value={modal.proveedor} required autoFocus onChange={(e) => set({ proveedor: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold small mb-1">N° de remito</label>
                  <input className="form-control" value={modal.numeroRemito} required placeholder="0001-00001234"
                    onChange={(e) => set({ numeroRemito: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" max={obtenerFechaHoy()} value={modal.fecha} onChange={(e) => set({ fecha: e.target.value })} />
                </div>
                <div className="col-12">
                  <table className="table table-sm align-middle mb-1">
                    <thead><tr><th>Materia prima</th><th style={{ width: "28%" }} className="text-end">Kg</th><th style={{ width: 40 }}></th></tr></thead>
                    <tbody>
                      {modal.lineas.map((l, i) => (
                        <tr key={i}>
                          <td>
                            <select className="form-select form-select-sm" value={l.materiaPrima} required onChange={(e) => setLinea(i, { materiaPrima: e.target.value })}>
                              <option value="">Elegí…</option>
                              {materias.filter((m) => m.activo && (!elegidas.has(String(m._id)) || String(m._id) === l.materiaPrima)).map((m) => (
                                <option key={m._id} value={m._id}>{m.codigo} · {m.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input type="number" min="0.01" step="0.01" className="form-control form-control-sm text-end" value={l.kg} required
                              onChange={(e) => setLinea(i, { kg: e.target.value })} />
                          </td>
                          <td className="text-end">
                            {modal.lineas.length > 1 && (
                              <button type="button" className="btn btn-sm btn-link text-danger p-0" title="Sacar renglón"
                                onClick={() => set({ lineas: modal.lineas.filter((_, j) => j !== i) })}>
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><th className="text-end">Total</th><th className="text-end">{fmt(total, 2)} kg</th><th></th></tr>
                    </tfoot>
                  </table>
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    disabled={modal.lineas.length >= materias.filter((m) => m.activo).length}
                    onClick={() => set({ lineas: [...modal.lineas, { materiaPrima: "", kg: "" }] })}>
                    <i className="bi bi-plus-lg me-1"></i>Agregar renglón
                  </button>
                </div>
                <div className="col-12">
                  <input className="form-control form-control-sm" placeholder="Observaciones" value={modal.observaciones}
                    onChange={(e) => set({ observaciones: e.target.value })} />
                </div>
              </div>
            </Modal>
          );
        })()}

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

// Forratuc se liberó el 2026-11-11 sin la Planta: solo el superadmin (el back
// también la corta con esSuperAdmin). El resto vuelve al inicio de Forratuc.
const ForratucPlantaSoloSuperadmin = () =>
  localStorage.getItem("rolUsuario") === "superadmin"
    ? <ForratucPlantaPage />
    : <Navigate to="/forratuc" replace />;

export default ForratucPlantaSoloSuperadmin;
