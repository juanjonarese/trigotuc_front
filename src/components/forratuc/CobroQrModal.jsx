import React, { useEffect, useRef, useState } from "react";
import { crearCobroQrForratuc, obtenerCobroQrForratuc, cancelarCobroQrForratuc } from "../../services/api";

/**
 * Cobro con QR de Mercado Pago (2026-11-17, EN DESARROLLO: solo superadmin).
 *
 * Le carga el importe al QR fijo de la caja (el impreso en el mostrador) y
 * espera: cada 3 segundos pregunta cómo está (el back le consulta a Mercado
 * Pago si hace falta; en producción además llega el webhook). Cuando pagan,
 * aparece acá y devuelve el cobro con `onPagado` (su n° de operación va en el
 * presupuesto). Cerrar mientras espera cancela la orden.
 */
const pesos = (n) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const CADA_MS = 3000;
const TEXTO = {
  vencido: "Pasó el tiempo y no pagaron: la orden venció.",
  cancelado: "La orden se canceló.",
  devuelto: "El pago se devolvió.",
  error: "No se pudo cargar el cobro en Mercado Pago.",
};

const CobroQrModal = ({ importe, descripcion, onPagado, onCerrar }) => {
  const [cobro, setCobro] = useState(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const vivo = useRef(true);
  // Una orden por intento: en desarrollo React monta dos veces (StrictMode) y
  // crearía dos órdenes en la caja.
  const creadoPara = useRef(-1);

  // Crear la orden en la caja (y de nuevo con "Reintentar").
  useEffect(() => {
    vivo.current = true;
    if (creadoPara.current === intento) return () => { vivo.current = false; };
    creadoPara.current = intento;
    crearCobroQrForratuc({ importe, descripcion })
      .then((c) => vivo.current && (setCobro(c), setError("")))
      .catch((e) => vivo.current && setError(e.message || TEXTO.error));
    return () => { vivo.current = false; };
  }, [importe, descripcion, intento]);

  // Esperar el pago.
  useEffect(() => {
    if (cobro?.estado !== "pendiente") return undefined;
    const t = setInterval(() => {
      obtenerCobroQrForratuc(cobro._id)
        .then((c) => vivo.current && setCobro(c))
        .catch(() => { /* un corte de red no corta la espera */ });
    }, CADA_MS);
    return () => clearInterval(t);
  }, [cobro?._id, cobro?.estado]);

  const cerrar = async () => {
    // Si nadie pagó, no puede quedar la orden en la caja.
    if (cobro?.estado === "pendiente") {
      try {
        const c = await cancelarCobroQrForratuc(cobro._id);
        if (c.estado === "pagado") return setCobro(c); // la pagaron justo: no se pierde
      } catch (e) {
        return setError(e.message);
      }
    }
    onCerrar();
  };

  const estado = error ? "error" : cobro?.estado || "cargando";
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1065 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: 420 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="bi bi-qr-code me-2"></i>Cobrar con QR</h5>
              {estado !== "pagado" && <button type="button" className="btn-close" onClick={cerrar}></button>}
            </div>
            <div className="modal-body text-center py-4">
              <div className="fs-2 fw-bold mb-2">{pesos(importe)}</div>

              {estado === "cargando" && (
                <><div className="spinner-border text-primary my-3" role="status"></div>
                  <div className="text-muted">Cargando el cobro en la caja…</div></>
              )}

              {estado === "pendiente" && (
                <>
                  <i className="bi bi-qr-code-scan text-primary" style={{ fontSize: "3.5rem" }}></i>
                  <div className="fw-semibold mt-2">El cliente escanea el QR de la caja con Mercado Pago</div>
                  <div className="text-muted small mt-2 d-flex justify-content-center align-items-center gap-2">
                    <span className="spinner-grow spinner-grow-sm text-primary" role="status"></span>
                    Esperando el pago…
                  </div>
                </>
              )}

              {estado === "pagado" && (
                <>
                  <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "3.5rem" }}></i>
                  <div className="fw-semibold text-success mt-2">¡Pago recibido!</div>
                  <div className="small text-muted mt-1">
                    {pesos(cobro.montoPagado ?? cobro.importe)} · operación {cobro.paymentId}
                  </div>
                </>
              )}

              {["vencido", "cancelado", "devuelto", "error"].includes(estado) && (
                <>
                  <i className="bi bi-x-circle text-danger" style={{ fontSize: "3rem" }}></i>
                  <div className="mt-2">{error || TEXTO[estado]}</div>
                </>
              )}

              <div className="mt-3 small text-muted">
                <span className="badge bg-warning text-dark">En desarrollo</span> Mercado Pago de prueba
              </div>
            </div>
            <div className="modal-footer">
              {estado === "pagado" ? (
                <button type="button" className="btn btn-success w-100" onClick={() => onPagado(cobro)}>
                  <i className="bi bi-check-lg me-1"></i>Listo
                </button>
              ) : ["vencido", "cancelado", "devuelto", "error"].includes(estado) ? (
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={onCerrar}>Cerrar</button>
                  <button type="button" className="btn btn-primary" onClick={() => { setCobro(null); setError(""); setIntento((i) => i + 1); }}>
                    Reintentar
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-outline-danger w-100" onClick={cerrar} disabled={estado === "cargando"}>
                  Cancelar el cobro
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" style={{ zIndex: 1060 }}></div>
    </>
  );
};

export default CobroQrModal;
