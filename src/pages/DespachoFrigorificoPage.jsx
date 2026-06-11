import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import {
  obtenerDespachosFrigorifico,
  crearDespachoFrigorifico,
  completarDespachoFrigorifico,
  eliminarDespachoFrigorifico,
  obtenerResumenStock,
  buscarClientes,
  obtenerChoferes,
  obtenerCamiones,
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

const imprimirOrdenConCodigo = (d) => {
  const cliente = d.cliente?.razonSocial || "—";
  const camara  = camaraLbl(d.camara);
  const fecha   = fmtFecha(d.fecha);
  const filasCalibres = (d.calibres || []).map((c) => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #dee2e6">Cal. ${c.calibre}</td>
      <td style="padding:6px 12px;border:1px solid #dee2e6;text-align:right">${fmt(c.cajones)} cajones</td>
      <td style="padding:6px 12px;border:1px solid #dee2e6;text-align:right">${fmt(c.cajones * 20)} kg</td>
    </tr>`).join("");
  const filasTrozados = (d.trozados || []).map((t) => `
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
        <div class="fila"><span class="lbl">N° Orden</span><span class="val">${d.numeroOrden}</span></div>
        <div class="fila"><span class="lbl">Fecha</span><span class="val">${fecha}</span></div>
        <div class="fila"><span class="lbl">Cliente</span><span class="val">${cliente}</span></div>
        <div class="fila"><span class="lbl">Cámara / Turno</span><span class="val">${camara}${d.turno ? ` — ${d.turno}` : ""}</span></div>
      </div>
      ${filasCalibres ? `<h2>Pollos faenados (por calibre)</h2>
        <table><thead><tr>
          <th>Calibre</th><th style="text-align:right">Cajones</th><th style="text-align:right">Kg total</th>
        </tr></thead><tbody>${filasCalibres}</tbody></table>` : ""}
      ${filasTrozados ? `<h2>Trozados</h2>
        <table><thead><tr>
          <th>Tipo</th><th style="text-align:right">Cajas</th><th style="text-align:right">Kg total</th>
        </tr></thead><tbody>${filasTrozados}</tbody></table>` : ""}
      ${d.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${d.observaciones}</div>` : ""}
      <div class="estado-equipo">
        <div class="estado-titulo">Estado del equipo</div>
        <div class="estado-opciones">
          <label class="estado-item"><span class="chk"></span>Seco</label>
          <label class="estado-item"><span class="chk"></span>Limpio</label>
          <label class="estado-item"><span class="chk"></span>Ausencia de olores extraños</label>
        </div>
      </div>
      <div class="codigo-box">
        <div class="codigo-titulo">Código de retiro</div>
        <div class="codigo-valor">${d.codigoRetiro || "—"}</div>
        <div class="codigo-instruccion">Presentá este código en el frigorifico para retirar tu pedido</div>
      </div>
      <div class="no-factura">Documento no válido como factura</div>
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Orden ${d.numeroOrden}</title>
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
      .estado-equipo { margin-top: 20px; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 14px 18px; }
      .estado-titulo { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #374151; margin-bottom: 10px; }
      .estado-opciones { display: flex; gap: 28px; flex-wrap: wrap; }
      .estado-item { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: #111; cursor: default; }
      .chk { display: inline-block; width: 16px; height: 16px; border: 2px solid #374151; border-radius: 3px; flex-shrink: 0; }
      .codigo-box { margin-top: 16px; text-align: center; border: 3px solid #1d4ed8; border-radius: 12px; padding: 20px; background: #eff6ff; }
      .codigo-titulo { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1d4ed8; margin-bottom: 8px; }
      .codigo-valor { font-size: 3rem; font-weight: 900; letter-spacing: 0.4em; color: #1e3a8a; font-family: monospace; }
      .codigo-instruccion { font-size: 11px; color: #374151; margin-top: 8px; }
      .no-factura { text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; border-top: 1px dashed #d1d5db; margin-top: 20px; padding-top: 10px; }
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

// ── Modal nueva orden ────────────────────────────────────────────────────────
const NuevaOrdenModal = ({ onClose, onCreada, resumen }) => {
  const [saving, setSaving]                 = useState(false);
  const [busqueda, setBusqueda]             = useState("");
  const [resultados, setResultados]         = useState([]);
  const [clienteSel, setClienteSel]         = useState(null);
  const [camara, setCamara]                 = useState("");
  const [turno, setTurno]                   = useState("");
  const [lineas, setLineas]                 = useState([]);
  const [trozadosLineas, setTrozadosLineas] = useState([]);
  const [modalidad, setModalidad]           = useState("retiro_cliente");
  const [choferes, setChoferes]             = useState([]);
  const [camiones, setCamiones]             = useState([]);
  const [choferSel, setChoferSel]           = useState("");
  const [form, setForm] = useState({
    fecha:         new Date().toISOString().split("T")[0],
    observaciones: "",
  });

  useEffect(() => {
    Promise.all([obtenerChoferes(), obtenerCamiones()])
      .then(([data, cams]) => {
        setChoferes(data.choferes || []);
        setCamiones(cams.camiones || cams || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (busqueda.length < 2 || clienteSel) { setResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const data = await buscarClientes(busqueda);
        setResultados(data.clientes || data || []);
      } catch { setResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, clienteSel]);

  const seleccionarCliente = (c) => {
    setClienteSel(c);
    setBusqueda(c.razonSocial || c.nombre || "");
    setResultados([]);
  };

  const handleCamara = (val) => {
    if (val === camara) return;
    setCamara(val);
    setLineas([]);
    setTrozadosLineas([]);
  };

  const stockCalibres = camara === "cañete"
    ? (resumen?.stockCañete   || [])
    : camara === "trigotuc"
    ? (resumen?.stockTrigotuc || [])
    : null;

  const trozadosDisp = camara === "cañete"
    ? (resumen?.trozadosCañete   || []).filter((t) => t.cajas > 0)
    : camara === "trigotuc"
    ? (resumen?.trozadosTrigotuc || []).filter((t) => t.cajas > 0)
    : [];

  const totalCajCam = (stockCalibres || []).reduce((a, c) => a + c.cajones, 0);
  const lineasCalc  = lineas.map((l) => ({ ...l, cajones: calcularCajones(l.pollos, l.calibre) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clienteSel) { Swal.fire("Faltan datos", "Seleccioná un cliente.", "warning"); return; }
    if (!camara)     { Swal.fire("Faltan datos", "Seleccioná la cámara de origen.", "warning"); return; }
    if (!turno)      { Swal.fire("Faltan datos", "Indicá si la carga es por la mañana o por la tarde.", "warning"); return; }
    if (modalidad === "delivery_chofer" && !choferSel) { Swal.fire("Faltan datos", "Seleccioná el chofer para la entrega.", "warning"); return; }

    const lineasValidas   = lineasCalc.filter((l) => l.cajones > 0);
    const trozadosValidos = trozadosLineas.filter((t) => Number(t.cajas) > 0 && Number(t.kgCaja) > 0);

    if (lineasValidas.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Faltan datos", "Seleccioná al menos un calibre o un trozado a cargar.", "warning");
      return;
    }

    for (const t of trozadosValidos) {
      const disp = trozadosDisp.find((d) => d.tipo === t.tipo)?.cajas || 0;
      if (Number(t.cajas) > disp) {
        Swal.fire("Error", `Stock insuficiente de ${tipoLbl(t.tipo)}. Disponible: ${disp} cajas.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      const camionDelChofer = camiones.find((c) => c.choferes?.some((ch) => String(ch?._id || ch) === String(choferSel)));

      const despacho = await crearDespachoFrigorifico({
        fecha:            form.fecha,
        camara,
        turno,
        cliente:          clienteSel._id,
        calibres:         lineasValidas.map(({ calibre, cajones }) => ({ calibre: Number(calibre), cajones })),
        trozados:         trozadosValidos.map((t) => ({ tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas) })),
        observaciones:    form.observaciones || undefined,
        modalidadEntrega: modalidad,
        chofer:           modalidad === "delivery_chofer" ? choferSel : undefined,
        camion:           modalidad === "delivery_chofer" ? (camionDelChofer?._id || undefined) : undefined,
      });
      onCreada(despacho);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear la orden.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">

            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-clipboard2-plus me-2"></i>Nueva Orden de Carga
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-despacho" onSubmit={handleSubmit}>

                {/* Cliente + Fecha */}
                <div className="row g-3 mb-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">
                      Cliente <span className="text-danger">*</span>
                    </label>
                    <div className="position-relative">
                      <input
                        type="text"
                        className={`form-control ${clienteSel ? "is-valid" : ""}`}
                        placeholder="Escribí el nombre del cliente..."
                        value={busqueda}
                        onChange={(e) => { setBusqueda(e.target.value); setClienteSel(null); }}
                        autoComplete="off"
                        autoFocus
                      />
                      {resultados.length > 0 && (
                        <div className="position-absolute w-100 bg-white border rounded shadow-sm"
                          style={{ zIndex: 1055, maxHeight: "200px", overflowY: "auto" }}>
                          {resultados.map((c) => (
                            <div key={c._id} className="px-3 py-2 border-bottom"
                              style={{ cursor: "pointer" }}
                              onMouseDown={() => seleccionarCliente(c)}>
                              {c.razonSocial || c.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">
                      Fecha <span className="text-danger">*</span>
                    </label>
                    <input type="date" className="form-control" value={form.fecha}
                      onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">
                      Turno <span className="text-danger">*</span>
                    </label>
                    <div className="d-flex gap-2">
                      {[
                        { value: "mañana", label: "Mañana", icon: "bi-sunrise" },
                        { value: "tarde",  label: "Tarde",  icon: "bi-sunset"  },
                      ].map((t) => (
                        <button key={t.value} type="button"
                          className={`btn flex-grow-1 py-2 ${turno === t.value ? "btn-success" : "btn-outline-secondary"}`}
                          onClick={() => setTurno(t.value)}>
                          <i className={`bi ${t.icon} me-1`}></i>{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modalidad de entrega */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Modalidad de entrega <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-2">
                    {[
                      { value: "retiro_cliente", label: "Retiro cliente",  icon: "bi-person-walking" },
                      { value: "delivery_chofer", label: "Camión Trigotuc", icon: "bi-truck"          },
                    ].map((m) => (
                      <button key={m.value} type="button"
                        className={`btn flex-grow-1 py-2 ${modalidad === m.value ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => { setModalidad(m.value); setChoferSel(""); }}>
                        <i className={`bi ${m.icon} me-1`}></i>{m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector de chofer (solo delivery) */}
                {modalidad === "delivery_chofer" && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Chofer <span className="text-danger">*</span>
                    </label>
                    {choferes.length === 0 ? (
                      <div className="alert alert-warning py-2 small mb-0">
                        No hay choferes registrados. Creá un usuario con rol <strong>chofer</strong>.
                      </div>
                    ) : (
                      <select
                        className={`form-select ${modalidad === "delivery_chofer" && !choferSel ? "is-invalid" : ""}`}
                        value={choferSel}
                        onChange={(e) => setChoferSel(e.target.value)}
                      >
                        <option value="">Seleccioná un chofer...</option>
                        {choferes.map((c) => {
                          const cam = camiones.find((k) => k.choferes?.some((ch) => String(ch?._id || ch) === String(c._id)) && k.activo);
                          return (
                            <option key={c._id} value={c._id}>
                              {c.nombreUsuario}{cam ? ` — ${cam.marca} ${cam.patente}` : " (sin camión asignado)"}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                )}

                {/* Cámara */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Cámara de origen <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-2">
                    {[
                      { value: "cañete",   label: "Cañete"   },
                      { value: "trigotuc", label: "Trigotuc" },
                    ].map((c) => (
                      <button key={c.value} type="button"
                        className={`btn flex-grow-1 py-2 ${camara === c.value ? "btn-success" : "btn-outline-secondary"}`}
                        onClick={() => handleCamara(c.value)}>
                        <i className="bi bi-snow me-1"></i>{c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel de stock — tarjetitas */}
                {camara && (
                  <div className="mb-3">
                    {totalCajCam === 0 && trozadosDisp.length === 0 ? (
                      <div className="rounded px-3 py-2 small text-muted"
                        style={{ background: "#fef9c3", border: "1px solid #fde68a" }}>
                        <i className="bi bi-exclamation-triangle me-1 text-warning"></i>
                        La cámara {camaraLbl(camara)} no tiene stock disponible.
                      </div>
                    ) : (
                      <div className="rounded p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <div className="small fw-semibold text-success mb-2">
                          <i className="bi bi-snow me-1"></i>Stock en {camaraLbl(camara)}
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {(stockCalibres || []).filter((c) => c.cajones > 0).map((c) => (
                            <div key={c.calibre} className="text-center rounded border"
                              style={{ background: "#eff6ff", minWidth: "80px", padding: "6px 10px" }}>
                              <div className="fw-bold text-primary" style={{ fontSize: "1rem" }}>Cal. {c.calibre}</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>{fmt(c.cajones)} cajones</div>
                              <div className="text-muted" style={{ fontSize: "0.68rem" }}>{fmt(c.cajones * 20)} kg</div>
                            </div>
                          ))}
                          {trozadosDisp.map((t) => (
                            <div key={t.tipo} className="text-center rounded border"
                              style={{ background: "#fffbeb", minWidth: "80px", padding: "6px 10px" }}>
                              <div className="fw-bold text-warning" style={{ fontSize: "0.85rem" }}>{tipoLbl(t.tipo)}</div>
                              <div className="text-muted" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>{fmt(t.cajas)} cajas</div>
                              <div className="text-muted" style={{ fontSize: "0.68rem" }}>{fmt(t.kgTotal)} kg</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detalle a cargar */}
                {camara && (totalCajCam > 0 || trozadosDisp.length > 0) && (
                  <>
                    <div className="fw-semibold mb-2 small text-uppercase text-muted" style={{ letterSpacing: "0.05em" }}>
                      Detalle a cargar
                    </div>

                    {totalCajCam > 0 && (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Cajones por calibre</label>
                        <CalibreTable
                          lineas={lineas}
                          onChange={setLineas}
                          inputCajones
                          showPollos={false}
                          stockCalibres={stockCalibres}
                        />
                      </div>
                    )}

                    {trozadosDisp.length > 0 && (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Trozados</label>
                        <table className="table table-sm table-bordered align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Tipo</th>
                              <th className="text-end">Disponible</th>
                              <th style={{ width: "9rem" }}>Cajas a cargar</th>
                              <th>kg/caja</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trozadosDisp.map((t) => {
                              const linea = trozadosLineas.find((l) => l.tipo === t.tipo) || { cajas: "", kgCaja: t.kgCaja };
                              return (
                                <tr key={t.tipo}>
                                  <td className="fw-semibold">{tipoLbl(t.tipo)}</td>
                                  <td className="text-end text-muted">{fmt(t.cajas)} cajas</td>
                                  <td>
                                    <input type="number" min="0" max={t.cajas} step="1"
                                      className="form-control form-control-sm text-center"
                                      placeholder="0"
                                      value={linea.cajas}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setTrozadosLineas((prev) => {
                                          const idx = prev.findIndex((l) => l.tipo === t.tipo);
                                          const nueva = { tipo: t.tipo, cajas: val, kgCaja: t.kgCaja };
                                          return idx === -1 ? [...prev, nueva] : prev.map((l, i) => i === idx ? nueva : l);
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
                    )}
                  </>
                )}

                {/* Observaciones */}
                <div className="mb-1">
                  <label className="form-label">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea className="form-control" rows={2}
                    value={form.observaciones}
                    onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                    placeholder="Cualquier dato adicional..." />
                </div>

              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" form="form-despacho" className="btn btn-success" disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Confirmar orden de carga
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
const DespachoFrigorificoPage = () => {
  const rolUsuario    = localStorage.getItem("rolUsuario");
  const esSuperAdmin  = rolUsuario === "superadmin";
  const esAdmin       = ["superadmin", "administracion_frigorifico"].includes(rolUsuario);
  const puedeProcesar = ["superadmin", "frigorifico"].includes(rolUsuario);

  const [despachos, setDespachos]       = useState([]);
  const [resumen, setResumen]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtro, setFiltro]             = useState("");

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [desp, res] = await Promise.all([
        obtenerDespachosFrigorifico(),
        obtenerResumenStock(),
      ]);
      setDespachos(desp);
      setResumen(res);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleCreada = async (despacho) => {
    setModalAbierto(false);
    cargarDatos();
    const { isConfirmed } = await Swal.fire({
      icon: "success",
      title: "Orden creada",
      html: `<div>Orden <strong>${despacho.numeroOrden}</strong> generada con código <strong style="letter-spacing:0.2em">${despacho.codigoRetiro}</strong>.</div>
             <div class="mt-2 text-muted" style="font-size:0.9rem">¿Querés descargar el PDF para enviárselo al cliente?</div>`,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-printer me-1"></i>Sí, descargar PDF',
      cancelButtonText: "Ahora no",
      confirmButtonColor: "#0d6efd",
    });
    if (isConfirmed) imprimirOrdenConCodigo(despacho);
  };

  const handleCompletar = async (d) => {
    if (d.modalidadEntrega === "delivery_chofer") {
      const choferNombre = d.chofer?.nombreUsuario || "chofer asignado";
      const ok = await Swal.fire({
        title: "¿Confirmar orden lista para retiro?",
        html: `<div style="text-align:left;font-size:14px">
          <div><strong>Cliente:</strong> ${d.cliente?.razonSocial || "—"}</div>
          <div style="margin-top:6px"><strong>Chofer:</strong> ${choferNombre}</div>
          <div style="margin-top:6px;color:#6b7280">El chofer recibirá una notificación para venir a retirar.</div>
        </div>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#2563eb",
        confirmButtonText: "Sí, lista para retiro",
        cancelButtonText: "Cancelar",
      });
      if (!ok.isConfirmed) return;
      try {
        await completarDespachoFrigorifico(d._id);
        cargarDatos();
        Swal.fire({ icon: "success", title: "Orden confirmada", text: "El chofer fue notificado.", timer: 2000, showConfirmButton: false });
      } catch (err) {
        Swal.fire("Error", err.message || "No se pudo completar.", "error");
      }
    } else {
      // retiro_cliente — pide el código que trae el cliente
      const { value: codigo, isConfirmed } = await Swal.fire({
        title: "Código de retiro del cliente",
        html: `<div style="margin-bottom:8px;font-size:14px;color:#374151">
          <strong>${d.cliente?.razonSocial || "—"}</strong> — ingresá el código que te presentó el cliente.
        </div>`,
        input: "text",
        inputAttributes: { maxlength: 6, style: "text-transform:uppercase;letter-spacing:0.3em;font-size:1.4rem;text-align:center;font-weight:bold" },
        inputPlaceholder: "XXXXXX",
        showCancelButton: true,
        confirmButtonColor: "#198754",
        confirmButtonText: "Confirmar entrega",
        cancelButtonText: "Cancelar",
        preConfirm: (val) => {
          if (!val || val.trim().length < 4) { Swal.showValidationMessage("Ingresá el código completo"); return false; }
          return val;
        },
      });
      if (!isConfirmed || !codigo) return;
      try {
        await completarDespachoFrigorifico(d._id, { codigoRetiro: codigo.trim() });
        cargarDatos();
        Swal.fire({ icon: "success", title: "Entrega confirmada", text: "Stock descontado correctamente.", timer: 2000, showConfirmButton: false });
      } catch (err) {
        Swal.fire("Error", err.message || "No se pudo completar.", "error");
      }
    }
  };

  const handleEliminar = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar orden?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarDespachoFrigorifico(id);
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const despachosVisibles = filtro ? despachos.filter((d) => d.estado === filtro) : despachos;

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-clipboard2-check me-2 text-primary"></i>
            Órdenes de Carga
          </h1>
          <div className="d-flex gap-2 flex-wrap">
            {[
              { v: "",           l: "Todas"      },
              { v: "pendiente",  l: "Pendientes" },
              { v: "completada", l: "Completadas" },
            ].map(({ v, l }) => (
              <button key={v}
                className={`btn btn-sm ${filtro === v ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltro(v)}>
                {l}
              </button>
            ))}
            {esAdmin && (
              <button className="btn btn-success btn-sm" onClick={() => setModalAbierto(true)}>
                <i className="bi bi-plus-circle me-1"></i>Nueva orden
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
        ) : despachosVisibles.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            No hay órdenes en este estado.
          </div>
        ) : (
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
                      <th>Modalidad</th>
                      <th>Detalle</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {despachosVisibles.map((d) => (
                      <tr key={d._id}>
                        <td><span className="badge bg-dark">{d.numeroOrden}</span></td>
                        <td className="small">{fmtFecha(d.fecha)}</td>
                        <td className="fw-semibold small">{d.cliente?.razonSocial || "—"}</td>
                        <td><span className="badge bg-secondary">{camaraLbl(d.camara)}</span></td>
                        <td className="small text-muted">{d.turno || "—"}</td>
                        <td>
                          {d.modalidadEntrega === "delivery_chofer" ? (
                            <div>
                              <span className="badge bg-info text-dark"><i className="bi bi-truck me-1"></i>Camión</span>
                              {d.chofer && <div className="small text-muted mt-1">{d.chofer.nombreUsuario}</div>}
                            </div>
                          ) : (
                            <span className="badge bg-light text-dark border"><i className="bi bi-person-walking me-1"></i>Cliente</span>
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
                          </div>
                        </td>
                        <td>
                          {d.estado !== "completada"
                            ? <span className="badge bg-warning text-dark">Pendiente</span>
                            : d.modalidadEntrega === "delivery_chofer"
                              ? d.entregado
                                ? <span className="badge bg-success">Entregado</span>
                                : d.confirmadaCarga
                                  ? <span className="badge bg-info text-dark">En camión</span>
                                  : <span className="badge bg-success">Listo para cargar</span>
                              : <span className="badge bg-success">Completada</span>
                          }
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap">
                            {d.estado === "pendiente" && (
                              <button className="btn btn-outline-secondary btn-sm" title="Imprimir orden con código"
                                onClick={() => imprimirOrdenConCodigo(d)}>
                                <i className="bi bi-printer"></i>
                              </button>
                            )}
                            {d.estado === "pendiente" && puedeProcesar && (
                              <button
                                className={`btn btn-sm ${d.modalidadEntrega === "delivery_chofer" ? "btn-primary" : "btn-success"}`}
                                title={d.modalidadEntrega === "delivery_chofer" ? "Lista para retiro del chofer" : "Confirmar entrega al cliente"}
                                onClick={() => handleCompletar(d)}
                              >
                                <i className={`bi ${d.modalidadEntrega === "delivery_chofer" ? "bi-truck" : "bi-check2-circle"} me-1`}></i>
                                {d.modalidadEntrega === "delivery_chofer" ? "Lista para retiro" : "Entregar"}
                              </button>
                            )}
                            {esSuperAdmin && d.estado === "pendiente" && (
                              <button className="btn btn-outline-danger btn-sm"
                                onClick={() => handleEliminar(d._id)}>
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
        )}

      </div>

      {modalAbierto && (
        <NuevaOrdenModal
          onClose={() => setModalAbierto(false)}
          onCreada={handleCreada}
          resumen={resumen}
        />
      )}
    </Layout>
  );
};

export default DespachoFrigorificoPage;
