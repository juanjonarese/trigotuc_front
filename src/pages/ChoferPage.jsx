import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerDespachosFrigorifico,
  confirmarCargaDespacho,
  confirmarEntregaDespacho,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmt = (n) => n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";
const camaraLbl = { cañete: "Cañete", trigotuc: "Trigotuc" };

// ── Tarjeta de despacho ──────────────────────────────────────────────────────
const DespachoCard = ({ despacho, onActualizar }) => {
  const [saving, setSaving] = useState(false);

  const pendienteFrigorifico = despacho.estado !== "completada";
  const porCargar   = despacho.estado === "completada" && !despacho.confirmadaCarga;
  const porEntregar = despacho.estado === "completada" &&  despacho.confirmadaCarga && !despacho.entregado;

  const barColor = pendienteFrigorifico ? "#f59e0b"
    : porCargar   ? "#2563eb"
    : porEntregar ? "#16a34a"
    : "#9ca3af";

  const handleConfirmarCarga = async () => {
    const ok = await Swal.fire({
      title: "¿Confirmás que cargaste este pedido?",
      html: `<div style="text-align:left;font-size:14px">
        <strong>${despacho.cliente?.razonSocial || "—"}</strong><br/>
        ${camaraLbl[despacho.camara] || despacho.camara} · ${fmt(despacho.totalCajones)} cajones · ${fmt(despacho.pesoTotalKg)} kg<br/><br/>
        <span style="color:#6b7280">Al confirmar declarás que recibiste esta carga en el camión.</span>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cargué",
      cancelButtonText: "Revisar",
      confirmButtonColor: "#2563eb",
    });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      await confirmarCargaDespacho(despacho._id);
      await onActualizar();
      Swal.fire({ icon: "success", title: "Carga confirmada", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarEntrega = async () => {
    const ok = await Swal.fire({
      title: "¿Confirmás la entrega al cliente?",
      html: `<div style="text-align:left;font-size:14px">
        <strong>${despacho.cliente?.razonSocial || "—"}</strong><br/>
        ${fmt(despacho.totalCajones)} cajones · ${fmt(despacho.pesoTotalKg)} kg<br/><br/>
        <span style="color:#6b7280">Al confirmar declarás que entregaste el pedido al cliente.</span>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, entregué",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      await confirmarEntregaDespacho(despacho._id);
      await onActualizar();
      Swal.fire({ icon: "success", title: "Entrega confirmada", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm mb-3" style={{ borderLeft: `5px solid ${barColor}` }}>
      <div className="card-body pb-2">

        {/* Encabezado */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span className="badge bg-dark fs-6 me-2">{despacho.numeroOrden}</span>
            {despacho.estado !== "completada" && (
              <span className="badge bg-warning text-dark">Pendiente frigorifico</span>
            )}
            {porCargar && (
              <span className="badge bg-primary"><i className="bi bi-box-arrow-in-down me-1"></i>Por cargar</span>
            )}
            {porEntregar && (
              <span className="badge bg-success"><i className="bi bi-truck me-1"></i>Por entregar</span>
            )}
            {despacho.entregado && (
              <span className="badge bg-secondary">Entregado</span>
            )}
          </div>
          <span className="small text-muted">{formatearFechaLocal(despacho.fecha)}</span>
        </div>

        {/* Cliente */}
        <div className="fw-bold fs-5 mb-1">{despacho.cliente?.razonSocial || "—"}</div>

        {/* Cámara + totales */}
        <div className="text-muted small mb-3">
          <i className="bi bi-snow me-1"></i>{camaraLbl[despacho.camara] || despacho.camara}
          &nbsp;·&nbsp;
          <i className="bi bi-box-seam me-1"></i>{fmt(despacho.totalCajones)} cajones
          &nbsp;·&nbsp;{fmt(despacho.pesoTotalKg)} kg
          {despacho.camion && (
            <span className="d-block mt-1">
              <i className="bi bi-truck me-1"></i>
              {despacho.camion.marca} · <span className="fw-semibold">{despacho.camion.patente}</span>
            </span>
          )}
        </div>

        {/* Detalle calibres */}
        {(despacho.calibres || []).length > 0 && (
          <div className="mb-3">
            <div className="text-muted small fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.05em" }}>
              Pollos por calibre
            </div>
            <div className="d-flex flex-wrap gap-2">
              {despacho.calibres.map((c) => (
                <div key={c.calibre} className="rounded px-3 py-2 text-center"
                  style={{ background: "#eff6ff", border: "1px solid #bfdbfe", minWidth: 80 }}>
                  <div className="fw-bold text-primary" style={{ fontSize: "0.8rem" }}>Cal. {c.calibre}</div>
                  <div className="fw-bold fs-5">{fmt(c.cajones)}</div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>cajones</div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>{fmt(c.cajones * 20)} kg</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detalle trozados */}
        {(despacho.trozados || []).length > 0 && (
          <div className="mb-3">
            <div className="text-muted small fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.05em" }}>
              Trozados
            </div>
            <div className="d-flex flex-wrap gap-2">
              {despacho.trozados.map((t) => (
                <div key={t.tipo} className="rounded px-3 py-2 text-center"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a", minWidth: 80 }}>
                  <div className="fw-bold text-warning" style={{ fontSize: "0.8rem" }}>{t.tipo}</div>
                  <div className="fw-bold fs-5">{fmt(t.cajas)}</div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>cajas · {fmt(t.kgTotal)} kg</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendienteFrigorifico && (
          <div className="alert alert-warning py-2 mb-2 small d-flex align-items-center gap-2">
            <i className="bi bi-hourglass-split"></i>
            <span>Esperando confirmación del frigorifico antes de cargar</span>
          </div>
        )}
        {porEntregar && (
          <div className="alert alert-success py-2 mb-2 small d-flex align-items-center gap-2">
            <i className="bi bi-check-circle-fill"></i>
            <span>Carga verificada — podés entregar al cliente</span>
          </div>
        )}

        {despacho.observaciones && (
          <div className="rounded p-2 mb-2 small" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
            <i className="bi bi-info-circle me-1 text-warning"></i>{despacho.observaciones}
          </div>
        )}
      </div>

      {/* Botón de acción */}
      {(porCargar || porEntregar) && (
        <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
          {porCargar && (
            <button className="btn btn-primary w-100 btn-lg" onClick={handleConfirmarCarga} disabled={saving}>
              {saving
                ? <span className="spinner-border spinner-border-sm me-2"></span>
                : <i className="bi bi-check2-circle me-2"></i>
              }
              Confirmar que recibí esta carga
            </button>
          )}
          {porEntregar && (
            <button className="btn btn-success w-100 btn-lg" onClick={handleConfirmarEntrega} disabled={saving}>
              {saving
                ? <span className="spinner-border spinner-border-sm me-2"></span>
                : <i className="bi bi-house-check me-2"></i>
              }
              Confirmar entrega al cliente
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Página ───────────────────────────────────────────────────────────────────
const ChoferPage = () => {
  const [despachos, setDespachos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("cargar");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerDespachosFrigorifico({ modalidad: "delivery_chofer" });
      setDespachos(data);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las órdenes.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Pendiente: todos los asignados que aún no cargaron (incluso si frigorifico no confirmó)
  const porCargar   = despachos.filter((d) => !d.confirmadaCarga && !d.entregado);
  const porEntregar = despachos.filter((d) =>  d.confirmadaCarga && !d.entregado);
  const entregadas  = despachos.filter((d) =>  d.entregado);

  const lista = tab === "cargar" ? porCargar : tab === "entregar" ? porEntregar : entregadas;

  return (
    <Layout>
      <div className="container-fluid px-2 px-sm-3">

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
            { key: "cargar",    label: "Por cargar",    count: porCargar.length,   color: "btn-primary"   },
            { key: "entregar",  label: "Por entregar",  count: porEntregar.length, color: "btn-success"   },
            { key: "historial", label: "Historial",     count: entregadas.length,  color: "btn-secondary" },
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
          lista.map((d) => (
            <DespachoCard
              key={d._id}
              despacho={d}
              onActualizar={cargar}
            />
          ))
        )}

      </div>
    </Layout>
  );
};

export default ChoferPage;
