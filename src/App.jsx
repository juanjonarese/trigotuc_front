import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginScreen from "./pages/LoginScreen";
import DashboardPage from "./pages/DashboarPage";
import ClientesPage from "./pages/ClientesPage";
import PersonalPage from "./pages/PersonalPage";
import FacturasListPage from "./pages/FacturasListPage";
import FacturacionPage from "./pages/FacturacionPage";
import CobrosListPage from "./pages/CobrosListPage";
import CobrosCreatePage from "./pages/CobrosCreatePage";
import CtaCteClientesPage from "./pages/CtaCteClientesPage";
import CajaPage from "./pages/CajaPage";
import GranjaDashboardPage from "./pages/GranjaDashboardPage";
import LoteCreatePage from "./pages/LoteCreatePage";
import PedidosGranjaPage from "./pages/PedidosGranjaPage";
import VentasPolloPage from "./pages/VentasPolloPage";
import ListasPreciosPage from "./pages/ListasPreciosPage";
import EnvioCamaraPage from "./pages/EnvioCamaraPage";
import CamionesPage from "./pages/CamionesPage";
import DecomisadosPage from "./pages/DecomisadosPage";
import OrdenesRetiroPage from "./pages/OrdenesRetiroPage";
import GranjaLotesPage from "./pages/GranjaLotesPage";
import GranjaLoteNuevoPage from "./pages/GranjaLoteNuevoPage";
import GranjaCargaDatosPage from "./pages/GranjaCargaDatosPage";
import VentasGranjaPage from "./pages/VentasGranjaPage";
import GranjaRemitosPage from "./pages/GranjaRemitosPage";
import GranjaHistorialPage from "./pages/GranjaHistorialPage";
import OrdenCargaListPage from "./pages/OrdenCargaListPage";
import OrdenCargaDetallePage from "./pages/OrdenCargaDetallePage";
import RecepcionOrdenCargaPage from "./pages/RecepcionOrdenCargaPage";
import CtaCteGranjaPage from "./pages/CtaCteGranjaPage";
import RecepcionRemitosPage from "./pages/RecepcionRemitosPage";
import HistorialAccesosPage from "./pages/HistorialAccesosPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública - Login */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Rutas protegidas - Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Clientes */}
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <ClientesPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Personal */}
        <Route
          path="/personal"
          element={
            <ProtectedRoute>
              <PersonalPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Facturación */}
        <Route
          path="/facturacion"
          element={
            <ProtectedRoute>
              <FacturasListPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Crear Factura */}
        <Route
          path="/facturacion/crear"
          element={
            <ProtectedRoute>
              <FacturacionPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Cobros */}
        <Route
          path="/cobros"
          element={
            <ProtectedRoute>
              <CobrosListPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Registrar Cobro */}
        <Route
          path="/cobros/registrar"
          element={
            <ProtectedRoute>
              <CobrosCreatePage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Cuenta Corriente Clientes */}
        <Route
          path="/cta-cte-clientes"
          element={
            <ProtectedRoute>
              <CtaCteClientesPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Caja */}
        <Route
          path="/caja"
          element={
            <ProtectedRoute>
              <CajaPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Granja */}
        <Route
          path="/frigorifico"
          element={
            <ProtectedRoute>
              <GranjaDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/frigorifico/lotes/nuevo"
          element={
            <ProtectedRoute>
              <LoteCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/frigorifico/pedidos-granja"
          element={
            <ProtectedRoute>
              <PedidosGranjaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/frigorifico/ventas"
          element={
            <ProtectedRoute>
              <VentasPolloPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/listas-precios"
          element={
            <ProtectedRoute>
              <ListasPreciosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/frigorifico/envios"
          element={
            <ProtectedRoute>
              <EnvioCamaraPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/frigorifico/ordenes-retiro"
          element={
            <ProtectedRoute>
              <OrdenesRetiroPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/frigorifico/decomisados"
          element={
            <ProtectedRoute>
              <DecomisadosPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Camiones */}
        <Route
          path="/camiones"
          element={
            <ProtectedRoute>
              <CamionesPage />
            </ProtectedRoute>
          }
        />

        {/* Rutas protegidas - Granja (Crianza) */}
        <Route
          path="/granja/galpones"
          element={
            <ProtectedRoute>
              <GranjaLotesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/granja/galpones/nuevo"
          element={
            <ProtectedRoute>
              <GranjaLoteNuevoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/granja/cargar-datos"
          element={
            <ProtectedRoute>
              <GranjaCargaDatosPage />
            </ProtectedRoute>
          }
        />

        <Route path="/granja/historial" element={<ProtectedRoute><GranjaHistorialPage /></ProtectedRoute>} />
        <Route path="/granja/ordenes-carga" element={<ProtectedRoute><OrdenCargaListPage /></ProtectedRoute>} />
        <Route path="/granja/ordenes-carga/:id" element={<ProtectedRoute><OrdenCargaDetallePage /></ProtectedRoute>} />
        <Route path="/granja/recepcion-ordenes" element={<ProtectedRoute><RecepcionOrdenCargaPage /></ProtectedRoute>} />
        <Route path="/granja/cta-cte" element={<ProtectedRoute><CtaCteGranjaPage /></ProtectedRoute>} />
        <Route path="/granja/ventas" element={<ProtectedRoute><VentasGranjaPage /></ProtectedRoute>} />
        <Route path="/granja/remitos" element={<ProtectedRoute><GranjaRemitosPage /></ProtectedRoute>} />
        <Route path="/frigorifico/recepcion" element={<ProtectedRoute><RecepcionRemitosPage /></ProtectedRoute>} />

        {/* Historial de Accesos (superadmin) */}
        <Route
          path="/frigorifico/historial-accesos"
          element={
            <ProtectedRoute>
              <HistorialAccesosPage />
            </ProtectedRoute>
          }
        />

        {/* Redirección por defecto */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Ruta 404 - Página no encontrada */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
