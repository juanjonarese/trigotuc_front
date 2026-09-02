import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Roles acotados a un solo módulo: si la URL cae fuera de su prefijo, vuelven a
// su pantalla de inicio. Ocultar el ítem del sidebar no alcanza — la URL sigue
// siendo alcanzable desde una pestaña vieja, un favorito o el botón "atrás", y
// ahí la pantalla se abre y el back contesta 403 con un cartel feo.
// Los roles que no figuran acá no tienen restricción de ruta.
const MODULO_POR_ROL = {
  reproductoras: { prefijo: "/reproductores", inicio: "/reproductores/galpones" },
};

const ProtectedRoute = ({ children, blockedEmails = [] }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const emailUsuario = localStorage.getItem("emailUsuario");
  const rolUsuario = localStorage.getItem("rolUsuario");
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (blockedEmails.length > 0 && blockedEmails.includes(emailUsuario)) {
    return <Navigate to="/dashboard" replace />;
  }

  const modulo = MODULO_POR_ROL[rolUsuario];
  if (modulo && !location.pathname.startsWith(modulo.prefijo)) {
    return <Navigate to={modulo.inicio} replace />;
  }

  return children;
};

export default ProtectedRoute;
