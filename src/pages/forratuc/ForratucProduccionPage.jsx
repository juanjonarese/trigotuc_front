import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import IngresoMercaderiaModal from "../../components/forratuc/IngresoMercaderiaModal";
import { Cuadro, TarjetaLugar, CuadrosDeposito, HistorialStock } from "../../components/forratuc/StockPiezas";
import { fmt } from "../../utils/forratuc/formatoStock";
import { grupoDeposito } from "../../utils/forratuc/conteoStock";
import { obtenerDepositoProduccion, registrarIngresoProduccion, anularIngresoProduccion } from "../../services/api";

/**
 * Producción de la forrajería (2026-11-19, pedido del usuario: "vamos armando
 * la estructura"). La pantalla del rol `produccion` (también la ve el
 * superadmin), con tres solapas:
 *
 *   1. Depósito Producción: su stock, el historial y el ingreso manual de
 *      mercadería, con el MISMO diseño que Forratuc → Stock (pedido del
 *      usuario; las piezas son las de components/forratuc/StockPiezas.jsx).
 *      Todo por /produccion-forratuc, que fija el depósito: este rol no ve ni
 *      toca los otros.
 *   2. Órdenes de carga: las que van a venir de los presupuestos. EN CONSTRUCCIÓN.
 *   3. Planilla de dosificación: la que manda la planta de alimento. EN CONSTRUCCIÓN.
 */

const SOLAPAS = [
  { key: "deposito", icono: "bi-box-seam", texto: "Depósito Producción" },
  { key: "ordenes", icono: "bi-truck", texto: "Órdenes de carga" },
  { key: "dosificacion", icono: "bi-clipboard2-data", texto: "Planilla de dosificación" },
];

// Lo que todavía no está: se dice qué va a haber, para que la estructura se entienda.
const EnConstruccion = ({ icono, titulo, children }) => (
  <div className="card border-0 shadow-sm">
    <div className="card-body text-center py-5">
      <i className={`bi ${icono} display-5 text-muted`}></i>
      <h5 className="mt-3">{titulo}</h5>
      <div className="text-muted mx-auto" style={{ maxWidth: 560 }}>{children}</div>
      <span className="badge bg-warning text-dark mt-3"><i className="bi bi-cone-striped me-1"></i>En construcción</span>
    </div>
  </div>
);

const ForratucProduccionPage = () => {
  const [solapa, setSolapa] = useState("deposito");
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingresoAbierto, setIngresoAbierto] = useState(false);
  const historialRef = useRef(null);

  const cargar = async () => {
    setLoading(true);
    try {
      setDatos(await obtenerDepositoProduccion());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo leer el depósito.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  // Lo que tiene stock, agrupado como en el Stock (alimento por categoría, otros).
  const grupos = useMemo(() => {
    const conStock = (datos?.productos || []).filter((p) => p.cantidad !== 0);
    return [...new Set(conStock.map(grupoDeposito))]
      .map((titulo) => ({ titulo, items: conStock.filter((p) => grupoDeposito(p) === titulo) }));
  }, [datos]);
  const productosConStock = grupos.reduce((a, g) => a + g.items.length, 0);

  const anular = async (m) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Anular este ingreso?", text: m.detalle, icon: "warning",
      showCancelButton: true, confirmButtonText: "Sí, anular", confirmButtonColor: "#dc3545", cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await anularIngresoProduccion(m.id);
      cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid">
        {/* ── Header (como Stock) ── */}
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <i className="bi bi-building-gear me-2 text-success"></i>
            Forratuc — Producción
          </h1>
          {solapa === "deposito" && (
            <div className="d-flex gap-2">
              <button className="btn btn-success btn-sm" onClick={() => setIngresoAbierto(true)} disabled={!datos}>
                <i className="bi bi-box-arrow-in-down me-1"></i>Ingresar mercadería
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={cargar} title="Refrescar" disabled={loading}>
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          )}
        </div>

        <ul className="nav nav-tabs mb-3">
          {SOLAPAS.map((s) => (
            <li key={s.key} className="nav-item">
              <button className={`nav-link ${solapa === s.key ? "active" : ""}`} onClick={() => setSolapa(s.key)}>
                <i className={`bi ${s.icono} me-1`}></i>{s.texto}
              </button>
            </li>
          ))}
        </ul>

        {/* ══════════ 1. DEPÓSITO PRODUCCIÓN (mismo diseño que Stock) ══════════ */}
        {solapa === "deposito" && (
          loading && !datos ? (
            <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
          ) : datos && (
            <>
              {/* ── Stock total ── */}
              <div className="card border-0 shadow-sm mb-2" style={{ background: "#f0f4f8" }}>
                <div className="card-header border-0 py-2" style={{ background: "transparent" }}>
                  <h6 className="mb-0 text-secondary fw-semibold">
                    <i className="bi bi-layers me-2"></i>
                    Stock total — {datos.deposito.etiqueta}
                  </h6>
                </div>
                <div className="card-body py-3">
                  <div className="d-flex flex-wrap gap-2">
                    <Cuadro badge="Total" badgeClase="bg-success-subtle text-success-emphasis"
                      valor={`${fmt(datos.total)} unid.`}
                      sub={`${productosConStock} ${productosConStock === 1 ? "producto" : "productos"} con stock`} />
                    {grupos.map((g) => (
                      <Cuadro key={g.titulo} badge={g.titulo.replace(/^Alimento balanceado — /, "")}
                        valor={`${fmt(g.items.reduce((a, p) => a + p.cantidad, 0))} unid.`}
                        sub={`${g.items.length} ${g.items.length === 1 ? "producto" : "productos"}`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Separador ── */}
              <div className="d-flex align-items-center gap-2 mt-4 mb-3">
                <hr className="flex-grow-1 m-0" />
                <span className="text-muted fw-semibold text-uppercase px-2"
                  style={{ fontSize: "0.72rem", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                  <i className="bi bi-geo-alt me-1"></i>
                  Depósito
                </span>
                <hr className="flex-grow-1 m-0" />
              </div>

              {/* ── La tarjeta del depósito ── */}
              <div className="row g-3 mb-4">
                <TarjetaLugar ancho="col-12" icono="bi-bag" colorIcono="text-success" titulo={datos.deposito.etiqueta}
                  vacio={grupos.length === 0} total={`${fmt(datos.total)} unid.`} activa
                  onClick={() => historialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  <CuadrosDeposito grupos={grupos} cantidadDe={(p) => p.cantidad} />
                </TarjetaLugar>
              </div>

              {grupos.length === 0 && (
                <p className="text-muted small mb-1">
                  <i className="bi bi-info-circle me-1"></i>
                  El depósito está vacío: la mercadería entra con <strong>Ingresar mercadería</strong>.
                </p>
              )}

              {/* ── Historial de movimientos ── */}
              <div className="card border-0 shadow-sm mt-4" ref={historialRef}>
                <div className="card-header bg-white">
                  <h6 className="mb-0">
                    <i className="bi bi-clock-history me-2 text-secondary"></i>
                    Historial de movimientos
                  </h6>
                </div>
                <div className="card-body">
                  <HistorialStock historial={datos.historial} cargando={loading}
                    tituloLugar={datos.deposito.etiqueta} onAnular={anular} />
                </div>
              </div>
            </>
          )
        )}

        {/* ══════════ 2. ÓRDENES DE CARGA (en construcción) ══════════ */}
        {solapa === "ordenes" && (
          <EnConstruccion icono="bi-truck" titulo="Órdenes de carga">
            Acá van a llegar las <strong>órdenes de carga que salen de los presupuestos</strong>: qué hay que
            preparar y cargar, para quién y cuándo. Producción las ve, las prepara y las marca como cargadas.
          </EnConstruccion>
        )}

        {/* ══════════ 3. PLANILLA DE DOSIFICACIÓN (en construcción) ══════════ */}
        {solapa === "dosificacion" && (
          <EnConstruccion icono="bi-clipboard2-data" titulo="Planilla de dosificación">
            La <strong>planilla de dosificación que manda la planta de alimento</strong>: por cada alimento a
            elaborar, los kg de cada materia prima por bachada (como la planilla de papel).
          </EnConstruccion>
        )}

        {ingresoAbierto && datos && (
          <IngresoMercaderiaModal
            depositos={[datos.deposito]}
            productos={datos.productos.filter((p) => p.activo)}
            registrar={registrarIngresoProduccion}
            onClose={() => setIngresoAbierto(false)}
            onGuardado={() => { setIngresoAbierto(false); cargar(); }}
          />
        )}
      </div>
    </Layout>
  );
};

export default ForratucProduccionPage;
