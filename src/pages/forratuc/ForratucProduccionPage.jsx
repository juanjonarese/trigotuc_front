import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import IngresoMercaderiaModal from "../../components/forratuc/IngresoMercaderiaModal";
import PedidosProduccion from "../../components/forratuc/PedidosProduccion";
import PlanillasProduccion from "../../components/forratuc/PlanillasProduccion";
import { Cuadro, TarjetaLugar, CuadrosDeposito } from "../../components/forratuc/StockPiezas";
import { fmt } from "../../utils/forratuc/formatoStock";
import { grupoDeposito } from "../../utils/forratuc/conteoStock";
import { obtenerDepositoProduccion, registrarIngresoProduccion, listarPedidosProduccion, obtenerPlanillasProduccion } from "../../services/api";

// Avisos en las solapas (2026-11-21, pedido del usuario: "una pill avisando que hay pedidos"):
// lo que Producción tiene que hacer. Pedidos de Forratuc sin mandar; planillas por
// hacer y camiones de granel sin cargar. Se refresca solo cada minuto y al cambiar de solapa.
const contarPendientes = async () => {
  const [pedidos, planillas] = await Promise.all([
    listarPedidosProduccion({ abiertos: true }).catch(() => []),
    obtenerPlanillasProduccion().catch(() => null),
  ]);
  const porCargar = (o) => o.envase === "granel" && (o.tandas || []).some((t) => !t.anulada && !t.envioAlimento);
  return {
    pedidos: (Array.isArray(pedidos) ? pedidos : []).filter((p) => p.estado === "pendiente").length,
    dosificacion: (planillas?.planillas || []).filter((o) => o.estado !== "completa" || porCargar(o)).length,
  };
};

/**
 * Producción de la forrajería (2026-11-19, pedido del usuario: "vamos armando
 * la estructura"). La pantalla del rol `produccion` (también la ve el
 * superadmin), con tres solapas:
 *
 *   1. Depósito Producción: su stock y el ingreso manual de mercadería (y desde
 *      el 20/11 el stock del Depósito Carbonato, solo para mirar: `soloVer`), con el
 *      MISMO diseño que Forratuc → Stock (pedido del usuario; las piezas son
 *      las de components/forratuc/StockPiezas.jsx). SIN el historial de
 *      movimientos (19/11, pedido del usuario; el back tampoco lo manda).
 *      Todo por /produccion-forratuc, que fija el depósito: este rol no ve ni
 *      toca los otros.
 *   1b. Pedidos de Forratuc (20/11): los prepara y los manda (imprime el remito);
 *      el stock sale de acá cuando Forratuc los recibe. components/forratuc/PedidosProduccion.jsx.
 *   2. Órdenes de carga: las que van a venir de los presupuestos. EN CONSTRUCCIÓN.
 *   3. Planilla de dosificación (21/11): la emite la Planta de alimento en bachadas y
 *      Producción carga lo que hizo — en bolsa, al Depósito Producción; a granel, el
 *      camión con el peso de la balanza va directo a la granja. components/forratuc/PlanillasProduccion.jsx.
 */

const SOLAPAS = [
  { key: "deposito", icono: "bi-box-seam", texto: "Depósito Producción" },
  { key: "pedidos", icono: "bi-cart-check", texto: "Pedidos de Forratuc" },
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
  const [avisos, setAvisos] = useState({});
  useEffect(() => {
    let vivo = true;
    const refrescar = () => contarPendientes().then((a) => { if (vivo) setAvisos(a); });
    refrescar();
    const id = setInterval(refrescar, 60000);
    return () => { vivo = false; clearInterval(id); };
  }, [solapa]);

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
  // Los depósitos que solo mira (20/11: Carbonato), agrupados igual.
  const agrupar = (items) => [...new Set(items.map(grupoDeposito))]
    .map((titulo) => ({ titulo, items: items.filter((p) => grupoDeposito(p) === titulo) }));
  const soloVer = (datos?.soloVer || []).map((d) => ({ ...d, grupos: agrupar(d.productos) }));

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
                {avisos[s.key] > 0 && (
                  <span className="badge rounded-pill bg-danger ms-2" title="Pendientes">{avisos[s.key]}</span>
                )}
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
                  {soloVer.length ? "Depósitos" : "Depósito"}
                </span>
                <hr className="flex-grow-1 m-0" />
              </div>

              {/* ── La tarjeta del depósito ── */}
              <div className="row g-3 mb-4">
                <TarjetaLugar ancho={soloVer.length ? "col-12 col-xl-6" : "col-12"} icono="bi-bag" colorIcono="text-success" titulo={datos.deposito.etiqueta}
                  vacio={grupos.length === 0} total={`${fmt(datos.total)} unid.`}>
                  <CuadrosDeposito grupos={grupos} cantidadDe={(p) => p.cantidad} />
                </TarjetaLugar>
                {/* Carbonato (20/11, pedido del usuario): solo para mirar. */}
                {soloVer.map((d) => (
                  <TarjetaLugar key={d.key} ancho="col-12 col-xl-6" icono="bi-eye" colorIcono="text-secondary"
                    titulo={<>{d.etiqueta} <span className="badge bg-light text-secondary border ms-1 fw-normal">solo ver</span></>}
                    vacio={d.grupos.length === 0} total={`${fmt(d.total)} unid.`}>
                    <CuadrosDeposito grupos={d.grupos} cantidadDe={(p) => p.cantidad} />
                  </TarjetaLugar>
                ))}
              </div>

              {grupos.length === 0 && (
                <p className="text-muted small mb-1">
                  <i className="bi bi-info-circle me-1"></i>
                  El depósito está vacío: la mercadería entra con <strong>Ingresar mercadería</strong>.
                </p>
              )}
            </>
          )
        )}

        {/* ══════════ PEDIDOS DE FORRATUC (20/11) ══════════ */}
        {solapa === "pedidos" && <PedidosProduccion lado="produccion" />}

        {/* ══════════ 2. ÓRDENES DE CARGA (en construcción) ══════════ */}
        {solapa === "ordenes" && (
          <EnConstruccion icono="bi-truck" titulo="Órdenes de carga">
            Acá van a llegar las <strong>órdenes de carga que salen de los presupuestos</strong>: qué hay que
            preparar y cargar, para quién y cuándo. Producción las ve, las prepara y las marca como cargadas.
          </EnConstruccion>
        )}

        {/* ══════════ 3. PLANILLA DE DOSIFICACIÓN (21/11) ══════════ */}
        {solapa === "dosificacion" && <PlanillasProduccion />}

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
