import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerDespachosFrigorifico,
  confirmarCargaDespacho,
  confirmarEntregaDespacho,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import Swal from "sweetalert2";

const TIPOS_TROZADO = [
  { tipo: "filet",   label: "Filet"      },
  { tipo: "pata",    label: "Pata/muslo" },
  { tipo: "alita",   label: "Alita"      },
  { tipo: "menudo",  label: "Menudo"     },
  { tipo: "carcaza", label: "Carcaza"    },
];

const fmt       = (n) => n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";
const camaraLbl = (v) => v === "cañete" ? "Cañete" : v === "trigotuc" ? "Trigotuc" : v;
const tipoLbl   = (tipo) => TIPOS_TROZADO.find((x) => x.tipo === tipo)?.label || tipo;

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
        ${camaraLbl(despacho.camara)} · ${fmt(despacho.totalCajones)} cajones · ${fmt(despacho.pesoTotalKg)} kg<br/><br/>
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
    <div className="card border-0 shadow-sm mb-3" style={{ borderLeft: `4px solid ${barColor}` }}>
      <div className="card-body">

        {/* Número + badges */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <span className="badge bg-dark fs-6">{despacho.numeroOrden}</span>
          <div className="d-flex gap-1 flex-wrap justify-content-end">
            <span className="badge bg-secondary">
              <i className="bi bi-snow me-1"></i>{camaraLbl(despacho.camara)}
            </span>
            {pendienteFrigorifico && (
              <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>Pendiente frigorifico</span>
            )}
            {porCargar && (
              <span className="badge bg-primary"><i className="bi bi-box-arrow-in-down me-1"></i>Por cargar</span>
            )}
            {porEntregar && (
              <span className="badge bg-success"><i className="bi bi-truck me-1"></i>Por entregar</span>
            )}
            {despacho.entregado && (
              <span className="badge bg-secondary"><i className="bi bi-check-circle me-1"></i>Entregado</span>
            )}
          </div>
        </div>

        {/* Cliente + fecha */}
        <div className="fw-bold fs-5 mb-1">
          <i className="bi bi-person me-1 text-muted"></i>{despacho.cliente?.razonSocial || "—"}
        </div>
        <div className="text-muted small mb-2">
          <i className="bi bi-calendar me-1"></i>{formatearFechaLocal(despacho.fecha)}
          {despacho.camion && (
            <span className="ms-2"><i className="bi bi-truck me-1"></i>{despacho.camion.marca} {despacho.camion.patente}</span>
          )}
        </div>

        {/* Lugar de retiro — prominente */}
        <div className="rounded px-3 py-2 mb-2 d-flex align-items-center gap-2"
          style={{ background: porCargar ? "#eff6ff" : "#f0fdf4", border: `1px solid ${porCargar ? "#bfdbfe" : "#bbf7d0"}` }}>
          <i className={`bi bi-geo-alt-fill fs-5 ${porCargar ? "text-primary" : "text-success"}`}></i>
          <div className="fw-bold" style={{ fontSize: "0.95rem" }}>
            Retirá en Frigorifico {camaraLbl(despacho.camara)}
          </div>
        </div>

        {/* Detalle calibres + trozados */}
        {(despacho.calibres?.length > 0 || despacho.trozados?.length > 0) && (
          <div className="mb-2 rounded overflow-hidden" style={{ border: "1px solid #d1fae5" }}>
            {despacho.calibres?.map((c, idx) => (
              <div key={c.calibre}
                className="d-flex justify-content-between align-items-center px-2 py-1"
                style={{
                  borderBottom: (idx < despacho.calibres.length - 1 || despacho.trozados?.length > 0)
                    ? "1px solid #d1fae5" : "none",
                  background: "#f0fdf4",
                }}>
                <span className="fw-semibold text-success">Cal. {c.calibre}</span>
                <span className="text-muted small">{fmt(c.cajones)} cajones · {fmt(c.cajones * 20)} kg</span>
              </div>
            ))}
            {despacho.trozados?.map((t, idx) => (
              <div key={`${t.tipo}-${t.clase || "-"}-${idx}`}
                className="d-flex justify-content-between align-items-center px-2 py-1"
                style={{
                  borderBottom: idx < despacho.trozados.length - 1 ? "1px solid #fef9c3" : "none",
                  background: "#fffbeb",
                }}>
                <span className="fw-semibold text-warning">{tipoLbl(t.tipo)}{t.clase ? ` ${t.clase}` : ""}</span>
                <span className="text-muted small">{fmt(t.cajas)} cajas · {fmt(t.kgTotal)} kg</span>
              </div>
            ))}
            <div className="d-flex justify-content-between align-items-center px-2 py-1 fw-bold"
              style={{ background: "#dcfce7" }}>
              <span className="text-success small">Total</span>
              <span className="text-muted small">
                {despacho.totalCajones > 0 ? `${fmt(despacho.totalCajones)} cajones` : ""}
                {despacho.totalCajones > 0 && despacho.totalKgTrozados > 0 ? " · " : ""}
                {despacho.totalKgTrozados > 0 ? `${fmt(despacho.totalKgTrozados)} kg trozados` : ""}
              </span>
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
          <div className="rounded p-2 mb-0 small" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
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
            <i className="bi bi-truck me-2 text-primary"></i>Cargas Camión
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
            { key: "historial", label: "Completadas",   count: entregadas.length,  color: "btn-secondary" },
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
