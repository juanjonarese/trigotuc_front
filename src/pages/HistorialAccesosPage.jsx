import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { obtenerAuditLog } from "../services/api";
import Swal from "sweetalert2";

const ENTIDADES = [
  { value: "",           label: "Todas" },
  { value: "venta",      label: "Ventas (frigorífico)" },
  { value: "lote",       label: "Lotes (frigorífico)" },
  { value: "envio",      label: "Envíos (frigorífico)" },
  { value: "loteGranja", label: "Lotes (granja)" },
];

const ACCIONES = [
  { value: "",         label: "Todas" },
  { value: "crear",    label: "Crear" },
  { value: "editar",   label: "Editar" },
  { value: "eliminar", label: "Eliminar" },
];

const badgeAccion = (accion) => {
  if (accion === "crear")    return <span className="badge bg-success">Crear</span>;
  if (accion === "editar")   return <span className="badge bg-warning text-dark">Editar</span>;
  if (accion === "eliminar") return <span className="badge bg-danger">Eliminar</span>;
  return <span className="badge bg-secondary">{accion}</span>;
};

const badgeEntidad = (entidad) => {
  if (entidad === "venta")      return <span className="badge bg-primary">Venta</span>;
  if (entidad === "lote")       return <span className="badge bg-dark">Lote Frig.</span>;
  if (entidad === "envio")      return <span className="badge bg-info text-dark">Envío</span>;
  if (entidad === "loteGranja") return <span className="badge bg-success">Lote Granja</span>;
  return <span className="badge bg-secondary">{entidad}</span>;
};

const formatFecha = (f) => {
  const d = new Date(f);
  return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

const HistorialAccesosPage = () => {
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filtroEntidad, setFiltroEntidad] = useState("");
  const [filtroAccion, setFiltroAccion]   = useState("");
  const [filtroDesde, setFiltroDesde]     = useState("");
  const [filtroHasta, setFiltroHasta]     = useState("");

  const cargarLogs = async () => {
    setLoading(true);
    try {
      const data = await obtenerAuditLog({
        entidad:    filtroEntidad,
        accion:     filtroAccion,
        fechaDesde: filtroDesde,
        fechaHasta: filtroHasta,
      });
      setLogs(data);
    } catch {
      Swal.fire("Error", "No se pudo cargar el historial.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarLogs(); }, []);

  const limpiarFiltros = () => {
    setFiltroEntidad("");
    setFiltroAccion("");
    setFiltroDesde("");
    setFiltroHasta("");
  };

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-shield-lock me-2 text-danger"></i>
            Historial de Accesos
          </h1>
          <button className="btn btn-primary btn-sm" onClick={cargarLogs} disabled={loading}>
            <i className="bi bi-search me-1"></i>
            Buscar
          </button>
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-6 col-sm-3 col-md-2">
                <label className="form-label form-label-sm mb-1">Módulo</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroEntidad}
                  onChange={(e) => setFiltroEntidad(e.target.value)}
                >
                  {ENTIDADES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-sm-3 col-md-2">
                <label className="form-label form-label-sm mb-1">Acción</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroAccion}
                  onChange={(e) => setFiltroAccion(e.target.value)}
                >
                  {ACCIONES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-sm-3 col-md-2">
                <label className="form-label form-label-sm mb-1">Desde</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={filtroDesde}
                  onChange={(e) => setFiltroDesde(e.target.value)}
                />
              </div>
              <div className="col-6 col-sm-3 col-md-2">
                <label className="form-label form-label-sm mb-1">Hasta</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={filtroHasta}
                  onChange={(e) => setFiltroHasta(e.target.value)}
                />
              </div>
              <div className="col-12 col-sm-auto">
                <button className="btn btn-outline-secondary btn-sm" onClick={limpiarFiltros}>
                  Limpiar
                </button>
              </div>
              {logs.length > 0 && (
                <div className="col-12 col-md-auto">
                  <small className="text-muted">{logs.length} registro(s)</small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">No hay registros para los filtros seleccionados.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {logs.map((log) => (
                    <div key={log._id} className="card border mb-2">
                      <div className="card-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <div className="d-flex gap-1 flex-wrap">
                            {badgeAccion(log.accion)}
                            {badgeEntidad(log.entidad)}
                          </div>
                          <span className="text-muted small">{formatFecha(log.fecha)}</span>
                        </div>
                        <div className="fw-semibold small mb-1">{log.nombreUsuario || "—"}</div>
                        <div className="text-muted small">{log.descripcion || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Acción</th>
                        <th>Módulo</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log._id}>
                          <td className="text-muted small text-nowrap">{formatFecha(log.fecha)}</td>
                          <td className="fw-semibold small">{log.nombreUsuario || "—"}</td>
                          <td className="text-muted small">{log.rolUsuario || "—"}</td>
                          <td>{badgeAccion(log.accion)}</td>
                          <td>{badgeEntidad(log.entidad)}</td>
                          <td className="text-muted small">{log.descripcion || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default HistorialAccesosPage;
