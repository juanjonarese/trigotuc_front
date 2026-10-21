import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "../css/Login.css";
import { inicioEmpresa, obtenerEmpresasUsuario } from "../utils/empresas";

// Selección de empresa (2026-10-16): el usuario con más de una empresa del
// grupo elige acá en cuál entra. Con una sola no tiene sentido: va directo.
// Misma línea que el login: fondo oscuro, panel blanco, rótulos sobrios.
const InicioPage = () => {
  const navigate = useNavigate();
  const rolUsuario = localStorage.getItem("rolUsuario");
  const nombre = localStorage.getItem("nombreUsuario");
  const empresas = obtenerEmpresasUsuario();

  if (empresas.length <= 1) {
    return <Navigate to={inicioEmpresa(empresas[0]?.clave, rolUsuario)} replace />;
  }

  const entrar = (clave) => {
    localStorage.setItem("empresaActual", clave);
    navigate(inicioEmpresa(clave, rolUsuario));
  };

  const salir = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="login-wrapper d-flex align-items-center justify-content-center px-3 py-5">
      <div className="card login-card shadow-lg w-100" style={{ maxWidth: "460px" }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <img
              src="/logo_trigotuc.png"
              alt="Logo Trigotuc"
              style={{ maxWidth: "160px", width: "100%", height: "auto" }}
            />
          </div>

          {nombre && <p className="text-center text-muted mb-4">Hola, {nombre}</p>}

          <div className="text-muted small fw-semibold mb-2">SELECCIONÁ LA EMPRESA</div>
          <div className="selector-empresas">
            {empresas.map((e) => (
              <button
                key={e.clave}
                type="button"
                className="selector-empresa"
                onClick={() => entrar(e.clave)}
              >
                <span className="d-flex justify-content-between align-items-baseline gap-2">
                  <span className="fw-semibold text-dark">{e.nombre}</span>
                  {e.enDesarrollo && (
                    <span className="selector-empresa-estado">EN DESARROLLO</span>
                  )}
                </span>
                <span className="d-block small text-muted mt-1">{e.descripcion}</span>
              </button>
            ))}
          </div>

          <div className="text-center mt-4">
            <button type="button" className="btn btn-link btn-sm text-muted text-decoration-none" onClick={salir}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InicioPage;
