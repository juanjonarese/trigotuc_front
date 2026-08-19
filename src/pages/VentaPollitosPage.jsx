import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerClientes,
  obtenerStockPollitos,
  obtenerVentasPollitos,
  crearVentaPollitos,
  anularVentaPollitos,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import { formatearNumero, formatearMoneda } from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

const VentaPollitosPage = () => {
  const [clientes, setClientes] = useState([]);
  const [stock, setStock] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);

  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [cantidad, setCantidad] = useState("");
  const [precioPorPollito, setPrecioPorPollito] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cli, stk, vts] = await Promise.all([
        obtenerClientes(),
        obtenerStockPollitos(),
        obtenerVentasPollitos(),
      ]);
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

  const pedidos = Number(cantidad) || 0;
  const excede = stock ? pedidos > stock.total : false;
  const precio = precioPorPollito === "" ? null : Number(precioPorPollito);
  const total = precio != null ? pedidos * precio : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cliente) {
      Swal.fire("Falta el cliente", "Elegí a quién se le vende.", "warning");
      return;
    }
    if (pedidos <= 0) {
      Swal.fire("Falta la cantidad", "Cargá cuántos pollitos se venden.", "warning");
      return;
    }
    if (excede) {
      Swal.fire(
        "Stock insuficiente",
        `Hay ${formatearNumero(stock.total)} pollitos disponibles.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const venta = await crearVentaPollitos({
        cliente,
        fecha: ajustarFechaParaGuardar(fecha),
        cantidad: pedidos,
        precioPorPollito: precioPorPollito === "" ? undefined : Number(precioPorPollito),
        observaciones: observaciones || undefined,
      });
      setCantidad("");
      setObservaciones("");
      await cargar();
      Swal.fire({
        icon: "success",
        title: `Venta ${venta.numeroVenta} registrada`,
        text: `${formatearNumero(venta.pollitosTotales)} pollitos descontados de ${venta.lineas.length} tanda(s)`,
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
      text: "Los pollitos vuelven al stock de sus tandas.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Volver",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await anularVentaPollitos(venta._id, value || undefined);
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
            <i className="bi bi-cash-stack text-success me-2"></i>Venta de Pollitos
          </h1>
          <p className="text-muted mb-0 small">
            Pollitos BB nacidos en la nacedora — se descuentan FIFO por fecha de nacimiento
          </p>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : (
          <>
            {/* Stock */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-white fw-bold">
                <i className="bi bi-box-seam me-1"></i>Pollitos disponibles
              </div>
              <div className="card-body">
                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Total disponible</div>
                      <div className="h5 fw-bold mb-0 text-success">{formatearNumero(stock?.total)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Tandas con stock</div>
                      <div className="h5 fw-bold mb-0">{stock?.partidas?.length ?? 0}</div>
                    </div>
                  </div>
                </div>

                {(stock?.total ?? 0) === 0 ? (
                  <div className="alert alert-warning mb-0 small">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    No hay pollitos en stock. Se generan al registrar el nacimiento de una tanda en{" "}
                    <strong>Incubadora</strong>.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tanda</th>
                          <th>Plantel</th>
                          <th>Nacimiento</th>
                          <th className="text-end">Nacidos</th>
                          <th className="text-end">Disponibles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.partidas.map((p) => (
                          <tr key={p.tanda}>
                            <td className="fw-semibold">#{p.numeroTanda}</td>
                            <td>#{p.numeroLote ?? "?"}</td>
                            <td>{formatearFechaLocal(p.fechaNacimiento)}</td>
                            <td className="text-end">{formatearNumero(p.nacidos)}</td>
                            <td className="text-end fw-semibold text-success">
                              {formatearNumero(p.disponibles)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                        <label className="form-label fw-semibold">Pollitos</label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max={stock?.total}
                          value={cantidad}
                          onChange={(e) => setCantidad(e.target.value)}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-semibold">
                          $/pollito <span className="text-muted fw-normal small">(opcional)</span>
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          step="0.01"
                          value={precioPorPollito}
                          onChange={(e) => setPrecioPorPollito(e.target.value)}
                          placeholder="A definir"
                        />
                      </div>
                    </div>

                    {pedidos > 0 && (
                      <div className={`alert py-2 small mb-3 ${excede ? "alert-danger" : "alert-success"}`}>
                        <strong>{formatearNumero(pedidos)}</strong> pollitos
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
                  Sin ventas de pollitos registradas.
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
                          <th className="text-end">Pollitos</th>
                          <th>Tandas de origen</th>
                          <th className="text-end">$/pollito</th>
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
                            <td className="text-end">{formatearNumero(v.pollitosTotales)}</td>
                            <td className="small text-muted">
                              {v.lineas
                                .map((l) => `#${l.numeroTanda} (${formatearNumero(l.pollitos)})`)
                                .join(" · ")}
                            </td>
                            <td className="text-end">
                              {v.precioPorPollito != null ? formatearMoneda(v.precioPorPollito) : "-"}
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
                            <strong>{formatearNumero(v.pollitosTotales)}</strong> pollitos
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

export default VentaPollitosPage;
