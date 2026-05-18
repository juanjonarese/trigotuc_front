import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { obtenerOrdenCargaPorId, entregarOrdenCarga } from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";


const OrdenCargaDetallePage = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const printRef   = useRef();
  const rolUsuario = localStorage.getItem("rolUsuario");
  const puedeEntregar  = rolUsuario === "superadmin" || rolUsuario === "frigorifico" || rolUsuario === "administracion";

  const [orden, setOrden]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showEntrega, setShowEntrega] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [entregaForm, setEntregaForm] = useState({
    cantidadReal: "", pesoRealKg: "", observacionesEntrega: "", fechaEntrega: obtenerFechaHoy(),
  });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerOrdenCargaPorId(id);
      setOrden(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleEntregar = async (e) => {
    e.preventDefault();
    if (!entregaForm.cantidadReal || !entregaForm.pesoRealKg) {
      Swal.fire("Faltan datos", "Ingresá cantidad y peso real.", "warning");
      return;
    }
    const ok = await Swal.fire({
      title: "¿Confirmar entrega?",
      html: `<strong>${entregaForm.cantidadReal}</strong> pollos · <strong>${entregaForm.pesoRealKg} kg</strong>`,
      icon: "question", showCancelButton: true,
      confirmButtonText: "Confirmar entrega", cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      await entregarOrdenCarga(id, {
        cantidadReal:         Number(entregaForm.cantidadReal),
        pesoRealKg:           Number(entregaForm.pesoRealKg),
        observacionesEntrega: entregaForm.observacionesEntrega || undefined,
        fechaEntrega:         ajustarFechaParaGuardar(entregaForm.fechaEntrega),
      });
      setShowEntrega(false);
      await cargar();
      Swal.fire({ icon: "success", title: "Entrega registrada", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImprimir = () => {
    const contenido = printRef.current.innerHTML;
    const ventana = window.open("", "_blank", "width=800,height=600");
    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Orden de Carga ${orden.numero}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 30px; }
          .oc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 16px; }
          .oc-empresa { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
          .oc-sub { font-size: 11px; color: #666; margin-top: 4px; }
          .oc-numero { text-align: right; }
          .oc-numero .num { font-size: 20px; font-weight: 700; color: #1a7a1a; }
          .oc-numero .fecha { font-size: 11px; color: #666; margin-top: 4px; }
          .oc-section { margin-bottom: 20px; }
          .oc-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
          .oc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .oc-field label { font-size: 10px; color: #888; text-transform: uppercase; display: block; margin-bottom: 2px; }
          .oc-field span { font-weight: 600; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #ddd; }
          td { padding: 8px 10px; border: 1px solid #ddd; font-size: 13px; }
          .text-right { text-align: right; }
          .total-row td { font-weight: 700; background: #f0f8f0; font-size: 15px; }
          .oc-estado { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
          .estado-pendiente { background: #fff3cd; color: #856404; }
          .estado-entregada { background: #d1e7dd; color: #0a3622; }
          .oc-footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
          .firma { text-align: center; margin-top: 60px; }
          .firma .linea { border-top: 1px solid #333; width: 200px; margin: 0 auto 6px; }
          .firma span { font-size: 11px; color: #666; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>${contenido}</body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); }, 400);
  };

  if (loading) return (
    <Layout><div className="text-center py-5"><div className="spinner-border text-success"></div></div></Layout>
  );
  if (!orden) return (
    <Layout><div className="container-fluid pt-4 text-muted">Orden no encontrada.</div></Layout>
  );

  const granjaLabel = orden.granja === "cañete" ? "Cañete" : "Los Pinos";

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/granja/ordenes-carga")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0 flex-grow-1">
            Orden de Carga <span className="text-success">{orden.numero}</span>
          </h1>
          <span className={`badge fs-6 ${orden.estado === "entregada" ? "bg-success" : "bg-warning text-dark"}`}>
            {orden.estado === "entregada" ? "Entregada" : "Pendiente"}
          </span>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleImprimir}>
            <i className="bi bi-file-earmark-pdf me-1"></i>Descargar PDF
          </button>
        </div>

        {/* Datos principales */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <div className="text-muted small">Cliente</div>
                <div className="fw-bold">{orden.cliente?.razonSocial || orden.cliente?.nombre}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Granja</div>
                <div className="fw-bold">{granjaLabel}{orden.lote ? ` — Lote #${orden.lote.numeroLote}` : ""}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Fecha emisión</div>
                <div className="fw-bold">{formatearFechaLocal(orden.fechaEmision)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">Emitida por</div>
                <div className="fw-bold">{orden.registradoPor?.nombreUsuario || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Datos estimados vs reales */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white py-2">
            <h6 className="mb-0"><i className="bi bi-table me-2"></i>Cantidades</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th></th>
                    <th className="text-end">Pollos</th>
                    <th className="text-end">Peso (kg)</th>
                    {orden.estado === "entregada" && <th className="text-end">Diferencia</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-muted small fw-semibold">Estimado</td>
                    <td className="text-end">{orden.cantidadEstimada?.toLocaleString("es-AR")}</td>
                    <td className="text-end">{orden.pesoEstimadoKg} kg</td>
                    {orden.estado === "entregada" && <td></td>}
                  </tr>
                  {orden.estado === "entregada" && (
                    <tr className="table-success">
                      <td className="fw-semibold">Real recepcionado</td>
                      <td className="text-end fw-bold">{orden.cantidadReal?.toLocaleString("es-AR")}</td>
                      <td className="text-end fw-bold">{orden.pesoRealKg} kg</td>
                      <td className="text-end">
                        {orden.diferenciaCantidad != null && (
                          <span className={`badge ${Math.abs(orden.diferenciaCantidad) > 0 ? "bg-warning text-dark" : "bg-success"}`}>
                            {orden.diferenciaCantidad >= 0 ? "+" : ""}{orden.diferenciaCantidad} pollos
                          </span>
                        )}
                        {orden.diferenciaKg != null && (
                          <span className={`badge ms-1 ${Math.abs(orden.diferenciaKg) > 0 ? "bg-warning text-dark" : "bg-success"}`}>
                            {orden.diferenciaKg >= 0 ? "+" : ""}{orden.diferenciaKg?.toFixed(1)} kg
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {orden.observaciones && (
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-2">
              <span className="text-muted small">Observaciones: </span>{orden.observaciones}
            </div>
          </div>
        )}

        {/* Datos de entrega */}
        {orden.estado === "entregada" && (
          <div className="card border-0 shadow-sm mb-3 border-start border-4 border-success">
            <div className="card-body py-2">
              <div className="row g-2">
                <div className="col-6 col-md-3">
                  <div className="text-muted small">Fecha entrega</div>
                  <div className="fw-bold">{formatearFechaLocal(orden.fechaEntrega)}</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="text-muted small">Entregado por</div>
                  <div className="fw-bold">{orden.entregadaPor?.nombreUsuario || "—"}</div>
                </div>
                {orden.observacionesEntrega && (
                  <div className="col-12 col-md-6">
                    <div className="text-muted small">Obs. entrega</div>
                    <div>{orden.observacionesEntrega}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Formulario de entrega */}
        {orden.estado === "pendiente" && puedeEntregar && (
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
              <h6 className="mb-0"><i className="bi bi-check-circle me-2 text-success"></i>Registrar entrega</h6>
              <button className="btn btn-outline-success btn-sm" onClick={() => setShowEntrega((v) => !v)}>
                {showEntrega ? "Cancelar" : "Completar entrega"}
              </button>
            </div>
            {showEntrega && (
              <div className="card-body">
                <form onSubmit={handleEntregar}>
                  <div className="row g-3">
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold">Fecha entrega</label>
                      <input type="date" className="form-control" value={entregaForm.fechaEntrega}
                        onChange={(e) => setEntregaForm({ ...entregaForm, fechaEntrega: e.target.value })} required />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold">Cantidad real (pollos) <span className="text-danger">*</span></label>
                      <input type="number" className="form-control" placeholder="0" min="1" value={entregaForm.cantidadReal}
                        onChange={(e) => setEntregaForm({ ...entregaForm, cantidadReal: e.target.value })} required />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label fw-semibold">Peso real (kg) <span className="text-danger">*</span></label>
                      <input type="number" className="form-control" placeholder="0" min="0.01" step="0.01" value={entregaForm.pesoRealKg}
                        onChange={(e) => setEntregaForm({ ...entregaForm, pesoRealKg: e.target.value })} required />
                    </div>
                    <div className="col-6 col-md-3">
                      <label className="form-label">Observaciones (opcional)</label>
                      <input type="text" className="form-control" value={entregaForm.observacionesEntrega}
                        onChange={(e) => setEntregaForm({ ...entregaForm, observacionesEntrega: e.target.value })} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button type="submit" className="btn btn-success" disabled={saving}>
                      {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                      <i className="bi bi-check-circle me-1"></i>Confirmar entrega
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Contenido oculto para PDF */}
      <div ref={printRef} style={{ display: "none" }}>
        <div className="oc-header">
          <div>
            <div className="oc-empresa">Trigotuc Avícola</div>
            <div className="oc-sub">Orden de Carga</div>
          </div>
          <div className="oc-numero">
            <div className="num">{orden.numero}</div>
            <div className="fecha">Fecha: {formatearFechaLocal(orden.fechaEmision)}</div>
            <div style={{ marginTop: "6px" }}>
              <span className={`oc-estado ${orden.estado === "entregada" ? "estado-entregada" : "estado-pendiente"}`}>
                {orden.estado === "entregada" ? "Entregada" : "Pendiente"}
              </span>
            </div>
          </div>
        </div>

        <div className="oc-section">
          <h3>Cliente</h3>
          <div className="oc-grid">
            <div className="oc-field"><label>Nombre</label><span>{orden.cliente?.razonSocial || orden.cliente?.nombre}</span></div>
            {orden.cliente?.cuit && <div className="oc-field"><label>CUIT</label><span>{orden.cliente.cuit}</span></div>}
            {orden.cliente?.direccion && <div className="oc-field"><label>Dirección</label><span>{orden.cliente.direccion}</span></div>}
          </div>
        </div>

        <div className="oc-section">
          <h3>Detalles de la orden</h3>
          <div className="oc-grid">
            <div className="oc-field"><label>Granja</label><span>{granjaLabel}</span></div>
            {orden.lote && <div className="oc-field"><label>Lote</label><span>#{orden.lote.numeroLote} — Galpón {orden.lote.galpon}</span></div>}
          </div>
          <table style={{ marginTop: "12px" }}>
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="text-right">Pollos</th>
                <th className="text-right">Peso (kg)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pollos gordos — {granjaLabel}{orden.galpon ? ` · Galpón ${orden.galpon}` : ""}</td>
                <td className="text-right">{(orden.cantidadReal ?? orden.cantidadEstimada)?.toLocaleString("es-AR")}{!orden.cantidadReal ? " (est.)" : ""}</td>
                <td className="text-right">{orden.pesoRealKg ?? orden.pesoEstimadoKg} kg{!orden.pesoRealKg ? " (est.)" : ""}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {orden.observaciones && (
          <div className="oc-section">
            <h3>Observaciones</h3>
            <p>{orden.observaciones}</p>
          </div>
        )}

        {orden.estado === "entregada" && (
          <div className="oc-section">
            <h3>Datos de entrega</h3>
            <div className="oc-grid">
              <div className="oc-field"><label>Fecha entrega</label><span>{formatearFechaLocal(orden.fechaEntrega)}</span></div>
              <div className="oc-field"><label>Entregado por</label><span>{orden.entregadaPor?.nombreUsuario || "—"}</span></div>
            </div>
            {orden.observacionesEntrega && <p style={{ marginTop: "8px", fontSize: "12px" }}>{orden.observacionesEntrega}</p>}
          </div>
        )}

        <div className="oc-footer">
          <span>Trigotuc Avícola — Orden {orden.numero}</span>
          <span>Emitida: {formatearFechaLocal(orden.fechaEmision)}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "60px" }}>
          <div className="firma">
            <div className="linea"></div>
            <span>Firma empresa</span>
          </div>
          <div className="firma">
            <div className="linea"></div>
            <span>Firma cliente / conformidad</span>
          </div>
        </div>
      </div>

    </Layout>
  );
};

export default OrdenCargaDetallePage;
