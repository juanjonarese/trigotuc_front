const API_URL = import.meta.env.VITE_API_URL;

const getAuthToken = () => localStorage.getItem("token");

const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const handleResponse = async (response, shouldRedirectOn401 = true) => {
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && shouldRedirectOn401) {
      localStorage.clear();
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
  return handleResponse(response, false);
};

export const obtenerUsuarios = async () => {
  const response = await fetch(`${API_URL}/usuarios`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearUsuario = async (usuarioData) => {
  const response = await fetch(`${API_URL}/usuarios/registro`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(usuarioData),
  });
  return handleResponse(response);
};

export const actualizarUsuario = async (id, usuarioData) => {
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(usuarioData),
  });
  return handleResponse(response);
};

export const eliminarUsuario = async (id) => {
  const response = await fetch(`${API_URL}/usuarios/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CLIENTES =============

export const obtenerClientes = async () => {
  const response = await fetch(`${API_URL}/clientes`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerClientePorId = async (id) => {
  const response = await fetch(`${API_URL}/clientes/${id}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearCliente = async (clienteData) => {
  const response = await fetch(`${API_URL}/clientes`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(clienteData),
  });
  return handleResponse(response);
};

export const actualizarCliente = async (id, clienteData) => {
  const response = await fetch(`${API_URL}/clientes/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(clienteData),
  });
  return handleResponse(response);
};

export const eliminarCliente = async (id) => {
  const response = await fetch(`${API_URL}/clientes/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const buscarClientes = async (termino) => {
  const response = await fetch(`${API_URL}/clientes/buscar?termino=${termino}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= LOTES (FAENA) =============

export const obtenerLotes = async () => {
  const response = await fetch(`${API_URL}/lotes`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerResumenStock = async () => {
  const response = await fetch(`${API_URL}/lotes/resumen`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerLotePorId = async (id) => {
  const response = await fetch(`${API_URL}/lotes/${id}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearLote = async (data) => {
  const response = await fetch(`${API_URL}/lotes`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarLote = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes/${id}/actualizar`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// opciones (opcional): { tiposTrozados: ["alita", ...] } o { enteros: true }.
// Sin opciones se envía todo lo pendiente del lote.
export const enviarLoteACamara = async (id, opciones) => {
  const response = await fetch(`${API_URL}/lotes/${id}/enviar-camara`, {
    method: "PATCH", headers: getAuthHeaders(),
    body: JSON.stringify(opciones || {}),
  });
  return handleResponse(response);
};

export const obtenerHistorialLote = async (id) => {
  const response = await fetch(`${API_URL}/lotes/${id}/historial`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const eliminarLote = async (id) => {
  const response = await fetch(`${API_URL}/lotes/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= ENVÍOS CÁMARA =============

export const crearEnvioCamara = async (data) => {
  const response = await fetch(`${API_URL}/envios-camara`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// Salida de mostrador: descuenta stock de Trigotuc. data: { calibres, trozados }
export const registrarSalidaMostrador = async (data) => {
  const response = await fetch(`${API_URL}/ventas-mostrador`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const obtenerEnviosCamara = async () => {
  const response = await fetch(`${API_URL}/envios-camara`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const eliminarEnvioCamara = async (id) => {
  const response = await fetch(`${API_URL}/envios-camara/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Frigorifico prepara un envío pendiente (Cañete→Trigotuc) y lo entrega al chofer.
export const prepararEnvioCamara = async (id) => {
  const response = await fetch(`${API_URL}/envios-camara/${id}/preparar`, {
    method: "PATCH", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Granja recibe un envío pendiente (Cañete→Trigotuc): ingresa el stock a Trigotuc.
export const recibirEnvioCamara = async (id) => {
  const response = await fetch(`${API_URL}/envios-camara/${id}/recibir`, {
    method: "PATCH", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= DESPACHOS FRIGORIFICO =============

export const obtenerDespachosFrigorifico = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.chofer)    params.append("chofer",    filtros.chofer);
  if (filtros.modalidad) params.append("modalidad", filtros.modalidad);
  if (filtros.estado)    params.append("estado",    filtros.estado);
  const qs = params.toString();
  const response = await fetch(`${API_URL}/despachos-frigorifico${qs ? `?${qs}` : ""}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerStockDisponibleFrigorifico = async (camara, excluirId) => {
  const params = new URLSearchParams({ camara });
  if (excluirId) params.append("excluir", excluirId);
  const response = await fetch(`${API_URL}/despachos-frigorifico/stock-disponible?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearDespachoFrigorifico = async (data) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarDespachoFrigorifico = async (id, data) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const completarDespachoFrigorifico = async (id, data = {}) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico/${id}/completar`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const liberarDespachoFrigorifico = async (id) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico/${id}/liberar`, {
    method: "POST", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const revertirDespachoFrigorifico = async (id) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico/${id}/revertir`, {
    method: "PATCH", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const eliminarDespachoFrigorifico = async (id) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const confirmarCargaDespacho = async (id) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico/${id}/confirmar-carga`, {
    method: "PATCH", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const confirmarEntregaDespacho = async (id) => {
  const response = await fetch(`${API_URL}/despachos-frigorifico/${id}/confirmar-entrega`, {
    method: "PATCH", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= AUDIT LOG =============

export const obtenerAuditLog = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.area)          params.append("area",          filtros.area);
  if (filtros.entidad)       params.append("entidad",       filtros.entidad);
  if (filtros.accion)        params.append("accion",        filtros.accion);
  if (filtros.nombreUsuario) params.append("nombreUsuario", filtros.nombreUsuario);
  if (filtros.rolUsuario)    params.append("rolUsuario",    filtros.rolUsuario);
  if (filtros.fechaDesde)    params.append("fechaDesde",    filtros.fechaDesde);
  if (filtros.fechaHasta)    params.append("fechaHasta",    filtros.fechaHasta);
  const response = await fetch(`${API_URL}/audit-log?${params.toString()}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

// ============= ÓRDENES DE RETIRO (solo para ChoferPage) =============

export const obtenerOrdenesRetiro = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.status)    params.append("status",    filtros.status);
  if (filtros.clienteId) params.append("clienteId", filtros.clienteId);
  if (filtros.camara)    params.append("camara",    filtros.camara);
  if (filtros.modalidad) params.append("modalidad", filtros.modalidad);
  const response = await fetch(`${API_URL}/ordenes-retiro?${params.toString()}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

// ============= DECOMISADOS =============

export const obtenerDecomisados = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.loteId) params.append("loteId", filtros.loteId);
  const response = await fetch(`${API_URL}/decomisados?${params.toString()}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearDecomisado = async (data) => {
  const response = await fetch(`${API_URL}/decomisados`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarDecomisado = async (id) => {
  const response = await fetch(`${API_URL}/decomisados/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= CAMIONES =============

export const obtenerCamiones = async () => {
  const response = await fetch(`${API_URL}/camiones`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerChoferes = async () => {
  const response = await fetch(`${API_URL}/camiones/choferes`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearChofer = async (data) => {
  const response = await fetch(`${API_URL}/camiones/choferes`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarChofer = async (id) => {
  const response = await fetch(`${API_URL}/camiones/choferes/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearCamion = async (data) => {
  const response = await fetch(`${API_URL}/camiones`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarCamion = async (id, data) => {
  const response = await fetch(`${API_URL}/camiones/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarCamion = async (id) => {
  const response = await fetch(`${API_URL}/camiones/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= GRANJA (CRIANZA) =============

export const obtenerLotesGranja = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`${API_URL}/lotes-granja${qs ? `?${qs}` : ""}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerLoteGranjaPorId = async (id) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearLoteGranja = async (data) => {
  const response = await fetch(`${API_URL}/lotes-granja`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const registrarPesajeGranja = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}/pesaje`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const registrarMortandadGranja = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}/mortandad`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const editarPesajeGranja = async (id, pesajeId, data) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}/pesaje/${pesajeId}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarPesajeGranja = async (id, pesajeId) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}/pesaje/${pesajeId}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const editarMortandadGranja = async (id, mortandadId, data) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}/mortandad/${mortandadId}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarMortandadGranja = async (id, mortandadId) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}/mortandad/${mortandadId}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const mudarPollosGranja = async (data) => {
  const response = await fetch(`${API_URL}/lotes-granja/mudar`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const registrarEgresoGranja = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}/egreso`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarLoteGranja = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarLoteGranja = async (id) => {
  const response = await fetch(`${API_URL}/lotes-granja/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= PEDIDOS INGRESO POLLITOS =============

export const listarPedidosIngresoPollitos = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`${API_URL}/pedidos-ingreso-pollitos${qs ? `?${qs}` : ""}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearPedidoIngresoPollitos = async (data) => {
  const response = await fetch(`${API_URL}/pedidos-ingreso-pollitos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const confirmarPedidoIngresoPollitos = async (id, data) => {
  const response = await fetch(`${API_URL}/pedidos-ingreso-pollitos/${id}/confirmar`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const cancelarPedidoIngresoPollitos = async (id) => {
  const response = await fetch(`${API_URL}/pedidos-ingreso-pollitos/${id}/cancelar`, {
    method: "PATCH", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= VENTAS GRANJA (GORDOS) =============

export const obtenerVentasGranja = async () => {
  const response = await fetch(`${API_URL}/ventas-granja`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const emitirVentaGranja = async (ordenId, data) => {
  const response = await fetch(`${API_URL}/ventas-granja/desde-orden/${ordenId}`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarVentaGranja = async (id) => {
  const response = await fetch(`${API_URL}/ventas-granja/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= ÓRDENES DE CARGA =============

export const obtenerOrdenesCarga = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.estado) params.append("estado", filtros.estado);
  if (filtros.granja) params.append("granja", filtros.granja);
  if (filtros.tipo)   params.append("tipo",   filtros.tipo);
  const response = await fetch(`${API_URL}/ordenes-carga?${params}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerOrdenCargaPorId = async (id) => {
  const response = await fetch(`${API_URL}/ordenes-carga/${id}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearOrdenCarga = async (data) => {
  const response = await fetch(`${API_URL}/ordenes-carga`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarOrdenCarga = async (id, data) => {
  const response = await fetch(`${API_URL}/ordenes-carga/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const enviarOrdenCarga = async (id) => {
  const response = await fetch(`${API_URL}/ordenes-carga/${id}/enviar`, {
    method: "PUT", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const entregarOrdenCarga = async (id, data) => {
  const response = await fetch(`${API_URL}/ordenes-carga/${id}/entregar`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarOrdenCarga = async (id) => {
  const response = await fetch(`${API_URL}/ordenes-carga/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const liberarOrdenCarga = async (id) => {
  const response = await fetch(`${API_URL}/ordenes-carga/${id}/liberar`, {
    method: "POST", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const revertirOrdenCarga = async (id) => {
  const response = await fetch(`${API_URL}/ordenes-carga/${id}/revertir`, {
    method: "PUT", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= REMITOS GRANJA =============

export const obtenerRemitoGranjaPorId = async (id) => {
  const response = await fetch(`${API_URL}/remitos-granja/${id}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerRemitosGranja = async (filtros = {}) => {
  const params = new URLSearchParams();
  if (filtros.estado) params.append("estado", filtros.estado);
  const response = await fetch(`${API_URL}/remitos-granja?${params}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearRemitoGranja = async (data) => {
  const response = await fetch(`${API_URL}/remitos-granja`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const confirmarRecepcionRemito = async (id, data) => {
  const response = await fetch(`${API_URL}/remitos-granja/${id}/recepcion`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarRemitoGranja = async (id) => {
  const response = await fetch(`${API_URL}/remitos-granja/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const ingresarLoteDesdeRemito = async (id, data) => {
  const response = await fetch(`${API_URL}/remitos-granja/${id}/ingreso-lote`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// ============= STOCK EMPAQUE =============

export const obtenerStockEstadisticas = async () => {
  const response = await fetch(`${API_URL}/stock-empaque/estadisticas`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerStockArticulos = async () => {
  const response = await fetch(`${API_URL}/stock-empaque/articulos`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearStockArticulo = async (data) => {
  const response = await fetch(`${API_URL}/stock-empaque/articulos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarStockArticulo = async (id, data) => {
  const response = await fetch(`${API_URL}/stock-empaque/articulos/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarStockArticulo = async (id) => {
  const response = await fetch(`${API_URL}/stock-empaque/articulos/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerStockMovimientos = async (articuloId) => {
  const response = await fetch(`${API_URL}/stock-empaque/movimientos/${articuloId}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const resetearBaseDeDatos = async () => {
  const response = await fetch(`${API_URL}/system/reset`, {
    method: "POST", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const consumirStockLote = async (data) => {
  const response = await fetch(`${API_URL}/stock-empaque/consumo-lote`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const registrarStockMovimiento = async (data) => {
  const response = await fetch(`${API_URL}/stock-empaque/movimientos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const obtenerProveedoresEmpaque = async () => {
  const response = await fetch(`${API_URL}/stock-empaque/proveedores`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const crearProveedorEmpaque = async (data) => {
  const response = await fetch(`${API_URL}/stock-empaque/proveedores`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarProveedorEmpaque = async (id, data) => {
  const response = await fetch(`${API_URL}/stock-empaque/proveedores/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarProveedorEmpaque = async (id) => {
  const response = await fetch(`${API_URL}/stock-empaque/proveedores/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ============= PUSH NOTIFICATIONS =============

export const obtenerVapidKey = async () => {
  const response = await fetch(`${API_URL}/push/vapid-key`);
  return handleResponse(response, false);
};

export const suscribirPush = async (subscription) => {
  const response = await fetch(`${API_URL}/push`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(subscription),
  });
  return handleResponse(response);
};

export const desuscribirPush = async (endpoint) => {
  const response = await fetch(`${API_URL}/push`, {
    method: "DELETE", headers: getAuthHeaders(), body: JSON.stringify({ endpoint }),
  });
  return handleResponse(response);
};

export const estadoPush = async () => {
  const response = await fetch(`${API_URL}/push/estado`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const testPush = async () => {
  const response = await fetch(`${API_URL}/push/test`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify({}),
  });
  return handleResponse(response);
};

// ============= INTEGRACIÓN POS (Dropbox / FoxPro) =============

// Lee la carpeta de Dropbox y descuenta los tickets nuevos (idempotente).
export const sincronizarVentasDropbox = async (camara = "trigotuc") => {
  const response = await fetch(`${API_URL}/prueba-dropbox/sync`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ camara }),
  });
  return handleResponse(response);
};

// Historial de movimientos de stock de cámara (solo superadmin).
export const obtenerMovimientosCamara = async (filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v != null && v !== "")
  );
  const qs = params.toString();
  const response = await fetch(`${API_URL}/movimientos-camara${qs ? `?${qs}` : ""}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};
