import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import { obtenerAuditLog } from "../services/api";
import Swal from "sweetalert2";

const badgeAccion = (accion) => {
  if (accion === "crear")    return <span className="badge bg-success">Crear</span>;
  if (accion === "editar")   return <span className="badge bg-warning text-dark">Editar</span>;
  if (accion === "eliminar") return <span className="badge bg-danger">Eliminar</span>;
  return <span className="badge bg-secondary">{accion}</span>;
};

const ENTIDAD_LABEL = {
  loteGranja:           "Ingreso pollitos",
  mudanza:              "Mudanza",
  pesaje:               "Pesaje",
  mortandad:            "Mortandad",
  lote:                 "Lote faena",
  venta:                "Venta",
  envio:                "Envío cámara",
  despachoFrigorifico:  "Orden de carga",
  ordenCarga:           "Orden de carga",
  ordenRetiro:          "Retiro",
};

const AREA_CFG = {
  granja:      { bg: "#f0fdf4", color: "#166534", label: "Granja" },
  frigorifico: { bg: "#eff6ff", color: "#1d4ed8", label: "Frigorifico" },
  contable:    { bg: "#fdf4ff", color: "#7e22ce", label: "Contable" },
  sistema:     { bg: "#f8fafc", color: "#475569", label: "Sistema" },
};

const badgeArea = (area) => {
  const cfg = AREA_CFG[area];
  if (!cfg) return null;
  return (
    <span className="badge rounded-pill" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
};

const formatFecha = (f) => {
  const d = new Date(f);
  return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

const HistorialAccesosPage = () => {
  const [logs, setLogs]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [filtroArea, setFiltroArea]     = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroDesde, setFiltroDesde]   = useState("");
  const [filtroHasta, setFiltroHasta]   = useState("");

  const cargarLogs = async () => {
    setLoading(true);
    try {
      const data = await obtenerAuditLog({
        area:          filtroArea,
        nombreUsuario: filtroUsuario,
        fechaDesde:    filtroDesde,
        fechaHasta:    filtroHasta,
      });
      setLogs(data);
    } catch {
      Swal.fire("Error", "No se pudo cargar el historial.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarLogs(); }, []);

  const limpiar = () => {
    setFiltroArea(""); setFiltroUsuario(""); setFiltroDesde(""); setFiltroHasta("");
  };

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="h3 mb-0">
              <i className="bi bi-clock-history me-2 text-primary"></i>
              Actividad del sistema
            </h1>
            <div className="small text-muted mt-1">Movimientos registrados por usuario — últimos 500</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={cargarLogs} disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-1"></span>Cargando...</>
              : <><i className="bi bi-search me-1"></i>Buscar</>
            }
          </button>
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label form-label-sm mb-1">Área</label>
                <select className="form-select form-select-sm" value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="granja">Granja</option>
                  <option value="frigorifico">Frigorifico</option>
                  <option value="contable">Contable</option>
                </select>
              </div>
              <div className="col-6 col-sm-4 col-md-3">
                <label className="form-label form-label-sm mb-1">Usuario</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Nombre del empleado..."
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                />
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label form-label-sm mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
              </div>
              <div className="col-6 col-sm-4 col-md-2">
                <label className="form-label form-label-sm mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
              </div>
              <div className="col-12 col-sm-auto d-flex gap-2 align-items-center">
                <button className="btn btn-outline-secondary btn-sm" onClick={limpiar}>Limpiar</button>
                {logs.length > 0 && <small className="text-muted">{logs.length} registro{logs.length !== 1 ? "s" : ""}</small>}
              </div>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-5"><div className="spinner-border text-primary"></div></div>
            ) : logs.length === 0 ? (
              <div className="text-center text-muted p-5">
                <i className="bi bi-inbox fs-2 d-block mb-2"></i>
                No hay registros para los filtros seleccionados.
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {logs.map((log) => (
                    <div key={log._id} className="card border-0 shadow-sm mb-2">
                      <div className="card-body py-2 px-3">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <div className="d-flex gap-1 flex-wrap align-items-center">
                            {badgeArea(log.area)}
                            {badgeAccion(log.accion)}
                          </div>
                          <span className="text-muted" style={{ fontSize: "0.72rem" }}>{formatFecha(log.fecha)}</span>
                        </div>
                        <div className="fw-semibold small">{log.nombreUsuario || "—"} <span className="text-muted fw-normal">({log.rolUsuario})</span></div>
                        <div className="text-muted small mt-1">{log.descripcion || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.85rem" }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "145px" }}>Fecha y hora</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Área</th>
                        <th>Acción</th>
                        <th>Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log._id}>
                          <td className="text-muted text-nowrap" style={{ fontSize: "0.78rem" }}>{formatFecha(log.fecha)}</td>
                          <td className="fw-semibold">{log.nombreUsuario || "—"}</td>
                          <td className="text-muted small">{log.rolUsuario || "—"}</td>
                          <td>{badgeArea(log.area) || <span className="text-muted small">—</span>}</td>
                          <td>{badgeAccion(log.accion)}</td>
                          <td className="text-muted">{log.descripcion || "—"}</td>
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
