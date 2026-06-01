import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { obtenerOrdenesCarga, enviarOrdenCarga, entregarOrdenCarga, liberarOrdenCarga } from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmtNum = (n) => n != null ? new Intl.NumberFormat("es-AR").format(n) : "—";

const imprimirComprobanteEntrega = (orden, datosReales) => {
  const granja  = orden.granja === "cañete" ? "Cañete" : "Los Pinos";
  const galpon  = orden.galpon ? ` — Galpón ${orden.galpon}` : "";
  const cliente = orden.cliente?.razonSocial || orden.cliente?.nombre || "—";
  const fechaEntrega = datosReales.fechaEntrega
    ? new Date(datosReales.fechaEntrega + "T12:00:00").toLocaleDateString("es-AR")
    : new Date().toLocaleDateString("es-AR");

  const cantEst = Number(orden.cantidadEstimada);
  const cantReal = Number(datosReales.cantidadReal);
  const pesoEst  = Number(orden.pesoEstimadoKg);
  const pesoReal = Number(datosReales.pesoRealKg);
  const difCant  = cantReal - cantEst;
  const difKg    = pesoReal - pesoEst;
  const hayDif   = difCant !== 0 || Math.abs(difKg) > 0.01;

  const bloque = (copia) => `
    <div class="copia">
      <div class="copia-label">${copia}</div>
      <div class="logo">Trigotuc <span>Avícola</span></div>
      <div class="subtitulo">Comprobante de Entrega — Pollos en Pie</div>
      <h2>Datos de la orden</h2>
      <div class="grid">
        <div class="fila"><span class="lbl">N° Orden</span><span class="val">${orden.numero}</span></div>
        <div class="fila"><span class="lbl">Fecha entrega</span><span class="val">${fechaEntrega}</span></div>
        <div class="fila"><span class="lbl">Cliente</span><span class="val">${cliente}</span></div>
        <div class="fila"><span class="lbl">Granja / Galpón</span><span class="val">${granja}${galpon}</span></div>
      </div>
      <h2>Detalle de entrega</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th style="text-align:right">Cantidad (pollos)</th>
            <th style="text-align:right">Peso (kg)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color:#555">Pedido estimado</td>
            <td style="text-align:right">${fmtNum(cantEst)}</td>
            <td style="text-align:right">${pesoEst.toLocaleString("es-AR", { minimumFractionDigits: 1 })}</td>
          </tr>
          <tr>
            <td style="font-weight:600">Entregado real</td>
            <td style="text-align:right;font-weight:600">${fmtNum(cantReal)}</td>
            <td style="text-align:right;font-weight:600">${pesoReal.toLocaleString("es-AR", { minimumFractionDigits: 1 })}</td>
          </tr>
          <tr>
            <td class="dif">Diferencia</td>
            <td class="dif" style="text-align:right">${difCant > 0 ? "+" : ""}${difCant}</td>
            <td class="dif" style="text-align:right">${difKg > 0 ? "+" : ""}${difKg.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>
      ${datosReales.observacionesEntrega
        ? `<div class="obs"><strong>Observaciones:</strong> ${datosReales.observacionesEntrega}</div>`
        : ""}
      <div class="firma-grid">
        <div class="firma-box">
          <div class="firma-linea"></div>
          <div class="firma-lbl">Firma y aclaración del cliente</div>
        </div>
        <div class="firma-box">
          <div class="firma-linea"></div>
          <div class="firma-lbl">Firma del encargado de granja</div>
        </div>
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Comprobante Entrega ${orden.numero}</title>
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
      th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #555; }
      td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; }
      .dif { color: ${hayDif ? "#92400e" : "#166534"}; font-weight: 600; }
      .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; }
      .firma-box { text-align: center; }
      .firma-linea { border-top: 1.5px solid #222; margin-bottom: 5px; }
      .firma-lbl { font-size: 10px; color: #555; }
      .obs { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 8px 12px; font-size: 11px; color: #78350f; margin-top: 10px; margin-bottom: 6px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    ${bloque("Original — Cliente")}
    <hr class="separador"/>
    ${bloque("Duplicado — Granja")}
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const win = window.open("", "_blank", "width=720,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
};

const ConfirmarModal = ({ orden, onClose, onConfirmada, esAdmin = false }) => {
  const yaLiberada = !!orden.liberada;
  const [paso, setPaso]   = useState(yaLiberada ? 2 : 1);
  const [codigo, setCodigo] = useState("");
  const [codigoError, setCodigoError] = useState("");
  const [liberadaSinCodigo, setLiberadaSinCodigo] = useState(yaLiberada);
  const [form, setForm] = useState({
    cantidadReal: "",
    pesoRealKg: "",
    observacionesEntrega: "",
    fechaEntrega: obtenerFechaHoy(),
  });
  const [saving, setSaving] = useState(false);

  const verificarCodigo = (e) => {
    e.preventDefault();
    if (codigo.trim().toUpperCase() === orden.codigoRetiro) {
      setCodigoError("");
      setPaso(2);
    } else {
      setCodigoError("Código incorrecto. Verificá con el cliente.");
    }
  };

  const liberarSinCodigo = () => {
    setLiberadaSinCodigo(true);
    setPaso(2);
  };

  const hayDiferencia = () => {
    const cant = Number(form.cantidadReal);
    const peso = Number(form.pesoRealKg);
    return (
      (form.cantidadReal !== "" && cant !== orden.cantidadEstimada) ||
      (form.pesoRealKg   !== "" && Math.abs(peso - orden.pesoEstimadoKg) > 0.01)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cantidadReal || !form.pesoRealKg) {
      Swal.fire("Faltan datos", "Ingresá cantidad y peso real.", "warning");
      return;
    }
    if (form.fechaEntrega !== obtenerFechaHoy()) {
      Swal.fire("Fecha inválida", "La fecha de entrega debe ser el día de hoy.", "warning");
      return;
    }
    const difCant = Number(form.cantidadReal) - orden.cantidadEstimada;
    const difKg   = Number(form.pesoRealKg) - orden.pesoEstimadoKg;
    const ok = await Swal.fire({
      title: "¿Confirmar entrega?",
      html: `
        <div style="text-align:left;font-size:14px">
          <div><strong>Estimado:</strong> ${Number(orden.cantidadEstimada).toLocaleString("es-AR")} pollos · ${orden.pesoEstimadoKg} kg</div>
          <div style="margin-top:6px"><strong>Recibido:</strong> ${Number(form.cantidadReal).toLocaleString("es-AR")} pollos · ${form.pesoRealKg} kg</div>
          ${hayDiferencia() ? `<div style="margin-top:6px;color:#856404"><strong>Diferencia:</strong> ${difCant > 0 ? "+" : ""}${difCant} pollos · ${difKg > 0 ? "+" : ""}${difKg.toFixed(1)} kg</div>` : ""}
        </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Revisar",
    });
    if (!ok.isConfirmed) return;

    setSaving(true);
    try {
      await entregarOrdenCarga(orden._id, {
        ...(codigo && !liberadaSinCodigo ? { codigoRetiro: codigo.trim().toUpperCase() } : {}),
        cantidadReal:         Number(form.cantidadReal),
        pesoRealKg:           Number(form.pesoRealKg),
        observacionesEntrega: form.observacionesEntrega || undefined,
        fechaEntrega:         ajustarFechaParaGuardar(form.fechaEntrega),
      });
      imprimirComprobanteEntrega(orden, form);
      onConfirmada();
      Swal.fire({
        icon: "success",
        title: "Recepción confirmada",
        text: `Orden ${orden.numero} cerrada correctamente.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
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
                <div className="small opacity-75 mt-1">{orden.numero} — {orden.cliente?.razonSocial || orden.cliente?.nombre}</div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">

              {/* PASO 1 — verificar código */}
              {paso === 1 && (
                <form onSubmit={verificarCodigo}>
                  <div className="text-center mb-4 mt-2">
                    <i className="bi bi-key fs-1 text-success"></i>
                    <h5 className="mt-2 mb-1">Verificación de código</h5>
                    <p className="text-muted small mb-0">
                      Pedile al cliente el código de retiro que figura en su orden.
                    </p>
                  </div>
                  <div className="mb-3">
                    <input
                      type="text"
                      className={`form-control form-control-lg text-center fw-bold ${codigoError ? "is-invalid" : ""}`}
                      placeholder="XXXXXX"
                      value={codigo}
                      onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCodigoError(""); }}
                      maxLength={6}
                      style={{ letterSpacing: "0.3em", fontSize: "1.5rem" }}
                      autoFocus
                      required
                    />
                    {codigoError && <div className="invalid-feedback text-center">{codigoError}</div>}
                  </div>
                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-success btn-lg">
                      <i className="bi bi-arrow-right-circle me-1"></i>Verificar código
                    </button>
                    {esAdmin && (
                      <button type="button" className="btn btn-outline-warning" onClick={liberarSinCodigo}>
                        <i className="bi bi-unlock me-1"></i>Liberar sin código
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* PASO 2 — detalle del pedido + datos reales */}
              {paso === 2 && (
                <>
                  {liberadaSinCodigo ? (
                    <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-unlock-fill"></i>
                      <span>Liberada sin código por administración</span>
                    </div>
                  ) : (
                    <div className="alert alert-success py-2 mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Código verificado correctamente</span>
                    </div>
                  )}

                  {/* Detalle del pedido */}
                  <div className="card border-0 bg-light mb-3">
                    <div className="card-body py-2 px-3">
                      <div className="small text-muted fw-semibold mb-2 text-uppercase" style={{ letterSpacing: "0.05em" }}>
                        Estimado del pedido
                      </div>
                      <div className="row g-2 text-center">
                        <div className="col-6">
                          <div className="fw-bold fs-5">{Number(orden.cantidadEstimada).toLocaleString("es-AR")}</div>
                          <div className="text-muted small">pollos pedidos</div>
                        </div>
                        <div className="col-6">
                          <div className="fw-bold fs-5">{orden.pesoEstimadoKg} kg</div>
                          <div className="text-muted small">peso estimado</div>
                        </div>
                        {orden.galpon && (
                          <div className="col-12 mt-1">
                            <span className="badge bg-secondary">
                              {orden.granja === "cañete" ? "Cañete" : "Los Pinos"} — Galpón {orden.galpon}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <form id="form-recepcion" onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">
                          Cantidad entregada <span className="text-danger">*</span>
                        </label>
                        <input
                          type="number" min="1"
                          className={`form-control form-control-lg text-center ${
                            form.cantidadReal && Number(form.cantidadReal) !== orden.cantidadEstimada
                              ? "border-warning"
                              : ""
                          }`}
                          placeholder={orden.cantidadEstimada}
                          value={form.cantidadReal}
                          onChange={(e) => setForm({ ...form, cantidadReal: e.target.value })}
                          required autoFocus
                        />
                        <div className="form-text text-center">
                          {form.cantidadReal && Number(form.cantidadReal) !== orden.cantidadEstimada
                            ? <span className="text-warning fw-semibold">
                                Dif: {Number(form.cantidadReal) - orden.cantidadEstimada > 0 ? "+" : ""}
                                {Number(form.cantidadReal) - orden.cantidadEstimada} pollos
                              </span>
                            : "pollos"
                          }
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">
                          Peso total (kg) <span className="text-danger">*</span>
                        </label>
                        <input
                          type="number" min="0.01" step="0.01"
                          className={`form-control form-control-lg text-center ${
                            form.pesoRealKg && Math.abs(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0.01
                              ? "border-warning"
                              : ""
                          }`}
                          placeholder={orden.pesoEstimadoKg}
                          value={form.pesoRealKg}
                          onChange={(e) => setForm({ ...form, pesoRealKg: e.target.value })}
                          required
                        />
                        <div className="form-text text-center">
                          {form.pesoRealKg && Math.abs(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0.01
                            ? <span className="text-warning fw-semibold">
                                Dif: {(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0 ? "+" : ""}
                                {(Number(form.pesoRealKg) - orden.pesoEstimadoKg).toFixed(1)} kg
                              </span>
                            : "kg"
                          }
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">
                          Fecha de entrega
                        </label>
                        <input
                          type="date" className="form-control"
                          value={form.fechaEntrega}
                          min={obtenerFechaHoy()}
                          max={obtenerFechaHoy()}
                          onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">
                          Observaciones <span className="text-muted fw-normal">(opcional)</span>
                        </label>
                        <textarea
                          className="form-control"
                          rows={2}
                          placeholder="Cualquier nota adicional..."
                          value={form.observacionesEntrega}
                          onChange={(e) => setForm({ ...form, observacionesEntrega: e.target.value })}
                        />
                      </div>
                    </div>
                  </form>
                </>
              )}

            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              {paso === 2 && (
                <button type="submit" form="form-recepcion" className="btn btn-success btn-lg px-4" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                  <i className="bi bi-check-circle me-1"></i>Confirmar entrega
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

const RecepcionOrdenCargaPage = () => {
  const rolUsuario = localStorage.getItem("rolUsuario");

  const [ordenes, setOrdenes]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [ordenModal, setOrdenModal]     = useState(null);

  const esAdmin = rolUsuario === "superadmin" || rolUsuario === "administracion";

  const abrirModal = (orden) => {
    setOrdenModal(orden);
  };

  const handleEnviar = async (orden) => {
    const ok = await Swal.fire({
      title: "¿Enviar pedido al frigorifico?",
      html: `<div style="text-align:left;font-size:14px">
        <div><strong>Orden:</strong> ${orden.numero}</div>
        <div style="margin-top:6px"><strong>Pollos:</strong> ${Number(orden.cantidadEstimada).toLocaleString("es-AR")} — ${orden.pesoEstimadoKg} kg est.</div>
        <div style="margin-top:6px;color:#6b7280">El frigorifico podrá recepcionar el pedido.</div>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Sí, enviar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await enviarOrdenCarga(orden._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Pedido enviado", text: "El frigorifico puede recepcionar el pedido.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleLiberar = async (orden) => {
    const ok = await Swal.fire({
      title: "¿Liberar orden sin código?",
      html: `La granja podrá confirmar la entrega <strong>sin pedir el código</strong> al cliente.<br><br>Usá esto solo cuando hayas verificado la identidad del cliente por otro medio.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f59e0b",
      confirmButtonText: "Sí, liberar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await liberarOrdenCarga(orden._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Orden liberada", text: "La granja puede confirmar la entrega sin código.", timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...(filtroEstado ? { estado: filtroEstado } : {}) };
      const data = await obtenerOrdenesCarga(params);
      setOrdenes(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  const ordenesFiltradas = ordenes.filter((o) => {
    if (!busqueda) return true;
    const txt = busqueda.toLowerCase();
    return (
      o.numero?.toLowerCase().includes(txt) ||
      o.codigoRetiro?.toLowerCase().includes(txt) ||
      (o.cliente?.razonSocial || o.cliente?.nombre || "").toLowerCase().includes(txt)
    );
  });

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-arrow-in-down me-2 text-success"></i>
            Recepción de Órdenes
          </h1>
          <div className="d-flex gap-2">
            {["pendiente", "entregada", ""].map((e) => (
              <button
                key={e}
                className={`btn btn-sm ${filtroEstado === e ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltroEstado(e)}
              >
                {e === ""
                  ? "Todas"
                  : e === "pendiente"
                  ? <><i className="bi bi-hourglass-split me-1"></i>Pendientes</>
                  : <><i className="bi bi-check-circle me-1"></i>Entregadas</>
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
                placeholder="Buscar por número de orden, código de retiro o cliente..."
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

        {/* Contenido */}
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            {busqueda ? "No se encontró ninguna orden." : "No hay órdenes en este estado."}
          </div>
        ) : filtroEstado === "pendiente" ? (

          /* ── TARJETAS — solo pendientes ── */
          <div className="row g-3">
            {ordenesFiltradas.map((o) => {
              const esPedidoFrigo = o.tipo === "pedido_frigorifico";
              const barColor = esPedidoFrigo ? "#2563eb" : o.liberada ? "#f59e0b" : "#198754";
              return (
                <div key={o._id} className="col-12 col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm h-100" style={{ borderLeft: `4px solid ${barColor}` }}>
                    <div className="card-body">

                      {/* Número + tipo + turno */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="badge bg-dark fs-6">{o.numero}</span>
                        <div className="d-flex gap-1 flex-wrap justify-content-end">
                          {esPedidoFrigo && (
                            <span className="badge bg-primary"><i className="bi bi-snow me-1"></i>Pedido Frigorifico</span>
                          )}
                          {o.turno && (
                            <span className={`badge ${o.turno === "mañana" ? "bg-warning text-dark" : "bg-info text-dark"}`}>
                              <i className={`bi ${o.turno === "mañana" ? "bi-sunrise" : "bi-sunset"} me-1`}></i>
                              {o.turno === "mañana" ? "Mañana" : "Tarde"}
                            </span>
                          )}
                          <span className="badge bg-secondary"><i className="bi bi-hourglass-split me-1"></i>Pendiente</span>
                        </div>
                      </div>

                      {/* Cliente (solo venta_gordos) */}
                      {o.cliente && !esPedidoFrigo && (
                        <div className="fw-semibold mb-1">{o.cliente.razonSocial || o.cliente.nombre}</div>
                      )}

                      {/* Granja, galpón y fecha */}
                      <div className="mb-2">
                        <span className="fw-bold" style={{ color: barColor }}>
                          {o.granja === "cañete" ? "Cañete" : "Los Pinos"}
                          {o.galpon && ` — Galpón ${o.galpon}`}
                        </span>
                        <div className="text-muted small">
                          <i className="bi bi-calendar me-1"></i>{formatearFechaLocal(o.fechaEmision)}
                        </div>
                      </div>

                      {/* Detalle de carga */}
                      {o.detalle?.length > 0 ? (
                        <div className="mb-2 rounded overflow-hidden" style={{ border: `1px solid ${esPedidoFrigo ? "#bfdbfe" : "#d1fae5"}` }}>
                          {o.detalle.map((l, idx) => (
                            <div key={idx} className="d-flex justify-content-between align-items-center px-2 py-1"
                              style={{ borderBottom: idx < o.detalle.length - 1 ? `1px solid ${esPedidoFrigo ? "#bfdbfe" : "#d1fae5"}` : "none", background: esPedidoFrigo ? "#eff6ff" : "#f0fdf4" }}>
                              <span className="fw-semibold" style={{ color: barColor }}>{Number(l.cantidad).toLocaleString("es-AR")} pollos</span>
                              <span className="text-muted small">
                                {l.pesoMax && Math.abs(l.pesoMax - l.pesoMin) > 0.05
                                  ? `${l.pesoMin} – ${l.pesoMax} kg`
                                  : `${l.pesoMin} kg`} prom.
                              </span>
                            </div>
                          ))}
                          <div className="d-flex justify-content-between align-items-center px-2 py-1 fw-bold"
                            style={{ background: esPedidoFrigo ? "#dbeafe" : "#dcfce7" }}>
                            <span style={{ color: barColor }}>{Number(o.cantidadEstimada).toLocaleString("es-AR")} pollos</span>
                            <span className="text-muted small">{o.pesoEstimadoKg} kg est.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="d-flex gap-4 mb-2 p-2 rounded" style={{ background: esPedidoFrigo ? "#eff6ff" : "#f0fdf4" }}>
                          <div>
                            <div className="fw-bold fs-5" style={{ color: barColor }}>{Number(o.cantidadEstimada).toLocaleString("es-AR")}</div>
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>pollos a preparar</div>
                          </div>
                          <div>
                            <div className="fw-bold fs-5" style={{ color: barColor }}>{o.pesoEstimadoKg} kg</div>
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>peso estimado</div>
                          </div>
                        </div>
                      )}

                      {/* Observaciones */}
                      {o.observaciones && (
                        <div className="mb-2 p-2 rounded" style={{ background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.85rem" }}>
                          <i className="bi bi-info-circle me-1 text-warning"></i>{o.observaciones}
                        </div>
                      )}

                    </div>

                    <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
                      {esPedidoFrigo ? (
                        <div className="d-grid">
                          <button className="btn btn-primary" onClick={() => handleEnviar(o)}>
                            <i className="bi bi-truck me-1"></i>Enviar al frigorifico
                          </button>
                        </div>
                      ) : (
                        <div className="d-grid gap-2">
                          {o.liberada && (
                            <div className="alert alert-warning py-1 px-2 mb-0 small text-center">
                              <i className="bi bi-unlock-fill me-1"></i>Liberada por administración — sin código
                            </div>
                          )}
                          <button className="btn btn-success" onClick={() => abrirModal(o)}>
                            <i className="bi bi-check2-circle me-1"></i>Confirmar entrega
                          </button>
                          {esAdmin && !o.liberada && (
                            <button className="btn btn-outline-warning btn-sm" onClick={() => handleLiberar(o)}>
                              <i className="bi bi-unlock me-1"></i>Liberar sin código
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* ── TABLA — entregadas / todas ── */
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>N° Orden</th>
                      <th>Cliente</th>
                      <th>Granja / Galpón</th>
                      <th>Fecha pedido</th>
                      <th className="text-end">Cant. pedida</th>
                      <th className="text-end">Cant. recibida</th>
                      <th className="text-end">Peso ped.</th>
                      <th className="text-end">Peso rec.</th>
                      <th>Fecha entrega</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesFiltradas.map((o) => {
                      const entregada = o.estado === "entregada";
                      const dcant = entregada && o.cantidadReal != null
                        ? (o.diferenciaCantidad ?? (o.cantidadReal - o.cantidadEstimada))
                        : null;
                      const dkg = entregada && o.pesoRealKg != null
                        ? (o.diferenciaKg ?? (o.pesoRealKg - o.pesoEstimadoKg))
                        : null;
                      return (
                        <tr key={o._id}>
                          <td><span className="badge bg-dark">{o.numero}</span></td>
                          <td className="fw-semibold">{o.cliente?.razonSocial || o.cliente?.nombre}</td>
                          <td className="text-muted small">
                            {(o.granja === "cañete" ? "C" : "P")}{o.galpon || ""}
                          </td>
                          <td className="text-muted small">{formatearFechaLocal(o.fechaEmision)}</td>
                          <td className="text-end">{o.cantidadEstimada?.toLocaleString("es-AR")}</td>
                          <td className={`text-end fw-semibold ${dcant !== null && dcant !== 0 ? "text-warning" : ""}`}>
                            {entregada && o.cantidadReal != null ? (
                              <>
                                {o.cantidadReal.toLocaleString("es-AR")}
                                <span className={`ms-1 small ${dcant === 0 ? "text-success" : "text-warning"}`}>
                                  ({dcant > 0 ? "+" : ""}{dcant})
                                </span>
                              </>
                            ) : "—"}
                          </td>
                          <td className="text-end">{o.pesoEstimadoKg} kg</td>
                          <td className={`text-end fw-semibold ${dkg !== null && Math.abs(dkg) > 0.01 ? "text-warning" : ""}`}>
                            {entregada && o.pesoRealKg != null ? (
                              <>
                                {o.pesoRealKg} kg
                                <span className={`ms-1 small ${Math.abs(dkg) <= 0.01 ? "text-success" : "text-warning"}`}>
                                  ({dkg > 0 ? "+" : ""}{dkg?.toFixed(1)})
                                </span>
                              </>
                            ) : "—"}
                          </td>
                          <td className="text-muted small">{entregada ? formatearFechaLocal(o.fechaEntrega) : "—"}</td>
                          <td>
                            {entregada
                              ? <span className="badge bg-success">Entregada</span>
                              : o.estado === "enviada"
                                ? <span className="badge bg-primary">En camino</span>
                                : o.liberada
                                  ? <span className="badge bg-warning text-dark">Liberada</span>
                                  : <span className="badge bg-warning text-dark">Pendiente</span>
                            }
                          </td>
                          <td>
                            {entregada && (
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                title="Reimprimir comprobante"
                                onClick={() => imprimirComprobanteEntrega(o, o)}
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        )}

      </div>

      {ordenModal && (
        <ConfirmarModal
          orden={ordenModal}
          esAdmin={esAdmin}
          onClose={() => setOrdenModal(null)}
          onConfirmada={() => { setOrdenModal(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default RecepcionOrdenCargaPage;
