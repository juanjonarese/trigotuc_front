import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { obtenerOrdenesRetiro, marcarOrdenEntregada } from "../services/api";
import Swal from "sweetalert2";

const CAMARAS = { cañete: "Cañete", trigotuc: "Trigotuc" };

const OrdenesRetiroPage = () => {
  const navigate = useNavigate();
  const rolUsuario = localStorage.getItem("rolUsuario");
  const puedeEntregar = rolUsuario === "superadmin" || rolUsuario === "frigorifico" || rolUsuario === "camaras";

  const [ordenes, setOrdenes]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filtroCamara, setFiltroCamara] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("pendiente");

  const formatNum   = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
  const formatFecha = (f) => new Date(f).toLocaleDateString("es-AR");

  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      const filtros = {};
      if (filtroStatus) filtros.status = filtroStatus;
      if (filtroCamara) filtros.camara = filtroCamara;
      const data = await obtenerOrdenesRetiro(filtros);
      setOrdenes(data);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las órdenes.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarOrdenes(); }, [filtroStatus, filtroCamara]);

  const handleEntregar = async (orden) => {
    const fmtNum = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
    const filas = orden.calibres.map((c) =>
      `<tr>
        <td style="padding:4px 12px;border:1px solid #dee2e6;text-align:center;">${c.calibre}</td>
        <td style="padding:4px 12px;border:1px solid #dee2e6;text-align:right;">${fmtNum(c.cajones)}</td>
       </tr>`
    ).join("");

    const { isConfirmed } = await Swal.fire({
      title: `Confirmar entrega — ${orden.numeroOrden}`,
      html: `
        <div style="text-align:left">
          <p class="mb-1"><strong>Cliente:</strong> ${orden.cliente?.razonSocial}</p>
          <p class="mb-3"><strong>Cámara:</strong> ${CAMARAS[orden.camara] || orden.camara}</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
            <thead>
              <tr>
                <th style="padding:4px 12px;background:#f8f9fa;border:1px solid #dee2e6;text-align:center;">Calibre</th>
                <th style="padding:4px 12px;background:#f8f9fa;border:1px solid #dee2e6;text-align:right;">Cajones</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
          <p class="mb-0"><strong>Total:</strong> ${fmtNum(orden.totalCajones)} cajones · ${fmtNum(orden.pesoTotalKg)} kg</p>
        </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-check-circle me-1"></i> Confirmar entrega',
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#198754",
    });

    if (!isConfirmed) return;

    try {
      await marcarOrdenEntregada(orden._id);
      Swal.fire({
        title: "¡Entregado!",
        text: `Orden ${orden.numeroOrden} marcada como entregada.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      cargarOrdenes();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo actualizar la orden.", "error");
    }
  };

  const pendientes  = ordenes.filter((o) => o.status === "pendiente");
  const entregadas  = ordenes.filter((o) => o.status === "entregado");

  return (
    <Layout>
      <div className="container-fluid">

        {/* Header */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/frigorifico")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <div>
            <h1 className="h3 mb-0">
              <i className="bi bi-box-arrow-right me-2 text-warning"></i>
              Entregas
            </h1>
            <p className="text-muted small mb-0">Órdenes de retiro pendientes y entregadas</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
          <div className="btn-group btn-group-sm">
            {[
              { val: "pendiente", label: "Pendientes" },
              { val: "entregado", label: "Entregadas" },
              { val: "",          label: "Todas"      },
            ].map(({ val, label }) => (
              <button
                key={val}
                className={`btn ${filtroStatus === val ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltroStatus(val)}
              >
                {label}
                {val === "pendiente" && pendientes.length > 0 && filtroStatus !== "pendiente" && (
                  <span className="badge bg-warning text-dark ms-1">{pendientes.length}</span>
                )}
              </button>
            ))}
          </div>
          <div className="btn-group btn-group-sm">
            {[
              { val: "",         label: "Todas las cámaras" },
              { val: "cañete",   label: "Cañete"            },
              { val: "trigotuc", label: "Trigotuc"          },
            ].map(({ val, label }) => (
              <button
                key={val}
                className={`btn ${filtroCamara === val ? "btn-warning text-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltroCamara(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contador pendientes */}
        {filtroStatus === "pendiente" && pendientes.length > 0 && (
          <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-clock-history fs-5"></i>
            <span><strong>{pendientes.length}</strong> pedido{pendientes.length !== 1 ? "s" : ""} esperando retiro</span>
          </div>
        )}

        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-warning" role="status"></div>
          </div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            No hay órdenes {filtroStatus === "pendiente" ? "pendientes" : filtroStatus === "entregado" ? "entregadas" : ""}.
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="d-md-none">
              {ordenes.map((o) => (
                <div
                  key={o._id}
                  className={`card mb-3 border-2 ${o.status === "pendiente" ? "border-warning" : "border-success"}`}
                >
                  <div className="card-body py-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="badge bg-dark fs-6 me-2">{o.numeroOrden}</span>
                        <span className={`badge ${o.status === "pendiente" ? "bg-warning text-dark" : "bg-success"}`}>
                          {o.status === "pendiente" ? "Pendiente" : "Entregada"}
                        </span>
                      </div>
                      <span className="text-muted small">{formatFecha(o.fecha)}</span>
                    </div>
                    <div className="fw-semibold mb-1">{o.cliente?.razonSocial}</div>
                    <div className="mb-2">
                      <span className={`badge ${o.camara === "cañete" ? "bg-info text-dark" : "bg-primary"}`}>
                        <i className="bi bi-snow me-1"></i>{CAMARAS[o.camara] || o.camara}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {o.calibres.map((c, i) => (
                        <span key={i} className="badge bg-secondary">
                          Cal.{c.calibre}: {formatNum(c.cajones)} caj
                        </span>
                      ))}
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="small text-muted">
                        <strong>{formatNum(o.totalCajones)}</strong> cajones · <strong>{formatNum(o.pesoTotalKg)}</strong> kg
                      </span>
                      {o.status === "pendiente" && puedeEntregar && (
                        <button className="btn btn-success btn-sm" onClick={() => handleEntregar(o)}>
                          <i className="bi bi-check-circle me-1"></i>Entregar
                        </button>
                      )}
                      {o.status === "entregado" && o.fechaEntrega && (
                        <span className="small text-success">
                          <i className="bi bi-check-circle-fill me-1"></i>
                          {formatFecha(o.fechaEntrega)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabla */}
            <div className="d-none d-md-block">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-0">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Orden</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Cámara</th>
                        <th>Calibres</th>
                        <th className="text-end">Cajones</th>
                        <th className="text-end">Kg</th>
                        <th>Estado</th>
                        {puedeEntregar && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ordenes.map((o) => (
                        <tr key={o._id} className={o.status === "pendiente" ? "table-warning" : ""}>
                          <td><span className="badge bg-dark">{o.numeroOrden}</span></td>
                          <td className="small">{formatFecha(o.fecha)}</td>
                          <td className="fw-semibold">{o.cliente?.razonSocial}</td>
                          <td>
                            <span className={`badge ${o.camara === "cañete" ? "bg-info text-dark" : "bg-primary"}`}>
                              <i className="bi bi-snow me-1"></i>
                              {CAMARAS[o.camara] || o.camara}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {o.calibres.map((c, i) => (
                                <span key={i} className="badge bg-secondary">
                                  Cal.{c.calibre}: {formatNum(c.cajones)} caj
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-end">{formatNum(o.totalCajones)}</td>
                          <td className="text-end">{formatNum(o.pesoTotalKg)}</td>
                          <td>
                            {o.status === "pendiente" ? (
                              <span className="badge bg-warning text-dark">
                                <i className="bi bi-clock me-1"></i>Pendiente
                              </span>
                            ) : (
                              <span className="badge bg-success">
                                <i className="bi bi-check-circle me-1"></i>
                                Entregada {o.fechaEntrega ? `· ${formatFecha(o.fechaEntrega)}` : ""}
                              </span>
                            )}
                          </td>
                          {puedeEntregar && (
                            <td>
                              {o.status === "pendiente" && (
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleEntregar(o)}
                                >
                                  <i className="bi bi-check-circle me-1"></i>
                                  Confirmar entrega
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default OrdenesRetiroPage;
