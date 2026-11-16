import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { obtenerClientes, crearCliente, actualizarCliente, eliminarCliente, obtenerEmpresas } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import { escapeHtml } from "../utils/escapeHtml";
import { empresaActual, clienteDeEmpresa, obtenerEmpresasUsuario, colorEmpresa, nombreEmpresa } from "../utils/empresas";
import { buscarParecidos } from "../utils/clientesParecidos";
import "../css/Tablas.css";

// Una etiqueta por empresa del grupo a la que le compra el cliente.
const BadgesEmpresas = ({ claves, catalogo }) => (
  <div className="d-flex flex-wrap gap-1 mt-1">
    {claves.map((clave) => {
      const empresa = catalogo.find((e) => e.clave === clave);
      return (
        <span key={clave} className="badge bg-light text-dark border fw-normal">
          <i className="bi bi-circle-fill me-1" style={{ color: colorEmpresa(clave), fontSize: "0.55rem" }}></i>
          {nombreEmpresa(clave, empresa?.nombre || clave)}
        </span>
      );
    })}
  </div>
);

const ClientesPage = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  const [formData, setFormData] = useState({
    razonSocial: "",
    cuit: "",
    direccion: "",
    contacto: "",
    telefono: "",
    email: "",
    topeCuentaCorriente: "",
  });

  // A qué empresas del grupo le compra el cliente (2026-10-16). El padrón es
  // uno solo para todo el grupo. Mientras el multiempresa esté en desarrollo lo
  // ve y lo edita solo el superadmin; el back descarta lo que mande otro rol.
  const esSuperadmin = localStorage.getItem("rolUsuario") === "superadmin";
  const location = useLocation();
  const [catalogoEmpresas, setCatalogoEmpresas] = useState([]);
  const [empresasCliente, setEmpresasCliente] = useState(["avicola"]);

  useEffect(() => {
    cargarClientes();
    // Desde el 2026-11-16 cada uno tilda las empresas que ve (las que no ve no
    // se tocan): el superadmin, todas; los demás, las de su login.
    if (esSuperadmin) {
      obtenerEmpresas()
        .then((data) => setCatalogoEmpresas(data.empresas || []))
        .catch(() => setCatalogoEmpresas([]));
    } else {
      const suyas = obtenerEmpresasUsuario();
      setCatalogoEmpresas(suyas.length ? suyas : [{ clave: "avicola", nombre: nombreEmpresa("avicola") }]);
    }
  }, [esSuperadmin]);
  const nombreDe = (clave) => nombreEmpresa(clave, catalogoEmpresas.find((e) => e.clave === clave)?.nombre || clave);

  // Los clientes anteriores no tienen la lista: eran de la avícola.
  const empresasDe = (cliente) =>
    cliente.empresas?.length ? cliente.empresas : ["avicola"];

  const toggleEmpresa = (clave) =>
    setEmpresasCliente((actual) =>
      actual.includes(clave) ? actual.filter((c) => c !== clave) : [...actual, clave]
    );

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

  const handleOpenModal = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        razonSocial: cliente.razonSocial,
        cuit: cliente.cuit,
        direccion: cliente.direccion || "",
        contacto: cliente.contacto || "",
        telefono: cliente.telefono || "",
        email: cliente.email || "",
        topeCuentaCorriente: cliente.topeCuentaCorriente ?? "",
      });
      setEmpresasCliente(empresasDe(cliente));
    } else {
      // Un alta arranca en la empresa desde la que se entró a Clientes.
      setEmpresasCliente([empresaActual(location.pathname)]);
      setEditingCliente(null);
      setFormData({
        razonSocial: "",
        cuit: "",
        direccion: "",
        contacto: "",
        telefono: "",
        email: "",
        topeCuentaCorriente: "",
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
      topeCuentaCorriente: "",
      });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Las que este usuario puede tildar, y de esas, las tildadas.
  const tildadasVisibles = empresasCliente.filter((c) => catalogoEmpresas.some((e) => e.clave === c));

  // Alta (2026-11-16): antes de crear, si en el padrón ya hay uno igual (mismo
  // teléfono o CUIT) o parecido (nombre), se ofrece sumarlo a esta empresa en
  // vez de cargarlo de nuevo. Devuelve true si se resolvió acá (sumado o cancelado).
  const revisarParecidos = async () => {
    const { iguales, parecidos } = buscarParecidos(formData, clientes);
    if (!iguales.length && !parecidos.length) return false;
    const lista = iguales.length ? iguales : parecidos;
    const etiqueta = ({ cliente: c, motivo }) =>
      `${c.razonSocial}${c.telefono ? ` · tel. ${c.telefono}` : ""}${c.cuit ? ` · CUIT ${c.cuit}` : ""} — cliente de ${empresasDe(c).map(nombreDe).join(" y ")} (${motivo})`;
    const opciones = Object.fromEntries(lista.map((x, i) => [String(i), etiqueta(x)]));
    if (!iguales.length) opciones.nuevo = "Ninguno: es un cliente nuevo";
    const { value, isConfirmed } = await Swal.fire({
      icon: iguales.length ? "warning" : "question",
      title: iguales.length ? "Este cliente ya existe" : "¿Es alguno de estos clientes?",
      html: iguales.length
        ? "Ya hay un cliente con ese teléfono o CUIT. Podés <strong>sumarlo</strong> a las empresas tildadas, sin cargarlo de nuevo."
        : "Hay clientes con un nombre parecido. Si es uno de ellos, sumalo en vez de cargarlo de nuevo.",
      input: "radio",
      inputOptions: opciones,
      inputValue: iguales.length ? "0" : undefined,
      inputValidator: (v) => (!v ? "Elegí una opción." : undefined),
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Volver al formulario",
      width: 640,
    });
    if (!isConfirmed) return true;
    if (value === "nuevo") return false;
    const elegido = lista[Number(value)].cliente;
    const yaTiene = empresasDe(elegido);
    const faltan = tildadasVisibles.filter((c) => !yaTiene.includes(c));
    if (!faltan.length) {
      await Swal.fire("Ya es cliente", `${elegido.razonSocial} ya es cliente de ${tildadasVisibles.map(nombreDe).join(" y ")}.`, "info");
      handleCloseModal();
      return true;
    }
    try {
      await actualizarCliente(elegido._id, { empresas: [...yaTiene, ...faltan] });
      await cargarClientes();
      handleCloseModal();
      Swal.fire({
        icon: "success",
        title: "Cliente sumado",
        text: `${elegido.razonSocial} ahora también es cliente de ${faltan.map(nombreDe).join(" y ")}. Sus datos no se tocaron.`,
        confirmButtonColor: "#198754",
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo sumar el cliente.", "error");
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tildadasVisibles.length === 0 && (!editingCliente || empresasCliente.length === 0)) {
      Swal.fire({
        icon: "warning",
        title: "Faltan las empresas",
        text: "Tildá al menos una empresa del grupo a la que le compra.",
      });
      return;
    }
    if (!editingCliente && (await revisarParecidos())) return;
    // Se manda la lista entera: el back solo toma, de lo que se tilda, las
    // empresas que este usuario ve, y las demás las deja como estaban.
    const datos = { ...formData, empresas: empresasCliente };
    try {
      if (editingCliente) {
        await actualizarCliente(editingCliente._id, datos);
      } else {
        await crearCliente(datos);
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
      html: `Vas a eliminar al cliente:<br/><strong>${escapeHtml(razonSocial)}</strong>`,
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

  // Solo los clientes de la empresa en la que se está (2026-10-30): el padrón es
  // uno, pero cada empresa ve los suyos; uno que le compra a varias sale en cada una.
  const empresa = empresaActual(location.pathname);
  const clientesFiltrados = clientes.filter((cliente) =>
    clienteDeEmpresa(cliente, empresa) &&
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
                        {esSuperadmin && <BadgesEmpresas claves={empresasDe(cliente)} catalogo={catalogoEmpresas} />}
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
                        {esSuperadmin && <th>Le compra a</th>}
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
                          {esSuperadmin && (
                            <td><BadgesEmpresas claves={empresasDe(cliente)} catalogo={catalogoEmpresas} /></td>
                          )}
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
            <div className="modal-dialog modal-alta my-3">
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
                          CUIT
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
                          Teléfono <span className="text-danger">*</span>
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
                          required
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

                    {/* Lo de cada empresa aparece al tildarla. Tope de cuenta corriente
                        (2026-11-12): la cuenta corriente es de Forratuc. */}
                    {empresasCliente.includes("forratuc") && (
                      <div className="mb-3">
                        <label htmlFor="topeCuentaCorriente" className="form-label">
                          Tope de cuenta corriente
                        </label>
                        <div className="input-group" style={{ maxWidth: 260 }}>
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            id="topeCuentaCorriente"
                            name="topeCuentaCorriente"
                            value={formData.topeCuentaCorriente}
                            onChange={handleChange}
                            placeholder="Sin tope"
                          />
                        </div>
                        <div className="form-text">
                          Hasta cuánto puede deber en la cuenta corriente de Forratuc. Vacío = sin tope; 0 = no se le fía.
                          El presupuesto no deja pasarlo.
                        </div>
                      </div>
                    )}

                    {catalogoEmpresas.length > 0 && (
                      <div className="mb-1">
                        <label className="form-label">
                          Le compra a <span className="text-danger">*</span>
                        </label>
                        <div className="d-flex flex-wrap gap-3">
                          {catalogoEmpresas.map((e) => (
                            <div key={e.clave} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`cliente-empresa-${e.clave}`}
                                checked={empresasCliente.includes(e.clave)}
                                onChange={() => toggleEmpresa(e.clave)}
                              />
                              <label className="form-check-label" htmlFor={`cliente-empresa-${e.clave}`}>
                                <i className="bi bi-circle-fill me-1" style={{ color: colorEmpresa(e.clave), fontSize: "0.6rem" }}></i>
                                {nombreEmpresa(e.clave, e.nombre)}
                              </label>
                            </div>
                          ))}
                        </div>
                        <div className="form-text">
                          Un mismo cliente puede comprarle a varias empresas del grupo.
                          {empresasCliente.some((c) => !catalogoEmpresas.some((e) => e.clave === c)) && (
                            <> También le compra a empresas que no ves: esas no cambian.</>
                          )}
                          {!editingCliente && " Si ya existe en otra empresa, al guardar te ofrece sumarlo."}
                        </div>
                      </div>
                    )}

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
