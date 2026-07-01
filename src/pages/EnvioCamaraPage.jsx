import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { trozadoLabel } from "../components/TrozadoTable";
import { crearEnvioCamara, obtenerEnviosCamara, /* obtenerCamiones, */ obtenerChoferes, eliminarEnvioCamara, obtenerResumenStock } from "../services/api";
import { ajustarFechaParaGuardar } from "../utils/dateUtils";
import { escapeHtml } from "../utils/escapeHtml";
import Swal from "sweetalert2";

const CAMARAS = [
  { value: "cañete", label: "Cañete" },
  { value: "trigotuc", label: "Trigotuc" },
];

const FORM_INICIAL = {
  fecha: new Date().toISOString().split("T")[0],
  camion: "",
  chofer: "",
  camaraOrigen: "",
  camaraDestino: "",
  observaciones: "",
};

const camaraNombre = (v) => CAMARAS.find((c) => c.value === v)?.label || v;
const fmtNumOrden  = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(n || 0));

// Orden imprimible que el chofer lleva y presenta en la cámara destino.
const imprimirOrdenEnvio = (e) => {
  const origen  = escapeHtml(camaraNombre(e.camaraOrigen));
  const destino = escapeHtml(camaraNombre(e.camaraDestino));
  const chofer  = e.chofer?.nombreUsuario ? escapeHtml(e.chofer.nombreUsuario) : "—";
  const camion  = e.camion ? escapeHtml(`${e.camion.marca || ""} ${e.camion.patente ? "— " + e.camion.patente : ""}`.trim()) : "—";
  const fecha   = new Date(e.fecha).toLocaleDateString("es-AR");

  const filasCalibres = (e.calibres || []).map((c) => `
    <tr>
      <td>Calibre ${escapeHtml(String(c.calibre))}</td>
      <td class="num">${fmtNumOrden(c.cajones)}</td>
      <td class="num">${fmtNumOrden(c.pollos)}</td>
      <td class="num">${fmtNumOrden(Number(c.cajones) * 20)}</td>
    </tr>`).join("");

  const filasTrozados = (e.trozados || []).map((t) => `
    <tr>
      <td>${escapeHtml(trozadoLabel(t.tipo))} <span class="clase">Clase ${escapeHtml(t.clase || "A")}</span></td>
      <td class="num">${fmtNumOrden(t.cajas)}</td>
      <td class="num">—</td>
      <td class="num">${fmtNumOrden(t.kgTotal != null ? t.kgTotal : Number(t.cajas) * Number(t.kgCaja))}</td>
    </tr>`).join("");

  const seccionCalibres = filasCalibres
    ? `<h2>Calibres (pollo entero)</h2>
       <table class="detalle">
         <thead><tr><th>Detalle</th><th class="num">Cajones</th><th class="num">Pollos</th><th class="num">Kg</th></tr></thead>
         <tbody>${filasCalibres}</tbody>
       </table>` : "";

  const seccionTrozados = filasTrozados
    ? `<h2>Trozados</h2>
       <table class="detalle">
         <thead><tr><th>Detalle</th><th class="num">Cajas</th><th class="num">Pollos</th><th class="num">Kg</th></tr></thead>
         <tbody>${filasTrozados}</tbody>
       </table>` : "";

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Orden de Envío ${escapeHtml(e.numeroEnvio)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #222; max-width: 640px; margin: 0 auto; }
      .logo { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
      .logo span { color: #f59e0b; }
      .subtitulo { font-size: 13px; color: #666; margin-bottom: 20px; }
      .ruta { text-align: center; font-size: 20px; font-weight: bold; margin: 18px 0; padding: 12px; border: 2px solid #222; border-radius: 8px; }
      .ruta .flecha { color: #f59e0b; margin: 0 10px; }
      h2 { font-size: 15px; border-bottom: 2px solid #222; padding-bottom: 6px; margin: 20px 0 10px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 12px; }
      .fila { display: flex; flex-direction: column; }
      .lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
      .val { font-size: 14px; font-weight: 600; }
      table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 13px; }
      table.detalle th, table.detalle td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      table.detalle th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
      table.detalle .num { text-align: right; }
      .cap { text-transform: capitalize; }
      .clase { font-size: 10px; color: #888; }
      .totales { display: flex; justify-content: flex-end; gap: 24px; margin: 12px 0 20px; font-size: 13px; }
      .totales b { font-size: 16px; }
      .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
      .firma { text-align: center; }
      .firma .linea { border-top: 1px solid #222; margin-bottom: 6px; }
      .firma .rol { font-size: 12px; color: #555; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <div class="logo">Trigotuc <span>Avícola</span></div>
    <div class="subtitulo">Orden de Envío entre Cámaras — N° ${escapeHtml(e.numeroEnvio)}</div>
    <div class="ruta">${origen}<span class="flecha">&rarr;</span>${destino}</div>
    <div class="grid">
      <div class="fila"><span class="lbl">N° Envío</span><span class="val">${escapeHtml(e.numeroEnvio)}</span></div>
      <div class="fila"><span class="lbl">Fecha</span><span class="val">${fecha}</span></div>
      <div class="fila"><span class="lbl">Chofer</span><span class="val">${chofer}</span></div>
      <div class="fila"><span class="lbl">Camión</span><span class="val">${camion}</span></div>
    </div>
    ${seccionCalibres}
    ${seccionTrozados}
    <div class="totales">
      <span>Total cajones: <b>${fmtNumOrden(e.totalCajones)}</b></span>
      <span>Total pollos: <b>${fmtNumOrden(e.totalPollos)}</b></span>
      <span>Total kg: <b>${fmtNumOrden(Number(e.pesoTotalKg || 0) + Number(e.totalKgTrozados || 0))}</b></span>
    </div>
    ${e.observaciones ? `<p style="font-size:13px;color:#555"><strong>Obs:</strong> ${escapeHtml(e.observaciones)}</p>` : ""}
    <div class="firmas">
      <div class="firma"><div class="linea">&nbsp;</div><div class="rol">Entregó — Cámara ${origen}</div></div>
      <div class="firma"><div class="linea">&nbsp;</div><div class="rol">Recibió — Cámara ${destino}</div></div>
    </div>
    <script>window.onload=()=>{window.print();}</script>
  </body></html>`;
  const win = window.open("", "_blank", "width=760,height=800");
  win.document.write(html);
  win.document.close();
};

const EnvioCamaraPage = () => {
  const navigate = useNavigate();
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const esSuperAdmin = rolUsuario === "superadmin";

  // const [camiones, setCamiones]     = useState([]); // deshabilitado por ahora (no se usa)
  const [choferes, setChoferes]     = useState([]);
  const [envios, setEnvios]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resumen, setResumen]       = useState(null);

  const [form, setForm]             = useState(FORM_INICIAL);
  const [lineas, setLineas]         = useState([]);
  const [trozadosLineas, setTrozadosLineas] = useState([]);

  const cargarDatos = async () => {
    try {
      const [choferesData, enviosData, resumenData] = await Promise.all([
        // obtenerCamiones(), // deshabilitado por ahora (no se usa)
        obtenerChoferes(),
        obtenerEnviosCamara(),
        obtenerResumenStock(),
      ]);
      // setCamiones(camionesData.camiones || []);
      setChoferes(choferesData.choferes || []);
      setEnvios(enviosData);
      setResumen(resumenData);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const handleEliminar = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar envío?",
      text: "Se revertirá el stock en las cámaras.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarEnvioCamara(id);
      Swal.fire("Eliminado", "El envío fue eliminado y el stock revertido.", "success");
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar el envío.", "error");
    }
  };

  const lineasCalculadas = lineas.map((l) => ({
    ...l,
    cajones: calcularCajones(l.pollos, l.calibre),
  }));

  const stockCalibresOrigen = form.camaraOrigen === "cañete"
    ? (resumen?.stockCañete   || [])
    : form.camaraOrigen === "trigotuc"
    ? (resumen?.stockTrigotuc || [])
    : null;

  const formatNum   = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
  const formatFecha = (f) => new Date(f).toLocaleDateString("es-AR");
  const camaraLabel = (v) => CAMARAS.find((c) => c.value === v)?.label || v;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "camaraOrigen") {
      setLineas([]);
      setTrozadosLineas([]);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.camaraOrigen || !form.camaraDestino) {
      Swal.fire("Error", "Seleccioná la cámara de origen y destino.", "error");
      return;
    }
    if (form.camaraOrigen === form.camaraDestino) {
      Swal.fire("Error", "La cámara de origen y destino no pueden ser la misma.", "error");
      return;
    }
    const lineasValidas    = lineasCalculadas.filter((l) => l.cajones > 0);
    const trozadosValidos  = trozadosLineas.filter((t) => Number(t.cajas) > 0 && Number(t.kgCaja) > 0);

    // Validar stock de trozados
    const trozadosDisp = form.camaraOrigen === "cañete"
      ? (resumen?.trozadosCañeteDetalle   || [])
      : (resumen?.trozadosTrigotucDetalle || []);
    for (const t of trozadosValidos) {
      const disponible = trozadosDisp.find((d) => d.tipo === t.tipo && d.clase === t.clase)?.cajas || 0;
      if (Number(t.cajas) > disponible) {
        Swal.fire("Error", `Stock insuficiente de ${trozadoLabel(t.tipo)} clase ${t.clase || "A"}. Disponible: ${disponible} cajas.`, "error");
        return;
      }
    }

    if (lineasValidas.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Error", "Ingresá al menos un calibre o un trozado.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const envio = await crearEnvioCamara({
        fecha:         ajustarFechaParaGuardar(form.fecha),
        camion:        form.camion || null,
        chofer:        form.chofer || null,
        camaraOrigen:  form.camaraOrigen,
        camaraDestino: form.camaraDestino,
        calibres:      lineasValidas.map(({ calibre, pollos, cajones }) => ({
          calibre: Number(calibre), pollos: Number(pollos), cajones,
        })),
        trozados:      trozadosValidos.map((t) => ({
          tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas), clase: t.clase,
        })),
        observaciones: form.observaciones,
      });
      const res = await Swal.fire({
        title: `Envío ${envio.numeroEnvio} registrado`,
        text: `${camaraLabel(form.camaraOrigen)} → ${camaraLabel(form.camaraDestino)}`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "Imprimir orden",
        confirmButtonColor: "#0d6efd",
        cancelButtonText: "Cerrar",
      });
      if (res.isConfirmed) imprimirOrdenEnvio(envio);
      setForm(FORM_INICIAL);
      setLineas([]);
      setTrozadosLineas([]);
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el envío.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => navigate("/frigorifico")}
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-truck me-2 text-secondary"></i>
            Envío entre Cámaras
          </h1>
        </div>

        {/* ── Formulario ── */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white py-2">
            <h6 className="mb-0">Registrar envío</h6>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">

                {/* Fecha */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Fecha</label>
                  <input
                    type="date"
                    className="form-control"
                    name="fecha"
                    value={form.fecha}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Camión — deshabilitado por ahora (no se usa) */}
                {/* <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Camión (opcional)</label>
                  <select
                    className="form-select"
                    name="camion"
                    value={form.camion}
                    onChange={handleChange}
                  >
                    <option value="">— Sin especificar —</option>
                    {camiones.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.marca} — {c.patente}
                      </option>
                    ))}
                  </select>
                </div> */}

                {/* Chofer */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Chofer (opcional)</label>
                  <select
                    className="form-select"
                    name="chofer"
                    value={form.chofer}
                    onChange={handleChange}
                  >
                    <option value="">— Sin especificar —</option>
                    {choferes.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.nombreUsuario}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cámara origen */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Cámara origen</label>
                  <select
                    className="form-select"
                    name="camaraOrigen"
                    value={form.camaraOrigen}
                    onChange={handleChange}
                    required
                  >
                    <option value="">— Seleccionar —</option>
                    {CAMARAS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Cámara destino */}
                <div className="col-12 col-sm-6 col-md-3">
                  <label className="form-label">Cámara destino</label>
                  <select
                    className="form-select"
                    name="camaraDestino"
                    value={form.camaraDestino}
                    onChange={handleChange}
                    required
                  >
                    <option value="">— Seleccionar —</option>
                    {CAMARAS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Observaciones */}
                <div className="col-12">
                  <label className="form-label">Observaciones (opcional)</label>
                  <input
                    type="text"
                    className="form-control"
                    name="observaciones"
                    value={form.observaciones}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Calibres */}
              {!form.camaraOrigen ? (
                <div className="alert alert-secondary py-2 mb-3">
                  <i className="bi bi-info-circle me-2"></i>
                  Seleccioná la cámara de origen para cargar el stock disponible.
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Cajones por calibre</label>
                  <CalibreTable lineas={lineas} onChange={setLineas} inputCajones showPollos={false} stockCalibres={stockCalibresOrigen} />
                </div>
              )}

              {/* Trozados */}
              {(() => {
                const disponibles = form.camaraOrigen === "cañete"
                  ? (resumen?.trozadosCañeteDetalle   || []).filter((t) => t.cajas > 0)
                  : (resumen?.trozadosTrigotucDetalle || []).filter((t) => t.cajas > 0);
                if (!form.camaraOrigen || disponibles.length === 0) return null;
                return (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Trozados</label>
                    <table className="table table-sm table-bordered align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo</th>
                          <th>Clase</th>
                          <th className="text-end">Disponible (cajas)</th>
                          <th style={{ width: "9rem" }}>Cajas a enviar</th>
                          <th className="text-muted small">kg/caja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disponibles.map((t) => {
                          const linea = trozadosLineas.find((l) => l.tipo === t.tipo && l.clase === t.clase) || { tipo: t.tipo, clase: t.clase, cajas: "", kgCaja: t.kgCaja };
                          return (
                            <tr key={`${t.tipo}-${t.clase || "A"}`}>
                              <td className="fw-semibold">{trozadoLabel(t.tipo)}</td>
                              <td><span className="badge bg-secondary">Clase {t.clase || "A"}</span></td>
                              <td className="text-end text-muted">{formatNum(t.cajas)}</td>
                              <td>
                                <input
                                  type="number" min="0" max={t.cajas} step="1"
                                  className="form-control form-control-sm text-center"
                                  placeholder="0"
                                  value={linea.cajas}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTrozadosLineas((prev) => {
                                      const idx = prev.findIndex((l) => l.tipo === t.tipo && l.clase === t.clase);
                                      const nueva = { tipo: t.tipo, clase: t.clase, cajas: val, kgCaja: t.kgCaja };
                                      if (idx === -1) return [...prev, nueva];
                                      return prev.map((l, i) => i === idx ? nueva : l);
                                    });
                                  }}
                                />
                              </td>
                              <td className="text-muted small">{t.kgCaja} kg</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && (
                  <span className="spinner-border spinner-border-sm me-1"></span>
                )}
                <i className="bi bi-truck me-1"></i>
                Registrar Envío
              </button>
            </form>
          </div>
        </div>

        {/* ── Lista de envíos ── */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white py-2">
            <h6 className="mb-0">Envíos registrados</h6>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : envios.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">No hay envíos registrados.</p>
            ) : (
              <>
                {/* Mobile: cards */}
                <div className="d-md-none p-3">
                  {envios.map((e) => (
                    <div key={e._id} className="card border mb-3">
                      <div className="card-body py-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-dark fs-6">{e.numeroEnvio}</span>
                          {e.estado === "pendiente" && <span className="badge bg-warning text-dark ms-1">Pendiente recepción</span>}
                          <div className="d-flex align-items-center gap-2">
                            <span className="text-muted small">{formatFecha(e.fecha)}</span>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => imprimirOrdenEnvio(e)}
                              title="Imprimir orden"
                            >
                              <i className="bi bi-printer"></i>
                            </button>
                            {esSuperAdmin && (
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleEliminar(e._id)}
                                title="Eliminar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mb-2">
                          <span className="badge bg-secondary me-1">{camaraLabel(e.camaraOrigen)}</span>
                          <i className="bi bi-arrow-right text-muted mx-1"></i>
                          <span className="badge bg-secondary">{camaraLabel(e.camaraDestino)}</span>
                        </div>
                        {e.camion && (
                          <div className="text-muted small mb-2">
                            <i className="bi bi-truck me-1"></i>
                            {e.camion.marca} — {e.camion.patente}
                          </div>
                        )}
                        {e.chofer && (
                          <div className="text-muted small mb-2">
                            <i className="bi bi-person me-1"></i>
                            {e.chofer.nombreUsuario}
                          </div>
                        )}
                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {e.calibres.map((c, i) => (
                            <span key={i} className="badge bg-info text-dark">
                              Cal.{c.calibre}: {formatNum(c.cajones)} caj
                            </span>
                          ))}
                          {(e.trozados || []).map((t, i) => (
                            <span key={`t${i}`} className="badge bg-warning text-dark">
                              {trozadoLabel(t.tipo)}: {formatNum(t.cajas)} caj
                            </span>
                          ))}
                        </div>
                        <div className="row g-0 text-center mb-2">
                          <div className="col-4 border-end">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Pollos</div>
                            <div className="fw-semibold small">{formatNum(e.totalPollos)}</div>
                          </div>
                          <div className="col-4 border-end">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Cajones</div>
                            <div className="fw-semibold small">{formatNum(e.totalCajones)}</div>
                          </div>
                          <div className="col-4">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Kg</div>
                            <div className="fw-semibold small">{formatNum(e.pesoTotalKg)}</div>
                          </div>
                        </div>
                        {e.observaciones && (
                          <div className="text-muted small">{e.observaciones}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Nro</th>
                        <th>Fecha</th>
                        <th>Origen → Destino</th>
                        <th>Camión</th>
                        <th>Chofer</th>
                        <th>Calibres</th>
                        <th className="text-end">Pollos</th>
                        <th className="text-end">Cajones</th>
                        <th className="text-end">Kg</th>
                        <th>Observaciones</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {envios.map((e) => (
                        <tr key={e._id}>
                          <td>
                            <span className="badge bg-dark">{e.numeroEnvio}</span>
                            {e.estado === "pendiente" && <span className="badge bg-warning text-dark ms-1">Pendiente</span>}
                          </td>
                          <td>{formatFecha(e.fecha)}</td>
                          <td>
                            <span className="badge bg-secondary me-1">{camaraLabel(e.camaraOrigen)}</span>
                            <i className="bi bi-arrow-right text-muted mx-1"></i>
                            <span className="badge bg-secondary">{camaraLabel(e.camaraDestino)}</span>
                          </td>
                          <td className="text-muted small">
                            {e.camion ? `${e.camion.marca} — ${e.camion.patente}` : "—"}
                          </td>
                          <td className="text-muted small">
                            {e.chofer ? e.chofer.nombreUsuario : "—"}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {e.calibres.map((c, i) => (
                                <span key={i} className="badge bg-info text-dark">
                                  Cal.{c.calibre}: {formatNum(c.cajones)} caj
                                </span>
                              ))}
                              {(e.trozados || []).map((t, i) => (
                                <span key={`t${i}`} className="badge bg-warning text-dark">
                                  {trozadoLabel(t.tipo)}: {formatNum(t.cajas)} caj
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-end">{formatNum(e.totalPollos)}</td>
                          <td className="text-end">{formatNum(e.totalCajones)}</td>
                          <td className="text-end">{formatNum(e.pesoTotalKg)}</td>
                          <td className="text-muted small">{e.observaciones || "—"}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => imprimirOrdenEnvio(e)}
                                title="Imprimir orden"
                              >
                                <i className="bi bi-printer"></i>
                              </button>
                              {esSuperAdmin && (
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleEliminar(e._id)}
                                  title="Eliminar"
                                >
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
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EnvioCamaraPage;
