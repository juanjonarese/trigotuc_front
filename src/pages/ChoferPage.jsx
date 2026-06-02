import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { obtenerOrdenesRetiro, confirmarCargaOrdenRetiro, confirmarEntregaChofer } from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";
const CAMARAS = { cañete: "Cañete", trigotuc: "Trigotuc" };

// ── Tarjeta de orden ─────────────────────────────────────────────────────────
const OrdenCard = ({ orden, onConfirmarCarga, onConfirmarEntrega }) => {
  const porCargar  = !orden.confirmadaCarga && orden.status === "pendiente";
  const porEntregar = orden.confirmadaCarga && orden.status === "pendiente";

  const barColor = porCargar ? "#2563eb" : "#16a34a";

  return (
    <div className="card border-0 shadow-sm mb-3" style={{ borderLeft: `5px solid ${barColor}` }}>
      <div className="card-body pb-2">

        {/* Encabezado */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span className="badge bg-dark fs-6 me-2">{orden.numeroOrden}</span>
            {porCargar && (
              <span className="badge bg-primary"><i className="bi bi-box-arrow-in-down me-1"></i>Por cargar</span>
            )}
            {porEntregar && (
              <span className="badge bg-success"><i className="bi bi-truck me-1"></i>Por entregar</span>
            )}
          </div>
          <span className="small text-muted">{formatearFechaLocal(orden.fecha)}</span>
        </div>

        {/* Cliente */}
        <div className="fw-bold fs-5 mb-1">{orden.cliente?.razonSocial}</div>

        {/* Cámara + camión */}
        <div className="text-muted small mb-3">
          <i className="bi bi-snow me-1"></i>{CAMARAS[orden.camara] || orden.camara}
          &nbsp;·&nbsp;
          <i className="bi bi-box-seam me-1"></i>{fmtNum(orden.totalCajones)} cajones
          &nbsp;·&nbsp;{fmtNum(orden.pesoTotalKg)} kg
          {orden.camion && (
            <span className="d-block mt-1">
              <i className="bi bi-truck me-1"></i>
              {orden.camion.marca} · <span className="fw-semibold">{orden.camion.patente}</span>
            </span>
          )}
        </div>

        {/* Calibres */}
        {(orden.calibres || []).length > 0 && (
          <div className="mb-3">
            <div className="text-muted small fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.05em" }}>
              Detalle por calibre
            </div>
            <div className="d-flex flex-wrap gap-2">
              {orden.calibres.map((c) => (
                <div key={c.calibre}
                  className="rounded px-3 py-2 text-center"
                  style={{ background: "#eff6ff", border: "1px solid #bfdbfe", minWidth: 80 }}>
                  <div className="fw-bold text-primary" style={{ fontSize: "0.8rem" }}>Cal. {c.calibre}</div>
                  <div className="fw-bold fs-5">{fmtNum(c.cajones)}</div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>cajones</div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>{fmtNum(c.cajones * 20)} kg</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Carga confirmada */}
        {porEntregar && (
          <div className="alert alert-success py-2 mb-2 small d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill"></i>
            <span>Carga verificada — podés entregar al cliente</span>
          </div>
        )}

        {orden.observaciones && (
          <div className="rounded p-2 mb-2 small" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
            <i className="bi bi-info-circle me-1 text-warning"></i>{orden.observaciones}
          </div>
        )}
      </div>

      {/* Botón de acción */}
      <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
        {porCargar && (
          <button
            className="btn btn-primary w-100 btn-lg"
            onClick={() => onConfirmarCarga(orden)}
          >
            <i className="bi bi-check2-circle me-2"></i>Confirmar que recibí esta carga
          </button>
        )}
        {porEntregar && (
          <button
            className="btn btn-success w-100 btn-lg"
            onClick={() => onConfirmarEntrega(orden)}
          >
            <i className="bi bi-house-check me-2"></i>Confirmar entrega al cliente
          </button>
        )}
      </div>
    </div>
  );
};

// ── Página ───────────────────────────────────────────────────────────────────
const ChoferPage = () => {
  const [ordenes, setOrdenes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("cargar");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerOrdenesRetiro({ modalidad: "delivery_chofer" });
      setOrdenes(data);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las órdenes.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const porCargar   = ordenes.filter((o) => !o.confirmadaCarga && o.status === "pendiente");
  const porEntregar = ordenes.filter((o) =>  o.confirmadaCarga && o.status === "pendiente");
  const entregadas  = ordenes.filter((o) => o.status === "entregado");

  const handleConfirmarCarga = async (orden) => {
    const ok = await Swal.fire({
      title: "¿Confirmás la carga?",
      html: `<div style="text-align:left;font-size:14px">
        <strong>${orden.cliente?.razonSocial}</strong><br/>
        ${CAMARAS[orden.camara]} · ${fmtNum(orden.totalCajones)} cajones · ${fmtNum(orden.pesoTotalKg)} kg<br/><br/>
        <span style="color:#6b7280">Al confirmar declarás que recibiste exactamente esta carga en el camión.</span>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, recibí la carga",
      cancelButtonText: "Revisar",
      confirmButtonColor: "#2563eb",
    });
    if (!ok.isConfirmed) return;
    try {
      await confirmarCargaOrdenRetiro(orden._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Carga confirmada", text: `Orden ${orden.numeroOrden} lista para entregar.`, timer: 2000, showConfirmButton: false });
      setTab("entregar");
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleConfirmarEntrega = async (orden) => {
    const ok = await Swal.fire({
      title: "¿Confirmás la entrega?",
      html: `<div style="text-align:left;font-size:14px">
        <strong>${orden.cliente?.razonSocial}</strong><br/>
        ${fmtNum(orden.totalCajones)} cajones · ${fmtNum(orden.pesoTotalKg)} kg<br/><br/>
        <span style="color:#6b7280">Al confirmar declarás que entregaste el pedido al cliente.</span>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, entregué al cliente",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    });
    if (!ok.isConfirmed) return;
    try {
      await confirmarEntregaChofer(orden._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Entrega confirmada", text: `Orden ${orden.numeroOrden} cerrada.`, timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const lista = tab === "cargar" ? porCargar : tab === "entregar" ? porEntregar : entregadas;

  return (
    <Layout>
      <div className="container-fluid px-2 px-sm-3">

        {/* Encabezado */}
        <div className="mb-3">
          <h1 className="h4 mb-0">
            <i className="bi bi-truck me-2 text-primary"></i>Mis Entregas
          </h1>
        </div>

        {/* Resumen */}
        <div className="row g-2 mb-3">
          <div className="col-4">
            <div className="card border-0 text-center py-2" style={{ background: "#eff6ff" }}>
              <div className="fw-bold fs-4 text-primary">{porCargar.length}</div>
              <div className="small text-muted">Por cargar</div>
            </div>
          </div>
          <div className="col-4">
            <div className="card border-0 text-center py-2" style={{ background: "#f0fdf4" }}>
              <div className="fw-bold fs-4 text-success">{porEntregar.length}</div>
              <div className="small text-muted">Por entregar</div>
            </div>
          </div>
          <div className="col-4">
            <div className="card border-0 text-center py-2" style={{ background: "#f3f4f6" }}>
              <div className="fw-bold fs-4 text-secondary">{entregadas.length}</div>
              <div className="small text-muted">Entregadas</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="d-flex gap-1 mb-3">
          {[
            { key: "cargar",   label: "Por cargar",   count: porCargar.length,   color: "btn-primary"   },
            { key: "entregar", label: "Por entregar", count: porEntregar.length, color: "btn-success"   },
            { key: "historial",label: "Historial",    count: entregadas.length,  color: "btn-secondary" },
          ].map(({ key, label, count, color }) => (
            <button key={key}
              className={`btn btn-sm flex-fill ${tab === key ? color : "btn-outline-secondary"}`}
              onClick={() => setTab(key)}
            >
              {label}
              {count > 0 && tab !== key && (
                <span className="badge bg-danger ms-1" style={{ fontSize: "0.65rem" }}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className={`bi ${tab === "cargar" ? "bi-box" : tab === "entregar" ? "bi-truck" : "bi-check-circle"} fs-1 d-block mb-2 opacity-50`}></i>
            <p className="mb-0">
              {tab === "cargar"    && "No hay órdenes pendientes de carga."}
              {tab === "entregar"  && "No hay órdenes listas para entregar."}
              {tab === "historial" && "No hay entregas registradas."}
            </p>
          </div>
        ) : (
          lista.map((o) => (
            <OrdenCard
              key={o._id}
              orden={o}
              onConfirmarCarga={handleConfirmarCarga}
              onConfirmarEntrega={handleConfirmarEntrega}
            />
          ))
        )}

      </div>
    </Layout>
  );
};

export default ChoferPage;
