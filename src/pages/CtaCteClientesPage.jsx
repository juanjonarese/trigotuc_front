import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerCtaCteClientes, obtenerDetalleCtaCte } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import "../css/Tablas.css";
import * as XLSX from 'xlsx';

const CtaCteClientesPage = () => {
  const navigate = useNavigate();
  const [cuentasCorrientes, setCuentasCorrientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalleCtaCte, setDetalleCtaCte] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("Todas");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  useEffect(() => {
    cargarCtaCte();
  }, []);

  const cargarCtaCte = async () => {
    try {
      setLoading(true);
      const data = await obtenerCtaCteClientes();
      setCuentasCorrientes(data.cuentasCorrientes || []);
      setError("");
    } catch (err) {
      console.error("Error al cargar cuenta corriente:", err);
      setError("Error al cargar las cuentas corrientes");
      setCuentasCorrientes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (clienteId) => {
    try {
      const data = await obtenerDetalleCtaCte(clienteId);
      setDetalleCtaCte(data);
      setShowModal(true);
    } catch (err) {
      console.error("Error al obtener detalle:", err);
      Swal.fire("Error", "No se pudo cargar el detalle de cuenta corriente", "error");
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency", currency: "ARS", minimumFractionDigits: 2,
    }).format(amount);

  const getTipoMedioPagoLabel = (tipo) => {
    const labels = {
      efectivo: "Efectivo",
      cheque: "Cheque",
      echeq: "E-Cheq",
      transferencia: "Transferencia",
    };
    return labels[tipo] || tipo;
  };

  const exportarListadoExcel = () => {
    // Preparar datos para Excel
    const datosExcel = cuentasCorrientes.map(cta => ({
      'Cliente': cta.cliente.razonSocial,
      'CUIT': cta.cliente.cuit,
      'Total Facturas': cta.totalFacturasARS || 0,
      'Total Cobros': cta.totalCobrosARS || 0,
      'Saldo': cta.saldoARS || 0,
    }));

    // Crear libro de trabajo
    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuenta Corriente");

    // Descargar archivo
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Cuenta_Corriente_${fecha}.xlsx`);
  };

  const exportarDetalleExcel = () => {
    if (!detalleCtaCte) return;

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();

    // Preparar datos para exportación
    const exportData = [
      ['DETALLE CUENTA CORRIENTE'],
      [''],
      ['Cliente:', detalleCtaCte.cliente.razonSocial],
      ['Fecha de Exportación:', new Date().toLocaleString('es-AR')],
      [''],
      ['MOVIMIENTOS'],
      [''],
      ['Fecha', 'Tipo', 'Detalle', 'Factura', 'Medios de Pago', 'Debe', 'Haber', 'Saldo']
    ];

    // Agregar movimientos
    if (detalleCtaCte.movimientos && detalleCtaCte.movimientos.length > 0) {
      detalleCtaCte.movimientos.forEach(mov => {
        // Preparar medios de pago si existen
        let mediosPagoTexto = '';
        if (mov.mediosPago && mov.mediosPago.length > 0) {
          mediosPagoTexto = mov.mediosPago
            .map(m => `${getTipoMedioPagoLabel(m.tipo)}: $${m.monto.toFixed(2)}${m.numeroReferencia ? ` (Ref: ${m.numeroReferencia})` : ''}`)
            .join(' | ');
        }

        exportData.push([
          new Date(mov.fecha).toLocaleDateString('es-AR'),
          mov.tipo === 'factura' ? 'Factura' : mov.tipo === 'venta' ? 'Venta' : 'Cobro',
          mov.detalle || '',
          mov.factura || '',
          mediosPagoTexto,
          mov.debe || 0,
          mov.haber || 0,
          mov.saldo || 0
        ]);
      });
    } else {
      exportData.push(['No hay movimientos registrados']);
    }

    // Crear hoja de cálculo
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Cuenta Corriente");

    // Descargar archivo
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Detalle_CtaCte_${detalleCtaCte.cliente.razonSocial}_${fecha}.xlsx`);
  };

  // Filtrar cuentas corrientes
  const cuentasFiltradas = cuentasCorrientes.filter((cta) => {
    const matchSearch = cta.cliente.razonSocial
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchFilter =
      selectedFilter === "Todas" ||
      (selectedFilter === "Con Saldo" && cta.saldo > 0) ||
      (selectedFilter === "Sin Saldo" && cta.saldo <= 0);

    return matchSearch && matchFilter;
  });

  // Paginación
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = cuentasFiltradas.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Resetear página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilter]);

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Cuenta Corriente Clientes</h1>
            <p className="text-muted">Consulta el estado de cuenta de cada cliente</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <button
              className="btn btn-success me-2"
              onClick={exportarListadoExcel}
              disabled={cuentasCorrientes.length === 0}
            >
              <i className="bi bi-file-earmark-excel me-2"></i>
              Exportar a Excel
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

        {/* Search Bar */}
        <div className="row mb-4">
          <div className="col-12 col-md-8 mb-2 mb-md-0">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <select
              className="form-select"
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
            >
              <option>Todas</option>
              <option>Con Saldo</option>
              <option>Sin Saldo</option>
            </select>
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

        {/* Tabla de Cuenta Corriente */}
        {!loading && !error && (
          <div className="card border-0 shadow-sm tabla-sin-movimiento">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="fw-semibold">RAZÓN SOCIAL</th>
                      <th className="fw-semibold">DEBE</th>
                      <th className="fw-semibold">COBROS</th>
                      <th className="fw-semibold">SALDO</th>
                      <th className="fw-semibold">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          No se encontraron cuentas corrientes
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((cta) => (
                        <tr key={cta.cliente._id}>
                          <td>{cta.cliente.razonSocial}</td>
                          <td>{formatCurrency(cta.totalFacturasARS || 0)}</td>
                          <td>{formatCurrency(cta.totalCobrosARS || 0)}</td>
                          <td className={(cta.saldoARS || 0) > 0 ? "text-danger fw-semibold" : ""}>
                            {formatCurrency(cta.saldoARS || 0)}
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-warning text-white"
                              onClick={() => handleVerDetalle(cta.cliente._id)}
                            >
                              <i className="bi bi-eye me-1"></i>
                              Ver Cuenta Corriente
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
              totalItems={cuentasFiltradas.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {/* Modal para ver detalle de cuenta corriente */}
        {showModal && detalleCtaCte && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-fullscreen-sm-down modal-xl modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Detalle Cuenta Corriente - {detalleCtaCte.cliente.razonSocial}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {/* Información del cliente */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <p><strong>Razón Social:</strong> {detalleCtaCte.cliente.razonSocial}</p>
                      <p><strong>CUIT:</strong> {detalleCtaCte.cliente.cuit}</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>Dirección:</strong> {detalleCtaCte.cliente.direccion || '-'}</p>
                      <p><strong>Teléfono:</strong> {detalleCtaCte.cliente.telefono || '-'}</p>
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className="row mb-4">
                    <div className="col-md-12">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="text-center mb-3">Resumen</h6>
                          <div className="row text-center">
                            <div className="col-md-4">
                              <h6>Total Facturas</h6>
                              <h4 className="text-primary">{formatCurrency(detalleCtaCte.resumen.totalFacturasARS || 0)}</h4>
                            </div>
                            <div className="col-md-4">
                              <h6>Total Cobros</h6>
                              <h4 className="text-success">{formatCurrency(detalleCtaCte.resumen.totalCobrosARS || 0)}</h4>
                            </div>
                            <div className="col-md-4">
                              <h6>Saldo Final</h6>
                              <h4 className={(detalleCtaCte.resumen.saldoFinalARS || 0) > 0 ? 'text-danger' : 'text-success'}>
                                {formatCurrency(detalleCtaCte.resumen.saldoFinalARS || 0)}
                              </h4>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Movimientos */}
                  <h6 className="mb-3">Movimientos</h6>
                  <div className="table-responsive mb-4">
                    <table className="table table-sm table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Detalle</th>
                          <th>Factura</th>
                          <th>Debe</th>
                          <th>Haber</th>
                          <th>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!detalleCtaCte.movimientos || detalleCtaCte.movimientos.length === 0) ? (
                          <tr>
                            <td colSpan="7" className="text-center">No hay movimientos</td>
                          </tr>
                        ) : (
                          detalleCtaCte.movimientos.map((mov, index) => (
                            <tr key={index}>
                              <td>{new Date(mov.fecha).toLocaleDateString()}</td>
                              <td>
                                <span className={`badge ${mov.tipo === 'factura' ? 'bg-primary' : mov.tipo === 'venta' ? 'bg-warning text-dark' : 'bg-success'}`}>
                                  {mov.tipo === 'factura' ? 'Factura' : mov.tipo === 'venta' ? 'Venta' : 'Cobro'}
                                </span>
                              </td>
                              <td>
                                {mov.detalle}
                                {mov.mediosPago && mov.mediosPago.length > 0 && (
                                  <div className="small text-muted">
                                    Medios: {mov.mediosPago.map(m => `${getTipoMedioPagoLabel(m.tipo)} ${formatCurrency(m.monto)}`).join(', ')}
                                  </div>
                                )}
                              </td>
                              <td>{mov.factura || '-'}</td>
                              <td className={mov.debe > 0 ? 'text-danger' : ''}>
                                {mov.debe > 0 ? formatCurrency(mov.debe) : '-'}
                              </td>
                              <td className={mov.haber > 0 ? 'text-success' : ''}>
                                {mov.haber > 0 ? formatCurrency(mov.haber) : '-'}
                              </td>
                              <td className="fw-bold">{formatCurrency(mov.saldo)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-success me-2"
                    onClick={exportarDetalleExcel}
                  >
                    <i className="bi bi-file-earmark-excel me-2"></i>
                    Exportar Detalle a Excel
                  </button>
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
      </div>
    </Layout>
  );
};

export default CtaCteClientesPage;
