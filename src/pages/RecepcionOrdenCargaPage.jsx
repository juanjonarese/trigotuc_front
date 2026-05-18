import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { obtenerOrdenesCarga, entregarOrdenCarga, liberarOrdenCarga } from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";

const ConfirmarModal = ({ orden, onClose, onConfirmada, saltarCodigo = false }) => {
  const [paso, setPaso]   = useState(saltarCodigo ? 2 : 1);
  const [codigo, setCodigo] = useState("");
  const [codigoError, setCodigoError] = useState("");
  const [form, setForm] = useState({
    cantidadReal: "",
    pesoRealKg: "",
    observacionesEntrega: "",
    fechaEntrega: obtenerFechaHoy(),
  });
  const [saving, setSaving] = useState(false);

  const verificarCodigo = (e) => {
    e.preventDefault();
    if (codigo.trim().toUpperCase() === orden.codigoRetiro) {
      setCodigoError("");
      setPaso(2);
    } else {
      setCodigoError("Código incorrecto. Verificá con el cliente.");
    }
  };

  const hayDiferencia = () => {
    const cant = Number(form.cantidadReal);
    const peso = Number(form.pesoRealKg);
    return (
      (form.cantidadReal !== "" && cant !== orden.cantidadEstimada) ||
      (form.pesoRealKg   !== "" && Math.abs(peso - orden.pesoEstimadoKg) > 0.01)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cantidadReal || !form.pesoRealKg) {
      Swal.fire("Faltan datos", "Ingresá cantidad y peso real.", "warning");
      return;
    }
    if (hayDiferencia() && !form.observacionesEntrega.trim()) {
      Swal.fire("Falta el motivo", "Hay una diferencia con el pedido. Explicá el motivo antes de confirmar.", "warning");
      return;
    }
    const ok = await Swal.fire({
      title: "¿Confirmar entrega?",
      html: `
        <div style="text-align:left;font-size:14px">
          <div><strong>Pedido:</strong> ${Number(orden.cantidadEstimada).toLocaleString("es-AR")} pollos · ${orden.pesoEstimadoKg} kg</div>
          <div style="margin-top:6px"><strong>Recibido:</strong> ${Number(form.cantidadReal).toLocaleString("es-AR")} pollos · ${form.pesoRealKg} kg</div>
          ${hayDiferencia() ? `<div style="margin-top:6px;color:#856404"><strong>Motivo:</strong> ${form.observacionesEntrega}</div>` : ""}
        </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Revisar",
    });
    if (!ok.isConfirmed) return;

    setSaving(true);
    try {
      await entregarOrdenCarga(orden._id, {
        ...(saltarCodigo ? {} : { codigoRetiro: codigo.trim().toUpperCase() }),
        cantidadReal:         Number(form.cantidadReal),
        pesoRealKg:           Number(form.pesoRealKg),
        observacionesEntrega: form.observacionesEntrega || undefined,
        fechaEntrega:         ajustarFechaParaGuardar(form.fechaEntrega),
      });
      onConfirmada();
      Swal.fire({
        icon: "success",
        title: "Recepción confirmada",
        text: `Orden ${orden.numero} cerrada correctamente.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <div>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-check2-circle me-2"></i>Confirmar entrega
                </h5>
                <div className="small opacity-75 mt-1">{orden.numero} — {orden.cliente?.razonSocial || orden.cliente?.nombre}</div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">

              {/* PASO 1 — verificar código */}
              {paso === 1 && (
                <form onSubmit={verificarCodigo}>
                  <div className="text-center mb-4 mt-2">
                    <i className="bi bi-key fs-1 text-success"></i>
                    <h5 className="mt-2 mb-1">Verificación de código</h5>
                    <p className="text-muted small mb-0">
                      Pedile al cliente el código de retiro que figura en su orden.
                    </p>
                  </div>
                  <div className="mb-3">
                    <input
                      type="text"
                      className={`form-control form-control-lg text-center fw-bold ${codigoError ? "is-invalid" : ""}`}
                      placeholder="XXXXXX"
                      value={codigo}
                      onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCodigoError(""); }}
                      maxLength={6}
                      style={{ letterSpacing: "0.3em", fontSize: "1.5rem" }}
                      autoFocus
                      required
                    />
                    {codigoError && <div className="invalid-feedback text-center">{codigoError}</div>}
                  </div>
                  <div className="d-grid">
                    <button type="submit" className="btn btn-success btn-lg">
                      <i className="bi bi-arrow-right-circle me-1"></i>Verificar código
                    </button>
                  </div>
                </form>
              )}

              {/* PASO 2 — detalle del pedido + datos reales */}
              {paso === 2 && (
                <>
                  {!saltarCodigo && (
                    <div className="alert alert-success py-2 mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Código verificado correctamente</span>
                    </div>
                  )}

                  {/* Detalle del pedido */}
                  <div className="card border-0 bg-light mb-3">
                    <div className="card-body py-2 px-3">
                      <div className="small text-muted fw-semibold mb-2 text-uppercase" style={{ letterSpacing: "0.05em" }}>
                        Pedido del frigorifico
                      </div>
                      <div className="row g-2 text-center">
                        <div className="col-6">
                          <div className="fw-bold fs-5">{Number(orden.cantidadEstimada).toLocaleString("es-AR")}</div>
                          <div className="text-muted small">pollos pedidos</div>
                        </div>
                        <div className="col-6">
                          <div className="fw-bold fs-5">{orden.pesoEstimadoKg} kg</div>
                          <div className="text-muted small">peso estimado</div>
                        </div>
                        {orden.galpon && (
                          <div className="col-12 mt-1">
                            <span className="badge bg-secondary">
                              {orden.granja === "cañete" ? "Cañete" : "Los Pinos"} — Galpón {orden.galpon}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <form id="form-recepcion" onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">
                          Cantidad recibida <span className="text-danger">*</span>
                        </label>
                        <input
                          type="number" min="1"
                          className={`form-control form-control-lg text-center ${
                            form.cantidadReal && Number(form.cantidadReal) !== orden.cantidadEstimada
                              ? "border-warning"
                              : ""
                          }`}
                          placeholder={orden.cantidadEstimada}
                          value={form.cantidadReal}
                          onChange={(e) => setForm({ ...form, cantidadReal: e.target.value })}
                          required autoFocus
                        />
                        <div className="form-text text-center">
                          {form.cantidadReal && Number(form.cantidadReal) !== orden.cantidadEstimada
                            ? <span className="text-warning fw-semibold">
                                Dif: {Number(form.cantidadReal) - orden.cantidadEstimada > 0 ? "+" : ""}
                                {Number(form.cantidadReal) - orden.cantidadEstimada} pollos
                              </span>
                            : "pollos"
                          }
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">
                          Peso recibido (kg) <span className="text-danger">*</span>
                        </label>
                        <input
                          type="number" min="0.01" step="0.01"
                          className={`form-control form-control-lg text-center ${
                            form.pesoRealKg && Math.abs(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0.01
                              ? "border-warning"
                              : ""
                          }`}
                          placeholder={orden.pesoEstimadoKg}
                          value={form.pesoRealKg}
                          onChange={(e) => setForm({ ...form, pesoRealKg: e.target.value })}
                          required
                        />
                        <div className="form-text text-center">
                          {form.pesoRealKg && Math.abs(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0.01
                            ? <span className="text-warning fw-semibold">
                                Dif: {(Number(form.pesoRealKg) - orden.pesoEstimadoKg) > 0 ? "+" : ""}
                                {(Number(form.pesoRealKg) - orden.pesoEstimadoKg).toFixed(1)} kg
                              </span>
                            : "kg"
                          }
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">
                          Fecha de recepción
                        </label>
                        <input
                          type="date" className="form-control"
                          value={form.fechaEntrega}
                          onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })}
                        />
                      </div>
                      <div className="col-12">
                        <label className={`form-label fw-semibold ${hayDiferencia() ? "text-warning" : ""}`}>
                          {hayDiferencia()
                            ? <><i className="bi bi-exclamation-triangle me-1"></i>Motivo de la diferencia <span className="text-danger">*</span></>
                            : "Observaciones (opcional)"
                          }
                        </label>
                        <textarea
                          className={`form-control ${hayDiferencia() && !form.observacionesEntrega.trim() ? "border-warning" : ""}`}
                          rows={2}
                          placeholder={hayDiferencia()
                            ? "Explicá por qué no se envió la cantidad/peso pedido..."
                            : "Cualquier nota adicional..."
                          }
                          value={form.observacionesEntrega}
                          onChange={(e) => setForm({ ...form, observacionesEntrega: e.target.value })}
                        />
                        {hayDiferencia() && !form.observacionesEntrega.trim() && (
                          <div className="form-text text-warning">
                            Campo obligatorio cuando hay diferencia con el pedido.
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                </>
              )}

            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              {paso === 2 && (
                <button type="submit" form="form-recepcion" className="btn btn-success btn-lg px-4" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                  <i className="bi bi-check-circle me-1"></i>Confirmar entrega
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

const RecepcionOrdenCargaPage = () => {
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const puedeLiberar = rolUsuario === "superadmin" || rolUsuario === "administracion";

  const [ordenes, setOrdenes]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [ordenModal, setOrdenModal]     = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = filtroEstado ? { estado: filtroEstado } : {};
      const data = await obtenerOrdenesCarga(params);
      setOrdenes(data);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleLiberar = async (e, orden) => {
    e.stopPropagation();
    const ok = await Swal.fire({
      title: `¿Liberar orden ${orden.numero}?`,
      text: "La granja podrá completar la entrega sin el código del cliente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#f59e0b",
      confirmButtonText: "Sí, liberar",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await liberarOrdenCarga(orden._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Orden liberada", text: "La granja ya puede completar la entrega.", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const ordenesFiltradas = ordenes.filter((o) => {
    if (!busqueda) return true;
    const txt = busqueda.toLowerCase();
    return (
      o.numero?.toLowerCase().includes(txt) ||
      o.codigoRetiro?.toLowerCase().includes(txt) ||
      (o.cliente?.razonSocial || o.cliente?.nombre || "").toLowerCase().includes(txt)
    );
  });

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-arrow-in-down me-2 text-success"></i>
            Recepción de Órdenes
          </h1>
          <div className="d-flex gap-2">
            {["pendiente", "entregada", ""].map((e) => (
              <button
                key={e}
                className={`btn btn-sm ${filtroEstado === e ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltroEstado(e)}
              >
                {e === ""
                  ? "Todas"
                  : e === "pendiente"
                  ? <><i className="bi bi-hourglass-split me-1"></i>Pendientes</>
                  : <><i className="bi bi-check-circle me-1"></i>Entregadas</>
                }
              </button>
            ))}
          </div>
        </div>

        {/* Buscador */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-2">
            <div className="input-group">
              <span className="input-group-text bg-white">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Buscar por número de orden, código de retiro o cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button className="btn btn-outline-secondary" onClick={() => setBusqueda("")}>
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-success"></div></div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            {busqueda ? "No se encontró ninguna orden." : "No hay órdenes en este estado."}
          </div>
        ) : filtroEstado === "pendiente" ? (

          /* ── TARJETAS — solo pendientes ── */
          <div className="row g-3">
            {ordenesFiltradas.map((o) => {
              const barColor = o.liberada ? "#f59e0b" : "#198754";
              return (
                <div key={o._id} className="col-12 col-md-6 col-lg-4">
                  <div
                    className="card border-0 shadow-sm h-100"
                    style={{ borderLeft: `4px solid ${barColor}` }}
                  >
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="badge bg-dark fs-6">{o.numero}</span>
                        {o.liberada
                          ? <span className="badge bg-warning text-dark"><i className="bi bi-unlock me-1"></i>Liberada</span>
                          : <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>Pendiente</span>
                        }
                      </div>

                      {/* Granja y galpón */}
                      <div className="mb-2">
                        <span className="fw-bold fs-5" style={{ color: barColor }}>
                          {o.granja === "cañete" ? "Cañete" : "Los Pinos"}
                          {o.galpon && ` — Galpón ${o.galpon}`}
                        </span>
                        <div className="text-muted small">
                          <i className="bi bi-calendar me-1"></i>
                          {formatearFechaLocal(o.fechaEmision)}
                        </div>
                      </div>

                      {/* Cantidades */}
                      <div className="d-flex gap-4 mb-2 p-2 rounded" style={{ background: "#f0fdf4" }}>
                        <div>
                          <div className="fw-bold text-success fs-5">{Number(o.cantidadEstimada).toLocaleString("es-AR")}</div>
                          <div className="text-muted" style={{ fontSize: "0.7rem" }}>pollos a preparar</div>
                        </div>
                        <div>
                          <div className="fw-bold text-success fs-5">{o.pesoEstimadoKg} kg</div>
                          <div className="text-muted" style={{ fontSize: "0.7rem" }}>peso estimado</div>
                        </div>
                      </div>

                      {/* Observaciones */}
                      {o.observaciones && (
                        <div className="mb-2 p-2 rounded" style={{ background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.85rem" }}>
                          <i className="bi bi-info-circle me-1 text-warning"></i>
                          {o.observaciones}
                        </div>
                      )}

                      {o.liberada && (
                        <div className="mb-2 small text-warning fw-semibold">
                          <i className="bi bi-unlock-fill me-1"></i>Código liberado por administración
                        </div>
                      )}
                    </div>

                    <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3 d-flex flex-column gap-2">
                      {o.tipo === "pedido_frigorifico" ? (
                        <div className="text-center text-muted small py-1">
                          <i className="bi bi-arrow-right-circle me-1"></i>
                          La recepción se registra en <strong>Frigorifico → Pedidos a Granja</strong>
                        </div>
                      ) : (
                        <>
                          <button
                            className="btn btn-success w-100"
                            onClick={() => setOrdenModal(o)}
                          >
                            <i className="bi bi-check2-circle me-1"></i>Confirmar entrega
                          </button>
                          {puedeLiberar && !o.liberada && (
                            <button className="btn btn-outline-warning btn-sm w-100" onClick={(e) => handleLiberar(e, o)}>
                              <i className="bi bi-unlock me-1"></i>Liberar orden (sin código)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* ── TABLA — entregadas / todas ── */
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>N° Orden</th>
                      <th>Cliente</th>
                      <th>Granja / Galpón</th>
                      <th>Fecha pedido</th>
                      <th className="text-end">Cant. pedida</th>
                      <th className="text-end">Cant. recibida</th>
                      <th className="text-end">Peso ped.</th>
                      <th className="text-end">Peso rec.</th>
                      <th>Fecha entrega</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenesFiltradas.map((o) => {
                      const entregada = o.estado === "entregada";
                      const difCant = entregada && o.diferenciaCantidad != null && o.diferenciaCantidad !== 0;
                      const difKg   = entregada && o.diferenciaKg   != null && Math.abs(o.diferenciaKg) > 0.01;
                      return (
                        <tr key={o._id}>
                          <td><span className="badge bg-dark">{o.numero}</span></td>
                          <td className="fw-semibold">{o.cliente?.razonSocial || o.cliente?.nombre}</td>
                          <td className="text-muted small">
                            {o.granja === "cañete" ? "Cañete" : "Los Pinos"}
                            {o.galpon && ` — G${o.galpon}`}
                          </td>
                          <td className="text-muted small">{formatearFechaLocal(o.fechaEmision)}</td>
                          <td className="text-end">{o.cantidadEstimada?.toLocaleString("es-AR")}</td>
                          <td className={`text-end fw-semibold ${difCant ? "text-warning" : ""}`}>
                            {entregada ? o.cantidadReal?.toLocaleString("es-AR") : "—"}
                            {difCant && <span className="ms-1 small">({o.diferenciaCantidad > 0 ? "+" : ""}{o.diferenciaCantidad})</span>}
                          </td>
                          <td className="text-end">{o.pesoEstimadoKg} kg</td>
                          <td className={`text-end fw-semibold ${difKg ? "text-warning" : ""}`}>
                            {entregada ? `${o.pesoRealKg} kg` : "—"}
                            {difKg && <span className="ms-1 small">({o.diferenciaKg > 0 ? "+" : ""}{o.diferenciaKg?.toFixed(1)})</span>}
                          </td>
                          <td className="text-muted small">{entregada ? formatearFechaLocal(o.fechaEntrega) : "—"}</td>
                          <td>
                            {entregada
                              ? <span className="badge bg-success">Entregada</span>
                              : o.liberada
                                ? <span className="badge bg-warning text-dark">Liberada</span>
                                : <span className="badge bg-warning text-dark">Pendiente</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        )}

      </div>

      {ordenModal && (
        <ConfirmarModal
          orden={ordenModal}
          saltarCodigo={true}
          onClose={() => setOrdenModal(null)}
          onConfirmada={() => { setOrdenModal(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default RecepcionOrdenCargaPage;
