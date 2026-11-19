import React, { useEffect, useState } from "react";
import { obtenerSolicitudesEdicionForratuc } from "../../services/api";

// Menú de Forratuc (local de venta al público, en desarrollo). Orden pedido por
// el usuario (2026-10-30): inicio, stock, ventas (presupuestos), cierre de caja,
// cuentas corrientes, pagos y listas de precios. La Salida de stock suelta se
// sacó de acá: sigue en la avícola (Salida Mostrador). Lo elige `Layout` según
// la empresa actual; `grupo` son los ítems del grupo (Altas, Actividad), que
// salen en todas las empresas.
const ITEMS = [
  { ruta: "/forratuc/stock", icono: "bi-boxes", texto: "Stock" },
  { ruta: "/forratuc/mostrador", icono: "bi-receipt", texto: "Presupuestos" },
  { ruta: "/forratuc/caja", icono: "bi-cash-stack", texto: "Cierre de caja" },
  { ruta: "/forratuc/cuentas-corrientes", icono: "bi-journal-text", texto: "Cuentas corrientes" },
  { ruta: "/forratuc/pagos", icono: "bi-cash-coin", texto: "Pagos" },
  { ruta: "/forratuc/listas-precios", icono: "bi-tags", texto: "Listas de precios" },
  { ruta: "/forratuc/productos", icono: "bi-upc", texto: "Productos" },
  // Planta de alimento (2026-11-04): materia prima, fórmulas, elaboración y envíos.
  // Solo superadmin: Forratuc se liberó el 2026-11-11 sin la Planta.
  { ruta: "/forratuc/planta", icono: "bi-gear-wide-connected", texto: "Planta de alimento", soloSuperadmin: true },
  // Producción de la forrajería (2026-11-19, en desarrollo): depósito, órdenes
  // de carga y dosificación. La ven el superadmin y el rol `produccion`.
  { ruta: "/forratuc/produccion", icono: "bi-building-gear", texto: "Producción", soloSuperadmin: true },
];

const MenuForratuc = ({ ctx, grupo }) => {
  const { navigate, location, isActive } = ctx;
  // Pedidos de edición de presupuestos esperando al superadmin (2026-11-12):
  // el número al lado de "Presupuestos", por si no tiene las notificaciones prendidas.
  const esSuperadmin = localStorage.getItem("rolUsuario") === "superadmin";
  const [pedidos, setPedidos] = useState(0);
  useEffect(() => {
    if (!esSuperadmin) return undefined;
    let vigente = true;
    const leer = () =>
      obtenerSolicitudesEdicionForratuc("pendiente")
        .then((l) => vigente && setPedidos(Array.isArray(l) ? l.length : 0))
        .catch(() => {});
    leer();
    const t = setInterval(leer, 60000);
    return () => { vigente = false; clearInterval(t); };
  }, [esSuperadmin, location.pathname]);
  // El rol de producción ve solo su pantalla (sin Inicio ni lo de ventas).
  if (localStorage.getItem("rolUsuario") === "produccion") {
    return (
      <>
        <a href="#" className={`nav-link d-flex align-items-center gap-2 mb-2 rounded ${isActive("/forratuc/produccion") ? "text-white" : "text-white-50"}`}
          onClick={(e) => { e.preventDefault(); navigate("/forratuc/produccion"); }}>
          <i className="bi bi-building-gear fs-5"></i>
          <span>Producción</span>
        </a>
        {grupo}
      </>
    );
  }
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
          {ITEMS.filter((it) => !it.soloSuperadmin || localStorage.getItem("rolUsuario") === "superadmin").map((it) => (
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
              {it.ruta === "/forratuc/mostrador" && pedidos > 0 && (
                <span className="badge rounded-pill bg-warning text-dark ms-auto" title="Pedidos de edición para autorizar">{pedidos}</span>
              )}
            </a>
          ))}

      {grupo}
    </>
  );
};

export default MenuForratuc;
