import React, { useState, useEffect, useCallback } from "react";
import {
  obtenerEnviosPollitosMostrador,
  crearEnvioPollitosMostrador,
  anularEnvioPollitosMostrador,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import { formatearNumero } from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

/**
 * Envío de pollitos al MOSTRADOR (2026-10-10). El mostrador vende pollitos de un
 * stock propio, como el pollo y el huevo: Reproductoras le manda una cantidad y
 * entra directo (sin aceptación, están los dos en Trigotuc).
 *
 * Sale de las tandas igual que una orden de carga — FIFO por nacimiento — y no
 * puede llevarse lo comprometido en órdenes pendientes: por eso recibe `libre`,
 * el mismo número que la tarjeta de stock de arriba. El back valida igual.
 *
 * Un envío se anula solo si el mostrador no vendió nada de él.
 */
const EnviosPollitosMostrador = ({ libre = 0, onCambio }) => {
  const [envios, setEnvios] = useState([]);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const cargarEnvios = useCallback(async () => {
    try {
      setEnvios(await obtenerEnviosPollitosMostrador());
    } catch {
      setEnvios([]);
    }
  }, []);

  useEffect(() => {
    cargarEnvios();
  }, [cargarEnvios]);

  const pedidos = Number(cantidad) || 0;
  const excede = pedidos > libre;
  const noEntero = pedidos > 0 && !Number.isInteger(pedidos);

  const enviar = async (e) => {
    e.preventDefault();
    if (pedidos <= 0 || excede || noEntero) return;
    const r = await Swal.fire({
      icon: "question",
      title: `¿Enviar ${formatearNumero(pedidos)} pollitos al mostrador?`,
      text: "Salen del stock de nacimientos y quedan para vender por Salida de Mostrador.",
      showCancelButton: true,
      confirmButtonText: "Sí, enviar",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;

    setSaving(true);
    try {
      const envio = await crearEnvioPollitosMostrador({
        cantidad: pedidos,
        fecha: ajustarFechaParaGuardar(fecha),
        observaciones: observaciones.trim() || undefined,
      });
      Swal.fire({
        icon: "success",
        title: `${envio.numero} enviado`,
        text: `El mostrador ya tiene los ${formatearNumero(envio.cantidad)} pollitos.`,
        timer: 2000,
        showConfirmButton: false,
      });
      setCantidad("");
      setObservaciones("");
      setFecha(obtenerFechaHoy());
      await Promise.all([cargarEnvios(), onCambio?.()]);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo enviar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const anular = async (envio) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Anular ${envio.numero}?`,
      text: "Los pollitos vuelven al stock de nacimientos. Solo se puede si el mostrador no vendió nada de este envío.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await anularEnvioPollitosMostrador(envio._id, motivo);
      Swal.fire({ icon: "success", title: `${envio.numero} anulado`, timer: 1500, showConfirmButton: false });
      await Promise.all([cargarEnvios(), onCambio?.()]);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-white fw-bold">
        <i className="bi bi-shop me-1"></i>Envío al mostrador
      </div>
      <div className="card-body">
        <p className="text-muted small mb-3">
          El mostrador vende pollitos de su propio stock. Lo que envíes sale de los nacimientos (lo más
          viejo primero) y entra directo al mostrador.
        </p>
        <form onSubmit={enviar} className="row g-2 align-items-end mb-3">
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small mb-1">Pollitos</label>
            <input
              type="number" min="1" step="1"
              className={`form-control ${excede || noEntero ? "is-invalid" : ""}`}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
              disabled={saving}
            />
            <div className={excede || noEntero ? "invalid-feedback d-block" : "form-text"}>
              {noEntero
                ? "Por unidad, sin decimales."
                : excede
                  ? `Hay ${formatearNumero(libre)} libres.`
                  : `${formatearNumero(libre)} libres`}
            </div>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small mb-1">Fecha</label>
            <input
              type="date" className="form-control"
              value={fecha} onChange={(e) => setFecha(e.target.value)}
              disabled={saving} required
            />
            <div className="form-text">&nbsp;</div>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small mb-1">Observaciones</label>
            <input
              type="text" className="form-control"
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional" disabled={saving}
            />
            <div className="form-text">&nbsp;</div>
          </div>
          <div className="col-12 col-md-2">
            <button
              type="submit" className="btn btn-success w-100"
              disabled={saving || pedidos <= 0 || excede || noEntero}
            >
              {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
              <i className="bi bi-send me-1"></i>Enviar
            </button>
            <div className="form-text">&nbsp;</div>
          </div>
        </form>

        {envios.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Envío</th>
                  <th>Fecha</th>
                  <th className="text-end">Enviados</th>
                  <th className="text-end">Vendidos</th>
                  <th className="text-end">Quedan</th>
                  <th className="d-none d-md-table-cell">Registró</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => {
                  const vendidos = e.anulado ? 0 : e.cantidad - e.disponibles;
                  return (
                    <tr key={e._id} className={e.anulado ? "text-muted" : ""}>
                      <td className="fw-semibold">
                        {e.numero}
                        {e.anulado && <span className="badge bg-secondary ms-1">Anulado</span>}
                        {e.observaciones && (
                          <div className="text-muted fw-normal" style={{ fontSize: ".72rem" }}>{e.observaciones}</div>
                        )}
                      </td>
                      <td>{formatearFechaLocal(e.fecha)}</td>
                      <td className="text-end">{formatearNumero(e.cantidad)}</td>
                      <td className="text-end">{e.anulado ? "—" : formatearNumero(vendidos)}</td>
                      <td className="text-end fw-semibold text-success">
                        {e.anulado ? "—" : formatearNumero(e.disponibles)}
                      </td>
                      <td className="d-none d-md-table-cell small text-muted">
                        {e.registradoPor?.nombreUsuario || "—"}
                      </td>
                      <td className="text-end">
                        {!e.anulado && vendidos === 0 && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => anular(e)}
                            title="Anular: los pollitos vuelven al stock de nacimientos"
                          >
                            <i className="bi bi-x-circle"></i>
                          </button>
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
    </div>
  );
};

export default EnviosPollitosMostrador;
