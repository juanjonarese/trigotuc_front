const API_URL = import.meta.env.VITE_API_URL;

// Helper para obtener el token del localStorage
const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Helper para headers con autenticación
const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Manejo de errores
const handleResponse = async (response, shouldRedirectOn401 = true) => {
  const data = await response.json();

  if (!response.ok) {
    // Si el token expiró o es inválido, redirigir al login (excepto en login)
    if (response.status === 401 && shouldRedirectOn401) {
      localStorage.clear();
      // Usar replace para no crear entradas en el historial y evitar loops
      window.location.replace("/login");
    }
    throw new Error(data.msg || "Error en la petición");
  }

  return data;
};

// ============= USUARIOS =============

export const loginUsuario = async (emailUsuario, contraseniaUsuario) => {
  const response = await fetch(`${API_URL}/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailUsuario, contraseniaUsuario }),
  });
  // No redirigir en login - un 401 aquí es credenciales incorrectas, no token expirado
  return handleResponse(response, false);
};

export const obtenerUsuarios = async () => {
  const response = await fetch(`${API_URL}/usuarios`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearUsuario = async (usuarioData) => {
  const response = await fetch(`${API_URL}/usuarios/registro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(usuarioData),
  });
  return handleResponse(response);
};

export const actualizarUsuario = async (id, usuarioData) => {
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(usuarioData),
  });
  return handleResponse(response);
};

export const eliminarUsuario = async (id) => {
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CLIENTES =============

export const obtenerClientes = async () => {
  const response = await fetch(`${API_URL}/clientes`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerClientePorId = async (id) => {
  const response = await fetch(`${API_URL}/clientes/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearCliente = async (clienteData) => {
  const response = await fetch(`${API_URL}/clientes`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(clienteData),
  });
  return handleResponse(response);
};

export const actualizarCliente = async (id, clienteData) => {
  const response = await fetch(`${API_URL}/clientes/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(clienteData),
  });
  return handleResponse(response);
};

export const eliminarCliente = async (id) => {
  const response = await fetch(`${API_URL}/clientes/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const buscarClientes = async (termino) => {
  const response = await fetch(
    `${API_URL}/clientes/buscar?termino=${termino}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(response);
};

// ============= FACTURAS =============

export const obtenerFacturas = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);
  if (filtros.tipoFactura) params.append("tipoFactura", filtros.tipoFactura);
  if (filtros.clienteId) params.append("clienteId", filtros.clienteId);

  const response = await fetch(`${API_URL}/facturas?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerFacturaPorId = async (id) => {
  const response = await fetch(`${API_URL}/facturas/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearFactura = async (facturaData) => {
  const response = await fetch(`${API_URL}/facturas`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(facturaData),
  });
  return handleResponse(response);
};

export const actualizarFactura = async (id, facturaData) => {
  const response = await fetch(`${API_URL}/facturas/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(facturaData),
  });
  return handleResponse(response);
};

export const eliminarFactura = async (id) => {
  const response = await fetch(`${API_URL}/facturas/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerNumeroFacturaX = async () => {
  const response = await fetch(`${API_URL}/facturas/numero-factura-x`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= COBROS =============

export const obtenerCobros = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);
  if (filtros.clienteId) params.append("clienteId", filtros.clienteId);
  if (filtros.tipoCobro) params.append("tipoCobro", filtros.tipoCobro);

  const response = await fetch(`${API_URL}/cobros?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerCobroPorId = async (id) => {
  const response = await fetch(`${API_URL}/cobros/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearCobro = async (cobroData) => {
  const response = await fetch(`${API_URL}/cobros`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(cobroData),
  });
  return handleResponse(response);
};

export const eliminarCobro = async (id) => {
  const response = await fetch(`${API_URL}/cobros/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const forzarEliminacionCobro = async (id) => {
  const response = await fetch(`${API_URL}/cobros/${id}/forzar`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const generarReciboCobro = async (cobroId) => {
  const response = await fetch(`${API_URL}/cobros/${cobroId}/recibo`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CUENTA CORRIENTE =============

export const obtenerCtaCteClientes = async () => {
  const response = await fetch(`${API_URL}/ctacte`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerDetalleCtaCte = async (clienteId) => {
  const response = await fetch(`${API_URL}/ctacte/${clienteId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerResumenIvaVentas = async (fechaDesde, fechaHasta) => {
  const params = new URLSearchParams();
  if (fechaDesde) params.append("fechaDesde", fechaDesde);
  if (fechaHasta) params.append("fechaHasta", fechaHasta);

  const response = await fetch(`${API_URL}/ctacte/resumen-iva?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CAJA =============

export const obtenerMovimientosCaja = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);

  const response = await fetch(`${API_URL}/caja?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerResumenCaja = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);

  const response = await fetch(`${API_URL}/caja/resumen?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Cerrar caja - Contable envía fondos a caja general
export const cerrarCaja = async (data) => {
  const response = await fetch(`${API_URL}/caja/cerrar`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// Transferir fondos - Admin envía de caja general a contable
export const transferirFondos = async (data) => {
  const response = await fetch(`${API_URL}/caja/transferir`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// Obtener historial de transferencias
export const obtenerTransferencias = async () => {
  const response = await fetch(`${API_URL}/caja/transferencias`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Aprobar transferencia de cierre de caja - Solo Admin
export const aprobarTransferencia = async (id) => {
  const response = await fetch(`${API_URL}/caja/transferencias/${id}/aprobar`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Aceptar transferencia de caja general - Solo Contable
export const aceptarTransferencia = async (id) => {
  const response = await fetch(`${API_URL}/caja/transferencias/${id}/aceptar`, {
    method: "PUT",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Rechazar transferencia de cierre de caja - Solo Admin
export const rechazarTransferencia = async (id, motivo) => {
  const response = await fetch(`${API_URL}/caja/transferencias/${id}/rechazar`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ motivo }),
  });
  return handleResponse(response);
};

// Rechazar transferencia de caja general - Solo Contable
export const rechazarTransferenciaPorContable = async (id, motivo) => {
  const response = await fetch(`${API_URL}/caja/transferencias/${id}/rechazar-contable`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ motivo }),
  });
  return handleResponse(response);
};

// Anular transferencia aprobada - Solo Admin
export const anularTransferencia = async (id, motivo) => {
  const response = await fetch(`${API_URL}/caja/transferencias/${id}/anular`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ motivo }),
  });
  return handleResponse(response);
};

// ============= CHEQUES =============

export const obtenerCheques = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.estado) params.append("estado", filtros.estado);
  if (filtros.tipoCheque) params.append("tipoCheque", filtros.tipoCheque);
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);
  if (filtros.cobroId) params.append("cobroId", filtros.cobroId);

  const response = await fetch(`${API_URL}/cheques?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerChequePorId = async (id) => {
  const response = await fetch(`${API_URL}/cheques/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearCheque = async (chequeData) => {
  const response = await fetch(`${API_URL}/cheques`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(chequeData),
  });
  return handleResponse(response);
};

export const eliminarCheque = async (id) => {
  const response = await fetch(`${API_URL}/cheques/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const cambiarEstadoCheque = async (id, estado, cuentaBancariaId = null, costoCambio = null) => {
  const response = await fetch(`${API_URL}/cheques/${id}/estado`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ estado, cuentaBancariaId, costoCambio }),
  });
  return handleResponse(response);
};

// ============= CHEQUES PROPIOS =============

export const obtenerChequesPropios = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.estado) params.append("estado", filtros.estado);

  const url = `${API_URL}/cheques-propio${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerChequePropoPorId = async (id) => {
  const response = await fetch(`${API_URL}/cheques-propio/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const cambiarEstadoChequePropio = async (id, estado, cuentaBancariaId = null) => {
  const response = await fetch(`${API_URL}/cheques-propio/${id}/estado`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ estado, cuentaBancariaId }),
  });
  return handleResponse(response);
};

export const eliminarChequePropio = async (id) => {
  const response = await fetch(`${API_URL}/cheques-propio/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CUENTAS BANCARIAS =============

export const obtenerCuentasBancarias = async () => {
  const response = await fetch(`${API_URL}/cuentas-bancarias`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= PAGOS =============

export const obtenerPagos = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);
  if (filtros.proveedorId) params.append("proveedorId", filtros.proveedorId);
  if (filtros.tipoPago) params.append("tipoPago", filtros.tipoPago);

  const response = await fetch(`${API_URL}/pagos?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerPagosCostosFijos = async (filtros = {}) => {
  const queryParams = new URLSearchParams(filtros).toString();
  const response = await fetch(`${API_URL}/pagos-costos-fijos${queryParams ? `?${queryParams}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerPagosContratistas = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.contratistaId) params.append("contratistaId", filtros.contratistaId);
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);

  const response = await fetch(`${API_URL}/pagos-contratistas?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= MOVIMIENTOS DOLARES =============

export const obtenerMovimientosDolares = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);
  if (filtros.tipo) params.append("tipo", filtros.tipo);

  const response = await fetch(`${API_URL}/movimientos-dolares?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearMovimientoDolar = async (movimientoData) => {
  const response = await fetch(`${API_URL}/movimientos-dolares`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(movimientoData),
  });
  return handleResponse(response);
};

export const eliminarMovimientoDolar = async (id) => {
  const response = await fetch(`${API_URL}/movimientos-dolares/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= MOVIMIENTOS EFECTIVO =============

export const obtenerMovimientosEfectivo = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);
  if (filtros.tipo) params.append("tipo", filtros.tipo);

  const response = await fetch(`${API_URL}/movimientos-efectivo?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearMovimientoEfectivo = async (movimientoData) => {
  const response = await fetch(`${API_URL}/movimientos-efectivo`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(movimientoData),
  });
  return handleResponse(response);
};

export const eliminarMovimientoEfectivo = async (id) => {
  const response = await fetch(`${API_URL}/movimientos-efectivo/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CUENTA CORRIENTE PROVEEDORES (stub para compatibilidad) =============

export const obtenerCtaCteProveedores = async () => {
  const response = await fetch(`${API_URL}/ctacte-proveedores`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= PROYECTOS (stub para compatibilidad) =============

export const obtenerProyectos = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.estado) params.append("estado", filtros.estado);

  const url = `${API_URL}/proyectos${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  return handleResponse(response);
};

// ============= LOTES (GRANJA) =============

export const obtenerLotes = async () => {
  const response = await fetch(`${API_URL}/lotes`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerResumenStock = async () => {
  const response = await fetch(`${API_URL}/lotes/resumen`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerLotePorId = async (id) => {
  const response = await fetch(`${API_URL}/lotes/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearLote = async (data) => {
  const response = await fetch(`${API_URL}/lotes`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarLote = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes/${id}/actualizar`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const obtenerHistorialLote = async (id) => {
  const response = await fetch(`${API_URL}/lotes/${id}/historial`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const eliminarLote = async (id) => {
  const response = await fetch(`${API_URL}/lotes/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= VENTAS POLLO (GRANJA) =============

export const obtenerVentasPollo = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.loteId) params.append("loteId", filtros.loteId);
  if (filtros.clienteId) params.append("clienteId", filtros.clienteId);
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);

  const response = await fetch(`${API_URL}/ventas-pollo?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearVentaPollo = async (data) => {
  const response = await fetch(`${API_URL}/ventas-pollo`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarVentaPollo = async (id) => {
  const response = await fetch(`${API_URL}/ventas-pollo/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= LISTAS DE PRECIOS =============

export const obtenerListasPrecios = async () => {
  const response = await fetch(`${API_URL}/listas-precios`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerListaPrecioPorId = async (id) => {
  const response = await fetch(`${API_URL}/listas-precios/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearListaPrecio = async (data) => {
  const response = await fetch(`${API_URL}/listas-precios`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarListaPrecio = async (id, data) => {
  const response = await fetch(`${API_URL}/listas-precios/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarListaPrecio = async (id) => {
  const response = await fetch(`${API_URL}/listas-precios/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= ENVÍOS CÁMARA (GRANJA) =============

export const crearEnvioCamara = async (data) => {
  const response = await fetch(`${API_URL}/envios-camara`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const obtenerEnviosCamara = async () => {
  const response = await fetch(`${API_URL}/envios-camara`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};


// ============= ÓRDENES DE RETIRO =============

export const obtenerOrdenesRetiro = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.status) params.append("status", filtros.status);
  if (filtros.clienteId) params.append("clienteId", filtros.clienteId);
  if (filtros.camara) params.append("camara", filtros.camara);
  const response = await fetch(`${API_URL}/ordenes-retiro?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerOrdenRetiroPorVenta = async (ventaId) => {
  const response = await fetch(`${API_URL}/ordenes-retiro?ventaId=${ventaId}`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse(response);
  return data[0] || null;
};

export const marcarOrdenEntregada = async (id) => {
  const response = await fetch(`${API_URL}/ordenes-retiro/${id}/entregar`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= DECOMISADOS (GRANJA) =============

export const obtenerDecomisados = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.loteId) params.append("loteId", filtros.loteId);
  const response = await fetch(`${API_URL}/decomisados?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearDecomisado = async (data) => {
  const response = await fetch(`${API_URL}/decomisados`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarDecomisado = async (id) => {
  const response = await fetch(`${API_URL}/decomisados/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= MOVIMIENTOS BANCARIOS =============

export const obtenerMovimientosBancarios = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.fechaDesde) params.append("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.append("fechaHasta", filtros.fechaHasta);
  if (filtros.cuentaBancariaId) params.append("cuentaBancariaId", filtros.cuentaBancariaId);

  const response = await fetch(`${API_URL}/movimientos-bancarios?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CAMIONES =============

export const obtenerCamiones = async () => {
  const response = await fetch(`${API_URL}/camiones`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearCamion = async (data) => {
  const response = await fetch(`${API_URL}/camiones`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarCamion = async (id, data) => {
  const response = await fetch(`${API_URL}/camiones/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarCamion = async (id) => {
  const response = await fetch(`${API_URL}/camiones/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};
