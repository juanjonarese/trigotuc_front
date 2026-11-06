import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import Layout from "../components/Layout";
import {
  obtenerProductosAvicola,
  obtenerConstantesProductosAvicola,
  guardarProductoAvicola,
} from "../services/api";

/**
 * Productos de la avícola (2026-11-04, decisión del usuario): cada empresa
 * administra los suyos. Los de la avícola son pollo entero, trozado, huevo y
 * pollitos; los vende Forratuc, que de ellos solo cambia su código y si los
 * vende.
 *
 * Se dan de alta A MANO (la faena no cambia): el producto se vincula con el
 * stock por lo que se elige acá — especie + calibre, especie + corte + clase,
 * o de qué tipos del stock de huevo sale —, no por el nombre. Esos datos no se
 * editan después: son el vínculo. Inactivo = no lo vende nadie; no se borra.
 */

const DESCRIPCION_ORIGEN = {
  camara: "Cámara",
  huevo: "Stock de huevo",
  pollito: "Pollitos del mostrador",
};

const vacio = () => ({
  _id: null, rubro: "pollo", codigo: "", nombre: "", activo: true,
  especie: "pollo", calibre: "", tipo: "", claseTrozado: "", tiposStock: [],
});

const AvicolaProductosPage = () => {
  const [productos, setProductos] = useState([]);
  const [constantes, setConstantes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    try {
      const [ps, cs] = await Promise.all([obtenerProductosAvicola(), obtenerConstantesProductosAvicola()]);
      setProductos(Array.isArray(ps) ? ps : []);
      setConstantes(cs);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los productos.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const etiquetaRubro = (k) => constantes?.rubros?.find((r) => r.key === k)?.etiqueta || k;
  const especie = (k) => constantes?.especies?.find((e) => e.key === k);
  const corte = (k) => constantes?.cortes?.find((c) => c.key === k);
  const etiquetaHuevo = (k) => constantes?.tiposHuevo?.find((t) => t.key === k)?.etiqueta || k;

  // Con qué se vincula al stock, en palabras.
  const vinculo = (p) => {
    if (p.rubro === "pollo") return `${especie(p.especie)?.etiqueta || p.especie} · calibre ${p.calibre}`;
    if (p.rubro === "trozado")
      return `${especie(p.especie)?.etiqueta || p.especie} · ${corte(p.tipo)?.etiqueta || p.tipo}` +
        ((corte(p.tipo)?.clases?.length || 0) > 1 ? ` clase ${p.claseTrozado}` : "");
    if (p.rubro === "huevo") return (p.tiposStock || [p.tipo]).map(etiquetaHuevo).join(" + ");
    return DESCRIPCION_ORIGEN[p.origen] || p.origen;
  };

  const grupos = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const visibles = productos.filter(
      (p) => (verInactivos || p.activo) && (!q || `${p.codigo} ${p.nombre}`.toLowerCase().includes(q))
    );
    const porRubro = new Map();
    for (const p of visibles) porRubro.set(p.rubro, [...(porRubro.get(p.rubro) || []), p]);
    return [...porRubro];
  }, [productos, filtro, verInactivos]);

  // Un tipo de huevo sale de un solo producto: los que ya tiene otro no se ofrecen.
  const tiposHuevoTomados = useMemo(() => {
    const m = new Map();
    for (const p of productos) if (p.rubro === "huevo" && p._id !== form?._id) for (const t of p.tiposStock || []) m.set(t, p.nombre);
    return m;
  }, [productos, form?._id]);
  const hayPollitos = productos.some((p) => p.rubro === "pollito");

  const set = (cambios) => setForm((f) => ({ ...f, ...cambios }));
  const alternarTipo = (t) =>
    set({ tiposStock: form.tiposStock.includes(t) ? form.tiposStock.filter((x) => x !== t) : [...form.tiposStock, t] });

  const guardar = async (e) => {
    e.preventDefault();
    const nuevo = !form._id;
    const conPropuesta = ["pollo", "trozado"].includes(form.rubro);
    if (!form.codigo.trim() && !(nuevo && conPropuesta)) return Swal.fire("Falta el código", "Poné el código del producto.", "warning");
    if (!form.nombre.trim() && !(nuevo && conPropuesta)) return Swal.fire("Falta el nombre", "Poné el nombre del producto.", "warning");
    if (form.rubro === "huevo" && form.tiposStock.length === 0)
      return Swal.fire("Falta de dónde sale", "Tildá de qué huevo del stock sale.", "warning");
    if (nuevo && form.rubro === "pollo" && !form.calibre) return Swal.fire("Falta el calibre", "Elegí el calibre.", "warning");
    if (nuevo && form.rubro === "trozado" && (!form.tipo || !form.claseTrozado))
      return Swal.fire("Falta el corte", "Elegí el corte y la clase.", "warning");

    setSaving(true);
    try {
      const data = nuevo
        ? {
            rubro: form.rubro, codigo: form.codigo.trim(), nombre: form.nombre.trim(), activo: form.activo,
            ...(form.rubro === "pollo" ? { especie: form.especie, calibre: Number(form.calibre) } : {}),
            ...(form.rubro === "trozado" ? { especie: form.especie, tipo: form.tipo, claseTrozado: form.claseTrozado } : {}),
            ...(form.rubro === "huevo" ? { tiposStock: form.tiposStock } : {}),
          }
        : {
            codigo: form.codigo.trim(), nombre: form.nombre.trim(), activo: form.activo,
            ...(form.rubro === "huevo" ? { tiposStock: form.tiposStock } : {}),
          };
      await guardarProductoAvicola(form._id, data);
      Swal.fire({ icon: "success", title: "Producto guardado", timer: 1300, showConfirmButton: false });
      setForm(null);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const esp = especie(form?.especie);
  const cor = corte(form?.tipo);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-upc me-2 text-secondary"></i>
            Productos de la avícola
          </h1>
          <button className="btn btn-primary btn-sm" onClick={() => setForm(vacio())}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo producto
          </button>
        </div>
        <p className="text-muted small mb-4">
          Pollo entero, trozado, huevo y pollitos. Los vende Forratuc, que de ellos solo cambia su código y si los vende.
          Cada producto sale del stock que se elige al darlo de alta.
        </p>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <input className="form-control form-control-sm" style={{ maxWidth: 320 }}
                placeholder="Buscar por código o nombre" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              <div className="form-check mb-0">
                <input id="verInactivos" type="checkbox" className="form-check-input" checked={verInactivos}
                  onChange={(e) => setVerInactivos(e.target.checked)} />
                <label htmlFor="verInactivos" className="form-check-label small">Ver inactivos</label>
              </div>
            </div>

            {loading ? (
              <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
            ) : grupos.length === 0 ? (
              <div className="text-muted text-center py-4">Ningún producto coincide.</div>
            ) : (
              grupos.map(([rubro, items]) => (
                <div key={rubro} className="mb-3">
                  <div className="fw-semibold small text-uppercase text-primary mb-1">{etiquetaRubro(rubro)}</div>
                  <table className="table table-sm table-hover align-middle mb-0" style={{ tableLayout: "fixed" }}>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p._id} className={p.activo ? "" : "text-muted"} role="button"
                          onClick={() => setForm({ ...vacio(), ...p, tiposStock: p.tiposStock || [] })}>
                          <td className="fw-semibold" style={{ width: "8rem" }}>{p.codigo}</td>
                          <td className="text-truncate">
                            {p.nombre}
                            {!p.activo && <span className="badge bg-secondary ms-2">Inactivo</span>}
                          </td>
                          <td className="small text-muted d-none d-md-table-cell text-truncate" style={{ width: "18rem" }}>{vinculo(p)}</td>
                          <td className="small text-muted d-none d-lg-table-cell" style={{ width: "11rem" }}>
                            {p.codigos?.forratuc && p.codigos.forratuc !== p.codigo && <>En Forratuc: {p.codigos.forratuc}</>}
                          </td>
                          <td className="text-end" style={{ width: "3rem" }}>
                            <i className="bi bi-pencil text-primary"></i>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ══════════ MODAL: ALTA / EDICIÓN ══════════ */}
        {form && (
          <>
            <div className="modal d-block" tabIndex="-1" role="dialog">
              <div className="modal-dialog" role="document">
                <form className="modal-content" onSubmit={guardar}>
                  <div className="modal-header">
                    <h5 className="modal-title">{form._id ? "Editar producto" : "Nuevo producto"}</h5>
                    <button type="button" className="btn-close" onClick={() => setForm(null)} disabled={saving}></button>
                  </div>
                  <div className="modal-body">
                    <div className="row g-3">
                      {!form._id ? (
                        <div className="col-12">
                          <label className="form-label fw-semibold small mb-1">Rubro</label>
                          <select className="form-select" value={form.rubro}
                            onChange={(e) => set({ rubro: e.target.value, calibre: "", tipo: "", claseTrozado: "", tiposStock: [] })}>
                            {(constantes?.rubrosNuevo || []).map((r) => (
                              <option key={r.key} value={r.key} disabled={r.key === "pollito" && hayPollitos}>
                                {r.etiqueta}{r.key === "pollito" && hayPollitos ? " (ya está)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="col-12 small text-muted">
                          {etiquetaRubro(form.rubro)} · sale de: <strong>{vinculo(form)}</strong>
                          {form.rubro !== "huevo" && <> (no se cambia: es el vínculo con el stock)</>}
                        </div>
                      )}

                      {/* Con qué se vincula al stock (solo en el alta). */}
                      {!form._id && (form.rubro === "pollo" || form.rubro === "trozado") && (
                        <div className="col-6">
                          <label className="form-label fw-semibold small mb-1">Especie</label>
                          <select className="form-select" value={form.especie} onChange={(e) => set({ especie: e.target.value, calibre: "" })}>
                            {(constantes?.especies || []).map((x) => <option key={x.key} value={x.key}>{x.etiqueta}</option>)}
                          </select>
                        </div>
                      )}
                      {!form._id && form.rubro === "pollo" && (
                        <div className="col-6">
                          <label className="form-label fw-semibold small mb-1">Calibre</label>
                          <select className="form-select" value={form.calibre} onChange={(e) => set({ calibre: e.target.value })}>
                            <option value="">Elegí…</option>
                            {(esp?.calibres || []).map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}
                      {!form._id && form.rubro === "trozado" && (
                        <>
                          <div className="col-6">
                            <label className="form-label fw-semibold small mb-1">Corte</label>
                            <select className="form-select" value={form.tipo}
                              onChange={(e) => {
                                const clases = corte(e.target.value)?.clases || [];
                                set({ tipo: e.target.value, claseTrozado: clases.length === 1 ? clases[0] : "" });
                              }}>
                              <option value="">Elegí…</option>
                              {(constantes?.cortes || []).map((x) => <option key={x.key} value={x.key}>{x.etiqueta}</option>)}
                            </select>
                          </div>
                          {(cor?.clases?.length || 0) > 1 && (
                            <div className="col-6">
                              <label className="form-label fw-semibold small mb-1">Clase</label>
                              <select className="form-select" value={form.claseTrozado} onChange={(e) => set({ claseTrozado: e.target.value })}>
                                <option value="">Elegí…</option>
                                {cor.clases.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                      {form.rubro === "huevo" && (
                        <div className="col-12">
                          <label className="form-label fw-semibold small mb-1">Sale del stock de</label>
                          {(constantes?.tiposHuevo || []).map((t) => {
                            const de = tiposHuevoTomados.get(t.key);
                            return (
                              <div className="form-check" key={t.key}>
                                <input id={`th-${t.key}`} type="checkbox" className="form-check-input"
                                  checked={form.tiposStock.includes(t.key)} disabled={Boolean(de)}
                                  onChange={() => alternarTipo(t.key)} />
                                <label htmlFor={`th-${t.key}`} className={`form-check-label ${de ? "text-muted" : ""}`}>
                                  {t.etiqueta}{de && <span className="small"> — ya sale de "{de}"</span>}
                                </label>
                              </div>
                            );
                          })}
                          <div className="form-text">Si son varios, se vende por antigüedad entre todos (el más viejo primero).</div>
                        </div>
                      )}
                      {!form._id && form.rubro === "pollito" && (
                        <div className="col-12 small text-muted">Sale del stock de pollitos del mostrador (los envíos de Reproductoras).</div>
                      )}

                      <div className="col-4">
                        <label className="form-label fw-semibold small mb-1">Código</label>
                        <input className="form-control" value={form.codigo} maxLength={20}
                          placeholder={!form._id && ["pollo", "trozado"].includes(form.rubro) ? "Propuesto" : ""}
                          onChange={(e) => set({ codigo: e.target.value })} />
                      </div>
                      <div className="col-8">
                        <label className="form-label fw-semibold small mb-1">Nombre</label>
                        <input className="form-control" value={form.nombre}
                          placeholder={!form._id && ["pollo", "trozado"].includes(form.rubro) ? "Se arma solo (ej. Pollo entero calibre 7)" : ""}
                          onChange={(e) => set({ nombre: e.target.value })} />
                      </div>
                      {!form._id && ["pollo", "trozado"].includes(form.rubro) && (
                        <div className="col-12 form-text mt-0">
                          Sin código, se propone uno (100 + calibre, 201 + corte…). En Forratuc arranca con el mismo código.
                        </div>
                      )}
                      <div className="col-12">
                        <div className="form-check">
                          <input id="activo" type="checkbox" className="form-check-input" checked={form.activo}
                            onChange={(e) => set({ activo: e.target.checked })} />
                          <label htmlFor="activo" className="form-check-label">Activo (inactivo = no lo vende nadie)</label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)} disabled={saving}>Cancelar</button>
                    <button type="submit" className="btn btn-success" disabled={saving}>
                      {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check-lg me-1"></i>}
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <div className="modal-backdrop show"></div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AvicolaProductosPage;
