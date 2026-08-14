import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerConstantesReproductores,
  obtenerClientes,
  obtenerStockHuevosDescarte,
  obtenerVentasHuevos,
  crearVentaHuevos,
  anularVentaHuevos,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import {
  formatearNumero,
  formatearMoneda,
  ORIGEN_DESCARTE,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

const VentaHuevosPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [stock, setStock] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);

  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [maples, setMaples] = useState("");
  const [precioPorMaple, setPrecioPorMaple] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, cli, stk, vts] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerClientes(),
        obtenerStockHuevosDescarte(),
        obtenerVentasHuevos(),
      ]);
      setConstantes(cons);
      setClientes(Array.isArray(cli) ? cli : cli?.clientes || []);
      setStock(stk);
      setVentas(Array.isArray(vts) ? vts : []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const huevosPorMaple = stock?.huevosPorMaple ?? constantes?.huevosPorMaple ?? 30;
  const maplesPedidos = Number(maples) || 0;
  const huevosNecesarios = maplesPedidos * huevosPorMaple;
  const excede = stock ? huevosNecesarios > stock.total : false;
  const precio = precioPorMaple === "" ? null : Number(precioPorMaple);
  const total = precio != null ? maplesPedidos * precio : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cliente) {
      Swal.fire("Falta el cliente", "Elegí a quién se le vende.", "warning");
      return;
    }
    if (maplesPedidos <= 0) {
      Swal.fire("Faltan maples", "Cargá cuántos maples se venden.", "warning");
      return;
    }
    if (excede) {
      Swal.fire(
        "Stock insuficiente",
        `Hay ${formatearNumero(stock.maplesDisponibles)} maples disponibles (${formatearNumero(stock.total)} huevos).`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const venta = await crearVentaHuevos({
        cliente,
        fecha: ajustarFechaParaGuardar(fecha),
        maples: maplesPedidos,
        precioPorMaple: precioPorMaple === "" ? undefined : Number(precioPorMaple),
        observaciones: observaciones || undefined,
      });
      setMaples("");
      setObservaciones("");
      await cargar();
      Swal.fire({
        icon: "success",
        title: `Venta ${venta.numeroVenta} registrada`,
        text: `${formatearNumero(venta.maples)} maples · ${formatearNumero(venta.huevosTotales)} huevos descontados del stock`,
        timer: 2800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar la venta.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAnular = async (venta) => {
    const { isConfirmed, value } = await Swal.fire({
      icon: "warning",
      title: `¿Anular la venta ${venta.numeroVenta}?`,
      text: "Los huevos vuelven al stock de descarte.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Volver",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await anularVentaHuevos(venta._id, value || undefined);
      await cargar();
      Swal.fire({ icon: "success", title: "Venta anulada", timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const nombreCliente = (c) => c?.razonSocial || c?.nombre || "Cliente";
  const ventasPagina = ventas.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="mb-4">
          <h1 className="h3 fw-bold mb-1">
            <i className="bi bi-cash-coin text-success me-2"></i>Venta de Huevos
          </h1>
          <p className="text-muted mb-0 small">
            Huevos de descarte de los tres puntos del flujo — se venden por maple de{" "}
            {huevosPorMaple} huevos, descontando FIFO por fecha de descarte
          </p>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : (
          <>
            {/* Stock disponible */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-white fw-bold">
                <i className="bi bi-box-seam me-1"></i>Stock de descarte disponible
              </div>
              <div className="card-body">
                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Huevos</div>
                      <div className="h5 fw-bold mb-0">{formatearNumero(stock?.total)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Maples</div>
                      <div className="h5 fw-bold mb-0 text-success">
                        {formatearNumero(stock?.maplesDisponibles)}
                      </div>
                    </div>
                  </div>
                  {(stock?.porOrigen || []).map((o) => (
                    <div className="col-6 col-md-2" key={o.origen}>
                      <div className="border rounded p-2 text-center h-100">
                        <div className="text-muted" style={{ fontSize: ".75rem" }}>
                          {ORIGEN_DESCARTE[o.origen] || o.origen}
                        </div>
                        <div className="fw-bold">{formatearNumero(o.cantidad)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {(stock?.total ?? 0) === 0 && (
                  <div className="alert alert-warning mb-0 small">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    No hay huevos de descarte en stock. Se generan al cargar recolecciones, al
                    cargar una tanda a la incubadora y en el miraje de la transferencia.
                  </div>
                )}
              </div>
            </div>

            {/* Nueva venta */}
            {(stock?.total ?? 0) > 0 && (
              <div className="card shadow-sm mb-4">
                <div className="card-header bg-white fw-bold">
                  <i className="bi bi-plus-circle me-1"></i>Nueva venta
                </div>
                <div className="card-body">
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3 mb-3">
                      <div className="col-md-5">
                        <label className="form-label fw-semibold">Cliente</label>
                        <select
                          className="form-select"
                          value={cliente}
                          onChange={(e) => setCliente(e.target.value)}
                        >
                          <option value="">Elegí un cliente...</option>
                          {clientes.map((c) => (
                            <option key={c._id} value={c._id}>
                              {nombreCliente(c)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-semibold">Fecha</label>
                        <input
                          type="date"
                          className="form-control"
                          value={fecha}
                          onChange={(e) => setFecha(e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-semibold">Maples</label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max={stock?.maplesDisponibles}
                          value={maples}
                          onChange={(e) => setMaples(e.target.value)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-semibold">
                          $/maple <span className="text-muted fw-normal small">(opcional)</span>
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          step="0.01"
                          value={precioPorMaple}
                          onChange={(e) => setPrecioPorMaple(e.target.value)}
                          placeholder="A definir"
                        />
                      </div>
                    </div>

                    {maplesPedidos > 0 && (
                      <div className={`alert py-2 small mb-3 ${excede ? "alert-danger" : "alert-success"}`}>
                        <strong>{formatearNumero(maplesPedidos)}</strong> maples ={" "}
                        <strong>{formatearNumero(huevosNecesarios)}</strong> huevos
                        {total != null && (
                          <>
                            {" · Total: "}
                            <strong>{formatearMoneda(total)}</strong>
                          </>
                        )}
                        {excede && (
                          <div className="mt-1">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            Supera el stock disponible.
                          </div>
                        )}
                      </div>
                    )}

                    <div className="row g-3 align-items-end">
                      <div className="col-md-9">
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
                      <div className="col-md-3">
                        <button className="btn btn-success w-100" disabled={saving || excede}>
                          {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                          <i className="bi bi-check-lg me-1"></i>Registrar venta
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Historial */}
            <h5 className="fw-bold text-secondary mb-3">Ventas registradas</h5>
            {ventas.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  Sin ventas de huevos registradas.
                </div>
              </div>
            ) : (
              <>
                <div className="card shadow-sm d-none d-md-block">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Nº</th>
                          <th>Fecha</th>
                          <th>Cliente</th>
                          <th className="text-end">Maples</th>
                          <th className="text-end">Huevos</th>
                          <th className="text-end">$/maple</th>
                          <th className="text-end">Total</th>
                          <th className="text-center">Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventasPagina.map((v) => (
                          <tr key={v._id} className={v.anulada ? "table-secondary text-muted" : ""}>
                            <td className="fw-bold">{v.numeroVenta}</td>
                            <td>{formatearFechaLocal(v.fecha)}</td>
                            <td>{nombreCliente(v.cliente)}</td>
                            <td className="text-end">{formatearNumero(v.maples)}</td>
                            <td className="text-end">{formatearNumero(v.huevosTotales)}</td>
                            <td className="text-end">
                              {v.precioPorMaple != null ? formatearMoneda(v.precioPorMaple) : "-"}
                            </td>
                            <td className="text-end fw-semibold">
                              {v.total != null ? formatearMoneda(v.total) : "-"}
                            </td>
                            <td className="text-center">
                              {v.anulada ? (
                                <span className="badge bg-secondary">Anulada</span>
                              ) : (
                                <span className="badge bg-success">Vigente</span>
                              )}
                            </td>
                            <td className="text-end">
                              {!v.anulada && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleAnular(v)}
                                  title="Anular"
                                >
                                  <i className="bi bi-x-circle"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="d-md-none">
                  {ventasPagina.map((v) => (
                    <div className={`card shadow-sm mb-2 ${v.anulada ? "opacity-50" : ""}`} key={v._id}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between mb-2">
                          <strong>{v.numeroVenta}</strong>
                          <span className={`badge ${v.anulada ? "bg-secondary" : "bg-success"}`}>
                            {v.anulada ? "Anulada" : "Vigente"}
                          </span>
                        </div>
                        <div className="small">
                          <div>{nombreCliente(v.cliente)}</div>
                          <div className="text-muted">{formatearFechaLocal(v.fecha)}</div>
                          <div className="mt-2">
                            <strong>{formatearNumero(v.maples)}</strong> maples ·{" "}
                            {formatearNumero(v.huevosTotales)} huevos
                          </div>
                          {v.total != null && (
                            <div className="fw-bold">{formatearMoneda(v.total)}</div>
                          )}
                        </div>
                        {!v.anulada && (
                          <button
                            className="btn btn-sm btn-outline-danger w-100 mt-3"
                            onClick={() => handleAnular(v)}
                          >
                            <i className="bi bi-x-circle me-1"></i>Anular
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={pagina}
                  totalItems={ventas.length}
                  itemsPerPage={ITEMS_POR_PAGINA}
                  onPageChange={setPagina}
                />
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default VentaHuevosPage;
