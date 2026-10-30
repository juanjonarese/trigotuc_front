import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { escapeHtml } from "../../utils/escapeHtml";
import {
  obtenerCatalogoPreciosForratuc,
  obtenerListasPreciosForratuc,
  guardarListaPreciosForratuc,
  eliminarListaPreciosForratuc,
} from "../../services/api";

/**
 * Listas de precios de Forratuc (2026-10-29, observaciones del cliente).
 *
 * "Precio de lista" (2026-10-30) es la principal: la crea el back, es la por
 * defecto y no se borra. Las demás son de uno de dos tipos:
 *   · De PRECIOS: un precio por artículo del catálogo (el que manda el back, con
 *     la unidad con la que se cobra cada cosa). Vacío = sin precio.
 *   · De DESCUENTO: un % menos sobre el Precio de lista. No guarda precios:
 *     cambiar el Precio de lista cambia esta sola.
 *
 * Las listas no llevan clientes (2026-10-30): la lista se elige en cada venta,
 * en el presupuesto, que arranca en el Precio de lista. El precio se propone y
 * se corrige.
 */

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));

const UNIDAD = { kg: "kg", maple: "maple", pollito: "pollito", bolsa: "bolsa" };

const listaVacia = () => ({
  _id: null, nombre: "", tipo: "precios", precios: {}, porcentaje: "",
});

const ForratucListasPreciosPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [listas, setListas] = useState([]);
  const [form, setForm] = useState(null); // la lista que se edita (null = ninguna)

  const cargar = async () => {
    try {
      const [cat, lts] = await Promise.all([
        obtenerCatalogoPreciosForratuc(),
        obtenerListasPreciosForratuc(),
      ]);
      setCatalogo(cat);
      setListas(lts);
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
      precios: Object.fromEntries((l.precios || []).map((p) => [p.item, String(p.precio)])),
      porcentaje: l.porcentaje != null ? String(l.porcentaje) : "",
    });

  const set = (cambios) => setForm((f) => ({ ...f, ...cambios }));

  // Solo en el Precio de lista: sube (o baja, con negativo) todos los precios
  // cargados un %. Los vacíos siguen vacíos; se guarda recién con Guardar.
  const [ajuste, setAjuste] = useState("");
  const ajustarTodos = () => {
    const pct = Number(ajuste);
    if (!ajuste || !Number.isFinite(pct) || pct <= -100) {
      return Swal.fire("Porcentaje inválido", "Poné un % (ej.: 10 para subir, -5 para bajar).", "warning");
    }
    set({
      precios: Object.fromEntries(
        Object.entries(form.precios).map(([item, v]) =>
          [item, v === "" ? "" : String(Math.round(Number(v) * (1 + pct / 100) * 100) / 100)]
        )
      ),
    });
    setAjuste("");
  };

  // "Precio de lista": la principal (la por defecto). La crea el back, no se borra
  // y es la base de todos los %; de ella solo se editan los precios.
  const principal = listas.find((l) => l.porDefecto);
  const base = principal;
  const esPrincipal = Boolean(form?._id) && form._id === principal?._id;

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return Swal.fire("Falta el nombre", "Poné un nombre a la lista.", "warning");
    setSaving(true);
    try {
      await guardarListaPreciosForratuc(form._id, {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        precios: Object.entries(form.precios)
          .filter(([, v]) => v !== "")
          .map(([item, precio]) => ({ item, precio: Number(precio) })),
        porcentaje: form.tipo === "descuento" ? Number(form.porcentaje) : undefined,
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
                  Todavía no hay listas.
                </div>
              ) : (
                listas.map((l) => (
                  <div key={l._id}
                    className={`card border-0 shadow-sm mb-2 ${form?._id === l._id ? "border border-primary" : ""}`}
                    style={{ cursor: "pointer" }} onClick={() => editar(l)}>
                    <div className="card-body py-2">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="fw-semibold">
                          {l.nombre}
                          {l.porDefecto && <span className="badge bg-primary ms-2">Por defecto</span>}
                          {l.tipo === "descuento" && <span className="badge bg-light text-dark border ms-2">−{l.porcentaje}%</span>}
                        </div>
                        <div className="d-flex">
                          <button className="btn btn-sm btn-outline-primary border-0" title="Editar"
                            onClick={(e) => { e.stopPropagation(); editar(l); }}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          {!l.porDefecto && (
                            <button className="btn btn-sm btn-outline-danger border-0" title="Borrar"
                              onClick={(e) => { e.stopPropagation(); borrar(l); }}>
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
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
                    {esPrincipal ? (
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                        <h2 className="h5 mb-0">
                          {form.nombre}
                          <span className="badge bg-primary ms-2 align-middle fs-6">Por defecto</span>
                        </h2>
                        <div className="input-group input-group-sm" style={{ width: "auto" }}>
                          <span className="input-group-text">Subir / bajar todos</span>
                          <input type="number" step="0.01" className="form-control text-end sin-flechas" style={{ width: "5.5rem" }}
                            placeholder="10 / -5" value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
                          <span className="input-group-text">%</span>
                          <button type="button" className="btn btn-outline-primary" onClick={ajustarTodos}>Aplicar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="row g-3 mb-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label fw-semibold small mb-1">Nombre</label>
                          <input className="form-control" value={form.nombre} placeholder="Ej.: Mayorista, Revendedor"
                            onChange={(e) => set({ nombre: e.target.value })} />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label fw-semibold small mb-1">Tipo</label>
                          <div className="btn-group w-100">
                            <button type="button" className={`btn ${form.tipo === "precios" ? "btn-dark" : "btn-outline-secondary"}`}
                              onClick={() => set({ tipo: "precios" })}>
                              Precio por producto
                            </button>
                            <button type="button" className={`btn ${form.tipo === "descuento" ? "btn-dark" : "btn-outline-secondary"}`}
                              onClick={() => set({ tipo: "descuento" })}>
                              % sobre {principal?.nombre || "Precio de lista"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {form.tipo === "descuento" && !esPrincipal ? (
                      <div className="row g-3 mb-3">
                        <div className="col-12 col-md-5">
                          <label className="form-label fw-semibold small mb-1">Descuento</label>
                          <div className="input-group">
                            <input type="number" min="0" max="100" step="0.01" className="form-control sin-flechas" value={form.porcentaje}
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
                        {/* Mismo formato que la vista del %: el artículo a la izquierda, el precio a la derecha. */}
                        {grupos.map(([grupo, items]) => (
                          <div key={grupo} className="mb-3">
                            <div className="fw-semibold small text-uppercase text-primary mb-1">{grupo}</div>
                            <table className="table table-sm align-middle mb-0">
                              <tbody>
                                {items.map((c) => (
                                  <tr key={c.item}>
                                    <td className="small">{c.etiqueta}</td>
                                    <td className="text-end" style={{ width: "13rem" }}>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text">$</span>
                                        <input type="number" min="0" step="0.01" className="form-control text-end sin-flechas"
                                          value={form.precios[c.item] ?? ""}
                                          onChange={(e) => set({ precios: { ...form.precios, [c.item]: e.target.value } })} />
                                      </div>
                                    </td>
                                    <td className="small text-muted" style={{ width: "4.5rem" }}>/ {UNIDAD[c.unidad] || c.unidad}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="d-flex justify-content-end gap-2 border-top pt-3">
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
