import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
import DashboardPage from "./pages/DashboarPage";
import ClientesPage from "./pages/ClientesPage";
import PersonalPage from "./pages/PersonalPage";
import GranjaDashboardPage from "./pages/GranjaDashboardPage";
import LoteCreatePage from "./pages/LoteCreatePage";
import LoteFaenaCrearPage from "./pages/LoteFaenaCrearPage";
import PedidosGranjaPage from "./pages/PedidosGranjaPage";
import EnvioCamaraPage from "./pages/EnvioCamaraPage";
import SalidaMostradorPage from "./pages/SalidaMostradorPage";
import RecepcionCamaraPage from "./pages/RecepcionCamaraPage";
import CamionesPage from "./pages/CamionesPage";
import DecomisadosPage from "./pages/DecomisadosPage";
import GranjaLotesPage from "./pages/GranjaLotesPage";
import GranjaLoteNuevoPage from "./pages/GranjaLoteNuevoPage";
import GranjaCargaDatosPage from "./pages/GranjaCargaDatosPage";
import VentasGranjaPage from "./pages/VentasGranjaPage";
import GranjaRemitosPage from "./pages/GranjaRemitosPage";
import GranjaHistorialPage from "./pages/GranjaHistorialPage";
import GranjaMovimientosPage from "./pages/GranjaMovimientosPage";
import OrdenCargaListPage from "./pages/OrdenCargaListPage";
import OrdenCargaDetallePage from "./pages/OrdenCargaDetallePage";
import RecepcionOrdenCargaPage from "./pages/RecepcionOrdenCargaPage";
import RecepcionRemitosPage from "./pages/RecepcionRemitosPage";
import HistorialAccesosPage from "./pages/HistorialAccesosPage";
import StockEmpaquePage from "./pages/StockEmpaquePage";
import DespachoFrigorificoPage from "./pages/DespachoFrigorificoPage";
import RecepcionFrigorificoPage from "./pages/RecepcionFrigorificoPage";
import ReproductoresLotesPage from "./pages/ReproductoresLotesPage";
import ReproductorLoteNuevoPage from "./pages/ReproductorLoteNuevoPage";
import ReproductoresDatosPage from "./pages/ReproductoresDatosPage";
import RecoleccionHuevosPage from "./pages/RecoleccionHuevosPage";
import RemitosHuevosPage from "./pages/RemitosHuevosPage";
import IncubadoraPage from "./pages/IncubadoraPage";
// Ventas de Reproductores: en pausa por pedido del cliente.
// import VentaHuevosPage from "./pages/VentaHuevosPage";
// import VentaPollitosPage from "./pages/VentaPollitosPage";
import ReservaPollitosPage from "./pages/ReservaPollitosPage";
import AsignacionesPollitosPage from "./pages/AsignacionesPollitosPage";
import StockHuevosPage from "./pages/StockHuevosPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        {/* Proyección pasó a ser la pantalla de Reproductores. */}
        <Route path="/proyeccion" element={<Navigate to="/reproductores/reserva-pollitos" replace />} />
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
        <Route path="/reproductores/incubadora" element={<ProtectedRoute><IncubadoraPage /></ProtectedRoute>} />
        {/* Nacimientos se absorbió en Incubadora (tarjetas de nacedora + solapa). */}
        <Route path="/reproductores/nacimientos" element={<Navigate to="/reproductores/incubadora" replace />} />
        <Route path="/reproductores/reserva-pollitos" element={<ProtectedRoute><ReservaPollitosPage /></ProtectedRoute>} />
        <Route path="/reproductores/asignaciones" element={<ProtectedRoute><AsignacionesPollitosPage /></ProtectedRoute>} />
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
    </BrowserRouter>
  );
}

export default App;
