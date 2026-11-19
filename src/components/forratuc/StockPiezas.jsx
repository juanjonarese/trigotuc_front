import React, { useMemo, useState } from "react";
import Pagination from "../Pagination";
import { formatearFechaLocal } from "../../utils/dateUtils";
import { imprimirHistorialStock } from "../../utils/forratuc/imprimirForratuc";
import { filtrarHistorial, opcionesFiltro, exportarHistorialExcel } from "../../utils/forratuc/historialStock";
import { fmt, UNIDADES } from "../../utils/forratuc/formatoStock";

/**
 * Las piezas del Stock de Forratuc (2026-11-19): las usan la pantalla de Stock
 * y la de Producción, así las dos se ven igual (pedido del usuario: "que el
 * depósito de producción tenga el mismo diseño que stock").
 */


// El cuadrito del Frigorífico: etiqueta arriba, cantidad y una segunda línea.
export const Cuadro = ({ badge, badgeClase = "bg-secondary-subtle text-secondary-emphasis", valor, sub }) => (
  <div className="text-center border rounded px-2 py-1">
    <span className={`badge d-block mb-1 ${badgeClase}`}>{badge}</span>
    <div className="fw-bold small">{valor}</div>
    {sub && <div className="text-muted" style={{ fontSize: "0.72rem" }}>{sub}</div>}
  </div>
);

export const Grupo = ({ titulo, children }) => (
  <>
    <div className="text-muted small mb-1">{titulo}</div>
    <div className="d-flex flex-wrap gap-2 mb-2">{children}</div>
  </>
);

// Tarjeta de un lugar. Tocarla abre su historial abajo.
export const TarjetaLugar = ({ icono, colorIcono, titulo, vacio, total, activa, onClick, ancho = "col-12 col-md-6", children }) => (
  <div className={ancho}>
    <div className={`card border-0 shadow-sm h-100 ${activa ? "border border-2 border-primary" : ""}`}
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}>
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

// Los cuadritos de los productos de un depósito, agrupados (`grupos` =
// [{ titulo, items }], items de GET /stock-forratuc → alimento.productos).
export const CuadrosDeposito = ({ grupos, cantidadDe }) =>
  grupos.map((g) => (
    <Grupo key={g.titulo} titulo={g.titulo}>
      {g.items.map((p) => (
        <Cuadro key={p.alimento} badge={`${p.codigo} · ${p.etiqueta}`} badgeClase="bg-success-subtle text-success-emphasis"
          valor={`${fmt(cantidadDe(p))} ${UNIDADES[p.unidad] || p.unidad}`}
          sub={p.kgPorBolsa != null ? `${fmt(cantidadDe(p) * p.kgPorBolsa)} kg` : null} />
      ))}
    </Grupo>
  ));

const MOVIMIENTOS_POR_PAGINA = 100;
// En los depósitos "bolsas" es la cantidad, cada producto en su unidad.
const unidadCorta = { cajones: "caj", cajas: "cajas", huevos: "huevos", pollitos: "pollitos", bolsas: "unid." };

/**
 * El historial de un lugar como cuenta corriente: filtro por rubro / producto,
 * Imprimir, Excel, la tabla con su saldo y la paginación. `historial` es la
 * respuesta de /stock-forratuc/movimientos/:lugar (o la de Producción, igual).
 * Montarlo con `key={lugar}` para que el filtro arranque de cero al cambiar.
 */
export const HistorialStock = ({ historial, cargando, tituloLugar, mostrarRubro = false, onAnular, onImprimirAjuste }) => {
  const [filtroRubro, setFiltroRubro] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [pagina, setPagina] = useState(1);

  // Con el filtro, cada fila se queda con lo filtrado y el saldo se rehace para
  // eso (utils/forratuc/historialStock.js).
  const vista = useMemo(
    () => filtrarHistorial(historial, { rubro: filtroRubro, producto: filtroProducto }),
    [historial, filtroRubro, filtroProducto]
  );
  const opciones = useMemo(() => opcionesFiltro(historial, filtroRubro), [historial, filtroRubro]);
  const hayFiltro = Boolean(filtroRubro || filtroProducto);
  const textoFiltro = [filtroRubro, opciones.productos.find((x) => x.key === filtroProducto)?.nombre].filter(Boolean).join(" · ");
  const exportar = (como) => {
    const opts = { lugar: tituloLugar, filtros: textoFiltro, operador: localStorage.getItem("nombreUsuario") || "" };
    if (como === "excel") exportarHistorialExcel(vista, opts);
    else imprimirHistorialStock(vista, opts);
  };

  // El saldo viene calculado sobre la lista entera: recién acá se corta la página.
  const movimientos = vista?.movimientos || [];
  const movimientosPagina = movimientos.slice((pagina - 1) * MOVIMIENTOS_POR_PAGINA, pagina * MOVIMIENTOS_POR_PAGINA);
  const ultimaPagina = pagina * MOVIMIENTOS_POR_PAGINA >= movimientos.length;
  const textoDelta = (m, signo) =>
    (vista?.unidades || [])
      .filter((u) => signo * (m.delta[u.key] || 0) > 0)
      .map((u) => `${fmt(Math.abs(m.delta[u.key]))} ${unidadCorta[u.key] || u.key}`)
      .join(" · ");

  return (
    <>
      {historial && !cargando && (
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <div>
            <label className="form-label small mb-1">Rubro</label>
            <select className="form-select form-select-sm" value={filtroRubro}
              onChange={(e) => { setFiltroRubro(e.target.value); setFiltroProducto(""); setPagina(1); }}>
              <option value="">Todos</option>
              {opciones.rubros.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1">Producto</label>
            <select className="form-select form-select-sm" style={{ maxWidth: 320 }} value={filtroProducto}
              onChange={(e) => { setFiltroProducto(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              {opciones.productos.map((x) => <option key={x.key} value={x.key}>{x.nombre}</option>)}
            </select>
          </div>
          {hayFiltro && (
            <button className="btn btn-link btn-sm" onClick={() => { setFiltroRubro(""); setFiltroProducto(""); setPagina(1); }}>
              Sacar filtro
            </button>
          )}
          <div className="ms-auto d-flex gap-2">
            <button className="btn btn-outline-primary btn-sm" onClick={() => exportar("imprimir")} disabled={!movimientos.length}>
              <i className="bi bi-printer me-1"></i>Imprimir
            </button>
            <button className="btn btn-outline-success btn-sm" onClick={() => exportar("excel")} disabled={!movimientos.length}>
              <i className="bi bi-file-earmark-excel me-1"></i>Excel
            </button>
          </div>
        </div>
      )}
      {cargando ? (
        <p className="text-muted small mb-0">Cargando…</p>
      ) : !historial ? null : movimientos.length === 0 ? (
        <p className="text-muted small mb-0">{hayFiltro ? "Sin movimientos de lo filtrado." : "Sin movimientos registrados."}</p>
      ) : (
        <>
          <div className="alert alert-light border small py-2 mb-2">
            <i className="bi bi-info-circle me-1"></i>
            El saldo va como una cuenta corriente y es el que queda{" "}
            <strong>después</strong> de cada movimiento, del más nuevo al más viejo. Arranca
            del stock que hay hoy{hayFiltro ? " de lo filtrado" : ""} ({vista.unidades
              .map((u) => `${fmt(vista.stockActual[u.key])} ${(unidadCorta[u.key] || u.key)}`)
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
                  {vista.unidades.map((u, i) => (
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
                        {m.soloFecha ? formatearFechaLocal(m.fecha) : new Date(m.fecha).toLocaleString("es-AR")}
                      </td>
                      <td className="small">
                        <span className={`badge bg-${tipoBadge} me-1`}>{tipo}</span>
                        {mostrarRubro && m.rubro && (
                          <span className="badge bg-light text-secondary border me-1">{m.rubro}</span>
                        )}
                        {m.titulo}
                      </td>
                      <td className="small">
                        {m.detalle || "—"}
                        {m.usuario && <span className="text-muted"> · {m.usuario}</span>}
                        {m.comprobanteAjuste && onImprimirAjuste && (
                          <button className="btn btn-link btn-sm p-0 ms-2 align-baseline" onClick={() => onImprimirAjuste(m.comprobanteAjuste)}>
                            <i className="bi bi-printer me-1"></i>constancia
                          </button>
                        )}
                        {m.id && onAnular && (
                          <button className="btn btn-link btn-sm text-danger p-0 ms-2 align-baseline" onClick={() => onAnular(m)}>
                            anular
                          </button>
                        )}
                      </td>
                      <td className="text-end small text-success fw-semibold">{entra}</td>
                      <td className="text-end small text-danger fw-semibold">
                        {sale || (m.noMueve
                          ? <span className="text-muted fw-normal" title="Los ajustes guardan una foto de lo afectado, no un movimiento con signo: no mueven el saldo.">no mueve saldo</span>
                          : "")}
                      </td>
                      {vista.unidades.map((u, i) => (
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
                    {vista.unidades.map((u, i) => (
                      <td key={u.key} className={`text-end small fw-bold ${i === 0 ? "border-start" : ""}`}>
                        {fmt(vista.saldoAnterior[u.key])}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={pagina} totalItems={movimientos.length}
            itemsPerPage={MOVIMIENTOS_POR_PAGINA} onPageChange={setPagina} />
        </>
      )}
    </>
  );
};
