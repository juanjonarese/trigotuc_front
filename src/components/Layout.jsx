import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/DashboardPage.css";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [altasOpen, setAltasOpen] = useState(false);
  const [contableClientesOpen, setContableClientesOpen] = useState(false);
  const [frigorificoOpen, setFrigorificoOpen] = useState(false);
  const [granjaOpen, setGranjaOpen] = useState(false);
  const [contableGranjaOpen, setContableGranjaOpen] = useState(false);
  const [comercialOpen, setComercialOpen] = useState(false);
  const rolUsuario = localStorage.getItem("rolUsuario");

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

  // Auto-expand menus based on active route
  useEffect(() => {
    const path = location.pathname;

    // Altas submenu
    if (
      path.startsWith("/clientes") ||
      path.startsWith("/personal") ||
      path.startsWith("/camiones")
    ) {
      setAltasOpen(true);
    }

    // Contable Granja (top-level)
    if (
      path.startsWith("/granja/ventas") ||
      path.startsWith("/granja/ordenes-carga") ||
      path.startsWith("/granja/cobros") ||
      path.startsWith("/granja/cta-cte")
    ) {
      setContableGranjaOpen(true);
    }

    // Contable Frigorifico (top-level)
    if (
      path === "/frigorifico/ventas" ||
      path.startsWith("/cobros") ||
      path.startsWith("/cta-cte-clientes") ||
      path.startsWith("/facturacion")
    ) {
      setContableClientesOpen(true);
    }

    // Frigorifico submenu
    if (path.startsWith("/frigorifico") && path !== "/frigorifico/ventas" && path !== "/frigorifico/historial-accesos") {
      setFrigorificoOpen(true);
    }

    // Granja (crianza) submenu
    if (
      path.startsWith("/granja") &&
      !path.startsWith("/granja/cobros") &&
      !path.startsWith("/granja/cta-cte")
    ) {
      setGranjaOpen(true);
    }





    // Comercial submenu
    if (path.startsWith("/listas-precios")) {
      setComercialOpen(true);
    }

  }, [location.pathname]);

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
          {rolUsuario !== "frigorifico" && (
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

          {(rolUsuario === "superadmin" || rolUsuario === "administracion") && (
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => {
                e.preventDefault();
                setAltasOpen(!altasOpen);
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-person-plus fs-5"></i>
                <span>Altas</span>
              </div>
              <i
                className={`bi bi-chevron-${altasOpen ? "down" : "right"}`}
              ></i>
            </a>

            {/* Submenu de Altas */}
            {altasOpen && (
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

          {/* Historial de Accesos — comentado temporalmente
          {rolUsuario === "superadmin" && (
            <a
              href="#"
              className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
                isActive("/frigorifico/historial-accesos") ? "text-white" : "text-white-50"
              }`}
              onClick={(e) => { e.preventDefault(); navigate("/frigorifico/historial-accesos"); }}
            >
              <i className="bi bi-shield-lock fs-5"></i>
              <span>Historial de Accesos</span>
            </a>
          )}
          */}


          {/* Granja (crianza) */}
          {(rolUsuario === "superadmin" || rolUsuario === "frigorifico" || rolUsuario === "administracion") && (
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => { e.preventDefault(); setGranjaOpen(!granjaOpen); }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-house-door fs-5"></i>
                <span>Granja</span>
              </div>
              <i className={`bi bi-chevron-${granjaOpen ? "down" : "right"}`}></i>
            </a>
            {granjaOpen && (
              <div className="ps-4 mt-2">
                {(rolUsuario === "superadmin" || rolUsuario === "administracion") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/ordenes-carga") ? "text-white" : "text-white-50"}`}
                    onClick={(e) => { e.preventDefault(); navigate("/granja/ordenes-carga"); }}
                  >
                    <i className="bi bi-file-earmark-text"></i>
                    <span>Órdenes de Carga</span>
                  </a>
                )}
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/galpones/nuevo") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/galpones/nuevo"); }}
                >
                  <i className="bi bi-plus-circle"></i>
                  <span>Ingreso de pollitos</span>
                </a>
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/galpones") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/galpones"); }}
                >
                  <i className="bi bi-list-ul"></i>
                  <span>Galpones</span>
                </a>
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/cargar-datos") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/cargar-datos"); }}
                >
                  <i className="bi bi-pencil-square"></i>
                  <span>Datos Semanales</span>
                </a>
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${isActive("/granja/recepcion-ordenes") ? "text-white" : "text-white-50"}`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/recepcion-ordenes"); }}
                >
                  <i className="bi bi-box-arrow-in-down"></i>
                  <span>Recepción de Órdenes</span>
                </a>
              </div>
            )}
          </div>
          )}

          {/* Frigorifico - visible para todos */}
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => {
                e.preventDefault();
                setFrigorificoOpen(!frigorificoOpen);
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-snow fs-5"></i>
                <span>Frigorífico</span>
              </div>
              <i
                className={`bi bi-chevron-${frigorificoOpen ? "down" : "right"}`}
              ></i>
            </a>

            {frigorificoOpen && (
              <div className="ps-4 mt-2">
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    isActive("/frigorifico") && location.pathname === "/frigorifico"
                      ? "text-white"
                      : "text-white-50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/frigorifico");
                  }}
                >
                  <i className="bi bi-bar-chart"></i>
                  <span>Stock</span>
                </a>
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
                {(rolUsuario === "superadmin" || rolUsuario === "frigorifico" || rolUsuario === "administracion") && (
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
                {(rolUsuario === "superadmin" || rolUsuario === "frigorifico") && (
                  <>
                    <a
                      href="#"
                      className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                        isActive("/frigorifico/lotes/nuevo") ? "text-white" : "text-white-50"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/frigorifico/lotes/nuevo");
                      }}
                    >
                      <i className="bi bi-plus-circle"></i>
                      <span>Nuevo Lote</span>
                    </a>
                    <a
                      href="#"
                      className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                        isActive("/frigorifico/envios") ? "text-white" : "text-white-50"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/frigorifico/envios");
                      }}
                    >
                      <i className="bi bi-truck"></i>
                      <span>Envío Cámara</span>
                    </a>
                  </>
                )}
                {(rolUsuario === "superadmin" || rolUsuario === "frigorifico" || rolUsuario === "camaras") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/frigorifico/ordenes-retiro") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/frigorifico/ordenes-retiro");
                    }}
                  >
                    <i className="bi bi-box-arrow-right"></i>
                    <span>Entregas</span>
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

          {/* Comercial - superadmin y administracion */}
          {(rolUsuario === "superadmin" || rolUsuario === "administracion") && (
            <div className="nav-section mb-2">
              <a
                href="#"
                className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
                onClick={(e) => {
                  e.preventDefault();
                  setComercialOpen(!comercialOpen);
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-shop fs-5"></i>
                  <span>Comercial</span>
                </div>
                <i
                  className={`bi bi-chevron-${comercialOpen ? "down" : "right"}`}
                ></i>
              </a>

              {comercialOpen && (
                <div className="ps-4 mt-2">
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded ${
                      isActive("/listas-precios") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/listas-precios");
                    }}
                  >
                    <i className="bi bi-tags"></i>
                    <span>Listas de Precios</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </nav>

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
              <div className="col">
                <button
                  className="btn btn-link d-lg-none p-0 text-dark"
                  onClick={toggleSidebar}
                >
                  <i className="bi bi-list fs-3"></i>
                </button>
              </div>
              <div className="col-auto">
                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center gap-2">
                    <div className="user-avatar bg-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0">
                      <i className="bi bi-person-fill text-white"></i>
                    </div>
                    <span className="d-none d-sm-inline fw-semibold text-truncate" style={{ maxWidth: "180px" }}>
                      {localStorage.getItem("nombreUsuario") || localStorage.getItem("emailUsuario") || "Usuario"}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="btn btn-danger btn-sm d-flex align-items-center gap-1"
                    title="Cerrar sesión"
                  >
                    <i className="bi bi-box-arrow-right"></i>
                    <span className="d-none d-sm-inline">Salir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content p-2 p-md-4">{children}</div>
      </div>
    </div>
  );
};

export default Layout;
