import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import BuscadorCliente from "../../components/BuscadorCliente";
import { escapeHtml } from "../../utils/escapeHtml";
import {
  obtenerClientes,
  obtenerCatalogoPreciosForratuc,
  obtenerListasPreciosForratuc,
  guardarListaPreciosForratuc,
  eliminarListaPreciosForratuc,
} from "../../services/api";

/**
 * Listas de precios de Forratuc (2026-10-29, observaciones del cliente): se
 * arman varias, para la venta al público o con % de descuento según el cliente.
 *
 *   · De PRECIOS: un precio por artículo del catálogo (el que manda el back, con
 *     la unidad con la que se cobra cada cosa). Vacío = sin precio.
 *   · De DESCUENTO: un % menos sobre una lista de precios. No guarda precios:
 *     cambiar la base cambia esta sola.
 *
 * Cada cliente va en una sola lista; a quien no está en ninguna se le propone la
 * marcada "por defecto". En el presupuesto el precio se propone y se corrige.
 */

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(n || 0));

const UNIDAD = { kg: "kg", maple: "maple", pollito: "pollito", bolsa: "bolsa" };

const listaVacia = () => ({
  _id: null, nombre: "", tipo: "precios", porDefecto: false, precios: {}, base: "", porcentaje: "", clientes: [],
});

const ForratucListasPreciosPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [listas, setListas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(null); // la lista que se edita (null = ninguna)

  const cargar = async () => {
    try {
      const [cat, lts, cls] = await Promise.all([
        obtenerCatalogoPreciosForratuc(),
        obtenerListasPreciosForratuc(),
        obtenerClientes().catch(() => []),
      ]);
      setCatalogo(cat);
      setListas(lts);
      setClientes(
        [...(Array.isArray(cls) ? cls : [])].sort((a, b) =>
          String(a.razonSocial || "").localeCompare(String(b.razonSocial || ""))
        )
      );
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar las listas.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const grupos = useMemo(() => {
    const porGrupo = new Map();
    for (const c of catalogo) porGrupo.set(c.grupo, [...(porGrupo.get(c.grupo) || []), c]);
    return [...porGrupo];
  }, [catalogo]);

  const editar = (l) =>
    setForm({
      _id: l._id,
      nombre: l.nombre,
      tipo: l.tipo,
      porDefecto: l.porDefecto,
      precios: Object.fromEntries((l.precios || []).map((p) => [p.item, String(p.precio)])),
      base: l.base ? String(l.base) : "",
      porcentaje: l.porcentaje != null ? String(l.porcentaje) : "",
      clientes: (l.clientes || []).map((c) => ({ _id: c._id, razonSocial: c.razonSocial })),
    });

  const set = (cambios) => setForm((f) => ({ ...f, ...cambios }));
  const bases = listas.filter((l) => l.tipo === "precios" && l._id !== form?._id);
  const base = listas.find((l) => l._id === form?.base);

  // Un cliente en una sola lista: se avisa acá, el back igual lo rebota.
  const listaDeCliente = (id) => listas.find((l) => l._id !== form?._id && (l.clientes || []).some((c) => c._id === id));
  const agregarCliente = (id) => {
    if (!id || form.clientes.some((c) => c._id === id)) return;
    const otra = listaDeCliente(id);
    const c = clientes.find((x) => x._id === id);
    if (otra) return Swal.fire("Ya tiene lista", `${c?.razonSocial || "Ese cliente"} está en "${otra.nombre}". Sacalo de ahí primero.`, "warning");
    set({ clientes: [...form.clientes, { _id: id, razonSocial: c?.razonSocial || "" }] });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return Swal.fire("Falta el nombre", "Poné un nombre a la lista.", "warning");
    setSaving(true);
    try {
      await guardarListaPreciosForratuc(form._id, {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        porDefecto: form.porDefecto,
        precios: Object.entries(form.precios)
          .filter(([, v]) => v !== "")
          .map(([item, precio]) => ({ item, precio: Number(precio) })),
        base: form.tipo === "descuento" ? form.base : undefined,
        porcentaje: form.tipo === "descuento" ? Number(form.porcentaje) : undefined,
        clientes: form.clientes.map((c) => c._id),
      });
      Swal.fire({ icon: "success", title: "Lista guardada", timer: 1300, showConfirmButton: false });
      setForm(null);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (l) => {
    const { isConfirmed } = await Swal.fire({
      title: `¿Borrar la lista "${escapeHtml(l.nombre)}"?`,
      text: "Los presupuestos ya emitidos no cambian: cada renglón guardó su precio.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await eliminarListaPreciosForratuc(l._id);
      if (form?._id === l._id) setForm(null);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo borrar.", "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <button className="btn btn-outline-secondary btn-sm me-2 align-middle" onClick={() => navigate("/forratuc")}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <i className="bi bi-tags me-2 text-secondary"></i>
            Listas de precios
          </h1>
          <button className="btn btn-primary btn-sm" onClick={() => setForm(listaVacia())}>
            <i className="bi bi-plus-lg me-1"></i>Nueva lista
          </button>
        </div>

        {loading ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : (
          <div className="row g-3">
            {/* ── Las listas ── */}
            <div className="col-12 col-lg-4">
              {listas.length === 0 ? (
                <div className="text-muted text-center py-4 border rounded bg-white">
                  Todavía no hay listas. Empezá por la de venta al público.
                </div>
              ) : (
                listas.map((l) => (
                  <div key={l._id}
                    className={`card border-0 shadow-sm mb-2 ${form?._id === l._id ? "border border-primary" : ""}`}
                    style={{ cursor: "pointer" }} onClick={() => editar(l)}>
                    <div className="card-body py-2">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="fw-semibold">
                            {l.nombre}
                            {l.porDefecto && <span className="badge bg-primary ms-2">Por defecto</span>}
                          </div>
                          <div className="small text-muted">
                            {l.tipo === "descuento"
                              ? `${fmt(l.porcentaje)}% menos sobre "${l.baseNombre || "—"}"`
                              : `${(l.precios || []).length} artículos con precio`}
                            {" · "}
                            {(l.clientes || []).length
                              ? `${l.clientes.length} ${l.clientes.length === 1 ? "cliente" : "clientes"}`
                              : "sin clientes"}
                          </div>
                        </div>
                        <button className="btn btn-sm btn-outline-danger border-0" title="Borrar"
                          onClick={(e) => { e.stopPropagation(); borrar(l); }}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Editor ── */}
            <div className="col-12 col-lg-8">
              {!form ? (
                <div className="text-muted text-center py-5 border rounded bg-white">
                  Elegí una lista para editarla, o armá una nueva.
                </div>
              ) : (
                <form className="card border-0 shadow-sm" onSubmit={guardar}>
                  <div className="card-body">
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold small mb-1">Nombre</label>
                        <input className="form-control" value={form.nombre} placeholder="Ej.: Público, Mayorista 10%"
                          onChange={(e) => set({ nombre: e.target.value })} />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-semibold small mb-1">Tipo</label>
                        <div className="btn-group w-100">
                          <button type="button" className={`btn ${form.tipo === "precios" ? "btn-dark" : "btn-outline-secondary"}`}
                            onClick={() => set({ tipo: "precios" })}>
                            Con precios
                          </button>
                          <button type="button" className={`btn ${form.tipo === "descuento" ? "btn-dark" : "btn-outline-secondary"}`}
                            onClick={() => set({ tipo: "descuento" })} disabled={bases.length === 0}
                            title={bases.length === 0 ? "Primero armá una lista con precios" : undefined}>
                            % de descuento sobre otra
                          </button>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="form-check">
                          <input id="porDefecto" type="checkbox" className="form-check-input" checked={form.porDefecto}
                            onChange={(e) => set({ porDefecto: e.target.checked })} />
                          <label htmlFor="porDefecto" className="form-check-label small">
                            Por defecto: la que se propone a quien no está en ninguna lista (venta al público)
                          </label>
                        </div>
                      </div>
                    </div>

                    {form.tipo === "descuento" ? (
                      <div className="row g-3 mb-3">
                        <div className="col-12 col-md-7">
                          <label className="form-label fw-semibold small mb-1">Sobre la lista</label>
                          <select className="form-select" value={form.base} onChange={(e) => set({ base: e.target.value })}>
                            <option value="">Elegí…</option>
                            {bases.map((b) => <option key={b._id} value={b._id}>{b.nombre}</option>)}
                          </select>
                        </div>
                        <div className="col-12 col-md-5">
                          <label className="form-label fw-semibold small mb-1">Descuento</label>
                          <div className="input-group">
                            <input type="number" min="0" max="100" step="0.01" className="form-control" value={form.porcentaje}
                              onChange={(e) => set({ porcentaje: e.target.value })} />
                            <span className="input-group-text">%</span>
                          </div>
                        </div>
                        {base && Number(form.porcentaje) > 0 && (
                          <div className="col-12">
                            <div className="small text-muted mb-1">Así quedan los precios:</div>
                            <table className="table table-sm mb-0">
                              <tbody>
                                {catalogo.filter((c) => base.preciosResueltos?.[c.item] != null).map((c) => (
                                  <tr key={c.item}>
                                    <td className="small">{c.etiqueta}</td>
                                    <td className="small text-muted text-end text-decoration-line-through">{pesos(base.preciosResueltos[c.item])}</td>
                                    <td className="small fw-semibold text-end">
                                      {pesos(Math.round(base.preciosResueltos[c.item] * (1 - Number(form.porcentaje) / 100) * 100) / 100)}
                                      <span className="text-muted fw-normal"> / {UNIDAD[c.unidad] || c.unidad}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-3">
                        <div className="small text-muted mb-2">Vacío = sin precio en esta lista (en el presupuesto se escribe a mano).</div>
                        {grupos.map(([grupo, items]) => (
                          <div key={grupo} className="mb-3">
                            <div className="fw-semibold small text-uppercase text-secondary mb-1">{grupo}</div>
                            <div className="row g-2">
                              {items.map((c) => (
                                <div key={c.item} className="col-12 col-md-6 col-xl-4">
                                  <div className="input-group input-group-sm">
                                    <span className="input-group-text flex-grow-1 text-truncate" style={{ maxWidth: "55%" }} title={c.etiqueta}>
                                      {c.etiqueta}
                                    </span>
                                    <span className="input-group-text">$</span>
                                    <input type="number" min="0" step="0.01" className="form-control"
                                      value={form.precios[c.item] ?? ""}
                                      onChange={(e) => set({ precios: { ...form.precios, [c.item]: e.target.value } })} />
                                    <span className="input-group-text">/ {UNIDAD[c.unidad] || c.unidad}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-top pt-3 mb-3">
                      <label className="form-label fw-semibold small mb-1">Clientes con esta lista</label>
                      <BuscadorCliente clientes={clientes} value="" onChange={agregarCliente}
                        placeholder="Agregar un cliente: buscá por nombre, CUIT o teléfono..." />
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        {form.clientes.length === 0 && <span className="small text-muted">Ninguno.</span>}
                        {form.clientes.map((c) => (
                          <span key={c._id} className="badge bg-light text-dark border d-flex align-items-center gap-1 py-2">
                            {c.razonSocial}
                            <button type="button" className="btn-close btn-close-sm ms-1" style={{ fontSize: "0.6rem" }}
                              aria-label="Quitar" onClick={() => set({ clientes: form.clientes.filter((x) => x._id !== c._id) })} />
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="d-flex justify-content-end gap-2">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
                      <button type="submit" className="btn btn-success" disabled={saving}>
                        {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check-lg me-1"></i>}
                        Guardar
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ForratucListasPreciosPage;
