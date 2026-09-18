import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import {
  obtenerClientes,
  obtenerStockOrdenesPollitos,
  obtenerOrdenesCargaPollitos,
  crearOrdenCargaPollitos,
  actualizarOrdenCargaPollitos,
  entregarOrdenCargaPollitos,
  anularOrdenCargaPollitos,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import { formatearNumero } from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

const ESTADO = {
  pendiente: { label: "Pendiente", clase: "bg-warning text-dark", icono: "bi-hourglass-split" },
  entregada: { label: "Entregada", clase: "bg-success",           icono: "bi-check-circle" },
  anulada:   { label: "Anulada",   clase: "bg-secondary",         icono: "bi-x-circle" },
};

const nombreCliente = (c) => c?.razonSocial || c?.nombre || "Cliente";

const OrdenCargaPollitosPage = () => {
  const [clientes, setClientes] = useState([]);
  const [stock, setStock] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState("todas");

  // Formulario: alta, o edición de una orden pendiente.
  const [editando, setEditando] = useState(null);
  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cli, stk, ords] = await Promise.all([
        obtenerClientes(),
        obtenerStockOrdenesPollitos(),
        obtenerOrdenesCargaPollitos(),
      ]);
      setClientes(Array.isArray(cli) ? cli : cli?.clientes || []);
      setStock(stk);
      setOrdenes(Array.isArray(ords) ? ords : []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los datos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const limpiarFormulario = () => {
    setEditando(null);
    setCliente("");
    setFecha(obtenerFechaHoy());
    setCantidad("");
    setObservaciones("");
  };

  const pedidos = Number(cantidad) || 0;
  // Al editar, lo que esa orden ya tiene comprometido vuelve a estar disponible
  // para ella misma — el back valida igual, esto es solo para no asustar en pantalla.
  const libre = (stock?.libre ?? 0) + (editando ? editando.cantidad : 0);
  const excede = pedidos > libre;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cliente) {
      Swal.fire("Falta el cliente", "Elegí a quién se le entrega.", "warning");
      return;
    }
    if (pedidos <= 0) {
      Swal.fire("Falta la cantidad", "Cargá cuántos pollitos lleva la orden.", "warning");
      return;
    }
    if (excede) {
      Swal.fire("Stock insuficiente", `Quedan ${formatearNumero(libre)} pollitos libres.`, "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        cliente,
        fechaEmision: ajustarFechaParaGuardar(fecha),
        cantidad: pedidos,
        observaciones: observaciones || undefined,
      };

      if (editando) {
        await actualizarOrdenCargaPollitos(editando._id, payload);
        limpiarFormulario();
        await cargar();
        Swal.fire({ icon: "success", title: "Orden actualizada", timer: 1800, showConfirmButton: false });
      } else {
        const orden = await crearOrdenCargaPollitos(payload);
        limpiarFormulario();
        await cargar();
        Swal.fire({
          icon: "success",
          title: `Orden ${orden.numero} emitida`,
          html: `${formatearNumero(orden.cantidad)} pollitos comprometidos.<br>Código de retiro: <strong class="fs-4">${orden.codigoRetiro}</strong>`,
        });
      }
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar la orden.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (orden) => {
    setEditando(orden);
    setCliente(orden.cliente?._id || "");
    setFecha(orden.fechaEmision ? orden.fechaEmision.slice(0, 10) : obtenerFechaHoy());
    setCantidad(String(orden.cantidad));
    setObservaciones(orden.observaciones || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // La entrega es el momento en que los pollitos salen de verdad: se pide la
  // cantidad real porque el camión puede llevarse más o menos que lo pedido.
  const handleEntregar = async (orden) => {
    const { isConfirmed, value } = await Swal.fire({
      icon: "question",
      title: `Entregar la orden ${orden.numero}`,
      html: `Pedidos: <strong>${formatearNumero(orden.cantidad)}</strong> pollitos para ${nombreCliente(orden.cliente)}.<br><span class="text-muted small">Se descuentan del stock FIFO por fecha de nacimiento.</span>`,
      input: "number",
      inputLabel: "Pollitos entregados",
      inputValue: orden.cantidad,
      inputAttributes: { min: 1 },
      showCancelButton: true,
      confirmButtonText: "Confirmar entrega",
      cancelButtonText: "Volver",
      confirmButtonColor: "#198754",
      inputValidator: (v) => (!v || Number(v) <= 0 ? "Cargá cuántos pollitos salieron" : undefined),
    });
    if (!isConfirmed) return;

    try {
      const entregada = await entregarOrdenCargaPollitos(orden._id, { cantidadReal: Number(value) });
      await cargar();
      Swal.fire({
        icon: "success",
        title: `Orden ${entregada.numero} entregada`,
        text: `${formatearNumero(entregada.cantidadReal)} pollitos descontados de ${entregada.lineas.length} tanda(s).`,
        timer: 2800,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo entregar la orden.", "error");
    }
  };

  const handleAnular = async (orden) => {
    const { isConfirmed, value } = await Swal.fire({
      icon: "warning",
      title: `¿Anular la orden ${orden.numero}?`,
      text:
        orden.estado === "entregada"
          ? "Los pollitos vuelven al stock de sus tandas."
          : "Se libera el stock que tenía comprometido.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Volver",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;

    try {
      await anularOrdenCargaPollitos(orden._id, value || undefined);
      if (editando?._id === orden._id) limpiarFormulario();
      await cargar();
      Swal.fire({ icon: "success", title: "Orden anulada", timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const ordenesFiltradas = useMemo(
    () => (filtroEstado === "todas" ? ordenes : ordenes.filter((o) => o.estado === filtroEstado)),
    [ordenes, filtroEstado]
  );

  useEffect(() => {
    setPagina(1);
  }, [filtroEstado]);

  const ordenesPagina = ordenesFiltradas.slice(
    (pagina - 1) * ITEMS_POR_PAGINA,
    pagina * ITEMS_POR_PAGINA
  );

  const pendientes = ordenes.filter((o) => o.estado === "pendiente").length;

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="mb-4">
          <h1 className="h3 fw-bold mb-1">
            <i className="bi bi-truck text-success me-2"></i>Órdenes de Carga — Pollitos
          </h1>
          <p className="text-muted mb-0 small">
            Entrega de pollitos BB a clientes. El stock se nutre de los nacimientos y sale por
            estas órdenes, FIFO por fecha de nacimiento.
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
                <i className="bi bi-box-seam me-1"></i>Stock de pollitos
              </div>
              <div className="card-body">
                <div className="row g-2 mb-3">
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Nacidos en stock</div>
                      <div className="h5 fw-bold mb-0">{formatearNumero(stock?.total)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Comprometidos</div>
                      <div className="h5 fw-bold mb-0 text-warning">
                        {formatearNumero(stock?.comprometido)}
                      </div>
                      <div className="text-muted" style={{ fontSize: ".72rem" }}>
                        {pendientes} orden(es) pendiente(s)
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="border rounded p-2 text-center">
                      <div className="text-muted small">Libres</div>
                      <div className="h5 fw-bold mb-0 text-success">
                        {formatearNumero(stock?.libre)}
                      </div>
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

            {/* Alta / edición */}
            <div className="card shadow-sm mb-4">
              <div className="card-header bg-white fw-bold d-flex justify-content-between align-items-center">
                <span>
                  <i className={`bi ${editando ? "bi-pencil" : "bi-plus-circle"} me-1`}></i>
                  {editando ? `Editando la orden ${editando.numero}` : "Nueva orden de carga"}
                </span>
                {editando && (
                  <button className="btn btn-sm btn-outline-secondary" onClick={limpiarFormulario}>
                    Cancelar edición
                  </button>
                )}
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
                      <label className="form-label fw-semibold">Fecha de emisión</label>
                      <input
                        type="date"
                        className="form-control"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Pollitos</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max={libre || undefined}
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        placeholder={`Hasta ${formatearNumero(libre)}`}
                      />
                    </div>
                  </div>

                  {pedidos > 0 && (
                    <div className={`alert py-2 small mb-3 ${excede ? "alert-danger" : "alert-success"}`}>
                      <strong>{formatearNumero(pedidos)}</strong> pollitos
                      {excede ? (
                        <div className="mt-1">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Solo quedan {formatearNumero(libre)} libres (el resto ya está comprometido
                          en otras órdenes pendientes).
                        </div>
                      ) : (
                        <span className="text-muted">
                          {" · quedan "}
                          {formatearNumero(libre - pedidos)} libres después de esta orden
                        </span>
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
                        <i className="bi bi-check-lg me-1"></i>
                        {editando ? "Guardar cambios" : "Emitir orden"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Listado */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold text-secondary mb-0">Órdenes emitidas</h5>
              <div className="btn-group btn-group-sm">
                {["todas", "pendiente", "entregada", "anulada"].map((e) => (
                  <button
                    key={e}
                    className={`btn ${filtroEstado === e ? "btn-success" : "btn-outline-secondary"}`}
                    onClick={() => setFiltroEstado(e)}
                  >
                    {e === "todas" ? "Todas" : `${ESTADO[e].label}s`}
                  </button>
                ))}
              </div>
            </div>

            {ordenesFiltradas.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  {filtroEstado === "todas"
                    ? "Sin órdenes de carga de pollitos."
                    : `Sin órdenes ${ESTADO[filtroEstado].label.toLowerCase()}s.`}
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
                          <th>Emisión</th>
                          <th>Cliente</th>
                          <th className="text-end">Pedidos</th>
                          <th className="text-end">Entregados</th>
                          <th>Tandas de origen</th>
                          <th className="text-center">Código</th>
                          <th className="text-center">Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordenesPagina.map((o) => (
                          <tr
                            key={o._id}
                            className={o.estado === "anulada" ? "table-secondary text-muted" : ""}
                          >
                            <td className="fw-bold">{o.numero}</td>
                            <td>{formatearFechaLocal(o.fechaEmision)}</td>
                            <td>{nombreCliente(o.cliente)}</td>
                            <td className="text-end">{formatearNumero(o.cantidad)}</td>
                            <td className="text-end fw-semibold">
                              {o.cantidadReal != null ? (
                                <>
                                  {formatearNumero(o.cantidadReal)}
                                  {!!o.diferencia && (
                                    <span
                                      className={`ms-1 small ${
                                        o.diferencia > 0 ? "text-danger" : "text-warning"
                                      }`}
                                    >
                                      ({o.diferencia > 0 ? "+" : ""}
                                      {formatearNumero(o.diferencia)})
                                    </span>
                                  )}
                                </>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="small text-muted">
                              {o.lineas?.length
                                ? o.lineas
                                    .map((l) => `#${l.numeroTanda} (${formatearNumero(l.pollitos)})`)
                                    .join(" · ")
                                : "-"}
                            </td>
                            <td className="text-center">
                              {o.estado === "pendiente" ? (
                                <span className="badge bg-light text-dark border font-monospace">
                                  {o.codigoRetiro}
                                </span>
                              ) : (
                                <span className="text-muted small">-</span>
                              )}
                            </td>
                            <td className="text-center">
                              <span className={`badge ${ESTADO[o.estado].clase}`}>
                                <i className={`bi ${ESTADO[o.estado].icono} me-1`}></i>
                                {ESTADO[o.estado].label}
                              </span>
                            </td>
                            <td className="text-end text-nowrap">
                              {o.estado === "pendiente" && (
                                <>
                                  <button
                                    className="btn btn-sm btn-success me-1"
                                    onClick={() => handleEntregar(o)}
                                    title="Entregar"
                                  >
                                    <i className="bi bi-truck"></i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-primary me-1"
                                    onClick={() => handleEditar(o)}
                                    title="Editar"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                </>
                              )}
                              {o.estado !== "anulada" && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleAnular(o)}
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
                  {ordenesPagina.map((o) => (
                    <div
                      className={`card shadow-sm mb-2 ${o.estado === "anulada" ? "opacity-50" : ""}`}
                      key={o._id}
                    >
                      <div className="card-body">
                        <div className="d-flex justify-content-between mb-2">
                          <strong>{o.numero}</strong>
                          <span className={`badge ${ESTADO[o.estado].clase}`}>
                            {ESTADO[o.estado].label}
                          </span>
                        </div>
                        <div className="small">
                          <div>{nombreCliente(o.cliente)}</div>
                          <div className="text-muted">{formatearFechaLocal(o.fechaEmision)}</div>
                          <div className="mt-2">
                            <strong>{formatearNumero(o.cantidad)}</strong> pollitos pedidos
                          </div>
                          {o.cantidadReal != null && (
                            <div>
                              <strong>{formatearNumero(o.cantidadReal)}</strong> entregados
                            </div>
                          )}
                          {o.estado === "pendiente" && (
                            <div className="mt-2">
                              Código:{" "}
                              <span className="badge bg-light text-dark border font-monospace">
                                {o.codigoRetiro}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="d-flex gap-2 mt-3">
                          {o.estado === "pendiente" && (
                            <>
                              <button
                                className="btn btn-sm btn-success flex-fill"
                                onClick={() => handleEntregar(o)}
                              >
                                <i className="bi bi-truck me-1"></i>Entregar
                              </button>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEditar(o)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            </>
                          )}
                          {o.estado !== "anulada" && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleAnular(o)}
                            >
                              <i className="bi bi-x-circle"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={pagina}
                  totalItems={ordenesFiltradas.length}
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

export default OrdenCargaPollitosPage;
