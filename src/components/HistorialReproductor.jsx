import React, { useState } from "react";
import { formatearFechaLocal } from "../utils/dateUtils";
import { formatearNumero, SEXO_LABEL } from "../utils/reproductoresUtils";

/**
 * Historial de datos semanales de un lote reproductor: pesajes y mortandad,
 * siempre agrupados por semana y discriminados por sexo.
 *
 * Se usa en dos lugares con la misma pinta:
 *  - ReproductoresLotesPage, al tocar la tarjeta del galpón (solo lectura).
 *  - ReproductoresDatosPage, debajo de los formularios de carga (con borrado).
 *
 * Si no se pasan `onBorrarPesaje` / `onBorrarMortandad`, no se muestran acciones.
 */

const formatPeso = (g) =>
  g == null ? "—" : g >= 1000 ? `${(g / 1000).toFixed(3).replace(".", ",")} kg` : `${g} g`;

// Una fila por semana, con el último pesaje cargado de cada sexo.
const agruparPesajesPorSemana = (pesajes = []) => {
  const mapa = {};
  for (const p of pesajes) {
    if (!mapa[p.semana]) mapa[p.semana] = { semana: p.semana, hembra: null, macho: null };
    const previo = mapa[p.semana][p.sexo];
    // Varias tomas en la misma semana: vale la más reciente.
    if (!previo || new Date(p.fecha) >= new Date(previo.fecha)) mapa[p.semana][p.sexo] = p;
  }
  return Object.values(mapa).sort((a, b) => b.semana - a.semana);
};

// La mortandad se carga día por día: se agrupa por semana y cada una despliega
// sus días. La semana 0 son las bajas registradas al ingreso del lote.
const agruparMortandadPorSemana = (mortandad = []) => {
  const mapa = {};
  for (const m of mortandad) {
    const key = m.semana ?? 0;
    if (!mapa[key]) mapa[key] = { semana: key, dias: [], total: 0, hembras: 0, machos: 0 };
    mapa[key].dias.push(m);
    mapa[key].total += m.cantidad;
    if (m.sexo === "hembra") mapa[key].hembras += m.cantidad;
    else mapa[key].machos += m.cantidad;
  }
  return Object.values(mapa)
    .map((g) => ({
      ...g,
      dias: [...g.dias].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    }))
    .sort((a, b) => b.semana - a.semana);
};

const CeldaPeso = ({ pesaje, onEditar, onBorrar }) => {
  if (!pesaje) return <span className="text-muted">—</span>;
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span className="fw-semibold">{formatPeso(pesaje.pesoPromedio)}</span>
      {onEditar && (
        <button
          className="btn btn-sm btn-link text-primary p-0 lh-1"
          onClick={() => onEditar(pesaje)}
          title="Editar pesaje"
        >
          <i className="bi bi-pencil"></i>
        </button>
      )}
      {onBorrar && (
        <button
          className="btn btn-sm btn-link text-danger p-0 lh-1"
          onClick={() => onBorrar(pesaje)}
          title="Eliminar pesaje"
        >
          <i className="bi bi-trash"></i>
        </button>
      )}
    </span>
  );
};

const HistorialReproductor = ({
  lote,
  onEditarPesaje,
  onBorrarPesaje,
  onEditarMortandad,
  onBorrarMortandad,
  tabInicial = "pesaje",
  // Modo controlado: la página de carga ya tiene su propia solapa (que además
  // cambia el formulario), así que maneja el tab y esconde el de acá.
  tab: tabControlado,
  onTabChange,
  mostrarTabs = true,
}) => {
  const grupos = agruparMortandadPorSemana(lote?.mortandad);
  const [tabInterno, setTabInterno] = useState(tabInicial);
  const tab = tabControlado ?? tabInterno;
  const setTab = onTabChange ?? setTabInterno;
  const [semanasAbiertas, setSemanasAbiertas] = useState(
    grupos.length ? [grupos[0].semana] : []
  );

  const toggleSemana = (s) =>
    setSemanasAbiertas((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const filasPeso = agruparPesajesPorSemana(lote?.pesajes);
  const semanaActual = lote?.semanaVida ?? 0;
  const bajas = (lote?.mortandad || []).reduce((s, m) => s + m.cantidad, 0);

  return (
    <>
      {mostrarTabs && (
      <ul className="nav nav-tabs">
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "pesaje" ? "active" : ""}`}
            onClick={() => setTab("pesaje")}
          >
            <i className="bi bi-speedometer2 me-1"></i>Pesajes
            {filasPeso.length > 0 && (
              <span className="badge bg-secondary ms-1">{filasPeso.length}</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${tab === "mortandad" ? "active" : ""}`}
            onClick={() => setTab("mortandad")}
          >
            <i className="bi bi-heartbreak me-1"></i>Mortandad
            {bajas > 0 && <span className="badge bg-danger ms-1">{formatearNumero(bajas)}</span>}
          </button>
        </li>
      </ul>
      )}

      <div className={`p-3 ${mostrarTabs ? "border border-top-0 rounded-bottom" : "border rounded"}`}>
        {tab === "pesaje" ? (
          filasPeso.length === 0 ? (
            <p className="text-muted small text-center py-3 mb-0">Sin pesajes registrados</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Semana</th>
                    <th>{SEXO_LABEL.hembra}</th>
                    <th>{SEXO_LABEL.macho}</th>
                    <th className="d-none d-sm-table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filasPeso.map((f) => {
                    const esActual = f.semana === semanaActual;
                    const fecha = f.hembra?.fecha || f.macho?.fecha;
                    return (
                      <tr key={f.semana} className={esActual ? "table-primary" : ""}>
                        <td className="fw-semibold">
                          Sem. {f.semana}
                          {esActual && (
                            <span className="badge bg-primary ms-1" style={{ fontSize: "0.65rem" }}>
                              actual
                            </span>
                          )}
                        </td>
                        <td>
                          <CeldaPeso
                            pesaje={f.hembra}
                            onEditar={onEditarPesaje}
                            onBorrar={onBorrarPesaje}
                          />
                        </td>
                        <td>
                          <CeldaPeso
                            pesaje={f.macho}
                            onEditar={onEditarPesaje}
                            onBorrar={onBorrarPesaje}
                          />
                        </td>
                        <td className="d-none d-sm-table-cell text-muted small">
                          {fecha ? formatearFechaLocal(fecha) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="alert alert-light border small mt-3 mb-0">
                <i className="bi bi-info-circle me-1"></i>
                Todavía no hay tabla de peso esperado para reproductores. Cuando la tengan, se
                agrega igual que en crianza y la tabla muestra la diferencia contra el objetivo.
              </div>
            </div>
          )
        ) : grupos.length === 0 ? (
          <p className="text-muted small text-center py-3 mb-0">Sin bajas registradas</p>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2 small">
              <span className="text-muted">Tocá una semana para ver las bajas día por día</span>
              <span className="fw-semibold">
                Total: <span className="text-danger">{formatearNumero(bajas)}</span>
              </span>
            </div>

            <div className="list-group">
              {grupos.map((grupo) => {
                const abierta = semanasAbiertas.includes(grupo.semana);
                const titulo = grupo.semana === 0 ? "Bajas al ingreso" : `Semana ${grupo.semana}`;
                return (
                  <div className="list-group-item p-0 border-0 mb-1" key={grupo.semana}>
                    <button
                      type="button"
                      className={`btn w-100 d-flex align-items-center justify-content-between px-3 py-2 text-start ${
                        abierta ? "btn-light border" : "btn-outline-light text-dark border"
                      }`}
                      onClick={() => toggleSemana(grupo.semana)}
                    >
                      <span className="d-flex align-items-center gap-2 flex-wrap">
                        <i className={`bi bi-chevron-${abierta ? "down" : "right"} text-muted`}></i>
                        <span className="fw-semibold">{titulo}</span>
                        <span className="text-muted small">
                          {grupo.dias.length} {grupo.dias.length === 1 ? "registro" : "registros"}
                        </span>
                      </span>
                      <span className="d-flex align-items-center gap-1">
                        {grupo.hembras > 0 && (
                          <span className="badge bg-danger bg-opacity-75">
                            {formatearNumero(grupo.hembras)} H
                          </span>
                        )}
                        {grupo.machos > 0 && (
                          <span className="badge bg-danger bg-opacity-50 text-dark">
                            {formatearNumero(grupo.machos)} M
                          </span>
                        )}
                        <span className="badge bg-danger">{formatearNumero(grupo.total)}</span>
                      </span>
                    </button>

                    {abierta && (
                      <div className="table-responsive border border-top-0 rounded-bottom">
                        <table className="table table-sm align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th className="small">Fecha</th>
                              <th className="small">Sexo</th>
                              <th className="small text-center">Bajas</th>
                              <th className="small">Causa</th>
                              {(onEditarMortandad || onBorrarMortandad) && <th></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {grupo.dias.map((m) => (
                              <tr key={m._id}>
                                <td className="small">{formatearFechaLocal(m.fecha)}</td>
                                <td className="small">{SEXO_LABEL[m.sexo]}</td>
                                <td className="small text-center text-danger fw-bold">
                                  {formatearNumero(m.cantidad)}
                                </td>
                                <td className="small text-muted">{m.causa || "—"}</td>
                                {(onEditarMortandad || onBorrarMortandad) && (
                                  <td className="text-end text-nowrap">
                                    {onEditarMortandad && (
                                      <button
                                        className="btn btn-sm btn-outline-primary me-1"
                                        onClick={() => onEditarMortandad(m)}
                                        title="Editar"
                                      >
                                        <i className="bi bi-pencil"></i>
                                      </button>
                                    )}
                                    {onBorrarMortandad && (
                                      <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => onBorrarMortandad(m)}
                                        title="Eliminar"
                                      >
                                        <i className="bi bi-trash"></i>
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default HistorialReproductor;
