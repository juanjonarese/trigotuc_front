import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { obtenerCtaCteGranja, obtenerDetalleCtaCteGranja } from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const formatARS = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n ?? 0);

const CtaCteGranjaPage = () => {
  const [cuentas, setCuentas]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [clienteDetalle, setClienteDetalle] = useState(null);
  const [detalle, setDetalle]         = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [busqueda, setBusqueda]       = useState("");

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await obtenerCtaCteGranja();
        setCuentas(data);
      } catch (err) {
        Swal.fire("Error", err.message, "error");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const verDetalle = async (cuenta) => {
    setClienteDetalle(cuenta.cliente);
    setDetalle(null);
    setLoadingDetalle(true);
    try {
      const data = await obtenerDetalleCtaCteGranja(cuenta.cliente._id);
      setDetalle(data);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setLoadingDetalle(false);
    }
  };

  const cuentasFiltradas = cuentas.filter((c) =>
    !busqueda || (c.cliente?.razonSocial || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <Layout>
      <div className="container-fluid">

        <div className="mb-4">
          <h1 className="h3 mb-1">
            <i className="bi bi-journal-text me-2 text-success"></i>
            Cuenta Corriente — Ventas Gordos
          </h1>
          <p className="text-muted small mb-0">Saldo por cliente de órdenes de carga entregadas.</p>
        </div>

        <div className="row g-3">
          {/* Lista de clientes */}
          <div className={clienteDetalle ? "col-12 col-lg-4" : "col-12"}>
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-2">
                <input
                  type="text" className="form-control form-control-sm"
                  placeholder="Buscar cliente..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-success"></div></div>
                ) : cuentasFiltradas.length === 0 ? (
                  <p className="text-center text-muted py-4 small">Sin movimientos registrados.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Cliente</th>
                          <th className="text-end">Ventas</th>
                          <th className="text-end">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuentasFiltradas.map((c) => (
                          <tr
                            key={c.cliente._id}
                            style={{ cursor: "pointer" }}
                            className={clienteDetalle?._id === c.cliente._id ? "table-active" : ""}
                            onClick={() => verDetalle(c)}
                          >
                            <td>
                              <div className="fw-semibold">{c.cliente.razonSocial}</div>
                              {c.cliente.cuit && <div className="text-muted small">{c.cliente.cuit}</div>}
                            </td>
                            <td className="text-end text-muted small">{formatARS(c.totalVentas)}</td>
                            <td className="text-end">
                              <span className={`fw-bold ${c.saldo > 0 ? "text-danger" : "text-success"}`}>
                                {formatARS(c.saldo)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detalle */}
          {clienteDetalle && (
            <div className="col-12 col-lg-8">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-0 fw-bold">{clienteDetalle.razonSocial}</h6>
                    {clienteDetalle.cuit && <div className="text-muted small">CUIT: {clienteDetalle.cuit}</div>}
                  </div>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => { setClienteDetalle(null); setDetalle(null); }}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>

                {loadingDetalle ? (
                  <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-success"></div></div>
                ) : detalle && (
                  <>
                    {/* Resumen */}
                    <div className="card-body py-2 border-bottom">
                      <div className="row g-2 text-center">
                        <div className="col-4">
                          <div className="text-muted small">Ventas</div>
                          <div className="fw-bold text-danger">{formatARS(detalle.totalDebe)}</div>
                        </div>
                        <div className="col-4">
                          <div className="text-muted small">Cobros</div>
                          <div className="fw-bold text-success">{formatARS(detalle.totalHaber)}</div>
                        </div>
                        <div className="col-4">
                          <div className="text-muted small">Saldo</div>
                          <div className={`fw-bold fs-5 ${detalle.saldo > 0 ? "text-danger" : "text-success"}`}>
                            {formatARS(detalle.saldo)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Movimientos */}
                    <div className="card-body p-0">
                      {detalle.movimientos.length === 0 ? (
                        <p className="text-center text-muted py-4 small">Sin movimientos.</p>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Fecha</th>
                                <th>Orden</th>
                                <th>Detalle</th>
                                <th className="text-end">Debe</th>
                                <th className="text-end">Haber</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalle.movimientos.map((m) => (
                                <tr key={m._id}>
                                  <td className="small text-muted">{formatearFechaLocal(m.fecha)}</td>
                                  <td><span className="badge bg-success">{m.numero}</span></td>
                                  <td className="small">{m.detalle}</td>
                                  <td className="text-end text-danger fw-semibold">{m.debe > 0 ? formatARS(m.debe) : "—"}</td>
                                  <td className="text-end text-success">{m.haber > 0 ? formatARS(m.haber) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="table-light">
                              <tr>
                                <td colSpan={3} className="fw-semibold">Total</td>
                                <td className="text-end text-danger fw-bold">{formatARS(detalle.totalDebe)}</td>
                                <td className="text-end text-success fw-bold">{formatARS(detalle.totalHaber)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default CtaCteGranjaPage;
