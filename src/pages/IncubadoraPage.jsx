import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerConstantesReproductores,
  obtenerEstadoIncubadora,
  obtenerStockIncubable,
  obtenerTandasIncubacion,
  crearTandaIncubacion,
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
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

// ── Modal: cargar tanda en la incubadora ────────────────────────────────────
// La tanda es homogénea (un solo lote) y consume los inoculables más viejos
// primero. El descarte de inoculación se carga acá y va directo a venta.
const CargarTandaModal = ({ stock, disponible, constantes, onClose, onHecho }) => {
  const [loteSel, setLoteSel] = useState(stock[0]?.lote || "");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [cajones, setCajones] = useState("");
  const [huevosSueltos, setHuevosSueltos] = useState("");
  const [descarte, setDescarte] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  const entrada = stock.find((s) => String(s.lote) === String(loteSel));

  const huevos = (Number(cajones) || 0) * huevosPorCajon + (Number(huevosSueltos) || 0);
  const desc = Number(descarte) || 0;
  const incubando = huevos - desc;

  const excedeStock = entrada ? huevos > entrada.huevosDisponibles : false;
  const excedeCapacidad = incubando > disponible;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loteSel) {
      Swal.fire("Falta el lote", "Elegí de qué lote son los huevos.", "warning");
      return;
    }
    if (huevos <= 0) {
      Swal.fire("Faltan huevos", "Cargá cuántos huevos entran a la incubadora.", "warning");
      return;
    }
    if (desc >= huevos) {
      Swal.fire("Descarte inválido", "El descarte no puede ser igual o mayor al total cargado.", "warning");
      return;
    }
    if (excedeStock) {
      Swal.fire(
        "Stock insuficiente",
        `El lote tiene ${formatearNumero(entrada.huevosDisponibles)} inoculables disponibles.`,
        "warning"
      );
      return;
    }
    if (excedeCapacidad) {
      Swal.fire(
        "No entran en la incubadora",
        `Quedan ${formatearNumero(disponible)} lugares libres y estás cargando ${formatearNumero(incubando)}.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const tanda = await crearTandaIncubacion({
        lote: loteSel,
        fecha: ajustarFechaParaGuardar(fecha),
        huevos,
        descarteInoculacion: desc,
        observaciones: observaciones || undefined,
      });
      onHecho();
      Swal.fire({
        icon: "success",
        title: `Tanda #${tanda.numeroTanda} cargada`,
        text: `${formatearNumero(tanda.huevosIncubando)} huevos incubando · transferencia prevista ${formatearFechaLocal(
          tanda.fechaTransferenciaPrevista
        )}`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar la tanda.", "error");
    } finally {
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
                <i className="bi bi-thermometer-half me-2"></i>Cargar tanda en la incubadora
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              <form id="form-tanda" onSubmit={handleSubmit}>
                <div className="alert alert-light border small mb-3">
                  <i className="bi bi-info-circle me-1"></i>
                  La tanda es de un <strong>solo lote</strong>. Se consumen los huevos inoculables
                  más viejos primero (FIFO). A los {constantes?.diasIncubacion ?? 18} días se
                  transfieren a la nacedora.
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Lote de origen</label>
                  <select className="form-select" value={loteSel} onChange={(e) => setLoteSel(e.target.value)}>
                    {stock.map((s) => (
                      <option key={s.lote} value={s.lote}>
                        Lote #{s.numeroLote} — {formatearNumero(s.huevosDisponibles)} inoculables (
                        {textoDesglose(s.huevosDisponibles, huevosPorCajon, constantes?.huevosPorBandeja)})
                      </option>
                    ))}
                  </select>
                </div>

                {entrada && (
                  <div className="table-responsive mb-3">
                    <table className="table table-sm mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="small">Fecha de recolección</th>
                          <th className="small text-end">Disponibles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entrada.partidas.map((p) => (
                          <tr key={p.recoleccion}>
                            <td className="small">{formatearFechaLocal(p.fecha)}</td>
                            <td className="small text-end">{formatearNumero(p.disponibles)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="row g-3 mb-3">
                  <div className="col-md-3">
                    <label className="form-label fw-semibold small">Fecha de carga</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold small">Cajones</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={cajones}
                      onChange={(e) => setCajones(e.target.value)}
                      placeholder="0"
                    />
                    <div className="form-text">{huevosPorCajon} c/u</div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold small">Huevos sueltos</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={huevosSueltos}
                      onChange={(e) => setHuevosSueltos(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold small">Descarte</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={descarte}
                      onChange={(e) => setDescarte(e.target.value)}
                      placeholder="0"
                    />
                    <div className="form-text">va a venta</div>
                  </div>
                </div>

                {huevos > 0 && (
                  <div
                    className={`alert py-2 small mb-3 ${
                      excedeStock || excedeCapacidad ? "alert-danger" : "alert-warning"
                    }`}
                  >
                    <div>
                      <strong>Cargados:</strong> {formatearNumero(huevos)} ·{" "}
                      <strong>Descarte:</strong> {formatearNumero(desc)} ·{" "}
                      <strong>Incubando:</strong> {formatearNumero(incubando)}
                    </div>
                    {excedeStock && (
                      <div className="mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        Supera los inoculables disponibles del lote.
                      </div>
                    )}
                    {excedeCapacidad && (
                      <div className="mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        Supera la capacidad libre de la incubadora ({formatearNumero(disponible)}).
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
                form="form-tanda"
                className="btn btn-warning"
                disabled={saving || excedeStock || excedeCapacidad}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-box-arrow-in-down me-1"></i>Cargar tanda
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: transferencia a nacedora (miraje con luz) ────────────────────────
const TransferenciaModal = ({ tanda, onClose, onHecho }) => {
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [transferidos, setTransferidos] = useState("");
  const [aVenta, setAVenta] = useState("");
  const [perdida, setPerdida] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  // Los tres destinos del miraje tienen que sumar los huevos en incubación.
  const trans     = Number(transferidos) || 0;
  const descarte  = Number(aVenta) || 0;
  const descartado = Number(perdida) || 0;
  const total     = trans + descarte + descartado;
  const diferencia = tanda.huevosIncubando - total;
  const cuadra = diferencia === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (transferidos === "") {
      Swal.fire("Falta el dato", "Cargá cuántos huevos pasan a la nacedora.", "warning");
      return;
    }
    if (!cuadra) {
      Swal.fire(
        "Las cantidades no cuadran",
        `A la nacedora (${formatearNumero(trans)}) + descarte venta (${formatearNumero(descarte)}) + ` +
          `descarte (${formatearNumero(descartado)}) = ${formatearNumero(total)}, y la tanda tiene ` +
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
        descarteMiraje: descarte,
        descarteMirajePerdida: descartado,
        observaciones: observaciones || undefined,
      });
      onHecho();
      Swal.fire({
        icon: "success",
        title: "Transferida a nacedora",
        text: `${formatearNumero(trans)} huevos · nacimiento previsto ${formatearFechaLocal(
          actualizada.fechaNacimientoPrevista
        )}`,
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

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold small">
                      <i className="bi bi-cart text-warning me-1"></i>Descarte venta
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max={tanda.huevosIncubando}
                      value={aVenta}
                      onChange={(e) => setAVenta(e.target.value)}
                      placeholder="0"
                    />
                    <div className="form-text">Claros e infértiles: van al stock de venta.</div>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small">
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
                    <div className="form-text">Podridos y embrión muerto: se tiran.</div>
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
                        A la nacedora + descarte venta + descarte tiene que dar exactamente los
                        huevos en incubación.
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
                disabled={saving || !cuadra}
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
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const transferidos = tanda.transferencia?.huevosTransferidos ?? 0;
  const nacidos = Number(pollitos) || 0;
  const noNacidos = Math.max(0, transferidos - nacidos);
  const excede = nacidos > transferidos;
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
        `Se transfirieron ${formatearNumero(transferidos)} huevos a la nacedora.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const actualizada = await registrarNacimiento(tanda._id, {
        fecha: ajustarFechaParaGuardar(fecha),
        pollitosNacidos: nacidos,
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
                <i className="bi bi-egg-fried me-2"></i>Nacimiento — tanda #{tanda.numeroTanda}
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

                <div className="mb-3">
                  <label className="form-label fw-semibold">Pollitos nacidos</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max={transferidos}
                    value={pollitos}
                    onChange={(e) => setPollitos(e.target.value)}
                    required
                  />
                </div>

                {pollitos !== "" && (
                  <div className={`alert py-2 small ${excede ? "alert-danger" : "alert-success"}`}>
                    <div>
                      <strong>No nacidos:</strong> {formatearNumero(noNacidos)}
                      {" · "}
                      <strong>Rendimiento:</strong> {formatearPorcentaje(rendimiento)}
                    </div>
                    <div className="text-muted mt-1">
                      El rendimiento se mide sobre los huevos que entraron a la incubadora.
                    </div>
                    {excede && (
                      <div className="mt-1">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        No pueden nacer más pollitos que huevos transferidos.
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
  const [modalCarga, setModalCarga] = useState(false);
  const [tandaTransferir, setTandaTransferir] = useState(null);
  const [tandaNacimiento, setTandaNacimiento] = useState(null);
  const [solapa, setSolapa] = useState("incubadora");
  const [paginaHistorial, setPaginaHistorial] = useState(1);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, est, stk, tds] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerEstadoIncubadora(),
        obtenerStockIncubable(),
        obtenerTandasIncubacion(),
      ]);
      setConstantes(cons);
      setEstado(est);
      setStock(Array.isArray(stk) ? stk : []);
      setTandas(Array.isArray(tds) ? tds : []);
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
      text: "Los huevos vuelven al stock incubable del lote.",
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

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-thermometer-half text-warning me-2"></i>Incubadora
            </h1>
            <p className="text-muted mb-0 small">
              {diasIncubacion} días de incubación + {diasNacedora} de nacedora · capacidad{" "}
              {formatearNumero(constantes?.capacidadIncubadora)} huevos
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
              <i className="bi bi-arrow-clockwise"></i>
            </button>
            <button
              className="btn btn-warning"
              onClick={() => setModalCarga(true)}
              disabled={loading || stock.length === 0}
            >
              <i className="bi bi-box-arrow-in-down me-1"></i>Cargar tanda
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
        </ul>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning"></div>
          </div>
        ) : !estado ? null : (
          <>
            {solapa === "incubadora" && (
              <>
              {/* Ocupación */}
              <div className="card shadow-sm mb-4">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-baseline mb-2">
                    <h5 className="fw-bold mb-0">Ocupación</h5>
                    <span className="fw-bold">
                      {formatearNumero(estado.ocupados)} / {formatearNumero(estado.capacidad)}{" "}
                      <span className="text-muted small">
                        ({formatearPorcentaje(estado.porcentajeOcupacion)})
                      </span>
                    </span>
                  </div>
                  <div className="progress mb-3" style={{ height: "20px" }}>
                    <div
                      className={`progress-bar ${
                        estado.porcentajeOcupacion >= 90
                          ? "bg-danger"
                          : estado.porcentajeOcupacion >= 60
                          ? "bg-warning"
                          : "bg-success"
                      }`}
                      style={{ width: `${Math.min(100, estado.porcentajeOcupacion)}%` }}
                    >
                      {estado.porcentajeOcupacion > 8 && formatearPorcentaje(estado.porcentajeOcupacion)}
                    </div>
                  </div>
                  <div className="row g-2 small">
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center">
                        <div className="text-muted">Ocupados</div>
                        <div className="fw-bold">{formatearNumero(estado.ocupados)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          {textoDesglose(estado.ocupados, constantes?.huevosPorCajon, constantes?.huevosPorBandeja)}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center">
                        <div className="text-muted">Libres</div>
                        <div className="fw-bold text-success">{formatearNumero(estado.disponible)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          {textoDesglose(estado.disponible, constantes?.huevosPorCajon, constantes?.huevosPorBandeja)}
                        </div>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="border rounded p-2 text-center">
                        <div className="text-muted">Stock incubable</div>
                        <div className="fw-bold text-info">{formatearNumero(totalIncubable)}</div>
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          en {stock.length} lote{stock.length === 1 ? "" : "s"}
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

              {/* Tandas en incubadora */}
              <h5 className="fw-bold text-secondary mb-3">
                <i className="bi bi-thermometer-half me-1"></i>En la incubadora (
                {estado.tandasEnIncubadora.length})
              </h5>
              {estado.tandasEnIncubadora.length === 0 ? (
                <div className="card shadow-sm mb-4">
                  <div className="card-body text-center py-4 text-muted">
                    La incubadora está vacía.
                  </div>
                </div>
              ) : (
                <div className="row g-3 mb-4">
                  {estado.tandasEnIncubadora.map((t) => {
                    const dias = t.diasEnIncubadora ?? 0;
                    const listaParaTransferir = dias >= diasIncubacion;
                    const progreso = Math.min(100, Math.round((dias / diasIncubacion) * 100));
                    return (
                      <div className="col-12 col-md-6 col-xl-4" key={t._id}>
                        <div
                          className={`card shadow-sm h-100 ${
                            listaParaTransferir ? "border-info border-2" : ""
                          }`}
                        >
                          <div className="card-header bg-white d-flex justify-content-between align-items-center">
                            <span className="fw-bold">Tanda #{t.numeroTanda}</span>
                            <span className={`badge ${ESTADO_TANDA.en_incubadora.clase}`}>
                              Día {dias}/{diasIncubacion}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="progress mb-3" style={{ height: "6px" }}>
                              <div
                                className={`progress-bar ${listaParaTransferir ? "bg-info" : "bg-warning"}`}
                                style={{ width: `${progreso}%` }}
                              ></div>
                            </div>
                            <div className="small mb-3">
                              <div>
                                <span className="text-muted">Lote:</span>{" "}
                                <strong>#{t.lote?.numeroLote ?? "?"}</strong>
                              </div>
                              <div>
                                <span className="text-muted">Ingreso:</span>{" "}
                                {formatearFechaLocal(t.fechaIngreso)}
                              </div>
                              <div>
                                <span className="text-muted">Incubando:</span>{" "}
                                <strong>{formatearNumero(t.huevosIncubando)}</strong> huevos
                              </div>
                              <div>
                                <span className="text-muted">Transferencia prevista:</span>{" "}
                                {formatearFechaLocal(t.fechaTransferenciaPrevista)}
                              </div>
                            </div>

                            {listaParaTransferir && (
                              <div className="alert alert-info py-2 small mb-2">
                                <i className="bi bi-bell me-1"></i>Lista para transferir a la nacedora
                              </div>
                            )}

                            <div className="d-grid gap-2">
                              <button
                                className={`btn btn-sm ${listaParaTransferir ? "btn-info" : "btn-outline-info"}`}
                                onClick={() => setTandaTransferir(t)}
                              >
                                <i className="bi bi-arrow-right-circle me-1"></i>Transferir a nacedora
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleCancelar(t)}
                              >
                                <i className="bi bi-x-circle me-1"></i>Cancelar tanda
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tandas en nacedora: aparecen acá apenas se transfieren. */}
              <h5 className="fw-bold text-secondary mb-3">
                <i className={`bi ${ESTADO_TANDA.en_nacedora.icono} me-1`}></i>En la nacedora (
                {estado.tandasEnNacedora.length})
              </h5>
              {estado.tandasEnNacedora.length === 0 ? (
                <div className="card shadow-sm mb-4">
                  <div className="card-body text-center py-4 text-muted">
                    No hay tandas en la nacedora.
                  </div>
                </div>
              ) : (
                <div className="row g-3 mb-4">
                  {estado.tandasEnNacedora.map((t) => {
                    const dias = t.diasEnNacedora ?? 0;
                    const listaParaNacer = dias >= diasNacedora;
                    const progreso = Math.min(100, Math.round((dias / diasNacedora) * 100));
                    const aVenta = t.transferencia?.descarteMiraje || 0;
                    const perdida = t.transferencia?.descarteMirajePerdida || 0;
                    return (
                      <div className="col-12 col-md-6 col-xl-4" key={t._id}>
                        <div
                          className={`card shadow-sm h-100 ${
                            listaParaNacer ? "border-success border-2" : ""
                          }`}
                        >
                          <div className="card-header bg-white d-flex justify-content-between align-items-center">
                            <span className="fw-bold">Tanda #{t.numeroTanda}</span>
                            <span className={`badge ${ESTADO_TANDA.en_nacedora.clase}`}>
                              Día {dias}/{diasNacedora}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="progress mb-3" style={{ height: "6px" }}>
                              <div
                                className={`progress-bar ${listaParaNacer ? "bg-success" : "bg-info"}`}
                                style={{ width: `${progreso}%` }}
                              ></div>
                            </div>
                            <div className="small mb-3">
                              <div>
                                <span className="text-muted">Lote:</span>{" "}
                                <strong>#{t.lote?.numeroLote ?? "?"}</strong>
                                {t.lote?.galpon && (
                                  <span className="text-muted"> · galpón {t.lote.galpon}</span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted">Transferencia:</span>{" "}
                                {formatearFechaLocal(t.transferencia?.fecha)}
                              </div>
                              <div>
                                <span className="text-muted">En nacedora:</span>{" "}
                                <strong>
                                  {formatearNumero(t.transferencia?.huevosTransferidos)}
                                </strong>{" "}
                                huevos
                              </div>
                              <div>
                                <span className="text-muted">Nacimiento previsto:</span>{" "}
                                {formatearFechaLocal(t.fechaNacimientoPrevista)}
                              </div>
                            </div>

                            <div className="row g-2 small mb-3">
                              <div className="col-6">
                                <div className="border rounded p-2 text-center">
                                  <div className="text-muted" style={{ fontSize: ".75rem" }}>
                                    Descarte venta
                                  </div>
                                  <div className="fw-bold text-warning">
                                    {formatearNumero(aVenta)}
                                  </div>
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="border rounded p-2 text-center">
                                  <div className="text-muted" style={{ fontSize: ".75rem" }}>
                                    Descarte
                                  </div>
                                  <div className="fw-bold text-danger">
                                    {formatearNumero(perdida)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {listaParaNacer && (
                              <div className="alert alert-success py-2 small mb-2">
                                <i className="bi bi-bell me-1"></i>Lista para registrar el nacimiento
                              </div>
                            )}

                            <div className="d-grid">
                              <button
                                className={`btn btn-sm ${
                                  listaParaNacer ? "btn-success" : "btn-outline-success"
                                }`}
                                onClick={() => setTandaNacimiento(t)}
                              >
                                <i className="bi bi-egg-fried me-1"></i>Registrar nacimiento
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </>
            )}

            {/* Historial único: el ciclo entero de la tanda, del ingreso a la
                incubadora hasta el nacimiento, para leer el rendimiento de punta
                a punta en la misma fila. */}
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
                            <th>Lote</th>
                            <th>Fecha</th>
                            <th className="text-end">Ingreso</th>
                            <th className="text-end">Descarte</th>
                            <th className="text-end">A nacedora</th>
                            <th className="text-end">Descarte venta</th>
                            <th className="text-end">Descarte</th>
                            <th>Nacimiento</th>
                            <th className="text-end">Nacidos</th>
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
                                <td className="text-end text-warning">
                                  {t.transferencia
                                    ? formatearNumero(t.transferencia.descarteMiraje)
                                    : "-"}
                                </td>
                                <td className="text-end text-danger">
                                  {t.transferencia
                                    ? formatearNumero(t.transferencia.descarteMirajePerdida || 0)
                                    : "-"}
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
                                <span className="text-muted">Lote:</span> #
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
                                <span className="text-muted">Nacidos:</span>{" "}
                                <strong className="text-success">
                                  {t.nacimiento
                                    ? formatearNumero(t.nacimiento.pollitosNacidos)
                                    : "-"}
                                </strong>
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

      {modalCarga && (
        <CargarTandaModal
          stock={stock}
          disponible={estado?.disponible ?? 0}
          constantes={constantes}
          onClose={() => setModalCarga(false)}
          onHecho={() => {
            setModalCarga(false);
            cargar();
          }}
        />
      )}
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
      {tandaTransferir && (
        <TransferenciaModal
          tanda={tandaTransferir}
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
