import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import Pagination from "../../components/Pagination";
import { BADGE_ESPECIE, especieDe, etiquetaEspecie, claveEntero, claveTrozado } from "../../utils/especies";
import { formatearFechaLocal } from "../../utils/dateUtils";
import { obtenerStockForratuc, obtenerMovimientosStockForratuc } from "../../services/api";

/**
 * Stock de Forratuc (2026-10-26): todo lo que el local tiene para vender.
 *
 * Pollo, huevo y pollitos son stock de la avícola (entre empresas no se vende:
 * se usa el stock) y se leen igual que en el presupuesto. El alimento
 * balanceado es de Forratuc, que lo fabrica: se lleva en BOLSAS por alimento y
 * por depósito (Trigotuc y la forrajería).
 *
 * Mismo diseño que Frigorífico → Stock (pedido del usuario): arriba el total,
 * después una tarjeta por lugar (cámara, huevos, pollitos, cada depósito) y
 * abajo el historial del lugar que se toque, como cuenta corriente
 * (GET /stock-forratuc/movimientos/:lugar). Acá no se suma nada por cuenta
 * propia: todo viene del back.
 */
const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 1 });
const MOVIMIENTOS_POR_PAGINA = 100;

// El cuadrito del Frigorífico: etiqueta arriba, cantidad y una segunda línea.
const Cuadro = ({ badge, badgeClase = "bg-secondary-subtle text-secondary-emphasis", valor, sub }) => (
  <div className="text-center border rounded px-2 py-1">
    <span className={`badge d-block mb-1 ${badgeClase}`}>{badge}</span>
    <div className="fw-bold small">{valor}</div>
    {sub && <div className="text-muted" style={{ fontSize: "0.72rem" }}>{sub}</div>}
  </div>
);

const Grupo = ({ titulo, children }) => (
  <>
    <div className="text-muted small mb-1">{titulo}</div>
    <div className="d-flex flex-wrap gap-2 mb-2">{children}</div>
  </>
);

// Tarjeta de un lugar. Tocarla abre su historial abajo.
const TarjetaLugar = ({ icono, colorIcono, titulo, vacio, total, activa, onClick, children }) => (
  <div className="col-12 col-md-6">
    <div className={`card border-0 shadow-sm h-100 ${activa ? "border border-2 border-primary" : ""}`}
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}>
      <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className={`bi ${icono} me-2 ${colorIcono}`}></i>{titulo}
        </h6>
        <span className="small text-primary">
          <i className="bi bi-clock-history me-1"></i>Movimientos
        </span>
      </div>
      <div className="card-body py-2">
        {vacio ? <p className="text-muted small mb-0">Sin stock</p> : children}
        <div className="mt-1 text-muted small">Total: <strong>{total}</strong></div>
      </div>
    </div>
  </div>
);

const ForratucStockPage = () => {
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);

  // Historial del lugar elegido.
  const [lugar, setLugar] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [paginaMov, setPaginaMov] = useState(1);
  const historialRef = useRef(null);

  const cargar = async () => {
    setLoading(true);
    try {
      setStock(await obtenerStockForratuc());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const verMovimientos = async (key) => {
    setLugar(key);
    setHistorial(null);
    setPaginaMov(1);
    setCargandoHistorial(true);
    setTimeout(() => historialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    try {
      setHistorial(await obtenerMovimientosStockForratuc(key));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los movimientos.", "error");
    } finally {
      setCargandoHistorial(false);
    }
  };

  const actualizar = () => {
    cargar();
    if (lugar) verMovimientos(lugar);
  };

  const pollo = stock?.pollo;
  const huevos = stock?.huevos;
  const pollitos = stock?.pollitos;
  const alimento = stock?.alimento;
  const sinPesoBolsa = (alimento?.productos || []).some((p) => p.kgPorBolsa == null);

  const kgEntero = (pollo?.enteros || []).reduce((a, e) => a + e.cajones * 20, 0);
  const kgTrozado = (pollo?.trozados || []).reduce((a, t) => a + (t.kgTotal || 0), 0);

  const LUGARES = stock
    ? [
        { key: "camara", titulo: "Cámara Trigotuc" },
        { key: "huevos", titulo: "Huevos" },
        { key: "pollitos", titulo: "Pollitos del mostrador" },
        ...alimento.depositos.map((d) => ({ key: d.key, titulo: d.etiqueta })),
      ]
    : [];

  // El saldo viene calculado sobre la lista entera: recién acá se corta la página.
  const movimientos = historial?.movimientos || [];
  const movimientosPagina = movimientos.slice(
    (paginaMov - 1) * MOVIMIENTOS_POR_PAGINA,
    paginaMov * MOVIMIENTOS_POR_PAGINA
  );
  const ultimaPagina = paginaMov * MOVIMIENTOS_POR_PAGINA >= movimientos.length;
  const unidadCorta = { cajones: "caj", cajas: "cajas", huevos: "huevos", pollitos: "pollitos", bolsas: "bolsas" };
  const textoDelta = (m, signo) =>
    (historial?.unidades || [])
      .filter((u) => signo * (m.delta[u.key] || 0) > 0)
      .map((u) => `${fmt(Math.abs(m.delta[u.key]))} ${unidadCorta[u.key] || u.key}`)
      .join(" · ");

  return (
    <Layout>
      <div className="container-fluid">
        {/* ── Header ── */}
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <button className="btn btn-outline-secondary btn-sm me-2 align-middle" onClick={() => navigate("/forratuc")}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <i className="bi bi-boxes me-2 text-warning"></i>
            Forratuc — Stock
          </h1>
          <button className="btn btn-outline-secondary btn-sm" onClick={actualizar} title="Refrescar" disabled={loading}>
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>

        {loading && !stock ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : stock && (
          <>
            {/* ── Stock total ── */}
            <div className="card border-0 shadow-sm mb-2" style={{ background: "#f0f4f8" }}>
              <div className="card-header border-0 py-2" style={{ background: "transparent" }}>
                <h6 className="mb-0 text-secondary fw-semibold">
                  <i className="bi bi-layers me-2"></i>
                  Stock total — lo que el local tiene para vender
                </h6>
              </div>
              <div className="card-body py-3">
                <div className="d-flex flex-wrap gap-2">
                  <Cuadro badge="Pollo entero" badgeClase={BADGE_ESPECIE.pollo}
                    valor={`${fmt(pollo.totalCajones)} caj`} sub={`${fmt(kgEntero)} kg`} />
                  <Cuadro badge="Trozado" badgeClase={BADGE_ESPECIE.pollo}
                    valor={`${fmt(pollo.totalCajasTrozado)} cajas`} sub={`${fmt(kgTrozado)} kg`} />
                  <Cuadro badge="Huevos" badgeClase="bg-warning-subtle text-warning-emphasis"
                    valor={`${fmt(huevos.maples)} maples`} sub={`${fmt(huevos.total)} huevos`} />
                  <Cuadro badge="Pollitos" badgeClase="bg-info-subtle text-info-emphasis"
                    valor={`${fmt(pollitos.total)}`} sub="unidades" />
                  <Cuadro badge="Alimento balanceado" badgeClase="bg-success-subtle text-success-emphasis"
                    valor={`${fmt(alimento.totalBolsas)} bolsas`}
                    sub={alimento.depositos.map((d) => `${d.etiqueta.replace(/^Depósito /, "")} ${fmt(d.bolsas)}`).join(" · ")} />
                </div>
              </div>
            </div>

            {/* ── Separador ── */}
            <div className="d-flex align-items-center gap-2 mt-4 mb-3">
              <hr className="flex-grow-1 m-0" />
              <span className="text-muted fw-semibold text-uppercase px-2"
                style={{ fontSize: "0.72rem", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                <i className="bi bi-geo-alt me-1"></i>
                Por depósito y cámara
              </span>
              <hr className="flex-grow-1 m-0" />
            </div>

            {/* ── Una tarjeta por lugar ── */}
            <div className="row g-3 mb-4">
              <TarjetaLugar icono="bi-snow2" colorIcono="text-primary" titulo="Cámara Trigotuc"
                vacio={!pollo.enteros.length && !pollo.trozados.length}
                total={`${fmt(kgEntero + kgTrozado)} kg`}
                activa={lugar === "camara"} onClick={() => verMovimientos("camara")}>
                {pollo.enteros.length > 0 && (
                  <Grupo titulo="Faenado (entero)">
                    {pollo.enteros.map((e) => (
                      <Cuadro key={claveEntero(e)} badgeClase={BADGE_ESPECIE[especieDe(e)]}
                        badge={`${etiquetaEspecie(especieDe(e))} · Cal. ${e.calibre}`}
                        valor={`${fmt(e.cajones)} caj`} sub={`${fmt(e.cajones * 20)} kg`} />
                    ))}
                  </Grupo>
                )}
                {pollo.trozados.length > 0 && (
                  <Grupo titulo="Trozados">
                    {pollo.trozados.map((t) => (
                      <Cuadro key={claveTrozado(t)} badgeClase={BADGE_ESPECIE[especieDe(t)]}
                        badge={`${etiquetaEspecie(especieDe(t))} · ${t.etiqueta}${t.clase ? ` · ${t.clase}` : ""}`}
                        valor={`${fmt(t.cajas)} caj`} sub={`${fmt(t.kgTotal)} kg`} />
                    ))}
                  </Grupo>
                )}
              </TarjetaLugar>

              <TarjetaLugar icono="bi-egg" colorIcono="text-warning" titulo="Huevos"
                vacio={!huevos.porTipo.length}
                total={`${fmt(huevos.maples)} maples (${fmt(huevos.total)} huevos)`}
                activa={lugar === "huevos"} onClick={() => verMovimientos("huevos")}>
                <Grupo titulo="Para vender">
                  {huevos.porTipo.map((h) => (
                    <Cuadro key={h.tipo} badge={h.etiqueta} badgeClase="bg-warning-subtle text-warning-emphasis"
                      valor={`${fmt(h.maples)} maples`} sub={`${fmt(h.huevos)} huevos`} />
                  ))}
                </Grupo>
              </TarjetaLugar>

              <TarjetaLugar icono="bi-feather" colorIcono="text-info" titulo="Pollitos del mostrador"
                vacio={!pollitos.envios.length}
                total={`${fmt(pollitos.total)} pollitos`}
                activa={lugar === "pollitos"} onClick={() => verMovimientos("pollitos")}>
                <Grupo titulo="Por envío de Reproductoras">
                  {pollitos.envios.map((e) => (
                    <Cuadro key={e._id} badge={e.numero} badgeClase="bg-info-subtle text-info-emphasis"
                      valor={`${fmt(e.disponibles)} pollitos`}
                      sub={`${formatearFechaLocal(e.fecha)} · llegaron ${fmt(e.cantidad)}`} />
                  ))}
                </Grupo>
              </TarjetaLugar>

              {/* Una por depósito de alimento: salen de `alimento.depositos`,
                  así un depósito nuevo aparece solo. Adentro, lo que tiene stock. */}
              {alimento.depositos.map((d) => {
                const conStock = alimento.productos.filter((p) => p.porDeposito[d.key]);
                return (
                  <TarjetaLugar key={d.key} icono="bi-bag" colorIcono="text-success" titulo={d.etiqueta}
                    vacio={!conStock.length}
                    total={`${fmt(d.bolsas)} bolsas`}
                    activa={lugar === d.key} onClick={() => verMovimientos(d.key)}>
                    <Grupo titulo="Alimento balanceado">
                      {conStock.map((p) => (
                        <Cuadro key={p.alimento} badge={p.etiqueta} badgeClase="bg-success-subtle text-success-emphasis"
                          valor={`${fmt(p.porDeposito[d.key])} bolsas`}
                          sub={p.kgPorBolsa != null ? `${fmt(p.porDeposito[d.key] * p.kgPorBolsa)} kg` : null} />
                      ))}
                    </Grupo>
                  </TarjetaLugar>
                );
              })}
            </div>

            {alimento.totalBolsas === 0 && (
              <p className="text-muted small mb-1">
                <i className="bi bi-info-circle me-1"></i>
                Todavía no se cargó ningún ingreso de alimento: el stock arranca cuando se registre la producción.
              </p>
            )}
            {sinPesoBolsa && (
              <p className="text-muted small mb-1">
                <i className="bi bi-info-circle me-1"></i>
                Falta el peso de la bolsa de cada alimento para mostrar los kg.
              </p>
            )}

            {/* ── Historial de movimientos del lugar elegido ── */}
            <div className="card border-0 shadow-sm mt-4" ref={historialRef}>
              <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h6 className="mb-0">
                  <i className="bi bi-clock-history me-2 text-secondary"></i>
                  Historial de movimientos
                </h6>
                <div className="d-flex gap-2">
                  <select className="form-select form-select-sm" style={{ width: "auto" }}
                    value={lugar || ""} onChange={(e) => e.target.value && verMovimientos(e.target.value)}>
                    <option value="">Elegí un depósito o cámara…</option>
                    {LUGARES.map((l) => <option key={l.key} value={l.key}>{l.titulo}</option>)}
                  </select>
                  {lugar && (
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => { setLugar(null); setHistorial(null); }}>
                      Ocultar
                    </button>
                  )}
                </div>
              </div>
              {lugar && (
                <div className="card-body">
                  {cargandoHistorial ? (
                    <p className="text-muted small mb-0">Cargando…</p>
                  ) : !historial ? null : movimientos.length === 0 ? (
                    <p className="text-muted small mb-0">Sin movimientos registrados.</p>
                  ) : (
                    <>
                      <div className="alert alert-light border small py-2 mb-2">
                        <i className="bi bi-info-circle me-1"></i>
                        El saldo va como una cuenta corriente y es el que queda{" "}
                        <strong>después</strong> de cada movimiento, del más nuevo al más viejo. Arranca
                        del stock que hay hoy ({historial.unidades
                          .map((u) => `${fmt(historial.stockActual[u.key])} ${(unidadCorta[u.key] || u.key)}`)
                          .join(" y ")}) y se va hacia atrás, así que la primera fila siempre coincide con la realidad.
                      </div>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Operación</th>
                              <th>Detalle</th>
                              <th className="text-end text-success">Entrada</th>
                              <th className="text-end text-danger">Salida</th>
                              {historial.unidades.map((u, i) => (
                                <th key={u.key} className={`text-end ${i === 0 ? "border-start" : ""}`}>
                                  Saldo {(unidadCorta[u.key] || u.key)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {movimientosPagina.map((m, idx) => {
                              const entra = textoDelta(m, 1);
                              const sale = textoDelta(m, -1);
                              const tipo = m.noMueve ? "ajuste" : entra ? "ingreso" : "salida";
                              const tipoBadge = { ingreso: "success", salida: "danger", ajuste: "warning" }[tipo];
                              return (
                                <tr key={idx}>
                                  <td className="text-nowrap small">
                                    {m.soloFecha
                                      ? formatearFechaLocal(m.fecha)
                                      : new Date(m.fecha).toLocaleString("es-AR")}
                                  </td>
                                  <td className="small">
                                    <span className={`badge bg-${tipoBadge} me-1`}>{tipo}</span>
                                    {m.titulo}
                                  </td>
                                  <td className="small">
                                    {m.detalle || "—"}
                                    {m.usuario && <span className="text-muted"> · {m.usuario}</span>}
                                  </td>
                                  <td className="text-end small text-success fw-semibold">{entra}</td>
                                  <td className="text-end small text-danger fw-semibold">
                                    {sale || (m.noMueve
                                      ? <span className="text-muted fw-normal" title="Los ajustes guardan una foto de lo afectado, no un movimiento con signo: no mueven el saldo.">no mueve saldo</span>
                                      : "")}
                                  </td>
                                  {historial.unidades.map((u, i) => (
                                    <td key={u.key} className={`text-end small fw-bold ${i === 0 ? "border-start" : ""}`}>
                                      {fmt(m.saldo[u.key])}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                            {ultimaPagina && (
                              <tr className="table-light">
                                <td colSpan={5} className="small text-muted">Saldo anterior</td>
                                {historial.unidades.map((u, i) => (
                                  <td key={u.key} className={`text-end small fw-bold ${i === 0 ? "border-start" : ""}`}>
                                    {fmt(historial.saldoAnterior[u.key])}
                                  </td>
                                ))}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <Pagination currentPage={paginaMov} totalItems={movimientos.length}
                        itemsPerPage={MOVIMIENTOS_POR_PAGINA} onPageChange={setPaginaMov} />
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ForratucStockPage;
