import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import {
  obtenerListasPrecios,
  crearListaPrecio,
  actualizarListaPrecio,
  eliminarListaPrecio,
} from "../services/api";
import Swal from "sweetalert2";

const CALIBRES = [5, 6, 7, 8, 9, 10, 11];

const preciosVacios = () =>
  CALIBRES.map((c) => ({ calibre: c, precioPorCajon: 0 }));

const ListasPreciosPage = () => {
  const rolUsuario = localStorage.getItem("rolUsuario");
  const esAdmin = rolUsuario === "admin";

  const [listas, setListas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLista, setEditingLista] = useState(null);
  const [form, setForm] = useState({ nombre: "", activa: true, precios: preciosVacios() });
  const [saving, setSaving] = useState(false);

  const cargarListas = async () => {
    try {
      const data = await obtenerListasPrecios();
      setListas(data.listas || []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las listas de precios.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarListas();
  }, []);

  const abrirModal = (lista = null) => {
    if (lista) {
      setEditingLista(lista);
      // Mezclar precios guardados con la grilla completa
      const preciosMapa = {};
      (lista.precios || []).forEach((p) => {
        preciosMapa[p.calibre] = p.precioPorCajon;
      });
      setForm({
        nombre: lista.nombre,
        activa: lista.activa,
        precios: CALIBRES.map((c) => ({ calibre: c, precioPorCajon: preciosMapa[c] ?? 0 })),
      });
    } else {
      setEditingLista(null);
      setForm({ nombre: "", activa: true, precios: preciosVacios() });
    }
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditingLista(null);
  };

  const handlePrecioChange = (calibre, valor) => {
    setForm((prev) => ({
      ...prev,
      precios: prev.precios.map((p) =>
        p.calibre === calibre ? { ...p, precioPorCajon: Number(valor) } : p
      ),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      Swal.fire("Error", "El nombre es requerido.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        activa: form.activa,
        precios: form.precios.filter((p) => p.precioPorCajon > 0),
      };
      if (editingLista) {
        await actualizarListaPrecio(editingLista._id, payload);
        Swal.fire("Actualizado", "Lista actualizada correctamente.", "success");
      } else {
        await crearListaPrecio(payload);
        Swal.fire("Creado", "Lista creada correctamente.", "success");
      }
      cerrarModal();
      cargarListas();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar la lista.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (lista) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar lista?",
      html: `Se eliminará <strong>${lista.nombre}</strong>. Los clientes que la tengan asignada quedarán sin lista.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
    });
    if (!confirm.isConfirmed) return;
    try {
      await eliminarListaPrecio(lista._id);
      Swal.fire("Eliminado", "Lista eliminada correctamente.", "success");
      cargarListas();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar.", "error");
    }
  };

  const formatARS = (n) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-tags me-2 text-success"></i>
            Listas de Precios
          </h1>
          {esAdmin && (
            <button className="btn btn-success" onClick={() => abrirModal()}>
              <i className="bi bi-plus-circle me-1"></i>
              Nueva lista
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-success" role="status"></div>
          </div>
        ) : listas.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-tags fs-1 d-block mb-2"></i>
            No hay listas de precios creadas.
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="d-md-none">
              {listas.map((lista) => (
                <div key={lista._id} className="card border mb-3">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span className="fw-semibold fs-6">{lista.nombre}</span>
                        <span
                          className={`badge ms-2 ${lista.activa ? "bg-success" : "bg-secondary"}`}
                        >
                          {lista.activa ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      {esAdmin && (
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => abrirModal(lista)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleEliminar(lista)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {(lista.precios || []).map((p) => (
                        <span key={p.calibre} className="badge bg-light text-dark border">
                          Cal.{p.calibre}: {formatARS(p.precioPorCajon)}/caj
                        </span>
                      ))}
                      {(!lista.precios || lista.precios.length === 0) && (
                        <span className="text-muted small">Sin precios cargados</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabla */}
            <div className="d-none d-md-block card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Nombre</th>
                      <th>Precios por calibre</th>
                      <th>Estado</th>
                      {esAdmin && <th style={{ width: 100 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {listas.map((lista) => (
                      <tr key={lista._id}>
                        <td className="fw-semibold">{lista.nombre}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {(lista.precios || []).map((p) => (
                              <span key={p.calibre} className="badge bg-light text-dark border">
                                Cal.{p.calibre}: {formatARS(p.precioPorCajon)}/caj
                              </span>
                            ))}
                            {(!lista.precios || lista.precios.length === 0) && (
                              <span className="text-muted small">—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${lista.activa ? "bg-success" : "bg-secondary"}`}
                          >
                            {lista.activa ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        {esAdmin && (
                          <td>
                            <button
                              className="btn btn-sm btn-warning me-1"
                              onClick={() => abrirModal(lista)}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleEliminar(lista)}
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
            </div>
          </>
        )}

        {/* Modal */}
        {showModal && (
          <>
            <div className="modal show d-block" tabIndex="-1">
              <div className="modal-dialog modal-fullscreen-sm-down modal-lg modal-dialog-scrollable">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editingLista ? "Editar Lista de Precios" : "Nueva Lista de Precios"}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={cerrarModal}
                    ></button>
                  </div>
                  <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          Nombre <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={form.nombre}
                          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                          placeholder="Ej: Lista A, Mayorista, Minorista..."
                          required
                        />
                      </div>

                      <div className="mb-3">
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="activaSwitch"
                            checked={form.activa}
                            onChange={(e) => setForm({ ...form, activa: e.target.checked })}
                          />
                          <label className="form-check-label" htmlFor="activaSwitch">
                            Lista activa
                          </label>
                        </div>
                      </div>

                      <label className="form-label fw-semibold">Precios por calibre ($/cajón)</label>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm">
                          <thead className="table-light">
                            <tr>
                              <th>Calibre</th>
                              <th>Pollos/cajón</th>
                              <th>kg/pollo ≈</th>
                              <th>Precio por cajón ($)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.precios.map((p) => (
                              <tr key={p.calibre}>
                                <td className="fw-semibold">Calibre {p.calibre}</td>
                                <td className="text-muted">{p.calibre}</td>
                                <td className="text-muted">{(20 / p.calibre).toFixed(2)}</td>
                                <td>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={p.precioPorCajon}
                                    onChange={(e) =>
                                      handlePrecioChange(p.calibre, e.target.value)
                                    }
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <small className="text-muted">
                        Solo se guardan los calibres con precio mayor a 0.
                      </small>
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={cerrarModal}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="btn btn-success" disabled={saving}>
                        {saving && (
                          <span className="spinner-border spinner-border-sm me-1"></span>
                        )}
                        {editingLista ? "Actualizar" : "Crear"}
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

export default ListasPreciosPage;
