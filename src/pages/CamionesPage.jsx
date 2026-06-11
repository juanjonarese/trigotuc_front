import React, { useState, useEffect } from "react";
import { obtenerCamiones, crearCamion, actualizarCamion, eliminarCamion, obtenerChoferes, crearChofer } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import "../css/Tablas.css";

const FORM_INICIAL = { marca: "", patente: "", choferes: ["", ""] };
const NUEVO_CHOFER_INICIAL = { nombreUsuario: "", telefonoUsuario: "", contraseniaUsuario: "" };
const ITEMS_PER_PAGE = 30;
const PASSWORD_REGEX = /^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/;

const CamionesPage = () => {
  const [camiones, setCamiones]     = useState([]);
  const [choferes, setChoferes]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editingCamion, setEditingCamion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData]     = useState(FORM_INICIAL);

  const [mostrarNuevoChofer, setMostrarNuevoChofer] = useState(false);
  const [nuevoChoferData, setNuevoChoferData] = useState(NUEVO_CHOFER_INICIAL);
  const [confirmarContraseniaChofer, setConfirmarContraseniaChofer] = useState("");
  const [showPassChofer, setShowPassChofer] = useState(false);
  const [showConfirmChofer, setShowConfirmChofer] = useState(false);
  const [creandoChofer, setCreandoChofer] = useState(false);

  const rolUsuario  = localStorage.getItem("rolUsuario");
  const puedeEditar = ["superadmin", "administracion_frigorifico", "administracion_granja"].includes(rolUsuario);

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

  const cargarChoferes = async () => {
    try {
      const data = await obtenerChoferes();
      setChoferes(data.choferes || []);
      return data.choferes || [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    cargarCamiones();
    cargarChoferes();
  }, []);

  const handleOpenModal = (camion = null) => {
    if (camion) {
      setEditingCamion(camion);
      setFormData({
        marca: camion.marca,
        patente: camion.patente,
        choferes: [camion.choferes?.[0]?._id || "", camion.choferes?.[1]?._id || ""],
      });
    } else {
      setEditingCamion(null);
      setFormData(FORM_INICIAL);
    }
    setMostrarNuevoChofer(false);
    setNuevoChoferData(NUEVO_CHOFER_INICIAL);
    setConfirmarContraseniaChofer("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCamion(null);
    setFormData(FORM_INICIAL);
    setMostrarNuevoChofer(false);
    setNuevoChoferData(NUEVO_CHOFER_INICIAL);
    setConfirmarContraseniaChofer("");
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleChoferChange = (index, value) => {
    setFormData((prev) => {
      const nuevosChoferes = [...prev.choferes];
      nuevosChoferes[index] = value;
      return { ...prev, choferes: nuevosChoferes };
    });
  };

  // Choferes disponibles para el slot `index`: excluye el elegido en el otro slot
  // y los choferes ya asignados a otro camión activo.
  const choferesDisponibles = (index) => {
    const otroIndex = index === 0 ? 1 : 0;
    const otroSeleccionado = formData.choferes[otroIndex];
    const asignadosOtrosCamiones = camiones
      .filter((c) => c.activo && c._id !== editingCamion?._id)
      .flatMap((c) => (c.choferes || []).map((ch) => ch._id || ch));

    return choferes.filter((c) => {
      if (c._id === otroSeleccionado) return false;
      if (asignadosOtrosCamiones.includes(c._id)) return false;
      return true;
    });
  };

  const handleNuevoChoferChange = (e) => {
    setNuevoChoferData({ ...nuevoChoferData, [e.target.name]: e.target.value });
  };

  const handleCrearChofer = async () => {
    const { nombreUsuario, telefonoUsuario, contraseniaUsuario } = nuevoChoferData;
    if (!nombreUsuario || !telefonoUsuario || !contraseniaUsuario) {
      Swal.fire({ title: "Completá todos los campos", icon: "warning", confirmButtonColor: "#d33" });
      return;
    }
    if (contraseniaUsuario !== confirmarContraseniaChofer) {
      Swal.fire({ title: "Las contraseñas no coinciden", icon: "warning", confirmButtonColor: "#d33" });
      return;
    }
    if (!PASSWORD_REGEX.test(contraseniaUsuario)) {
      Swal.fire({
        title: "Contraseña inválida",
        text: "Debe comenzar con MAYÚSCULA, contener letras y números (mínimo 6 caracteres alfanuméricos). Ejemplo: Arqui123",
        icon: "warning",
        confirmButtonColor: "#d33",
      });
      return;
    }

    setCreandoChofer(true);
    try {
      const resp = await crearChofer(nuevoChoferData);
      await cargarChoferes();

      if (resp.usuario?.id) {
        setFormData((prev) => {
          const nuevosChoferes = [...prev.choferes];
          const idxVacio = nuevosChoferes.findIndex((c) => !c);
          if (idxVacio !== -1) nuevosChoferes[idxVacio] = resp.usuario.id;
          return { ...prev, choferes: nuevosChoferes };
        });
      }

      setMostrarNuevoChofer(false);
      setNuevoChoferData(NUEVO_CHOFER_INICIAL);
      setConfirmarContraseniaChofer("");
      Swal.fire({
        title: "¡Chofer creado!",
        text: resp.msg || "El chofer fue creado correctamente",
        icon: "success",
        confirmButtonColor: "#198754",
      });
    } catch (err) {
      console.error("Error al crear chofer:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "Error al crear el chofer",
        icon: "error",
        confirmButtonColor: "#d33",
      });
    } finally {
      setCreandoChofer(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, choferes: formData.choferes.filter(Boolean) };
      if (editingCamion) {
        await actualizarCamion(editingCamion._id, payload);
      } else {
        await crearCamion(payload);
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
                              {c.choferes?.length > 0 && (
                                <small className="text-primary d-block">
                                  <i className="bi bi-person-fill me-1"></i>
                                  {c.choferes.map((ch) => ch.nombreUsuario).join(", ")}
                                </small>
                              )}
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
                          <th>Choferes</th>
                          {puedeEditar && <th>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((c) => (
                          <tr key={c._id}>
                            <td>{c.marca}</td>
                            <td>{c.patente}</td>
                            <td>
                              {c.choferes?.length > 0
                                ? c.choferes.map((ch) => (
                                    <span key={ch._id} className="badge bg-primary me-1">{ch.nombreUsuario}</span>
                                  ))
                                : <span className="text-muted small">—</span>}
                            </td>
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
                      <div className="mb-3">
                        <label className="form-label">Choferes asignados</label>
                        <div className="row g-2">
                          <div className="col-12 col-sm-6">
                            <select
                              className="form-select"
                              aria-label="Chofer 1"
                              value={formData.choferes[0]}
                              onChange={(e) => handleChoferChange(0, e.target.value)}
                            >
                              <option value="">— Chofer 1 —</option>
                              {choferesDisponibles(0).map((c) => (
                                <option key={c._id} value={c._id}>{c.nombreUsuario}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-sm-6">
                            <select
                              className="form-select"
                              aria-label="Chofer 2"
                              value={formData.choferes[1]}
                              onChange={(e) => handleChoferChange(1, e.target.value)}
                            >
                              <option value="">— Chofer 2 —</option>
                              {choferesDisponibles(1).map((c) => (
                                <option key={c._id} value={c._id}>{c.nombreUsuario}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="form-text">
                          Podés asignar hasta 2 choferes, por ejemplo para distintos turnos.
                        </div>
                        {choferes.length === 0 && (
                          <div className="form-text text-muted">
                            No hay choferes registrados aún. Podés crear uno nuevo abajo.
                          </div>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mt-2"
                          onClick={() => setMostrarNuevoChofer((v) => !v)}
                        >
                          <i className="bi bi-person-plus me-1"></i>
                          {mostrarNuevoChofer ? "Cancelar nuevo chofer" : "+ Nuevo chofer"}
                        </button>

                        {mostrarNuevoChofer && (
                          <div className="border rounded p-3 mt-2 bg-light">
                            <h6 className="mb-3">Crear nuevo chofer</h6>
                            <div className="row g-2">
                              <div className="col-12 col-sm-6">
                                <label className="form-label">
                                  Nombre <span className="text-danger">*</span>
                                </label>
                                <input
                                  type="text"
                                  className="form-control"
                                  name="nombreUsuario"
                                  value={nuevoChoferData.nombreUsuario}
                                  onChange={handleNuevoChoferChange}
                                  placeholder="Nombre y apellido"
                                />
                              </div>
                              <div className="col-12 col-sm-6">
                                <label className="form-label">
                                  Teléfono <span className="text-danger">*</span>
                                </label>
                                <input
                                  type="number"
                                  className="form-control"
                                  name="telefonoUsuario"
                                  value={nuevoChoferData.telefonoUsuario}
                                  onChange={handleNuevoChoferChange}
                                  placeholder="3814123456"
                                />
                              </div>
                              <div className="col-12 col-sm-6">
                                <label className="form-label">
                                  Contraseña <span className="text-danger">*</span>
                                </label>
                                <div className="input-group">
                                  <input
                                    type={showPassChofer ? "text" : "password"}
                                    className="form-control"
                                    name="contraseniaUsuario"
                                    value={nuevoChoferData.contraseniaUsuario}
                                    onChange={handleNuevoChoferChange}
                                    placeholder="Ej: Arqui123"
                                    autoComplete="new-password"
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowPassChofer((v) => !v)}
                                    tabIndex="-1"
                                  >
                                    <i className={`bi ${showPassChofer ? "bi-eye-slash" : "bi-eye"}`}></i>
                                  </button>
                                </div>
                                <div className="form-text">
                                  Mayúscula inicial, letras y números, mínimo 6 caracteres.
                                </div>
                              </div>
                              <div className="col-12 col-sm-6">
                                <label className="form-label">
                                  Confirmar contraseña <span className="text-danger">*</span>
                                </label>
                                <div className="input-group">
                                  <input
                                    type={showConfirmChofer ? "text" : "password"}
                                    className={`form-control ${confirmarContraseniaChofer && (confirmarContraseniaChofer === nuevoChoferData.contraseniaUsuario ? "is-valid" : "is-invalid")}`}
                                    value={confirmarContraseniaChofer}
                                    onChange={(e) => setConfirmarContraseniaChofer(e.target.value)}
                                    placeholder="Repetí la contraseña"
                                    autoComplete="new-password"
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowConfirmChofer((v) => !v)}
                                    tabIndex="-1"
                                  >
                                    <i className={`bi ${showConfirmChofer ? "bi-eye-slash" : "bi-eye"}`}></i>
                                  </button>
                                  {confirmarContraseniaChofer && confirmarContraseniaChofer !== nuevoChoferData.contraseniaUsuario && (
                                    <div className="invalid-feedback">Las contraseñas no coinciden</div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-end mt-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={handleCrearChofer}
                                disabled={creandoChofer}
                              >
                                {creandoChofer ? "Creando..." : "Crear chofer"}
                              </button>
                            </div>
                          </div>
                        )}
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
