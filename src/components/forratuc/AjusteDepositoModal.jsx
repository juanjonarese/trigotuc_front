import React, { useState } from "react";
import Swal from "sweetalert2";
import { obtenerFechaHoy } from "../../utils/dateUtils";
import { registrarAjusteDepositoForratuc } from "../../services/api";
import { grupoDeposito, vaEnDeposito } from "../../utils/forratuc/conteoStock";
import { escapeHtml } from "../../utils/escapeHtml";
import { imprimirAjusteDeposito } from "../../utils/forratuc/imprimirForratuc";

/**
 * Ajuste por depósito (2026-11-19, pedido del usuario): SACAR mercadería de un
 * depósito a mano —bolsas rotas, en mal estado, faltante en el conteo u otro
 * problema—, así el stock del depósito queda con lo que de verdad hay. Hermano
 * de "Ingresar mercadería": fecha, depósito, motivo y renglones.
 *
 * Misma regla que la venta: no se saca más de lo que hay (el stock no queda en
 * negativo, 19/11). Un ajuste mal cargado se anula desde el
 * historial del depósito (devuelve lo sacado).
 */
let siguiente = 1;
const renglonVacio = () => ({ id: siguiente++, alimento: "", cantidad: "" });
const UNIDAD = { bolsa: "bolsas", unidad: "unidades", caja: "cajas", maple: "maples" };
const fmt = (n) => Number(n || 0).toLocaleString("es-AR");

const AjusteDepositoModal = ({ depositos = [], productos = [], motivos = [], onClose, onGuardado }) => {
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [deposito, setDeposito] = useState(depositos.find((d) => d.key === "forrajeria")?.key || depositos[0]?.key || "");
  const [motivo, setMotivo] = useState(motivos[0]?.key || "");
  const [observaciones, setObservaciones] = useState("");
  // A quién / adónde va la mercadería (19/11): sale en la constancia firmada.
  const [entregadoA, setEntregadoA] = useState("");
  const [renglones, setRenglones] = useState([renglonVacio()]);
  const [saving, setSaving] = useState(false);

  // Los que van en el depósito, o que tienen algo ahí (25/11).
  const grupos = [];
  for (const p of productos.filter((x) => vaEnDeposito(x, deposito) || (x.porDeposito?.[deposito] || 0) !== 0)) {
    const titulo = grupoDeposito(p);
    const g = grupos.find((x) => x.titulo === titulo) || (grupos.push({ titulo, items: [] }), grupos[grupos.length - 1]);
    g.items.push(p);
  }
  const porKey = Object.fromEntries(productos.map((p) => [p.alimento, p]));
  const set = (id, cambios) => setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
  const hayEn = (p) => p?.porDeposito?.[deposito] ?? 0;

  const guardar = async (e) => {
    e.preventDefault();
    const usados = renglones.filter((r) => r.alimento || r.cantidad);
    if (!deposito) return Swal.fire("Falta el depósito", "Elegí de qué depósito sale.", "warning");
    if (!motivo) return Swal.fire("Falta el motivo", "Elegí por qué se saca.", "warning");
    if (motivo === "otro" && !observaciones.trim())
      return Swal.fire("Falta el detalle", "Con motivo \"Otro\", escribí qué pasó.", "warning");
    if (usados.length === 0) return Swal.fire("Sin productos", "Cargá al menos un producto.", "warning");
    for (const [i, r] of usados.entries()) {
      if (!r.alimento) return Swal.fire("Falta el producto", `Renglón ${i + 1}: elegí el producto.`, "warning");
      if (!(Number(r.cantidad) >= 1) || !Number.isInteger(Number(r.cantidad)))
        return Swal.fire("Cantidad", `Renglón ${i + 1}: la cantidad va de 1 en adelante, sin decimales.`, "warning");
    }
    // No más de lo que hay (sumando los renglones del mismo producto).
    const pedido = {};
    for (const r of usados) pedido[r.alimento] = (pedido[r.alimento] || 0) + Number(r.cantidad);
    for (const [key, n] of Object.entries(pedido)) {
      const p = porKey[key];
      if (n > hayEn(p)) return Swal.fire("No alcanza", `De ${p?.etiqueta || key} hay ${fmt(hayEn(p))} en el depósito y el ajuste saca ${fmt(n)}.`, "warning");
    }
    const dep = depositos.find((d) => d.key === deposito)?.etiqueta || deposito;
    const { isConfirmed } = await Swal.fire({
      title: "¿Sacar esta mercadería?",
      html: `Sale de <strong>${escapeHtml(dep)}</strong>:<br>${usados
        .map((r) => `${fmt(r.cantidad)} ${UNIDAD[porKey[r.alimento]?.unidad] || ""} ${escapeHtml(porKey[r.alimento]?.etiqueta || "")}`)
        .join("<br>")}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, sacar",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    setSaving(true);
    try {
      const ajuste = await registrarAjusteDepositoForratuc({
        fecha, deposito, motivo, observaciones: observaciones.trim() || undefined, entregadoA: entregadoA.trim() || undefined,
        lineas: usados.map((r) => ({ alimento: r.alimento, bolsas: Number(r.cantidad) })),
      });
      // La constancia para firmar sale sola, por duplicado (19/11).
      imprimirAjusteDeposito(ajuste);
      Swal.fire({ icon: "success", title: `Ajuste ${ajuste.numero} registrado`, text: "Se imprime la constancia para firmar.", timer: 2000, showConfirmButton: false });
      onGuardado?.();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el ajuste.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg" role="document">
          <form className="modal-content" onSubmit={guardar}>
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-box-arrow-up me-2 text-danger"></i>Ajuste por depósito</h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="row g-3 mb-3">
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" value={fecha} max={obtenerFechaHoy()}
                    onChange={(e) => setFecha(e.target.value)} required />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label fw-semibold small mb-1">Depósito</label>
                  <select className="form-select" value={deposito} onChange={(e) => setDeposito(e.target.value)}>
                    {depositos.map((d) => <option key={d.key} value={d.key}>{d.etiqueta}</option>)}
                  </select>
                </div>
                <div className="col-12 col-md-5">
                  <label className="form-label fw-semibold small mb-1">Motivo</label>
                  <select className="form-select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                    {motivos.map((m) => <option key={m.key} value={m.key}>{m.etiqueta}</option>)}
                  </select>
                </div>
                <div className="col-12 col-md-5">
                  <label className="form-label fw-semibold small mb-1">
                    Se entrega a <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input className="form-control" value={entregadoA} maxLength={120}
                    placeholder="Ej.: Planta, chofer Juan Pérez…" onChange={(e) => setEntregadoA(e.target.value)} />
                </div>
                <div className="col-12 col-md-7">
                  <label className="form-label fw-semibold small mb-1">
                    Detalle {motivo === "otro" ? <span className="text-danger">*</span> : <span className="text-muted fw-normal">(opcional)</span>}
                  </label>
                  <input className="form-control" value={observaciones} maxLength={200}
                    placeholder="Ej.: se mojaron con la lluvia, se rompieron al descargar…" onChange={(e) => setObservaciones(e.target.value)} />
                </div>
              </div>

              <table className="table table-sm align-middle mb-2">
                <thead className="table-light">
                  <tr><th>Producto</th><th className="text-end" style={{ width: 110 }}>Hay</th><th style={{ width: 190 }}>Sale</th><th style={{ width: 40 }}></th></tr>
                </thead>
                <tbody>
                  {renglones.map((r) => {
                    const p = porKey[r.alimento];
                    return (
                      <tr key={r.id}>
                        <td>
                          <select className="form-select form-select-sm" value={r.alimento} onChange={(e) => set(r.id, { alimento: e.target.value })}>
                            <option value="">Elegí un producto…</option>
                            {grupos.map((g) => (
                              <optgroup key={g.titulo} label={g.titulo}>
                                {g.items.map((it) => <option key={it.alimento} value={it.alimento}>{it.codigo} · {it.etiqueta}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className={`text-end small ${p && hayEn(p) < 0 ? "text-danger" : "text-muted"}`}>{p ? fmt(hayEn(p)) : "—"}</td>
                        <td>
                          <div className="input-group input-group-sm">
                            <input type="number" min="1" step="1" className="form-control" value={r.cantidad}
                              onChange={(e) => set(r.id, { cantidad: e.target.value })} />
                            <span className="input-group-text">{p ? UNIDAD[p.unidad] || p.unidad : "—"}</span>
                          </div>
                        </td>
                        <td>
                          <button type="button" className="btn btn-sm btn-outline-danger border-0" title="Quitar"
                            onClick={() => setRenglones((prev) => (prev.length === 1 ? [renglonVacio()] : prev.filter((x) => x.id !== r.id)))}>
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setRenglones((prev) => [...prev, renglonVacio()])}>
                <i className="bi bi-plus-lg me-1"></i>Agregar producto
              </button>

              <div className="alert alert-light border small mt-3 mb-0">
                <i className="bi bi-info-circle me-1"></i>
                Descuenta el stock del depósito elegido; no se puede sacar más de lo que hay. Al registrarlo se imprime la <strong>constancia por duplicado</strong> para
                firmar (entregó / recibió); se reimprime desde el historial del depósito, donde también se anula (la mercadería vuelve).
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-danger" disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check-lg me-1"></i>}
                Registrar ajuste
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default AjusteDepositoModal;
