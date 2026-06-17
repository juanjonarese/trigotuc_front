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
import CamionesPage from "./pages/CamionesPage";
import DecomisadosPage from "./pages/DecomisadosPage";
import GranjaLotesPage from "./pages/GranjaLotesPage";
import GranjaLoteNuevoPage from "./pages/GranjaLoteNuevoPage";
import GranjaCargaDatosPage from "./pages/GranjaCargaDatosPage";
import VentasGranjaPage from "./pages/VentasGranjaPage";
import GranjaRemitosPage from "./pages/GranjaRemitosPage";
import GranjaHistorialPage from "./pages/GranjaHistorialPage";
import OrdenCargaListPage from "./pages/OrdenCargaListPage";
import OrdenCargaDetallePage from "./pages/OrdenCargaDetallePage";
import RecepcionOrdenCargaPage from "./pages/RecepcionOrdenCargaPage";
import RecepcionRemitosPage from "./pages/RecepcionRemitosPage";
import HistorialAccesosPage from "./pages/HistorialAccesosPage";
import StockEmpaquePage from "./pages/StockEmpaquePage";
import DespachoFrigorificoPage from "./pages/DespachoFrigorificoPage";
import RecepcionFrigorificoPage from "./pages/RecepcionFrigorificoPage";
import ChoferPage from "./pages/ChoferPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute><ClientesPage /></ProtectedRoute>} />
        <Route path="/personal" element={<ProtectedRoute><PersonalPage /></ProtectedRoute>} />
        <Route path="/camiones" element={<ProtectedRoute><CamionesPage /></ProtectedRoute>} />

        {/* Frigorifico */}
        <Route path="/frigorifico" element={<ProtectedRoute><GranjaDashboardPage /></ProtectedRoute>} />
        <Route path="/frigorifico/lotes/nuevo" element={<ProtectedRoute><LoteCreatePage /></ProtectedRoute>} />
        <Route path="/frigorifico/lotes/crear" element={<ProtectedRoute><LoteFaenaCrearPage /></ProtectedRoute>} />
        <Route path="/frigorifico/pedidos-granja" element={<ProtectedRoute><PedidosGranjaPage /></ProtectedRoute>} />
        <Route path="/frigorifico/envios" element={<ProtectedRoute><EnvioCamaraPage /></ProtectedRoute>} />
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
        <Route path="/granja/ordenes-carga" element={<ProtectedRoute><OrdenCargaListPage /></ProtectedRoute>} />
        <Route path="/granja/ordenes-carga/:id" element={<ProtectedRoute><OrdenCargaDetallePage /></ProtectedRoute>} />
        <Route path="/granja/recepcion-ordenes" element={<ProtectedRoute><RecepcionOrdenCargaPage /></ProtectedRoute>} />
        <Route path="/granja/ventas" element={<ProtectedRoute><VentasGranjaPage /></ProtectedRoute>} />
        <Route path="/granja/remitos" element={<ProtectedRoute><GranjaRemitosPage /></ProtectedRoute>} />

        {/* Chofer */}
        <Route path="/chofer" element={<ProtectedRoute><ChoferPage /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
