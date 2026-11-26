import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { obtenerClientes, crearCliente, actualizarCliente, eliminarCliente, obtenerEmpresas, obtenerListasPreciosForratuc } from "../services/api";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import Swal from "sweetalert2";
import { escapeHtml } from "../utils/escapeHtml";
import { empresaActual, clienteDeEmpresa, obtenerEmpresasUsuario, colorEmpresa, nombreEmpresa } from "../utils/empresas";
import { buscarParecidos } from "../utils/clientesParecidos";
import { TIPOS_CLIENTE, CONDICIONES_IVA, RUBROS_CLIENTE, tipoCliente, cargarLocalidades } from "../utils/clientes";
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

const BadgeTipo = ({ cliente }) =>
  tipoCliente(cliente) === "consumidor_final" ? (
    <span className="badge bg-secondary-subtle text-secondary-emphasis border fw-normal ms-2">Consumidor final</span>
  ) : null;

// Formulario del alta (2026-11-26, "alta clientes/Clientes Datos.xlsx"): datos
// personales, impositivos y, si es de cuenta corriente, comerciales.
const VACIO = {
  tipo: "cuenta_corriente",
  codigo: "",
  razonSocial: "",
  dni: "",
  direccion: "",
  provincia: "Tucumán",
  localidad: "",
  codigoPostal: "",
  telefono: "",
  email: "",
  contacto: "",
  autorizados: [],
  cuit: "",
  condicionIva: "",
  ingresosBrutos: "",
  exentoIB: false,
  alicuotaIB: "",
  exentoGanancias: false,
  topeCuentaCorriente: "",
  plazoPago: "",
  responsableComercial: "",
  rubros: [],
  listaPrecioForratuc: "",
};

const desdeCliente = (c) => ({
  ...VACIO,
  ...Object.fromEntries(Object.keys(VACIO).map((k) => [k, c[k] ?? VACIO[k]])),
  codigo: c.codigo ?? "",
  provincia: c.provincia || "",
  autorizados: (c.autorizados || []).map((a) => ({ nombre: a.nombre || "", dni: a.dni || "" })),
  rubros: c.rubros || [],
  listaPrecioForratuc: c.listaPrecioForratuc ? String(c.listaPrecioForratuc) : "",
});

const Seccion = ({ titulo, children }) => (
  <fieldset className="mb-3">
    <legend className="fs-6 fw-semibold text-success border-bottom pb-1 mb-2">{titulo}</legend>
    {children}
  </fieldset>
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

  const [formData, setFormData] = useState(VACIO);
  const [localidades, setLocalidades] = useState(null); // { provincia: [localidades] }
  const [listasForratuc, setListasForratuc] = useState(null); // null = no se pudieron leer

  // A qué empresas del grupo le compra el cliente (2026-10-16). El padrón es
  // uno solo para todo el grupo.
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
  const veForratuc = catalogoEmpresas.some((e) => e.clave === "forratuc");

  // Las listas de precios de Forratuc, para la lista del cliente.
  useEffect(() => {
    if (!veForratuc) return;
    obtenerListasPreciosForratuc()
      .then((l) => setListasForratuc(Array.isArray(l) ? l : null))
      .catch(() => setListasForratuc(null));
  }, [veForratuc]);

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
      setFormData(desdeCliente(cliente));
      setEmpresasCliente(empresasDe(cliente));
    } else {
      // Un alta arranca en la empresa desde la que se entró a Clientes.
      setEmpresasCliente([empresaActual(location.pathname)]);
      setEditingCliente(null);
      setFormData(VACIO);
    }
    if (!localidades) cargarLocalidades().then(setLocalidades).catch(() => setLocalidades({}));
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCliente(null);
    setFormData(VACIO);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };
  const set = (cambios) => setFormData((f) => ({ ...f, ...cambios }));
  const toggleRubro = (key) =>
    set({ rubros: formData.rubros.includes(key) ? formData.rubros.filter((r) => r !== key) : [...formData.rubros, key] });
  const setAutorizado = (i, cambios) =>
    set({ autorizados: formData.autorizados.map((a, j) => (j === i ? { ...a, ...cambios } : a)) });

  const provincias = useMemo(() => Object.keys(localidades || {}), [localidades]);
  const localidadesProvincia = localidades?.[formData.provincia] || [];
  const responsables = useMemo(
    () => [...new Set(clientes.map((c) => c.responsableComercial).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [clientes]
  );

  // Las que este usuario puede tildar, y de esas, las tildadas.
  const tildadasVisibles = empresasCliente.filter((c) => catalogoEmpresas.some((e) => e.clave === c));

  // Alta (2026-11-16): antes de crear, si en el padrón ya hay uno igual (mismo
  // teléfono, CUIT o DNI) o parecido (nombre), se ofrece sumarlo a esta empresa en
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
        ? "Ya hay un cliente con ese teléfono, CUIT o DNI. Podés <strong>sumarlo</strong> a las empresas tildadas, sin cargarlo de nuevo."
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
    const datos = {
      ...formData,
      autorizados: formData.autorizados.filter((a) => a.nombre.trim()),
      // Un alta sin código toma el siguiente.
      codigo: formData.codigo === "" && !editingCliente ? undefined : formData.codigo,
      // La lista solo si se pudieron leer las listas (si no, no se toca).
      listaPrecioForratuc: listasForratuc ? formData.listaPrecioForratuc || null : undefined,
      empresas: empresasCliente,
    };
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
  // Se busca por nombre, código, CUIT, DNI o teléfono.
  const empresa = empresaActual(location.pathname);
  const termino = searchTerm.trim().toLowerCase();
  const clientesFiltrados = clientes
    .filter((cliente) =>
      clienteDeEmpresa(cliente, empresa) &&
      (!termino ||
        `${cliente.razonSocial || ""} ${cliente.codigo ?? ""} ${cliente.cuit || ""} ${cliente.dni || ""} ${cliente.telefono || ""} ${cliente.localidad || ""}`
          .toLowerCase()
          .includes(termino))
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

  const esCuentaCorriente = formData.tipo === "cuenta_corriente";

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
            placeholder="Buscar por nombre, código, CUIT, DNI o teléfono..."
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
                          <span className="fw-semibold">
                            {cliente.codigo != null && <span className="text-muted me-1">{cliente.codigo} ·</span>}
                            {cliente.razonSocial}
                            <BadgeTipo cliente={cliente} />
                          </span>
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
                        {cliente.cuit && <small className="text-muted d-block">CUIT: {cliente.cuit}</small>}
                        {cliente.dni && <small className="text-muted d-block">DNI: {cliente.dni}</small>}
                        {cliente.localidad && <small className="text-muted d-block">{cliente.localidad}{cliente.provincia ? `, ${cliente.provincia}` : ""}</small>}
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
                        <th>Código</th>
                        <th>Nombre / Razón social</th>
                        <th>CUIT / DNI</th>
                        <th>Localidad</th>
                        <th>Teléfono</th>
                        {esSuperadmin && <th>Le compra a</th>}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((cliente) => (
                        <tr key={cliente._id}>
                          <td className="text-muted">{cliente.codigo ?? "-"}</td>
                          <td>{cliente.razonSocial}<BadgeTipo cliente={cliente} /></td>
                          <td>{cliente.cuit || (cliente.dni ? `DNI ${cliente.dni}` : "-")}</td>
                          <td>{cliente.localidad || "-"}</td>
                          <td>{cliente.telefono || "-"}</td>
                          {esSuperadmin && (
                            <td><BadgesEmpresas claves={empresasDe(cliente)} catalogo={catalogoEmpresas} /></td>
                          )}
                          <td className="text-nowrap">
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
            <div className="modal-dialog modal-alta modal-dialog-scrollable my-3">
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
                <form onSubmit={handleSubmit} autoComplete="off" className="d-flex flex-column overflow-hidden">
                  <input type="text" style={{display: 'none'}} />
                  <input type="password" style={{display: 'none'}} />
                  <div className="modal-body">
                    {/* Tipo: cuenta corriente (con datos comerciales) o consumidor final (solo contado). */}
                    <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
                      <div>
                        <div className="form-label small mb-1">Tipo de cliente</div>
                        <div className="btn-group" role="group">
                          {TIPOS_CLIENTE.map((t) => (
                            <button key={t.key} type="button"
                              className={`btn btn-sm ${formData.tipo === t.key ? "btn-success" : "btn-outline-secondary"}`}
                              onClick={() => set({ tipo: t.key })}>
                              {t.etiqueta}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ width: 110 }}>
                        <label htmlFor="codigo" className="form-label small mb-1">Código</label>
                        <input type="number" min="1" step="1" className="form-control form-control-sm" id="codigo" name="codigo"
                          value={formData.codigo} onChange={handleChange} placeholder={editingCliente ? "" : "Automático"} />
                      </div>
                    </div>
                    {!esCuentaCorriente && (
                      <div className="form-text mt-n2 mb-3">El consumidor final compra al contado: no puede llevar en cuenta corriente.</div>
                    )}

                    <Seccion titulo="Datos personales">
                      <div className="row g-2">
                        <div className="col-md-8">
                          <label htmlFor="razonSocial" className="form-label small mb-1">
                            Apellido y nombres / Razón social <span className="text-danger">*</span>
                          </label>
                          <input type="text" className="form-control" id="razonSocial" name="razonSocial"
                            value={formData.razonSocial} onChange={handleChange} autoComplete="off" data-form-type="other" required />
                        </div>
                        <div className="col-md-4">
                          <label htmlFor="dni" className="form-label small mb-1">DNI</label>
                          <input type="text" inputMode="numeric" className="form-control" id="dni" name="dni"
                            value={formData.dni} onChange={handleChange} autoComplete="off" />
                        </div>
                        <div className="col-12">
                          <label htmlFor="direccion" className="form-label small mb-1">Dirección</label>
                          <input type="text" className="form-control" id="direccion" name="direccion"
                            value={formData.direccion} onChange={handleChange} autoComplete="off" data-form-type="other" />
                        </div>
                        <div className="col-md-5">
                          <label htmlFor="provincia" className="form-label small mb-1">Provincia</label>
                          <select className="form-select" id="provincia" name="provincia" value={formData.provincia}
                            onChange={(e) => set({ provincia: e.target.value, localidad: "" })}>
                            <option value="">—</option>
                            {formData.provincia && !provincias.includes(formData.provincia) && (
                              <option value={formData.provincia}>{formData.provincia}</option>
                            )}
                            {provincias.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label htmlFor="localidad" className="form-label small mb-1">Localidad</label>
                          <input type="text" className="form-control" id="localidad" name="localidad" list="localidades-provincia"
                            value={formData.localidad} onChange={handleChange} autoComplete="off"
                            placeholder={formData.provincia ? "Elegí o escribí" : "Elegí la provincia"} />
                          <datalist id="localidades-provincia">
                            {localidadesProvincia.map((l) => <option key={l} value={l} />)}
                          </datalist>
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="codigoPostal" className="form-label small mb-1">Cód. postal</label>
                          <input type="text" className="form-control" id="codigoPostal" name="codigoPostal"
                            value={formData.codigoPostal} onChange={handleChange} autoComplete="off" />
                        </div>
                        <div className="col-md-5">
                          <label htmlFor="telefono" className="form-label small mb-1">Nro. de celular</label>
                          <input type="tel" className="form-control" id="telefono" name="telefono"
                            value={formData.telefono} onChange={handleChange} placeholder="381-1234567" autoComplete="off" data-form-type="other" />
                        </div>
                        <div className="col-md-7">
                          <label htmlFor="email" className="form-label small mb-1">Mail</label>
                          <input type="email" className="form-control" id="email" name="email"
                            value={formData.email} onChange={handleChange} placeholder="cliente@ejemplo.com" autoComplete="off" data-form-type="other" />
                        </div>
                        <div className="col-12">
                          <label htmlFor="contacto" className="form-label small mb-1">Contacto</label>
                          <input type="text" className="form-control" id="contacto" name="contacto"
                            value={formData.contacto} onChange={handleChange} placeholder="Persona de contacto (si es una empresa)" autoComplete="off" />
                        </div>
                      </div>

                      {/* Autorizados para retirar */}
                      <div className="mt-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="form-label small mb-0">Autorizados para retirar</span>
                          <button type="button" className="btn btn-sm btn-link p-0"
                            onClick={() => set({ autorizados: [...formData.autorizados, { nombre: "", dni: "" }] })}>
                            <i className="bi bi-plus-lg me-1"></i>Agregar
                          </button>
                        </div>
                        {formData.autorizados.length === 0 && <div className="form-text mt-0">Nadie cargado.</div>}
                        {formData.autorizados.map((a, i) => (
                          <div key={i} className="d-flex gap-2 mb-1">
                            <input type="text" className="form-control form-control-sm" placeholder="Apellido y nombre"
                              value={a.nombre} onChange={(e) => setAutorizado(i, { nombre: e.target.value })} />
                            <input type="text" inputMode="numeric" className="form-control form-control-sm" style={{ maxWidth: 130 }} placeholder="DNI"
                              value={a.dni} onChange={(e) => setAutorizado(i, { dni: e.target.value })} />
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Quitar"
                              onClick={() => set({ autorizados: formData.autorizados.filter((_, j) => j !== i) })}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </Seccion>

                    <Seccion titulo="Datos impositivos">
                      <div className="row g-2">
                        <div className="col-md-5">
                          <label htmlFor="cuit" className="form-label small mb-1">CUIT</label>
                          <input type="text" className="form-control" id="cuit" name="cuit"
                            value={formData.cuit} onChange={handleChange} placeholder="30-12345678-9" autoComplete="off" data-form-type="other" />
                        </div>
                        <div className="col-md-7">
                          <label htmlFor="condicionIva" className="form-label small mb-1">Categoría de IVA</label>
                          <select className="form-select" id="condicionIva" name="condicionIva" value={formData.condicionIva} onChange={handleChange}>
                            <option value="">—</option>
                            {CONDICIONES_IVA.map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
                          </select>
                        </div>
                        <div className="col-12 small fw-semibold mt-2">Exenciones impositivas</div>
                        <div className="col-md-5">
                          <label htmlFor="ingresosBrutos" className="form-label small mb-1">Ingresos Brutos (n°)</label>
                          <input type="text" className="form-control" id="ingresosBrutos" name="ingresosBrutos"
                            value={formData.ingresosBrutos} onChange={handleChange} autoComplete="off" />
                        </div>
                        <div className="col-md-4 d-flex align-items-end">
                          <div className="form-check mb-2">
                            <input className="form-check-input" type="checkbox" id="exentoIB" name="exentoIB"
                              checked={formData.exentoIB} onChange={handleChange} />
                            <label className="form-check-label small" htmlFor="exentoIB">Exento de IB</label>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <label htmlFor="alicuotaIB" className="form-label small mb-1">Percepción IB</label>
                          <div className="input-group">
                            <input type="number" min="0" max="100" step="0.001" className="form-control" id="alicuotaIB" name="alicuotaIB"
                              value={formData.alicuotaIB} onChange={handleChange} disabled={formData.exentoIB} />
                            <span className="input-group-text">%</span>
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" id="exentoGanancias" name="exentoGanancias"
                              checked={formData.exentoGanancias} onChange={handleChange} />
                            <label className="form-check-label small" htmlFor="exentoGanancias">Exento de Ganancias</label>
                          </div>
                        </div>
                      </div>
                    </Seccion>

                    {esCuentaCorriente && (
                      <Seccion titulo="Datos comerciales">
                        <div className="row g-2">
                          {/* Límite de crédito = tope de cuenta corriente (2026-11-12); la cuenta corriente es de Forratuc. */}
                          {empresasCliente.includes("forratuc") && (
                            <div className="col-md-6">
                              <label htmlFor="topeCuentaCorriente" className="form-label small mb-1">Límite de crédito</label>
                              <div className="input-group">
                                <span className="input-group-text">$</span>
                                <input type="number" min="0" step="0.01" className="form-control" id="topeCuentaCorriente" name="topeCuentaCorriente"
                                  value={formData.topeCuentaCorriente} onChange={handleChange} placeholder="Sin límite" />
                              </div>
                              <div className="form-text">Vacío = sin límite; 0 = no se le fía. El presupuesto no deja pasarlo.</div>
                            </div>
                          )}
                          <div className="col-md-6">
                            <label htmlFor="plazoPago" className="form-label small mb-1">Plazo de pago</label>
                            <div className="input-group">
                              <input type="number" min="0" step="1" className="form-control" id="plazoPago" name="plazoPago"
                                value={formData.plazoPago} onChange={handleChange} />
                              <span className="input-group-text">días</span>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <label htmlFor="responsableComercial" className="form-label small mb-1">Responsable comercial</label>
                            <input type="text" className="form-control" id="responsableComercial" name="responsableComercial" list="responsables-comerciales"
                              value={formData.responsableComercial} onChange={handleChange} autoComplete="off" />
                            <datalist id="responsables-comerciales">
                              {responsables.map((r) => <option key={r} value={r} />)}
                            </datalist>
                          </div>
                          {empresasCliente.includes("forratuc") && listasForratuc && (
                            <div className="col-md-6">
                              <label htmlFor="listaPrecioForratuc" className="form-label small mb-1">Lista de precios y bonificaciones</label>
                              <select className="form-select" id="listaPrecioForratuc" name="listaPrecioForratuc"
                                value={formData.listaPrecioForratuc} onChange={handleChange}>
                                <option value="">Se elige en su primera venta</option>
                                {listasForratuc.map((l) => (
                                  <option key={l._id} value={l._id}>
                                    {l.nombre}{l.tipo === "descuento" ? ` (${l.porcentaje}% menos)` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="col-12">
                            <div className="form-label small mb-1">Rubro</div>
                            <div className="d-flex flex-wrap gap-3">
                              {RUBROS_CLIENTE.map((r) => (
                                <div key={r.key} className="form-check">
                                  <input className="form-check-input" type="checkbox" id={`rubro-${r.key}`}
                                    checked={formData.rubros.includes(r.key)} onChange={() => toggleRubro(r.key)} />
                                  <label className="form-check-label small" htmlFor={`rubro-${r.key}`}>{r.etiqueta}</label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </Seccion>
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
