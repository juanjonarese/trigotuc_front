import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../css/DashboardPage.css";
import usePushNotification from "../hooks/usePushNotification";
import AsistenteFlotante from "./AsistenteFlotante";
import { empresaActual as calcularEmpresaActual, inicioEmpresa, obtenerEmpresasUsuario } from "../utils/empresas";
import MenuAvicola from "./MenuAvicola";
import MenuForratuc from "./forratuc/MenuForratuc";

// El encabezado y el menú de cada empresa del grupo (2026-10-26). Una empresa
// nueva suma su entrada acá; los ítems del grupo (Altas, Actividad) los arma
// este Layout y cada menú decide dónde ubicarlos.
const MENUS = {
  avicola: {
    titulo: (
      <span className="d-block fw-bold">
        Trigotuc <span style={{ color: "#ffc107" }}>Avícola</span>
      </span>
    ),
    Menu: MenuAvicola,
  },
  forratuc: {
    titulo: <span className="d-block fw-bold">Forratuc</span>,
    Menu: MenuForratuc,
  },
};

// Qué sección del sidebar le corresponde a una ruta (null = ninguna).
const seccionDeRuta = (path) => {
  if (
    path.startsWith("/clientes") ||
    path.startsWith("/personal") ||
    path.startsWith("/camiones")
  ) {
    return "altas";
  }
  if (
    path.startsWith("/frigorifico") &&
    path !== "/frigorifico/historial-accesos" &&
    path !== "/frigorifico/salida-mostrador"
  ) {
    return "frigorifico";
  }
  if (
    path.startsWith("/granja") &&
    !path.startsWith("/granja/cobros") &&
    !path.startsWith("/granja/cta-cte")
  ) {
    return "granja";
  }
  if (path.startsWith("/reproductores") || path.startsWith("/alimento/silos")) return "reproductores";
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

  // `admin` (2026-09-21) es el superadmin operativo: ve lo mismo que el
  // superadmin salvo **Usuarios**, que es el único ítem que sigue preguntando
  // por `superadmin` a secas. Lo que no ve acá tampoco lo puede hacer: el
  // backend corta el alta de usuarios y el reset de Reproductoras.
  const mandaTodo = rolUsuario === "superadmin" || rolUsuario === "admin";

  // Multiempresa (2026-10-16): el menú es el de la empresa en la que estás.
  // Altas y Actividad son del grupo y salen en todas.
  const empresas = obtenerEmpresasUsuario();
  const claveEmpresa = calcularEmpresaActual(location.pathname);
  const { titulo, Menu } = MENUS[claveEmpresa] || MENUS.avicola;

  // Selector de empresa (2026-10-26): quien tiene más de una toca el nombre de
  // la empresa y pasa a la otra de un clic, directo a su pantalla de entrada.
  // Antes "Cambiar empresa" lo mandaba a las tarjetas de inicio: un paso de
  // más para quien trabaja en las dos el mismo día (vende pollo por orden de
  // carga en la avícola y alimento en Forratuc).
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const irAEmpresa = (clave) => {
    setSelectorAbierto(false);
    try { localStorage.setItem("empresaActual", clave); } catch { /* sin storage */ }
    navigate(inicioEmpresa(clave, rolUsuario));
  };

  // Auto-expand: al cambiar de ruta se abre la sección que le corresponde
  // (y se cierra la anterior). Ajuste de estado durante el render, no en un
  // efecto: https://react.dev/learn/you-might-not-need-an-effect
  const [rutaPrevia, setRutaPrevia] = useState(location.pathname);
  if (rutaPrevia !== location.pathname) {
    setRutaPrevia(location.pathname);
    setSelectorAbierto(false);
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
    // La conversación del asistente vive en sessionStorage: no tiene que verla
    // el próximo que entre en esta pestaña.
    try { sessionStorage.clear(); } catch { /* sin storage */ }
    navigate("/login");
  };

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <aside
        className={`sidebar bg-dark text-white ${sidebarOpen ? "show" : ""}`}
      >
        <div className="sidebar-header p-4 border-bottom border-secondary">
          {empresas.length > 1 ? (
            <>
              <button
                type="button"
                className="btn p-0 border-0 text-white text-start w-100 d-flex align-items-center justify-content-between gap-2"
                onClick={() => setSelectorAbierto((abierto) => !abierto)}
                aria-expanded={selectorAbierto}
                title="Cambiar de empresa"
              >
                <h2 className="h4 mb-0">{titulo}</h2>
                <i className={`bi bi-chevron-${selectorAbierto ? "up" : "down"} text-white-50`}></i>
              </button>
              {selectorAbierto && (
                <div className="mt-3">
                  <div className="small text-white-50 mb-1">Cambiar a</div>
                  {empresas
                    .filter((e) => e.clave !== claveEmpresa)
                    .map((e) => (
                      <button
                        key={e.clave}
                        type="button"
                        className="nav-link btn border-0 bg-transparent text-white-50 w-100 text-start d-flex align-items-center gap-2 rounded px-2 py-2"
                        onClick={() => irAEmpresa(e.clave)}
                      >
                        <i className="bi bi-arrow-left-right"></i>
                        <span>{e.nombre}</span>
                        {e.enDesarrollo && (
                          <span className="badge bg-warning text-dark ms-auto">en desarrollo</span>
                        )}
                      </button>
                    ))}
                </div>
              )}
            </>
          ) : (
            <h2 className="h4 mb-0">{titulo}</h2>
          )}
        </div>

        <nav className="sidebar-nav flex-grow-1 p-3">
          {/* Multiempresa: cada empresa tiene su menú (MENUS, arriba). Los
              ítems del grupo van adentro, donde cada menú los ubica. */}
          <Menu
            ctx={{ navigate, location, isActive, rolUsuario, mandaTodo, empresas, seccionAbierta, toggleSeccion }}
            grupo={
              <>
                {(mandaTodo || rolUsuario === "administracion_frigorifico" || rolUsuario === "administracion_granja") && (
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
                      {/* Usuarios es el ÚNICO ítem que el `admin` no ve: quién entra
                          al sistema y con qué rol lo decide solo el superadmin. El
                          backend lo corta igual (esSuperAdmin en /usuarios). */}
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
                {(mandaTodo || rolUsuario === "administracion") && (
                <div className="nav-section mb-2">
                  ...Contable Granja...
                </div>
                )}
                */}

                {/* Contable Frigorifico — comentado temporalmente
                {(mandaTodo || rolUsuario === "administracion") && (
                <div className="nav-section mb-2">
                  ...Contable Frigorifico...
                </div>
                )}
                */}

                {/* Actividad: solo superadmin. El log dice quién hizo cada cosa,
                    incluido el propio admin, así que mirarlo es del que audita.
                    El backend lo corta igual (esSuperAdmin en /auditoria). */}
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
              </>
            }
          />
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

      {/* Asistente de IA (2026-10-22): solo el superadmin, en todas las pantallas. */}
      {rolUsuario === "superadmin" && <AsistenteFlotante />}
    </div>
  );
};

export default Layout;
