import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerClientes, crearCliente, actualizarCliente, eliminarCliente, obtenerListasPrecios } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import "../css/Tablas.css";

const ClientesPage = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [listasPrecios, setListasPrecios] = useState([]);
  const ITEMS_PER_PAGE = 30;

  const [formData, setFormData] = useState({
    razonSocial: "",
    cuit: "",
    direccion: "",
    contacto: "",
    telefono: "",
    email: "",
    listaPrecios: "",
  });

  useEffect(() => {
    cargarClientes();
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

  const handleOpenModal = async (cliente = null) => {
    // Cargar listas de precios al abrir modal
    try {
      const data = await obtenerListasPrecios();
      setListasPrecios((data.listas || []).filter((l) => l.activa));
    } catch {
      setListasPrecios([]);
    }

    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        razonSocial: cliente.razonSocial,
        cuit: cliente.cuit,
        direccion: cliente.direccion || "",
        contacto: cliente.contacto || "",
        telefono: cliente.telefono || "",
        email: cliente.email || "",
        listaPrecios: cliente.listaPrecios?._id || cliente.listaPrecios || "",
      });
    } else {
      setEditingCliente(null);
      setFormData({
        razonSocial: "",
        cuit: "",
        direccion: "",
        contacto: "",
        telefono: "",
        email: "",
        listaPrecios: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCliente(null);
    setFormData({
      razonSocial: "",
      cuit: "",
      direccion: "",
      contacto: "",
      telefono: "",
      email: "",
      listaPrecios: "",
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCliente) {
        await actualizarCliente(editingCliente._id, formData);
      } else {
        await crearCliente(formData);
      }
      await cargarClientes();
      handleCloseModal();
      Swal.fire({
        title: editingCliente ? "¡Actualizado!" : "¡Creado!",
        text: `Cliente ${editingCliente ? "actualizado" : "creado"} correctamente`,
        icon: "success",
        confirmButtonColor: "#198754",
      });
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "Error al guardar el cliente",
        icon: "error",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleDelete = async (id, razonSocial) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      html: `Vas a eliminar al cliente:<br/><strong>${razonSocial}</strong>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarCliente(id);
        await cargarClientes();
        Swal.fire({
          title: "¡Eliminado!",
          text: `${razonSocial} ha sido eliminado correctamente`,
          icon: "success",
          confirmButtonColor: "#198754",
        });
      } catch (err) {
        console.error("Error al eliminar cliente:", err);
        Swal.fire({
          title: "Error",
          text: err.message || "Error al eliminar el cliente",
          icon: "error",
          confirmButtonColor: "#d33",
        });
      }
    }
  };

  const clientesFiltrados = clientes.filter((cliente) =>
    cliente.razonSocial?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = clientesFiltrados.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Resetear página cuando cambie la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Gestión de Clientes</h1>
            <p className="text-muted">Administra la información de tus clientes</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <button
              className="btn btn-primary me-2"
              onClick={() => handleOpenModal()}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Crear Cliente
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

      {/* Search */}
      <div className="row mb-4">
        <div className="col-12 col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por razón social..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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

      {/* Table */}
      {!loading && !error && (
        <div className="card border-0 tabla-sin-movimiento">
          <div className="card-body p-0">

            {clientesFiltrados.length === 0 ? (
              <p className="text-center text-muted py-4 mb-0">No se encontraron clientes</p>
            ) : (
              <>
                {/* Mobile: cards */}
                <div className="d-md-none p-3">
                  {currentItems.map((cliente) => (
                    <div key={cliente._id} className="card border mb-3">
                      <div className="card-body py-3">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <span className="fw-semibold">{cliente.razonSocial}</span>
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => handleOpenModal(cliente)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(cliente._id, cliente.razonSocial)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                        <small className="text-muted d-block">CUIT: {cliente.cuit}</small>
                        {cliente.contacto && <small className="text-muted d-block">Contacto: {cliente.contacto}</small>}
                        {cliente.telefono && <small className="text-muted d-block">Tel: {cliente.telefono}</small>}
                        {cliente.email && <small className="text-muted d-block">Email: {cliente.email}</small>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: tabla */}
                <div className="d-none d-md-block">
                  <table className="table mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Razón Social</th>
                        <th>CUIT</th>
                        <th>Contacto</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((cliente) => (
                        <tr key={cliente._id}>
                          <td>{cliente.razonSocial}</td>
                          <td>{cliente.cuit}</td>
                          <td>{cliente.contacto || "-"}</td>
                          <td>{cliente.telefono || "-"}</td>
                          <td>{cliente.email || "-"}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-warning me-2"
                              onClick={() => handleOpenModal(cliente)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(cliente._id, cliente.razonSocial)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={clientesFiltrados.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <>
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-fullscreen-sm-down modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {editingCliente ? "Editar Cliente" : "Crear Cliente"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleCloseModal}
                  ></button>
                </div>
                <form onSubmit={handleSubmit} autoComplete="off">
                  <input type="text" style={{display: 'none'}} />
                  <input type="password" style={{display: 'none'}} />
                  <div className="modal-body">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label htmlFor="razonSocial" className="form-label">
                          Razón Social <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="razonSocial"
                          name="razonSocial"
                          value={formData.razonSocial}
                          onChange={handleChange}
                          autoComplete="off"
                          data-form-type="other"
                          required
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="cuit" className="form-label">
                          CUIT <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="cuit"
                          name="cuit"
                          value={formData.cuit}
                          onChange={handleChange}
                          placeholder="30-12345678-9"
                          autoComplete="off"
                          data-form-type="other"
                          required
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-12 mb-3">
                        <label htmlFor="direccion" className="form-label">
                          Dirección
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="direccion"
                          name="direccion"
                          value={formData.direccion}
                          onChange={handleChange}
                          autoComplete="off"
                          data-form-type="other"
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label htmlFor="contacto" className="form-label">
                          Contacto
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="contacto"
                          name="contacto"
                          value={formData.contacto}
                          onChange={handleChange}
                          placeholder="Nombre del contacto"
                          autoComplete="off"
                          data-form-type="other"
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label htmlFor="telefono" className="form-label">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          className="form-control"
                          id="telefono"
                          name="telefono"
                          value={formData.telefono}
                          onChange={handleChange}
                          placeholder="381-1234567"
                          autoComplete="off"
                          data-form-type="other"
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-12 mb-3">
                        <label htmlFor="email" className="form-label">
                          Email
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="cliente@ejemplo.com"
                          autoComplete="off"
                          data-form-type="other"
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-12 mb-1">
                        <label htmlFor="listaPrecios" className="form-label">
                          Lista de Precios
                        </label>
                        <select
                          className="form-select"
                          id="listaPrecios"
                          name="listaPrecios"
                          value={formData.listaPrecios}
                          onChange={handleChange}
                        >
                          <option value="">— Sin lista —</option>
                          {listasPrecios.map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCloseModal}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingCliente ? "Actualizar" : "Crear"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show"></div>
        </>
      )}
      </div>
    </Layout>
  );
};

export default ClientesPage;
