import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerRemitosGranja,
  crearRemitoGranja,
  eliminarRemitoGranja,
  obtenerLotesGranja,
} from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const esSuperAdmin = () => localStorage.getItem("rolUsuario") === "superadmin";

const GRANJA_LABEL  = { cañete: "Cañete", los_pinos: "Los Pinos" };
const GRANJA_PREFIX = { cañete: "C", los_pinos: "P" };

const fmtNum  = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";

const badgeEstado = (estado) => {
  if (estado === "en_transito")    return <span className="badge bg-warning text-dark">En tránsito</span>;
  if (estado === "recibido")       return <span className="badge bg-success">Recibido ✓</span>;
  if (estado === "con_diferencia") return <span className="badge bg-danger">Con diferencia ⚠</span>;
  return <span className="badge bg-secondary">{estado}</span>;
};

const FORM_INICIAL = { loteGranja: "", cantidadEnviada: "", pesoEstimadoKg: "", fechaEnvio: obtenerFechaHoy(), observaciones: "" };

const GranjaRemitosPage = () => {
  const [remitos, setRemitos] = useState([]);
  const [lotes, setLotes]     = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(FORM_INICIAL);
  const [submitting, setSubmitting] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([
        obtenerRemitosGranja(),
        obtenerLotesGranja({ estado: "en_crianza" }),
      ]);
      setRemitos(r);
      setLotes(l);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const imprimirRemito = (remito) => {
    const lote   = remito.loteGranja;
    const granja = lote ? `${GRANJA_LABEL[lote.granja]} — Galpón ${GRANJA_PREFIX[lote.granja]}${lote.galpon}` : "—";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
      <title>Remito ${remito.numeroRemito}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #222; }
        .logo { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
        .logo span { color: #f59e0b; }
        .codigo { font-size: 36px; font-weight: bold; color: #0d6efd; letter-spacing: 4px; text-align: center; margin: 20px 0; border: 3px solid #0d6efd; padding: 12px; border-radius: 8px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; }
        .row { display: flex; flex-direction: column; }
        .lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
        .val { font-size: 15px; font-weight: 600; }
        .firmas { display: flex; gap: 40px; margin-top: 48px; }
        .firma { flex: 1; border-top: 1px solid #aaa; padding-top: 6px; font-size: 11px; color: #666; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="logo">Trigotuc <span>Avícola</span></div>
      <div style="font-size:12px;color:#666;margin-bottom:20px;">Remito de envío — Granja → Frigorífico</div>
      <div class="codigo">${remito.numeroRemito}</div>
      <div class="grid">
        <div class="row"><span class="lbl">Origen</span><span class="val">${granja}</span></div>
        <div class="row"><span class="lbl">Fecha de envío</span><span class="val">${fmtFecha(remito.fechaEnvio)}</span></div>
        <div class="row"><span class="lbl">Cantidad enviada</span><span class="val">${fmtNum(remito.cantidadEnviada)} pollos</span></div>
        ${remito.pesoEstimadoKg ? `<div class="row"><span class="lbl">Peso estimado</span><span class="val">${fmtNum(remito.pesoEstimadoKg)} kg</span></div>` : ""}
      </div>
      ${remito.observacionesEnvio ? `<p style="font-size:13px;color:#555;">Obs: ${remito.observacionesEnvio}</p>` : ""}
      <div class="firmas">
        <div class="firma">Firma conductor</div>
        <div class="firma">Firma recepción frigorífico</div>
        <div class="firma">Aclaración / DNI</div>
      </div>
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`;
    const win = window.open("", "_blank", "width=700,height=600");
    win.document.write(html);
    win.document.close();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const remito = await crearRemitoGranja({
        loteGranja:      form.loteGranja,
        cantidadEnviada: Number(form.cantidadEnviada),
        pesoEstimadoKg:  form.pesoEstimadoKg ? Number(form.pesoEstimadoKg) : undefined,
        fechaEnvio:      form.fechaEnvio,
        observaciones:   form.observaciones || undefined,
      });
      setShowModal(false);
      setForm(FORM_INICIAL);
      await cargar();
      imprimirRemito(remito);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEliminar = async (remito) => {
    const ok = await Swal.fire({ title: "¿Eliminar remito?", text: remito.numeroRemito, icon: "warning", showCancelButton: true, confirmButtonColor: "#dc3545", confirmButtonText: "Eliminar", cancelButtonText: "Cancelar" });
    if (!ok.isConfirmed) return;
    try { await eliminarRemitoGranja(remito._id); await cargar(); }
    catch (err) { Swal.fire("Error", err.message, "error"); }
  };

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-truck me-2 text-primary"></i>
            Remitos al Frigorífico
          </h1>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(FORM_INICIAL); setShowModal(true); }}>
            <i className="bi bi-plus-circle me-1"></i>Nuevo remito
          </button>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4"><div className="spinner-border text-primary"></div></div>
            ) : remitos.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">Sin remitos registrados.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Código</th>
                      <th>Galpón</th>
                      <th>Fecha envío</th>
                      <th className="text-end">Enviados</th>
                      <th className="text-end">Recibidos</th>
                      <th className="text-end">Dif.</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {remitos.map((r) => {
                      const lote = r.loteGranja;
                      return (
                        <tr key={r._id} className={r.estado === "con_diferencia" ? "table-warning" : ""}>
                          <td><span className="badge bg-primary fs-6">{r.numeroRemito}</span></td>
                          <td className="small">{lote ? `${GRANJA_LABEL[lote.granja]} G${GRANJA_PREFIX[lote.granja]}${lote.galpon}` : "—"}</td>
                          <td className="small">{fmtFecha(r.fechaEnvio)}</td>
                          <td className="text-end fw-semibold">{fmtNum(r.cantidadEnviada)}</td>
                          <td className="text-end">{r.cantidadRecibida != null ? fmtNum(r.cantidadRecibida) : <span className="text-muted">—</span>}</td>
                          <td className="text-end">
                            {r.diferencia != null
                              ? <span className={r.diferencia !== 0 ? "text-danger fw-bold" : "text-success"}>{r.diferencia !== 0 ? `−${fmtNum(r.diferencia)}` : "✓"}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>{badgeEstado(r.estado)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-outline-secondary btn-sm" title="Imprimir" onClick={() => imprimirRemito(r)}>
                                <i className="bi bi-printer"></i>
                              </button>
                              {esSuperAdmin() && (
                                <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminar(r)}>
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {showModal && (
        <>
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-truck me-2"></i>Nuevo remito al frigorífico</h5>
                  <button className="btn-close" onClick={() => setShowModal(false)} disabled={submitting}></button>
                </div>
                <div className="modal-body">
                  <form id="form-remito" onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fw-semibold">Galpón de origen</label>
                        <select className="form-select" value={form.loteGranja} onChange={(e) => setForm({ ...form, loteGranja: e.target.value })} required>
                          <option value="">— Seleccioná el galpón —</option>
                          {lotes.map((l) => (
                            <option key={l._id} value={l._id}>
                              {GRANJA_LABEL[l.granja]} — G{GRANJA_PREFIX[l.granja]}{l.galpon} ({fmtNum(l.cantidadActual)} pollos)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Cantidad enviada</label>
                        <input type="number" className="form-control" value={form.cantidadEnviada}
                          onChange={(e) => setForm({ ...form, cantidadEnviada: e.target.value })} min="1" placeholder="0" required />
                      </div>
                      <div className="col-6">
                        <label className="form-label">Peso estimado (kg) <span className="text-muted">(opc.)</span></label>
                        <input type="number" className="form-control" value={form.pesoEstimadoKg}
                          onChange={(e) => setForm({ ...form, pesoEstimadoKg: e.target.value })} min="0.01" step="0.01" placeholder="0,00" />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Fecha de envío</label>
                        <input type="date" className="form-control" value={form.fechaEnvio}
                          onChange={(e) => setForm({ ...form, fechaEnvio: e.target.value })} required />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Observaciones <span className="text-muted">(opcional)</span></label>
                        <input type="text" className="form-control" value={form.observaciones}
                          onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                      </div>
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowModal(false)} disabled={submitting}>Cancelar</button>
                  <button type="submit" form="form-remito" className="btn btn-primary" disabled={submitting}>
                    {submitting && <span className="spinner-border spinner-border-sm me-1"></span>}
                    <i className="bi bi-printer me-1"></i>Registrar e imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show"></div>
        </>
      )}

    </Layout>
  );
};

export default GranjaRemitosPage;
