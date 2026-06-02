import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { obtenerOrdenesRetiro, marcarOrdenEntregada, liberarOrdenRetiro, asignarChoferOrdenRetiro, obtenerUsuarios } from "../services/api";
import { formatearFechaLocal, obtenerFechaHoy } from "../utils/dateUtils";
import Swal from "sweetalert2";

const CAMARAS = { cañete: "Cañete", trigotuc: "Trigotuc" };
const fmtNum  = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n ?? 0);

// ── Modal confirmación con código ─────────────────────────────────────────────
const ConfirmarModal = ({ orden, saltarCodigo = false, onClose, onConfirmada }) => {
  const [paso, setPaso]         = useState(saltarCodigo ? 2 : 1);
  const [codigo, setCodigo]     = useState("");
  const [codigoError, setCodigoError] = useState("");
  const [saving, setSaving]     = useState(false);

  const verificarCodigo = (e) => {
    e.preventDefault();
    if (codigo.trim().toUpperCase() === orden.codigoRetiro) {
      setPaso(2);
    } else {
      setCodigoError("Código incorrecto. Verificá con el cliente.");
    }
  };

  const handleConfirmar = async () => {
    const ok = await Swal.fire({
      title: "¿Confirmar entrega?",
      html: `<strong>${orden.cliente?.razonSocial}</strong><br/>${CAMARAS[orden.camara]} · ${fmtNum(orden.totalCajones)} cajones · ${fmtNum(orden.pesoTotalKg)} kg`,
      icon: "question", showCancelButton: true,
      confirmButtonText: "Sí, confirmar", cancelButtonText: "Revisar",
    });
    if (!ok.isConfirmed) return;
    setSaving(true);
    try {
      await marcarOrdenEntregada(orden._id, saltarCodigo ? {} : { codigoRetiro: codigo.trim().toUpperCase() });
      onConfirmada();
      Swal.fire({ icon: "success", title: "Entrega confirmada", text: `Orden ${orden.numeroOrden} cerrada.`, timer: 2000, showConfirmButton: false });
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
                <h5 className="modal-title mb-0"><i className="bi bi-check2-circle me-2"></i>Confirmar entrega</h5>
                <div className="small opacity-75 mt-1">{orden.numeroOrden} — {orden.cliente?.razonSocial}</div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <div className="modal-body">
              {paso === 1 && (
                <form onSubmit={verificarCodigo}>
                  <div className="text-center mb-4 mt-2">
                    <i className="bi bi-key fs-1 text-success"></i>
                    <h5 className="mt-2 mb-1">Verificación de código</h5>
                    <p className="text-muted small mb-0">Pedile al cliente el código que figura en su comprobante.</p>
                  </div>
                  <div className="mb-3">
                    <input type="text"
                      className={`form-control form-control-lg text-center fw-bold ${codigoError ? "is-invalid" : ""}`}
                      placeholder="XXXXXX" value={codigo}
                      onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setCodigoError(""); }}
                      maxLength={6} style={{ letterSpacing: "0.3em", fontSize: "1.5rem" }}
                      autoFocus required />
                    {codigoError && <div className="invalid-feedback text-center">{codigoError}</div>}
                  </div>
                  <div className="d-grid">
                    <button type="submit" className="btn btn-success btn-lg">
                      <i className="bi bi-arrow-right-circle me-1"></i>Verificar código
                    </button>
                  </div>
                </form>
              )}
              {paso === 2 && (
                <>
                  {!saltarCodigo && (
                    <div className="alert alert-success py-2 mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-check-circle-fill"></i><span>Código verificado correctamente</span>
                    </div>
                  )}
                  <div className="card border-0 bg-light mb-3">
                    <div className="card-body py-2 px-3">
                      <div className="small text-muted fw-semibold mb-2 text-uppercase" style={{ letterSpacing: "0.05em" }}>Detalle de la entrega</div>
                      <div className="d-flex gap-3 flex-wrap">
                        <div><span className="fw-bold">{CAMARAS[orden.camara]}</span><div className="text-muted small">cámara</div></div>
                        <div><span className="fw-bold text-success">{fmtNum(orden.totalCajones)}</span><div className="text-muted small">cajones</div></div>
                        <div><span className="fw-bold text-success">{fmtNum(orden.pesoTotalKg)} kg</span><div className="text-muted small">peso total</div></div>
                      </div>
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {(orden.calibres || []).map((c) => (
                          <span key={c.calibre} className="badge bg-primary">Cal.{c.calibre}: {fmtNum(c.cajones)} caj</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              {paso === 2 && (
                <button className="btn btn-success btn-lg px-4" onClick={handleConfirmar} disabled={saving}>
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

// ── Página ───────────────────────────────────────────────────────────────────
const OrdenesRetiroPage = () => {
  const rolUsuario   = localStorage.getItem("rolUsuario");
  const puedeLiberar = rolUsuario === "superadmin" || rolUsuario === "administracion";
  const esAdmin      = rolUsuario === "superadmin" || rolUsuario === "administracion";

  const [ordenes, setOrdenes]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [ordenModal, setOrdenModal]     = useState(null);
  const [choferes, setChoferes]         = useState([]);

  useEffect(() => {
    if (esAdmin) {
      obtenerUsuarios().then((data) => {
        const lista = (data.usuarios || data || []).filter((u) => u.rolUsuario === "chofer");
        setChoferes(lista);
      }).catch(() => {});
    }
  }, [esAdmin]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const filtros = filtroEstado ? { status: filtroEstado } : {};
      setOrdenes(await obtenerOrdenesRetiro(filtros));
    } catch {
      Swal.fire("Error", "No se pudieron cargar las entregas.", "error");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleLiberar = async (e, orden) => {
    e.stopPropagation();
    const ok = await Swal.fire({
      title: `¿Liberar orden ${orden.numeroOrden}?`,
      text: "El frigorifico podrá entregar sin que el cliente presente el código.",
      icon: "warning", showCancelButton: true,
      confirmButtonColor: "#f59e0b", confirmButtonText: "Sí, liberar", cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    try {
      await liberarOrdenRetiro(orden._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Orden liberada", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleAsignarChofer = async (e, orden) => {
    e.stopPropagation();
    const opciones = choferes.length === 0
      ? { "": "— Sin chofer (retiro directo) —" }
      : Object.fromEntries([
          ["", "— Sin chofer (retiro directo) —"],
          ...choferes.map((c) => [c._id, c.nombreUsuario]),
        ]);
    const { value } = await Swal.fire({
      title: "Asignar chofer",
      input: "select",
      inputOptions: opciones,
      inputValue: orden.chofer?._id || "",
      showCancelButton: true,
      confirmButtonText: "Asignar",
      cancelButtonText: "Cancelar",
      inputPlaceholder: "Seleccioná un chofer",
    });
    if (value === undefined) return;
    try {
      await asignarChoferOrdenRetiro(orden._id, value || null);
      await cargar();
      Swal.fire({ icon: "success", title: value ? "Chofer asignado" : "Orden sin chofer", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const pendientes = ordenes.filter((o) => o.status === "pendiente");

  return (
    <Layout>
      <div className="container-fluid">

        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-box-arrow-right me-2 text-warning"></i>Entregas
          </h1>
          <div className="d-flex gap-1">
            {[
              { v: "pendiente", l: <><i className="bi bi-hourglass-split me-1"></i>Pendientes</> },
              { v: "entregado", l: <><i className="bi bi-check-circle me-1"></i>Entregadas</> },
              { v: "",          l: "Todas" },
            ].map(({ v, l }) => (
              <button key={v}
                className={`btn btn-sm ${filtroEstado === v ? "btn-dark" : "btn-outline-secondary"}`}
                onClick={() => setFiltroEstado(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-warning"></div></div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            No hay entregas en este estado.
          </div>
        ) : filtroEstado === "pendiente" ? (

          /* ── TARJETAS — pendientes ── */
          <div className="row g-3">
            {pendientes.map((o) => {
              const barColor = o.liberada ? "#f59e0b" : "#198754";
              return (
                <div key={o._id} className="col-12 col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm h-100" style={{ borderLeft: `4px solid ${barColor}` }}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-1">
                        <span className="badge bg-dark fs-6">{o.numeroOrden}</span>
                        <div className="d-flex gap-1 flex-wrap justify-content-end">
                          {o.modalidadEntrega === "delivery_chofer" && (
                            <span className="badge bg-primary"><i className="bi bi-truck me-1"></i>Chofer</span>
                          )}
                          {o.liberada
                            ? <span className="badge bg-warning text-dark"><i className="bi bi-unlock me-1"></i>Liberada</span>
                            : <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>Pendiente</span>
                          }
                        </div>
                      </div>
                      <div className="fw-bold mb-1">{o.cliente?.razonSocial}</div>
                      {o.modalidadEntrega === "delivery_chofer" && (
                        <div className="small mb-1">
                          <i className="bi bi-person-fill me-1 text-primary"></i>
                          {o.chofer ? <span className="fw-semibold">{o.chofer.nombreUsuario}</span> : <span className="text-muted">Sin chofer asignado</span>}
                          {o.confirmadaCarga && (
                            <span className="badge bg-success ms-2" style={{ fontSize: "0.7rem" }}>
                              <i className="bi bi-check2 me-1"></i>Carga OK
                            </span>
                          )}
                        </div>
                      )}
                      <div className="small text-muted mb-2">
                        <i className="bi bi-snow me-1"></i>{CAMARAS[o.camara]}
                        &nbsp;·&nbsp;
                        <i className="bi bi-calendar me-1"></i>{formatearFechaLocal(o.fecha)}
                      </div>
                      <div className="d-flex gap-3 p-2 rounded mb-2" style={{ background: "#f0fdf4" }}>
                        <div>
                          <div className="fw-bold text-success">{fmtNum(o.totalCajones)}</div>
                          <div className="text-muted" style={{ fontSize: "0.7rem" }}>cajones</div>
                        </div>
                        <div>
                          <div className="fw-bold text-success">{fmtNum(o.pesoTotalKg)} kg</div>
                          <div className="text-muted" style={{ fontSize: "0.7rem" }}>kg totales</div>
                        </div>
                      </div>
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        {(o.calibres || []).map((c) => (
                          <span key={c.calibre} className="badge bg-primary">Cal.{c.calibre}: {fmtNum(c.cajones)}</span>
                        ))}
                      </div>
                      {o.liberada && (
                        <div className="small text-warning fw-semibold mb-1">
                          <i className="bi bi-unlock-fill me-1"></i>Liberada por administración
                        </div>
                      )}
                    </div>
                    <div className="card-footer bg-transparent border-top-0 pt-0 pb-3 px-3 d-flex flex-column gap-2">
                      <button className="btn btn-success w-100" onClick={() => setOrdenModal(o)}>
                        <i className="bi bi-check2-circle me-1"></i>Confirmar entrega
                      </button>
                      {puedeLiberar && !o.liberada && o.modalidadEntrega !== "delivery_chofer" && (
                        <button className="btn btn-outline-warning btn-sm w-100" onClick={(e) => handleLiberar(e, o)}>
                          <i className="bi bi-unlock me-1"></i>Liberar (sin código)
                        </button>
                      )}
                      {esAdmin && (
                        <button className="btn btn-outline-primary btn-sm w-100" onClick={(e) => handleAsignarChofer(e, o)}>
                          <i className="bi bi-truck me-1"></i>
                          {o.chofer ? "Cambiar chofer" : "Asignar chofer"}
                        </button>
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
                      <th>Cámara</th>
                      <th>Calibres</th>
                      <th className="text-end">Cajones</th>
                      <th className="text-end">Kg</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.map((o) => (
                      <tr key={o._id}>
                        <td><span className="badge bg-dark">{o.numeroOrden}</span></td>
                        <td className="fw-semibold">{o.cliente?.razonSocial}</td>
                        <td><span className={`badge ${o.camara === "cañete" ? "bg-info text-dark" : "bg-primary"}`}>{CAMARAS[o.camara]}</span></td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {(o.calibres || []).map((c) => (
                              <span key={c.calibre} className="badge bg-secondary">Cal.{c.calibre}: {fmtNum(c.cajones)}</span>
                            ))}
                          </div>
                        </td>
                        <td className="text-end">{fmtNum(o.totalCajones)}</td>
                        <td className="text-end">{fmtNum(o.pesoTotalKg)} kg</td>
                        <td className="small text-muted">{formatearFechaLocal(o.status === "entregado" ? o.fechaEntrega : o.fecha)}</td>
                        <td>
                          {o.status === "entregado"
                            ? <span className="badge bg-success">Entregada</span>
                            : o.liberada
                            ? <span className="badge bg-warning text-dark">Liberada</span>
                            : <span className="badge bg-warning text-dark">Pendiente</span>
                          }
                        </td>
                      </tr>
                    ))}
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
          saltarCodigo={!!ordenModal.liberada}
          onClose={() => setOrdenModal(null)}
          onConfirmada={() => { setOrdenModal(null); cargar(); }}
        />
      )}
    </Layout>
  );
};

export default OrdenesRetiroPage;
