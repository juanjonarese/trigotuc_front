import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerClientes, obtenerFacturas, eliminarFactura, obtenerFacturaPorId, obtenerResumenIvaVentas } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import "../css/Tablas.css";

const FacturasListPage = () => {
  const navigate = useNavigate();
  const [facturas, setFacturas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [filtros, setFiltros] = useState({
    fechaDesde: "",
    fechaHasta: "",
    tipoFactura: "",
    clienteId: "",
  });

  // Estados para modal de IVA
  const [showModalIva, setShowModalIva] = useState(false);
  const [resumenIva, setResumenIva] = useState(null);
  const [filtrosIva, setFiltrosIva] = useState({
    fechaDesde: "",
    fechaHasta: "",
  });

  useEffect(() => {
    cargarClientes();
    cargarFacturas();
  }, []);

  const cargarClientes = async () => {
    try {
      const data = await obtenerClientes();
      setClientes(data.clientes || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  };

  const cargarFacturas = async (filtrosAplicados = {}) => {
    try {
      setLoading(true);
      const data = await obtenerFacturas(filtrosAplicados);
      setFacturas(data.facturas || []);
      setError("");
    } catch (err) {
      console.error("Error al cargar facturas:", err);
      setError("Error al cargar las facturas");
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (e) => {
    setFiltros({
      ...filtros,
      [e.target.name]: e.target.value,
    });
  };

  const aplicarFiltros = () => {
    const filtrosLimpios = {};
    if (filtros.fechaDesde) filtrosLimpios.fechaDesde = filtros.fechaDesde;
    if (filtros.fechaHasta) filtrosLimpios.fechaHasta = filtros.fechaHasta;
    if (filtros.tipoFactura) filtrosLimpios.tipoFactura = filtros.tipoFactura;
    if (filtros.clienteId) filtrosLimpios.clienteId = filtros.clienteId;

    setCurrentPage(1);
    cargarFacturas(filtrosLimpios);
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaDesde: "",
      fechaHasta: "",
      tipoFactura: "",
      clienteId: "",
    });
    setCurrentPage(1);
    cargarFacturas();
  };

  // Paginación
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = facturas.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleVerFactura = async (id) => {
    try {
      const data = await obtenerFacturaPorId(id);
      setFacturaSeleccionada(data.factura);
      setShowModal(true);
    } catch (err) {
      console.error("Error al obtener factura:", err);
      Swal.fire("Error", "No se pudo cargar la factura", "error");
    }
  };

  const handleEliminarFactura = async (id, numeroFactura) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: `Se eliminará la factura ${numeroFactura}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarFactura(id);
        Swal.fire("Eliminado!", "La factura ha sido eliminada.", "success");
        cargarFacturas();
      } catch (err) {
        console.error("Error al eliminar factura:", err);
        Swal.fire("Error", err.message || "No se pudo eliminar la factura", "error");
      }
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency", currency: "ARS", minimumFractionDigits: 2,
    }).format(amount);

  const exportarAExcel = () => {
    if (facturas.length === 0) {
      Swal.fire("Sin datos", "No hay facturas para exportar", "info");
      return;
    }

    // Preparar datos para exportar
    const datosExcel = facturas.map((factura) => {
      // Calcular subtotal sin IVA (suma de precio * cantidad de todos los items)
      const subtotalSinIva = factura.items?.reduce((sum, item) => {
        return sum + (item.precio * item.cantidad);
      }, 0) || 0;

      // Calcular IVA total (suma de IVA * cantidad de todos los items)
      const ivaTotal = factura.items?.reduce((sum, item) => {
        return sum + (item.iva * item.cantidad);
      }, 0) || 0;

      return {
        Fecha: new Date(factura.fecha).toLocaleDateString("es-AR"),
        Tipo: `Factura ${factura.tipoFactura}`,
        Número: factura.numeroFactura,
        Cliente: factura.cliente?.razonSocial || "-",
        CUIT: factura.cliente?.cuit || "-",
        "Subtotal (sin IVA)": subtotalSinIva,
        IVA: ivaTotal,
        Total: factura.total,
      };
    });

    // Crear hoja de trabajo
    const ws = XLSX.utils.json_to_sheet(datosExcel);

    // Configurar anchos de columna
    const columnWidths = [
      { wch: 12 }, // Fecha
      { wch: 15 }, // Tipo
      { wch: 18 }, // Número
      { wch: 35 }, // Cliente
      { wch: 15 }, // CUIT
      { wch: 10 }, // Moneda
      { wch: 18 }, // Subtotal
      { wch: 15 }, // IVA
      { wch: 15 }, // Total
    ];
    ws["!cols"] = columnWidths;

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturas Ventas");

    // Generar nombre de archivo con fecha
    const fecha = new Date().toISOString().split("T")[0];
    const nombreArchivo = `facturas_ventas_${fecha}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, nombreArchivo);

    Swal.fire("Éxito", "Facturas exportadas correctamente", "success");
  };

  const handleVerResumenIva = async () => {
    try {
      const data = await obtenerResumenIvaVentas(filtrosIva.fechaDesde, filtrosIva.fechaHasta);
      setResumenIva(data);
      setShowModalIva(true);
    } catch (err) {
      console.error("Error al obtener resumen de IVA:", err);
      Swal.fire("Error", "No se pudo cargar el resumen de IVA", "error");
    }
  };

  const exportarIvaExcel = () => {
    if (!resumenIva) return;

    const wb = XLSX.utils.book_new();

    // Detalle de Facturas (única hoja)
    const detalleData = [
      [
        'Fecha',
        'Tipo',
        'Número',
        'Cliente',
        'CUIT',
        'Subtotal sin IVA (ARS)',
        'IVA (ARS)',
        'Total (ARS)'
      ]
    ];

    if (resumenIva.detalle && resumenIva.detalle.length > 0) {
      resumenIva.detalle.forEach(item => {
        detalleData.push([
          new Date(item.fecha).toLocaleDateString('es-AR'),
          item.tipoFactura,
          item.numeroFactura,
          item.cliente?.razonSocial || 'N/A',
          item.cliente?.cuit || 'N/A',
              item.subtotalSinIvaARS || 0,
          item.ivaARS || 0,
          item.totalARS || 0
        ]);
      });
    }

    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
    XLSX.utils.book_append_sheet(wb, wsDetalle, "IVA Ventas");

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `IVA_Ventas_${fecha}.xlsx`);
  };

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Listado de Facturas</h1>
            <p className="text-muted">Consulta y gestiona las facturas emitidas</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <button
              className="btn btn-primary me-2"
              onClick={() => navigate("/facturacion/crear")}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Crear Factura
            </button>
            <button
              className="btn btn-info me-2 text-white"
              onClick={handleVerResumenIva}
            >
              <i className="bi bi-calculator me-2"></i>
              IVA Venta
            </button>
            <button
              className="btn btn-success me-2"
              onClick={exportarAExcel}
            >
              <i className="bi bi-file-earmark-excel me-2"></i>
              Exportar
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/dashboard")}
            >
              <i className="bi bi-arrow-left me-2"></i>
              Volver
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card tabla-sin-movimiento">
              <div className="card-body">
                <h5 className="card-title mb-3">Filtros</h5>
                <div className="row align-items-end">
                  {/* Fecha Desde */}
                  <div className="col-md-2 mb-3">
                    <label htmlFor="fechaDesde" className="form-label">
                      Fecha Desde
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      id="fechaDesde"
                      name="fechaDesde"
                      value={filtros.fechaDesde}
                      onChange={handleFiltroChange}
                    />
                  </div>

                  {/* Fecha Hasta */}
                  <div className="col-md-2 mb-3">
                    <label htmlFor="fechaHasta" className="form-label">
                      Fecha Hasta
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      id="fechaHasta"
                      name="fechaHasta"
                      value={filtros.fechaHasta}
                      onChange={handleFiltroChange}
                    />
                  </div>

                  {/* Tipo de Factura */}
                  <div className="col-md-2 mb-3">
                    <label htmlFor="tipoFactura" className="form-label">
                      Tipo de Factura
                    </label>
                    <select
                      className="form-select"
                      id="tipoFactura"
                      name="tipoFactura"
                      value={filtros.tipoFactura}
                      onChange={handleFiltroChange}
                    >
                      <option value="">Todas</option>
                      <option value="A">Factura A</option>
                      <option value="B">Factura B</option>
                      <option value="FCE">FCE - Factura de Crédito Electrónica</option>
                      <option value="NC">NC - Nota de Crédito</option>
                      <option value="ND">ND - Nota de Débito</option>
                      <option value="X">Orden de Pago</option>
                    </select>
                  </div>

                  {/* Cliente */}
                  <div className="col-md-3 mb-3">
                    <label htmlFor="clienteId" className="form-label">
                      Cliente
                    </label>
                    <select
                      className="form-select"
                      id="clienteId"
                      name="clienteId"
                      value={filtros.clienteId}
                      onChange={handleFiltroChange}
                    >
                      <option value="">Todos los clientes</option>
                      {clientes.map((cliente) => (
                        <option key={cliente._id} value={cliente._id}>
                          {cliente.razonSocial}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botones */}
                  <div className="col-md-3 mb-3">
                    <button
                      className="btn btn-primary me-2"
                      onClick={aplicarFiltros}
                    >
                      <i className="bi bi-search me-2"></i>
                      Buscar
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      onClick={limpiarFiltros}
                    >
                      <i className="bi bi-x-circle me-2"></i>
                      Limpiar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading/Error */}
        {loading && (
          <div className="d-flex justify-content-center align-items-center my-5">
            <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {/* Tabla de Facturas */}
        {!loading && !error && (
          <div className="card tabla-sin-movimiento">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Número</th>
                      <th>Cliente</th>
                      <th>Moneda</th>
                      <th>Total</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          No se encontraron facturas
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((factura) => (
                        <tr key={factura._id}>
                          <td>{new Date(factura.fecha).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${
                              factura.tipoFactura === 'A' ? 'bg-primary' :
                              factura.tipoFactura === 'B' ? 'bg-info' :
                              factura.tipoFactura === 'FCE' ? 'bg-success' :
                              factura.tipoFactura === 'NC' ? 'bg-danger' :
                              factura.tipoFactura === 'ND' ? 'bg-warning text-dark' :
                              'bg-secondary'
                            }`}>
                              {factura.tipoFactura === 'X' ? 'Orden de Pago' :
                               factura.tipoFactura === 'FCE' ? 'FCE' :
                               factura.tipoFactura === 'NC' ? 'Nota de Crédito' :
                               factura.tipoFactura === 'ND' ? 'Nota de Débito' :
                               `Factura ${factura.tipoFactura}`}
                            </span>
                          </td>
                          <td>{factura.numeroFactura}</td>
                          <td>{factura.cliente?.razonSocial || '-'}</td>
                          <td>{formatCurrency(factura.total)}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary me-2"
                              onClick={() => handleVerFactura(factura._id)}
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleEliminarFactura(factura._id, factura.numeroFactura)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={facturas.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {/* Modal para ver detalle de factura */}
        {showModal && facturaSeleccionada && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-fullscreen-sm-down modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Factura {facturaSeleccionada.tipoFactura} - {facturaSeleccionada.numeroFactura}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {/* Información de la factura */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <p><strong>Fecha:</strong> {new Date(facturaSeleccionada.fecha).toLocaleDateString()}</p>
                      <p><strong>Tipo:</strong> Factura {facturaSeleccionada.tipoFactura}</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>Cliente:</strong> {facturaSeleccionada.cliente?.razonSocial || '-'}</p>
                      <p><strong>CUIT:</strong> {facturaSeleccionada.cliente?.cuit || '-'}</p>
                    </div>
                    {facturaSeleccionada.observaciones && (
                      <div className="col-12 mt-2">
                        <p><strong>Observaciones:</strong> {facturaSeleccionada.observaciones}</p>
                      </div>
                    )}
                    {facturaSeleccionada.fechaCobro && (
                      <div className="col-12 mt-2">
                        <p><strong>Fecha de Cobro:</strong> {new Date(facturaSeleccionada.fechaCobro).toLocaleDateString('es-AR')}</p>
                      </div>
                    )}
                  </div>

                  {/* Tabla de items */}
                  <h6 className="mb-3">Detalle de Items</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>Cantidad</th>
                          <th>Descripción</th>
                          <th>Precio</th>
                          <th>IVA</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facturaSeleccionada.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.cantidad}</td>
                            <td>{item.descripcion}</td>
                            <td>{formatCurrency(item.precio, facturaSeleccionada.moneda || 'ARS')}</td>
                            <td>{formatCurrency(item.iva, facturaSeleccionada.moneda || 'ARS')}</td>
                            <td>{formatCurrency(item.subtotal, facturaSeleccionada.moneda || 'ARS')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4" className="text-end"><strong>Total:</strong></td>
                          <td><strong>{formatCurrency(facturaSeleccionada.total, facturaSeleccionada.moneda || 'ARS')}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para resumen de IVA */}
        {showModalIva && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Resumen IVA Ventas</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModalIva(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {/* Filtros de fecha */}
                  <div className="row mb-4">
                    <div className="col-md-4">
                      <label htmlFor="fechaDesde" className="form-label">Fecha Desde</label>
                      <input
                        type="date"
                        className="form-control"
                        id="fechaDesde"
                        value={filtrosIva.fechaDesde}
                        onChange={(e) => setFiltrosIva({ ...filtrosIva, fechaDesde: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="fechaHasta" className="form-label">Fecha Hasta</label>
                      <input
                        type="date"
                        className="form-control"
                        id="fechaHasta"
                        value={filtrosIva.fechaHasta}
                        onChange={(e) => setFiltrosIva({ ...filtrosIva, fechaHasta: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4 d-flex align-items-end">
                      <button className="btn btn-primary w-100" onClick={handleVerResumenIva}>
                        <i className="bi bi-search me-2"></i>
                        Buscar
                      </button>
                    </div>
                  </div>

                  {/* Resumen */}
                  {resumenIva && (
                    <>
                      <div className="row mb-4">
                        <div className="col-12">
                          <div className="card bg-light">
                            <div className="card-body">
                              <h6 className="text-center mb-3">Resumen General</h6>
                              <div className="row text-center">
                                <div className="col-md-6">
                                  <h6>Total IVA</h6>
                                  <h3 className="text-primary">{formatCurrency(resumenIva.totalIvaARS || 0)}</h3>
                                </div>
                                <div className="col-md-6">
                                  <h6>Cantidad de Facturas</h6>
                                  <h3 className="text-success">{resumenIva.cantidadFacturas || 0}</h3>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detalle */}
                      <h6 className="mb-3">Detalle por Factura</h6>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Fecha</th>
                              <th>Tipo</th>
                              <th>Número</th>
                              <th>Cliente</th>
                              <th>CUIT</th>
                              <th>Moneda</th>
                              <th>Cotiz.</th>
                              <th>Subtotal s/IVA</th>
                              <th>IVA</th>
                              <th>Total</th>
                              <th>F. Cobro</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumenIva.detalle && resumenIva.detalle.length > 0 ? (
                              resumenIva.detalle.map((item, index) => (
                                <tr key={index}>
                                  <td style={{whiteSpace: 'nowrap'}}>{new Date(item.fecha).toLocaleDateString('es-AR')}</td>
                                  <td>
                                    <span className={`badge ${item.tipoFactura === 'NC' ? 'bg-danger' : 'bg-primary'}`}>
                                      {item.tipoFactura}
                                    </span>
                                  </td>
                                  <td style={{whiteSpace: 'nowrap'}}>{item.numeroFactura}</td>
                                  <td style={{minWidth: '200px'}}>{item.cliente?.razonSocial || 'N/A'}</td>
                                  <td style={{whiteSpace: 'nowrap'}}>{item.cliente?.cuit || 'N/A'}</td>
                                  <td className={item.subtotalSinIvaARS < 0 ? 'text-danger' : ''}>
                                    {formatCurrency(item.subtotalSinIvaARS)}
                                  </td>
                                  <td className={item.ivaARS < 0 ? 'text-danger' : ''}>
                                    {formatCurrency(item.ivaARS)}
                                  </td>
                                  <td className={item.totalARS < 0 ? 'text-danger' : ''}>
                                    {formatCurrency(item.totalARS)}
                                  </td>
                                  <td style={{whiteSpace: 'nowrap'}}>
                                    {item.fechaCobro ? new Date(item.fechaCobro).toLocaleDateString('es-AR') : '-'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="11" className="text-center">No hay facturas en el período seleccionado</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-success me-2"
                    onClick={exportarIvaExcel}
                    disabled={!resumenIva}
                  >
                    <i className="bi bi-file-earmark-excel me-2"></i>
                    Exportar a Excel
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModalIva(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FacturasListPage;
