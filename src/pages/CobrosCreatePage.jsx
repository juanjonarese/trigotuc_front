import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerClientes, obtenerVentasPollo, crearCobro, crearCheque, obtenerCuentasBancarias } from "../services/api";
import Layout from "../components/Layout";
import Swal from "sweetalert2";
import { ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import "../css/Tablas.css";

const CobrosCreatePage = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cuentasBancarias, setCuentasBancarias] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fecha: obtenerFechaHoy(),
    clienteId: "",
    ventaId: "",
  });

  const [mediosPago, setMediosPago] = useState([]);
  const [currentMedioPago, setCurrentMedioPago] = useState({
    tipo: "efectivo",
    monto: "",
    numeroReferencia: "",
    banco: "",
    fechaVencimiento: "",
    tipoRetencion: "",
    cuentaBancariaId: "",
  });

  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);

  useEffect(() => {
    cargarClientes();
    cargarCuentasBancarias();
  }, []);

  const cargarClientes = async () => {
    try {
      const data = await obtenerClientes();
      setClientes(data.clientes || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  };

  const cargarCuentasBancarias = async () => {
    try {
      const data = await obtenerCuentasBancarias();
      setCuentasBancarias(data.cuentasBancarias || []);
    } catch (err) {
      console.error("Error al cargar cuentas bancarias:", err);
    }
  };

  const cargarVentasCliente = async (clienteId) => {
    if (!clienteId) {
      setVentas([]);
      return;
    }
    try {
      setLoading(true);
      const data = await obtenerVentasPollo({ clienteId });
      // data puede ser un array directamente o { ventas: [...] }
      const lista = Array.isArray(data) ? data : (data.ventas || []);
      setVentas(lista);
    } catch (err) {
      console.error("Error al cargar ventas:", err);
      Swal.fire("Error", "No se pudieron cargar las ventas del cliente", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClienteChange = (e) => {
    const clienteId = e.target.value;
    setFormData({ ...formData, clienteId, ventaId: "" });
    setVentaSeleccionada(null);
    setMediosPago([]);
    cargarVentasCliente(clienteId);
  };

  const handleVentaChange = (e) => {
    const ventaId = e.target.value;
    const venta = ventas.find((v) => v._id === ventaId);
    setFormData({ ...formData, ventaId });
    setVentaSeleccionada(venta || null);
    setMediosPago([]);
    setCurrentMedioPago({
      tipo: "efectivo",
      monto: "",
      numeroReferencia: "",
      banco: "",
      fechaVencimiento: "",
      cuentaBancariaId: "",
    });
  };

  const handleMedioPagoChange = (e) => {
    setCurrentMedioPago({ ...currentMedioPago, [e.target.name]: e.target.value });
  };

  const handleAgregarMedioPago = (e) => {
    e.preventDefault();

    if (!currentMedioPago.monto || parseFloat(currentMedioPago.monto) <= 0) {
      Swal.fire({ title: "Error", text: "Debe ingresar un monto válido", icon: "error", confirmButtonColor: "#d33" });
      return;
    }

    if (currentMedioPago.tipo !== "efectivo" && currentMedioPago.tipo !== "retencion" && !currentMedioPago.numeroReferencia) {
      Swal.fire({ title: "Error", text: "Debe ingresar un número de referencia para este medio de pago", icon: "error", confirmButtonColor: "#d33" });
      return;
    }

    if (currentMedioPago.tipo === "transferencia" && !currentMedioPago.cuentaBancariaId) {
      Swal.fire({ title: "Error", text: "Debe seleccionar una cuenta bancaria para transferencias", icon: "error", confirmButtonColor: "#d33" });
      return;
    }

    if (currentMedioPago.tipo === "cheque" || currentMedioPago.tipo === "echeq") {
      if (!currentMedioPago.banco) {
        Swal.fire({ title: "Error", text: "Debe ingresar el banco del cheque", icon: "error", confirmButtonColor: "#d33" });
        return;
      }
      if (!currentMedioPago.fechaVencimiento) {
        Swal.fire({ title: "Error", text: "Debe ingresar la fecha de vencimiento del cheque", icon: "error", confirmButtonColor: "#d33" });
        return;
      }
    }

    const nuevoMedioPago = {
      tipo: currentMedioPago.tipo,
      monto: parseFloat(currentMedioPago.monto),
      numeroReferencia: currentMedioPago.numeroReferencia || null,
      banco: currentMedioPago.banco || null,
      fechaVencimiento: currentMedioPago.fechaVencimiento || null,
      cuentaBancaria: currentMedioPago.cuentaBancariaId || null,
    };

    setMediosPago([...mediosPago, nuevoMedioPago]);
    setCurrentMedioPago({
      tipo: "efectivo",
      monto: "",
      numeroReferencia: "",
      banco: "",
      fechaVencimiento: "",
      cuentaBancariaId: "",
    });
  };

  const handleEliminarMedioPago = (index) => {
    setMediosPago(mediosPago.filter((_, i) => i !== index));
  };

  const calcularTotalCobrado = () => mediosPago.reduce((total, m) => total + m.monto, 0);

  const handleRegistrarCobro = async () => {
    if (!formData.clienteId) {
      Swal.fire({ title: "Error", text: "Debe seleccionar un cliente", icon: "error", confirmButtonColor: "#d33" });
      return;
    }

    if (!formData.ventaId) {
      Swal.fire({ title: "Error", text: "Debe seleccionar una venta", icon: "error", confirmButtonColor: "#d33" });
      return;
    }

    if (mediosPago.length === 0) {
      Swal.fire({ title: "Error", text: "Debe agregar al menos un medio de pago", icon: "error", confirmButtonColor: "#d33" });
      return;
    }

    const totalCobrado = calcularTotalCobrado();
    const totalVenta = ventaSeleccionada?.total || 0;

    if (totalCobrado > totalVenta) {
      Swal.fire({ title: "Error", text: "El monto cobrado no puede ser mayor al total de la venta", icon: "error", confirmButtonColor: "#d33" });
      return;
    }

    try {
      const cobroData = {
        fecha: ajustarFechaParaGuardar(formData.fecha),
        cliente: formData.clienteId,
        ventaPollo: formData.ventaId,
        mediosPago,
        montoCobrado: totalCobrado,
        tipoCobro: totalCobrado === totalVenta ? "total" : "parcial",
      };

      const cobroCreado = await crearCobro(cobroData);

      // Registrar cheques en cartera
      for (const medio of mediosPago) {
        if (medio.tipo === "cheque" || medio.tipo === "echeq") {
          try {
            await crearCheque({
              numeroCheque: medio.numeroReferencia,
              monto: medio.monto,
              fechaEmision: ajustarFechaParaGuardar(formData.fecha),
              fechaVencimiento: ajustarFechaParaGuardar(medio.fechaVencimiento),
              banco: medio.banco,
              tipoCheque: medio.tipo,
              estado: "cartera",
              origen: "cobro",
              cliente: formData.clienteId,
              cobro: cobroCreado.cobro._id,
            });
          } catch (chequeError) {
            console.error("Error al registrar cheque en cartera:", chequeError);
          }
        }
      }

      await Swal.fire({
        title: "¡Éxito!",
        text: `Cobro ${cobroData.tipoCobro} registrado correctamente`,
        icon: "success",
        confirmButtonColor: "#198754",
      });

      navigate("/cobros");
    } catch (err) {
      console.error("Error al registrar cobro:", err);
      Swal.fire({ title: "Error", text: err.message || "Error al registrar el cobro", icon: "error", confirmButtonColor: "#d33" });
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(amount);

  const formatFecha = (fecha) =>
    new Date(fecha).toLocaleDateString("es-AR");

  const formatOC = (n) => n ? `OC-${String(n).padStart(6, "0")}` : null;

  const getTipoMedioPagoLabel = (tipo) => {
    const labels = { efectivo: "Efectivo", cheque: "Cheque", echeq: "E-Cheq", transferencia: "Transferencia", retencion: "Retención" };
    return labels[tipo] || tipo;
  };

  const getTipoRetencionLabel = (tipo) => {
    const labels = { iibb: "IIBB", ganancias: "Ganancias", iva: "IVA", suss: "SUSS", otra: "Otra" };
    return labels[tipo] || tipo;
  };

  return (
    <Layout>
      <div className="container-fluid">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 col-md-6 mb-3 mb-md-0">
            <h1 className="h3">Registrar Cobro</h1>
            <p className="text-muted">Registra cobros de ventas de clientes</p>
          </div>
          <div className="col-12 col-md-6 text-md-end">
            <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
              <i className="bi bi-arrow-left me-2"></i>
              Volver
            </button>
          </div>
        </div>

        {/* Formulario */}
        <div className="card mb-4 tabla-sin-movimiento">
          <div className="card-body">
            <div className="row">
              {/* Fecha */}
              <div className="col-md-3 mb-3">
                <label htmlFor="fecha" className="form-label">
                  Fecha <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="fecha"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                />
              </div>

              {/* Cliente */}
              <div className="col-md-4 mb-3">
                <label htmlFor="clienteId" className="form-label">
                  Cliente <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="clienteId"
                  value={formData.clienteId}
                  onChange={handleClienteChange}
                  required
                >
                  <option value="">Seleccione un cliente</option>
                  {clientes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.razonSocial} - {c.cuit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Venta */}
              <div className="col-md-5 mb-3">
                <label htmlFor="ventaId" className="form-label">
                  Venta <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="ventaId"
                  value={formData.ventaId}
                  onChange={handleVentaChange}
                  disabled={!formData.clienteId || loading}
                  required
                >
                  <option value="">
                    {!formData.clienteId
                      ? "Primero seleccione un cliente"
                      : loading
                      ? "Cargando ventas..."
                      : ventas.length === 0
                      ? "Sin ventas registradas"
                      : "Seleccione una venta"}
                  </option>
                  {ventas.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.numeroOrdenCobro ? `${formatOC(v.numeroOrdenCobro)} · ` : ""}{formatFecha(v.fecha)} — {v.cajones} caj · {v.pesoTotalKg} kg — {formatCurrency(v.total)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info de la venta seleccionada */}
            {ventaSeleccionada && (
              <div className="alert alert-info mt-3">
                <div className="row">
                  <div className="col-md-3">
                    <strong>Fecha venta:</strong> {formatFecha(ventaSeleccionada.fecha)}
                  </div>
                  <div className="col-md-3">
                    <strong>Cajones:</strong> {ventaSeleccionada.cajones} ({ventaSeleccionada.pesoTotalKg} kg)
                  </div>
                  <div className="col-md-3">
                    <strong>Total venta:</strong> {formatCurrency(ventaSeleccionada.total)}
                  </div>
                  <div className="col-md-3">
                    <strong>Saldo pendiente:</strong>{" "}
                    <span className="text-danger">
                      {formatCurrency(ventaSeleccionada.total - calcularTotalCobrado())}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Medios de Pago */}
        {formData.ventaId && (
          <div className="card mb-4 tabla-sin-movimiento">
            <div className="card-body">
              <h5 className="card-title mb-3">Medios de Pago</h5>

              <form onSubmit={handleAgregarMedioPago}>
                <div className="row align-items-end">
                  {/* Tipo */}
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Tipo de pago</label>
                    <select className="form-select" name="tipo" value={currentMedioPago.tipo} onChange={handleMedioPagoChange}>
                      <option value="efectivo">Efectivo</option>
                      <option value="cheque">Cheque</option>
                      <option value="echeq">E-Cheq</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="retencion">Retención</option>
                    </select>
                  </div>

                  {/* Monto */}
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Monto</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        name="monto"
                        value={currentMedioPago.monto}
                        onChange={handleMedioPagoChange}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Número de referencia */}
                  {currentMedioPago.tipo !== "efectivo" && currentMedioPago.tipo !== "retencion" && (
                    <div className="col-md-3 mb-3">
                      <label className="form-label">
                        {currentMedioPago.tipo === "cheque" || currentMedioPago.tipo === "echeq" ? "Nro. Cheque" : "Nro. Referencia"}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        name="numeroReferencia"
                        value={currentMedioPago.numeroReferencia}
                        onChange={handleMedioPagoChange}
                        placeholder={currentMedioPago.tipo === "cheque" || currentMedioPago.tipo === "echeq" ? "Nro. de cheque" : "CBU, referencia, etc."}
                      />
                    </div>
                  )}

                  {/* Cuenta bancaria (transferencia) */}
                  {currentMedioPago.tipo === "transferencia" && (
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Cuenta Bancaria</label>
                      <select
                        className="form-select"
                        name="cuentaBancariaId"
                        value={currentMedioPago.cuentaBancariaId}
                        onChange={handleMedioPagoChange}
                        required
                      >
                        <option value="">Seleccione cuenta...</option>
                        {cuentasBancarias.filter((c) => c.activo).map((cuenta) => (
                          <option key={cuenta._id} value={cuenta._id}>
                            {cuenta.banco} - {cuenta.numeroCuenta}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Campos de cheque */}
                  {(currentMedioPago.tipo === "cheque" || currentMedioPago.tipo === "echeq") && (
                    <>
                      <div className="col-md-3 mb-3">
                        <label className="form-label">Banco</label>
                        <input
                          type="text"
                          className="form-control"
                          name="banco"
                          value={currentMedioPago.banco}
                          onChange={handleMedioPagoChange}
                          placeholder="Nombre del banco"
                        />
                      </div>
                      <div className="col-md-3 mb-3">
                        <label className="form-label">Vencimiento</label>
                        <input
                          type="date"
                          className="form-control"
                          name="fechaVencimiento"
                          value={currentMedioPago.fechaVencimiento}
                          onChange={handleMedioPagoChange}
                        />
                      </div>
                    </>
                  )}

                  {/* Retención */}
                  {currentMedioPago.tipo === "retencion" && (
                    <>
                      <div className="col-md-3 mb-3">
                        <label className="form-label">Tipo de Retención <span className="text-danger">*</span></label>
                        <select
                          className="form-select"
                          name="tipoRetencion"
                          value={currentMedioPago.tipoRetencion}
                          onChange={handleMedioPagoChange}
                          required
                        >
                          <option value="">Seleccione tipo</option>
                          <option value="iibb">IIBB</option>
                          <option value="ganancias">Ganancias</option>
                          <option value="iva">IVA</option>
                          <option value="suss">SUSS</option>
                          <option value="otra">Otra</option>
                        </select>
                      </div>
                      <div className="col-md-3 mb-3">
                        <label className="form-label">Nro. Certificado</label>
                        <input
                          type="text"
                          className="form-control"
                          name="numeroReferencia"
                          value={currentMedioPago.numeroReferencia}
                          onChange={handleMedioPagoChange}
                          placeholder="Nro. de certificado"
                        />
                      </div>
                    </>
                  )}

                  {/* Botón agregar */}
                  <div className="col-md-3 mb-3">
                    <label className="form-label d-block">&nbsp;</label>
                    <button type="submit" className="btn btn-success w-100">
                      <i className="bi bi-plus-circle me-2"></i>
                      Agregar Medio de Pago
                    </button>
                  </div>
                </div>
              </form>

              {/* Tabla medios de pago */}
              {mediosPago.length > 0 && (
                <div className="table-responsive mt-4">
                  <table className="table table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Tipo</th>
                        <th>Detalle</th>
                        <th>Monto</th>
                        <th>Nro. Referencia</th>
                        <th>Banco/Vencimiento</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediosPago.map((medio, index) => (
                        <tr key={index}>
                          <td>{getTipoMedioPagoLabel(medio.tipo)}</td>
                          <td>
                            {medio.tipo === "retencion" && medio.tipoRetencion
                              ? getTipoRetencionLabel(medio.tipoRetencion)
                              : "-"}
                          </td>
                          <td>{formatCurrency(medio.monto)}</td>
                          <td>{medio.numeroReferencia || "-"}</td>
                          <td>
                            {medio.banco
                              ? medio.banco
                              : medio.fechaVencimiento
                              ? new Date(medio.fechaVencimiento).toLocaleDateString("es-AR")
                              : "-"}
                          </td>
                          <td>
                            <button className="btn btn-sm btn-danger" onClick={() => handleEliminarMedioPago(index)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="2" className="text-end"><strong>Total Cobrado:</strong></td>
                        <td colSpan="4"><strong>{formatCurrency(calcularTotalCobrado())}</strong></td>
                      </tr>
                      {ventaSeleccionada && (
                        <tr>
                          <td colSpan="2" className="text-end"><strong>Total Venta:</strong></td>
                          <td colSpan="4"><strong>{formatCurrency(ventaSeleccionada.total)}</strong></td>
                        </tr>
                      )}
                      {ventaSeleccionada && (
                        <tr>
                          <td colSpan="2" className="text-end"><strong>Saldo Pendiente:</strong></td>
                          <td colSpan="4">
                            <strong className={calcularTotalCobrado() < ventaSeleccionada.total ? "text-danger" : "text-success"}>
                              {formatCurrency(ventaSeleccionada.total - calcularTotalCobrado())}
                            </strong>
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              )}

              {mediosPago.length > 0 && (
                <div className="row mt-3">
                  <div className="col-12">
                    <button className="btn btn-success" onClick={handleRegistrarCobro}>
                      <i className="bi bi-check-circle me-2"></i>
                      Registrar Cobro
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="d-flex justify-content-center align-items-center my-5">
            <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CobrosCreatePage;
