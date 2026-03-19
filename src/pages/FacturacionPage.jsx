import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerClientes, crearFactura, obtenerNumeroFacturaX, obtenerProyectos } from "../services/api";
import Layout from "../components/Layout";
import Swal from "sweetalert2";
import { ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import "../css/Tablas.css";

const FacturacionPage = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchCliente, setSearchCliente] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const dropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    fecha: obtenerFechaHoy(), // Fecha actual por defecto
    tipoFactura: "A",
    numeroFactura: "",
    clienteId: "",
    proyectoId: "",
    observaciones: "",
    fechaCobro: "",
  });

  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({
    cantidad: "",
    descripcion: "",
    precio: "",
  });

  useEffect(() => {
    cargarClientes();
    cargarProyectos();
  }, []);

  // Obtener autonúmero cuando el tipo es Orden de Pago
  useEffect(() => {
    const obtenerNumeroX = async () => {
      if (formData.tipoFactura === 'X') {
        try {
          const data = await obtenerNumeroFacturaX();
          setFormData(prev => ({
            ...prev,
            numeroFactura: data.numeroFactura
          }));
        } catch (err) {
          console.error("Error al obtener número de orden de pago:", err);
        }
      }
    };
    obtenerNumeroX();
  }, [formData.tipoFactura]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const data = await obtenerClientes();
      setClientes(data.clientes || []);
      setError("");
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      setError("Error al cargar los clientes");
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarProyectos = async () => {
    try {
      // Cargar solo proyectos "En curso"
      const data = await obtenerProyectos({ estado: "En curso" });
      setProyectos(data.proyectos || []);
    } catch (err) {
      console.error("Error al cargar proyectos:", err);
      setProyectos([]);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleClienteInputChange = (e) => {
    const value = e.target.value;
    setSearchCliente(value);
    setShowDropdown(true);
    setSelectedCliente(null);
    setFormData({ ...formData, clienteId: "" });
  };

  const handleClienteSelect = (cliente) => {
    setSelectedCliente(cliente);
    setSearchCliente(cliente.razonSocial);
    setFormData({ ...formData, clienteId: cliente._id });
    setShowDropdown(false);
  };

  const handleItemChange = (e) => {
    setCurrentItem({
      ...currentItem,
      [e.target.name]: e.target.value,
    });
  };

  const handleAgregarItem = (e) => {
    e.preventDefault();

    if (!currentItem.cantidad || !currentItem.descripcion || !currentItem.precio) {
      Swal.fire({
        title: "Error",
        text: "Complete todos los campos del item",
        icon: "error",
        confirmButtonColor: "#d33",
      });
      return;
    }

    const cantidad = parseFloat(currentItem.cantidad);
    const precio = parseFloat(currentItem.precio);

    const iva = formData.tipoFactura === 'X' ? 0 : precio * 0.21;
    const subtotal = formData.tipoFactura === 'X' ? cantidad * precio : cantidad * (precio + iva);

    const newItem = {
      id: Date.now(),
      cantidad,
      descripcion: currentItem.descripcion,
      precio,
      iva,
      subtotal,
    };

    setItems([...items, newItem]);
    setCurrentItem({
      cantidad: "",
      descripcion: "",
      precio: "",
    });
  };

  const handleEliminarItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const calcularTotal = () => {
    return items.reduce((total, item) => total + item.subtotal, 0);
  };

  const handleAceptarFactura = async () => {
    // Validar que se haya seleccionado un cliente
    if (!formData.clienteId) {
      Swal.fire({
        title: "Error",
        text: "Debe seleccionar un cliente",
        icon: "error",
        confirmButtonColor: "#d33",
      });
      return;
    }

    // Validar que se haya ingresado el número de factura
    if (!formData.numeroFactura || formData.numeroFactura.trim() === "") {
      Swal.fire({
        title: "Error",
        text: "Debe ingresar el número de factura",
        icon: "error",
        confirmButtonColor: "#d33",
      });
      return;
    }

    // Validar que se haya seleccionado un proyecto
    if (!formData.proyectoId) {
      Swal.fire({
        title: "Error",
        text: "Debe seleccionar una obra/proyecto",
        icon: "error",
        confirmButtonColor: "#d33",
      });
      return;
    }

    // Validar que haya al menos un item
    if (items.length === 0) {
      Swal.fire({
        title: "Error",
        text: "Debe agregar al menos un item a la factura",
        icon: "error",
        confirmButtonColor: "#d33",
      });
      return;
    }

    try {
      // Si es Nota de Crédito, el total debe ser negativo
      const totalCalculado = calcularTotal();
      const totalFinal = formData.tipoFactura === 'NC' ? -Math.abs(totalCalculado) : totalCalculado;

      const facturaData = {
        fecha: ajustarFechaParaGuardar(formData.fecha),
        tipoFactura: formData.tipoFactura,
        numeroFactura: formData.numeroFactura,
        cliente: formData.clienteId,
        proyecto: formData.proyectoId,
        items,
        total: totalFinal,
        observaciones: formData.observaciones,
        fechaCobro: formData.fechaCobro ? ajustarFechaParaGuardar(formData.fechaCobro) : null,
        moneda: "ARS",
      };

      await crearFactura(facturaData);

      await Swal.fire({
        title: "¡Éxito!",
        text: "Factura creada correctamente",
        icon: "success",
        confirmButtonColor: "#198754",
      });

      // Redirigir al listado de facturas
      navigate("/facturacion");
    } catch (err) {
      console.error("Error al crear factura:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "Error al crear la factura",
        icon: "error",
        confirmButtonColor: "#d33",
      });
    }
  };

  // Filtrar clientes según búsqueda
  const clientesFiltrados = clientes.filter((cliente) =>
    cliente.razonSocial?.toLowerCase().includes(searchCliente.toLowerCase()) ||
    cliente.cuit?.includes(searchCliente)
  );

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Crear Factura</h1>
            <p className="text-muted">Cargar nueva factura</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/facturacion")}
            >
              <i className="bi bi-arrow-left me-2"></i>
              Volver al Listado
            </button>
          </div>
        </div>

        {/* Formulario de cabecera */}
        <div className="row">
          <div className="col-12">
            <div className="card tabla-sin-movimiento">
              <div className="card-body">
                <div className="row align-items-end">
                    {/* Fecha */}
                    <div className="col-md-2 mb-3">
                      <label htmlFor="fecha" className="form-label">
                        Fecha <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        id="fecha"
                        name="fecha"
                        value={formData.fecha}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    {/* Tipo de Factura */}
                    <div className={`col-md-2 mb-3`}>
                      <label htmlFor="tipoFactura" className="form-label">
                        Tipo <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        id="tipoFactura"
                        name="tipoFactura"
                        value={formData.tipoFactura}
                        onChange={(e) => {
                          const nuevoTipo = e.target.value;
                          setFormData({
                            ...formData,
                            tipoFactura: nuevoTipo,
                            numeroFactura: nuevoTipo === 'X' ? '' : ''
                          });
                        }}
                        required
                      >
                        <option value="A">Factura A</option>
                        <option value="B">Factura B</option>
                        <option value="FCE">FCE - Factura de Crédito Electrónica</option>
                        <option value="NC">NC - Nota de Crédito</option>
                        <option value="ND">ND - Nota de Débito</option>
                        <option value="X">Orden de Pago</option>
                      </select>
                    </div>

                    {/* Número de Factura */}
                    <div className="col-md-3 mb-3">
                      <label htmlFor="numeroFactura" className="form-label">
                        Nro <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="numeroFactura"
                        name="numeroFactura"
                        value={formData.numeroFactura}
                        onChange={handleChange}
                        placeholder="0001-00000001"
                        required
                        readOnly={formData.tipoFactura === 'X'}
                        disabled={formData.tipoFactura === 'X'}
                      />
                    </div>

                    {/* Cliente con Dropdown */}
                    <div className="col-md-3 mb-3" ref={dropdownRef}>
                      <label htmlFor="cliente" className="form-label">
                        Cliente <span className="text-danger">*</span>
                      </label>
                      <div className="position-relative">
                        <input
                          type="text"
                          className="form-control"
                          id="cliente"
                          placeholder="Cliente"
                          value={searchCliente}
                          onChange={handleClienteInputChange}
                          onFocus={() => setShowDropdown(true)}
                          autoComplete="off"
                          required
                        />
                        {showDropdown && (
                          <div
                            className="position-absolute w-100 bg-white border rounded shadow-sm"
                            style={{
                              maxHeight: "200px",
                              overflowY: "auto",
                              zIndex: 1000,
                              top: "100%",
                              marginTop: "2px",
                            }}
                          >
                            {loading ? (
                              <div className="px-3 py-2 text-muted">
                                Cargando clientes...
                              </div>
                            ) : clientesFiltrados.length === 0 ? (
                              <div className="px-3 py-2 text-muted">
                                No se encontraron clientes
                              </div>
                            ) : (
                              clientesFiltrados.map((cliente) => (
                                <div
                                  key={cliente._id}
                                  className="px-3 py-2 cursor-pointer hover-bg-light"
                                  style={{ cursor: "pointer" }}
                                  onClick={() => handleClienteSelect(cliente)}
                                  onMouseEnter={(e) =>
                                    (e.target.style.backgroundColor = "#f8f9fa")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.target.style.backgroundColor = "white")
                                  }
                                >
                                  <div className="fw-semibold">
                                    {cliente.razonSocial}
                                  </div>
                                  <small className="text-muted">
                                    {cliente.cuit}
                                  </small>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Observaciones */}
                    <div className="col-md-12 mb-3">
                      <label htmlFor="observaciones" className="form-label">
                        Observaciones
                      </label>
                      <textarea
                        className="form-control"
                        id="observaciones"
                        name="observaciones"
                        value={formData.observaciones}
                        onChange={handleChange}
                        placeholder="Observaciones adicionales (opcional)"
                        rows="2"
                      />
                    </div>

                    {/* Proyecto/Obra */}
                    <div className="col-md-6 mb-3">
                      <label htmlFor="proyectoId" className="form-label">
                        Proyecto/Obra <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        id="proyectoId"
                        name="proyectoId"
                        value={formData.proyectoId}
                        onChange={(e) => setFormData({ ...formData, proyectoId: e.target.value })}
                        required
                      >
                        <option value="">Seleccione...</option>
                        {proyectos.map((proyecto) => (
                          <option key={proyecto._id} value={proyecto._id}>
                            {proyecto.nombre} - {proyecto.cliente?.razonSocial}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted">Obra a la que pertenece</small>
                    </div>

                    {/* Fecha de Cobro */}
                    <div className="col-md-6 mb-3">
                      <label htmlFor="fechaCobro" className="form-label">
                        Fecha de Cobro
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        id="fechaCobro"
                        name="fechaCobro"
                        value={formData.fechaCobro}
                        onChange={handleChange}
                      />
                      <small className="text-muted">Fecha estimada o real de cobro (opcional)</small>
                    </div>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario de items - Solo se muestra si hay cliente seleccionado */}
        {formData.clienteId && (
          <>
            <div className="row mt-3">
              <div className="col-12">
                <div className="card tabla-sin-movimiento">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Agregar Items</h5>
                    <form onSubmit={handleAgregarItem}>
                      <div className="row align-items-end">
                        {/* Cantidad */}
                        <div className="col-md-1 mb-3">
                          <label htmlFor="cantidad" className="form-label">
                            Cant. <span className="text-danger">*</span>
                          </label>
                          <input
                            type="number"
                            className="form-control"
                            id="cantidad"
                            name="cantidad"
                            value={currentItem.cantidad}
                            onChange={handleItemChange}
                            min="1"
                            step="1"
                          />
                        </div>

                        {/* Descripción */}
                        <div className="col-md-4 mb-3">
                          <label htmlFor="descripcion" className="form-label">
                            Descripción <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            id="descripcion"
                            name="descripcion"
                            value={currentItem.descripcion}
                            onChange={handleItemChange}
                            placeholder="Descripción del producto/servicio"
                          />
                        </div>

                        {/* Precio */}
                        <div className="col-md-2 mb-3">
                          <label htmlFor="precio" className="form-label">
                            Precio <span className="text-danger">*</span>
                          </label>
                          <div className="input-group">
                            <span className="input-group-text">$</span>
                            <input
                              type="number"
                              className="form-control"
                              id="precio"
                              name="precio"
                              value={currentItem.precio}
                              onChange={handleItemChange}
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>

                        {/* IVA */}
                        <div className="col-md-2 mb-3">
                          <label className="form-label">
                            {formData.tipoFactura === 'X' ? 'IVA (0%)' : 'IVA (21%)'}
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={
                              formData.tipoFactura === 'X'
                                ? '$0.00'
                                : currentItem.precio
                                  ? `$${(parseFloat(currentItem.precio) * 0.21).toFixed(2)}`
                                  : '$0.00'
                            }
                            readOnly
                            disabled
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="col-md-2 mb-3">
                          <label className="form-label">
                            Subtotal
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={
                              currentItem.cantidad && currentItem.precio
                                ? formData.tipoFactura === 'X'
                                  ? `$${(parseFloat(currentItem.cantidad) * parseFloat(currentItem.precio)).toFixed(2)}`
                                  : `$${(parseFloat(currentItem.cantidad) * (parseFloat(currentItem.precio) + parseFloat(currentItem.precio) * 0.21)).toFixed(2)}`
                                : '$0.00'
                            }
                            readOnly
                            disabled
                          />
                        </div>

                        {/* Botón Agregar Item */}
                        <div className="col-md-2 mb-3">
                          <button type="submit" className="btn btn-primary w-100">
                            <i className="bi bi-plus-circle me-2"></i>
                            Agregar Item
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla de items */}
            {items.length > 0 && (
              <div className="row mt-3">
                <div className="col-12">
                  <div className="card tabla-sin-movimiento">
                    <div className="card-body">
                      <h5 className="card-title mb-3">Items de la Factura</h5>
                      <div className="table-responsive">
                        <table className="table">
                          <thead className="table-light">
                            <tr>
                              <th>Cantidad</th>
                              <th>Descripción</th>
                              <th>Precio</th>
                              <th>IVA</th>
                              <th>Subtotal</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.id}>
                                <td>{item.cantidad}</td>
                                <td>{item.descripcion}</td>
                                <td>${item.precio.toFixed(2)}</td>
                                <td>${item.iva.toFixed(2)}</td>
                                <td>${item.subtotal.toFixed(2)}</td>
                                <td>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleEliminarItem(item.id)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="table-secondary fw-bold">
                              <td colSpan="4" className="text-end">
                                TOTAL {formData.tipoFactura === 'NC' ? 'NOTA DE CRÉDITO' : 'FACTURA'}:
                              </td>
                              <td className={formData.tipoFactura === 'NC' ? 'text-danger' : ''}>
                                ${formData.tipoFactura === 'NC' ? '-' : ''}{calcularTotal().toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                            {formData.tipoFactura === 'NC' && (
                              <tr>
                                <td colSpan="6" className="text-danger text-center">
                                  <small><i className="bi bi-exclamation-triangle me-1"></i>
                                  La Nota de Crédito reducirá los ingresos del proyecto</small>
                                </td>
                              </tr>
                            )}
                          </tfoot>
                        </table>
                      </div>

                      {/* Botón Aceptar */}
                      <div className="row mt-3">
                        <div className="col-12">
                          <button
                            className="btn btn-success"
                            onClick={handleAceptarFactura}
                          >
                            <i className="bi bi-check-circle me-2"></i>
                            Aceptar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Mensaje de error */}
        {error && (
          <div className="row mt-3">
            <div className="col-12 col-lg-8 col-xl-6">
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FacturacionPage;
