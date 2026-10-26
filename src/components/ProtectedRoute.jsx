import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { puedeEntrarARuta, inicioUsuario } from "../utils/empresas";

// Roles acotados a un solo módulo: si la URL cae fuera de su prefijo, vuelven a
// su pantalla de inicio. Ocultar el ítem del sidebar no alcanza — la URL sigue
// siendo alcanzable desde una pestaña vieja, un favorito o el botón "atrás", y
// ahí la pantalla se abre y el back contesta 403 con un cartel feo.
// Los roles que no figuran acá no tienen restricción de ruta.
//
// Silos está en el sidebar de Reproductoras pero su ruta quedó en
// /alimento/silos: sin ese prefijo, el rol reproductoras tocaba "Silos" y lo
// devolvía a Galpones sin aviso (reclamo del cliente, 2026-10-07). Envío de
// alimento (/alimento/envios) NO va: despachar es de administración.
const MODULO_POR_ROL = {
  reproductoras: {
    prefijos: ["/reproductores", "/alimento/silos"],
    inicio: "/reproductores/galpones",
  },
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
  if (modulo && !modulo.prefijos.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to={modulo.inicio} replace />;
  }

  // Multiempresa (2026-10-26): una ruta de una empresa que el usuario no tiene
  // lo devuelve a su inicio. Mismo motivo que arriba: la URL se alcanza igual
  // desde un favorito o el "atrás". El back corta con `requiereEmpresa`.
  if (!puedeEntrarARuta(location.pathname)) {
    return <Navigate to={inicioUsuario(rolUsuario)} replace />;
  }

  return children;
};

export default ProtectedRoute;
