import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import {
  obtenerDespachosFrigorifico,
  crearDespachoFrigorifico,
  eliminarDespachoFrigorifico,
  obtenerResumenStock,
  buscarClientes,
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
  const [form, setForm] = useState({
    fecha:         new Date().toISOString().split("T")[0],
    observaciones: "",
  });

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
      await crearDespachoFrigorifico({
        fecha:         form.fecha,
        camara,
        turno,
        cliente:       clienteSel._id,
        calibres:      lineasValidas.map(({ calibre, cajones }) => ({ calibre: Number(calibre), cajones })),
        trozados:      trozadosValidos.map((t) => ({ tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas) })),
        observaciones: form.observaciones || undefined,
      });
      onCreada();
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
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const esSuperAdmin = rolUsuario === "superadmin";

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

  const handleCreada = () => {
    setModalAbierto(false);
    Swal.fire({ icon: "success", title: "Orden creada", timer: 1800, showConfirmButton: false });
    cargarDatos();
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
            <button className="btn btn-success btn-sm" onClick={() => setModalAbierto(true)}>
              <i className="bi bi-plus-circle me-1"></i>Nueva orden
            </button>
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
                      <th>Detalle</th>
                      <th>Estado</th>
                      <th>Registrado por</th>
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
                        <td className="small text-muted">{d.registradoPor?.nombreUsuario || "—"}</td>
                        <td>
                          {esSuperAdmin && d.estado === "pendiente" && (
                            <button className="btn btn-outline-danger btn-sm"
                              onClick={() => handleEliminar(d._id)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
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
