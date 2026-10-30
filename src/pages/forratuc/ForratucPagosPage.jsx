import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import RegistrarPagoModal from "../../components/forratuc/RegistrarPagoModal";
import { obtenerFechaHoy, formatearFechaLocal } from "../../utils/dateUtils";
import { escapeHtml } from "../../utils/escapeHtml";
import { clienteDeEmpresa } from "../../utils/empresas";
import { imprimirReciboForratuc } from "../../utils/forratuc/imprimirForratuc";
import {
  obtenerClientes,
  obtenerConstantesPresupuesto,
  obtenerCobrosForratuc,
  anularCobroForratuc,
} from "../../services/api";

/**
 * Pagos de Forratuc (2026-10-30, pedido del usuario): los pagos de cuenta
 * corriente en una página propia. Se registran con el mismo modal que Cuentas
 * corrientes (recibo REC-0001, a cuenta del saldo) y se listan por fecha, con
 * reimprimir y anular. El saldo no se toca acá: lo calcula el back.
 */

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

const primeroDelMes = () => `${obtenerFechaHoy().slice(0, 8)}01`;

const ForratucPagosPage = () => {
  const navigate = useNavigate();
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [constantes, setConstantes] = useState(null);
  const [desde, setDesde] = useState(primeroDelMes());
  const [hasta, setHasta] = useState(obtenerFechaHoy());
  const [registrando, setRegistrando] = useState(false);

  const mediosPago = constantes?.mediosPago || [];
  const etiquetaMedio = (k) => mediosPago.find((m) => m.key === k)?.etiqueta || k;

  const cargar = async () => {
    setLoading(true);
    try {
      setCobros(await obtenerCobrosForratuc(desde, hasta));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los pagos.", "error");
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [desde, hasta]);

  useEffect(() => {
    obtenerConstantesPresupuesto().then(setConstantes).catch(() => {});
    obtenerClientes()
      .then((cls) =>
        setClientes((Array.isArray(cls) ? cls : cls?.clientes || []).filter((c) => clienteDeEmpresa(c, "forratuc")).sort((a, b) =>
          String(a.razonSocial || "").localeCompare(String(b.razonSocial || ""))))
      )
      .catch(() => {});
  }, []);

  const anular = async (rec) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: `¿Anular el recibo ${escapeHtml(rec.numero)}?`,
      html: `El saldo del cliente vuelve a subir ${pesos(rec.total)}.`,
      input: "text",
      inputPlaceholder: "Por qué se anula",
      inputValidator: (v) => (!v?.trim() ? "Escribí el motivo." : undefined),
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await anularCobroForratuc(rec._id, motivo.trim());
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  const vigentes = cobros.filter((c) => c.estado !== "anulado");
  const total = vigentes.reduce((a, c) => a + (c.total || 0), 0);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/forratuc")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-cash-coin me-2 text-secondary"></i>
            Pagos
          </h1>
          <button className="btn btn-success btn-sm ms-auto" onClick={() => setRegistrando(true)}>
            <i className="bi bi-plus-lg me-1"></i>Registrar pago
          </button>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
              <div>
                <label className="form-label small mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="form-label small mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
              <div className="ms-auto text-end">
                <div className="small text-muted">Total cobrado ({vigentes.length} {vigentes.length === 1 ? "pago" : "pagos"})</div>
                <div className="fs-5 fw-bold">{pesos(total)}</div>
              </div>
            </div>

            {loading ? (
              <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
            ) : cobros.length === 0 ? (
              <div className="text-muted text-center py-4">No hay pagos en esas fechas.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Recibo</th>
                      <th>Cliente</th>
                      <th>Cómo pagó</th>
                      <th className="text-end">Importe</th>
                      <th>Registró</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobros.map((c) => {
                      const anulado = c.estado === "anulado";
                      return (
                        <tr key={c._id} className={anulado ? "text-muted" : ""}>
                          <td className="text-nowrap">{formatearFechaLocal(c.fecha)}</td>
                          <td className="text-nowrap fw-semibold">
                            <span className={anulado ? "text-decoration-line-through" : ""}>{c.numero}</span>
                            {anulado && <span className="badge bg-danger ms-2" title={c.motivoAnulacion || ""}>Anulado</span>}
                          </td>
                          <td>{c.cliente?.razonSocial || c.clienteNombre}</td>
                          <td className="small">{(c.pagos || []).map((p) => etiquetaMedio(p.medio)).join(" + ")}</td>
                          <td className={`text-end fw-semibold ${anulado ? "text-decoration-line-through" : ""}`}>{pesos(c.total)}</td>
                          <td className="small">{c.registradoPor?.nombreUsuario || "—"}</td>
                          <td className="text-end text-nowrap">
                            <button className="btn btn-sm btn-outline-secondary me-1" title="Imprimir recibo"
                              onClick={() => imprimirReciboForratuc(c, { medios: mediosPago, cliente: c.cliente })}>
                              <i className="bi bi-printer"></i>
                            </button>
                            {!anulado && (
                              <button className="btn btn-sm btn-outline-danger" title="Anular recibo" onClick={() => anular(c)}>
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

        {registrando && (
          <RegistrarPagoModal clientes={clientes} mediosPago={mediosPago}
            onClose={() => setRegistrando(false)}
            onRegistrado={() => { setRegistrando(false); cargar(); }} />
        )}
      </div>
    </Layout>
  );
};

export default ForratucPagosPage;
