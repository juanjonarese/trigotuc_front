import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import BuscadorCliente from "../BuscadorCliente";
import PagosForratuc from "./PagosForratuc";
import { pagoVacio, pagosParaEnviar, sumaPagos } from "../../utils/forratuc/pagosForratuc";
import { obtenerFechaHoy } from "../../utils/dateUtils";
import { imprimirReciboForratuc } from "../../utils/forratuc/imprimirForratuc";
import { obtenerCuentaClienteForratuc, registrarCobroForratuc } from "../../services/api";

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

/**
 * Registrar un pago a cuenta corriente de Forratuc (recibo REC-0001). Lo usan
 * Cuentas corrientes y Pagos (2026-10-30): el pago va a cuenta del saldo, se
 * imprime el recibo al registrarlo y después avisa con `onRegistrado(recibo)`.
 */
const RegistrarPagoModal = ({ clientes, mediosPago, clienteInicial = "", onClose, onRegistrado }) => {
  const [cobro, setCobro] = useState(() => ({
    cliente: clienteInicial, fecha: obtenerFechaHoy(), pagos: [pagoVacio()], observaciones: "",
  }));
  const [saldoDe, setSaldoDe] = useState(null); // { cliente, saldo }
  const [saving, setSaving] = useState(false);

  // Saldo del cliente elegido, para ver cómo queda. Se guarda con su cliente:
  // al cambiar de cliente el anterior deja de valer sin tener que limpiarlo.
  useEffect(() => {
    if (!cobro.cliente) return;
    let vigente = true;
    obtenerCuentaClienteForratuc(cobro.cliente)
      .then((c) => vigente && setSaldoDe({ cliente: cobro.cliente, saldo: c.saldo }))
      .catch(() => {});
    return () => { vigente = false; };
  }, [cobro.cliente]);
  const saldo = cobro.cliente && saldoDe?.cliente === cobro.cliente ? saldoDe.saldo : null;

  const guardar = async () => {
    if (!cobro.cliente) return Swal.fire("Falta el cliente", "Elegí a quién se le cobra.", "warning");
    if (!(sumaPagos(cobro.pagos) > 0)) return Swal.fire("Falta el importe", "Cargá cuánto pagó.", "warning");
    setSaving(true);
    try {
      const recibo = await registrarCobroForratuc({
        cliente: cobro.cliente,
        fecha: cobro.fecha,
        pagos: pagosParaEnviar(cobro.pagos, mediosPago),
        observaciones: cobro.observaciones.trim() || undefined,
      });
      const cli = clientes.find((c) => c._id === cobro.cliente);
      imprimirReciboForratuc(recibo, { medios: mediosPago, cliente: cli });
      Swal.fire({ icon: "success", title: `Recibo ${recibo.numero}`, html: `${pesos(recibo.total)} a cuenta.<br/><span class="text-muted">Se abrió la impresión del recibo.</span>`, timer: 3000, showConfirmButton: false });
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
              <h5 className="modal-title"><i className="bi bi-cash-coin me-2"></i>Registrar pago a cuenta</h5>
              <button type="button" className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-7">
                  <label className="form-label fw-semibold small mb-1">Cliente</label>
                  <BuscadorCliente clientes={clientes} value={cobro.cliente}
                    onChange={(id) => setCobro((c) => ({ ...c, cliente: id }))} />
                  {saldo != null && (
                    <div className="small mt-1">
                      Saldo actual: <strong className={saldo > 0 ? "text-danger" : ""}>{pesos(saldo)}</strong>
                      {sumaPagos(cobro.pagos) > 0 && <> · queda en <strong>{pesos(saldo - sumaPagos(cobro.pagos))}</strong></>}
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
