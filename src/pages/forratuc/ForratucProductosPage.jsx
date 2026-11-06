import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import {
  obtenerProductosForratuc,
  obtenerConstantesProductosForratuc,
  guardarProductoForratuc,
} from "../../services/api";

/**
 * Productos de Forratuc (2026-11-02; por empresa desde el 2026-11-04).
 *
 * Forratuc vende los suyos (alimento balanceado y otros: los da de alta y los
 * administra enteros; uno nuevo lleva stock por depósito) y los de la AVÍCOLA
 * (pollo, trozado, huevo, pollitos), que administra la avícola en Avícola →
 * Productos: de esos, acá solo se cambia el código de Forratuc y si Forratuc
 * los vende. Inactivo = no aparece para vender; no se borra.
 */

const ORIGEN = {
  camara: "Cámara (Trigotuc / Cañete)",
  huevo: "Stock de huevo",
  pollito: "Pollitos del mostrador",
  deposito: "Depósito (Trigotuc / Forrajería)",
};

const vacio = () => ({ _id: null, propio: true, base: false, codigo: "", nombre: "", rubro: "otros", unidadVenta: "unidad", activo: true });

const ForratucProductosPage = () => {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [constantes, setConstantes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const cargar = async () => {
    try {
      const [ps, cs] = await Promise.all([obtenerProductosForratuc(), obtenerConstantesProductosForratuc()]);
      setProductos(ps);
      setConstantes(cs);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los productos.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const etiquetaRubro = (k) => constantes?.rubros?.find((r) => r.key === k)?.etiqueta || k;

  // Agrupados por rubro, en el orden del alta.
  const grupos = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const visibles = productos.filter(
      (p) => (verInactivos || p.activo) && (!q || `${p.codigo} ${p.nombre}`.toLowerCase().includes(q))
    );
    const porRubro = new Map();
    for (const p of visibles) porRubro.set(p.rubro, [...(porRubro.get(p.rubro) || []), p]);
    return [...porRubro];
  }, [productos, filtro, verInactivos]);

  const set = (cambios) => setForm((f) => ({ ...f, ...cambios }));

  // Una bolsa de alimento (2026-11-06): se elige el alimento del catálogo único
  // (Planta → Alimentos) y los kg; el nombre sale solo ("Postura Fase 1 x 40 kg").
  const esBolsa = !!form?.propio && (!!form.alimento || (!form._id && form.rubro === "alimento"));
  const alimentos = constantes?.alimentos || [];
  const nombreAlimento = (k) => alimentos.find((a) => a.key === k)?.nombre || "";
  const nombreBolsa = form && esBolsa && form.alimento && Number(String(form.kgBolsa).replace(",", ".")) > 0
    ? `${nombreAlimento(form.alimento)} x ${Number(String(form.kgBolsa).replace(",", ".")).toLocaleString("es-AR")} kg`
    : "";

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.codigo.trim()) return Swal.fire("Falta el código", "Poné el código del producto.", "warning");
    if (esBolsa) {
      if (!form.alimento) return Swal.fire("Falta el alimento", "Elegí el alimento de la bolsa.", "warning");
      if (!(Number(String(form.kgBolsa).replace(",", ".")) > 0)) return Swal.fire("Faltan los kg", "Poné de cuántos kg es la bolsa.", "warning");
    } else if (!form.nombre.trim()) return Swal.fire("Falta el nombre", "Poné el nombre del producto.", "warning");
    setSaving(true);
    try {
      // De uno de la avícola, solo el código y si Forratuc lo vende. De una
      // bolsa de alimento, el alimento y los kg (el nombre sale de ahí).
      await guardarProductoForratuc(form._id, esBolsa
        ? { codigo: form.codigo.trim(), activo: form.activo, rubro: "alimento", alimento: form.alimento, kgBolsa: String(form.kgBolsa).replace(",", ".") }
        : form.propio
        ? {
            codigo: form.codigo.trim(),
            nombre: form.nombre.trim(),
            activo: form.activo,
            ...(form.base ? {} : { rubro: form.rubro, unidadVenta: form.unidadVenta }),
          }
        : { codigo: form.codigo.trim(), activo: form.activoAca });
      Swal.fire({ icon: "success", title: "Producto guardado", timer: 1300, showConfirmButton: false });
      setForm(null);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
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
            <i className="bi bi-upc me-2 text-secondary"></i>
            Productos
          </h1>
          <button className="btn btn-primary btn-sm" onClick={() => setForm(vacio())}>
            <i className="bi bi-plus-lg me-1"></i>Nuevo producto
          </button>
        </div>

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
                  {/* Anchos fijos: cada rubro es su tabla y así las columnas quedan alineadas entre todas. */}
                  <table className="table table-sm table-hover align-middle mb-0" style={{ tableLayout: "fixed" }}>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p._id} className={p.activo ? "" : "text-muted"} role="button"
                          onClick={() => setForm({ ...p })} title={p.propio ? undefined : `De ${p.empresaNombre}: acá solo se cambia el código y si se vende`}>
                          <td className="fw-semibold" style={{ width: "8rem" }}>{p.codigo}</td>
                          <td className="text-truncate">
                            {p.nombre}
                            {!p.activo && <span className="badge bg-secondary ms-2">Inactivo</span>}
                          </td>
                          {/* Origen = la empresa dueña del producto (2026-11-04). */}
                          <td className="small text-muted d-none d-md-table-cell" style={{ width: "12rem" }}>{p.empresaNombre}</td>
                          <td className="small text-muted" style={{ width: "7rem" }}>por {p.unidadVenta}</td>
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
                      <div className="col-4">
                        <label className="form-label fw-semibold small mb-1">Código</label>
                        <input className="form-control" value={form.codigo} maxLength={20} autoFocus
                          onChange={(e) => set({ codigo: e.target.value })} />
                      </div>
                      <div className="col-8">
                        <label className="form-label fw-semibold small mb-1">Nombre</label>
                        <input className="form-control" value={esBolsa ? nombreBolsa : form.nombre} disabled={!form.propio || esBolsa}
                          placeholder={esBolsa ? "Sale del alimento y los kg" : undefined}
                          onChange={(e) => set({ nombre: e.target.value })} />
                      </div>
                      {esBolsa ? (
                        <>
                          {!form._id && (
                            <div className="col-12">
                              <label className="form-label fw-semibold small mb-1">Rubro</label>
                              <select className="form-select" value={form.rubro} onChange={(e) => set({ rubro: e.target.value })}>
                                {(constantes?.rubrosNuevo || []).map((r) => <option key={r.key} value={r.key}>{r.etiqueta}</option>)}
                              </select>
                            </div>
                          )}
                          <div className="col-8">
                            <label className="form-label fw-semibold small mb-1">Alimento</label>
                            <select className="form-select" value={form.alimento || ""} disabled={!!form._id}
                              onChange={(e) => set({ alimento: e.target.value })}>
                              <option value="">— Elegí —</option>
                              {alimentos.filter((a) => a.activo || a.key === form.alimento)
                                .map((a) => <option key={a.key} value={a.key}>{a.nombre}</option>)}
                            </select>
                          </div>
                          <div className="col-4">
                            <label className="form-label fw-semibold small mb-1">Bolsa de (kg)</label>
                            <input className="form-control" inputMode="decimal" value={form.kgBolsa ?? ""}
                              onChange={(e) => set({ kgBolsa: e.target.value })} />
                          </div>
                          <div className="col-12 small text-muted">
                            <i className="bi bi-info-circle me-1"></i>
                            Cada tamaño de bolsa es su artículo, con su precio y su stock. El nombre del alimento se
                            cambia en <strong>Planta → Alimentos</strong> y cambia en toda la app (planta, stock, ventas y envío a granjas).
                          </div>
                        </>
                      ) : !form.propio ? (
                        <div className="col-12 small text-muted">
                          <i className="bi bi-info-circle me-1"></i>
                          Producto de <strong>{form.empresaNombre}</strong>: el nombre y de dónde sale lo administra
                          ella (Avícola → Productos). Acá se cambia solo el código de Forratuc y si Forratuc lo vende.
                          {form.codigos?.avicola && form.codigos.avicola !== form.codigo && (
                            <> En la avícola es el código <strong>{form.codigos.avicola}</strong>.</>
                          )}
                        </div>
                      ) : form.base ? (
                        <div className="col-12 small text-muted">
                          {etiquetaRubro(form.rubro)} · se vende por {form.unidadVenta} · sale de {ORIGEN[form.origen] || form.origen}.
                          De los productos que ya existían se cambian código, nombre y si está activo.
                        </div>
                      ) : (
                        <>
                          <div className="col-6">
                            <label className="form-label fw-semibold small mb-1">Rubro</label>
                            <select className="form-select" value={form.rubro} onChange={(e) => set({ rubro: e.target.value })}>
                              {(constantes?.rubrosNuevo || []).map((r) => <option key={r.key} value={r.key}>{r.etiqueta}</option>)}
                            </select>
                          </div>
                          <div className="col-6">
                            <label className="form-label fw-semibold small mb-1">Se vende por</label>
                            <select className="form-select" value={form.unidadVenta} onChange={(e) => set({ unidadVenta: e.target.value })}>
                              {(constantes?.unidadesNuevo || []).map((u) => <option key={u.key} value={u.key}>{u.etiqueta}</option>)}
                            </select>
                          </div>
                          <div className="col-12 small text-muted">
                            Lleva stock por depósito (Trigotuc / Forrajería): entra con "Ingresar mercadería" en Stock y sale con el presupuesto.
                          </div>
                        </>
                      )}
                      <div className="col-12">
                        {form.propio ? (
                          <div className="form-check">
                            <input id="activo" type="checkbox" className="form-check-input" checked={form.activo}
                              onChange={(e) => set({ activo: e.target.checked })} />
                            <label htmlFor="activo" className="form-check-label">Activo (aparece para vender)</label>
                          </div>
                        ) : (
                          <>
                            <div className="form-check">
                              <input id="activo" type="checkbox" className="form-check-input" checked={form.activoAca}
                                onChange={(e) => set({ activoAca: e.target.checked })} />
                              <label htmlFor="activo" className="form-check-label">Forratuc lo vende</label>
                            </div>
                            {!form.activoDuena && (
                              <div className="small text-warning-emphasis mt-1">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                {form.empresaNombre} lo tiene inactivo: no se vende aunque esté tildado.
                              </div>
                            )}
                          </>
                        )}
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

export default ForratucProductosPage;
