import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { obtenerClientes, obtenerCobros, eliminarCobro, forzarEliminacionCobro, obtenerCobroPorId, obtenerCheques, eliminarCheque, generarReciboCobro } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import "../css/Tablas.css";
import "../css/ComprobantePago.css";
import { numeroALetras } from "../utils/numeroALetras";
import logo from "../assets/logo_2VER.png";

const CobrosListPage = () => {
  const navigate = useNavigate();
  const [cobros, setCobros] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cobroSeleccionado, setCobroSeleccionado] = useState(null);
  const [chequesAsociados, setChequesAsociados] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;
  const [reciboParaImprimir, setReciboParaImprimir] = useState(null);

  const [filtros, setFiltros] = useState({
    fechaDesde: "",
    fechaHasta: "",
    tipoCobro: "",
    clienteId: "",
  });

  useEffect(() => {
    cargarClientes();
    cargarCobros();
  }, []);

  const cargarClientes = async () => {
    try {
      const data = await obtenerClientes();
      setClientes(data.clientes || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  };

  const cargarCobros = async (filtrosAplicados = {}) => {
    try {
      setLoading(true);
      const data = await obtenerCobros(filtrosAplicados);
      setCobros(data.cobros || []);
      setError("");
    } catch (err) {
      console.error("Error al cargar cobros:", err);
      setError("Error al cargar los cobros");
      setCobros([]);
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
    if (filtros.tipoCobro) filtrosLimpios.tipoCobro = filtros.tipoCobro;
    if (filtros.clienteId) filtrosLimpios.clienteId = filtros.clienteId;

    setCurrentPage(1);
    cargarCobros(filtrosLimpios);
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaDesde: "",
      fechaHasta: "",
      tipoCobro: "",
      clienteId: "",
    });
    setCurrentPage(1);
    cargarCobros();
  };

  // Paginación
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = cobros.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleVerCobro = async (id) => {
    try {
      const data = await obtenerCobroPorId(id);
      setCobroSeleccionado(data.cobro);

      // Cargar cheques asociados al cobro
      const chequesData = await obtenerCheques({ cobroId: id });
      setChequesAsociados(chequesData.cheques || []);

      setShowModal(true);
    } catch (err) {
      console.error("Error al obtener cobro:", err);
      Swal.fire("Error", "No se pudo cargar el cobro", "error");
    }
  };

  const handleEliminarCobro = async (id, clienteNombre) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: `Se eliminará el cobro del cliente ${clienteNombre}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarCobro(id);
        Swal.fire("Eliminado!", "El cobro ha sido eliminado.", "success");
        cargarCobros();
      } catch (err) {
        console.error("Error al eliminar cobro:", err);

        // Si el error es por cheques asociados, preguntar si quiere forzar
        if (err.message && err.message.includes("cheques asociados")) {
          const resultForzar = await Swal.fire({
            icon: "warning",
            title: "Cobro con referencias huérfanas",
            html: `
              <p>${err.message}</p>
              <p><strong>¿Deseas forzar la eliminación?</strong></p>
              <p class="text-muted" style="font-size: 0.9em;">Esto limpiará las referencias de cheques que ya no existen en la base de datos.</p>
            `,
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Sí, forzar eliminación",
            cancelButtonText: "Cancelar",
          });

          if (resultForzar.isConfirmed) {
            try {
              await forzarEliminacionCobro(id);
              Swal.fire({
                icon: "success",
                title: "Eliminado!",
                text: "El cobro ha sido eliminado (referencias limpiadas)",
              });
              cargarCobros();
            } catch (errForzar) {
              console.error("Error al forzar eliminación:", errForzar);
              Swal.fire({
                icon: "error",
                title: "Error",
                text: errForzar.message || "No se pudo forzar la eliminación",
              });
            }
          }
        } else {
          // Error diferente, mostrar mensaje genérico
          Swal.fire({
            icon: "error",
            title: "No se pudo eliminar el cobro",
            text: err.message || "Error desconocido",
          });
        }
      }
    }
  };

  const handleEliminarCheque = async (chequeId, numeroCheque) => {
    const result = await Swal.fire({
      title: "¿Eliminar cheque?",
      text: `Se eliminará el cheque Nro. ${numeroCheque}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarCheque(chequeId);
        Swal.fire({
          icon: "success",
          title: "Eliminado!",
          text: "El cheque ha sido eliminado",
          timer: 2000,
        });

        // Recargar cheques asociados
        if (cobroSeleccionado) {
          const chequesData = await obtenerCheques({ cobroId: cobroSeleccionado._id });
          setChequesAsociados(chequesData.cheques || []);
        }
      } catch (err) {
        console.error("Error al eliminar cheque:", err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: err.message || "No se pudo eliminar el cheque",
        });
      }
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
      retencion: "Retención",
    };
    return labels[tipo] || tipo;
  };

  const getTipoRetencionLabel = (tipo) => {
    const labels = {
      iibb: "IIBB",
      ganancias: "Ganancias",
      iva: "IVA",
      suss: "SUSS",
      otra: "Otra",
    };
    return labels[tipo] || tipo;
  };

  const exportarAExcel = () => {
    // Preparar datos para Excel
    const datosParaExcel = cobros.map((cobro) => {
      // Obtener medios de pago como texto
      const mediosPagoTexto = cobro.mediosPago
        .map((medio) => {
          const tipoLabel = getTipoMedioPagoLabel(medio.tipo);
          const detalleRetencion = medio.tipo === "retencion" && medio.tipoRetencion
            ? ` (${getTipoRetencionLabel(medio.tipoRetencion)})`
            : "";
          return `${tipoLabel}${detalleRetencion}: ${formatCurrency(medio.monto)}`;
        })
        .join("; ");

      return {
        Fecha: new Date(cobro.fecha).toLocaleDateString("es-AR"),
        Cliente: cobro.cliente?.razonSocial || "-",
        CUIT: cobro.cliente?.cuit || "-",
        Factura: `${cobro.factura?.tipoFactura}-${cobro.factura?.numeroFactura || "-"}`,
        "Total Factura": cobro.factura?.total || 0,
        "Monto Cobrado": cobro.montoCobrado,
        "Medios de Pago": mediosPagoTexto,
      };
    });

    // Crear libro de Excel
    const ws = XLSX.utils.json_to_sheet(datosParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cobros");

    // Generar nombre de archivo con fecha
    const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g, "-");
    const nombreArchivo = `cobros_${fecha}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, nombreArchivo);

    Swal.fire({
      icon: "success",
      title: "Exportado",
      text: "Los cobros se han exportado correctamente",
      timer: 2000,
    });
  };

  const handleImprimirRecibo = async (cobroId) => {
    try {
      const data = await generarReciboCobro(cobroId);
      const moneda = data.cobro.factura?.moneda || 'ARS';

      setReciboParaImprimir({
        ...data.cobro,
        numeroReciboFormateado: data.numeroReciboFormateado,
        montoEnLetras: numeroALetras(data.cobro.montoCobrado, moneda),
        moneda: moneda,
      });

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setReciboParaImprimir(null);
        }, 1000);
      }, 300);
    } catch (err) {
      console.error("Error al generar recibo:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "No se pudo generar el recibo",
      });
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    const adjustedDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    return adjustedDate.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <>
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Listado de Cobros</h1>
            <p className="text-muted">Consulta y gestiona los cobros registrados</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <button
              className="btn btn-success me-2"
              onClick={exportarAExcel}
              disabled={cobros.length === 0}
            >
              <i className="bi bi-file-earmark-excel me-2"></i>
              Exportar
            </button>
            <button
              className="btn btn-primary me-2"
              onClick={() => navigate("/cobros/registrar")}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Registrar Cobro
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

                  {/* Tipo de Cobro */}
                  <div className="col-md-2 mb-3">
                    <label htmlFor="tipoCobro" className="form-label">
                      Tipo de Cobro
                    </label>
                    <select
                      className="form-select"
                      id="tipoCobro"
                      name="tipoCobro"
                      value={filtros.tipoCobro}
                      onChange={handleFiltroChange}
                    >
                      <option value="">Todos</option>
                      <option value="total">Total</option>
                      <option value="parcial">Parcial</option>
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

        {/* Tabla de Cobros */}
        {!loading && !error && (
          <div className="card tabla-sin-movimiento">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Factura</th>
                      <th>Monto Cobrado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobros.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          No se encontraron cobros
                        </td>
                      </tr>
                    ) : (
                      currentItems.map((cobro) => (
                        <tr key={cobro._id}>
                          <td>{new Date(cobro.fecha).toLocaleDateString()}</td>
                          <td>{cobro.cliente?.razonSocial || '-'}</td>
                          <td>{cobro.factura?.tipoFactura}-{cobro.factura?.numeroFactura || '-'}</td>
                          <td>{formatCurrency(cobro.montoCobrado, cobro.factura?.moneda || 'ARS')}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary me-1"
                              onClick={() => handleVerCobro(cobro._id)}
                              title="Ver detalle"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-success me-1"
                              onClick={() => handleImprimirRecibo(cobro._id)}
                              title="Imprimir recibo"
                            >
                              <i className="bi bi-printer"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleEliminarCobro(cobro._id, cobro.cliente?.razonSocial)}
                              title="Eliminar"
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
              totalItems={cobros.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {/* Modal para ver detalle de cobro */}
        {showModal && cobroSeleccionado && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-fullscreen-sm-down modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Detalle de Cobro
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {/* Información del cobro */}
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <p><strong>Fecha:</strong> {new Date(cobroSeleccionado.fecha).toLocaleDateString()}</p>
                      <p><strong>Cliente:</strong> {cobroSeleccionado.cliente?.razonSocial || '-'}</p>
                      <p><strong>CUIT:</strong> {cobroSeleccionado.cliente?.cuit || '-'}</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>Factura:</strong> {cobroSeleccionado.factura?.tipoFactura}-{cobroSeleccionado.factura?.numeroFactura || '-'}</p>
                      <p><strong>Total Factura:</strong> {formatCurrency(cobroSeleccionado.factura?.total || 0, cobroSeleccionado.factura?.moneda || 'ARS')}</p>
                      <p>
                        <strong>Tipo de Cobro:</strong>{' '}
                        <span className={`badge ${cobroSeleccionado.tipoCobro === 'total' ? 'bg-success' : 'bg-warning'}`}>
                          {cobroSeleccionado.tipoCobro === 'total' ? 'Total' : 'Parcial'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Tabla de medios de pago */}
                  <h6 className="mb-3">Medios de Pago</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo</th>
                          <th>Detalle</th>
                          <th>Monto</th>
                          <th>Nro. Referencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobroSeleccionado.mediosPago.map((medio, index) => (
                          <tr key={index}>
                            <td>{getTipoMedioPagoLabel(medio.tipo)}</td>
                            <td>
                              {medio.tipo === "retencion" && medio.tipoRetencion
                                ? getTipoRetencionLabel(medio.tipoRetencion)
                                : "-"}
                            </td>
                            <td>{formatCurrency(medio.monto, cobroSeleccionado.factura?.moneda || 'ARS')}</td>
                            <td>{medio.numeroReferencia || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="2" className="text-end"><strong>Total Cobrado:</strong></td>
                          <td colSpan="2"><strong>{formatCurrency(cobroSeleccionado.montoCobrado, cobroSeleccionado.factura?.moneda || 'ARS')}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Cheques asociados */}
                  {chequesAsociados.length > 0 && (
                    <>
                      <h6 className="mb-3 mt-4">Cheques de Terceros Asociados</h6>
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>Nro. Cheque</th>
                              <th>Banco</th>
                              <th>Fecha Vencimiento</th>
                              <th>Monto</th>
                              <th>Estado</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chequesAsociados.map((cheque) => (
                              <tr key={cheque._id}>
                                <td>{cheque.numeroReferencia}</td>
                                <td>{cheque.banco}</td>
                                <td>{new Date(cheque.fechaVencimiento).toLocaleDateString()}</td>
                                <td>{formatCurrency(cheque.monto)}</td>
                                <td>
                                  <span className={`badge ${
                                    cheque.estado === 'cartera' ? 'bg-primary' :
                                    cheque.estado === 'depositado' ? 'bg-success' :
                                    cheque.estado === 'rechazado' ? 'bg-danger' :
                                    'bg-secondary'
                                  }`}>
                                    {cheque.estado}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleEliminarCheque(cheque._id, cheque.numeroReferencia)}
                                    title="Eliminar cheque"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="alert alert-warning mt-2">
                        <i className="bi bi-info-circle me-2"></i>
                        <small>Elimina los cheques asociados antes de eliminar el cobro.</small>
                      </div>
                    </>
                  )}
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
      </div>
    </Layout>

    {/* Recibo de Cobro - Solo visible al imprimir */}
    {reciboParaImprimir && ReactDOM.createPortal(
      <div className="comprobantes-container">
        {/* Primera copia - Para Trigotuc */}
        <div className="comprobante">
          <div className="comprobante-header">
            <img src={logo} alt="Logo Trigotuc" className="comprobante-logo" />
            <h3 className="comprobante-titulo">RECIBO DE COBRO</h3>
            <p className="comprobante-copia">ORIGINAL</p>
          </div>

          <div className="comprobante-body">
            <div className="comprobante-fecha" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Recibo Nro:</strong> {reciboParaImprimir.numeroReciboFormateado}</span>
              <span><strong>Fecha:</strong> {formatDate(reciboParaImprimir.fecha)}</span>
            </div>

            <div className="comprobante-leyenda" style={{ margin: '15px 0', fontSize: '11pt', lineHeight: '1.6' }}>
              <p style={{ margin: 0 }}>
                Recibimos de <strong>{reciboParaImprimir.cliente?.razonSocial || '-'}</strong> la suma de{' '}
                <strong>Pesos</strong>{' '}
                <strong>{formatCurrency(reciboParaImprimir.montoCobrado, reciboParaImprimir.moneda)}</strong>{' '}
                ({reciboParaImprimir.montoEnLetras}), en concepto de cobro de{' '}
                <strong>Factura {reciboParaImprimir.factura?.tipoFactura}-{reciboParaImprimir.factura?.numeroFactura || '-'}</strong>.
              </p>
            </div>

            <div className="comprobante-firma" style={{ marginTop: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
                <div style={{ textAlign: 'center', width: '45%' }}>
                  <div className="firma-linea"></div>
                  <p>Firma</p>
                </div>
                <div style={{ textAlign: 'center', width: '45%' }}>
                  <div className="firma-linea"></div>
                  <p>Aclaración</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Segunda copia - Duplicado */}
        <div className="comprobante">
          <div className="comprobante-header">
            <img src={logo} alt="Logo Trigotuc" className="comprobante-logo" />
            <h3 className="comprobante-titulo">RECIBO DE COBRO</h3>
            <p className="comprobante-copia">DUPLICADO</p>
          </div>

          <div className="comprobante-body">
            <div className="comprobante-fecha" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Recibo Nro:</strong> {reciboParaImprimir.numeroReciboFormateado}</span>
              <span><strong>Fecha:</strong> {formatDate(reciboParaImprimir.fecha)}</span>
            </div>

            <div className="comprobante-leyenda" style={{ margin: '15px 0', fontSize: '11pt', lineHeight: '1.6' }}>
              <p style={{ margin: 0 }}>
                Recibimos de <strong>{reciboParaImprimir.cliente?.razonSocial || '-'}</strong> la suma de{' '}
                <strong>Pesos</strong>{' '}
                <strong>{formatCurrency(reciboParaImprimir.montoCobrado, reciboParaImprimir.moneda)}</strong>{' '}
                ({reciboParaImprimir.montoEnLetras}), en concepto de cobro de{' '}
                <strong>Factura {reciboParaImprimir.factura?.tipoFactura}-{reciboParaImprimir.factura?.numeroFactura || '-'}</strong>.
              </p>
            </div>

            <div className="comprobante-firma" style={{ marginTop: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
                <div style={{ textAlign: 'center', width: '45%' }}>
                  <div className="firma-linea"></div>
                  <p>Firma</p>
                </div>
                <div style={{ textAlign: 'center', width: '45%' }}>
                  <div className="firma-linea"></div>
                  <p>Aclaración</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default CobrosListPage;
