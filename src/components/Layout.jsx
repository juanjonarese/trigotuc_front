import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/DashboardPage.css";
import usePushNotification from "../hooks/usePushNotification";

// Qué sección del sidebar le corresponde a una ruta (null = ninguna).
const seccionDeRuta = (path) => {
  if (
    path.startsWith("/clientes") ||
    path.startsWith("/personal") ||
    path.startsWith("/camiones")
  ) {
    return "altas";
  }
  if (path.startsWith("/frigorifico") && path !== "/frigorifico/historial-accesos") {
    return "frigorifico";
  }
  if (
    path.startsWith("/granja") &&
    !path.startsWith("/granja/cobros") &&
    !path.startsWith("/granja/cta-cte")
  ) {
    return "granja";
  }
  if (path.startsWith("/reproductores")) return "reproductores";
  return null;
};

const Layout = ({ children }) => {
  const { estado, activar, rolHabilitado } = usePushNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Acordeón: una sola sección abierta a la vez ("altas" | "granja" |
  // "reproductores" | "frigorifico" | null).
  const [seccionAbierta, setSeccionAbierta] = useState(() =>
    seccionDeRuta(location.pathname)
  );
  const rolUsuario = localStorage.getItem("rolUsuario");

  // Auto-expand: al cambiar de ruta se abre la sección que le corresponde
  // (y se cierra la anterior). Ajuste de estado durante el render, no en un
  // efecto: https://react.dev/learn/you-might-not-need-an-effect
  const [rutaPrevia, setRutaPrevia] = useState(location.pathname);
  if (rutaPrevia !== location.pathname) {
    setRutaPrevia(location.pathname);
    const seccion = seccionDeRuta(location.pathname);
    if (seccion) setSeccionAbierta(seccion);
  }

  // Abre la sección y cierra la que estuviera abierta; si ya está abierta, cierra.
  const toggleSeccion = (seccion) =>
    setSeccionAbierta((actual) => (actual === seccion ? null : seccion));

  // Helper function to check if a route is active
  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <aside
        className={`sidebar bg-dark text-white ${sidebarOpen ? "show" : ""}`}
      >
        <div className="sidebar-header p-4 border-bottom border-secondary">
          <h2 className="h4 mb-0">
            <span className="d-block fw-bold">
              Trigotuc <span style={{ color: "#ffc107" }}>Avícola</span>
            </span>
          </h2>
        </div>

        <nav className="sidebar-nav flex-grow-1 p-3">
          {rolUsuario !== "frigorifico" && rolUsuario !== "granja" && rolUsuario !== "chofer" && (
            <a
              href="#"
              className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
                isActive("/dashboard") ? "text-white" : "text-white-50"
              }`}
              onClick={(e) => {
                e.preventDefault();
                navigate("/dashboard");
              }}
            >
              <i className="bi bi-house-door fs-5"></i>
              <span>Panel Principal</span>
            </a>
          )}

          {/* Proyección vive dentro de Reproductores: es el cruce de los
              nacimientos contra los galpones de engorde. */}

          {(rolUsuario === "superadmin" || rolUsuario === "administracion_frigorifico" || rolUsuario === "administracion_granja") && (
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => {
                e.preventDefault();
                toggleSeccion("altas");
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-person-plus fs-5"></i>
                <span>Altas</span>
              </div>
              <i
                className={`bi bi-chevron-${seccionAbierta === "altas" ? "down" : "right"}`}
              ></i>
            </a>

            {/* Submenu de Altas */}
            {seccionAbierta === "altas" && (
              <div className="ps-4 mt-2">
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    isActive("/clientes") ? "text-white" : "text-white-50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/clientes");
                  }}
                >
                  <i className="bi bi-person-badge"></i>
                  <span>Clientes</span>
                </a>
                {rolUsuario === "superadmin" && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/personal") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/personal");
                    }}
                  >
                    <i className="bi bi-person-gear"></i>
                    <span>Usuarios</span>
                  </a>
                )}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded ${
                    isActive("/camiones") ? "text-white" : "text-white-50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/camiones");
                  }}
                >
                  <i className="bi bi-truck"></i>
                  <span>Camiones</span>
                </a>
              </div>
            )}
          </div>
          )}

          {/* Contable Granja — comentado temporalmente
          {(rolUsuario === "superadmin" || rolUsuario === "administracion") && (
          <div className="nav-section mb-2">
            ...Contable Granja...
          </div>
          )}
          */}

          {/* Contable Frigorifico — comentado temporalmente
          {(rolUsuario === "superadmin" || rolUsuario === "administracion") && (
          <div className="nav-section mb-2">
            ...Contable Frigorifico...
          </div>
          )}
          */}

          {rolUsuario === "superadmin" && (
            <a
              href="#"
              className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
                isActive("/frigorifico/historial-accesos") ? "text-white" : "text-white-50"
              }`}
              onClick={(e) => { e.preventDefault(); navigate("/frigorifico/historial-accesos"); }}
            >
              <i className="bi bi-clock-history fs-5"></i>
              <span>Actividad</span>
            </a>
          )}


          {/* Granja (crianza) */}
          {(rolUsuario === "superadmin" || rolUsuario === "administracion_granja" || rolUsuario === "granja") && (
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => { e.preventDefault(); toggleSeccion("granja"); }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-house-door fs-5"></i>
                <span>Granja</span>
              </div>
              <i className={`bi bi-chevron-${seccionAbierta === "granja" ? "down" : "right"}`}></i>
            </a>
            {seccionAbierta === "granja" && (
              <div className="ps-4 mt-2">
                {/* 1 — Ingreso de pollitos */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/galpones/nuevo") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/galpones/nuevo"); }}
                >
                  <i className="bi bi-plus-circle"></i>
                  <span>Ingreso de pollitos</span>
                </a>
                {/* 2 — Galpones */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/galpones") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/galpones"); }}
                >
                  <i className="bi bi-list-ul"></i>
                  <span>Galpones</span>
                </a>
                {/* 2b — Movimientos por Galpón (solo superadmin) */}
                {rolUsuario === "superadmin" && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/movimientos") ? "text-white" : "text-white-50"}`}
                    onClick={(e) => { e.preventDefault(); navigate("/granja/movimientos"); }}
                  >
                    <i className="bi bi-clock-history"></i>
                    <span>Movimientos por Galpón</span>
                  </a>
                )}
                {/* 3 — Datos Semanales */}
                {(rolUsuario === "superadmin" || rolUsuario === "granja") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/cargar-datos") ? "text-white" : "text-white-50"}`}
                    onClick={(e) => { e.preventDefault(); navigate("/granja/cargar-datos"); }}
                  >
                    <i className="bi bi-pencil-square"></i>
                    <span>Datos Semanales</span>
                  </a>
                )}
                {/* 4 — Órdenes de Carga */}
                {(rolUsuario === "superadmin" || rolUsuario === "administracion_granja") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/ordenes-carga") ? "text-white" : "text-white-50"}`}
                    onClick={(e) => { e.preventDefault(); navigate("/granja/ordenes-carga"); }}
                  >
                    <i className="bi bi-file-earmark-text align-self-start mt-1"></i>
                    <span className="d-flex flex-column" style={{ lineHeight: 1.3 }}>
                      <span>Órdenes de Carga</span>
                      <span className="text-center">(Venta)</span>
                    </span>
                  </a>
                )}
                {/* 5 — Recepción de Órdenes */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/recepcion-ordenes") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/recepcion-ordenes"); }}
                >
                  <i className="bi bi-box-arrow-in-down align-self-start mt-1"></i>
                  <span>Recepción de Órdenes</span>
                </a>
              </div>
            )}
          </div>
          )}

          {/* Reproductores (postura + incubación) — sección hermana de Granja y Frigorífico.
              Por ahora solo superadmin: cuando se definan los roles del módulo, agregarlos acá. */}
          {rolUsuario === "superadmin" && (
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => { e.preventDefault(); toggleSeccion("reproductores"); }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-egg fs-5"></i>
                <span>Reproductoras</span>
              </div>
              <i className={`bi bi-chevron-${seccionAbierta === "reproductores" ? "down" : "right"}`}></i>
            </a>
            {seccionAbierta === "reproductores" && (
              <div className="ps-4 mt-2">
                {/* 1 — Ingreso de Lote */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/galpones/nuevo") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/galpones/nuevo"); }}
                >
                  <i className="bi bi-plus-circle"></i>
                  <span>Ingreso de Lote</span>
                </a>
                {/* 2 — Galpones */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${location.pathname === "/reproductores/galpones" ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/galpones"); }}
                >
                  <i className="bi bi-list-ul"></i>
                  <span>Galpones</span>
                </a>
                {/* 3 — Datos Semanales (mortandad y peso por sexo) */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/datos-semanales") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/datos-semanales"); }}
                >
                  <i className="bi bi-pencil-square"></i>
                  <span>Datos Semanales</span>
                </a>
                {/* 4 — Recolección de Huevos */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/recoleccion") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/recoleccion"); }}
                >
                  <i className="bi bi-basket"></i>
                  <span>Recolección de Huevos</span>
                </a>
                {/* 5 — Incubadora */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/incubadora") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/incubadora"); }}
                >
                  <i className="bi bi-thermometer-half"></i>
                  <span>Incubadora</span>
                </a>
                {/* 6 — Reserva de Pollitos (reparto por tanda, antes de que nazcan) */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/reserva-pollitos") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/reserva-pollitos"); }}
                >
                  <i className="bi bi-graph-up-arrow"></i>
                  <span>Proyección</span>
                </a>
                {/* 7 — Asignaciones: lo que ya tiene destino (clientes y galpones) */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/asignaciones") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/asignaciones"); }}
                >
                  <i className="bi bi-list-check"></i>
                  <span>Asignaciones</span>
                </a>
                {/* 8 — Stock de huevos de descarte + salidas sin cliente */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/stock-huevos") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/stock-huevos"); }}
                >
                  <i className="bi bi-egg"></i>
                  <span>Stock de Huevos</span>
                </a>
                {/* 8 y 9 — Venta de Huevos y Venta de Pollitos: ocultas por ahora,
                    el cliente todavía no las va a usar. Las páginas siguen existiendo.
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/ventas-huevos") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/ventas-huevos"); }}
                >
                  <i className="bi bi-cash-coin"></i>
                  <span>Venta de Huevos</span>
                </a>
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/reproductores/ventas-pollitos") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/reproductores/ventas-pollitos"); }}
                >
                  <i className="bi bi-cash-stack"></i>
                  <span>Venta de Pollitos</span>
                </a>
                */}
              </div>
            )}
          </div>
          )}

          {/* Frigorifico */}
          {rolUsuario !== "granja" && rolUsuario !== "chofer" && (
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => {
                e.preventDefault();
                toggleSeccion("frigorifico");
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-snow fs-5"></i>
                <span>Frigorífico</span>
              </div>
              <i
                className={`bi bi-chevron-${seccionAbierta === "frigorifico" ? "down" : "right"}`}
              ></i>
            </a>

            {seccionAbierta === "frigorifico" && (
              <div className="ps-4 mt-2">
                {/* 1 — Pedidos a Granja */}
                {(rolUsuario === "superadmin" || rolUsuario === "frigorifico") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/pedidos-granja") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/pedidos-granja"); }}
                  >
                    <i className="bi bi-clipboard2-check"></i>
                    <span>Pedidos a Granja</span>
                  </a>
                )}
                {/* 2 — Faenar */}
                {(rolUsuario === "superadmin" || rolUsuario === "frigorifico") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/lotes/nuevo") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/lotes/nuevo"); }}
                  >
                    <i className="bi bi-plus-circle"></i>
                    <span>Faenar</span>
                  </a>
                )}
                {/* 3 — Stock */}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    isActive("/frigorifico") && location.pathname === "/frigorifico"
                      ? "text-white"
                      : "text-white-50"
                  }`}
                  onClick={(e) => { e.preventDefault(); navigate("/frigorifico"); }}
                >
                  <i className="bi bi-bar-chart"></i>
                  <span>Stock</span>
                </a>
                {/* 4 — Órdenes de Carga - Venta (administración emite) */}
                {(rolUsuario === "superadmin" || rolUsuario === "administracion_frigorifico") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/ordenes-carga") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/ordenes-carga"); }}
                  >
                    <i className="bi bi-clipboard2-check align-self-start mt-1"></i>
                    <span className="d-flex flex-column" style={{ lineHeight: 1.3 }}>
                      <span>Órdenes de Carga</span>
                      <span className="text-center">(Venta)</span>
                    </span>
                  </a>
                )}
                {/* 5 — Recepción de Órdenes (frigorifico confirma) */}
                {(rolUsuario === "superadmin" || rolUsuario === "frigorifico" || rolUsuario === "camaras" || rolUsuario === "administracion_frigorifico") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/recepcion") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/recepcion"); }}
                  >
                    <i className="bi bi-box-arrow-in-down align-self-start mt-1"></i>
                    <span>Recepción de Órdenes</span>
                  </a>
                )}
                {/* 6 — Envío Cámara */}
                {(rolUsuario === "superadmin" || rolUsuario === "administracion_frigorifico") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/envios") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/envios"); }}
                  >
                    <i className="bi bi-truck"></i>
                    <span>Envío Cámara</span>
                  </a>
                )}
                {/* 6b — Salida Mostrador (descuenta Trigotuc) */}
                {(rolUsuario === "superadmin" || rolUsuario === "administracion_frigorifico" || rolUsuario === "administracion_granja") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/salida-mostrador") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/salida-mostrador"); }}
                  >
                    <i className="bi bi-shop"></i>
                    <span>Salida Mostrador</span>
                  </a>
                )}
                {/* 6c — Recepción de Cámara (granja recibe envíos a Trigotuc) */}
                {(rolUsuario === "superadmin" || rolUsuario === "administracion_granja") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/recepcion-camara") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/recepcion-camara"); }}
                  >
                    <i className="bi bi-box-arrow-in-down"></i>
                    <span>Recepción de Cámara</span>
                  </a>
                )}
                {/* 7 — Stock Empaque */}
                {(rolUsuario === "superadmin" || rolUsuario === "administracion_frigorifico") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/stock-empaque") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => { e.preventDefault(); navigate("/frigorifico/stock-empaque"); }}
                  >
                    <i className="bi bi-box-seam"></i>
                    <span>Stock Empaque</span>
                  </a>
                )}

                {/* Decomisados — comentado temporalmente
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    location.pathname === "/frigorifico/decomisados" ? "text-white" : "text-white-50"
                  }`}
                  onClick={(e) => { e.preventDefault(); navigate("/frigorifico/decomisados"); }}
                >
                  <i className="bi bi-x-octagon"></i>
                  <span>Decomisados</span>
                </a>
                */}
              </div>
            )}
          </div>
          )}

        </nav>

        <div className="border-top border-secondary p-3">
          <button
            onClick={handleLogout}
            className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
          >
            <i className="bi bi-box-arrow-right"></i>
            Cerrar sesión
          </button>
        </div>

      </aside>

      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="main-header bg-white shadow-sm sticky-top">
          <div className="container-fluid">
            <div className="row align-items-center py-2">
              <div className="col d-flex align-items-center gap-2">
                <button
                  className="btn btn-link d-lg-none p-0 text-dark"
                  onClick={toggleSidebar}
                >
                  <i className="bi bi-list fs-3"></i>
                </button>
                <button
                  className="btn btn-link p-0 text-secondary"
                  title="Actualizar"
                  onClick={() => window.location.reload()}
                  style={{ lineHeight: 1 }}
                >
                  <i className="bi bi-arrow-clockwise fs-5"></i>
                </button>
              </div>
              <div className="col-auto">
                <div className="d-flex align-items-center gap-2">
                  <div className="user-avatar bg-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0">
                    <i className="bi bi-person-fill text-white"></i>
                  </div>
                  <span className="fw-semibold text-truncate d-none d-sm-inline" style={{ maxWidth: "180px" }}>
                    {localStorage.getItem("nombreUsuario") || localStorage.getItem("emailUsuario") || "Usuario"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Banner notificaciones */}
        {rolHabilitado && estado === "default" && (
          <div className="d-flex align-items-center gap-2 px-3 py-2"
            style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a", fontSize: "0.85rem" }}>
            <i className="bi bi-bell text-warning fs-5 flex-shrink-0"></i>
            <span className="text-dark flex-grow-1">
              Activá las notificaciones para recibir alertas de nuevas órdenes.
            </span>
            <button className="btn btn-warning btn-sm py-1 flex-shrink-0" onClick={activar}>
              Activar
            </button>
          </div>
        )}

        {/* Page Content */}
        <div className="page-content p-2 p-md-4">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
