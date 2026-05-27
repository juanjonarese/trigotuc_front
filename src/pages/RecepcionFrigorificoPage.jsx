import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerDespachosFrigorifico,
  completarDespachoFrigorifico,
} from "../services/api";
import Swal from "sweetalert2";

const TIPOS_TROZADO = [
  { tipo: "filet",   label: "Filet"      },
  { tipo: "pata",    label: "Pata/muslo" },
  { tipo: "alita",   label: "Alita"      },
  { tipo: "menudo",  label: "Menudo"     },
  { tipo: "carcaza", label: "Carcaza"    },
];

const fmt       = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n ?? 0);
const fmtFecha  = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";
const camaraLbl = (v) => v === "cañete" ? "Cañete" : v === "trigotuc" ? "Trigotuc" : v;
const tipoLbl   = (tipo) => TIPOS_TROZADO.find((x) => x.tipo === tipo)?.label || tipo;

// ── Imprimir remito de entrega ────────────────────────────────────────────────
const imprimirRemito = (despacho) => {
  const cliente  = despacho.cliente?.razonSocial || "—";
  const camara   = camaraLbl(despacho.camara);
  const turno    = despacho.turno || "—";
  const fecha    = new Date(despacho.fecha).toLocaleDateString("es-AR");
  const hoy      = new Date().toLocaleDateString("es-AR");

  const filasCalibres = (despacho.calibres || []).map((c) => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #dee2e6">Cal. ${c.calibre}</td>
      <td style="padding:6px 12px;border:1px solid #dee2e6;text-align:right">${fmt(c.cajones)}</td>
      <td style="padding:6px 12px;border:1px solid #dee2e6;text-align:right">${fmt(c.cajones * 20)} kg</td>
    </tr>`).join("");

  const filasTrozados = (despacho.trozados || []).map((t) => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #dee2e6">${tipoLbl(t.tipo)}</td>
      <td style="padding:6px 12px;border:1px solid #dee2e6;text-align:right">${fmt(t.cajas)} cajas</td>
      <td style="padding:6px 12px;border:1px solid #dee2e6;text-align:right">${fmt(t.kgTotal)} kg</td>
    </tr>`).join("");

  const bloque = (copia) => `
    <div class="copia">
      <div class="copia-label">${copia}</div>
      <div class="logo">Trigotuc <span>Avícola</span></div>
      <div class="subtitulo">Orden de Carga — Frigorifico</div>

      <h2>Datos de la orden</h2>
      <div class="grid">
        <div class="fila"><span class="lbl">N° Orden</span><span class="val">${despacho.numeroOrden}</span></div>
        <div class="fila"><span class="lbl">Fecha</span><span class="val">${fecha}</span></div>
        <div class="fila"><span class="lbl">Cliente</span><span class="val">${cliente}</span></div>
        <div class="fila"><span class="lbl">Cámara / Turno</span><span class="val">${camara} — ${turno}</span></div>
        <div class="fila"><span class="lbl">Fecha de entrega</span><span class="val">${hoy}</span></div>
      </div>

      ${filasCalibres ? `
        <h2>Pollos faenados (por calibre)</h2>
        <table>
          <thead><tr>
            <th>Calibre</th>
            <th style="text-align:right">Cajones</th>
            <th style="text-align:right">Kg total</th>
          </tr></thead>
          <tbody>${filasCalibres}</tbody>
        </table>` : ""}

      ${filasTrozados ? `
        <h2>Trozados</h2>
        <table>
          <thead><tr>
            <th>Tipo</th>
            <th style="text-align:right">Cajas</th>
            <th style="text-align:right">Kg total</th>
          </tr></thead>
          <tbody>${filasTrozados}</tbody>
        </table>` : ""}

      ${despacho.observaciones
        ? `<div class="obs"><strong>Observaciones:</strong> ${despacho.observaciones}</div>`
        : ""}

      <div class="firma-grid">
        <div class="firma-box">
          <div class="firma-linea"></div>
          <div class="firma-lbl">Firma y aclaración del cliente</div>
        </div>
        <div class="firma-box">
          <div class="firma-linea"></div>
          <div class="firma-lbl">Firma del encargado de frigorifico</div>
        </div>
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Orden ${despacho.numeroOrden}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 20px; color: #222; margin: 0; }
      .copia { max-width: 640px; margin: 0 auto; padding: 20px 30px; }
      .separador { border: none; border-top: 2px dashed #aaa; margin: 12px auto; max-width: 640px; }
      .copia-label { float: right; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #ccc; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; }
      .logo { font-size: 20px; font-weight: bold; margin-bottom: 2px; }
      .logo span { color: #f59e0b; }
      .subtitulo { font-size: 12px; color: #666; margin-bottom: 16px; }
      h2 { font-size: 13px; border-bottom: 2px solid #222; padding-bottom: 5px; margin: 16px 0 10px; text-transform: uppercase; letter-spacing: .5px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 14px; }
      .fila { display: flex; flex-direction: column; }
      .lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
      .val { font-size: 13px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
      th { background: #f3f4f6; text-align: left; padding: 6px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #555; border: 1px solid #dee2e6; }
      .obs { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 8px 12px; font-size: 11px; color: #78350f; margin: 10px 0; }
      .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
      .firma-box { text-align: center; }
      .firma-linea { border-top: 1.5px solid #222; margin-bottom: 5px; }
      .firma-lbl { font-size: 10px; color: #555; }
      @media print { body { padding: 0; } }
    </style></head><body>
    ${bloque("Original — Cliente")}
    <hr class="separador"/>
    ${bloque("Duplicado — Frigorifico")}
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const win = window.open("", "_blank", "width=720,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
};

// ── Modal confirmar entrega ───────────────────────────────────────────────────
const ConfirmarModal = ({ despacho, onClose, onConfirmado }) => {
  const [saving, setSaving] = useState(false);

  const handleConfirmar = async () => {
    setSaving(true);
    try {
      await completarDespachoFrigorifico(despacho._id);
      imprimirRemito(despacho);
      onConfirmado();
      Swal.fire({
        icon: "success",
        title: "Entrega confirmada",
        text: `Orden ${despacho.numeroOrden} cerrada correctamente.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo confirmar la entrega.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">

            <div className="modal-header bg-success text-white">
              <div>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-check2-circle me-2"></i>Confirmar entrega
                </h5>
                <div className="small opacity-75 mt-1">
                  {despacho.numeroOrden} — {despacho.cliente?.razonSocial || "—"}
                </div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">

              {/* Datos generales */}
              <div className="card border-0 bg-light mb-3">
                <div className="card-body py-2 px-3">
                  <div className="row g-2 small">
                    <div className="col-6">
                      <div className="text-muted fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>Cámara</div>
                      <div className="fw-semibold">{camaraLbl(despacho.camara)}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>Turno</div>
                      <div className="fw-semibold">{despacho.turno || "—"}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>Fecha</div>
                      <div>{fmtFecha(despacho.fecha)}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted fw-semibold text-uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.05em" }}>Registrado por</div>
                      <div>{despacho.registradoPor?.nombreUsuario || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calibres */}
              {despacho.calibres?.length > 0 && (
                <div className="mb-3">
                  <div className="small text-muted fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.05em" }}>
                    Pollos faenados
                  </div>
                  <table className="table table-sm table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Calibre</th>
                        <th className="text-end">Cajones</th>
                        <th className="text-end">Kg total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despacho.calibres.map((c, i) => (
                        <tr key={i}>
                          <td><span className="badge bg-primary">Cal. {c.calibre}</span></td>
                          <td className="text-end fw-semibold">{fmt(c.cajones)}</td>
                          <td className="text-end text-muted">{fmt(c.cajones * 20)} kg</td>
                        </tr>
                      ))}
                      <tr className="table-light fw-semibold">
                        <td>Total</td>
                        <td className="text-end">{fmt(despacho.totalCajones)}</td>
                        <td className="text-end">{fmt(despacho.pesoTotalKg)} kg</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Trozados */}
              {despacho.trozados?.length > 0 && (
                <div className="mb-3">
                  <div className="small text-muted fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.05em" }}>
                    Trozados
                  </div>
                  <table className="table table-sm table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Tipo</th>
                        <th className="text-end">Cajas</th>
                        <th className="text-end">Kg total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despacho.trozados.map((t, i) => (
                        <tr key={i}>
                          <td className="fw-semibold">{tipoLbl(t.tipo)}</td>
                          <td className="text-end">{fmt(t.cajas)}</td>
                          <td className="text-end text-muted">{fmt(t.kgTotal)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {despacho.observaciones && (
                <div className="p-2 rounded small"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <i className="bi bi-info-circle me-1 text-warning"></i>
                  {despacho.observaciones}
                </div>
              )}

              <div className="alert alert-info py-2 mb-0 mt-3 small">
                <i className="bi bi-printer me-1"></i>
                Al confirmar se imprimirá el remito para que firme el cliente.
              </div>

            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-success btn-lg px-4" onClick={handleConfirmar} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                <i className="bi bi-check-circle me-1"></i>Confirmar entrega
              </button>
            </div>

          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página principal ─────────────────────────────────────────────────────────
const RecepcionFrigorificoPage = () => {
  const [despachos, setDespachos]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [busqueda, setBusqueda]       = useState("");
  const [despachoModal, setDespachoModal] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await obtenerDespachosFrigorifico();
      setDespachos(data);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const despachosVisibles = despachos
    .filter((d) => filtroEstado === "" || d.estado === filtroEstado)
    .filter((d) => {
      if (!busqueda) return true;
      const txt = busqueda.toLowerCase();
      return (
        d.numeroOrden?.toLowerCase().includes(txt) ||
        (d.cliente?.razonSocial || "").toLowerCase().includes(txt)
      );
    });

  return (
    <Layout>
      <div className="container-fluid">

        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-arrow-in-down me-2 text-success"></i>
            Recepción de Órdenes
          </h1>
          <div className="d-flex gap-2">
            {["pendiente", "completada", ""].map((e) => (
              <button key={e}
                className={`btn btn-sm ${filtroEstado === e ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltroEstado(e)}>
                {e === "" ? "Todas"
                  : e === "pendiente"
                  ? <><i className="bi bi-hourglass-split me-1"></i>Pendientes</>
                  : <><i className="bi bi-check-circle me-1"></i>Completadas</>
                }
              </button>
            ))}
          </div>
        </div>

        {/* Buscador */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group">
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Buscar por número de orden o cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button className="btn btn-outline-secondary" onClick={() => setBusqueda("")}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : despachosVisibles.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            {busqueda ? "No se encontró ninguna orden." : "No hay órdenes en este estado."}
          </div>
        ) : filtroEstado === "pendiente" ? (

          /* ── TARJETAS — pendientes ── */
          <div className="row g-3">
            {despachosVisibles.map((d) => (
              <div key={d._id} className="col-12 col-md-6 col-lg-4">
                <div className="card border-0 shadow-sm h-100"
                  style={{ borderLeft: "4px solid #198754" }}>
                  <div className="card-body">

                    {/* Número + turno + cámara */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-dark fs-6">{d.numeroOrden}</span>
                      <div className="d-flex gap-1 flex-wrap justify-content-end">
                        <span className="badge bg-secondary">
                          <i className="bi bi-snow me-1"></i>{camaraLbl(d.camara)}
                        </span>
                        {d.turno && (
                          <span className={`badge ${d.turno === "mañana" ? "bg-warning text-dark" : "bg-info text-dark"}`}>
                            <i className={`bi bi-${d.turno === "mañana" ? "sunrise" : "sunset"} me-1`}></i>
                            {d.turno === "mañana" ? "Mañana" : "Tarde"}
                          </span>
                        )}
                        <span className="badge bg-warning text-dark">
                          <i className="bi bi-hourglass-split me-1"></i>Pendiente
                        </span>
                      </div>
                    </div>

                    {/* Cliente + fecha */}
                    <div className="fw-semibold mb-1">
                      <i className="bi bi-person me-1 text-muted"></i>
                      {d.cliente?.razonSocial || "—"}
                    </div>
                    <div className="text-muted small mb-2">
                      <i className="bi bi-calendar me-1"></i>{fmtFecha(d.fecha)}
                    </div>

                    {/* Detalle calibres + trozados */}
                    {(d.calibres?.length > 0 || d.trozados?.length > 0) && (
                      <div className="mb-2 rounded overflow-hidden"
                        style={{ border: "1px solid #d1fae5" }}>
                        {d.calibres?.map((c, idx) => (
                          <div key={idx}
                            className="d-flex justify-content-between align-items-center px-2 py-1"
                            style={{
                              borderBottom: (idx < d.calibres.length - 1 || d.trozados?.length > 0)
                                ? "1px solid #d1fae5" : "none",
                              background: "#f0fdf4",
                            }}>
                            <span className="fw-semibold text-success">Cal. {c.calibre}</span>
                            <span className="text-muted small">{fmt(c.cajones)} cajones · {fmt(c.cajones * 20)} kg</span>
                          </div>
                        ))}
                        {d.trozados?.map((t, idx) => (
                          <div key={`t${idx}`}
                            className="d-flex justify-content-between align-items-center px-2 py-1"
                            style={{
                              borderBottom: idx < d.trozados.length - 1 ? "1px solid #fef9c3" : "none",
                              background: "#fffbeb",
                            }}>
                            <span className="fw-semibold text-warning">{tipoLbl(t.tipo)}</span>
                            <span className="text-muted small">{fmt(t.cajas)} cajas · {fmt(t.kgTotal)} kg</span>
                          </div>
                        ))}
                        <div className="d-flex justify-content-between align-items-center px-2 py-1 fw-bold"
                          style={{ background: "#dcfce7" }}>
                          <span className="text-success small">Total</span>
                          <span className="text-muted small">
                            {d.totalCajones > 0 ? `${fmt(d.totalCajones)} cajones` : ""}
                            {d.totalCajones > 0 && d.totalKgTrozados > 0 ? " · " : ""}
                            {d.totalKgTrozados > 0 ? `${fmt(d.totalKgTrozados)} kg trozados` : ""}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Observaciones */}
                    {d.observaciones && (
                      <div className="mb-2 p-2 rounded"
                        style={{ background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.85rem" }}>
                        <i className="bi bi-info-circle me-1 text-warning"></i>{d.observaciones}
                      </div>
                    )}

                  </div>

                  <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
                    <button className="btn btn-success w-100" onClick={() => setDespachoModal(d)}>
                      <i className="bi bi-check2-circle me-1"></i>Confirmar entrega
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        ) : (

          /* ── TABLA — completadas / todas ── */
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>N° Orden</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Cámara</th>
                      <th>Turno</th>
                      <th>Detalle</th>
                      <th>Estado</th>
                      <th>Completada por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despachosVisibles.map((d) => (
                      <tr key={d._id}>
                        <td>
                          <span className={`badge ${d.estado === "completada" ? "bg-success" : "bg-warning text-dark"}`}>
                            {d.numeroOrden}
                          </span>
                        </td>
                        <td className="small">{fmtFecha(d.fecha)}</td>
                        <td className="fw-semibold small">{d.cliente?.razonSocial || "—"}</td>
                        <td><span className="badge bg-secondary">{camaraLbl(d.camara)}</span></td>
                        <td className="small text-muted">{d.turno || "—"}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {d.calibres?.map((c, i) => (
                              <span key={i} className="badge bg-primary">Cal.{c.calibre}: {fmt(c.cajones)} caj</span>
                            ))}
                            {d.trozados?.map((t, i) => (
                              <span key={`t${i}`} className="badge bg-warning text-dark">
                                {tipoLbl(t.tipo)}: {fmt(t.cajas)} caj
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          {d.estado === "completada"
                            ? <span className="badge bg-success">Completada</span>
                            : <span className="badge bg-warning text-dark">Pendiente</span>
                          }
                        </td>
                        <td className="small text-muted">{d.completadoPor?.nombreUsuario || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        )}

      </div>

      {despachoModal && (
        <ConfirmarModal
          despacho={despachoModal}
          onClose={() => setDespachoModal(null)}
          onConfirmado={() => { setDespachoModal(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default RecepcionFrigorificoPage;
