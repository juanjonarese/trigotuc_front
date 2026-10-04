import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import BotonExcel from "../components/BotonExcel";
import { obtenerMovimientosHuevos } from "../services/api";
import { formatearFechaLocal, formatearHoraLocal } from "../utils/dateUtils";
import { formatearNumero, textoDesglose } from "../utils/reproductoresUtils";
import { exportarLibroExcel } from "../utils/exportarExcel";
import Swal from "sweetalert2";

// Stock de Huevos — el huevo que ya está en Trigotuc.
//
// Rediseño del 2026-10-04 (pedido del usuario: "no está muy claro"). El huevo de
// Trigotuc sale solo por dos caminos: a la incubadora (API) o por la venta de
// mostrador (consumo). Por eso:
//   · se sacó el botón "Sacar del stock" (las salidas sueltas sin cliente);
//   · arriba van los totales de cada stock;
//   · abajo, dos solapas con los movimientos como CUENTA CORRIENTE: qué entró,
//     qué salió y el saldo después de cada movimiento. Primero consumo, después
//     API.
// El saldo lo calcula el back anclado al stock de hoy (ver
// services/movimientosHuevos.services.js): el saldo de arriba de todo es
// siempre el stock real.

const POR_PAGINA = 20;

// Colores: los mismos que Remitos y Recepción de huevos (API verde, consumo azul).
const CUENTAS = [
  { key: "consumo", label: "Consumo", color: "primary", icono: "bi-egg", sale: "venta de mostrador" },
  { key: "api", label: "API", color: "success", icono: "bi-thermometer-half", sale: "incubadora" },
];

// Ícono de cada tipo de movimiento, para leer la columna de un vistazo.
const ICONO = {
  remito: "bi-truck",
  mostrador: "bi-shop",
  incubadora: "bi-thermometer-half",
  a_venta: "bi-arrow-left-right",
  inoculacion: "bi-recycle",
  salida: "bi-box-arrow-up",
  venta: "bi-receipt",
  saldo_inicial: "bi-flag",
};

// Una tarjeta por stock, apaisada: las dos juntas ocupan el ancho de la página
// y quedan bajas, con el total a la izquierda y los tipos en fila a la derecha.
const TarjetaTotal = ({ cuenta, total, huevosPorMaple }) => (
  <div className="col-12 col-md-6">
    <div className={`card shadow-sm h-100 border border-2 border-${cuenta.color}`}>
      <div className={`card-body bg-${cuenta.color}-subtle py-2 px-3`}>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="lh-sm">
            <div className={`fw-bold text-uppercase small text-${cuenta.color}`}>
              <i className={`bi ${cuenta.icono} me-1`}></i>
              {cuenta.label}
            </div>
            <div className={`h4 fw-bold mb-0 text-${cuenta.color}`}>
              {formatearNumero(total.disponible)}
            </div>
            <div className="text-muted" style={{ fontSize: ".72rem" }}>
              {cuenta.key === "consumo"
                ? `${formatearNumero(total.maples)} maples de ${huevosPorMaple}`
                : textoDesglose(total.disponible)}
            </div>
          </div>

          {total.porTipo?.length > 0 && (
            <div className="d-flex flex-wrap gap-2 flex-grow-1">
              {total.porTipo.map((t) => (
                <div className="border rounded bg-white px-2 py-1 lh-sm" key={t.tipo}>
                  <div className="text-muted" style={{ fontSize: ".7rem" }}>
                    {t.etiqueta}
                  </div>
                  <div className="fw-bold small">
                    {formatearNumero(t.cantidad)}
                    {cuenta.key === "consumo" && (
                      <span className="text-muted fw-normal" style={{ fontSize: ".7rem" }}>
                        {" "}
                        · {formatearNumero(t.maples)} maples
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {total.enViaje > 0 && (
          <div className="text-muted mt-1" style={{ fontSize: ".72rem" }}>
            <i className="bi bi-truck me-1"></i>
            + {formatearNumero(total.enViaje)} en viaje (remitos sin recibir, no cuentan todavía)
          </div>
        )}
      </div>
    </div>
  </div>
);

const CuentaCorriente = ({ cuenta, datos }) => {
  const [pagina, setPagina] = useState(1);
  const movs = datos?.movimientos || [];
  const visibles = movs.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const esUltimaPagina = pagina * POR_PAGINA >= movs.length;

  if (!movs.length)
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5 text-muted">
          <i className="bi bi-inbox fs-1 d-block mb-2"></i>
          Todavía no hay movimientos de {cuenta.label.toLowerCase()}.
        </div>
      </div>
    );

  return (
    <>
      <div className="d-flex flex-wrap gap-3 small mb-2">
        <span>
          <span className="text-muted">Entró </span>
          <strong className="text-success">{formatearNumero(datos.entradas)}</strong>
        </span>
        <span>
          <span className="text-muted">Salió </span>
          <strong className="text-danger">{formatearNumero(datos.salidas)}</strong>
        </span>
        <span>
          <span className="text-muted">Saldo </span>
          <strong className={`text-${cuenta.color}`}>{formatearNumero(datos.stockActual)}</strong>
        </span>
      </div>
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Detalle</th>
                <th className="text-end">Entra</th>
                <th className="text-end">Sale</th>
                <th className="text-end">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((m, i) => (
                <tr key={`${m.fecha}-${m.titulo}-${i}`}>
                  <td className="text-nowrap small">
                    {formatearFechaLocal(m.fecha)}
                    {!m.soloFecha && (
                      <span className="text-muted ms-1">{formatearHoraLocal(m.fecha)}</span>
                    )}
                  </td>
                  <td className="text-nowrap fw-semibold">
                    <i className={`bi ${ICONO[m.concepto] || "bi-dot"} me-1 text-muted`}></i>
                    {m.titulo}
                  </td>
                  <td className="small text-muted">{m.detalle}</td>
                  <td className="text-end text-success fw-semibold">
                    {m.entra ? `+${formatearNumero(m.entra)}` : ""}
                  </td>
                  <td className="text-end text-danger fw-semibold">
                    {m.sale ? `−${formatearNumero(m.sale)}` : ""}
                  </td>
                  <td className={`text-end fw-bold text-${cuenta.color}`}>
                    {formatearNumero(m.saldo)}
                  </td>
                </tr>
              ))}
              {/* El saldo con el que arranca la cuenta, al pie de la última
                  página: es lo que había antes del primer movimiento conocido. */}
              {esUltimaPagina && (
                <tr className="table-light">
                  <td></td>
                  <td colSpan={4} className="small text-muted fst-italic">
                    Saldo anterior
                  </td>
                  <td className="text-end fw-bold">{formatearNumero(datos.saldoAnterior)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        currentPage={pagina}
        totalItems={movs.length}
        itemsPerPage={POR_PAGINA}
        onPageChange={setPagina}
      />
    </>
  );
};

const StockHuevosPage = () => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [solapa, setSolapa] = useState("consumo");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setDatos(await obtenerMovimientosHuevos());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Excel: una hoja por cuenta corriente, igual que las dos solapas.
  const exportarExcel = () =>
    exportarLibroExcel({
      nombreArchivo: "Reproductoras_stock_huevos",
      hojas: CUENTAS.map((c) => ({
        nombre: c.label,
        filas: datos?.[c.key]?.movimientos || [],
        columnas: [
          { header: "Fecha", valor: (m) => formatearFechaLocal(m.fecha) },
          { header: "Hora", valor: (m) => (m.soloFecha ? "" : formatearHoraLocal(m.fecha)) },
          { header: "Movimiento", valor: (m) => m.titulo },
          { header: "Detalle", valor: (m) => m.detalle },
          { header: "Entra", valor: (m) => m.entra || 0 },
          { header: "Sale", valor: (m) => m.sale || 0 },
          { header: "Saldo", valor: (m) => m.saldo },
        ],
      })),
    });

  const cuentaActiva = CUENTAS.find((c) => c.key === solapa);

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-egg text-success me-2"></i>Stock de Huevos
            </h1>
            <p className="text-muted mb-0 small">
              El huevo que ya está en Trigotuc. El de consumo sale por la venta de mostrador; el
              API, por la incubadora.
            </p>
          </div>
          <div className="d-flex gap-2">
            <BotonExcel
              onClick={exportarExcel}
              disabled={loading || !datos}
              titulo="Descargar los movimientos"
            />
            <button className="btn btn-outline-secondary btn-sm" onClick={cargar} disabled={loading}>
              <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
            </button>
          </div>
        </div>

        {loading && !datos ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : !datos ? null : (
          <>
            <div className="row g-2 mb-3">
              {CUENTAS.map((c) => (
                <TarjetaTotal
                  key={c.key}
                  cuenta={c}
                  total={datos.totales[c.key]}
                  huevosPorMaple={datos.huevosPorMaple}
                />
              ))}
            </div>

            <ul className="nav nav-tabs mb-3">
              {CUENTAS.map((c) => (
                <li className="nav-item" key={c.key}>
                  <button
                    className={`nav-link ${solapa === c.key ? `active fw-semibold text-${c.color}` : ""}`}
                    onClick={() => setSolapa(c.key)}
                  >
                    <i className={`bi ${c.icono} me-1`}></i>
                    Movimientos de {c.key === "api" ? "API" : "consumo"}
                    <span className="badge bg-light text-dark border ms-1">
                      {datos[c.key]?.movimientos?.length || 0}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* `key` reinicia el paginador al cambiar de solapa. */}
            <CuentaCorriente key={solapa} cuenta={cuentaActiva} datos={datos[solapa]} />
          </>
        )}
      </div>
    </Layout>
  );
};

export default StockHuevosPage;
