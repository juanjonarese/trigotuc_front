import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import Pagination from "../../components/Pagination";
import IngresoMercaderiaModal from "../../components/forratuc/IngresoMercaderiaModal";
import { grupoDeposito } from "../../utils/forratuc/conteoStock";
import { formatearFechaLocal } from "../../utils/dateUtils";
import { obtenerDepositoProduccion, registrarIngresoProduccion, anularIngresoProduccion } from "../../services/api";

/**
 * Producción de la forrajería (2026-11-19, pedido del usuario: "vamos armando
 * la estructura"). La pantalla del rol `produccion` (también la ve el
 * superadmin), con tres solapas:
 *
 *   1. Depósito Producción: su stock, el historial y el ingreso manual de
 *      mercadería. Todo por /produccion-forratuc, que fija el depósito: este
 *      rol no ve ni toca los otros.
 *   2. Órdenes de carga: las que van a venir de los presupuestos. POR HACER.
 *   3. Planilla de dosificación: la que manda la planta de alimento. POR HACER.
 */

const SOLAPAS = [
  { key: "deposito", icono: "bi-box-seam", texto: "Depósito Producción" },
  { key: "ordenes", icono: "bi-truck", texto: "Órdenes de carga" },
  { key: "dosificacion", icono: "bi-clipboard2-data", texto: "Planilla de dosificación" },
];
const UNIDAD = { bolsa: "bolsas", unidad: "unidades", caja: "cajas", maple: "maples" };
const MOVIMIENTOS_POR_PAGINA = 15;
const fmt = (n) => Number(n || 0).toLocaleString("es-AR");

// Lo que todavía no está: se dice qué va a haber, para que la estructura se entienda.
const EnConstruccion = ({ icono, titulo, children }) => (
  <div className="card border-0 shadow-sm">
    <div className="card-body text-center py-5">
      <i className={`bi ${icono} display-5 text-muted`}></i>
      <h5 className="mt-3">{titulo}</h5>
      <div className="text-muted mx-auto" style={{ maxWidth: 560 }}>{children}</div>
      <span className="badge bg-warning text-dark mt-3"><i className="bi bi-cone-striped me-1"></i>En construcción</span>
    </div>
  </div>
);

const ForratucProduccionPage = () => {
  const [solapa, setSolapa] = useState("deposito");
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verTodos, setVerTodos] = useState(false);
  const [ingresoAbierto, setIngresoAbierto] = useState(false);
  const [pagina, setPagina] = useState(1);

  const cargar = async () => {
    setLoading(true);
    try {
      setDatos(await obtenerDepositoProduccion());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo leer el depósito.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  // El stock, agrupado como en el Stock de Forratuc (alimento por categoría, otros).
  const grupos = useMemo(() => {
    const visibles = (datos?.productos || []).filter((p) => verTodos || p.cantidad !== 0);
    return [...new Set(visibles.map(grupoDeposito))]
      .map((titulo) => ({ titulo, items: visibles.filter((p) => grupoDeposito(p) === titulo) }));
  }, [datos, verTodos]);

  const movimientos = datos?.historial?.movimientos || [];
  const pagMov = movimientos.slice((pagina - 1) * MOVIMIENTOS_POR_PAGINA, pagina * MOVIMIENTOS_POR_PAGINA);

  const anular = async (m) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Anular este ingreso?", text: m.detalle, icon: "warning",
      showCancelButton: true, confirmButtonText: "Sí, anular", confirmButtonColor: "#dc3545", cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await anularIngresoProduccion(m.id);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h1 className="h3 mb-0">
            <i className="bi bi-building-gear me-2 text-success"></i>Producción
          </h1>
          {solapa === "deposito" && (
            <div className="d-flex gap-2">
              <button className="btn btn-success btn-sm" onClick={() => setIngresoAbierto(true)} disabled={!datos}>
                <i className="bi bi-box-arrow-in-down me-1"></i>Ingresar mercadería
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={cargar} title="Refrescar" disabled={loading}>
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          )}
        </div>

        <ul className="nav nav-tabs mb-3">
          {SOLAPAS.map((s) => (
            <li key={s.key} className="nav-item">
              <button className={`nav-link ${solapa === s.key ? "active" : ""}`} onClick={() => setSolapa(s.key)}>
                <i className={`bi ${s.icono} me-1`}></i>{s.texto}
              </button>
            </li>
          ))}
        </ul>

        {/* ══════════ 1. DEPÓSITO PRODUCCIÓN ══════════ */}
        {solapa === "deposito" && (
          loading && !datos ? (
            <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
          ) : datos && (
            <div className="row g-3">
              <div className="col-12 col-xl-5">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <span className="fw-semibold">{datos.deposito.etiqueta}</span>
                    <span className="badge bg-success">{fmt(datos.total)} unid.</span>
                  </div>
                  <div className="card-body p-0">
                    {grupos.length === 0 ? (
                      <div className="text-muted small p-3">
                        El depósito está vacío. La mercadería entra con <strong>Ingresar mercadería</strong>.
                      </div>
                    ) : (
                      <table className="table table-sm align-middle mb-0">
                        <tbody>
                          {grupos.map((g) => (
                            <React.Fragment key={g.titulo}>
                              <tr className="table-light"><td colSpan={3} className="small fw-semibold">{g.titulo}</td></tr>
                              {g.items.map((p) => (
                                <tr key={p.alimento}>
                                  <td className="small text-muted" style={{ width: 60 }}>{p.codigo}</td>
                                  <td className="small">{p.etiqueta}</td>
                                  <td className={`small text-end fw-semibold ${p.cantidad < 0 ? "text-danger" : ""}`}>
                                    {fmt(p.cantidad)} <span className="text-muted fw-normal">{UNIDAD[p.unidad] || p.unidad}</span>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="card-footer bg-white">
                    <div className="form-check small mb-0">
                      <input id="verTodos" type="checkbox" className="form-check-input" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
                      <label htmlFor="verTodos" className="form-check-label">Ver también los que están en cero</label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-xl-7">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header bg-white fw-semibold">Movimientos</div>
                  <div className="card-body p-0">
                    {movimientos.length === 0 ? (
                      <div className="text-muted small p-3">Todavía no hay movimientos.</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead className="table-light">
                            <tr><th className="small">Fecha</th><th className="small">Movimiento</th><th className="small">Detalle</th>
                              <th className="small text-end">Entra</th><th className="small text-end">Sale</th><th className="small text-end">Saldo</th></tr>
                          </thead>
                          <tbody>
                            {pagMov.map((m, i) => (
                              <tr key={`${m.id || ""}${i}`}>
                                <td className="small text-nowrap">{formatearFechaLocal(m.fecha)}</td>
                                <td className="small">{m.titulo}</td>
                                <td className="small">
                                  {m.detalle || "—"}
                                  {m.usuario && <span className="text-muted"> · {m.usuario}</span>}
                                  {m.anulable === "ingreso" && (
                                    <button className="btn btn-link btn-sm text-danger p-0 ms-2 align-baseline" onClick={() => anular(m)}>anular</button>
                                  )}
                                </td>
                                <td className="small text-end text-success fw-semibold">{m.delta.bolsas > 0 ? fmt(m.delta.bolsas) : ""}</td>
                                <td className="small text-end text-danger fw-semibold">{m.delta.bolsas < 0 ? fmt(-m.delta.bolsas) : ""}</td>
                                <td className="small text-end fw-bold">{fmt(m.saldo?.bolsas)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {movimientos.length > MOVIMIENTOS_POR_PAGINA && (
                    <div className="card-footer bg-white">
                      <Pagination currentPage={pagina} totalItems={movimientos.length}
                        itemsPerPage={MOVIMIENTOS_POR_PAGINA} onPageChange={setPagina} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {/* ══════════ 2. ÓRDENES DE CARGA (en construcción) ══════════ */}
        {solapa === "ordenes" && (
          <EnConstruccion icono="bi-truck" titulo="Órdenes de carga">
            Acá van a llegar las <strong>órdenes de carga que salen de los presupuestos</strong>: qué hay que
            preparar y cargar, para quién y cuándo. Producción las ve, las prepara y las marca como cargadas.
          </EnConstruccion>
        )}

        {/* ══════════ 3. PLANILLA DE DOSIFICACIÓN (en construcción) ══════════ */}
        {solapa === "dosificacion" && (
          <EnConstruccion icono="bi-clipboard2-data" titulo="Planilla de dosificación">
            La <strong>planilla de dosificación que manda la planta de alimento</strong>: por cada alimento a
            elaborar, los kg de cada materia prima por bachada (como la planilla de papel).
          </EnConstruccion>
        )}

        {ingresoAbierto && datos && (
          <IngresoMercaderiaModal
            depositos={[datos.deposito]}
            productos={datos.productos.filter((p) => p.activo)}
            registrar={registrarIngresoProduccion}
            onClose={() => setIngresoAbierto(false)}
            onGuardado={() => { setIngresoAbierto(false); cargar(); }}
          />
        )}
      </div>
    </Layout>
  );
};

export default ForratucProduccionPage;
