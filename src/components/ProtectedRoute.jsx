import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, blockedEmails = [] }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const emailUsuario = localStorage.getItem("emailUsuario");

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (blockedEmails.length > 0 && blockedEmails.includes(emailUsuario)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
