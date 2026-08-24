import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import BotonExcel from "../components/BotonExcel";
import CalibreTable from "../components/CalibreTable";
import {
  obtenerResumenStock,
  registrarSalidaMostrador,
  obtenerSalidasMostrador,
  editarSalidaMostrador,
  eliminarSalidaMostrador,
} from "../services/api";
import Swal from "sweetalert2";
import { exportarLibroExcel } from "../utils/exportarExcel";

const TIPOS_LABEL = { filet: "Filet", pata: "Pata muslo", alita: "Alita", menudo: "Menudo", carcaza: "Carcaza" };
const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
const hoyISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD en tz local

// Convierte el `detalle` guardado de un movimiento a formato editable.
const detalleAEditable = (detalle = []) => {
  const enteros = [];
  const trozados = [];
  for (const d of detalle) {
    if (d.clase === "entero") {
      enteros.push({ calibre: Number(d.calibre), cajones: Number(d.cajones) });
    } else if (d.clase === "trozado") {
      const cajas = Number(d.cajas);
      const kgCaja = d.kgCaja != null ? Number(d.kgCaja) : (cajas ? Number(d.kg) / cajas : 0);
      trozados.push({ tipo: d.tipo, clase: d.claseTrozado || "A", cajas, kgCaja });
    }
  }
  return { enteros, trozados };
};

// Resumen legible de una salida para la tabla.
const resumenLineas = (detalle = []) => {
  const partes = [];
  for (const d of detalle) {
    if (d.clase === "entero") partes.push(`Cal. ${d.calibre}: ${fmt(d.cajones)} caj`);
    else if (d.clase === "trozado")
      partes.push(`${TIPOS_LABEL[d.tipo] || d.tipo}${d.claseTrozado ? ` ${d.claseTrozado}` : ""}: ${fmt(d.cajas)} cajas`);
  }
  return partes;
};

const SalidaMostradorPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("registrar");
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lineas, setLineas] = useState([]);              // enteros: { calibre, cajones, pollos }
  const [trozadosLineas, setTrozadosLineas] = useState([]); // { tipo, clase, cajas, kgCaja }

  // ── Solapa "Salidas del día" ──
  const [fecha, setFecha] = useState(hoyISO());
  const [salidas, setSalidas] = useState([]);
  const [loadingSalidas, setLoadingSalidas] = useState(false);
  const [editSalida, setEditSalida] = useState(null); // { _id, enteros, trozados }
  const [editSaving, setEditSaving] = useState(false);
  // Excel: las salidas del día elegido. Dos hojas porque son dos preguntas
  // distintas — "qué salidas hubo" y "cuánto salió de cada producto", que es la
  // que se usa para cuadrar el mostrador.
  const exportarExcel = () => {
    const lineas = salidas.flatMap((s) =>
      (s.detalle || []).map((d) => ({ s, d }))
    );

    exportarLibroExcel({
      nombreArchivo: "Frigorifico_salidas_mostrador",
      hojas: [
        {
          nombre: "Salidas",
          filas: salidas,
          columnas: [
            { header: "Fecha",   valor: (s) => new Date(s.fecha).toLocaleDateString("es-AR") },
            { header: "Hora",    valor: (s) => new Date(s.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) },
            { header: "Detalle", valor: (s) => resumenLineas(s.detalle).join(" · "), ancho: 45 },
            { header: "Registró", valor: (s) => s.registradoPor?.nombreUsuario },
          ],
        },
        {
          nombre: "Líneas",
          filas: lineas,
          columnas: [
            { header: "Fecha",   valor: (f) => new Date(f.s.fecha).toLocaleDateString("es-AR") },
            { header: "Hora",    valor: (f) => new Date(f.s.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) },
            { header: "Producto", valor: (f) => (f.d.clase === "entero"
                ? "Entero Cal." + f.d.calibre
                : (TIPOS_LABEL[f.d.tipo] || f.d.tipo) + (f.d.claseTrozado ? " " + f.d.claseTrozado : "")) },
            { header: "Clase",   valor: (f) => f.d.clase },
            { header: "Calibre", valor: (f) => (f.d.clase === "entero" ? f.d.calibre : "") },
            { header: "Cajones", valor: (f) => (f.d.clase === "entero" ? f.d.cajones ?? 0 : "") },
            { header: "Cajas",   valor: (f) => (f.d.clase === "trozado" ? f.d.cajas ?? 0 : "") },
            { header: "Kg",      valor: (f) => (f.d.kg != null ? f.d.kg : "") },
            { header: "Registró", valor: (f) => f.s.registradoPor?.nombreUsuario },
          ],
        },
      ],
    });
  };


  const cargar = async () => {
    try {
      setResumen(await obtenerResumenStock());
    } catch {
      Swal.fire("Error", "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const cargarSalidas = async () => {
    setLoadingSalidas(true);
    try {
      setSalidas(await obtenerSalidasMostrador(fecha));
    } catch {
      Swal.fire("Error", "No se pudieron cargar las salidas.", "error");
    } finally {
      setLoadingSalidas(false);
    }
  };
  useEffect(() => {
    if (tab === "salidas") cargarSalidas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fecha]);

  const stockEnteros = resumen?.stockTrigotuc || [];
  const trozadosDisp = (resumen?.trozadosTrigotucDetalle || []).filter((t) => t.cajas > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const calibresValidos = lineas.filter((l) => Number(l.cajones) > 0);
    const trozadosValidos = trozadosLineas.filter((t) => Number(t.cajas) > 0);

    if (calibresValidos.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Faltan datos", "Ingresá al menos un cajón o una caja vendida.", "warning");
      return;
    }

    // Validar stock disponible
    for (const t of trozadosValidos) {
      const disp = trozadosDisp.find((d) => d.tipo === t.tipo && d.clase === t.clase)?.cajas || 0;
      if (Number(t.cajas) > disp) {
        Swal.fire("Error", `Stock insuficiente de ${TIPOS_LABEL[t.tipo] || t.tipo} clase ${t.clase}. Disponible: ${disp} cajas.`, "error");
        return;
      }
    }
    for (const c of calibresValidos) {
      const disp = stockEnteros.find((s) => s.calibre === Number(c.calibre))?.cajones || 0;
      if (Number(c.cajones) > disp) {
        Swal.fire("Error", `Stock insuficiente de Cal. ${c.calibre}. Disponible: ${disp} cajones.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      await registrarSalidaMostrador({
        calibres: calibresValidos.map((c) => ({ calibre: Number(c.calibre), cajones: Number(c.cajones) })),
        trozados: trozadosValidos.map((t) => ({ tipo: t.tipo, clase: t.clase, cajas: Number(t.cajas), kgCaja: Number(t.kgCaja) })),
      });
      await Swal.fire({ icon: "success", title: "Salida registrada", text: "Se descontó el stock de Trigotuc.", timer: 1500, showConfirmButton: false });
      setLineas([]);
      setTrozadosLineas([]);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar la salida.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Editar / borrar salidas ──
  const abrirEdicion = (salida) => setEditSalida({ _id: salida._id, ...detalleAEditable(salida.detalle) });

  const setEnteroCajones = (idx, val) =>
    setEditSalida((prev) => ({
      ...prev,
      enteros: prev.enteros.map((e, i) => (i === idx ? { ...e, cajones: val } : e)),
    }));
  const setTrozadoCajas = (idx, val) =>
    setEditSalida((prev) => ({
      ...prev,
      trozados: prev.trozados.map((t, i) => (i === idx ? { ...t, cajas: val } : t)),
    }));

  const guardarEdicion = async () => {
    const calibres = editSalida.enteros
      .filter((e) => Number(e.cajones) > 0)
      .map((e) => ({ calibre: Number(e.calibre), cajones: Number(e.cajones) }));
    const trozados = editSalida.trozados
      .filter((t) => Number(t.cajas) > 0)
      .map((t) => ({ tipo: t.tipo, clase: t.clase, cajas: Number(t.cajas), kgCaja: Number(t.kgCaja) }));

    if (calibres.length === 0 && trozados.length === 0) {
      Swal.fire("Sin cantidades", "Dejá al menos una línea con cantidad mayor a 0. Si querés eliminar toda la salida, usá Borrar.", "warning");
      return;
    }

    setEditSaving(true);
    try {
      await editarSalidaMostrador(editSalida._id, { calibres, trozados });
      setEditSalida(null);
      await Swal.fire({ icon: "success", title: "Salida actualizada", text: "Se reajustó el stock de Trigotuc.", timer: 1400, showConfirmButton: false });
      cargar();
      cargarSalidas();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo actualizar la salida.", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const borrarSalida = async (salida) => {
    const detalleTxt = resumenLineas(salida.detalle).join(" · ") || "(sin detalle)";
    const r = await Swal.fire({
      icon: "warning",
      title: "¿Borrar salida?",
      html: `Se devolverá el stock a la cámara Trigotuc.<br><span class="text-muted small">${detalleTxt}</span>`,
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!r.isConfirmed) return;
    try {
      await eliminarSalidaMostrador(salida._id);
      await Swal.fire({ icon: "success", title: "Salida borrada", text: "Se devolvió el stock.", timer: 1400, showConfirmButton: false });
      cargar();
      cargarSalidas();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo borrar la salida.", "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex align-items-center gap-2 mb-4">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/frigorifico")}>
            <i className="bi bi-arrow-left"></i>
          </button>
          <h1 className="h3 mb-0">
            <i className="bi bi-shop me-2 text-secondary"></i>
            Salida de Mostrador — Trigotuc
          </h1>
        </div>

        {/* ── Solapas ── */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${tab === "registrar" ? "active" : ""}`} onClick={() => setTab("registrar")}>
              <i className="bi bi-cart-dash me-1"></i> Registrar salida
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab === "salidas" ? "active" : ""}`} onClick={() => setTab("salidas")}>
              <i className="bi bi-list-ul me-1"></i> Salidas del día
            </button>
          </li>
        </ul>

        {/* ══════════ TAB REGISTRAR ══════════ */}
        {tab === "registrar" && (
          <>
            <div className="alert alert-info py-2 small">
              <i className="bi bi-info-circle me-1"></i>
              Cargá lo que se vendió por mostrador. Descuenta el stock de la cámara <strong>Trigotuc</strong>.
              (Puente manual hasta que el POS descuente automático.)
            </div>

            {loading ? (
              <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <form onSubmit={handleSubmit}>
                    {/* Enteros */}
                    {stockEnteros.length > 0 && (
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Pollo entero (por cajón)</label>
                        <CalibreTable lineas={lineas} onChange={setLineas} inputCajones showPollos={false} stockCalibres={stockEnteros} />
                      </div>
                    )}

                    {/* Trozados */}
                    {trozadosDisp.length > 0 ? (
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Trozados (por caja)</label>
                        <table className="table table-sm table-bordered align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Tipo</th>
                              <th>Clase</th>
                              <th className="text-end">Disponible</th>
                              <th style={{ width: "9rem" }}>Cajas vendidas</th>
                              <th className="text-muted small">kg/caja</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trozadosDisp.map((t) => {
                              const linea = trozadosLineas.find((l) => l.tipo === t.tipo && l.clase === t.clase) || { tipo: t.tipo, clase: t.clase, cajas: "", kgCaja: t.kgCaja };
                              return (
                                <tr key={`${t.tipo}-${t.clase || "A"}`}>
                                  <td className="text-capitalize fw-semibold">{TIPOS_LABEL[t.tipo] || t.tipo}</td>
                                  <td><span className="badge bg-secondary">Clase {t.clase || "A"}</span></td>
                                  <td className="text-end text-muted">{fmt(t.cajas)} cajas</td>
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
                    ) : stockEnteros.length === 0 && (
                      <p className="text-muted">No hay stock en la cámara Trigotuc.</p>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={saving || (stockEnteros.length === 0 && trozadosDisp.length === 0)}>
                      {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                      <i className="bi bi-cart-dash me-1"></i>
                      Registrar salida
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ TAB SALIDAS DEL DÍA ══════════ */}
        {tab === "salidas" && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                <div>
                  <label className="form-label form-label-sm mb-1 fw-semibold">Fecha</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fecha}
                    max={hoyISO()}
                    onChange={(e) => setFecha(e.target.value)}
                    style={{ maxWidth: "12rem" }}
                  />
                </div>
                <button className="btn btn-outline-secondary btn-sm" onClick={cargarSalidas} disabled={loadingSalidas}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Actualizar
                </button>
                <BotonExcel
                  onClick={exportarExcel}
                  disabled={loadingSalidas || salidas.length === 0}
                  titulo="Descargar las salidas de esta fecha"
                />
              </div>

              {loadingSalidas ? (
                <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
              ) : salidas.length === 0 ? (
                <p className="text-muted mb-0"><i className="bi bi-inbox me-1"></i> No hay salidas registradas para esta fecha.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: "5rem" }}>Hora</th>
                        <th>Detalle</th>
                        <th className="d-none d-md-table-cell">Registró</th>
                        <th style={{ width: "8rem" }} className="text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salidas.map((s) => (
                        <tr key={s._id}>
                          <td className="text-muted small">
                            {new Date(s.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td>
                            {resumenLineas(s.detalle).map((linea, i) => (
                              <span key={i} className="badge bg-light text-dark border me-1 mb-1">{linea}</span>
                            ))}
                          </td>
                          <td className="d-none d-md-table-cell text-muted small">{s.registradoPor?.nombreUsuario || "—"}</td>
                          <td className="text-center">
                            <button className="btn btn-outline-primary btn-sm me-1" onClick={() => abrirEdicion(s)} title="Editar">
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button className="btn btn-outline-danger btn-sm" onClick={() => borrarSalida(s)} title="Borrar">
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════ MODAL EDITAR SALIDA ══════════ */}
      {editSalida && (
        <div className="modal d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-pencil me-2"></i>Editar salida</h5>
                <button type="button" className="btn-close" onClick={() => setEditSalida(null)} disabled={editSaving}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small">
                  Corregí las cantidades. Al guardar se reajusta el stock de la cámara Trigotuc.
                </p>

                {editSalida.enteros.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold mb-1">Pollo entero (cajones)</label>
                    <table className="table table-sm table-bordered align-middle mb-0">
                      <thead className="table-light"><tr><th>Calibre</th><th style={{ width: "9rem" }}>Cajones</th></tr></thead>
                      <tbody>
                        {editSalida.enteros.map((e, idx) => (
                          <tr key={e.calibre}>
                            <td><span className="badge bg-primary">Cal. {e.calibre}</span></td>
                            <td>
                              <input type="number" min="0" step="1" className="form-control form-control-sm text-center"
                                value={e.cajones} onChange={(ev) => setEnteroCajones(idx, ev.target.value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {editSalida.trozados.length > 0 && (
                  <div className="mb-2">
                    <label className="form-label fw-semibold mb-1">Trozados (cajas)</label>
                    <table className="table table-sm table-bordered align-middle mb-0">
                      <thead className="table-light"><tr><th>Tipo</th><th>Clase</th><th style={{ width: "9rem" }}>Cajas</th></tr></thead>
                      <tbody>
                        {editSalida.trozados.map((t, idx) => (
                          <tr key={`${t.tipo}-${t.clase}`}>
                            <td className="fw-semibold">{TIPOS_LABEL[t.tipo] || t.tipo}</td>
                            <td><span className="badge bg-secondary">Clase {t.clase}</span></td>
                            <td>
                              <input type="number" min="0" step="1" className="form-control form-control-sm text-center"
                                value={t.cajas} onChange={(ev) => setTrozadoCajas(idx, ev.target.value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-muted small mb-0 mt-2">
                  <i className="bi bi-info-circle me-1"></i>
                  Poné una línea en 0 para quitarla. Para eliminar toda la salida usá Borrar.
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setEditSalida(null)} disabled={editSaving}>Cancelar</button>
                <button className="btn btn-primary" onClick={guardarEdicion} disabled={editSaving}>
                  {editSaving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-check-lg me-1"></i> Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SalidaMostradorPage;
