import React from "react";

// Menú de Forratuc (local de venta al público, en desarrollo): su inicio, el
// mostrador (presupuestos), el stock, las cuentas corrientes, las listas de
// precios, el cierre de caja y las salidas sueltas. Lo
// elige `Layout` según la empresa actual; `grupo` son los ítems del grupo
// (Altas, Actividad), que salen en todas las empresas.
const MenuForratuc = ({ ctx, grupo }) => {
  const { navigate, location, isActive } = ctx;
  return (
    <>
          <a
            href="#"
            className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
              location.pathname === "/forratuc" ? "text-white" : "text-white-50"
            }`}
            onClick={(e) => { e.preventDefault(); navigate("/forratuc"); }}
          >
            <i className="bi bi-house-door fs-5"></i>
            <span>Inicio</span>
          </a>
          <a
            href="#"
            className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
              isActive("/forratuc/mostrador") ? "text-white" : "text-white-50"
            }`}
            onClick={(e) => { e.preventDefault(); navigate("/forratuc/mostrador"); }}
          >
            <i className="bi bi-receipt fs-5"></i>
            <span>Ventas</span>
          </a>
          <a
            href="#"
            className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
              isActive("/forratuc/stock") ? "text-white" : "text-white-50"
            }`}
            onClick={(e) => { e.preventDefault(); navigate("/forratuc/stock"); }}
          >
            <i className="bi bi-boxes fs-5"></i>
            <span>Stock</span>
          </a>
          <a
            href="#"
            className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
              isActive("/forratuc/cuentas-corrientes") ? "text-white" : "text-white-50"
            }`}
            onClick={(e) => { e.preventDefault(); navigate("/forratuc/cuentas-corrientes"); }}
          >
            <i className="bi bi-journal-text fs-5"></i>
            <span>Cuentas corrientes</span>
          </a>
          <a
            href="#"
            className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
              isActive("/forratuc/listas-precios") ? "text-white" : "text-white-50"
            }`}
            onClick={(e) => { e.preventDefault(); navigate("/forratuc/listas-precios"); }}
          >
            <i className="bi bi-tags fs-5"></i>
            <span>Listas de precios</span>
          </a>
          <a
            href="#"
            className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
              isActive("/forratuc/caja") ? "text-white" : "text-white-50"
            }`}
            onClick={(e) => { e.preventDefault(); navigate("/forratuc/caja"); }}
          >
            <i className="bi bi-cash-stack fs-5"></i>
            <span>Cierre de caja</span>
          </a>
          <a
            href="#"
            className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
              isActive("/forratuc/salidas") ? "text-white" : "text-white-50"
            }`}
            onClick={(e) => { e.preventDefault(); navigate("/forratuc/salidas"); }}
          >
            <i className="bi bi-shop fs-5"></i>
            <span>Salidas de stock</span>
          </a>

      {grupo}
    </>
  );
};

export default MenuForratuc;
