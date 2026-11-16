import React, { useState } from "react";
import Swal from "sweetalert2";
import { obtenerFechaHoy } from "../../utils/dateUtils";
import { registrarIngresoAlimentoForratuc } from "../../services/api";

/**
 * Ingreso manual de mercadería a un depósito de Forratuc (2026-11-16, pedido
 * del usuario: arrancan a vender y la Producción —que manda el alimento— todavía
 * no está en el sistema). Se carga como un remito: fecha, depósito, de dónde
 * viene y los renglones (producto + cantidad).
 *
 * Solo productos de DEPÓSITO (alimento y "otros"). Pollo, huevo y pollitos NO
 * van acá: entran por los envíos de cada área (Envío Cámara del Frigorífico,
 * remitos de huevo y envío de pollitos de Reproductoras); cargarlos también acá
 * los contaría dos veces.
 */
let siguiente = 1;
const renglonVacio = () => ({ id: siguiente++, alimento: "", cantidad: "" });
const UNIDAD = { bolsa: "bolsas", unidad: "unidades", caja: "cajas", maple: "maples" };

const IngresoMercaderiaModal = ({ depositos = [], productos = [], onClose, onGuardado }) => {
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [deposito, setDeposito] = useState(depositos.find((d) => d.key === "forrajeria")?.key || depositos[0]?.key || "");
  const [observaciones, setObservaciones] = useState("");
  const [renglones, setRenglones] = useState([renglonVacio()]);
  const [saving, setSaving] = useState(false);

  // Agrupados como en el Stock: el alimento por categoría y "Otros".
  const grupos = [];
  for (const p of productos) {
    const titulo = p.rubro === "otros" ? "Otros" : `Alimento — ${p.categoriaEtiqueta || "Sin categoría"}`;
    const g = grupos.find((x) => x.titulo === titulo) || (grupos.push({ titulo, items: [] }), grupos[grupos.length - 1]);
    g.items.push(p);
  }
  const porKey = Object.fromEntries(productos.map((p) => [p.alimento, p]));
  const set = (id, cambios) => setRenglones((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambios } : r)));

  const guardar = async (e) => {
    e.preventDefault();
    const usados = renglones.filter((r) => r.alimento || r.cantidad);
    if (!deposito) return Swal.fire("Falta el depósito", "Elegí a qué depósito entra.", "warning");
    if (usados.length === 0) return Swal.fire("Sin productos", "Cargá al menos un producto.", "warning");
    for (const [i, r] of usados.entries()) {
      if (!r.alimento) return Swal.fire("Falta el producto", `Renglón ${i + 1}: elegí el producto.`, "warning");
      if (!(Number(r.cantidad) >= 1) || !Number.isInteger(Number(r.cantidad)))
        return Swal.fire("Cantidad", `Renglón ${i + 1}: la cantidad va de 1 en adelante, sin decimales.`, "warning");
    }
    setSaving(true);
    try {
      await registrarIngresoAlimentoForratuc({
        fecha, deposito, observaciones: observaciones.trim() || undefined,
        lineas: usados.map((r) => ({ alimento: r.alimento, bolsas: Number(r.cantidad) })),
      });
      Swal.fire({ icon: "success", title: "Mercadería ingresada", timer: 1500, showConfirmButton: false });
      onGuardado?.();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el ingreso.", "error");
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
              <h5 className="modal-title"><i className="bi bi-box-arrow-in-down me-2"></i>Ingresar mercadería</h5>
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
                  <label className="form-label fw-semibold small mb-1">De dónde viene / remito</label>
                  <input className="form-control" value={observaciones} maxLength={200}
                    placeholder="Ej.: Producción, remito 0001-123" onChange={(e) => setObservaciones(e.target.value)} />
                </div>
              </div>

              <table className="table table-sm align-middle mb-2">
                <thead className="table-light">
                  <tr><th>Producto</th><th style={{ width: 190 }}>Cantidad</th><th style={{ width: 40 }}></th></tr>
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
                Acá entran el <strong>alimento</strong> y los productos de depósito. El <strong>pollo, los huevos y los
                pollitos</strong> no: entran por los envíos de cada área (Frigorífico y Reproductoras). Un ingreso mal cargado se
                anula desde el historial del depósito.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-success" disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check-lg me-1"></i>}
                Ingresar
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default IngresoMercaderiaModal;
