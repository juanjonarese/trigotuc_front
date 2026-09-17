import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import MapaCarros from "../components/MapaCarros";
import Pagination from "../components/Pagination";
import BotonExcel from "../components/BotonExcel";
import {
  obtenerConstantesReproductores,
  obtenerEstadoIncubadora,
  obtenerStockIncubable,
  obtenerOcupacionMaquinas,
  enviarApiAVenta,
  descartarApiHuevos,
  obtenerTandasIncubacion,
  crearCargaIncubacion,
  registrarTransferenciaNacedora,
  registrarNacimiento,
  cancelarTandaIncubacion,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import {
  formatearNumero,
  formatearPorcentaje,
  textoDesglose,
  ESTADO_TANDA,
  nombreGalpon,
  etiquetaTipoHuevo,
} from "../utils/reproductoresUtils";
import { exportarTablaExcel } from "../utils/exportarExcel";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

// ── Nacimientos por plantel ─────────────────────────────────────────────────
// "Tanda de reproductoras" es el plantel: el dato ya viaja por toda la cadena
// (recoleccion.lote → stockHuevo.lote → tandaIncubacion.lote), así que el
// rendimiento se arma acá con las tandas que ya tenemos, sin pedir nada nuevo.
//
// Solo las tandas NACIDAS entran en el porcentaje: las que siguen en incubadora
// o en nacedora todavía no tienen nacimiento y meterlas hundiría el número. Se
// cuentan aparte para que se vea que hay huevo en curso.
const rendimientoPorPlantel = (tandas) => {
  const mapa = new Map();

  for (const t of tandas) {
    if (t.estado === "cancelada") continue;
    const id = String(t.lote?._id || t.lote || "");
    if (!id) continue;

    if (!mapa.has(id)) {
      mapa.set(id, {
        id,
        numeroLote: t.lote?.numeroLote ?? "?",
        galpon: t.lote?.galpon,
        incubados: 0,
        nacidos: 0,
        tandasNacidas: 0,
        enCurso: 0,
        huevosEnCurso: 0,
        porTipo: new Map(),
      });
    }
    const p = mapa.get(id);

    if (t.estado === "nacida") {
      const incubados = t.huevosIncubando || 0;
      const nacidos = t.nacimiento?.pollitosNacidos || 0;
      p.incubados += incubados;
      p.nacidos += nacidos;
      p.tandasNacidas += 1;

      // El tipo de API es el eje nuevo: sirve para ver si el huevo de piso nace
      // menos que el de cinta. Las tandas viejas no tienen tipo.
      const tipo = t.tipo || "sinTipo";
      if (!p.porTipo.has(tipo)) p.porTipo.set(tipo, { tipo, incubados: 0, nacidos: 0, tandas: 0 });
      const pt = p.porTipo.get(tipo);
      pt.incubados += incubados;
      pt.nacidos += nacidos;
      pt.tandas += 1;
    } else {
      p.enCurso += 1;
      p.huevosEnCurso += t.huevosIncubando || 0;
    }
  }

  return [...mapa.values()]
    .map((p) => ({
      ...p,
      porcentaje: p.incubados > 0 ? (p.nacidos / p.incubados) * 100 : null,
      porTipo: [...p.porTipo.values()]
        .map((pt) => ({
          ...pt,
          porcentaje: pt.incubados > 0 ? (pt.nacidos / pt.incubados) * 100 : null,
        }))
        .sort((a, b) => String(a.tipo).localeCompare(String(b.tipo))),
    }))
    .sort((a, b) => a.numeroLote - b.numeroLote);
};

// ── Tarjeta de una máquina en la solapa Ocupación ───────────────────────────
const TarjetaMaquina = ({ maquina, etiqueta, color, onVerTanda }) => {
  const total = maquina.carros.length;
  // La nacedora junta varias tandas por carro: su barra se llena por huevos, no
  // por carros tomados.
  const pct = maquina.capacidad
    ? Math.round((maquina.huevos / maquina.capacidad) * 100)
    : Math.round((maquina.carrosOcupados / total) * 100);
  return (
    <div className="col-12 col-md-6 col-xl-4">
      <div className="card shadow-sm h-100">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <span className="fw-bold">
            {etiqueta} {maquina.numero}
          </span>
          <span className={`badge ${maquina.carrosOcupados === 0 ? "bg-secondary" : color}`}>
            {maquina.carrosOcupados}/{total} carros
          </span>
        </div>
        <div className="card-body">
          <div className="progress mb-3" style={{ height: "6px" }}>
            <div className={`progress-bar ${color}`} style={{ width: `${pct}%` }}></div>
          </div>
          <MapaCarros maquina={maquina} onVerTanda={onVerTanda} />
          <div className="text-muted small mt-2">
            {formatearNumero(maquina.huevos)} huevos adentro
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal: la tanda que hay adentro de un carro ─────────────────────────────
// Se abre tocando un carro ocupado del mapa. Reemplaza al listado de tarjetas
// que había abajo: el mapa ya dice dónde está cada cosa, y el detalle y las
// acciones se ven acá cuando hacen falta.
const TandaEnCarroModal = ({ tanda, constantes, onClose, onTransferir, onCancelar }) => {
  const diasIncubacion = constantes?.diasIncubacion ?? 18;
  const dias = tanda.diasEnIncubadora ?? 0;
  const lista = dias >= diasIncubacion;
  const progreso = Math.min(100, Math.round((dias / diasIncubacion) * 100));

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className={`modal-header ${lista ? "bg-info" : "bg-warning"}`}>
              <h5 className="modal-title">
                <i className="bi bi-thermometer-half me-2"></i>Tanda #{tanda.numeroTanda}
              </h5>
              <button className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="progress mb-3" style={{ height: "8px" }}>
                <div
                  className={`progress-bar ${lista ? "bg-info" : "bg-warning"}`}
                  style={{ width: `${progreso}%` }}
                ></div>
              </div>

              <div className="row g-2 text-center mb-3">
                <div className="col-6">
                  <div className="border rounded p-2">
                    <div className="text-muted small">Día</div>
                    <div className="fw-bold h5 mb-0">
                      {dias}/{diasIncubacion}
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="border rounded p-2">
                    <div className="text-muted small">Incubando</div>
                    <div className="fw-bold h5 mb-0">
                      {formatearNumero(tanda.huevosIncubando)}
                    </div>
                  </div>
                </div>
              </div>

              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <td className="text-muted small">Plantel</td>
                    <td className="small fw-semibold text-end">
                      #{tanda.numeroLote ?? "?"}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted small">Ingreso</td>
                    <td className="small text-end">{formatearFechaLocal(tanda.fechaIngreso)}</td>
                  </tr>
                  <tr>
                    <td className="text-muted small">Peso del huevo al cargar</td>
                    <td className="small text-end">
                      {tanda.pesoHuevoIngreso ? `${tanda.pesoHuevoIngreso} g` : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {lista && (
                <div className="alert alert-info py-2 small mt-3 mb-0">
                  <i className="bi bi-exclamation-circle me-1"></i>
                  Cumplió los {diasIncubacion} días: lista para pasar a la nacedora.
                </div>
              )}
            </div>
            <div className="modal-footer justify-content-between">
              <button className="btn btn-outline-danger" onClick={() => onCancelar(tanda)}>
                <i className="bi bi-x-circle me-1"></i>Cancelar tanda
              </button>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary" onClick={onClose}>
                  Cerrar
                </button>
                <button
                  className={`btn ${lista ? "btn-info" : "btn-outline-info"}`}
                  onClick={() => onTransferir(tanda)}
                >
                  <i className="bi bi-arrow-right-circle me-1"></i>Transferir a nacedora
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: lo que hay adentro de un carro de nacedora ───────────────────────
// Mismo criterio que en la incubadora: el mapa dice dónde está cada cosa y el
// detalle con la acción aparece al tocar el carro. Un carro de nacedora junta
// varias tandas, así que se listan todas, cada una con su nacimiento.
const CarroNacedoraModal = ({ carro, constantes, onClose, onRegistrarNacimiento }) => {
  const diasNacedora = constantes?.diasNacedora ?? 3;
  const pct = Math.min(100, Math.round((carro.huevos / carro.capacidad) * 100));

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-info">
              <h5 className="modal-title">
                <i className="bi bi-egg me-2"></i>Nacedora {carro.nacedora} · carro {carro.carro}
              </h5>
              <button className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-muted">
                  {carro.tandas.length} tanda{carro.tandas.length === 1 ? "" : "s"}
                </span>
                <span className="fw-semibold">
                  {formatearNumero(carro.huevos)} de {formatearNumero(carro.capacidad)} huevos
                </span>
              </div>
              <div className="progress mb-3" style={{ height: "8px" }}>
                <div className="progress-bar bg-info" style={{ width: `${pct}%` }}></div>
              </div>

              <div className="d-grid gap-2">
                {carro.tandas.map((t) => {
                  const dias = t.diasEnNacedora ?? 0;
                  const lista = dias >= diasNacedora;
                  return (
                    <div
                      key={t._id}
                      className={`border rounded p-2 d-flex justify-content-between align-items-center gap-2 ${
                        lista ? "border-success" : ""
                      }`}
                    >
                      <div>
                        <div className="fw-bold">
                          Tanda #{t.numeroTanda}{" "}
                          <span className="text-muted fw-normal small">
                            · plantel #{t.numeroLote ?? "?"}
                          </span>
                        </div>
                        <div className="small text-muted">
                          {formatearNumero(t.huevos)} huevos · día {dias}/{diasNacedora}
                          {lista && <span className="text-success fw-semibold"> · lista</span>}
                        </div>
                      </div>
                      <button
                        className={`btn btn-sm ${lista ? "btn-success" : "btn-outline-success"}`}
                        onClick={() => onRegistrarNacimiento(t)}
                      >
                        <i className="bi bi-sunrise me-1"></i>Nacimiento
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: asignar huevos a carros de la incubadora ─────────────────────────
// Se abre desde la tarjeta de stock. Muestra la máquina con sus 12 carros
// numerados y el ventilador vertical en el medio. Se pueden tocar VARIOS carros
// (incluso de incubadoras distintas) para cargar todo de una vez: el total se
// reparte en el orden en que se eligieron, de a un carro lleno, y el último se
// lleva el resto. Cada carro entra como su propia tanda. No tiene por qué ir
// todo — lo que sobra queda en stock, para otro carro o para venta.
const AsignarCarroModal = ({ entrada, fecha, constantes, incubadoras, onClose, onHecho }) => {
  const porCarro = constantes?.huevosPorCarro ?? 4800;

  const [maquina, setMaquina] = useState(
    () => (incubadoras || []).find((m) => m.carrosLibres > 0)?.numero ?? 1
  );
  // Carros elegidos, en orden: [{ incubadora, carro }].
  const [elegidos, setElegidos] = useState([]);
  // Arranca vacía a propósito: la cantidad la decide el usuario.
  const [cantidad, setCantidad] = useState("");
  // Peso promedio del huevo en gramos. Opcional.
  const [peso, setPeso] = useState("");
  const [saving, setSaving] = useState(false);

  const maquinaSel = (incubadoras || []).find((m) => m.numero === Number(maquina));
  // Para que el mapa muestre 1º, 2º… con el orden GLOBAL y no el de esta máquina,
  // se completa con huecos los que están en otras incubadoras.
  const seleccionOrdenada = elegidos.map((e) =>
    e.incubadora === Number(maquina) ? e.carro : null
  );

  const alternarCarro = (carro) => {
    const inc = Number(maquina);
    setElegidos((prev) =>
      prev.some((e) => e.incubadora === inc && e.carro === carro)
        ? prev.filter((e) => !(e.incubadora === inc && e.carro === carro))
        : [...prev, { incubadora: inc, carro }]
    );
  };

  const capacidad = elegidos.length * porCarro;
  const tope = Math.min(entrada.huevosDisponibles, capacidad || porCarro);
  const enviados = Number(cantidad) || 0;
  const quedaEnStock = entrada.huevosDisponibles - enviados;

  // Reparto: carros llenos en orden, el último con lo que queda.
  const reparto = elegidos.map((e, i) => ({
    ...e,
    huevos: Math.max(0, Math.min(porCarro, enviados - i * porCarro)),
  }));
  const carrosVacios = reparto.filter((r) => r.huevos === 0);

  const cantidadInvalida =
    enviados <= 0 || enviados > entrada.huevosDisponibles || enviados > capacidad;
  const puedeGuardar = elegidos.length > 0 && !cantidadInvalida && carrosVacios.length === 0;

  const etiquetaPos = (r) => `inc. ${r.incubadora} · carro ${r.carro}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puedeGuardar) return;

    setSaving(true);
    try {
      const tandas = await crearCargaIncubacion({
        lote: entrada.lote,
        tipo: entrada.tipo,
        fecha: ajustarFechaParaGuardar(fecha),
        carros: reparto,
        pesoHuevoIngreso: peso === "" ? undefined : Number(peso),
      });
      await onHecho();
      const numeros = tandas.map((t) => `#${t.numeroTanda}`).join(", ");
      Swal.fire({
        icon: "success",
        title: tandas.length === 1 ? `Tanda ${numeros} cargada` : `${tandas.length} tandas cargadas`,
        html:
          `${formatearNumero(enviados)} huevos en ${reparto.map(etiquetaPos).join(", ")}.` +
          (tandas.length > 1 ? `<br/><span class="text-muted">Tandas ${numeros}</span>` : "") +
          (quedaEnStock > 0
            ? `<br/><span class="text-muted">Quedan ${formatearNumero(quedaEnStock)} en stock.</span>`
            : "") +
          `<br/><span class="text-muted">Transferencia prevista ${formatearFechaLocal(
            tandas[0]?.fechaTransferenciaPrevista
          )}</span>`,
        timer: 4200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo asignar.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-warning">
              <h5 className="modal-title">
                <i className="bi bi-box-arrow-in-down me-2"></i>
                Asignar a la incubadora — plantel #{entrada.numeroLote}
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="alert alert-light border py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
                  <span className="badge bg-success fs-6">{entrada.etiquetaTipo}</span>
                  <span>
                    <strong className="h5 mb-0">
                      {formatearNumero(entrada.huevosDisponibles)}
                    </strong>{" "}
                    <span className="text-muted small">huevos en stock</span>
                  </span>
                </div>

                <label className="form-label fw-semibold small mb-1">Incubadora</label>
                <select
                  className="form-select mb-3"
                  value={maquina}
                  onChange={(e) => setMaquina(Number(e.target.value))}
                  disabled={saving}
                >
                  {(incubadoras || []).map((m) => {
                    const enEsta = elegidos.filter((e) => e.incubadora === m.numero).length;
                    return (
                      <option key={m.numero} value={m.numero}>
                        Incubadora {m.numero} — {m.carrosLibres} de {m.carros.length} carros libres
                        {enEsta > 0 ? ` · ${enEsta} elegido${enEsta === 1 ? "" : "s"}` : ""}
                      </option>
                    );
                  })}
                </select>

                <label className="form-label fw-semibold small mb-1">
                  Tocá los carros donde va — podés elegir varios, también de otra incubadora
                </label>
                {maquinaSel ? (
                  <div className="border rounded p-3 mb-2 d-flex justify-content-center">
                    <MapaCarros
                      maquina={maquinaSel}
                      seleccion={seleccionOrdenada}
                      onElegir={alternarCarro}
                    />
                  </div>
                ) : (
                  <div className="alert alert-secondary py-2 small">Cargando máquinas…</div>
                )}
                <div className="d-flex gap-3 small text-muted mb-3 flex-wrap">
                  <span>
                    <i className="bi bi-square text-success me-1"></i>libre
                  </span>
                  <span>
                    <i className="bi bi-square-fill text-danger me-1"></i>ocupado
                  </span>
                  <span>
                    <i className="bi bi-square-fill text-primary me-1"></i>elegido (tocalo de
                    nuevo para sacarlo)
                  </span>
                  <span>
                    <i className="bi bi-fan me-1"></i>el ventilador parte el 6 del 7
                  </span>
                </div>

                <div>
                  <label className="form-label fw-semibold small mb-1">
                    ¿Cuántos huevos van en total?
                  </label>
                  <div className="input-group">
                    <input
                      type="number"
                      className={`form-control ${
                        cantidad !== "" && cantidadInvalida ? "is-invalid" : ""
                      }`}
                      min="1"
                      max={tope}
                      placeholder="0"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setCantidad(String(tope))}
                      disabled={saving || elegidos.length === 0}
                      title="Llenar los carros elegidos con lo que haya en stock"
                    >
                      Llenar carros
                    </button>
                  </div>
                  <div className="form-text">
                    {elegidos.length === 0
                      ? `Un carro es de ${formatearNumero(porCarro)} huevos`
                      : `Hasta ${formatearNumero(tope)} — ${elegidos.length} carro${
                          elegidos.length === 1 ? "" : "s"
                        } de ${formatearNumero(porCarro)}`}
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label fw-semibold small mb-1">
                    Peso promedio del huevo (g){" "}
                    <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max="200"
                    step="0.1"
                    placeholder="Ej: 62,5"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                    disabled={saving}
                  />
                  <div className="form-text">
                    Se compara con el peso de la transferencia para ver cuánto perdió. Si van
                    varios carros, se usa el mismo peso para todos.
                  </div>
                </div>

                {reparto.length > 0 && enviados > 0 && (
                  <div className="table-responsive mt-3">
                    <table className="table table-sm mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="small">Orden</th>
                          <th className="small">Posición</th>
                          <th className="small text-end">Huevos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reparto.map((r, i) => (
                          <tr
                            key={`${r.incubadora}-${r.carro}`}
                            className={r.huevos === 0 ? "table-danger" : ""}
                          >
                            <td className="small">{i + 1}º</td>
                            <td className="small">
                              Incubadora {r.incubadora}, carro {r.carro}
                            </td>
                            <td className="small text-end fw-semibold">
                              {r.huevos === 0 ? "sin huevos" : formatearNumero(r.huevos)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div
                  className={`alert py-2 mt-3 mb-0 small ${
                    puedeGuardar ? "alert-success" : "alert-secondary"
                  }`}
                >
                  {elegidos.length === 0 ? (
                    "Elegí uno o más carros para continuar."
                  ) : enviados <= 0 ? (
                    `${elegidos.length} carro${elegidos.length === 1 ? "" : "s"} elegido${
                      elegidos.length === 1 ? "" : "s"
                    }. Poné cuántos huevos van.`
                  ) : enviados > entrada.huevosDisponibles ? (
                    `Hay ${formatearNumero(entrada.huevosDisponibles)} huevos en stock.`
                  ) : enviados > capacidad ? (
                    `En ${elegidos.length} carro${elegidos.length === 1 ? "" : "s"} entran ${formatearNumero(
                      capacidad
                    )}. Elegí otro carro o bajá la cantidad.`
                  ) : carrosVacios.length > 0 ? (
                    `No alcanza para ${
                      carrosVacios.length === 1 ? "el carro" : "los carros"
                    } ${carrosVacios.map(etiquetaPos).join(", ")}: sacalo${
                      carrosVacios.length === 1 ? "" : "s"
                    } o subí la cantidad.`
                  ) : (
                    <>
                      Entran <strong>{formatearNumero(enviados)}</strong> huevos en{" "}
                      <strong>
                        {elegidos.length} carro{elegidos.length === 1 ? "" : "s"}
                      </strong>
                      {elegidos.length > 1 && <> ({elegidos.length} tandas)</>}.
                      {quedaEnStock > 0 && <> Quedan {formatearNumero(quedaEnStock)} en stock.</>}
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-warning"
                  disabled={saving || !puedeGuardar}
                >
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-check2-circle me-1"></i>Asignar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: mandar API a venta ───────────────────────────────────────────────
// El API entra como incubable, pero no todo se incuba. Lo que se manda acá sale
// del stock incubable y aparece en Stock de Huevos, listo para vender. Se
// conserva el tipo de API para saber después qué se vendió.
const EnviarAVentaModal = ({ entrada, onClose, onHecho }) => {
  const [cantidad, setCantidad] = useState("");
  const [saving, setSaving] = useState(false);

  const enviados = Number(cantidad) || 0;
  const queda = entrada.huevosDisponibles - enviados;
  const invalida = enviados <= 0 || enviados > entrada.huevosDisponibles;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (invalida) return;
    setSaving(true);
    try {
      await enviarApiAVenta({
        lote: entrada.lote,
        tipo: entrada.tipo,
        cantidad: enviados,
      });
      await onHecho();
      Swal.fire({
        icon: "success",
        title: "Enviado a venta",
        html:
          `${formatearNumero(enviados)} huevos de ${entrada.etiquetaTipo} pasaron al stock de venta.` +
          `<br/><span class="text-muted">Los vas a ver en Stock de Huevos.</span>`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo enviar a venta.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="bi bi-cash-coin me-2"></i>Enviar a venta — plantel #
                {entrada.numeroLote}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="alert alert-light border py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
                  <span className="badge bg-success fs-6">{entrada.etiquetaTipo}</span>
                  <span>
                    <strong className="h5 mb-0">
                      {formatearNumero(entrada.huevosDisponibles)}
                    </strong>{" "}
                    <span className="text-muted small">huevos sin incubar</span>
                  </span>
                </div>

                <label className="form-label fw-semibold small mb-1">
                  ¿Cuántos huevos van a venta?
                </label>
                <input
                  type="number"
                  className={`form-control ${invalida && cantidad !== "" ? "is-invalid" : ""}`}
                  min="1"
                  max={entrada.huevosDisponibles}
                  placeholder="0"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  disabled={saving}
                  autoFocus
                />
                <div className="form-text">
                  Hasta {formatearNumero(entrada.huevosDisponibles)}
                </div>

                <div
                  className={`alert py-2 mt-3 mb-0 small ${
                    enviados > 0 && !invalida ? "alert-success" : "alert-secondary"
                  }`}
                >
                  {enviados > 0 && !invalida ? (
                    <>
                      Salen <strong>{formatearNumero(enviados)}</strong> del stock incubable y
                      pasan a <strong>Stock de Huevos</strong>.
                      {queda > 0 && <> Quedan {formatearNumero(queda)} para incubar.</>}
                    </>
                  ) : (
                    "Poné cuántos huevos mandás a venta."
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || invalida}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-cash-coin me-1"></i>Enviar a venta
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: descartar API ────────────────────────────────────────────────────
// Huevos que no sirven: rotos, sucios de más, lo que sea. Salen del stock y no
// van a ningún lado — no se incuban ni se venden. Queda registrado como una
// salida, así que se puede anular si se cargó mal.
const DescartarApiModal = ({ entrada, onClose, onHecho }) => {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("rotura");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const descartados = Number(cantidad) || 0;
  const queda = entrada.huevosDisponibles - descartados;
  const invalida = descartados <= 0 || descartados > entrada.huevosDisponibles;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (invalida) return;

    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Descartar ${formatearNumero(descartados)} huevos?`,
      html:
        `Se van del stock de <strong>${entrada.etiquetaTipo}</strong> del plantel #${entrada.numeroLote}.` +
        `<br/><span class="text-muted">No se incuban ni se venden: es pérdida.</span>`,
      showCancelButton: true,
      confirmButtonText: "Sí, descartar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;

    setSaving(true);
    try {
      await descartarApiHuevos({
        lote: entrada.lote,
        tipo: entrada.tipo,
        cantidad: descartados,
        motivo,
        observaciones: observaciones || undefined,
      });
      await onHecho();
      Swal.fire({
        icon: "success",
        title: "Descarte registrado",
        text: `${formatearNumero(descartados)} huevos de ${entrada.etiquetaTipo} salieron del stock.`,
        timer: 2600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo descartar.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">
                <i className="bi bi-trash me-2"></i>Descartar — plantel #{entrada.numeroLote}
              </h5>
              <button
                className="btn-close btn-close-white"
                onClick={onClose}
                disabled={saving}
              ></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="alert alert-light border py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
                  <span className="badge bg-success fs-6">{entrada.etiquetaTipo}</span>
                  <span>
                    <strong className="h5 mb-0">
                      {formatearNumero(entrada.huevosDisponibles)}
                    </strong>{" "}
                    <span className="text-muted small">huevos en stock</span>
                  </span>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small mb-1">
                      ¿Cuántos se descartan?
                    </label>
                    <input
                      type="number"
                      className={`form-control ${invalida && cantidad !== "" ? "is-invalid" : ""}`}
                      min="1"
                      max={entrada.huevosDisponibles}
                      placeholder="0"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                      disabled={saving}
                      autoFocus
                    />
                    <div className="form-text">
                      Hasta {formatearNumero(entrada.huevosDisponibles)}
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label fw-semibold small mb-1">Motivo</label>
                    <select
                      className="form-select"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      disabled={saving}
                    >
                      <option value="rotura">Rotura</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold small mb-1">
                      Observaciones <span className="text-muted fw-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Ej: se rompieron en el traslado"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div
                  className={`alert py-2 mt-3 mb-0 small ${
                    descartados > 0 && !invalida ? "alert-danger" : "alert-secondary"
                  }`}
                >
                  {descartados > 0 && !invalida ? (
                    <>
                      Se pierden <strong>{formatearNumero(descartados)}</strong> huevos.
                      {queda > 0 && <> Quedan {formatearNumero(queda)} en stock.</>}
                    </>
                  ) : (
                    "Poné cuántos huevos se descartan."
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={saving || invalida}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-trash me-1"></i>Descartar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Tarjeta de API en stock ─────────────────────────────────────────────────
// Muestra qué hay, de qué plantel y con qué remito vino (la fecha en que salió
// de la granja). La asignación se hace en el modal, que es donde están el mapa
// de la máquina y la cantidad.
const TarjetaApiRecibido = ({ entrada, constantes, onAsignar, onEnviarAVenta, onDescartar }) => {
  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  // De qué envío vino lo que queda. Puede ser más de uno: el stock se consume
  // FIFO y lo que sobró de un remito viejo convive con el último.
  const remitos = entrada.remitos || [];
  return (
    <div className="col-12 col-md-6 col-xl-4">
      <div className="card shadow-sm h-100 border-warning">
        <div className="card-header bg-warning-subtle d-flex justify-content-between align-items-center">
          <span className="fw-bold">Plantel #{entrada.numeroLote}</span>
          <span className="badge bg-success">{entrada.etiquetaTipo}</span>
        </div>
        <div className="card-body d-flex flex-column">
          <div className="text-muted small mb-1">
            {nombreGalpon(constantes?.galpones, "postura", entrada.galpon)}
          </div>
          <div className="h3 fw-bold mb-0">{formatearNumero(entrada.huevosDisponibles)}</div>
          <div className="text-muted small mb-2">
            huevos en stock · {textoDesglose(entrada.huevosDisponibles, huevosPorCajon)}
          </div>

          {/* Cuándo salió de la granja. Si vino en varios remitos, cada uno con
              su parte: el de arriba es el más viejo, que sale primero. */}
          {remitos.length > 0 && (
            <div className="border rounded p-2 mb-3 small">
              <div className="text-muted mb-1">
                <i className="bi bi-truck me-1"></i>
                Enviado desde la granja
              </div>
              {remitos.map((r, i) => (
                <div
                  key={r.remito || `sin-${i}`}
                  className="d-flex justify-content-between gap-2"
                  title={
                    r.fechaRecoleccionDesde
                      ? `Recolectado ${formatearFechaLocal(r.fechaRecoleccionDesde)}` +
                        (r.fechaRecoleccionHasta !== r.fechaRecoleccionDesde
                          ? ` al ${formatearFechaLocal(r.fechaRecoleccionHasta)}`
                          : "")
                      : undefined
                  }
                >
                  <span>
                    {r.fechaRemito ? (
                      <span className="fw-semibold">{formatearFechaLocal(r.fechaRemito)}</span>
                    ) : (
                      <span className="text-muted">sin remito</span>
                    )}
                    {r.numeroRemito && (
                      <span className="text-muted"> · remito {r.numeroRemito}</span>
                    )}
                  </span>
                  <span className="text-nowrap">{formatearNumero(r.huevos)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="d-grid gap-2 mt-auto">
            <button className="btn btn-warning" onClick={() => onAsignar(entrada)}>
              <i className="bi bi-grid-3x3 me-1"></i>Asignar a incubadora
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => onEnviarAVenta(entrada)}
            >
              <i className="bi bi-cash-coin me-1"></i>Enviar a venta
            </button>
            <button className="btn btn-outline-danger" onClick={() => onDescartar(entrada)}>
              <i className="bi bi-trash me-1"></i>Descarte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Modal: transferencia a nacedora (miraje con luz) ────────────────────────
const TransferenciaModal = ({ tanda, nacedoras, onClose, onHecho }) => {
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [transferidos, setTransferidos] = useState("");
  const [perdida, setPerdida] = useState("");
  // A qué nacedora y carro va. Arranca en la primera donde entra la tanda entera.
  const [maquina, setMaquina] = useState(
    () =>
      (nacedoras || []).find((m) =>
        m.carros.some((c) => (c.huevosLibres ?? 0) >= tanda.huevosIncubando)
      )?.numero ??
      (nacedoras || []).find((m) => m.carrosLibres > 0)?.numero ??
      1
  );
  const [carroSel, setCarroSel] = useState(null);
  // Peso promedio del huevo en gramos. Opcional.
  const [peso, setPeso] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const maquinaSel = (nacedoras || []).find((m) => m.numero === Number(maquina));

  // Pérdida de peso contra el de la carga, si los dos están.
  const pesoInicial = tanda.pesoHuevoIngreso;
  const perdidaPeso =
    pesoInicial && peso !== "" ? ((pesoInicial - Number(peso)) / pesoInicial) * 100 : null;

  // Dos destinos y nada más: lo que pasa a la nacedora y lo que se descarta.
  // Del miraje no sale nada vendible (usuario, 2026-08-12) — antes había un
  // tercer campo "descarte venta" que generaba stock y no existe en la planta.
  const trans      = Number(transferidos) || 0;
  const descartado = Number(perdida) || 0;
  const total      = trans + descartado;
  const diferencia = tanda.huevosIncubando - total;
  const cuadra = diferencia === 0;

  // Un carro de nacedora junta varias tandas: lo que se transfiere tiene que
  // entrar en el lugar que le queda.
  const carroElegido = maquinaSel?.carros.find((c) => c.carro === carroSel);
  const noEntra = !!carroElegido && trans > carroElegido.huevosLibres;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (transferidos === "") {
      Swal.fire("Falta el dato", "Cargá cuántos huevos pasan a la nacedora.", "warning");
      return;
    }
    if (!carroSel) {
      Swal.fire("Falta el carro", "Elegí a qué carro de la nacedora va.", "warning");
      return;
    }
    if (noEntra) {
      Swal.fire(
        "No entra en el carro",
        `Al carro ${carroSel} le quedan ${formatearNumero(carroElegido.huevosLibres)} huevos de ` +
          `lugar y se transfieren ${formatearNumero(trans)}. Elegí otro carro.`,
        "warning"
      );
      return;
    }
    if (!cuadra) {
      Swal.fire(
        "Las cantidades no cuadran",
        `A la nacedora (${formatearNumero(trans)}) + descarte (${formatearNumero(descartado)}) = ` +
          `${formatearNumero(total)}, y la tanda tiene ` +
          `${formatearNumero(tanda.huevosIncubando)} huevos en incubación.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const actualizada = await registrarTransferenciaNacedora(tanda._id, {
        fecha: ajustarFechaParaGuardar(fecha),
        huevosTransferidos: trans,
        descarteMirajePerdida: descartado,
        nacedora: Number(maquina),
        carro: carroSel,
        pesoHuevo: peso === "" ? undefined : Number(peso),
        observaciones: observaciones || undefined,
      });
      onHecho();
      Swal.fire({
        icon: "success",
        title: "Transferida a nacedora",
        text:
          `${formatearNumero(trans)} huevos → nacedora ${maquina}, carro ${carroSel}` +
          ` · nacimiento previsto ${formatearFechaLocal(actualizada.fechaNacimientoPrevista)}`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar la transferencia.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-info">
              <h5 className="modal-title">
                <i className="bi bi-arrow-right-circle me-2"></i>Transferir a nacedora — tanda #
                {tanda.numeroTanda}
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-transferencia" onSubmit={handleSubmit}>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">En incubación</div>
                      <div className="fw-bold">{formatearNumero(tanda.huevosIncubando)}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Días transcurridos</div>
                      <div className="fw-bold">{tanda.diasEnIncubadora ?? "-"}</div>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha de transferencia</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-egg text-info me-1"></i>Huevos que pasan a la nacedora
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max={tanda.huevosIncubando}
                    value={transferidos}
                    onChange={(e) => setTransferidos(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-trash text-danger me-1"></i>Descarte
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max={tanda.huevosIncubando}
                    value={perdida}
                    onChange={(e) => setPerdida(e.target.value)}
                    placeholder="0"
                  />
                  <div className="form-text">
                    Claros, infértiles, podridos y embrión muerto: se tiran. Del miraje no sale
                    nada para vender.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-speedometer2 text-secondary me-1"></i>Peso promedio del
                    huevo (g) <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max="200"
                    step="0.1"
                    placeholder="Ej: 55,3"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                  />
                  <div className="form-text">
                    {pesoInicial ? (
                      <>
                        Al cargar pesaba <strong>{pesoInicial} g</strong>
                        {perdidaPeso != null && (
                          <>
                            {" · "}pérdida de peso{" "}
                            <strong>{formatearPorcentaje(perdidaPeso)}</strong>
                          </>
                        )}
                      </>
                    ) : (
                      "No se cargó el peso al ingresar a la incubadora."
                    )}
                  </div>
                </div>

                {/* A qué carro de la nacedora va. La nacedora tiene la misma
                    capacidad que la incubadora justamente para poder recibir una
                    máquina llena, pero en 4 carros de 14.400 que juntan varias
                    tandas cada uno. */}
                <div className="mb-3">
                  <label className="form-label fw-semibold small">¿A qué nacedora va?</label>
                  <select
                    className="form-select form-select-sm mb-2"
                    value={maquina}
                    onChange={(e) => {
                      setMaquina(Number(e.target.value));
                      setCarroSel(null);
                    }}
                    disabled={saving}
                  >
                    {(nacedoras || []).map((m) => (
                      <option key={m.numero} value={m.numero}>
                        Nacedora {m.numero} — {formatearNumero(m.huevosLibres ?? 0)} huevos de
                        lugar
                      </option>
                    ))}
                  </select>
                  {maquinaSel ? (
                    <div className="border rounded p-2 d-flex justify-content-center">
                      <MapaCarros
                        maquina={maquinaSel}
                        seleccion={carroSel}
                        onElegir={setCarroSel}
                      />
                    </div>
                  ) : (
                    <div className="alert alert-secondary py-2 small mb-0">Cargando…</div>
                  )}
                  <div className="form-text">
                    {carroElegido ? (
                      <span className={noEntra ? "text-danger fw-semibold" : "text-primary fw-semibold"}>
                        Nacedora {maquina} · carro {carroSel} · le quedan{" "}
                        {formatearNumero(carroElegido.huevosLibres)} de{" "}
                        {formatearNumero(carroElegido.capacidad)}
                        {noEntra && " — no entra"}
                      </span>
                    ) : (
                      "Tocá un carro con lugar: verde vacío, amarillo a medias. Varias tandas comparten carro."
                    )}
                  </div>
                </div>

                {transferidos !== "" && (
                  <div className={`alert py-2 small ${cuadra ? "alert-success" : "alert-danger"}`}>
                    <div className="d-flex justify-content-between">
                      <span>
                        <strong>Total cargado:</strong> {formatearNumero(total)} de{" "}
                        {formatearNumero(tanda.huevosIncubando)} en incubación
                      </span>
                      {cuadra ? (
                        <span>
                          <i className="bi bi-check-circle-fill"></i>
                        </span>
                      ) : (
                        <span className="fw-semibold">
                          {diferencia > 0
                            ? `faltan ${formatearNumero(diferencia)}`
                            : `sobran ${formatearNumero(-diferencia)}`}
                        </span>
                      )}
                    </div>
                    {!cuadra && (
                      <div className="mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        A la nacedora + descarte tiene que dar exactamente los huevos en
                        incubación.
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <label className="form-label fw-semibold">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                form="form-transferencia"
                className="btn btn-info"
                disabled={saving || !cuadra || noEntra}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Confirmar transferencia
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: registrar nacimiento ─────────────────────────────────────────────
const NacimientoModal = ({ tanda, onClose, onHecho }) => {
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [pollitos, setPollitos] = useState("");
  // Muertos o descartados al sacar la nacedora: pérdida, no van a stock.
  const [descarte, setDescarte] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const transferidos = tanda.transferencia?.huevosTransferidos ?? 0;
  const nacidos = Number(pollitos) || 0;
  const descartados = Number(descarte) || 0;
  const noNacidos = Math.max(0, transferidos - nacidos - descartados);
  const excede = nacidos + descartados > transferidos;
  const rendimiento = tanda.huevosIngresados ? (nacidos / tanda.huevosIngresados) * 100 : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pollitos === "") {
      Swal.fire("Falta el dato", "Cargá cuántos pollitos nacieron.", "warning");
      return;
    }
    if (excede) {
      Swal.fire(
        "Cantidad inválida",
        `Vivos + descarte (${formatearNumero(nacidos + descartados)}) supera los ` +
          `${formatearNumero(transferidos)} huevos transferidos a la nacedora.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const actualizada = await registrarNacimiento(tanda._id, {
        fecha: ajustarFechaParaGuardar(fecha),
        pollitosNacidos: nacidos,
        descarteNacimiento: descartados,
        observaciones: observaciones || undefined,
      });
      onHecho();
      Swal.fire({
        icon: "success",
        title: "Nacimiento registrado",
        text: `${formatearNumero(nacidos)} pollitos listos para la venta · rendimiento ${formatearPorcentaje(
          actualizada.rendimiento
        )}`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el nacimiento.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-sunrise me-2"></i>Nacimiento — tanda #{tanda.numeroTanda}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-nacimiento" onSubmit={handleSubmit}>
                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Ingresaron</div>
                      <div className="fw-bold">{formatearNumero(tanda.huevosIngresados)}</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">En nacedora</div>
                      <div className="fw-bold">{formatearNumero(transferidos)}</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Días</div>
                      <div className="fw-bold">{tanda.diasEnNacedora ?? "-"}</div>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Fecha de nacimiento</label>
                  <input
                    type="date"
                    className="form-control"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Pollitos vivos</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max={transferidos}
                      value={pollitos}
                      onChange={(e) => setPollitos(e.target.value)}
                      required
                    />
                    <div className="form-text">Quedan disponibles para venta.</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Descarte / muertos</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max={transferidos}
                      value={descarte}
                      onChange={(e) => setDescarte(e.target.value)}
                      placeholder="0"
                    />
                    <div className="form-text">Pérdida: no van a stock.</div>
                  </div>
                </div>

                {pollitos !== "" && (
                  <div className={`alert py-2 small ${excede ? "alert-danger" : "alert-success"}`}>
                    <div>
                      <strong>No nacidos:</strong> {formatearNumero(noNacidos)}
                      {" · "}
                      <strong>Rendimiento:</strong> {formatearPorcentaje(rendimiento)}
                    </div>
                    <div className="text-muted mt-1">
                      El rendimiento se mide con los vivos sobre los huevos que entraron a la
                      incubadora.
                    </div>
                    {excede && (
                      <div className="mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        Vivos + descarte no puede superar los huevos transferidos.
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <label className="form-label fw-semibold">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                form="form-nacimiento"
                className="btn btn-success"
                disabled={saving || excede}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                Registrar nacimiento
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
const IncubadoraPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [estado, setEstado] = useState(null);
  const [stock, setStock] = useState([]);
  const [tandas, setTandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tandaTransferir, setTandaTransferir] = useState(null);
  const [tandaNacimiento, setTandaNacimiento] = useState(null);
  const [solapa, setSolapa] = useState("incubadora");
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  // Mapa de las 6 incubadoras y las 3 nacedoras (12 carros por incubadora, 4 por nacedora).
  const [ocupacion, setOcupacion] = useState({ incubadoras: [], nacedoras: [] });
  // Entrada de stock que se está asignando a un carro; null = modal cerrado.
  const [asignando, setAsignando] = useState(null);
  const [enviandoAVenta, setEnviandoAVenta] = useState(null);
  const [descartando, setDescartando] = useState(null);
  // Tanda abierta desde un carro del mapa; null = modal cerrado.
  const [tandaAbierta, setTandaAbierta] = useState(null);
  // Carro de nacedora abierto desde el mapa (con sus tandas); null = cerrado.
  const [carroNacAbierto, setCarroNacAbierto] = useState(null);

  // Nacimientos por plantel de reproductoras. Se llama `rendimientoPlanteles` y
  // no `rendimiento` para no confundirlo con el de una tanda suelta que calcula
  // NacimientoModal.
  const rendimientoPlanteles = rendimientoPorPlantel(tandas);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, est, stk, tds, ocu] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerEstadoIncubadora(),
        obtenerStockIncubable(),
        obtenerTandasIncubacion(),
        obtenerOcupacionMaquinas(),
      ]);
      setConstantes(cons);
      setEstado(est);
      setStock(Array.isArray(stk) ? stk : []);
      setTandas(Array.isArray(tds) ? tds : []);
      setOcupacion(ocu || { incubadoras: [], nacedoras: [] });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar la incubadora.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCancelar = async (tanda) => {
    const { isConfirmed, value } = await Swal.fire({
      icon: "warning",
      title: `¿Cancelar la tanda #${tanda.numeroTanda}?`,
      text: "Los huevos vuelven al stock incubable del plantel.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, cancelar tanda",
      cancelButtonText: "Volver",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await cancelarTandaIncubacion(tanda._id, value || undefined);
      await cargar();
      Swal.fire({ icon: "success", title: "Tanda cancelada", timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const diasIncubacion = constantes?.diasIncubacion ?? 18;
  const diasNacedora = constantes?.diasNacedora ?? 3;
  const totalIncubable = stock.reduce((acc, s) => acc + s.huevosDisponibles, 0);

  // Historial único: el ciclo completo de cada tanda, de la incubadora al
  // nacimiento. `tandas` viene ordenado por fecha de ingreso descendente.
  const tandasPagina = tandas.slice(
    (paginaHistorial - 1) * ITEMS_POR_PAGINA,
    paginaHistorial * ITEMS_POR_PAGINA
  );


  // Excel: el historial completo de tandas — el ciclo entero de cada una, del
  // ingreso a la incubadora hasta el nacimiento. No solo la página visible.
  const exportarHistorialExcel = () => exportarTablaExcel({
    filas: tandas,
    nombreHoja: "Tandas",
    nombreArchivo: "Reproductoras_incubacion",
    columnas: [
      { header: "Tanda",              valor: (t) => t.numeroTanda ?? "" },
      { header: "Plantel",            valor: (t) => t.lote?.numeroLote ?? "" },
      { header: "Fecha ingreso",      valor: (t) => formatearFechaLocal(t.fechaIngreso) },
      { header: "Huevos ingresados",  valor: (t) => t.huevosIngresados ?? 0 },
      { header: "Peso huevo ingreso (g)", valor: (t) => t.pesoHuevoIngreso ?? "" },
      { header: "Desc. inoculación",  valor: (t) => t.descarteInoculacion ?? 0 },
      { header: "Huevos incubando",   valor: (t) => t.huevosIncubando ?? 0 },
      { header: "Fecha miraje",       valor: (t) => (t.transferencia?.fecha ? formatearFechaLocal(t.transferencia.fecha) : "") },
      { header: "A nacedora",         valor: (t) => (t.transferencia ? t.transferencia.huevosTransferidos : "") },
      { header: "Desc. miraje",       valor: (t) => (t.transferencia ? (t.transferencia.descarteMirajePerdida || 0) : "") },
      { header: "Peso huevo transf. (g)", valor: (t) => t.transferencia?.pesoHuevo ?? "" },
      { header: "Pérdida de peso (%)", valor: (t) => t.perdidaPeso ?? "" },
      { header: "Nacimiento previsto", valor: (t) => (t.fechaNacimientoPrevista ? formatearFechaLocal(t.fechaNacimientoPrevista) : "") },
      { header: "Fecha nacimiento",   valor: (t) => (t.nacimiento?.fecha ? formatearFechaLocal(t.nacimiento.fecha) : "") },
      { header: "Pollitos vivos",     valor: (t) => (t.nacimiento ? t.nacimiento.pollitosNacidos : "") },
      { header: "Desc. nacimiento",   valor: (t) => (t.nacimiento ? (t.nacimiento.descarteNacimiento || 0) : "") },
      { header: "Rendimiento (%)",    valor: (t) => (t.nacimiento && t.rendimiento != null ? t.rendimiento : "") },
      { header: "Pollitos disponibles", valor: (t) => t.pollitosDisponibles ?? 0 },
      { header: "Estado",             valor: (t) => (ESTADO_TANDA[t.estado]?.label || t.estado) },
      { header: "Observaciones",      valor: (t) => t.observaciones },
    ],
  });

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-thermometer-half text-warning me-2"></i>Incubadora
            </h1>
            <p className="text-muted mb-0 small">
              {diasIncubacion} días de incubación + {diasNacedora} de nacedora ·{" "}
              {constantes?.cargasPorSemana} cargas por semana de hasta{" "}
              {formatearNumero(constantes?.huevosPorCarga)} huevos
            </p>
          </div>
          <div className="d-flex gap-2 align-items-center">

            {solapa === "historial" && (
              <BotonExcel
                onClick={exportarHistorialExcel}
                disabled={tandas.length === 0}
                titulo="Descargar el historial de tandas"
              />
            )}
            <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        {/* Solapas: lo operativo primero, después los dos historiales. */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${solapa === "incubadora" ? "active fw-semibold" : ""}`}
              onClick={() => setSolapa("incubadora")}
            >
              <i className="bi bi-thermometer-half me-1"></i>Incubadora
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${solapa === "historial" ? "active fw-semibold" : ""}`}
              onClick={() => setSolapa("historial")}
            >
              <i className="bi bi-clock-history me-1"></i>Historial ({tandas.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${solapa === "rendimiento" ? "active fw-semibold" : ""}`}
              onClick={() => setSolapa("rendimiento")}
            >
              <i className="bi bi-graph-up me-1"></i>Nacimientos por plantel
            </button>
          </li>
        </ul>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning"></div>
          </div>
        ) : !estado ? null : (
          <>
            {solapa === "incubadora" && (
              <>
              {/* Cadencia de carga: la máquina es de carga continua, así que lo
                  que se controla no es cuánto entra sino cada cuánto se carga. */}
              <div className="card shadow-sm mb-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-baseline mb-2">
                    <h5 className="fw-bold mb-0">Cargas de esta semana</h5>
                    <span className="fw-bold">
                      {estado.cargasEstaSemana} / {estado.cargasPorSemana}
                      <span className="text-muted small">
                        {" "}
                        · hasta {formatearNumero(estado.huevosPorCarga)} c/u
                      </span>
                    </span>
                  </div>
                  <div className="progress mb-3" style={{ height: "20px" }}>
                    <div
                      className={`progress-bar ${
                        estado.cargasDisponiblesSemana === 0 ? "bg-warning" : "bg-success"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (estado.cargasEstaSemana / estado.cargasPorSemana) * 100
                        )}%`,
                      }}
                    >
                      {estado.cargasEstaSemana > 0 &&
                        `${estado.cargasEstaSemana} carga${estado.cargasEstaSemana === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <div className="row g-2 small">
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center">
                        <div className="text-muted">Huevos adentro</div>
                        <div className="fw-bold">{formatearNumero(estado.ocupados)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          en {estado.tandasAdentro} tanda{estado.tandasAdentro === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center">
                        <div className="text-muted">Cargas libres</div>
                        <div
                          className={`fw-bold ${
                            estado.cargasDisponiblesSemana === 0 ? "text-warning" : "text-success"
                          }`}
                        >
                          {estado.cargasDisponiblesSemana}
                        </div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          esta semana
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center">
                        <div className="text-muted">Stock incubable</div>
                        <div className="fw-bold text-info">{formatearNumero(totalIncubable)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          en {stock.length} plantel{stock.length === 1 ? "" : "es"}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center">
                        <div className="text-muted">En nacedora</div>
                        <div className="fw-bold">{estado.tandasEnNacedora.length}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          tanda{estado.tandasEnNacedora.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* API recibido por remito, esperando que lo acepten. Una tarjeta
                  por plantel y tipo, igual que vino en el remito. */}
              {stock.length > 0 && (
                <>
                  <h5 className="fw-bold text-secondary mb-1">
                    <i className="bi bi-inbox-fill me-1"></i>API en stock, para asignar (
                    {stock.length})
                  </h5>
                  <p className="text-muted small mb-3">
Ya está recibido en Trigotuc y listo para usar. De acá sale para tres lados: a la
                    incubadora eligiendo carro y cantidad, a venta (va al stock de huevos), o a
                    descarte si no sirve.
                  </p>
                  <div className="row g-3 mb-4">
                    {stock.map((entrada) => (
                      <TarjetaApiRecibido
                        key={`${entrada.lote}-${entrada.tipo}`}
                        entrada={entrada}
                        constantes={constantes}
                        onAsignar={setAsignando}
                        onEnviarAVenta={setEnviandoAVenta}
                        onDescartar={setDescartando}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Dónde está cada tanda dentro de las máquinas. Mismo dibujo que
                  el modal de asignación: los 12 carros numerados con el
                  ventilador vertical entre el 6 y el 7. */}
              <h5 className="fw-bold text-secondary mb-1">
                <i className="bi bi-grid-3x3 me-1"></i>Posiciones en las incubadoras
              </h5>
              <p className="text-muted small mb-3">
Tocá un carro ocupado para ver la tanda y transferirla a nacedora.
                El ventilador separa el carro 6 del 7.
              </p>
              <div className="row g-3 mb-4">
                {ocupacion.incubadoras.map((m) => (
                  <TarjetaMaquina
                    key={m.numero}
                    maquina={m}
                    etiqueta="Incubadora"
                    color="bg-warning"
                    onVerTanda={setTandaAbierta}
                  />
                ))}
              </div>

              <h5 className="fw-bold text-secondary mb-1">
                <i className="bi bi-grid-3x3 me-1"></i>Posiciones en las nacedoras
              </h5>
              <p className="text-muted small mb-3">
4 carros de 14.400 por nacedora, con el ventilador entre el 2 y el 3. Cada carro junta varias tandas: tocalo para verlas y
                registrar cada nacimiento.
              </p>
              <div className="row g-3 mb-4">
                {ocupacion.nacedoras.map((m) => (
                  <TarjetaMaquina
                    key={m.numero}
                    maquina={m}
                    etiqueta="Nacedora"
                    color="bg-info"
                    onVerTanda={(_, carro) => setCarroNacAbierto({ ...carro, nacedora: m.numero })}
                  />
                ))}
              </div>

              </>
            )}

            {/* Historial único: el ciclo entero de la tanda, del ingreso a la
                incubadora hasta el nacimiento, para leer el rendimiento de punta
                a punta en la misma fila. */}
            {solapa === "rendimiento" && (
              rendimientoPlanteles.length === 0 ? (
                <div className="card shadow-sm">
                  <div className="card-body text-center py-5 text-muted">
                    <i className="bi bi-graph-up fs-1 d-block mb-2"></i>
                    Todavía no nació ninguna tanda. El porcentaje aparece cuando se
                    registre el primer nacimiento.
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-muted small mb-3">
                    Cuánto nace de cada plantel de reproductoras. Solo entran las tandas ya
                    nacidas: las que siguen en la máquina se muestran aparte para que no
                    hundan el porcentaje. Dentro de cada plantel se abre por tipo de API,
                    que es lo que permite comparar el huevo de cinta contra el de piso.
                  </p>
                  <div className="row g-3">
                    {rendimientoPlanteles.map((p) => (
                      <div className="col-12 col-lg-6" key={p.id}>
                        <div className="card shadow-sm h-100">
                          <div className="card-header bg-white d-flex justify-content-between align-items-center">
                            <span className="fw-bold">
                              Plantel #{p.numeroLote}
                              {p.galpon != null && (
                                <span className="text-muted fw-normal small ms-2">
                                  {nombreGalpon(constantes?.galpones, "postura", p.galpon)}
                                </span>
                              )}
                            </span>
                            {p.porcentaje != null && (
                              <span
                                className={`badge fs-6 ${
                                  p.porcentaje >= 80
                                    ? "bg-success"
                                    : p.porcentaje >= 70
                                    ? "bg-warning text-dark"
                                    : "bg-danger"
                                }`}
                              >
                                {formatearPorcentaje(p.porcentaje)}
                              </span>
                            )}
                          </div>
                          <div className="card-body">
                            <div className="row g-2 text-center mb-3">
                              <div className="col-4">
                                <div className="border rounded p-2">
                                  <div className="text-muted small">Incubados</div>
                                  <div className="fw-bold">{formatearNumero(p.incubados)}</div>
                                </div>
                              </div>
                              <div className="col-4">
                                <div className="border rounded p-2">
                                  <div className="text-muted small">Nacidos</div>
                                  <div className="fw-bold text-success">
                                    {formatearNumero(p.nacidos)}
                                  </div>
                                </div>
                              </div>
                              <div className="col-4">
                                <div className="border rounded p-2">
                                  <div className="text-muted small">Tandas</div>
                                  <div className="fw-bold">{p.tandasNacidas}</div>
                                </div>
                              </div>
                            </div>

                            <div className="table-responsive">
                              <table className="table table-sm align-middle mb-0">
                                <thead className="table-light">
                                  <tr>
                                    <th className="small">Tipo de API</th>
                                    <th className="small text-end">Incubados</th>
                                    <th className="small text-end">Nacidos</th>
                                    <th className="small text-end">%</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.porTipo.map((t) => (
                                    <tr key={t.tipo}>
                                      <td className="small">
                                        {t.tipo === "sinTipo"
                                          ? "Sin tipo (tandas viejas)"
                                          : etiquetaTipoHuevo(t.tipo)}
                                      </td>
                                      <td className="small text-end">
                                        {formatearNumero(t.incubados)}
                                      </td>
                                      <td className="small text-end text-success">
                                        {formatearNumero(t.nacidos)}
                                      </td>
                                      <td className="small text-end fw-semibold">
                                        {t.porcentaje != null
                                          ? formatearPorcentaje(t.porcentaje)
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {p.enCurso > 0 && (
                              <div className="alert alert-light border small mt-3 mb-0">
                                <i className="bi bi-hourglass-split me-1"></i>
                                {p.enCurso} tanda{p.enCurso === 1 ? "" : "s"} en curso con{" "}
                                {formatearNumero(p.huevosEnCurso)} huevos: todavía no cuentan
                                en el porcentaje.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}

            {solapa === "historial" &&
              (tandas.length === 0 ? (
                <div className="card shadow-sm">
                  <div className="card-body text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                    Todavía no se cargó ninguna tanda.
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="card shadow-sm d-none d-md-block">
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Tanda</th>
                            <th>Plantel</th>
                            <th>Fecha</th>
                            <th className="text-end">Ingreso</th>
                            <th className="text-end" title="Descarte de inoculación: va a venta">
                              Desc. inoculación
                            </th>
                            <th className="text-end">A nacedora</th>
                            <th className="text-end" title="Descarte del miraje: se tira entero">
                              Desc. miraje
                            </th>
                            <th className="text-end" title="Peso del huevo: carga → transferencia">
                              Pérdida peso
                            </th>
                            <th>Nacimiento</th>
                            <th className="text-end">Vivos</th>
                            <th className="text-end" title="Muertos o descartados al nacer: pérdida">
                              Desc. nacimiento
                            </th>
                            <th className="text-end">Rendimiento</th>
                            <th className="text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tandasPagina.map((t) => {
                            const est = ESTADO_TANDA[t.estado] || {};
                            return (
                              <tr key={t._id}>
                                <td className="fw-bold">#{t.numeroTanda}</td>
                                <td>#{t.lote?.numeroLote ?? "?"}</td>
                                <td>{formatearFechaLocal(t.fechaIngreso)}</td>
                                <td className="text-end">{formatearNumero(t.huevosIngresados)}</td>
                                <td className="text-end text-warning">
                                  {formatearNumero(t.descarteInoculacion)}
                                </td>
                                <td className="text-end">
                                  {t.transferencia
                                    ? formatearNumero(t.transferencia.huevosTransferidos)
                                    : "-"}
                                </td>
                                <td className="text-end text-danger">
                                  {t.transferencia
                                    ? formatearNumero(t.transferencia.descarteMirajePerdida || 0)
                                    : "-"}
                                </td>
                                <td
                                  className="text-end"
                                  title={
                                    t.pesoHuevoIngreso || t.transferencia?.pesoHuevo
                                      ? `${t.pesoHuevoIngreso ?? "-"} g → ${t.transferencia?.pesoHuevo ?? "-"} g`
                                      : undefined
                                  }
                                >
                                  {t.perdidaPeso != null ? formatearPorcentaje(t.perdidaPeso) : "-"}
                                </td>
                                <td>
                                  {t.nacimiento?.fecha ? (
                                    formatearFechaLocal(t.nacimiento.fecha)
                                  ) : (
                                    <span className="text-muted small">pendiente</span>
                                  )}
                                </td>
                                <td className="text-end fw-semibold text-success">
                                  {t.nacimiento
                                    ? formatearNumero(t.nacimiento.pollitosNacidos)
                                    : "-"}
                                </td>
                                <td className="text-end text-danger">
                                  {t.nacimiento
                                    ? formatearNumero(t.nacimiento.descarteNacimiento || 0)
                                    : "-"}
                                </td>
                                <td className="text-end fw-bold">
                                  {t.nacimiento ? formatearPorcentaje(t.rendimiento) : "-"}
                                </td>
                                <td className="text-center">
                                  <span className={`badge ${est.clase}`}>{est.label}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="d-md-none">
                    {tandasPagina.map((t) => {
                      const est = ESTADO_TANDA[t.estado] || {};
                      return (
                        <div className="card shadow-sm mb-2" key={t._id}>
                          <div className="card-body">
                            <div className="d-flex justify-content-between mb-2">
                              <strong>Tanda #{t.numeroTanda}</strong>
                              <span className={`badge ${est.clase}`}>{est.label}</span>
                            </div>
                            <div className="row g-2 small">
                              <div className="col-6">
                                <span className="text-muted">Plantel:</span> #
                                {t.lote?.numeroLote ?? "?"}
                              </div>
                              <div className="col-6">
                                <span className="text-muted">Fecha:</span>{" "}
                                {formatearFechaLocal(t.fechaIngreso)}
                              </div>
                              <div className="col-6">
                                <span className="text-muted">Incubaron:</span>{" "}
                                <strong>{formatearNumero(t.huevosIncubando)}</strong>
                              </div>
                              <div className="col-6">
                                <span className="text-muted">A nacedora:</span>{" "}
                                {t.transferencia
                                  ? formatearNumero(t.transferencia.huevosTransferidos)
                                  : "-"}
                              </div>
                              <div className="col-6">
                                <span className="text-muted">Peso:</span>{" "}
                                {t.pesoHuevoIngreso ?? "-"} → {t.transferencia?.pesoHuevo ?? "-"} g
                              </div>
                              <div className="col-6">
                                <span className="text-muted">Pérdida peso:</span>{" "}
                                {t.perdidaPeso != null ? formatearPorcentaje(t.perdidaPeso) : "-"}
                              </div>
                              <div className="col-6">
                                <span className="text-muted">Vivos:</span>{" "}
                                <strong className="text-success">
                                  {t.nacimiento
                                    ? formatearNumero(t.nacimiento.pollitosNacidos)
                                    : "-"}
                                </strong>
                              </div>
                              <div className="col-6">
                                <span className="text-muted">Desc. nacimiento:</span>{" "}
                                <span className="text-danger">
                                  {t.nacimiento
                                    ? formatearNumero(t.nacimiento.descarteNacimiento || 0)
                                    : "-"}
                                </span>
                              </div>
                              <div className="col-6">
                                <span className="text-muted">Rendimiento:</span>{" "}
                                <strong>
                                  {t.nacimiento ? formatearPorcentaje(t.rendimiento) : "-"}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Pagination
                    currentPage={paginaHistorial}
                    totalItems={tandas.length}
                    itemsPerPage={ITEMS_POR_PAGINA}
                    onPageChange={setPaginaHistorial}
                  />
                </>
              ))}
          </>
        )}
      </div>

      {tandaNacimiento && (
        <NacimientoModal
          tanda={tandaNacimiento}
          onClose={() => setTandaNacimiento(null)}
          onHecho={() => {
            setTandaNacimiento(null);
            cargar();
          }}
        />
      )}
      {carroNacAbierto && (
        <CarroNacedoraModal
          carro={carroNacAbierto}
          constantes={constantes}
          onClose={() => setCarroNacAbierto(null)}
          onRegistrarNacimiento={(t) => {
            setCarroNacAbierto(null);
            // El mapa trae un resumen; el modal de nacimiento necesita la tanda entera.
            setTandaNacimiento(tandas.find((x) => x._id === t._id) || t);
          }}
        />
      )}

      {tandaAbierta && (
        <TandaEnCarroModal
          tanda={tandaAbierta}
          constantes={constantes}
          onClose={() => setTandaAbierta(null)}
          onTransferir={(t) => {
            setTandaAbierta(null);
            // El mapa trae un resumen; para transferir hace falta la tanda entera.
            setTandaTransferir(tandas.find((x) => x._id === t._id) || t);
          }}
          onCancelar={(t) => {
            setTandaAbierta(null);
            handleCancelar(tandas.find((x) => x._id === t._id) || t);
          }}
        />
      )}

      {descartando && (
        <DescartarApiModal
          entrada={descartando}
          onClose={() => setDescartando(null)}
          onHecho={async () => {
            setDescartando(null);
            await cargar();
          }}
        />
      )}

      {enviandoAVenta && (
        <EnviarAVentaModal
          entrada={enviandoAVenta}
          onClose={() => setEnviandoAVenta(null)}
          onHecho={async () => {
            setEnviandoAVenta(null);
            await cargar();
          }}
        />
      )}

      {asignando && (
        <AsignarCarroModal
          entrada={asignando}
          fecha={obtenerFechaHoy()}
          constantes={constantes}
          incubadoras={ocupacion.incubadoras}
          onClose={() => setAsignando(null)}
          onHecho={async () => {
            setAsignando(null);
            await cargar();
          }}
        />
      )}

      {tandaTransferir && (
        <TransferenciaModal
          tanda={tandaTransferir}
          nacedoras={ocupacion.nacedoras}
          onClose={() => setTandaTransferir(null)}
          onHecho={() => {
            setTandaTransferir(null);
            cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default IncubadoraPage;
