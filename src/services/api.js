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

// Lista las salidas de mostrador de un día (fecha "YYYY-MM-DD").
export const obtenerSalidasMostrador = async (fecha) => {
  const qs = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  const response = await fetch(`${API_URL}/ventas-mostrador${qs}`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

// Edita una salida de mostrador (reajusta el stock de cámara). data: { calibres, trozados }
export const editarSalidaMostrador = async (id, data) => {
  const response = await fetch(`${API_URL}/ventas-mostrador/${id}`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// Borra una salida de mostrador (devuelve el stock a la cámara).
export const eliminarSalidaMostrador = async (id) => {
  const response = await fetch(`${API_URL}/ventas-mostrador/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerEnviosCamara = async () => {
  const response = await fetch(`${API_URL}/envios-camara`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

// Corrige un envío ya cargado. El backend mueve solo la DIFERENCIA de stock
// contra lo que tenía guardado; no se puede cambiar origen/destino.
export const editarEnvioCamara = async (id, data) => {
  const response = await fetch(`${API_URL}/envios-camara/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
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

// confirmarCargaDespacho / confirmarEntregaDespacho se dieron de baja junto con
// "Cargas Camión": las llamaba solo esa pantalla. Los endpoints siguen vivos en
// el backend por si el flujo de choferes vuelve.

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

// Historial de movimientos reconstruido de un lote/galpón (solo superadmin)
export const obtenerMovimientosGalpon = async (loteId) => {
  const response = await fetch(`${API_URL}/lotes-granja/${loteId}/movimientos`, { headers: getAuthHeaders() });
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

// ============= REPRODUCTORES (galpones de postura + incubación) =============
// Sección hermana de Granja y Frigorífico. Flujo: lote reproductor → recría →
// postura (semana 24) → recolección diaria → incubadora (18 días) → nacedora
// (3 días) → pollitos. Los tres descartes del camino van a venta.

const buildQuery = (filtros = {}) => {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v != null && v !== "")
  );
  const s = params.toString();
  return s ? `?${s}` : "";
};

// ── Constantes del módulo (galpones, capacidad, unidades de huevo) ──
export const obtenerConstantesReproductores = async () => {
  const response = await fetch(`${API_URL}/lotes-reproductores/constantes`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ── Lotes reproductores ──
export const obtenerLotesReproductores = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/lotes-reproductores${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerLotesEnProduccion = async () => {
  const response = await fetch(`${API_URL}/lotes-reproductores/en-produccion`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearLoteReproductor = async (data) => {
  const response = await fetch(`${API_URL}/lotes-reproductores`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const mudarLoteAPostura = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}/mudar-postura`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarLoteReproductor = async (id) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ── Mortandad y pesajes (siempre por sexo) ──
export const registrarMortandadReproductor = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}/mortandad`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const editarMortandadReproductor = async (id, mortandadId, data) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}/mortandad/${mortandadId}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarMortandadReproductor = async (id, mortandadId) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}/mortandad/${mortandadId}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const registrarPesajeReproductor = async (id, data) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}/pesaje`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const editarPesajeReproductor = async (id, pesajeId, data) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}/pesaje/${pesajeId}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarPesajeReproductor = async (id, pesajeId) => {
  const response = await fetch(`${API_URL}/lotes-reproductores/${id}/pesaje/${pesajeId}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ── Recolección diaria de huevos ──
export const obtenerRecoleccionesHuevos = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/recolecciones-huevos${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerStockIncubable = async () => {
  const response = await fetch(`${API_URL}/recolecciones-huevos/stock-incubable`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const obtenerResumenProduccion = async (loteId) => {
  const response = await fetch(`${API_URL}/recolecciones-huevos/resumen/${loteId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearRecoleccionHuevos = async (data) => {
  const response = await fetch(`${API_URL}/recolecciones-huevos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// El backend valida que no se baje por debajo de lo ya incubado o ya vendido, y
// reacomoda el stock de descarte con el nuevo número.
export const editarRecoleccionHuevos = async (id, data) => {
  const response = await fetch(`${API_URL}/recolecciones-huevos/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarRecoleccionHuevos = async (id) => {
  const response = await fetch(`${API_URL}/recolecciones-huevos/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ── Incubación (incubadora → nacedora → nacimiento) ──
export const obtenerEstadoIncubadora = async () => {
  const response = await fetch(`${API_URL}/incubacion/estado`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerStockPollitos = async () => {
  const response = await fetch(`${API_URL}/incubacion/stock-pollitos`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

export const obtenerTandasIncubacion = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/incubacion/tandas${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearTandaIncubacion = async (data) => {
  const response = await fetch(`${API_URL}/incubacion/tandas`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const registrarTransferenciaNacedora = async (id, data) => {
  const response = await fetch(`${API_URL}/incubacion/tandas/${id}/transferencia`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const registrarNacimiento = async (id, data) => {
  const response = await fetch(`${API_URL}/incubacion/tandas/${id}/nacimiento`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const cancelarTandaIncubacion = async (id, motivo) => {
  const response = await fetch(`${API_URL}/incubacion/tandas/${id}/cancelar`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ motivo }),
  });
  return handleResponse(response);
};

// ── PROYECCIÓN (cruce granja + incubación) ──
// Almanaque de faena: los tres carriles (nacimientos / galpones / faena) sobre
// un mismo eje de días. Las fechas vienen además como clave "AAAA-MM-DD" ya
// resuelta por el backend — posicionar SIEMPRE por clave, nunca parseando el ISO
// (el server corre en UTC y el navegador en UTC−3: se corre un día).
export const obtenerAlmanaqueFaena = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/proyeccion/almanaque${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Los 14 galpones de engorde con capacidad y si están fuera de servicio. La usan
// los selectores de galpón (ingreso de pollitos, reserva de pollitos) para no
// ofrecer uno que no puede recibir pollitos.
export const obtenerConfigGalpones = async () => {
  const response = await fetch(`${API_URL}/proyeccion/config-galpones`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const guardarConfigGalpon = async (data) => {
  const response = await fetch(`${API_URL}/proyeccion/config-galpones`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

// ── Reserva de pollitos por tanda ──
// El reparto se arma antes de que nazcan: clientes + granjas propias contra los
// pollitos estimados de cada tanda.
export const obtenerRepartoPollitos = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/reservas-pollitos${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearReservaPollitos = async (data) => {
  const response = await fetch(`${API_URL}/reservas-pollitos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const actualizarReservaPollitos = async (id, data) => {
  const response = await fetch(`${API_URL}/reservas-pollitos/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const eliminarReservaPollitos = async (id) => {
  const response = await fetch(`${API_URL}/reservas-pollitos/${id}`, {
    method: "DELETE", headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// ── Ventas del módulo (huevos de descarte y pollitos) ──
export const obtenerStockHuevosDescarte = async () => {
  const response = await fetch(`${API_URL}/reproductores/stock-huevos`, { headers: getAuthHeaders() });
  return handleResponse(response);
};

// Salidas de stock sin cliente (provisorio hasta que exista el módulo de ventas)
export const obtenerSalidasHuevos = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/reproductores/salidas-huevos${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearSalidaHuevos = async (data) => {
  const response = await fetch(`${API_URL}/reproductores/salidas-huevos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const anularSalidaHuevos = async (id, motivo) => {
  const response = await fetch(`${API_URL}/reproductores/salidas-huevos/${id}/anular`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ motivo }),
  });
  return handleResponse(response);
};

export const obtenerVentasHuevos = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/reproductores/ventas-huevos${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearVentaHuevos = async (data) => {
  const response = await fetch(`${API_URL}/reproductores/ventas-huevos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const anularVentaHuevos = async (id, motivo) => {
  const response = await fetch(`${API_URL}/reproductores/ventas-huevos/${id}/anular`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ motivo }),
  });
  return handleResponse(response);
};

export const obtenerVentasPollitos = async (filtros = {}) => {
  const response = await fetch(`${API_URL}/reproductores/ventas-pollitos${buildQuery(filtros)}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

export const crearVentaPollitos = async (data) => {
  const response = await fetch(`${API_URL}/reproductores/ventas-pollitos`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const anularVentaPollitos = async (id, motivo) => {
  const response = await fetch(`${API_URL}/reproductores/ventas-pollitos/${id}/anular`, {
    method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ motivo }),
  });
  return handleResponse(response);
};
