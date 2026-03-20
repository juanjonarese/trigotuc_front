import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/DashboardPage.css";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [altasOpen, setAltasOpen] = useState(false);
  const [contableClientesOpen, setContableClientesOpen] = useState(false);
  const [granjaOpen, setGranjaOpen] = useState(false);
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

    // Contable Clientes submenu
    if (
      path === "/granja/ventas" ||
      path.startsWith("/cobros") ||
      path.startsWith("/cta-cte-clientes")
    ) {
      setContableClientesOpen(true);
    }

    // Granja submenu
    if (path.startsWith("/granja") && path !== "/granja/ventas") {
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
                {rolUsuario === "admin" && (
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

          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => {
                e.preventDefault();
                setContableClientesOpen(!contableClientesOpen);
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-cash-coin fs-5"></i>
                <span>Contable Clientes</span>
              </div>
              <i
                className={`bi bi-chevron-${
                  contableClientesOpen ? "down" : "right"
                }`}
              ></i>
            </a>

            {/* Submenu de Contable Clientes */}
            {contableClientesOpen && (
              <div className="ps-4 mt-2">
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    isActive("/granja/ventas") ? "text-white" : "text-white-50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/granja/ventas");
                  }}
                >
                  <i className="bi bi-cart3"></i>
                  <span>Ventas</span>
                </a>
                {/* Cobros y Cta Cte Clientes - No visibles para rol personal */}
                {rolUsuario !== "personal" && (
                <>
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    isActive("/cobros") ? "text-white" : "text-white-50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/cobros");
                  }}
                >
                  <i className="bi bi-cash-coin"></i>
                  <span>Cobros</span>
                </a>
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded ${
                    isActive("/cta-cte-clientes")
                      ? "text-white"
                      : "text-white-50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/cta-cte-clientes");
                  }}
                >
                  <i className="bi bi-journal-text"></i>
                  <span>Cta Cte Clientes</span>
                </a>
                </>
                )}
              </div>
            )}
          </div>

          {/* Granja - visible para todos */}
          <div className="nav-section mb-2">
            <a
              href="#"
              className="nav-link text-white-50 d-flex align-items-center justify-content-between rounded"
              onClick={(e) => {
                e.preventDefault();
                setGranjaOpen(!granjaOpen);
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-snow fs-5"></i>
                <span>Frigorífico</span>
              </div>
              <i
                className={`bi bi-chevron-${granjaOpen ? "down" : "right"}`}
              ></i>
            </a>

            {granjaOpen && (
              <div className="ps-4 mt-2">
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    isActive("/granja") && location.pathname === "/granja"
                      ? "text-white"
                      : "text-white-50"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/granja");
                  }}
                >
                  <i className="bi bi-bar-chart"></i>
                  <span>Stock</span>
                </a>
                {(rolUsuario === "admin" || rolUsuario === "granja") && (
                  <>
                    <a
                      href="#"
                      className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                        isActive("/granja/lotes/nuevo") ? "text-white" : "text-white-50"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/granja/lotes/nuevo");
                      }}
                    >
                      <i className="bi bi-plus-circle"></i>
                      <span>Nuevo Lote</span>
                    </a>
</>
                )}
                {(rolUsuario === "admin" || rolUsuario === "granja") && (
                  <a
                    href="#"
                    className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                      isActive("/granja/envios") ? "text-white" : "text-white-50"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/granja/envios");
                    }}
                  >
                    <i className="bi bi-truck"></i>
                    <span>Envío Cámara</span>
                  </a>
                )}

                {/* Decomisados — comentado temporalmente
                <a
                  href="#"
                  className={`nav-link d-flex align-items-center gap-2 rounded mb-1 ${
                    location.pathname === "/granja/decomisados" ? "text-white" : "text-white-50"
                  }`}
                  onClick={(e) => { e.preventDefault(); navigate("/granja/decomisados"); }}
                >
                  <i className="bi bi-x-octagon"></i>
                  <span>Decomisados</span>
                </a>
                */}
              </div>
            )}
          </div>

          {/* Comercial - solo admin */}
          {rolUsuario === "admin" && (
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

        <div className="p-3 border-top border-secondary">
          <button
            onClick={handleLogout}
            className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2"
          >
            <i className="bi bi-box-arrow-left"></i>
            SALIR
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
            <div className="row align-items-center py-3">
              <div className="col">
                <button
                  className="btn btn-link d-lg-none p-0 text-dark"
                  onClick={toggleSidebar}
                >
                  <i className="bi bi-list fs-3"></i>
                </button>
              </div>
              <div className="col-auto">
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted d-none d-sm-inline text-truncate" style={{ maxWidth: "200px" }}>
                    <strong>
                      {localStorage.getItem("emailUsuario") || "Usuario"}
                    </strong>
                  </span>
                  <div className="user-avatar bg-success rounded-circle d-flex align-items-center justify-content-center flex-shrink-0">
                    <i className="bi bi-person-fill text-white"></i>
                  </div>
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
