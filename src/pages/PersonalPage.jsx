import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, resetearBaseDeDatos, estadoPush, testPush } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import "../css/Tablas.css";

const PersonalPage = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [formData, setFormData] = useState({
    nombreUsuario: "",
    emailUsuario: "",
    telefonoUsuario: "",
    contraseniaUsuario: "",
    rolUsuario: "administracion_frigorifico",
  });
  const [confirmarContrasenia, setConfirmarContrasenia] = useState("");
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [resetting, setResetting]       = useState(false);
  const [pushEstado, setPushEstado]     = useState(null);
  const [pushTesting, setPushTesting]   = useState(false);

  const handleReset = async () => {
    const { value } = await Swal.fire({
      title: "⚠️ BORRAR TODOS LOS DATOS",
      html: `<p class="text-danger fw-bold">Esta acción eliminará <u>todos</u> los datos operativos de la base de datos.</p>
             <p class="small text-muted">Se conservan: usuarios, clientes, camiones, listas de precios y artículos de stock.</p>
             <p class="mb-1">Para confirmar, escribí <strong>BORRAR TODO</strong>:</p>`,
      input: "text",
      inputPlaceholder: "BORRAR TODO",
      inputAttributes: { autocomplete: "off" },
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Borrar todo",
      cancelButtonText: "Cancelar",
      preConfirm: (val) => {
        if (val !== "BORRAR TODO") {
          Swal.showValidationMessage("Escribí exactamente: BORRAR TODO");
          return false;
        }
        return true;
      },
    });
    if (!value) return;

    setResetting(true);
    try {
      const { resultado } = await resetearBaseDeDatos();
      const total = Object.values(resultado).reduce((s, grupo) =>
        s + Object.values(grupo).reduce((a, n) => a + n, 0), 0);
      Swal.fire({
        icon: "success",
        title: "Base de datos reseteada",
        html: `<p class="mb-1">Se eliminaron <strong>${total}</strong> registros en total.</p>
               <p class="text-muted small">Contadores reseteados. Stock de empaque en 0.</p>`,
        confirmButtonText: "OK",
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setResetting(false);
    }
  };

  // Verificar que el usuario sea superadmin
  const rolUsuario = localStorage.getItem("rolUsuario");

  useEffect(() => {
    // Si no es superadmin, redirigir al dashboard
    if (rolUsuario !== "superadmin") {
      navigate("/dashboard");
      return;
    }
    cargarUsuarios();
  }, [rolUsuario, navigate]);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const data = await obtenerUsuarios();
      setUsuarios(data.usuarios || []);
      setError("");
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setError("Error al cargar los usuarios");
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (usuario = null) => {
    if (usuario) {
      setEditingUsuario(usuario);
      setFormData({
        nombreUsuario: usuario.nombreUsuario,
        emailUsuario: usuario.emailUsuario,
        telefonoUsuario: usuario.telefonoUsuario || "",
        contraseniaUsuario: "",
        rolUsuario: usuario.rolUsuario,
      });
    } else {
      setEditingUsuario(null);
      setFormData({
        nombreUsuario: "",
        emailUsuario: "",
        telefonoUsuario: "",
        contraseniaUsuario: "",
        rolUsuario: "compras",
      });
    }
    setConfirmarContrasenia("");
    setShowPass(false);
    setShowConfirm(false);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUsuario(null);
    setFormData({
      nombreUsuario: "",
      emailUsuario: "",
      telefonoUsuario: "",
      contraseniaUsuario: "",
      rolUsuario: "administracion_frigorifico",
    });
    setConfirmarContrasenia("");
    setShowPass(false);
    setShowConfirm(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar coincidencia de contraseñas
    if (formData.contraseniaUsuario && formData.contraseniaUsuario !== confirmarContrasenia) {
      Swal.fire({ title: "Las contraseñas no coinciden", icon: "warning", confirmButtonColor: "#d33" });
      return;
    }

    // Validar contraseña solo si se está creando un usuario nuevo o si se ingresó una contraseña al editar
    if (formData.contraseniaUsuario) {
      const passwordRegex = /^[A-Z](?=.*[a-z])(?=.*\d)[A-Za-z\d]{5,}$/;
      if (!passwordRegex.test(formData.contraseniaUsuario)) {
        Swal.fire({
          title: "Contraseña inválida",
          html: `La contraseña debe cumplir los siguientes requisitos:<br/>
            <ul style="text-align: left; margin-top: 10px;">
              <li>Comenzar con una letra <strong>MAYÚSCULA</strong></li>
              <li>Contener al menos una letra minúscula</li>
              <li>Contener al menos un número</li>
              <li>Tener mínimo 6 caracteres</li>
              <li>Solo letras y números (alfanumérica)</li>
            </ul>
            <strong>Ejemplo:</strong> Arqui123`,
          icon: "warning",
          confirmButtonColor: "#d33",
        });
        return;
      }
    }

    try {
      if (editingUsuario) {
        // Al editar, solo enviar contraseña si se ingresó una nueva
        const dataToSend = { ...formData };
        if (!formData.contraseniaUsuario) {
          delete dataToSend.contraseniaUsuario;
        }
        await actualizarUsuario(editingUsuario._id, dataToSend);
      } else {
        await crearUsuario(formData);
      }
      await cargarUsuarios();
      handleCloseModal();
      Swal.fire({
        title: editingUsuario ? "¡Actualizado!" : "¡Creado!",
        text: `Usuario ${editingUsuario ? "actualizado" : "creado"} correctamente`,
        icon: "success",
        confirmButtonColor: "#198754",
      });
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      Swal.fire({
        title: "Error",
        text: err.message || "Error al guardar el usuario",
        icon: "error",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleDelete = async (id, nombreUsuario) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      html: `Vas a eliminar al usuario:<br/><strong>${nombreUsuario}</strong>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await eliminarUsuario(id);
        await cargarUsuarios();
        Swal.fire({
          title: "¡Eliminado!",
          text: `${nombreUsuario} ha sido eliminado correctamente`,
          icon: "success",
          confirmButtonColor: "#198754",
        });
      } catch (err) {
        console.error("Error al eliminar usuario:", err);
        Swal.fire({
          title: "Error",
          text: err.message || "Error al eliminar el usuario",
          icon: "error",
          confirmButtonColor: "#d33",
        });
      }
    }
  };

  const usuariosFiltrados = usuarios.filter((usuario) =>
    usuario.nombreUsuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.emailUsuario?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = usuariosFiltrados.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Resetear página cuando cambie la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Si no es superadmin, no mostrar nada (ya redirige en useEffect)
  if (rolUsuario !== "superadmin") {
    return null;
  }

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Gestión de Usuarios</h1>
            <p className="text-muted">Administra los usuarios del sistema</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <button
              className="btn btn-primary me-2"
              onClick={() => handleOpenModal()}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Crear Usuario
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
              placeholder="Buscar por nombre o email..."
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
          <div className="card tabla-sin-movimiento">
            <div className="card-body p-0">

              {usuariosFiltrados.length === 0 ? (
                <p className="text-center text-muted py-4 mb-0">No se encontraron usuarios</p>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="d-md-none p-3">
                    {currentItems.map((usuario) => (
                      <div key={usuario._id} className="card border mb-3">
                        <div className="card-body py-3">
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <div>
                              <span className="fw-semibold d-block">{usuario.nombreUsuario}</span>
                              <small className="text-muted">{usuario.emailUsuario}</small>
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => handleOpenModal(usuario)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(usuario._id, usuario.nombreUsuario)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                          <span className={`badge ${
                            usuario.rolUsuario === 'superadmin' ? 'bg-danger' :
                            usuario.rolUsuario === 'administracion_frigorifico' ? 'bg-primary' :
                            usuario.rolUsuario === 'administracion_granja' ? 'bg-success-subtle text-success' :
                            usuario.rolUsuario === 'frigorifico' ? 'bg-info text-dark' :
                            usuario.rolUsuario === 'granja' ? 'bg-success' :
                            usuario.rolUsuario === 'camaras' ? 'bg-warning text-dark' :
                            usuario.rolUsuario === 'chofer' ? 'bg-dark' :
                            'bg-secondary'
                          }`}>
                            {usuario.rolUsuario}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: tabla */}
                  <div className="d-none d-md-block">
                    <table className="table mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Nombre</th>
                          <th>Email</th>
                          <th>Rol</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((usuario) => (
                          <tr key={usuario._id}>
                            <td>{usuario.nombreUsuario}</td>
                            <td className="text-muted">{usuario.emailUsuario}</td>
                            <td>
                              <span className={`badge ${
                                usuario.rolUsuario === 'superadmin' ? 'bg-danger' :
                                usuario.rolUsuario === 'administracion_frigorifico' ? 'bg-primary' :
                                usuario.rolUsuario === 'administracion_granja' ? 'bg-success-subtle text-success' :
                                usuario.rolUsuario === 'frigorifico' ? 'bg-info text-dark' :
                                usuario.rolUsuario === 'camaras' ? 'bg-success' :
                                'bg-secondary'
                              }`}>
                                {usuario.rolUsuario}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-warning me-2"
                                onClick={() => handleOpenModal(usuario)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(usuario._id, usuario.nombreUsuario)}
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
              totalItems={usuariosFiltrados.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
            />
          </div>
        )}

        {/* Debug notificaciones push */}
        <div className="card border-warning mt-4">
          <div className="card-header bg-warning text-dark d-flex align-items-center gap-2">
            <i className="bi bi-bell-fill"></i>
            <span className="fw-semibold">Debug — Notificaciones Push</span>
          </div>
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                className="btn btn-outline-dark"
                onClick={async () => {
                  try {
                    const data = await estadoPush();
                    setPushEstado(data);
                  } catch (err) {
                    Swal.fire("Error", err.message, "error");
                  }
                }}
              >
                <i className="bi bi-info-circle me-1"></i>Ver estado
              </button>
              <button
                className="btn btn-warning"
                disabled={pushTesting}
                onClick={async () => {
                  setPushTesting(true);
                  try {
                    const data = await testPush();
                    Swal.fire("Enviado", `Notificación enviada a: ${data.roles.join(", ")}`, "success");
                  } catch (err) {
                    Swal.fire("Error", err.message, "error");
                  } finally {
                    setPushTesting(false);
                  }
                }}
              >
                {pushTesting
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Enviando...</>
                  : <><i className="bi bi-send me-1"></i>Enviar notificación de prueba</>}
              </button>
            </div>
            {pushEstado && (
              <div className="bg-light rounded p-3" style={{ fontSize: "0.85rem" }}>
                <div className="mb-1">
                  <strong>VAPID configurado:</strong>{" "}
                  {pushEstado.vapidConfigurado
                    ? <span className="text-success">Sí</span>
                    : <span className="text-danger">No — faltan las env vars en Vercel</span>}
                </div>
                <div className="mb-2">
                  <strong>Suscripciones guardadas:</strong> {pushEstado.totalSuscripciones}
                </div>
                {pushEstado.suscripciones.length > 0 && (
                  <ul className="mb-0 ps-3">
                    {pushEstado.suscripciones.map((s, i) => (
                      <li key={i}>
                        <strong>{s.usuario}</strong> ({s.rol}) — <span className="text-muted">{s.endpoint}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Zona peligrosa */}
        <div className="card border-danger mt-4">
          <div className="card-header bg-danger text-white d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span className="fw-semibold">Zona peligrosa</span>
          </div>
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div>
                <p className="fw-semibold mb-1">Resetear base de datos</p>
                <p className="text-muted small mb-0">
                  Elimina todos los datos operativos (granja, frigorifico, contable, stock).
                  Conserva usuarios, clientes, camiones, listas de precios y artículos de empaque.
                </p>
              </div>
              <button
                className="btn btn-danger"
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Reseteando...</>
                  : <><i className="bi bi-trash3 me-2"></i>Borrar todos los datos</>}
              </button>
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <>
            <div className="modal show d-block" tabIndex="-1">
              <div className="modal-dialog modal-fullscreen-sm-down modal-lg modal-dialog-scrollable">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editingUsuario ? "Editar Usuario" : "Crear Usuario"}
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
                          <label htmlFor="nombreUsuario" className="form-label">
                            Nombre Completo <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            id="nombreUsuario"
                            name="nombreUsuario"
                            value={formData.nombreUsuario}
                            onChange={handleChange}
                            autoComplete="off"
                            data-form-type="other"
                            required
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label htmlFor="emailUsuario" className="form-label">
                            Email <span className="text-danger">*</span>
                          </label>
                          <input
                            type="email"
                            className="form-control"
                            id="emailUsuario"
                            name="emailUsuario"
                            value={formData.emailUsuario}
                            onChange={handleChange}
                            placeholder="usuario@ejemplo.com"
                            autoComplete="off"
                            data-form-type="other"
                            required
                          />
                        </div>
                      </div>

                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label htmlFor="telefonoUsuario" className="form-label">
                            Teléfono <span className="text-danger">*</span>
                          </label>
                          <input
                            type="number"
                            className="form-control"
                            id="telefonoUsuario"
                            name="telefonoUsuario"
                            value={formData.telefonoUsuario}
                            onChange={handleChange}
                            placeholder="3814123456"
                            autoComplete="off"
                            data-form-type="other"
                            required
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label htmlFor="contraseniaUsuario" className="form-label">
                            Contraseña {!editingUsuario && <span className="text-danger">*</span>}
                            {editingUsuario && <small className="text-muted"> (dejar vacío para mantener actual)</small>}
                          </label>
                          <div className="input-group">
                            <input
                              type={showPass ? "text" : "password"}
                              className="form-control"
                              id="contraseniaUsuario"
                              name="contraseniaUsuario"
                              value={formData.contraseniaUsuario}
                              onChange={handleChange}
                              placeholder={editingUsuario ? "Nueva contraseña (opcional)" : "Ej: Arqui123"}
                              autoComplete="new-password"
                              data-form-type="other"
                              minLength="6"
                              required={!editingUsuario}
                            />
                            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPass((v) => !v)} tabIndex="-1">
                              <i className={`bi ${showPass ? "bi-eye-slash" : "bi-eye"}`}></i>
                            </button>
                          </div>
                          {!editingUsuario && (
                            <div className="form-text">
                              <small>
                                Debe comenzar con <strong>MAYÚSCULA</strong>, contener letras y números (mínimo 6 caracteres)
                              </small>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Confirmar contraseña — solo cuando se escribe una contraseña */}
                      {formData.contraseniaUsuario && (
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label">
                              Confirmar contraseña <span className="text-danger">*</span>
                            </label>
                            <div className="input-group">
                              <input
                                type={showConfirm ? "text" : "password"}
                                className={`form-control ${confirmarContrasenia && (confirmarContrasenia === formData.contraseniaUsuario ? "is-valid" : "is-invalid")}`}
                                value={confirmarContrasenia}
                                onChange={(e) => setConfirmarContrasenia(e.target.value)}
                                placeholder="Repetí la contraseña"
                                autoComplete="new-password"
                                required={!!formData.contraseniaUsuario}
                              />
                              <button type="button" className="btn btn-outline-secondary" onClick={() => setShowConfirm((v) => !v)} tabIndex="-1">
                                <i className={`bi ${showConfirm ? "bi-eye-slash" : "bi-eye"}`}></i>
                              </button>
                              {confirmarContrasenia && confirmarContrasenia !== formData.contraseniaUsuario && (
                                <div className="invalid-feedback">Las contraseñas no coinciden</div>
                              )}
                            </div>
                          </div>
                        <div className="col-md-6"></div>
                      </div>
                      )}

                      <div className="row">
                        <div className="col-md-12 mb-3">
                          <label htmlFor="rolUsuario" className="form-label">
                            Rol <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select"
                            id="rolUsuario"
                            name="rolUsuario"
                            value={formData.rolUsuario}
                            onChange={handleChange}
                            required
                          >
                            <option value="administracion_frigorifico">Administración Frigorífico (Clientes, camiones, despachos)</option>
                            <option value="administracion_granja">Administración Granja (Clientes, camiones, granja)</option>
                            <option value="frigorifico">Frigorífico (Lotes y envíos cámara)</option>
                            <option value="granja">Granja (Ingreso pollitos, galpones, datos semanales)</option>
                            <option value="camaras">Cámaras (Entregas)</option>
                            <option value="chofer">Chofer (Carga y entrega de pedidos)</option>
                            <option value="superadmin">Super Admin (Acceso total)</option>
                          </select>
                          <div className="form-text">
                            <small>
                              <strong>Administración Frigorífico:</strong> Clientes, camiones, stock, despachos y envíos cámara. <br />
                              <strong>Administración Granja:</strong> Clientes, camiones, ingreso de pollitos, galpones, órdenes de carga y recepción. <br />
                              <strong>Frigorífico:</strong> Carga de lotes y envíos entre cámaras. <br />
                              <strong>Cámaras:</strong> Registro de entregas de mercadería. <br />
                              <strong>Super Admin:</strong> Acceso total al sistema.
                            </small>
                          </div>
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
                        {editingUsuario ? "Actualizar" : "Crear Usuario"}
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

export default PersonalPage;
