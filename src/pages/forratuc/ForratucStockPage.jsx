import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { BADGE_ESPECIE, especieDe, etiquetaEspecie, claveEntero, claveTrozado } from "../../utils/especies";
import { formatearFechaLocal } from "../../utils/dateUtils";
import { imprimirConteoDepositos, imprimirAjusteDeposito } from "../../utils/forratuc/imprimirForratuc";
import { exportarConteoExcel, grupoDeposito, seccionesConteo } from "../../utils/forratuc/conteoStock";
import IngresoMercaderiaModal from "../../components/forratuc/IngresoMercaderiaModal";
import AjusteDepositoModal from "../../components/forratuc/AjusteDepositoModal";
import ConteoStockModal from "../../components/forratuc/ConteoStockModal";
import { Cuadro, Grupo, TarjetaLugar, CuadrosDeposito, HistorialStock } from "../../components/forratuc/StockPiezas";
import { fmt } from "../../utils/forratuc/formatoStock";
import {
  obtenerStockForratuc,
  obtenerMovimientosStockForratuc,
  anularIngresoAlimentoForratuc,
  anularAjusteDepositoForratuc,
  obtenerAjusteDepositoForratuc,
  obtenerProductosForratuc,
} from "../../services/api";

/**
 * Stock de Forratuc (2026-10-26): todo lo que el local tiene para vender.
 *
 * Pollo, huevo y pollitos son stock de la avícola (entre empresas no se vende:
 * se usa el stock) y se leen igual que en el presupuesto. El alimento
 * balanceado es de Forratuc, que lo fabrica: se lleva en BOLSAS por alimento y
 * por depósito (Trigotuc y la forrajería).
 *
 * Mismo diseño que Frigorífico → Stock (pedido del usuario): arriba el total,
 * después una tarjeta por lugar (cámara, huevos, pollitos, cada depósito) y
 * abajo el historial del lugar que se toque, como cuenta corriente
 * (GET /stock-forratuc/movimientos/:lugar). Acá no se suma nada por cuenta
 * propia: todo viene del back.
 */

const ForratucStockPage = () => {
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingresoAbierto, setIngresoAbierto] = useState(false);
  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  // Planilla de conteo (25/11): { extras } mientras el modal está abierto.
  const [conteo, setConteo] = useState(null);

  // Historial del lugar elegido.
  const [lugar, setLugar] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const historialRef = useRef(null);

  const cargar = async () => {
    setLoading(true);
    try {
      setStock(await obtenerStockForratuc());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el stock.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const verMovimientos = async (key) => {
    setLugar(key);
    setHistorial(null);
    setCargandoHistorial(true);
    setTimeout(() => historialRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    try {
      setHistorial(await obtenerMovimientosStockForratuc(key));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los movimientos.", "error");
    } finally {
      setCargandoHistorial(false);
    }
  };

  const actualizar = () => {
    cargar();
    if (lugar) verMovimientos(lugar);
  };

  // "Ingresar mercadería" se sacó el 2026-11-06 (el alimento iba a entrar por la
  // Planta) y VOLVIÓ el 2026-11-16 (pedido del usuario: arrancan a vender y la
  // Producción todavía no está en el sistema): un remito con varios renglones,
  // solo de productos de depósito. Se anula desde el historial.
  // Planilla de conteo (2026-11-06): una hoja por depósito con lo del sistema y
  // columnas para lo contado y la diferencia (+/−), para el conteo a mano.
  // Desde el 25/11 (pedido del usuario: "seleccionar lo que voy a controlar") se
  // elige el depósito y después los rubros, varios con tilde (ConteoStockModal).
  const imprimirConteo = async () => {
    // En la Forrajería también se cuenta lo de la cámara, los huevos y los pollitos.
    let productos = [];
    try {
      productos = await obtenerProductosForratuc();
    } catch {
      // Sin productos sale igual, sin códigos.
    }
    setConteo({ extras: { forrajeria: seccionesForrajeria(productos) } });
  };

  const generarConteo = ({ elegidos, rubros, excel }) => {
    const opciones = { operador: localStorage.getItem("nombreUsuario") || "", extras: conteo.extras, rubros };
    if (excel) exportarConteoExcel(elegidos, stock.alimento.productos || [], opciones);
    else imprimirConteoDepositos(stock.alimento, elegidos, opciones);
    setConteo(null);
  };

  // Pollo (cámara Forrajería), huevos y pollitos, con el código y el nombre del producto.
  const seccionesForrajeria = (productos) => {
    const porClave = new Map(productos.map((p) => [p.clave, p]));
    const prod = (clave, nombre) => ({ codigo: porClave.get(clave)?.codigo || "", etiqueta: porClave.get(clave)?.nombre || nombre });
    const enteros = (stock.pollo?.enteros || []).map((e) => {
      const esp = especieDe(e);
      return { ...prod(`entero:${esp}:${e.calibre}`, `${etiquetaEspecie(esp)} entero calibre ${e.calibre}`), unidad: "cajones", sistema: e.cajones };
    });
    const trozados = (stock.pollo?.trozados || []).map((t) => {
      const esp = especieDe(t);
      const clase = t.clase || "A";
      const clave = esp === "pollo" ? `trozado:${t.tipo}:${clase}` : `trozado:${esp}:${t.tipo}:${clase}`;
      return { ...prod(clave, `${etiquetaEspecie(esp)} ${t.etiqueta}${t.clase ? ` ${t.clase}` : ""}`), unidad: "cajas", sistema: t.cajas };
    });
    const huevos = (stock.huevos?.porTipo || []).map((h) => {
      const p = prod(h.producto, h.etiqueta);
      return { ...p, etiqueta: `${p.etiqueta} (${fmt(h.huevos)} huevos)`, unidad: "maples", sistema: h.maples };
    });
    // Siempre la fila de pollitos, aunque esté en cero: un cero que aparece también es una diferencia.
    const pollitos = [{ ...prod("pollito", "Pollitos BB"), unidad: "pollitos", sistema: stock.pollitos?.total || 0 }];
    // Como la tarjeta del Depósito Forrajería (2026-11-16): huevos y pollitos con
    // el alimento, y la cámara (el pollo) al final.
    return [
      { titulo: "Huevos", filas: huevos },
      { titulo: "Pollitos", filas: pollitos },
      { titulo: "Pollo entero — Cámara Forrajería", filas: enteros, alFinal: true },
      { titulo: "Trozado — Cámara Forrajería", filas: trozados, alFinal: true },
    ];
  };

  // Reimprimir la constancia firmada de un ajuste (19/11).
  const imprimirAjuste = async (numero) => {
    try {
      imprimirAjusteDeposito(await obtenerAjusteDepositoForratuc(numero));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo leer el ajuste.", "error");
    }
  };

  // Ingreso o ajuste por depósito (2026-11-19): el back dice cuál en `anulable`.
  const anularIngreso = async (m) => {
    const esAjuste = m.anulable === "ajuste";
    const { isConfirmed } = await Swal.fire({
      title: esAjuste ? "¿Anular este ajuste?" : "¿Anular este ingreso?",
      text: esAjuste
        ? `${m.comprobanteAjuste ? `Se anula el ajuste ${m.comprobanteAjuste} entero (todos sus renglones). ` : ""}La mercadería vuelve al depósito.`
        : m.detalle,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;
    try {
      await (esAjuste ? anularAjusteDepositoForratuc : anularIngresoAlimentoForratuc)(m.id);
      actualizar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo anular.", "error");
    }
  };

  const pollo = stock?.pollo;
  const huevos = stock?.huevos;
  const pollitos = stock?.pollitos;
  const alimento = stock?.alimento;
  const sinPesoBolsa = (alimento?.productos || []).some((p) => p.kgPorBolsa == null);

  const kgEntero = (pollo?.enteros || []).reduce((a, e) => a + e.cajones * 20, 0);
  const kgTrozado = (pollo?.trozados || []).reduce((a, t) => a + (t.kgTotal || 0), 0);

  const LUGARES = stock
    ? [
        { key: "camara", titulo: "Cámara Forrajería" },
        // Huevos y pollitos están en el Depósito Forrajería (2026-11-16).
        ...alimento.depositos.map((d) => ({ key: d.key, titulo: d.etiqueta })),
      ]
    : [];

  const tituloLugar = LUGARES.find((l) => l.key === lugar)?.titulo || lugar;

  return (
    <Layout>
      <div className="container-fluid">
        {/* ── Header ── */}
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <button className="btn btn-outline-secondary btn-sm me-2 align-middle" onClick={() => navigate("/forratuc")}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <i className="bi bi-boxes me-2 text-warning"></i>
            Forratuc — Stock
          </h1>
          <div className="d-flex gap-2">
            <button className="btn btn-success btn-sm" onClick={() => setIngresoAbierto(true)} disabled={!stock}>
              <i className="bi bi-box-arrow-in-down me-1"></i>Ingresar mercadería
            </button>
            <button className="btn btn-outline-danger btn-sm" onClick={() => setAjusteAbierto(true)} disabled={!stock}>
              <i className="bi bi-box-arrow-up me-1"></i>Ajuste por depósito
            </button>
            <button className="btn btn-outline-primary btn-sm" onClick={imprimirConteo} disabled={!stock}>
              <i className="bi bi-printer me-1"></i>Planilla de conteo
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={actualizar} title="Refrescar" disabled={loading}>
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        {loading && !stock ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : stock && (
          <>
            {/* ── Stock total ── */}
            <div className="card border-0 shadow-sm mb-2" style={{ background: "#f0f4f8" }}>
              <div className="card-header border-0 py-2" style={{ background: "transparent" }}>
                <h6 className="mb-0 text-secondary fw-semibold">
                  <i className="bi bi-layers me-2"></i>
                  Stock total — lo que el local tiene para vender
                </h6>
              </div>
              <div className="card-body py-3">
                <div className="d-flex flex-wrap gap-2">
                  <Cuadro badge="Pollo entero" badgeClase={BADGE_ESPECIE.pollo}
                    valor={`${fmt(pollo.totalCajones)} caj`} sub={`${fmt(kgEntero)} kg`} />
                  <Cuadro badge="Trozado" badgeClase={BADGE_ESPECIE.pollo}
                    valor={`${fmt(pollo.totalCajasTrozado)} cajas`} sub={`${fmt(kgTrozado)} kg`} />
                  <Cuadro badge="Huevos" badgeClase="bg-warning-subtle text-warning-emphasis"
                    valor={`${fmt(huevos.maples)} maples`} sub={`${fmt(huevos.total)} huevos`} />
                  <Cuadro badge="Pollitos" badgeClase="bg-info-subtle text-info-emphasis"
                    valor={`${fmt(pollitos.total)}`} sub="unidades" />
                  <Cuadro badge="Depósitos" badgeClase="bg-success-subtle text-success-emphasis"
                    valor={`${fmt(alimento.totalBolsas)} unid.`}
                    sub={alimento.depositos.map((d) => `${d.etiqueta.replace(/^Depósito /, "")} ${fmt(d.bolsas)}`).join(" · ")} />
                </div>
              </div>
            </div>

            {/* ── Separador ── */}
            <div className="d-flex align-items-center gap-2 mt-4 mb-3">
              <hr className="flex-grow-1 m-0" />
              <span className="text-muted fw-semibold text-uppercase px-2"
                style={{ fontSize: "0.72rem", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                <i className="bi bi-geo-alt me-1"></i>
                Por depósito y cámara
              </span>
              <hr className="flex-grow-1 m-0" />
            </div>

            {/* ── Una tarjeta por lugar ── */}
            <div className="row g-3 mb-4">
              {/* La cámara que la avícola llama "Trigotuc" está en la forrajería (2026-11-02). */}
              {[{ key: "camara", titulo: "Cámara Forrajería", stock: pollo }].map((c) => {
                const kgE = c.stock.enteros.reduce((a, e) => a + e.cajones * 20, 0);
                const kgT = c.stock.trozados.reduce((a, t) => a + (t.kgTotal || 0), 0);
                return (
                  <TarjetaLugar key={c.key} icono="bi-snow2" colorIcono="text-primary" titulo={c.titulo}
                    vacio={!c.stock.enteros.length && !c.stock.trozados.length}
                    total={`${fmt(kgE + kgT)} kg`}
                    activa={lugar === c.key} onClick={() => verMovimientos(c.key)}>
                    {c.stock.enteros.length > 0 && (
                      <Grupo titulo="Faenado (entero)">
                        {c.stock.enteros.map((e) => (
                          <Cuadro key={claveEntero(e)} badgeClase={BADGE_ESPECIE[especieDe(e)]}
                            badge={`${etiquetaEspecie(especieDe(e))} · Cal. ${e.calibre}`}
                            valor={`${fmt(e.cajones)} caj`} sub={`${fmt(e.cajones * 20)} kg`} />
                        ))}
                      </Grupo>
                    )}
                    {c.stock.trozados.length > 0 && (
                      <Grupo titulo="Trozados">
                        {c.stock.trozados.map((t) => (
                          <Cuadro key={claveTrozado(t)} badgeClase={BADGE_ESPECIE[especieDe(t)]}
                            badge={`${etiquetaEspecie(especieDe(t))} · ${t.etiqueta}${t.clase ? ` · ${t.clase}` : ""}`}
                            valor={`${fmt(t.cajas)} caj`} sub={`${fmt(t.kgTotal)} kg`} />
                        ))}
                      </Grupo>
                    )}
                  </TarjetaLugar>
                );
              })}

              {/* Una por depósito de alimento: salen de `alimento.depositos`,
                  así un depósito nuevo aparece solo. Adentro, lo que tiene stock. */}
              {alimento.depositos.map((d) => {
                const conStock = alimento.productos.filter((p) => p.porDeposito[d.key]);
                // El alimento, por categoría (bovinos, parrilleros…; 2026-11-12):
                // el back ya los manda ordenados.
                // Desde el 19/11 los de "otros" con categoría van con su categoría.
                const rubros = [...new Set(conStock.map(grupoDeposito))]
                  .map((titulo) => ({ titulo, items: conStock.filter((p) => grupoDeposito(p) === titulo) }));
                // La Forrajería guarda además los huevos y los pollitos que le mandan (2026-11-16).
                const esForrajeria = d.key === "forrajeria";
                const hayHuevos = esForrajeria && huevos.porTipo.length > 0;
                const hayPollitos = esForrajeria && pollitos.envios.length > 0;
                return (
                  <TarjetaLugar key={d.key} icono="bi-bag" colorIcono="text-success" titulo={d.etiqueta}
                    vacio={!conStock.length && !hayHuevos && !hayPollitos}
                    total={[
                      `${fmt(d.bolsas)} unid.`,
                      esForrajeria ? `${fmt(huevos.maples)} maples (${fmt(huevos.total)} huevos)` : null,
                      esForrajeria ? `${fmt(pollitos.total)} pollitos` : null,
                    ].filter(Boolean).join(" · ")}
                    activa={lugar === d.key} onClick={() => verMovimientos(d.key)}>
                    {hayHuevos && (
                      <Grupo titulo="Huevos">
                        {huevos.porTipo.map((h) => (
                          <Cuadro key={h.tipo} badge={h.etiqueta} badgeClase="bg-warning-subtle text-warning-emphasis"
                            valor={`${fmt(h.maples)} maples`} sub={`${fmt(h.huevos)} huevos`} />
                        ))}
                      </Grupo>
                    )}
                    {hayPollitos && (
                      <Grupo titulo="Pollitos (envíos de Reproductoras)">
                        {pollitos.envios.map((e) => (
                          <Cuadro key={e._id} badge={e.numero} badgeClase="bg-info-subtle text-info-emphasis"
                            valor={`${fmt(e.disponibles)} pollitos`}
                            sub={`${formatearFechaLocal(e.fecha)} · llegaron ${fmt(e.cantidad)}`} />
                        ))}
                      </Grupo>
                    )}
                    <CuadrosDeposito grupos={rubros} cantidadDe={(p) => p.porDeposito[d.key]} />
                  </TarjetaLugar>
                );
              })}
            </div>

            {alimento.totalBolsas === 0 && (
              <p className="text-muted small mb-1">
                <i className="bi bi-info-circle me-1"></i>
                Los depósitos todavía están vacíos: el alimento entra con <strong>Ingresar mercadería</strong> (o
                desde la Planta, con una orden de envío). El presupuesto vende de cualquiera de los depósitos.
              </p>
            )}
            {sinPesoBolsa && (
              <p className="text-muted small mb-1">
                <i className="bi bi-info-circle me-1"></i>
                Falta el peso de la bolsa de cada alimento para mostrar los kg.
              </p>
            )}

            {/* ── Historial de movimientos del lugar elegido ── */}
            <div className="card border-0 shadow-sm mt-4" ref={historialRef}>
              <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h6 className="mb-0">
                  <i className="bi bi-clock-history me-2 text-secondary"></i>
                  Historial de movimientos
                </h6>
                <div className="d-flex gap-2">
                  <select className="form-select form-select-sm" style={{ width: "auto" }}
                    value={lugar || ""} onChange={(e) => e.target.value && verMovimientos(e.target.value)}>
                    <option value="">Elegí un depósito o cámara…</option>
                    {LUGARES.map((l) => <option key={l.key} value={l.key}>{l.titulo}</option>)}
                  </select>
                  {lugar && (
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => { setLugar(null); setHistorial(null); }}>
                      Ocultar
                    </button>
                  )}
                </div>
              </div>
              {lugar && (
                <div className="card-body">
                  <HistorialStock key={lugar} historial={historial} cargando={cargandoHistorial}
                    tituloLugar={tituloLugar} mostrarRubro={lugar === "forrajeria"}
                    onAnular={anularIngreso} onImprimirAjuste={imprimirAjuste} />
                </div>
              )}
            </div>
          </>
        )}

        {conteo && stock && (
          <ConteoStockModal
            depositos={stock.alimento?.depositos || []}
            seccionesDe={(d) => seccionesConteo(d, stock.alimento?.productos || [], conteo.extras[d.key] || [])}
            onClose={() => setConteo(null)}
            onGenerar={generarConteo}
          />
        )}
        {ingresoAbierto && stock && (
          <IngresoMercaderiaModal
            depositos={stock.alimento.depositos.filter((d) => !d.retirado)}
            productos={stock.alimento.productos.filter((p) => p.activo)}
            onClose={() => setIngresoAbierto(false)}
            onGuardado={() => { setIngresoAbierto(false); actualizar(); }}
          />
        )}

        {ajusteAbierto && stock && (
          <AjusteDepositoModal
            depositos={stock.alimento.depositos.filter((d) => !d.retirado)}
            productos={stock.alimento.productos.filter((p) => p.activo || p.bolsas !== 0)}
            motivos={stock.motivosAjuste || []}
            onClose={() => setAjusteAbierto(false)}
            onGuardado={() => { setAjusteAbierto(false); actualizar(); }}
          />
        )}
      </div>
    </Layout>
  );
};

export default ForratucStockPage;
