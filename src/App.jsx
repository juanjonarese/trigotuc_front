import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
const DashboardPage = lazy(() => import("./pages/DashboarPage"));
const ClientesPage = lazy(() => import("./pages/ClientesPage"));
const PersonalPage = lazy(() => import("./pages/PersonalPage"));
const GranjaDashboardPage = lazy(() => import("./pages/GranjaDashboardPage"));
const LoteCreatePage = lazy(() => import("./pages/LoteCreatePage"));
const LoteFaenaCrearPage = lazy(() => import("./pages/LoteFaenaCrearPage"));
const PedidosGranjaPage = lazy(() => import("./pages/PedidosGranjaPage"));
const EnvioCamaraPage = lazy(() => import("./pages/EnvioCamaraPage"));
const SalidaMostradorPage = lazy(() => import("./pages/SalidaMostradorPage"));
const RecepcionCamaraPage = lazy(() => import("./pages/RecepcionCamaraPage"));
const CamionesPage = lazy(() => import("./pages/CamionesPage"));
const DecomisadosPage = lazy(() => import("./pages/DecomisadosPage"));
const GranjaLotesPage = lazy(() => import("./pages/GranjaLotesPage"));
const GranjaLoteNuevoPage = lazy(() => import("./pages/GranjaLoteNuevoPage"));
const GranjaCargaDatosPage = lazy(() => import("./pages/GranjaCargaDatosPage"));
const VentasGranjaPage = lazy(() => import("./pages/VentasGranjaPage"));
const GranjaRemitosPage = lazy(() => import("./pages/GranjaRemitosPage"));
const GranjaHistorialPage = lazy(() => import("./pages/GranjaHistorialPage"));
const GranjaMovimientosPage = lazy(() => import("./pages/GranjaMovimientosPage"));
const OrdenCargaListPage = lazy(() => import("./pages/OrdenCargaListPage"));
const OrdenCargaDetallePage = lazy(() => import("./pages/OrdenCargaDetallePage"));
const RecepcionOrdenCargaPage = lazy(() => import("./pages/RecepcionOrdenCargaPage"));
const RecepcionRemitosPage = lazy(() => import("./pages/RecepcionRemitosPage"));
const HistorialAccesosPage = lazy(() => import("./pages/HistorialAccesosPage"));
const StockEmpaquePage = lazy(() => import("./pages/StockEmpaquePage"));
const DespachoFrigorificoPage = lazy(() => import("./pages/DespachoFrigorificoPage"));
const RecepcionFrigorificoPage = lazy(() => import("./pages/RecepcionFrigorificoPage"));
const ReproductoresLotesPage = lazy(() => import("./pages/ReproductoresLotesPage"));
const ReproductorLoteNuevoPage = lazy(() => import("./pages/ReproductorLoteNuevoPage"));
const ReproductoresDatosPage = lazy(() => import("./pages/ReproductoresDatosPage"));
const RecoleccionHuevosPage = lazy(() => import("./pages/RecoleccionHuevosPage"));
const RemitosHuevosPage = lazy(() => import("./pages/RemitosHuevosPage"));
const RecepcionHuevosPage = lazy(() => import("./pages/RecepcionHuevosPage"));
const IncubadoraPage = lazy(() => import("./pages/IncubadoraPage"));
// Ventas de Reproductores: en pausa por pedido del cliente.
// import VentaHuevosPage from "./pages/VentaHuevosPage";
// import VentaPollitosPage from "./pages/VentaPollitosPage";
const ProyeccionPage = lazy(() => import("./pages/ProyeccionPage"));
const OrdenCargaPollitosPage = lazy(() => import("./pages/OrdenCargaPollitosPage"));
const AlimentoEnviosPage = lazy(() => import("./pages/AlimentoEnviosPage"));
const AlimentoSilosPage = lazy(() => import("./pages/AlimentoSilosPage"));
const PlanPollitosPage = lazy(() => import("./pages/PlanPollitosPage"));
const StockHuevosPage = lazy(() => import("./pages/StockHuevosPage"));
const InicioPage = lazy(() => import("./pages/InicioPage"));
const ForratucInicioPage = lazy(() => import("./pages/forratuc/ForratucInicioPage"));
const ForratucPresupuestosPage = lazy(() => import("./pages/forratuc/ForratucPresupuestosPage"));
const ForratucCuentasCorrientesPage = lazy(() => import("./pages/forratuc/ForratucCuentasCorrientesPage"));
const ForratucPagosPage = lazy(() => import("./pages/forratuc/ForratucPagosPage"));
const ForratucProductosPage = lazy(() => import("./pages/forratuc/ForratucProductosPage"));
const ForratucPlantaPage = lazy(() => import("./pages/forratuc/ForratucPlantaPage"));
const ForratucStockPage = lazy(() => import("./pages/forratuc/ForratucStockPage"));
const ForratucListasPreciosPage = lazy(() => import("./pages/forratuc/ForratucListasPreciosPage"));
const ForratucCajaPage = lazy(() => import("./pages/forratuc/ForratucCajaPage"));
const AvicolaProductosPage = lazy(() => import("./pages/AvicolaProductosPage"));
import ProtectedRoute from "./components/ProtectedRoute";

// Cada pantalla se descarga recién cuando se abre (2026-11-06): el bundle único
// pesaba 2,7 MB y se bajaba entero en el primer ingreso y después de cada deploy.
// El login va directo, para que la primera pantalla no espere nada.
const Cargando = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
    <div className="spinner-border text-primary" role="status"></div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />

        {/* Tarjetas de ingreso: elegir empresa del grupo (2026-10-16). */}
        <Route path="/inicio" element={<ProtectedRoute><InicioPage /></ProtectedRoute>} />

        {/* Forratuc — local de venta al público. En desarrollo: solo superadmin.
            El mostrador es de Forratuc; la ruta vieja /frigorifico/salida-mostrador
            sigue para los roles de la avícola que lo usan hoy. */}
        <Route path="/forratuc" element={<ProtectedRoute><ForratucInicioPage /></ProtectedRoute>} />
        {/* El mostrador de Forratuc emite presupuestos (2026-10-21). La salida
            suelta de stock queda en /forratuc/salidas: ahí se ven también las
            salidas que generan los presupuestos. */}
        <Route path="/forratuc/mostrador" element={<ProtectedRoute><ForratucPresupuestosPage /></ProtectedRoute>} />
        <Route path="/forratuc/salidas" element={<ProtectedRoute><SalidaMostradorPage /></ProtectedRoute>} />
        <Route path="/forratuc/cuentas-corrientes" element={<ProtectedRoute><ForratucCuentasCorrientesPage /></ProtectedRoute>} />
        <Route path="/forratuc/pagos" element={<ProtectedRoute><ForratucPagosPage /></ProtectedRoute>} />
        <Route path="/forratuc/productos" element={<ProtectedRoute><ForratucProductosPage /></ProtectedRoute>} />
        {/* Planta de alimento (2026-11-04): fórmula → elaboración → envío. */}
        <Route path="/forratuc/planta" element={<ProtectedRoute><ForratucPlantaPage /></ProtectedRoute>} />
        {/* Stock del local (2026-10-26): pollo, huevo, pollitos y alimento balanceado. */}
        <Route path="/forratuc/stock" element={<ProtectedRoute><ForratucStockPage /></ProtectedRoute>} />
        {/* Observaciones del cliente (2026-10-29) */}
        <Route path="/forratuc/listas-precios" element={<ProtectedRoute><ForratucListasPreciosPage /></ProtectedRoute>} />
        <Route path="/forratuc/caja" element={<ProtectedRoute><ForratucCajaPage /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        {/* Productos de la avícola (2026-11-04): los administra ella; los vende Forratuc. */}
        <Route path="/avicola/productos" element={<ProtectedRoute><AvicolaProductosPage /></ProtectedRoute>} />
        {/* Proyección vive en la raíz del menú (cruza Reproductores y Granja). */}
        <Route path="/proyeccion" element={<ProtectedRoute><ProyeccionPage /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute><ClientesPage /></ProtectedRoute>} />
        <Route path="/personal" element={<ProtectedRoute><PersonalPage /></ProtectedRoute>} />
        <Route path="/camiones" element={<ProtectedRoute><CamionesPage /></ProtectedRoute>} />

        {/* Frigorifico */}
        <Route path="/frigorifico" element={<ProtectedRoute><GranjaDashboardPage /></ProtectedRoute>} />
        <Route path="/frigorifico/lotes/nuevo" element={<ProtectedRoute><LoteCreatePage /></ProtectedRoute>} />
        <Route path="/frigorifico/lotes/crear" element={<ProtectedRoute><LoteFaenaCrearPage /></ProtectedRoute>} />
        <Route path="/frigorifico/pedidos-granja" element={<ProtectedRoute><PedidosGranjaPage /></ProtectedRoute>} />
        <Route path="/frigorifico/envios" element={<ProtectedRoute><EnvioCamaraPage /></ProtectedRoute>} />
        <Route path="/frigorifico/salida-mostrador" element={<ProtectedRoute><SalidaMostradorPage /></ProtectedRoute>} />
        <Route path="/frigorifico/recepcion-camara" element={<ProtectedRoute><RecepcionCamaraPage /></ProtectedRoute>} />
        <Route path="/frigorifico/decomisados" element={<ProtectedRoute><DecomisadosPage /></ProtectedRoute>} />
        <Route path="/frigorifico/stock-empaque" element={<ProtectedRoute><StockEmpaquePage /></ProtectedRoute>} />
        <Route path="/frigorifico/ordenes-carga" element={<ProtectedRoute><DespachoFrigorificoPage /></ProtectedRoute>} />
        <Route path="/frigorifico/recepcion" element={<ProtectedRoute><RecepcionFrigorificoPage /></ProtectedRoute>} />
        <Route path="/frigorifico/recepcion-remitos" element={<ProtectedRoute><RecepcionRemitosPage /></ProtectedRoute>} />
        <Route path="/frigorifico/historial-accesos" element={<ProtectedRoute><HistorialAccesosPage /></ProtectedRoute>} />

        {/* Granja (crianza) */}
        <Route path="/granja/galpones" element={<ProtectedRoute><GranjaLotesPage /></ProtectedRoute>} />
        <Route path="/granja/galpones/nuevo" element={<ProtectedRoute><GranjaLoteNuevoPage /></ProtectedRoute>} />
        <Route path="/granja/cargar-datos" element={<ProtectedRoute><GranjaCargaDatosPage /></ProtectedRoute>} />
        <Route path="/granja/historial" element={<ProtectedRoute><GranjaHistorialPage /></ProtectedRoute>} />
        <Route path="/granja/movimientos" element={<ProtectedRoute><GranjaMovimientosPage /></ProtectedRoute>} />
        <Route path="/granja/ordenes-carga" element={<ProtectedRoute><OrdenCargaListPage /></ProtectedRoute>} />
        <Route path="/granja/ordenes-carga/:id" element={<ProtectedRoute><OrdenCargaDetallePage /></ProtectedRoute>} />
        <Route path="/granja/recepcion-ordenes" element={<ProtectedRoute><RecepcionOrdenCargaPage /></ProtectedRoute>} />
        <Route path="/granja/ventas" element={<ProtectedRoute><VentasGranjaPage /></ProtectedRoute>} />
        <Route path="/granja/remitos" element={<ProtectedRoute><GranjaRemitosPage /></ProtectedRoute>} />

        {/* Reproductores (postura + incubación) */}
        <Route path="/reproductores/galpones" element={<ProtectedRoute><ReproductoresLotesPage /></ProtectedRoute>} />
        <Route path="/reproductores/galpones/nuevo" element={<ProtectedRoute><ReproductorLoteNuevoPage /></ProtectedRoute>} />
        <Route path="/reproductores/datos-semanales" element={<ProtectedRoute><ReproductoresDatosPage /></ProtectedRoute>} />
        <Route path="/reproductores/recoleccion" element={<ProtectedRoute><RecoleccionHuevosPage /></ProtectedRoute>} />
        <Route path="/reproductores/remitos" element={<ProtectedRoute><RemitosHuevosPage /></ProtectedRoute>} />
        <Route path="/reproductores/recepcion-huevos" element={<ProtectedRoute><RecepcionHuevosPage /></ProtectedRoute>} />
        {/* Recepción de API pasó a ser Recepción de huevos (API y consumo) el 2026-10-04. */}
        <Route path="/reproductores/recepcion-api" element={<Navigate to="/reproductores/recepcion-huevos" replace />} />
        <Route path="/reproductores/incubadora" element={<ProtectedRoute><IncubadoraPage /></ProtectedRoute>} />
        {/* Nacimientos se absorbió en Incubadora (tarjetas de nacedora + solapa). */}
        <Route path="/reproductores/nacimientos" element={<Navigate to="/reproductores/incubadora" replace />} />
        {/* Ruta vieja: Proyección se mudó a la raíz. */}
        <Route path="/reproductores/reserva-pollitos" element={<Navigate to="/proyeccion" replace />} />
        {/* Plan de Pollitos: una fila por carga de incubadora — lo que va a nacer,
            lo vendido, lo que va a engorde y lo que queda libre. Es la planilla
            del cliente, y la pantalla con la que se decide a quién se le vende. */}
        <Route path="/reproductores/plan" element={<ProtectedRoute><PlanPollitosPage /></ProtectedRoute>} />
        {/* Asignaciones se absorbió en el Plan de Pollitos (2026-09-20): era la
            misma lista de reservas, suelta y sin la foto de lo que va a nacer. */}
        <Route path="/reproductores/asignaciones" element={<Navigate to="/reproductores/plan" replace />} />
        {/* Órdenes de carga de pollitos: la salida del stock de nacimientos hacia el cliente. */}
        <Route path="/reproductores/ordenes-carga" element={<ProtectedRoute><OrdenCargaPollitosPage /></ProtectedRoute>} />

        {/* Alimento: Trigotuc despacha a las granjas. Módulo hermano de Granja,
            Reproductoras y Frigorífico. */}
        <Route path="/alimento/envios"    element={<ProtectedRoute><AlimentoEnviosPage /></ProtectedRoute>} />
        {/* La recepción de alimento se hace en Silos desde el 2026-09-30. */}
        <Route path="/alimento/recepcion" element={<Navigate to="/alimento/silos" replace />} />
        <Route path="/alimento/silos"     element={<ProtectedRoute><AlimentoSilosPage /></ProtectedRoute>} />
        <Route path="/reproductores/stock-huevos" element={<ProtectedRoute><StockHuevosPage /></ProtectedRoute>} />
        {/* Ventas de Reproductores: en pausa por pedido del cliente.
        <Route path="/reproductores/ventas-huevos" element={<ProtectedRoute><VentaHuevosPage /></ProtectedRoute>} />
        <Route path="/reproductores/ventas-pollitos" element={<ProtectedRoute><VentaPollitosPage /></ProtectedRoute>} />
        */}

        {/* "Cargas Camión" (ChoferPage) se dio de baja: los choferes no van a
            usar la app. Los despachos delivery_chofer los sigue manejando
            administración desde Órdenes de Carga. */}

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
