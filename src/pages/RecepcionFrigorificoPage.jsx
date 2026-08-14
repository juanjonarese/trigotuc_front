import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import { escapeHtml } from "../utils/escapeHtml";
import {
  obtenerDespachosFrigorifico,
  completarDespachoFrigorifico,
  liberarDespachoFrigorifico,
  revertirDespachoFrigorifico,
  obtenerEnviosCamara,
  prepararEnvioCamara,
  eliminarEnvioCamara,
  obtenerCamiones,
  obtenerChoferes,
  obtenerResumenStock,
} from "../services/api";
import { imprimirOrdenEnvio } from "../utils/imprimirOrdenEnvio";
import EditarEnvioModal from "../components/EditarEnvioModal";
import Swal from "sweetalert2";

const TIPOS_TROZADO = [
  { tipo: "filet",   label: "Filet"      },
  { tipo: "pata",    label: "Pata muslo" },
  { tipo: "alita",   label: "Alita"      },
  { tipo: "menudo",  label: "Menudo"     },
  { tipo: "carcaza", label: "Carcaza"    },
];

const ITEMS_POR_PAGINA = 50;

const fmt       = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n ?? 0);
const fmtFecha  = (f) => f ? new Date(f).toLocaleDateString("es-AR") : "—";
const camaraLbl = (v) => v === "cañete" ? "Cañete" : v === "trigotuc" ? "Trigotuc" : v;
const tipoLbl   = (tipo) => TIPOS_TROZADO.find((x) => x.tipo === tipo)?.label || tipo;

// ── Imprimir remito de entrega ────────────────────────────────────────────────
const imprimirRemito = (despacho) => {
  const cliente  = escapeHtml(despacho.cliente?.razonSocial || "—");
  const camara   = camaraLbl(despacho.camara);
  const turno    = escapeHtml(despacho.turno || "—");
  const fecha    = new Date(despacho.fecha).toLocaleDateString("es-AR");
  const hoy      = new Date().toLocaleDateString("es-AR");
  const segundaFirmaLbl = despacho.modalidadEntrega === "delivery_chofer"
    ? "Firma del chofer — entregado conforme"
    : "Firma del encargado de frigorifico";

  const filasCalibres = (despacho.calibres || []).map((c) => `
    <tr>
      <td style="padding:3px 8px;border:1px solid #dee2e6">Cal. ${c.calibre}</td>
      <td style="padding:3px 8px;border:1px solid #dee2e6;text-align:right">${fmt(c.cajones)}</td>
      <td style="padding:3px 8px;border:1px solid #dee2e6;text-align:right">${fmt(c.cajones * 20)} kg</td>
    </tr>`).join("");

  const filasTrozados = (despacho.trozados || []).map((t) => `
    <tr>
      <td style="padding:3px 8px;border:1px solid #dee2e6">${tipoLbl(t.tipo)}</td>
      <td style="padding:3px 8px;border:1px solid #dee2e6;text-align:right">${fmt(t.cajas)} cajas</td>
      <td style="padding:3px 8px;border:1px solid #dee2e6;text-align:right">${fmt(t.kgTotal)} kg</td>
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
        ? `<div class="obs"><strong>Observaciones:</strong> ${escapeHtml(despacho.observaciones)}</div>`
        : ""}

      <div class="firma-grid">
        <div class="firma-box">
          <div class="firma-linea"></div>
          <div class="firma-lbl">Firma y aclaración del cliente</div>
        </div>
        <div class="firma-box">
          <div class="firma-linea"></div>
          <div class="firma-lbl">${segundaFirmaLbl}</div>
        </div>
      </div>
      <div class="no-factura">Documento no válido como factura</div>
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Orden ${despacho.numeroOrden}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 8px; color: #222; margin: 0; font-size: 11px; }
      .copia { max-width: 640px; margin: 0 auto; padding: 8px 20px; page-break-inside: avoid; }
      .separador { border: none; border-top: 1px dashed #aaa; margin: 6px auto; max-width: 640px; }
      .copia-label { float: right; font-size: 9px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #ccc; padding: 1px 6px; border-radius: 4px; margin-bottom: 2px; }
      .logo { font-size: 16px; font-weight: bold; margin-bottom: 1px; }
      .logo span { color: #f59e0b; }
      .subtitulo { font-size: 10px; color: #666; margin-bottom: 8px; }
      h2 { font-size: 11px; border-bottom: 2px solid #222; padding-bottom: 3px; margin: 8px 0 6px; text-transform: uppercase; letter-spacing: .5px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; margin-bottom: 8px; }
      .fila { display: flex; flex-direction: column; }
      .lbl { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
      .val { font-size: 11px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
      th { background: #f3f4f6; text-align: left; padding: 3px 8px; font-size: 8px; text-transform: uppercase; letter-spacing: .5px; color: #555; border: 1px solid #dee2e6; }
      .obs { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 4px 8px; font-size: 9px; color: #78350f; margin: 6px 0; }
      .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 42px; }
      .firma-box { text-align: center; }
      .firma-linea { border-top: 1.5px solid #222; margin-bottom: 4px; }
      .firma-lbl { font-size: 9px; color: #555; }
      .no-factura { text-align: center; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; border-top: 1px dashed #d1d5db; margin-top: 10px; padding-top: 5px; }
      @page { size: A4; margin: 8mm; }
      @media print { body { padding: 0; } }
    </style></head><body>
    ${bloque("Original — Cliente")}
    <hr class="separador"/>
    ${bloque("Duplicado — Frigorifico")}
    <hr class="separador"/>
    ${bloque("Triplicado — Archivo")}
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const win = window.open("", "_blank", "width=720,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
};

// ── Modal confirmar entrega ───────────────────────────────────────────────────
const ConfirmarModal = ({ despacho, onClose, onConfirmado, esAdmin }) => {
  const yaLiberada = !!despacho.liberada;
  const esDelivery = despacho.modalidadEntrega === "delivery_chofer";
  const [paso, setPaso]         = useState((yaLiberada || esDelivery) ? 2 : 1);
  const [codigo, setCodigo]     = useState("");
  const [codigoError, setCodigoError] = useState("");
  const [liberadaSinCodigo, setLiberadaSinCodigo] = useState(yaLiberada);
  const [saving, setSaving]     = useState(false);

  const verificarCodigo = (e) => {
    e.preventDefault();
    if (codigo.trim().toUpperCase() === despacho.codigoRetiro) {
      setCodigoError("");
      setPaso(2);
    } else {
      setCodigoError("Código incorrecto. Verificá con el cliente.");
    }
  };

  const liberarSinCodigo = async () => {
    try {
      await liberarDespachoFrigorifico(despacho._id);
      setLiberadaSinCodigo(true);
      setPaso(2);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleConfirmar = async () => {
    setSaving(true);
    try {
      await completarDespachoFrigorifico(despacho._id, {
        ...(codigo && !liberadaSinCodigo ? { codigoRetiro: codigo.trim().toUpperCase() } : {}),
      });
      imprimirRemito(despacho);
      onConfirmado();
      Swal.fire({
        icon: "success",
        title: esDelivery ? "Carga confirmada" : "Entrega confirmada",
        text: esDelivery
          ? `Orden ${despacho.numeroOrden} lista — el chofer fue notificado.`
          : `Orden ${despacho.numeroOrden} cerrada.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo confirmar.", "error");
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
                  <i className="bi bi-check2-circle me-2"></i>
                  {esDelivery ? "Confirmar carga del camión" : "Confirmar entrega"}
                </h5>
                <div className="small opacity-75 mt-1">
                  {despacho.numeroOrden} — {despacho.cliente?.razonSocial || "—"}
                </div>
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

              {/* PASO 2 — resumen + confirmar */}
              {paso === 2 && (
                <>
                  {liberadaSinCodigo ? (
                    <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-unlock-fill"></i>
                      <span>Liberada sin código por administración</span>
                    </div>
                  ) : esDelivery ? (
                    <div className="alert alert-primary py-2 mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-truck"></i>
                      <span>
                        Entrega por camión de Trigotuc
                        {despacho.chofer?.nombreUsuario ? ` — Chofer: ${despacho.chofer.nombreUsuario}` : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="alert alert-success py-2 mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Código verificado correctamente</span>
                    </div>
                  )}

                  {/* Calibres */}
                  {despacho.calibres?.length > 0 && (
                    <div className="mb-3">
                      <div className="small text-muted fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.05em" }}>Pollos faenados</div>
                      <table className="table table-sm table-bordered align-middle mb-0">
                        <thead className="table-light">
                          <tr><th>Calibre</th><th className="text-end">Cajones</th><th className="text-end">Kg</th></tr>
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
                      <div className="small text-muted fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.05em" }}>Trozados</div>
                      <table className="table table-sm table-bordered align-middle mb-0">
                        <thead className="table-light">
                          <tr><th>Tipo</th><th className="text-end">Cajas</th><th className="text-end">Kg</th></tr>
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
                    <div className="p-2 rounded small mb-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                      <i className="bi bi-info-circle me-1 text-warning"></i>{despacho.observaciones}
                    </div>
                  )}

                  <div className="alert alert-info py-2 mb-0 small">
                    <i className="bi bi-printer me-1"></i>
                    {esDelivery
                      ? "Al confirmar se imprimirá el remito para entregar al chofer."
                      : "Al confirmar se imprimirá el remito para que firme el cliente."}
                  </div>
                </>
              )}

            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              {paso === 2 && (
                <button className="btn btn-success btn-lg px-4" onClick={handleConfirmar} disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                  <i className="bi bi-check-circle me-1"></i>
                  {esDelivery ? "Confirmar carga" : "Confirmar entrega"}
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

// ── Página principal ─────────────────────────────────────────────────────────
const RecepcionFrigorificoPage = () => {
  const rolUsuario     = localStorage.getItem("rolUsuario");
  const puedeLiberar   = ["superadmin", "administracion_frigorifico"].includes(rolUsuario);
  const puedeConfirmar = ["superadmin", "frigorifico"].includes(rolUsuario);
  // Baja de envíos cargados por error (ej. el mismo envío mandado dos veces).
  // Solo mientras siga pendiente de recepción en destino — el backend valida igual.
  const puedeEliminarEnvios = ["superadmin", "frigorifico", "administracion_frigorifico"].includes(rolUsuario);
  // Corregir un envío cargado mal. Mismo alcance que eliminarlo — editar es menos
  // destructivo — y con el mismo corte: solo mientras siga pendiente de recepción,
  // salvo superadmin. El backend valida igual.
  const puedeEditarEnvio = (e) =>
    rolUsuario === "superadmin" ||
    (puedeEliminarEnvios && e.estado === "pendiente");

  const [despachos, setDespachos]     = useState([]);
  const [envios, setEnvios]           = useState([]);
  const [camiones, setCamiones]       = useState([]);
  const [choferes, setChoferes]       = useState([]);
  const [resumen, setResumen]         = useState(null);
  const [envioEditando, setEnvioEditando] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [busqueda, setBusqueda]       = useState("");
  const [despachoModal, setDespachoModal] = useState(null);
  const [preparando, setPreparando]   = useState(null);
  const [tab, setTab]                 = useState("clientes");
  const [paginaDespachos, setPaginaDespachos] = useState(1);
  const [paginaEnvios, setPaginaEnvios]       = useState(1);

  useEffect(() => {
    setPaginaDespachos(1);
    setPaginaEnvios(1);
  }, [filtroEstado, busqueda]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [dataDespachos, dataEnvios] = await Promise.all([
        obtenerDespachosFrigorifico(),
        obtenerEnviosCamara(),
      ]);
      setDespachos(dataDespachos);
      setEnvios(dataEnvios);

      // Datos auxiliares del modal de edición de envíos. Van aparte y tolerando
      // el fallo a propósito: son secundarios, y si alguno diera 403 para el rol
      // que esté mirando, la pantalla entera se quedaría sin despachos ni envíos.
      const [resCamiones, resChoferes, resResumen] = await Promise.allSettled([
        obtenerCamiones(),
        obtenerChoferes(),
        obtenerResumenStock(),
      ]);
      if (resCamiones.status === "fulfilled") setCamiones(resCamiones.value.camiones || []);
      if (resChoferes.status === "fulfilled") setChoferes(resChoferes.value.choferes || []);
      if (resResumen.status  === "fulfilled") setResumen(resResumen.value);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleLiberar = async (d) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Liberar orden sin código?",
      html: `La orden <strong>${d.numeroOrden}</strong> podrá ser confirmada sin pedir el código al cliente.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f59e0b",
      confirmButtonText: "Sí, liberar",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await liberarDespachoFrigorifico(d._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Orden liberada", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleRevertir = async (d) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Revertir recepción?",
      html: `La orden <strong>${d.numeroOrden}</strong> volverá a estado <strong>pendiente</strong> y reaparecerá en Órdenes de Carga.<br><br>Se devolverá a la cámara el stock descontado. Usá esto solo para corregir una recepción confirmada por error.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, revertir",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await revertirDespachoFrigorifico(d._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Recepción revertida", text: `La orden ${d.numeroOrden} volvió a pendiente.`, timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handlePrepararEnvio = async (e) => {
    setPreparando(e._id);
    try {
      const actualizado = await prepararEnvioCamara(e._id);
      imprimirOrdenEnvio(actualizado);
      await cargar();
      Swal.fire({ icon: "success", title: "Envío preparado", text: `${e.numeroEnvio} listo para el chofer.`, timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo preparar el envío.", "error");
    } finally {
      setPreparando(null);
    }
  };

  const handleEliminarEnvio = async (e) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Eliminar envío?",
      html:
        `Se va a eliminar el envío <strong>${e.numeroEnvio}</strong> y el stock volverá a <strong>${camaraLbl(e.camaraOrigen)}</strong>.` +
        `<br><br>Usalo solo para dar de baja un envío cargado por error (por ejemplo, el mismo envío mandado dos veces).` +
        (e.preparado
          ? `<br><br>⚠️ Este envío ya figura <strong>preparado</strong>. Si la mercadería salió en el camión, no lo elimines: el stock volvería a ${camaraLbl(e.camaraOrigen)} sin estar ahí.`
          : ""),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await eliminarEnvioCamara(e._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Envío eliminado", text: `${e.numeroEnvio} se dio de baja y el stock volvió a ${camaraLbl(e.camaraOrigen)}.`, timer: 2200, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar el envío.", "error");
    }
  };

  const despachosVisibles = despachos
    .filter((d) => filtroEstado === "" || d.estado === filtroEstado)
    .filter((d) => {
      if (!busqueda) return true;
      const txt = busqueda.toLowerCase();
      return (
        d.numeroOrden?.toLowerCase().includes(txt) ||
        (d.cliente?.razonSocial || "").toLowerCase().includes(txt)
      );
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // más recientes arriba

  // Envíos entre cámaras a preparar por frigorifico (solo Cañete→Trigotuc).
  // A preparar = pendiente sin preparar; completada = ya preparado.
  const enviosVisibles = envios
    .filter((e) => e.camaraOrigen === "cañete" && e.camaraDestino === "trigotuc")
    .filter((e) => {
      if (filtroEstado === "pendiente") return e.estado === "pendiente" && !e.preparado;
      if (filtroEstado === "completada") return e.preparado;
      return e.estado === "pendiente" || e.preparado; // "todas"
    })
    .filter((e) => !busqueda || e.numeroEnvio?.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // más recientes arriba

  const despachosPagina = despachosVisibles.slice(
    (paginaDespachos - 1) * ITEMS_POR_PAGINA,
    paginaDespachos * ITEMS_POR_PAGINA
  );
  const enviosPagina = enviosVisibles.slice(
    (paginaEnvios - 1) * ITEMS_POR_PAGINA,
    paginaEnvios * ITEMS_POR_PAGINA
  );

  // Contadores para las solapas (independientes del filtro de estado)
  const despachosPendientesCount = despachos.filter((d) => d.estado === "pendiente").length;
  const enviosAPrepararCount = envios.filter(
    (e) => e.camaraOrigen === "cañete" && e.camaraDestino === "trigotuc" && e.estado === "pendiente" && !e.preparado
  ).length;

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

        {/* Solapas */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "clientes" ? "active" : ""}`}
              onClick={() => setTab("clientes")}
            >
              <i className="bi bi-people me-1"></i>Clientes
              {despachosPendientesCount > 0 && (
                <span className="badge bg-primary ms-2" style={{ fontSize: "0.65rem" }}>
                  {despachosPendientesCount}
                </span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "camaras" ? "active" : ""}`}
              onClick={() => setTab("camaras")}
            >
              <i className="bi bi-truck me-1"></i>Envíos entre cámaras
              {enviosAPrepararCount > 0 && (
                <span className="badge bg-primary ms-2" style={{ fontSize: "0.65rem" }}>
                  {enviosAPrepararCount}
                </span>
              )}
            </button>
          </li>
        </ul>

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
                placeholder={tab === "clientes" ? "Buscar por número de orden o cliente..." : "Buscar por número de envío..."}
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
        ) : (
          <>

          {/* ── SOLAPA: Envíos entre cámaras (Cañete→Trigotuc) — frigorifico prepara e imprime ── */}
          {tab === "camaras" && (enviosVisibles.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              {busqueda ? "No se encontró ningún envío." : "No hay envíos en este estado."}
            </div>
          ) : (
            <div className="mb-4">
              {/* TARJETAS — mobile / tablet */}
              <div className="row g-3 d-lg-none">
                {enviosPagina.map((e) => (
                  <div key={e._id} className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm h-100" style={{ borderLeft: "4px solid #6f42c1" }}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <span className="badge bg-dark fs-6">{e.numeroEnvio}</span>
                          <div className="d-flex gap-1 flex-wrap justify-content-end align-items-center">
                            <span className="badge bg-secondary">{camaraLbl(e.camaraOrigen)}</span>
                            <i className="bi bi-arrow-right text-muted"></i>
                            <span className="badge bg-secondary">{camaraLbl(e.camaraDestino)}</span>
                            {e.estado === "recibido"
                              ? <span className="badge bg-success"><i className="bi bi-check2-all me-1"></i>Recibido en Trigotuc</span>
                              : e.preparado
                              ? <span className="badge bg-primary"><i className="bi bi-truck me-1"></i>Preparado — en viaje</span>
                              : <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>A preparar</span>}
                          </div>
                        </div>
                        <div className="text-muted small mb-2">
                          <i className="bi bi-calendar me-1"></i>{fmtFecha(e.fecha)}
                          {e.chofer?.nombreUsuario && <> · <i className="bi bi-person me-1"></i>{e.chofer.nombreUsuario}</>}
                          {e.camion && <> · <i className="bi bi-truck me-1"></i>{e.camion.marca} {e.camion.patente}</>}
                        </div>
                        {(e.calibres?.length > 0 || e.trozados?.length > 0) && (
                          <div className="d-flex flex-wrap gap-1 mb-2">
                            {e.calibres?.map((c, i) => (
                              <span key={i} className="badge bg-info text-dark">Cal.{c.calibre}: {fmt(c.cajones)} caj</span>
                            ))}
                            {e.trozados?.map((t, i) => (
                              <span key={`t${i}`} className="badge bg-warning text-dark">{tipoLbl(t.tipo)}: {fmt(t.cajas)} caj</span>
                            ))}
                          </div>
                        )}
                        {e.observaciones && (
                          <div className="p-2 rounded small" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                            <i className="bi bi-info-circle me-1 text-warning"></i>{e.observaciones}
                          </div>
                        )}
                      </div>
                      <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3">
                        {!e.preparado && puedeConfirmar ? (
                          <button className="btn btn-primary w-100" disabled={preparando === e._id} onClick={() => handlePrepararEnvio(e)}>
                            {preparando === e._id
                              ? <span className="spinner-border spinner-border-sm me-1"></span>
                              : <i className="bi bi-printer me-1"></i>}
                            Imprimir y preparar
                          </button>
                        ) : !e.preparado ? (
                          <div className="alert alert-light border py-2 mb-0 small text-center text-muted">
                            <i className="bi bi-hourglass-split me-1"></i>Esperando preparación de frigorífico
                          </div>
                        ) : (
                          <button className="btn btn-outline-secondary w-100" onClick={() => imprimirOrdenEnvio(e)}>
                            <i className="bi bi-printer me-1"></i>Reimprimir orden
                          </button>
                        )}
                        {puedeEditarEnvio(e) && (
                          <button className="btn btn-outline-warning w-100 mt-2" onClick={() => setEnvioEditando(e)}>
                            <i className="bi bi-pencil me-1"></i>Editar envío
                          </button>
                        )}
                        {puedeEliminarEnvios && e.estado === "pendiente" && (
                          <button className="btn btn-outline-danger w-100 mt-2" onClick={() => handleEliminarEnvio(e)}>
                            <i className="bi bi-trash me-1"></i>Eliminar envío
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* TABLA — desktop */}
              <div className="card border-0 shadow-sm d-none d-lg-block">
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>N° Envío</th>
                          <th>Fecha</th>
                          <th>Ruta</th>
                          <th>Chofer / Camión</th>
                          <th>Detalle</th>
                          <th>Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {enviosPagina.map((e) => (
                          <tr key={e._id}>
                            <td><span className="badge bg-dark">{e.numeroEnvio}</span></td>
                            <td className="small">{fmtFecha(e.fecha)}</td>
                            <td className="small">
                              <span className="badge bg-secondary">{camaraLbl(e.camaraOrigen)}</span>
                              <i className="bi bi-arrow-right text-muted mx-1"></i>
                              <span className="badge bg-secondary">{camaraLbl(e.camaraDestino)}</span>
                            </td>
                            <td className="small text-muted">
                              {e.chofer?.nombreUsuario || "—"}
                              {e.camion && <> · {e.camion.marca} {e.camion.patente}</>}
                            </td>
                            <td>
                              <div className="d-flex flex-wrap gap-1">
                                {e.calibres?.map((c, i) => (
                                  <span key={i} className="badge bg-info text-dark">Cal.{c.calibre}: {fmt(c.cajones)} caj</span>
                                ))}
                                {e.trozados?.map((t, i) => (
                                  <span key={`t${i}`} className="badge bg-warning text-dark">{tipoLbl(t.tipo)}: {fmt(t.cajas)} caj</span>
                                ))}
                                {e.observaciones && (
                                  <span className="badge bg-light text-dark border" title={e.observaciones}>
                                    <i className="bi bi-info-circle text-warning"></i>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {e.estado === "recibido"
                                ? <span className="badge bg-success"><i className="bi bi-check2-all me-1"></i>Recibido en Trigotuc</span>
                                : e.preparado
                                ? <span className="badge bg-primary"><i className="bi bi-truck me-1"></i>Preparado — en viaje</span>
                                : <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>A preparar</span>}
                            </td>
                            <td>
                              <div className="d-flex gap-1 align-items-center">
                                {!e.preparado && puedeConfirmar ? (
                                  <button className="btn btn-primary btn-sm" disabled={preparando === e._id} onClick={() => handlePrepararEnvio(e)}>
                                    {preparando === e._id
                                      ? <span className="spinner-border spinner-border-sm me-1"></span>
                                      : <i className="bi bi-printer me-1"></i>}
                                    Imprimir y preparar
                                  </button>
                                ) : !e.preparado ? (
                                  <span className="small text-muted"><i className="bi bi-hourglass-split me-1"></i>Esperando frigorífico</span>
                                ) : (
                                  <button className="btn btn-outline-secondary btn-sm" onClick={() => imprimirOrdenEnvio(e)}>
                                    <i className="bi bi-printer me-1"></i>Reimprimir
                                  </button>
                                )}
                                {puedeEditarEnvio(e) && (
                                  <button className="btn btn-outline-warning btn-sm" onClick={() => setEnvioEditando(e)} title="Editar envío">
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                )}
                                {puedeEliminarEnvios && e.estado === "pendiente" && (
                                  <button className="btn btn-outline-danger btn-sm" onClick={() => handleEliminarEnvio(e)} title="Eliminar envío">
                                    <i className="bi bi-trash"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <Pagination
                currentPage={paginaEnvios}
                totalItems={enviosVisibles.length}
                itemsPerPage={ITEMS_POR_PAGINA}
                onPageChange={setPaginaEnvios}
              />
            </div>
          ))}

          {/* ── SOLAPA: Órdenes a clientes ── */}
          {tab === "clientes" && (despachosVisibles.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            {busqueda ? "No se encontró ninguna orden." : "No hay órdenes en este estado."}
          </div>
        ) : (
          <>

          {/* ── TARJETAS — mobile / tablet ── */}
          <div className="row g-3 d-lg-none">
            {despachosPagina.map((d) => (
              <div key={d._id} className="col-12 col-md-6">
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
                        {d.modalidadEntrega === "delivery_chofer" ? (
                          <span className="badge bg-info text-dark">
                            <i className="bi bi-truck me-1"></i>
                            Camión{d.chofer?.nombreUsuario ? `: ${d.chofer.nombreUsuario}` : ""}
                          </span>
                        ) : (
                          <span className="badge bg-light text-dark border">
                            <i className="bi bi-person-walking me-1"></i>Retiro cliente
                          </span>
                        )}
                        {d.turno && (
                          <span className={`badge ${d.turno === "mañana" ? "bg-warning text-dark" : "bg-info text-dark"}`}>
                            <i className={`bi bi-${d.turno === "mañana" ? "sunrise" : "sunset"} me-1`}></i>
                            {d.turno === "mañana" ? "Mañana" : "Tarde"}
                          </span>
                        )}
                        {d.estado === "completada" ? (
                          <span className="badge bg-success">
                            <i className="bi bi-check-circle me-1"></i>Completada
                          </span>
                        ) : (
                          <span className="badge bg-warning text-dark">
                            <i className="bi bi-hourglass-split me-1"></i>Pendiente
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cliente + fecha */}
                    <div className="fw-semibold mb-1">
                      <i className="bi bi-person me-1 text-muted"></i>
                      {d.cliente?.razonSocial || "—"}
                    </div>
                    <div className="text-muted small mb-2">
                      <i className="bi bi-calendar me-1"></i>{fmtFecha(d.fecha)}
                      {d.estado === "completada" && d.completadoPor?.nombreUsuario && (
                        <> · <i className="bi bi-person-check me-1"></i>{d.completadoPor.nombreUsuario}</>
                      )}
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
                    {d.estado === "completada" ? (
                      <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary btn-sm flex-grow-1" onClick={() => imprimirRemito(d)}>
                          <i className="bi bi-printer me-1"></i>Reimprimir remito
                        </button>
                        {puedeConfirmar && (
                          <button
                            className="btn btn-outline-danger btn-sm"
                            title="Revertir recepción (vuelve a pendiente)"
                            onClick={() => handleRevertir(d)}
                          >
                            <i className="bi bi-arrow-counterclockwise"></i>
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {d.liberada && (
                          <div className="alert alert-warning py-1 px-2 mb-2 small text-center">
                            <i className="bi bi-unlock-fill me-1"></i>Liberada por administración — sin código
                          </div>
                        )}
                        {puedeConfirmar ? (
                          <button className="btn btn-success w-100 mb-2" onClick={() => setDespachoModal(d)}>
                            <i className={`bi ${d.modalidadEntrega === "delivery_chofer" ? "bi-truck" : "bi-check2-circle"} me-1`}></i>
                            {d.modalidadEntrega === "delivery_chofer" ? "Confirmar carga" : "Confirmar entrega"}
                          </button>
                        ) : (
                          <div className="alert alert-light border py-2 mb-2 small text-center text-muted">
                            <i className="bi bi-hourglass-split me-1"></i>Esperando confirmación de frigorífico
                          </div>
                        )}
                        {puedeLiberar && !d.liberada && d.modalidadEntrega !== "delivery_chofer" && (
                          <button className="btn btn-outline-warning btn-sm w-100" onClick={() => handleLiberar(d)}>
                            <i className="bi bi-unlock me-1"></i>Liberar sin código
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── TABLA — desktop ── */}
          <div className="card border-0 shadow-sm d-none d-lg-block">
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
                      <th>Entrega</th>
                      <th>Detalle</th>
                      <th>Estado</th>
                      <th>Completada por</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {despachosPagina.map((d) => (
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
                          {d.modalidadEntrega === "delivery_chofer" ? (
                            <span className="badge bg-info text-dark">
                              <i className="bi bi-truck me-1"></i>{d.chofer?.nombreUsuario || "Camión"}
                            </span>
                          ) : (
                            <span className="badge bg-light text-dark border">
                              <i className="bi bi-person-walking me-1"></i>Retiro
                            </span>
                          )}
                        </td>
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
                            {d.observaciones && (
                              <span className="badge bg-light text-dark border" title={d.observaciones}>
                                <i className="bi bi-info-circle text-warning"></i>
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {d.estado === "completada"
                            ? <span className="badge bg-success">Completada</span>
                            : <span className="badge bg-warning text-dark">Pendiente</span>
                          }
                          {d.estado !== "completada" && d.liberada && (
                            <span className="badge bg-warning text-dark ms-1" title="Liberada por administración — sin código">
                              <i className="bi bi-unlock-fill"></i>
                            </span>
                          )}
                        </td>
                        <td className="small text-muted">{d.completadoPor?.nombreUsuario || "—"}</td>
                        <td>
                          {d.estado === "completada" ? (
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                title="Reimprimir remito"
                                onClick={() => imprimirRemito(d)}
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                              {puedeConfirmar && (
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  title="Revertir recepción (vuelve a pendiente)"
                                  onClick={() => handleRevertir(d)}
                                >
                                  <i className="bi bi-arrow-counterclockwise"></i>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="d-flex gap-1 flex-wrap">
                              {puedeConfirmar ? (
                                <button className="btn btn-success btn-sm" onClick={() => setDespachoModal(d)}>
                                  <i className={`bi ${d.modalidadEntrega === "delivery_chofer" ? "bi-truck" : "bi-check2-circle"} me-1`}></i>
                                  {d.modalidadEntrega === "delivery_chofer" ? "Confirmar carga" : "Confirmar entrega"}
                                </button>
                              ) : (
                                <span className="small text-muted"><i className="bi bi-hourglass-split me-1"></i>Esperando frigorífico</span>
                              )}
                              {puedeLiberar && !d.liberada && d.modalidadEntrega !== "delivery_chofer" && (
                                <button className="btn btn-outline-warning btn-sm" title="Liberar sin código" onClick={() => handleLiberar(d)}>
                                  <i className="bi bi-unlock"></i>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <Pagination
            currentPage={paginaDespachos}
            totalItems={despachosVisibles.length}
            itemsPerPage={ITEMS_POR_PAGINA}
            onPageChange={setPaginaDespachos}
          />

          </>
        ))}
          </>
        )}

      </div>

      {despachoModal && (
        <ConfirmarModal
          despacho={despachoModal}
          esAdmin={puedeLiberar}
          onClose={() => setDespachoModal(null)}
          onConfirmado={() => { setDespachoModal(null); cargar(); }}
        />
      )}

      {envioEditando && (
        <EditarEnvioModal
          key={envioEditando._id}
          envio={envioEditando}
          camiones={camiones}
          choferes={choferes}
          resumen={resumen}
          onCerrar={() => setEnvioEditando(null)}
          onGuardado={cargar}
        />
      )}
    </Layout>
  );
};

export default RecepcionFrigorificoPage;
