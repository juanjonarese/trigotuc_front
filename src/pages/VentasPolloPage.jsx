import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import {
  obtenerVentasPollo,
  crearVentaPollo,
  eliminarVentaPollo,
  obtenerClientes,
  obtenerResumenStock,
} from "../services/api";
import Swal from "sweetalert2";
import SelectDropdown from "../components/SelectDropdown";

const CAMARAS = [
  { value: "cañete",   label: "Cañete" },
  { value: "trigotuc", label: "Trigotuc" },
];

const formInicial = {
  fecha:        new Date().toISOString().split("T")[0],
  camara:       "cañete",
  cliente:      "",
  descuento:    0,
  observaciones: "",
};

const VentasPolloPage = () => {
  const rolUsuario = localStorage.getItem("rolUsuario");
  const esAdmin    = rolUsuario === "admin";

  const [ventas, setVentas]       = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [resumen, setResumen]     = useState(null);
  const [loading, setLoading]     = useState(true);

  const [filtroCliente, setFiltroCliente]       = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");

  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState(formInicial);
  const [lineas, setLineas]         = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const cargarDatos = async () => {
    try {
      const [ventasData, clientesData, resumenData] = await Promise.all([
        obtenerVentasPollo(),
        obtenerClientes(),
        obtenerResumenStock(),
      ]);
      setVentas(ventasData);
      setClientes(clientesData.clientes || clientesData);
      setResumen(resumenData);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  // ── Modal ──────────────────────────────────────────────────────────────
  const abrirModal = () => {
    setForm(formInicial);
    setLineas([]);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setForm(formInicial);
    setLineas([]);
  };

  // ── Handlers del formulario ────────────────────────────────────────────
  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleClienteChange = (e) => {
    const clienteId = e.target.value;
    setForm((prev) => ({ ...prev, cliente: clienteId }));
    if (clienteId) {
      const cliente = clientes.find((c) => c._id === clienteId);
      if (cliente?.listaPrecios?.precios?.length) {
        const preciosMapa = {};
        cliente.listaPrecios.precios.forEach((p) => {
          preciosMapa[p.calibre] = p.precioPorCajon;
        });
        setLineas((prev) =>
          prev.map((l) => ({
            ...l,
            precioPorCajon: preciosMapa[l.calibre] ?? l.precioPorCajon ?? 0,
          }))
        );
      }
    }
  };

  // Stock por calibre según cámara seleccionada (de todos los lotes activos)
  const stockCamaraCalibres = useMemo(() => {
    if (!resumen) return null;
    return form.camara === "trigotuc" ? resumen.stockTrigotuc : resumen.stockCañete;
  }, [resumen, form.camara]);

  const preciosPorCalibre = useMemo(() => {
    if (!form.cliente) return null;
    const cliente = clientes.find((c) => c._id === form.cliente);
    if (!cliente?.listaPrecios?.precios?.length) return null;
    const mapa = {};
    cliente.listaPrecios.precios.forEach((p) => { mapa[p.calibre] = p.precioPorCajon; });
    return mapa;
  }, [form.cliente, clientes]);

  // ── Totales ────────────────────────────────────────────────────────────
  const lineasConCajones = lineas.map((l) => {
    const cajones = calcularCajones(l.pollos, l.calibre);
    const precio  = Number(l.precioPorCajon || 0);
    return { ...l, cajones, subtotal: cajones * precio };
  });
  const totalPollos      = lineasConCajones.reduce((acc, l) => acc + Number(l.pollos || 0), 0);
  const totalCajones     = lineasConCajones.reduce((acc, l) => acc + l.cajones, 0);
  const totalKg          = totalCajones * 20;
  const subtotalBruto    = lineasConCajones.reduce((acc, l) => acc + l.subtotal, 0);
  const descuentoPct     = Number(form.descuento || 0);
  const descuentoImporte = subtotalBruto * (descuentoPct / 100);
  const totalVenta       = subtotalBruto - descuentoImporte;

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cliente) { Swal.fire("Error", "Seleccioná un cliente.", "error"); return; }
    const lineasValidas = lineasConCajones.filter((l) => l.cajones > 0);
    if (lineasValidas.length === 0) {
      Swal.fire("Error", "Ingresá al menos un calibre con cajones.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const ventaCreada = await crearVentaPollo({
        fecha:         form.fecha,
        camara:        form.camara || undefined,
        calibres:      lineasValidas.map(({ calibre, pollos, cajones, precioPorCajon }) => ({
          calibre:        Number(calibre),
          pollos:         Number(pollos),
          cajones,
          precioPorCajon: Number(precioPorCajon || 0),
        })),
        descuento:     descuentoPct,
        cliente:       form.cliente,
        observaciones: form.observaciones,
      });
      const camaraLbl = CAMARAS.find((c) => c.value === form.camara)?.label || "";
      const ocNum = ventaCreada?.numeroOrdenCobro ? formatOC(ventaCreada.numeroOrdenCobro) : "";
      Swal.fire(
        "Venta registrada",
        `${ocNum ? ocNum + " · " : ""}${totalCajones} cajones · ${totalKg} kg · ${totalPollos} pollos${camaraLbl ? ` · ${camaraLbl}` : ""}`,
        "success"
      );
      cerrarModal();
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar la venta.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Eliminar ───────────────────────────────────────────────────────────
  const handleEliminar = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar venta?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarVentaPollo(id);
      Swal.fire("Eliminado", "La venta fue eliminada.", "success");
      cargarDatos();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar la venta.", "error");
    }
  };

  // ── Exportar Excel ─────────────────────────────────────────────────────
  const formatOC = (n) => n ? `OC-${String(n).padStart(6, "0")}` : "—";

  const exportarExcel = () => {
    const datos = ventas.map((v) => ({
      "N° OC":       formatOC(v.numeroOrdenCobro),
      Fecha:         formatFecha(v.fecha),
      Cámara:        v.camara || "—",
      Calibres:      v.calibres.map((c) => `Cal.${c.calibre}: ${c.cajones} caj`).join(" | "),
      Pollos:        v.totalPollos,
      Cajones:       v.cajones,
      Kg:            v.pesoTotalKg,
      Cliente:       v.cliente?.razonSocial || "—",
      Descuento:     v.descuento ? `${v.descuento}%` : "—",
      Total:         v.total,
      Usuario:       v.registradoPor?.nombreUsuario || "—",
      Observaciones: v.observaciones || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, `Ventas_Pollo_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ── Ventas filtradas ───────────────────────────────────────────────────
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      if (filtroCliente && v.cliente?._id !== filtroCliente) return false;
      if (filtroFechaDesde && new Date(v.fecha) < new Date(filtroFechaDesde)) return false;
      if (filtroFechaHasta && new Date(v.fecha) > new Date(filtroFechaHasta + "T23:59:59")) return false;
      return true;
    });
  }, [ventas, filtroCliente, filtroFechaDesde, filtroFechaHasta]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const formatARS = (n) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
  const formatNum = (n) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
  const formatFecha = (f) => new Date(f).toLocaleDateString("es-AR");

  const camaraLabel = (camara) => {
    if (camara === "cañete")   return <span className="badge bg-info text-dark">Cañete</span>;
    if (camara === "trigotuc") return <span className="badge bg-primary">Trigotuc</span>;
    return <span className="text-muted">—</span>;
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-cart3 me-2 text-success"></i>
            Ventas de Pollo
          </h1>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-success btn-sm"
              onClick={exportarExcel}
              disabled={ventas.length === 0}
            >
              <i className="bi bi-file-earmark-excel me-1"></i>
              Exportar
            </button>
            <button className="btn btn-success btn-sm" onClick={abrirModal}>
              <i className="bi bi-plus-circle me-1"></i>
              Crear Venta
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-sm-4 col-md-3">
                <label className="form-label form-label-sm mb-1">Cliente</label>
                <select
                  className="form-select form-select-sm"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                >
                  <option value="">Todos</option>
                  {clientes.map((c) => (
                    <option key={c._id} value={c._id}>{c.razonSocial}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-sm-3 col-md-2">
                <label className="form-label form-label-sm mb-1">Desde</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                />
              </div>
              <div className="col-6 col-sm-3 col-md-2">
                <label className="form-label form-label-sm mb-1">Hasta</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={filtroFechaHasta}
                  onChange={(e) => setFiltroFechaHasta(e.target.value)}
                />
              </div>
              <div className="col-12 col-sm-2 col-md-1">
                <button
                  className="btn btn-outline-secondary btn-sm w-100"
                  onClick={() => { setFiltroCliente(""); setFiltroFechaDesde(""); setFiltroFechaHasta(""); }}
                >
                  Limpiar
                </button>
              </div>
              {(filtroCliente || filtroFechaDesde || filtroFechaHasta) && (
                <div className="col-12 col-md-auto">
                  <small className="text-muted">{ventasFiltradas.length} resultado(s)</small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla de ventas */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center p-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            ) : ventasFiltradas.length === 0 ? (
              <p className="text-center text-muted p-4 mb-0">No hay ventas para los filtros seleccionados.</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="d-md-none p-3">
                  {ventasFiltradas.map((v) => (
                    <div key={v._id} className="card border mb-3">
                      <div className="card-body py-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <span className="fw-semibold">{formatFecha(v.fecha)}</span>
                            {v.numeroOrdenCobro && (
                              <span className="badge bg-warning text-dark ms-2">{formatOC(v.numeroOrdenCobro)}</span>
                            )}
                            <div className="mt-1">{camaraLabel(v.camara)}</div>
                          </div>
                          {esAdmin && (
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleEliminar(v._id)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>

                        <div className="d-flex flex-wrap gap-1 mb-2">
                          {v.calibres.map((c, i) => (
                            <span key={i} className="badge bg-secondary">
                              Cal.{c.calibre}: {formatNum(c.cajones)} caj
                            </span>
                          ))}
                        </div>

                        <div className="row g-0 text-center mb-2">
                          <div className="col-4 border-end">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Pollos</div>
                            <div className="fw-semibold small">{formatNum(v.totalPollos)}</div>
                          </div>
                          <div className="col-4 border-end">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Cajones</div>
                            <div className="fw-semibold small">{formatNum(v.cajones)}</div>
                          </div>
                          <div className="col-4">
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>Kg</div>
                            <div className="fw-semibold small">{formatNum(v.pesoTotalKg)}</div>
                          </div>
                        </div>

                        {v.precioPorKg ? (
                          <div className="small text-muted mb-1">{formatARS(v.precioPorKg)}/kg</div>
                        ) : (
                          v.descuento > 0 && (
                            <div className="small text-muted mb-1">
                              Subtotal: {formatARS(v.subtotalBruto)} — Dto {v.descuento}%: −{formatARS(v.descuentoImporte)}
                            </div>
                          )
                        )}

                        <div className="d-flex justify-content-between align-items-center">
                          <strong className="text-success">{formatARS(v.total)}</strong>
                          <div className="text-end">
                            {v.cliente && (
                              <div className="text-muted small">{v.cliente.razonSocial}</div>
                            )}
                            {v.registradoPor && (
                              <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                <i className="bi bi-person me-1"></i>
                                {v.registradoPor.nombreUsuario}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>N° OC</th>
                        <th>Fecha</th>
                        <th>Cámara</th>
                        <th>Calibres</th>
                        <th className="text-end">Pollos</th>
                        <th className="text-end">Cajones</th>
                        <th className="text-end">Kg</th>
                        <th className="text-end">Precio</th>
                        <th className="text-end">Total</th>
                        <th>Cliente</th>
                        <th>Usuario</th>
                        {esAdmin && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {ventasFiltradas.map((v) => (
                        <tr key={v._id}>
                          <td>
                            {v.numeroOrdenCobro
                              ? <span className="badge bg-warning text-dark">{formatOC(v.numeroOrdenCobro)}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>{formatFecha(v.fecha)}</td>
                          <td>{camaraLabel(v.camara)}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              {v.calibres.map((c, i) => (
                                <span key={i} className="badge bg-secondary">
                                  Cal.{c.calibre}: {formatNum(c.cajones)} caj
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="text-end">{formatNum(v.totalPollos)}</td>
                          <td className="text-end">{formatNum(v.cajones)}</td>
                          <td className="text-end">{formatNum(v.pesoTotalKg)}</td>
                          <td className="text-end">
                            {v.precioPorKg ? (
                              <span className="text-muted">{formatARS(v.precioPorKg)}/kg</span>
                            ) : v.descuento > 0 ? (
                              <span className="text-muted small">
                                Dto {v.descuento}%<br />
                                <span className="text-danger">−{formatARS(v.descuentoImporte)}</span>
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-end">
                            <strong>{formatARS(v.total)}</strong>
                          </td>
                          <td>{v.cliente ? v.cliente.razonSocial : "—"}</td>
                          <td className="text-muted small">
                            {v.registradoPor?.nombreUsuario || "—"}
                          </td>
                          {esAdmin && (
                            <td>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleEliminar(v._id)}
                                title="Eliminar"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          )}
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

      {/* ── Modal Crear Venta ── */}
      {showModal && (
        <>
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-fullscreen-sm-down modal-lg modal-dialog-scrollable">
              <div className="modal-content">

                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-cart3 me-2"></i>
                    Nueva Venta
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={cerrarModal}
                    disabled={submitting}
                  ></button>
                </div>

                <div className="modal-body overflow-x-hidden">
                  <form id="form-venta" onSubmit={handleSubmit}>

                    {/* Fila: Fecha · Cámara · Cliente */}
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-sm-6 col-md-3">
                        <label className="form-label">Fecha</label>
                        <input
                          type="date"
                          className="form-control"
                          name="fecha"
                          value={form.fecha}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                      <div className="col-12 col-sm-6 col-md-3">
                        <label className="form-label">Cámara</label>
                        <SelectDropdown
                          value={form.camara}
                          onChange={(v) => setForm((f) => ({ ...f, camara: v }))}
                          options={CAMARAS.map((c) => ({ value: c.value, label: c.label }))}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label">Cliente</label>
                        <SelectDropdown
                          value={form.cliente}
                          onChange={(v) => handleClienteChange({ target: { value: v } })}
                          placeholder="— Seleccionar cliente —"
                          options={clientes.map((c) => ({
                            value: c._id,
                            label: c.razonSocial + (c.listaPrecios ? ` — ${c.listaPrecios.nombre}` : ""),
                          }))}
                        />
                      </div>
                    </div>

                    {/* Calibres */}
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Detalle por calibre</label>
                      <CalibreTable
                        lineas={lineas}
                        onChange={setLineas}
                        showPrecio
                        inputCajones
                        stockCalibres={stockCamaraCalibres}
                        preciosPorCalibre={preciosPorCalibre}
                      />
                    </div>

                    {/* Descuento + Observaciones + Resumen */}
                    <div className="row g-3">
                      <div className="col-6 col-sm-4">
                        <label className="form-label">Descuento (%)</label>
                        <div className="input-group">
                          <input
                            type="number"
                            className="form-control"
                            name="descuento"
                            value={form.descuento}
                            onChange={handleFormChange}
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="0"
                          />
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <div className="col-12 col-sm-8">
                        <label className="form-label">Observaciones</label>
                        <input
                          type="text"
                          className="form-control"
                          name="observaciones"
                          value={form.observaciones}
                          onChange={handleFormChange}
                        />
                      </div>

                      {subtotalBruto > 0 && (
                        <div className="col-12">
                          <div className="alert alert-success py-2 mb-0">
                            <div className="d-flex justify-content-between small text-muted mb-1">
                              <span>Subtotal bruto:</span>
                              <span>{formatARS(subtotalBruto)}</span>
                            </div>
                            {descuentoPct > 0 && (
                              <div className="d-flex justify-content-between small text-muted mb-1">
                                <span>Descuento ({descuentoPct}%):</span>
                                <span className="text-danger">−{formatARS(descuentoImporte)}</span>
                              </div>
                            )}
                            <div className="d-flex justify-content-between fw-bold">
                              <span>Total:</span>
                              <span className="fs-6">{formatARS(totalVenta)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </form>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={cerrarModal}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="form-venta"
                    className="btn btn-success"
                    disabled={submitting}
                  >
                    {submitting && (
                      <span className="spinner-border spinner-border-sm me-1"></span>
                    )}
                    <i className="bi bi-plus-circle me-1"></i>
                    Registrar Venta
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

export default VentasPolloPage;
