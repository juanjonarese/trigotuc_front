import React, { useState, useEffect } from "react";
import { obtenerCamiones, crearCamion, actualizarCamion, eliminarCamion, obtenerChoferes, crearChofer, eliminarChofer } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import "../css/Tablas.css";

const CAMION_INICIAL = { marca: "", patente: "" };
const CHOFER_INICIAL = { nombreUsuario: "", telefonoUsuario: "" };
const ITEMS_PER_PAGE = 30;

const CamionesPage = () => {
  const [camiones, setCamiones] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Camión (alta/edición)
  const [showCamionModal, setShowCamionModal] = useState(false);
  const [editingCamion, setEditingCamion]     = useState(null);
  const [camionForm, setCamionForm]           = useState(CAMION_INICIAL);
  const [guardandoCamion, setGuardandoCamion] = useState(false);

  // Chofer (alta)
  const [showChoferModal, setShowChoferModal] = useState(false);
  const [choferForm, setChoferForm]           = useState(CHOFER_INICIAL);
  const [guardandoChofer, setGuardandoChofer] = useState(false);

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
    } catch {
      setChoferes([]);
    }
  };

  useEffect(() => {
    cargarCamiones();
    cargarChoferes();
  }, []);

  // ── Camión ───────────────────────────────────────────────────────────────
  const openCamionModal = (camion = null) => {
    if (camion) {
      setEditingCamion(camion);
      setCamionForm({ marca: camion.marca, patente: camion.patente });
    } else {
      setEditingCamion(null);
      setCamionForm(CAMION_INICIAL);
    }
    setShowCamionModal(true);
  };

  const closeCamionModal = () => {
    setShowCamionModal(false);
    setEditingCamion(null);
    setCamionForm(CAMION_INICIAL);
  };

  const handleCamionSubmit = async (e) => {
    e.preventDefault();
    setGuardandoCamion(true);
    try {
      const payload = { marca: camionForm.marca, patente: camionForm.patente };
      if (editingCamion) {
        await actualizarCamion(editingCamion._id, payload);
      } else {
        await crearCamion(payload);
      }
      await cargarCamiones();
      closeCamionModal();
      Swal.fire({ title: editingCamion ? "¡Actualizado!" : "¡Creado!", text: `Camión ${editingCamion ? "actualizado" : "creado"} correctamente`, icon: "success", confirmButtonColor: "#198754", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: "Error", text: err.message || "Error al guardar el camión", icon: "error", confirmButtonColor: "#d33" });
    } finally {
      setGuardandoCamion(false);
    }
  };

  const handleDeleteCamion = async (id, nombre) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      html: `Vas a eliminar el camión:<br/><strong>${nombre}</strong>`,
      icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await eliminarCamion(id);
      await cargarCamiones();
      Swal.fire({ title: "¡Eliminado!", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: "Error", text: err.message || "Error al eliminar el camión", icon: "error", confirmButtonColor: "#d33" });
    }
  };

  // ── Chofer ───────────────────────────────────────────────────────────────
  const openChoferModal = () => {
    setChoferForm(CHOFER_INICIAL);
    setShowChoferModal(true);
  };
  const closeChoferModal = () => {
    setShowChoferModal(false);
    setChoferForm(CHOFER_INICIAL);
  };

  const handleChoferSubmit = async (e) => {
    e.preventDefault();
    const { nombreUsuario, telefonoUsuario } = choferForm;
    if (!nombreUsuario || !telefonoUsuario) {
      Swal.fire({ title: "Completá nombre y teléfono", icon: "warning", confirmButtonColor: "#d33" });
      return;
    }
    setGuardandoChofer(true);
    try {
      const resp = await crearChofer(choferForm);
      await cargarChoferes();
      closeChoferModal();
      Swal.fire({ title: "¡Chofer creado!", text: resp.msg || "El chofer fue creado correctamente", icon: "success", confirmButtonColor: "#198754", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: "Error", text: err.message || "Error al crear el chofer", icon: "error", confirmButtonColor: "#d33" });
    } finally {
      setGuardandoChofer(false);
    }
  };

  const handleEliminarChofer = async (chofer) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar chofer?",
      html: `Se eliminará a <strong>${chofer.nombreUsuario}</strong>. Esta acción no se puede deshacer.`,
      icon: "warning", showCancelButton: true, confirmButtonColor: "#dc3545",
      confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarChofer(chofer._id);
      await cargarChoferes();
      Swal.fire({ title: "Chofer eliminado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ title: "No se pudo eliminar", text: err.message || "Error al eliminar el chofer", icon: "error", confirmButtonColor: "#d33" });
    }
  };

  // ── Derivados ──────────────────────────────────────────────────────────────
  const indexOfLastItem  = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems     = camiones.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="mb-4">
          <h1 className="h3 mb-1">Camiones y Choferes</h1>
          <p className="text-muted mb-0">Alta independiente de camiones y choferes</p>
        </div>

        {error && (
          <div className="alert alert-danger"><i className="bi bi-exclamation-triangle me-2"></i>{error}</div>
        )}

        {loading ? (
          <div className="d-flex justify-content-center align-items-center my-5">
            <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            {/* ── Camiones ── */}
            <div className="col-12 col-lg-7">
              <div className="card tabla-sin-movimiento">
                <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h5 className="mb-0"><i className="bi bi-truck me-2 text-primary"></i>Camiones</h5>
                  {puedeEditar && (
                    <button className="btn btn-primary btn-sm" onClick={() => openCamionModal()}>
                      <i className="bi bi-plus-circle me-1"></i>Crear Camión
                    </button>
                  )}
                </div>
                <div className="card-body">
                  {camiones.length === 0 ? (
                    <p className="text-center text-muted py-3 mb-0">No hay camiones registrados</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Marca</th>
                            <th>Patente</th>
                            {puedeEditar && <th className="text-end">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {currentItems.map((c) => (
                            <tr key={c._id}>
                              <td>{c.marca}</td>
                              <td>{c.patente}</td>
                              {puedeEditar && (
                                <td className="text-end">
                                  <button className="btn btn-sm btn-outline-warning border-0 me-1" title="Editar camión" onClick={() => openCamionModal(c)}><i className="bi bi-pencil"></i></button>
                                  <button className="btn btn-sm btn-outline-danger border-0" title="Eliminar camión" onClick={() => handleDeleteCamion(c._id, `${c.marca} - ${c.patente}`)}><i className="bi bi-trash"></i></button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Pagination currentPage={currentPage} totalItems={camiones.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
                </div>
              </div>
            </div>

            {/* ── Choferes ── */}
            <div className="col-12 col-lg-5">
              <div className="card tabla-sin-movimiento">
                <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h5 className="mb-0"><i className="bi bi-person-badge me-2 text-success"></i>Choferes</h5>
                  {puedeEditar && (
                    <button className="btn btn-success btn-sm" onClick={openChoferModal}>
                      <i className="bi bi-person-plus me-1"></i>Crear Chofer
                    </button>
                  )}
                </div>
                <div className="card-body">
                  {choferes.length === 0 ? (
                    <p className="text-center text-muted py-3 mb-0">No hay choferes registrados</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Nombre</th>
                            <th>Teléfono</th>
                            {puedeEditar && <th className="text-end">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {choferes.map((c) => (
                            <tr key={c._id}>
                              <td><i className="bi bi-person-fill me-2 text-success"></i>{c.nombreUsuario}</td>
                              <td>{c.telefonoUsuario || <span className="text-muted">—</span>}</td>
                              {puedeEditar && (
                                <td className="text-end">
                                  <button className="btn btn-sm btn-outline-danger border-0" title="Eliminar chofer" onClick={() => handleEliminarChofer(c)}>
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Camión ── */}
        {showCamionModal && (
          <>
            <div className="modal show d-block" tabIndex="-1">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{editingCamion ? "Editar Camión" : "Crear Camión"}</h5>
                    <button type="button" className="btn-close" onClick={closeCamionModal}></button>
                  </div>
                  <form onSubmit={handleCamionSubmit}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label">Marca <span className="text-danger">*</span></label>
                        <input type="text" className="form-control" name="marca" value={camionForm.marca}
                          onChange={(e) => setCamionForm({ ...camionForm, marca: e.target.value })} placeholder="Ej: Mercedes Benz" required />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Patente <span className="text-danger">*</span></label>
                        <input type="text" className="form-control" name="patente" value={camionForm.patente}
                          onChange={(e) => setCamionForm({ ...camionForm, patente: e.target.value })} placeholder="Ej: AB123CD" required />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={closeCamionModal}>Cancelar</button>
                      <button type="submit" className="btn btn-primary" disabled={guardandoCamion}>
                        {guardandoCamion ? "Guardando..." : (editingCamion ? "Actualizar" : "Crear Camión")}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="modal-backdrop show"></div>
          </>
        )}

        {/* ── Modal Chofer ── */}
        {showChoferModal && (
          <>
            <div className="modal show d-block" tabIndex="-1">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Crear Chofer</h5>
                    <button type="button" className="btn-close" onClick={closeChoferModal}></button>
                  </div>
                  <form onSubmit={handleChoferSubmit}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label">Nombre <span className="text-danger">*</span></label>
                        <input type="text" className="form-control" name="nombreUsuario" value={choferForm.nombreUsuario}
                          onChange={(e) => setChoferForm({ ...choferForm, nombreUsuario: e.target.value })} placeholder="Nombre y apellido" required />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Teléfono <span className="text-danger">*</span></label>
                        <input type="number" className="form-control" name="telefonoUsuario" value={choferForm.telefonoUsuario}
                          onChange={(e) => setChoferForm({ ...choferForm, telefonoUsuario: e.target.value })} placeholder="3814123456" required />
                        <div className="form-text">El chofer ingresa al sistema solo con su teléfono.</div>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={closeChoferModal}>Cancelar</button>
                      <button type="submit" className="btn btn-success" disabled={guardandoChofer}>
                        {guardandoChofer ? "Creando..." : "Crear Chofer"}
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
