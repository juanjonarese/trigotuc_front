import React from "react";

// Menú de Forratuc (local de venta al público, en desarrollo). Orden pedido por
// el usuario (2026-10-30): inicio, stock, ventas (presupuestos), cierre de caja,
// cuentas corrientes, pagos y listas de precios. La Salida de stock suelta se
// sacó de acá: sigue en la avícola (Salida Mostrador). Lo elige `Layout` según
// la empresa actual; `grupo` son los ítems del grupo (Altas, Actividad), que
// salen en todas las empresas.
const ITEMS = [
  { ruta: "/forratuc/stock", icono: "bi-boxes", texto: "Stock" },
  { ruta: "/forratuc/mostrador", icono: "bi-receipt", texto: "Ventas" },
  { ruta: "/forratuc/caja", icono: "bi-cash-stack", texto: "Cierre de caja" },
  { ruta: "/forratuc/cuentas-corrientes", icono: "bi-journal-text", texto: "Cuentas corrientes" },
  { ruta: "/forratuc/pagos", icono: "bi-cash-coin", texto: "Pagos" },
  { ruta: "/forratuc/listas-precios", icono: "bi-tags", texto: "Listas de precios" },
];

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
          {ITEMS.map((it) => (
            <a
              key={it.ruta}
              href="#"
              className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${
                isActive(it.ruta) ? "text-white" : "text-white-50"
              }`}
              onClick={(e) => { e.preventDefault(); navigate(it.ruta); }}
            >
              <i className={`bi ${it.icono} fs-5`}></i>
              <span>{it.texto}</span>
            </a>
          ))}

      {grupo}
    </>
  );
};

export default MenuForratuc;
