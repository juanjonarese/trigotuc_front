import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import RegistrarPagoModal from "../../components/forratuc/RegistrarPagoModal";
import { formatearFechaLocal } from "../../utils/dateUtils";
import { escapeHtml } from "../../utils/escapeHtml";
import { clienteDeEmpresa } from "../../utils/empresas";
import { imprimirPresupuestoForratuc, imprimirReciboForratuc } from "../../utils/forratuc/imprimirForratuc";
import {
  obtenerClientes,
  obtenerConstantesPresupuesto,
  obtenerCuentasCorrientesForratuc,
  obtenerCuentaClienteForratuc,
  anularCobroForratuc,
} from "../../services/api";

/**
 * Cuentas corrientes de Forratuc (2026-10-21).
 *
 * DEBE = presupuestos emitidos en cuenta corriente; HABER = cobros (REC-0001).
 * El saldo lo calcula el back; acá no se suma nada por cuenta propia. Los cobros
 * van a cuenta del saldo (no se imputan a un presupuesto) y se pagan con los
 * mismos medios que el contado. Cada cobro imprime su recibo por duplicado.
 */

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

const ForratucCuentasCorrientesPage = () => {
  const navigate = useNavigate();

  const [saldos, setSaldos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [constantes, setConstantes] = useState(null);
  const [filtro, setFiltro] = useState("");

  // Detalle de un cliente
  const [clienteSel, setClienteSel] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [loadingCuenta, setLoadingCuenta] = useState(false);
  const [verAnulados, setVerAnulados] = useState(false);

  // Modal de cobro: null = cerrado; si no, el cliente con el que abre ("" = a elegir).
  const [cobroPara, setCobroPara] = useState(null);

  const mediosPago = constantes?.mediosPago || [];

  const cargarSaldos = async () => {
    try {
      setSaldos(await obtenerCuentasCorrientesForratuc());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar las cuentas.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSaldos();
    obtenerConstantesPresupuesto().then(setConstantes).catch(() => {});
    obtenerClientes()
      .then((cls) =>
        setClientes((Array.isArray(cls) ? cls : cls?.clientes || []).filter((c) => clienteDeEmpresa(c, "forratuc")).sort((a, b) =>
          String(a.razonSocial || "").localeCompare(String(b.razonSocial || ""))))
      )
      .catch(() => {});
  }, []);

  const cargarCuenta = async (clienteId) => {
    setLoadingCuenta(true);
    try {
      setCuenta(await obtenerCuentaClienteForratuc(clienteId));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar la cuenta.", "error");
    } finally {
      setLoadingCuenta(false);
    }
  };
  useEffect(() => {
    if (clienteSel) cargarCuenta(clienteSel);
    else setCuenta(null);
    setVerAnulados(false);
  }, [clienteSel]);

  const pagoRegistrado = () => {
    setCobroPara(null);
    cargarSaldos();
    if (clienteSel) cargarCuenta(clienteSel);
  };

  const anularCobro = async (rec) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: `¿Anular el recibo ${escapeHtml(rec.numero)}?`,
      html: `El saldo del cliente vuelve a subir ${pesos(rec.total)}.`,
      input: "text",
      inputPlaceholder: "Por qué se anula (ej. cheque rechazado)",
      inputValidator: (v) => (!v?.trim() ? "Escribí el motivo." : undefined),
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await anularCobroForratuc(rec._id, motivo.trim());
      cargarSaldos();
      cargarCuenta(clienteSel);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  const imprimirMovimiento = (m) => {
    if (m.tipo === "presupuesto") imprimirPresupuestoForratuc(m.documento, { medios: mediosPago });
    else imprimirReciboForratuc(m.documento, { medios: mediosPago, cliente: cuenta?.cliente });
  };

  const detalleMovimiento = (m) =>
    m.tipo === "presupuesto"
      ? (m.documento.lineas || []).map((l) => l.descripcion).join(" · ")
      : (m.documento.pagos || []).map((p) => mediosPago.find((x) => x.key === p.medio)?.etiqueta || p.medio).join(" + ");

  const saldosFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return q
      ? saldos.filter((s) => `${s.razonSocial} ${s.cuit || ""} ${s.telefono || ""}`.toLowerCase().includes(q))
      : saldos;
  }, [saldos, filtro]);
  const totalACobrar = saldos.reduce((a, s) => a + (s.saldo > 0 ? s.saldo : 0), 0);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm"
            onClick={() => (clienteSel ? setClienteSel(null) : navigate("/forratuc"))}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-journal-text me-2 text-secondary"></i>
            {clienteSel && cuenta ? cuenta.cliente.razonSocial : "Cuentas corrientes"}
          </h1>
          <button className="btn btn-success btn-sm ms-auto" onClick={() => setCobroPara(clienteSel || "")}>
            <i className="bi bi-cash-coin me-1"></i>Registrar pago
          </button>
        </div>

        {/* ══════════ LISTA DE SALDOS ══════════ */}
        {!clienteSel && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                <input className="form-control form-control-sm" style={{ maxWidth: 320 }}
                  placeholder="Buscar cliente, CUIT o teléfono" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
                <div className="ms-auto text-end">
                  <div className="small text-muted">Total a cobrar</div>
                  <div className="fs-5 fw-bold">{pesos(totalACobrar)}</div>
                </div>
              </div>

              {loading ? (
                <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
              ) : saldosFiltrados.length === 0 ? (
                <div className="text-muted text-center py-4">
                  {saldos.length === 0
                    ? "Todavía no hay presupuestos en cuenta corriente ni pagos."
                    : "Ningún cliente coincide con la búsqueda."}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Cliente</th>
                        <th className="text-end">Compras</th>
                        <th className="text-end">Pagos</th>
                        <th className="text-end">Saldo</th>
                        <th>Último movimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saldosFiltrados.map((s) => (
                        <tr key={s.cliente} role="button" onClick={() => setClienteSel(s.cliente)}>
                          <td className="fw-semibold">
                            {s.razonSocial}
                            {s.cuit && <span className="text-muted small ms-2">{s.cuit}</span>}
                          </td>
                          <td className="text-end">{pesos(s.debe)}</td>
                          <td className="text-end">{pesos(s.haber)}</td>
                          <td className={`text-end fw-bold ${s.saldo > 0 ? "text-danger" : s.saldo < 0 ? "text-success" : ""}`}>
                            {pesos(s.saldo)}
                            {s.saldo < 0 && <div className="small fw-normal">a favor</div>}
                          </td>
                          <td className="small text-muted">{s.ultimoMovimiento ? formatearFechaLocal(s.ultimoMovimiento) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ CUENTA DE UN CLIENTE ══════════ */}
        {clienteSel && (loadingCuenta && !cuenta ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : cuenta && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                <div className="small text-muted">
                  {[cuenta.cliente.cuit && `CUIT ${cuenta.cliente.cuit}`, cuenta.cliente.telefono, cuenta.cliente.direccion]
                    .filter(Boolean).join(" · ")}
                </div>
                <div className="text-end">
                  <div className="small text-muted">Saldo</div>
                  <div className={`fs-4 fw-bold ${cuenta.saldo > 0 ? "text-danger" : cuenta.saldo < 0 ? "text-success" : ""}`}>
                    {pesos(cuenta.saldo)}
                  </div>
                  {cuenta.saldo < 0 && <div className="small text-success">a favor del cliente</div>}
                </div>
              </div>

              {cuenta.movimientos.length === 0 ? (
                <div className="text-muted text-center py-4">Sin movimientos.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Fecha</th>
                        <th>Comprobante</th>
                        <th>Detalle</th>
                        <th className="text-end">Debe</th>
                        <th className="text-end">Haber</th>
                        <th className="text-end">Saldo</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuenta.movimientos.map((m) => (
                        <tr key={m._id}>
                          <td className="text-nowrap">{formatearFechaLocal(m.fecha)}</td>
                          <td className="text-nowrap fw-semibold">
                            <span className={`badge me-1 ${m.tipo === "presupuesto" ? "bg-secondary" : "bg-success"}`}>
                              {m.tipo === "presupuesto" ? "Presupuesto" : "Recibo"}
                            </span>
                            {m.numero}
                          </td>
                          <td className="small" style={{ maxWidth: 360 }}>{detalleMovimiento(m)}</td>
                          <td className="text-end">{m.debe ? pesos(m.debe) : ""}</td>
                          <td className="text-end">{m.haber ? pesos(m.haber) : ""}</td>
                          <td className="text-end fw-semibold">{pesos(m.saldo)}</td>
                          <td className="text-end text-nowrap">
                            <button className="btn btn-sm btn-outline-secondary me-1" title="Imprimir" onClick={() => imprimirMovimiento(m)}>
                              <i className="bi bi-printer"></i>
                            </button>
                            {m.tipo === "cobro" && (
                              <button className="btn btn-sm btn-outline-danger" title="Anular recibo" onClick={() => anularCobro(m)}>
                                <i className="bi bi-x-circle"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {cuenta.anulados.length > 0 && (
                <div className="mt-3">
                  <button className="btn btn-link btn-sm p-0 text-muted" onClick={() => setVerAnulados((v) => !v)}>
                    <i className={`bi bi-chevron-${verAnulados ? "up" : "down"} me-1`}></i>
                    {cuenta.anulados.length} anulado{cuenta.anulados.length === 1 ? "" : "s"} (no suman)
                  </button>
                  {verAnulados && (
                    <ul className="list-unstyled small text-muted mt-2 mb-0">
                      {cuenta.anulados.map((m) => (
                        <li key={m._id} className="mb-1">
                          <span className="text-decoration-line-through">
                            {formatearFechaLocal(m.fecha)} · {m.numero} · {pesos(m.debe || m.haber)}
                          </span>
                          {m.documento.motivoAnulacion && <span className="ms-2">— {m.documento.motivoAnulacion}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* ══════════ MODAL: REGISTRAR PAGO ══════════ */}
        {cobroPara != null && (
          <RegistrarPagoModal clientes={clientes} mediosPago={mediosPago} clienteInicial={cobroPara}
            onClose={() => setCobroPara(null)} onRegistrado={pagoRegistrado} />
        )}
      </div>
    </Layout>
  );
};

export default ForratucCuentasCorrientesPage;
