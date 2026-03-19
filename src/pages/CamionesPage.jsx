import React, { useState, useEffect } from "react";
import { obtenerCamiones, crearCamion, actualizarCamion, eliminarCamion } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import "../css/Tablas.css";

const FORM_INICIAL = { marca: "", patente: "" };
const ITEMS_PER_PAGE = 30;

const CamionesPage = () => {
  const [camiones, setCamiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCamion, setEditingCamion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState(FORM_INICIAL);

  const rolUsuario = localStorage.getItem("rolUsuario");
  const puedeEditar = rolUsuario === "admin" || rolUsuario === "personal";

  const cargarCamiones = async () => {
    try {
      setLoading(true);
      const data = await obtenerCamiones();
      setCamiones(data.camiones || []);
      setError("");
    } catch (err) {
      console.error("Error al cargar camiones:", err);
      setError("Error al cargar los camiones");
      setCamiones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCamiones();
  }, []);

  const handleOpenModal = (camion = null) => {
    if (camion) {
      setEditingCamion(camion);
      setFormData({ marca: camion.marca, patente: camion.patente });
    } else {
      setEditingCamion(null);
      setFormData(FORM_INICIAL);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCamion(null);
    setFormData(FORM_INICIAL);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCamion) {
        await actualizarCamion(editingCamion._id, formData);
      } else {
        await crearCamion(formData);
      }
      await cargarCamiones();
      handleCloseModal();
      Swal.fire({
        title: editingCamion ? "¡Actualizado!" : "¡Creado!",
        text: `Camión ${editingCamion ? "actualizado" : "creado"} correctamente`,
        icon: "success",
        confirmButtonColor: "#198754",
      });
    } catch (err) {
      console.error("Error al guardar camión:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "Error al guardar el camión",
        icon: "error",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleDelete = async (id, nombre) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      html: `Vas a eliminar el camión:<br/><strong>${nombre}</strong>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarCamion(id);
        await cargarCamiones();
        Swal.fire({
          title: "¡Eliminado!",
          text: "El camión fue eliminado correctamente",
          icon: "success",
          confirmButtonColor: "#198754",
        });
      } catch (err) {
        console.error("Error al eliminar camión:", err);
        Swal.fire({
          title: "Error",
          text: err.message || "Error al eliminar el camión",
          icon: "error",
          confirmButtonColor: "#d33",
        });
      }
    }
  };

  const camionesFiltrados = camiones.filter(
    (c) =>
      c.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patente?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = camionesFiltrados.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Gestión de Camiones</h1>
            <p className="text-muted">Administra los camiones del sistema</p>
          </div>
          {puedeEditar && (
            <div className="col-12 col-md-6 text-md-end">
              <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                <i className="bi bi-plus-circle me-2"></i>
                Crear Camión
              </button>
            </div>
          )}
        </div>

        {/* Búsqueda */}
        <div className="row mb-4">
          <div className="col-12 col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por marca o patente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="d-flex justify-content-center align-items-center my-5">
            <div
              className="spinner-border text-success"
              role="status"
              style={{ width: "3rem", height: "3rem" }}
            >
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </div>
        )}

        {/* Tabla */}
        {!loading && !error && (
          <div className="card tabla-sin-movimiento">
            <div className="card-body p-0">
              {camionesFiltrados.length === 0 ? (
                <p className="text-center text-muted py-4 mb-0">No se encontraron camiones</p>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="d-md-none p-3">
                    {currentItems.map((c) => (
                      <div key={c._id} className="card border mb-3">
                        <div className="card-body py-3">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <div>
                              <span className="fw-semibold d-block">{c.marca}</span>
                              <small className="text-muted">{c.patente}</small>
                            </div>
                            {puedeEditar && (
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => handleOpenModal(c)}
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(c._id, `${c.marca} - ${c.patente}`)}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: tabla */}
                  <div className="d-none d-md-block">
                    <table className="table mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Marca</th>
                          <th>Patente</th>
                          {puedeEditar && <th>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((c) => (
                          <tr key={c._id}>
                            <td>{c.marca}</td>
                            <td>{c.patente}</td>
                            {puedeEditar && (
                              <td>
                                <button
                                  className="btn btn-sm btn-warning me-2"
                                  onClick={() => handleOpenModal(c)}
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(c._id, `${c.marca} - ${c.patente}`)}
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
            <Pagination
              currentPage={currentPage}
              totalItems={camionesFiltrados.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <>
            <div className="modal show d-block" tabIndex="-1">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editingCamion ? "Editar Camión" : "Crear Camión"}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={handleCloseModal}
                    ></button>
                  </div>
                  <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label htmlFor="marca" className="form-label">
                          Marca <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="marca"
                          name="marca"
                          value={formData.marca}
                          onChange={handleChange}
                          placeholder="Ej: Mercedes Benz"
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label htmlFor="patente" className="form-label">
                          Patente <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id="patente"
                          name="patente"
                          value={formData.patente}
                          onChange={handleChange}
                          placeholder="Ej: AB123CD"
                          required
                        />
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
                        {editingCamion ? "Actualizar" : "Crear Camión"}
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

export default CamionesPage;
