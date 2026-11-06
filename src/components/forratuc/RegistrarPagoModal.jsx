import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import BuscadorCliente from "../BuscadorCliente";
import PagosForratuc from "./PagosForratuc";
import { pagoVacio, pagosParaEnviar, sumaPagos } from "../../utils/forratuc/pagosForratuc";
import { obtenerFechaHoy, formatearFechaLocal } from "../../utils/dateUtils";
import { imprimirReciboForratuc } from "../../utils/forratuc/imprimirForratuc";
import { obtenerCuentaClienteForratuc, registrarCobroForratuc } from "../../services/api";

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const r2 = (n) => Math.round(n * 100) / 100;

// Reparte el importe entre los comprobantes, en el orden en que vienen (los que
// tienen un pago parcial primero, después el más viejo).
const repartir = (importe, pendientes) => {
  let resta = r2(importe);
  const salida = {};
  for (const p of pendientes) {
    if (resta <= 0) break;
    const va = Math.min(resta, p.pendiente);
    salida[p._id] = String(va);
    resta = r2(resta - va);
  }
  return salida;
};

/**
 * Registrar un pago a cuenta corriente de Forratuc (recibo REC-0001). Lo usan
 * Cuentas corrientes y Pagos (2026-10-30).
 *
 * Desde el 2026-11-06 (pedido del usuario) el pago elige QUÉ COMPROBANTES
 * cancela: se listan los presupuestos pendientes del cliente (el que quedó con
 * saldo, primero), el importe se reparte solo y se corrige a mano. Lo que sobra
 * queda A CUENTA (saldo a favor). Se cobra también con transferencia, cheque y
 * e-cheq (`mediosCobro`).
 */
const RegistrarPagoModal = ({ clientes, mediosPago, clienteInicial = "", onClose, onRegistrado }) => {
  const [cobro, setCobro] = useState(() => ({
    cliente: clienteInicial, fecha: obtenerFechaHoy(), pagos: [pagoVacio()], observaciones: "",
  }));
  const [cuentaDe, setCuentaDe] = useState(null); // { cliente, saldo, pendientes, saldoAFavor }
  const [imputar, setImputar] = useState({});     // { [presupuestoId]: "importe" }
  const [manual, setManual] = useState(false);    // el usuario tocó el reparto
  const [saving, setSaving] = useState(false);

  // Cuenta del cliente elegido (saldo y comprobantes pendientes). Se guarda con
  // su cliente: al cambiar de cliente la anterior deja de valer sola.
  useEffect(() => {
    if (!cobro.cliente) return;
    let vigente = true;
    obtenerCuentaClienteForratuc(cobro.cliente)
      .then((c) => vigente && setCuentaDe({
        cliente: cobro.cliente, saldo: c.saldo, pendientes: c.pendientes || [], saldoAFavor: c.saldoAFavor || 0,
      }))
      .catch(() => {});
    return () => { vigente = false; };
  }, [cobro.cliente]);
  const cuenta = cobro.cliente && cuentaDe?.cliente === cobro.cliente ? cuentaDe : null;
  const pendientes = useMemo(() => cuenta?.pendientes || [], [cuenta]);
  const saldo = cuenta?.saldo ?? null;

  const total = sumaPagos(cobro.pagos);
  // Mientras no lo toque, el reparto sigue al importe.
  const reparto = manual ? imputar : repartir(total, pendientes);
  const imputado = r2(Object.values(reparto).reduce((a, v) => a + (Number(v) || 0), 0));
  const aCuenta = r2(total - imputado);

  const tocar = (id, valor) => {
    setImputar({ ...reparto, [id]: valor });
    setManual(true);
  };
  const tildar = (p, si) => {
    const nuevo = { ...reparto };
    if (si) {
      const libre = r2(total - imputado);
      nuevo[p._id] = String(libre > 0 ? Math.min(libre, p.pendiente) : p.pendiente);
    } else delete nuevo[p._id];
    setImputar(nuevo);
    setManual(true);
  };
  const elegirCliente = (id) => {
    setCobro((c) => ({ ...c, cliente: id }));
    setImputar({});
    setManual(false);
  };

  const guardar = async () => {
    if (!cobro.cliente) return Swal.fire("Falta el cliente", "Elegí a quién se le cobra.", "warning");
    if (!(total > 0)) return Swal.fire("Falta el importe", "Cargá cuánto pagó.", "warning");
    if (aCuenta < 0) return Swal.fire("Se imputa de más", `Los comprobantes elegidos suman ${pesos(imputado)} y el pago es de ${pesos(total)}.`, "warning");
    const excedido = pendientes.find((p) => Number(reparto[p._id] || 0) > p.pendiente + 0.005);
    if (excedido) return Swal.fire("Importe de más", `Al presupuesto ${excedido.numero} le faltan ${pesos(excedido.pendiente)}.`, "warning");
    setSaving(true);
    try {
      const recibo = await registrarCobroForratuc({
        cliente: cobro.cliente,
        fecha: cobro.fecha,
        pagos: pagosParaEnviar(cobro.pagos, mediosPago),
        imputaciones: Object.entries(reparto)
          .filter(([, v]) => Number(v) > 0)
          .map(([presupuesto, v]) => ({ presupuesto, importe: Number(v) })),
        observaciones: cobro.observaciones.trim() || undefined,
      });
      const cli = clientes.find((c) => c._id === cobro.cliente);
      imprimirReciboForratuc(recibo, { medios: mediosPago, cliente: cli });
      const resumen = (recibo.imputaciones || []).length
        ? `Cancela ${recibo.imputaciones.map((i) => i.numero).join(", ")}${aCuenta > 0 ? ` y ${pesos(aCuenta)} a cuenta` : ""}.`
        : `${pesos(recibo.total)} a cuenta.`;
      Swal.fire({ icon: "success", title: `Recibo ${recibo.numero}`, html: `${resumen}<br/><span class="text-muted">Se abrió la impresión del recibo.</span>`, timer: 3500, showConfirmButton: false });
      onRegistrado?.(recibo);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el pago.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-xl" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-cash-coin me-2"></i>Registrar pago</h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-7">
                  <label className="form-label fw-semibold small mb-1">Cliente</label>
                  <BuscadorCliente clientes={clientes} value={cobro.cliente} onChange={elegirCliente} />
                  {saldo != null && (
                    <div className="small mt-1">
                      Saldo actual: <strong className={saldo > 0 ? "text-danger" : ""}>{pesos(saldo)}</strong>
                      {total > 0 && <> · queda en <strong>{pesos(saldo - total)}</strong></>}
                      {cuenta.saldoAFavor > 0 && <span className="text-success ms-2">(tiene {pesos(cuenta.saldoAFavor)} a favor)</span>}
                    </div>
                  )}
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small mb-1">Fecha</label>
                  <input type="date" className="form-control" value={cobro.fecha}
                    onChange={(e) => setCobro((c) => ({ ...c, fecha: e.target.value }))} />
                </div>
              </div>

              <label className="form-label fw-semibold small mb-1">Cómo pagó</label>
              <PagosForratuc medios={mediosPago} pagos={cobro.pagos}
                onChange={(pagos) => setCobro((c) => ({ ...c, pagos }))} />

              {/* ── Qué comprobantes cancela ── */}
              {cuenta && (
                <div className="mt-3">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <label className="form-label fw-semibold small mb-0">Qué comprobantes cancela</label>
                    {manual && (
                      <button type="button" className="btn btn-sm btn-link p-0" onClick={() => { setManual(false); setImputar({}); }}>
                        repartir solo (del más viejo al más nuevo)
                      </button>
                    )}
                  </div>
                  {pendientes.length === 0 ? (
                    <div className="small text-muted">No tiene comprobantes pendientes: el pago queda a cuenta.</div>
                  ) : (
                    <table className="table table-sm align-middle mb-1">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: "2rem" }}></th><th>Presupuesto</th><th>Fecha</th>
                          <th className="text-end">Total</th><th className="text-end">Pagado</th><th className="text-end">Pendiente</th>
                          <th className="text-end" style={{ width: "11rem" }}>Cancela</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendientes.map((p) => {
                          const elegido = reparto[p._id] !== undefined;
                          const valor = reparto[p._id] ?? "";
                          const salda = elegido && Math.abs(Number(valor) - p.pendiente) < 0.005;
                          return (
                            <tr key={p._id} className={elegido ? "" : "text-muted"}>
                              <td>
                                <input type="checkbox" className="form-check-input" checked={elegido}
                                  onChange={(e) => tildar(p, e.target.checked)} />
                              </td>
                              <td className="fw-semibold">
                                {p.numero}
                                {p.pagado > 0 && <span className="badge bg-warning text-dark ms-2">pago parcial</span>}
                              </td>
                              <td className="small">{formatearFechaLocal(p.fecha)}</td>
                              <td className="text-end small">{pesos(p.total)}</td>
                              <td className="text-end small">{p.pagado > 0 ? pesos(p.pagado) : "—"}</td>
                              <td className="text-end fw-semibold">{pesos(p.pendiente)}</td>
                              <td className="text-end">
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text">$</span>
                                  <input type="number" min="0" step="0.01" className={`form-control text-end ${salda ? "border-success" : ""}`}
                                    value={valor} disabled={!elegido} onChange={(e) => tocar(p._id, e.target.value)} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {total > 0 && (
                    <div className="small text-end">
                      Cancela <strong>{pesos(imputado)}</strong>
                      {aCuenta > 0 && <span className="ms-2 text-success">· {pesos(aCuenta)} quedan a cuenta (saldo a favor)</span>}
                      {aCuenta < 0 && <span className="ms-2 text-danger fw-semibold">· se imputan {pesos(-aCuenta)} de más</span>}
                    </div>
                  )}
                </div>
              )}

              <label className="form-label fw-semibold small mt-3 mb-1">Observaciones</label>
              <textarea className="form-control" rows={2} value={cobro.observaciones}
                onChange={(e) => setCobro((c) => ({ ...c, observaciones: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="btn btn-success" onClick={guardar} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-printer me-1"></i>}
                Registrar e imprimir recibo
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default RegistrarPagoModal;
