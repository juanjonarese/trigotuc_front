import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerStockHuevosDescarte,
  obtenerSalidasHuevos,
  crearSalidaHuevos,
  anularSalidaHuevos,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import { formatearNumero, textoDesglose, ORIGEN_DESCARTE } from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

const MOTIVOS = {
  venta:   { label: "Venta", clase: "bg-success" },
  consumo: { label: "Consumo interno", clase: "bg-info text-dark" },
  rotura:  { label: "Rotura", clase: "bg-danger" },
  otro:    { label: "Otro", clase: "bg-secondary" },
};

// ── Modal: sacar huevos del stock ───────────────────────────────────────────
// Provisorio: descuenta stock sin cliente ni comprobante, dejando registro de
// cuánto salió y por qué. Cuando exista el módulo de ventas, la salida por
// "venta" se reemplaza por la venta real con cliente.
const SalidaModal = ({ stock, onClose, onHecho }) => {
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [unidad, setUnidad] = useState("maples"); // maples | huevos
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("venta");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const porMaple = stock.huevosPorMaple || 30;
  const cant = Number(cantidad) || 0;
  const huevos = unidad === "maples" ? cant * porMaple : cant;
  const restante = stock.total - huevos;
  const excede = huevos > stock.total;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (huevos <= 0) {
      Swal.fire("Falta la cantidad", "Cargá cuántos huevos salen del stock.", "warning");
      return;
    }
    if (excede) {
      Swal.fire(
        "No alcanza el stock",
        `Hay ${formatearNumero(stock.total)} huevos disponibles y estás sacando ${formatearNumero(huevos)}.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      await crearSalidaHuevos({
        fecha: ajustarFechaParaGuardar(fecha),
        huevos,
        motivo,
        observaciones: observaciones || undefined,
      });
      onHecho();
      Swal.fire({
        icon: "success",
        title: "Stock descontado",
        text: `Salieron ${formatearNumero(huevos)} huevos.`,
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo descontar el stock.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-warning">
              <h5 className="modal-title">
                <i className="bi bi-box-arrow-up me-2"></i>Sacar huevos del stock
              </h5>
              <button className="btn-close" onClick={onClose} disabled={saving}></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="d-flex justify-content-between border rounded px-3 py-2 mb-3 small">
                  <span>
                    <span className="text-muted">En stock</span>{" "}
                    <strong>{formatearNumero(stock.total)}</strong>
                  </span>
                  <span>
                    <span className="text-muted">Salen</span>{" "}
                    <strong className="text-warning">{formatearNumero(huevos)}</strong>
                  </span>
                  <span>
                    <span className="text-muted">Quedan</span>{" "}
                    <strong className={excede ? "text-danger" : "text-success"}>
                      {formatearNumero(restante)}
                    </strong>
                  </span>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold small">Motivo</label>
                    <select
                      className="form-select"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                    >
                      {Object.entries(MOTIVOS).map(([key, m]) => (
                        <option key={key} value={key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="form-label fw-semibold small">¿Cuánto sale?</label>
                <div className="input-group mb-1">
                  <input
                    type="number"
                    className={`form-control ${excede ? "border-danger" : ""}`}
                    min="0"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0"
                  />
                  <button
                    type="button"
                    className={`btn ${unidad === "maples" ? "btn-secondary" : "btn-outline-secondary"}`}
                    onClick={() => setUnidad("maples")}
                  >
                    Maples
                  </button>
                  <button
                    type="button"
                    className={`btn ${unidad === "huevos" ? "btn-secondary" : "btn-outline-secondary"}`}
                    onClick={() => setUnidad("huevos")}
                  >
                    Huevos
                  </button>
                </div>
                <div className="form-text mb-3">
                  {unidad === "maples"
                    ? `1 maple = ${porMaple} huevos · salen ${formatearNumero(huevos)} unidades`
                    : "Se descuenta en unidades"}
                </div>

                <div className="alert alert-light border small mb-3">
                  <i className="bi bi-info-circle me-1"></i>
                  Se descuenta <strong>FIFO</strong>: salen primero los huevos más viejos, sin
                  importar de qué descarte vengan. Esta salida no registra cliente.
                </div>

                <label className="form-label fw-semibold small">
                  Observaciones <span className="text-muted fw-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="A quién se le dio, remito, etc."
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-warning" disabled={saving || excede}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  Descontar del stock
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

const StockHuevosPage = () => {
  const [stock, setStock] = useState(null);
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    try {
      const [stk, sal] = await Promise.all([obtenerStockHuevosDescarte(), obtenerSalidasHuevos()]);
      setStock(stk);
      setSalidas(Array.isArray(sal) ? sal : []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const anular = async (salida) => {
    const { isConfirmed, value } = await Swal.fire({
      icon: "warning",
      title: `¿Anular la salida ${salida.numeroSalida}?`,
      text: `Vuelven al stock ${salida.huevosTotales} huevos.`,
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Volver",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await anularSalidaHuevos(salida._id, value || undefined);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const salidasPagina = salidas.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-egg text-success me-2"></i>Stock de Huevos
            </h1>
            <p className="text-muted mb-0 small">
              Huevos de descarte disponibles para la venta — de la clasificación, la carga a
              incubadora y el miraje
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={cargar} disabled={loading}>
              <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
            </button>
            <button
              className="btn btn-warning"
              onClick={() => setModal(true)}
              disabled={loading || !stock?.total}
            >
              <i className="bi bi-box-arrow-up me-1"></i>Sacar del stock
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : !stock ? null : (
          <>
            {/* Total disponible */}
            <div className="row g-2 mb-4">
              <div className="col-12 col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Huevos en stock</div>
                    <div className="h3 fw-bold mb-0 text-success">
                      {formatearNumero(stock.total)}
                    </div>
                    <div className="text-muted small">{textoDesglose(stock.total)}</div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Maples</div>
                    <div className="h3 fw-bold mb-0">
                      {formatearNumero(stock.maplesDisponibles)}
                    </div>
                    <div className="text-muted small">
                      de {stock.huevosPorMaple} huevos c/u
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Partidas</div>
                    <div className="h3 fw-bold mb-0">{stock.partidas.length}</div>
                    <div className="text-muted small">con saldo</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Partidas: el orden es el orden en que van a salir */}
            <h5 className="fw-bold text-secondary mb-3">
              Partidas disponibles
              <span className="text-muted fw-normal small ms-2">
                en orden de salida (FIFO, las más viejas primero)
              </span>
            </h5>
            {stock.partidas.length === 0 ? (
              <div className="card shadow-sm mb-4">
                <div className="card-body text-center py-4 text-muted">
                  No hay huevos de descarte en stock.
                </div>
              </div>
            ) : (
              <div className="card shadow-sm mb-4">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Fecha</th>
                        <th>Origen</th>
                        <th className="text-center">Plantel</th>
                        <th className="text-end">Ingresaron</th>
                        <th className="text-end">Disponibles</th>
                        <th>Equivale a</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.partidas.map((p) => (
                        <tr key={p._id}>
                          <td>{formatearFechaLocal(p.fecha)}</td>
                          <td className="small">{ORIGEN_DESCARTE[p.origen] || p.etiqueta}</td>
                          <td className="text-center">#{p.numeroLote ?? "?"}</td>
                          <td className="text-end text-muted">{formatearNumero(p.cantidad)}</td>
                          <td className="text-end fw-semibold text-success">
                            {formatearNumero(p.disponible)}
                          </td>
                          <td className="small text-muted">{textoDesglose(p.disponible)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Salidas */}
            <h5 className="fw-bold text-secondary mb-3">Salidas de stock</h5>
            {salidas.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-4 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  Todavía no salió nada del stock.
                </div>
              </div>
            ) : (
              <>
                <div className="card shadow-sm">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Salida</th>
                          <th>Fecha</th>
                          <th>Motivo</th>
                          <th className="text-end">Huevos</th>
                          <th className="text-end">Maples</th>
                          <th>Observaciones</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {salidasPagina.map((s) => {
                          const m = MOTIVOS[s.motivo] || {};
                          return (
                            <tr key={s._id} className={s.anulada ? "text-muted" : ""}>
                              <td className="fw-bold">{s.numeroSalida}</td>
                              <td>{formatearFechaLocal(s.fecha)}</td>
                              <td>
                                <span className={`badge ${m.clase}`}>{m.label}</span>
                                {s.anulada && (
                                  <span className="badge bg-secondary ms-1">Anulada</span>
                                )}
                              </td>
                              <td className="text-end fw-semibold">
                                {formatearNumero(s.huevosTotales)}
                              </td>
                              <td className="text-end">{formatearNumero(s.maples)}</td>
                              <td className="small text-muted">{s.observaciones || "—"}</td>
                              <td className="text-end">
                                {!s.anulada && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => anular(s)}
                                    title="Anular y devolver al stock"
                                  >
                                    <i className="bi bi-arrow-counterclockwise"></i>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <Pagination
                  currentPage={pagina}
                  totalItems={salidas.length}
                  itemsPerPage={ITEMS_POR_PAGINA}
                  onPageChange={setPagina}
                />
              </>
            )}
          </>
        )}
      </div>

      {modal && stock && (
        <SalidaModal
          stock={stock}
          onClose={() => setModal(false)}
          onHecho={() => {
            setModal(false);
            cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default StockHuevosPage;
