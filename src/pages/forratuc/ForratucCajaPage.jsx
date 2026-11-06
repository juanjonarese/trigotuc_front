import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { obtenerFechaHoy } from "../../utils/dateUtils";
import { imprimirCierreCajaForratuc } from "../../utils/forratuc/imprimirForratuc";
import { obtenerCajaForratuc, guardarCierreCajaForratuc } from "../../services/api";

/**
 * Rendición y cierre de caja de Forratuc (2026-10-29), con el formato de la
 * planilla del cliente: la hoja que el local entrega con la plata y los
 * comprobantes del día.
 *
 * Desde el 2026-11-02 (pedido del usuario): la caja INICIO viene sola del
 * último cierre (lo que se dejó para el día siguiente); a mano se cuentan la
 * caja para el día siguiente y los billetes que se rinden. El efectivo y el
 * Mercado Pago del día, lo que hay que rendir (inicio + efectivo − caja del día
 * siguiente) y el control los calcula el back (GET /caja-forratuc/:fecha).
 * ⚠️ La fórmula es la del back (`efectivoARendir`); acá se repite SOLO para
 * mostrarla en vivo mientras se tipean los billetes (el guardado usa la del back).
 */

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const fmt = (n) => new Intl.NumberFormat("es-AR").format(Number(n || 0));

// Renglón de las tablas de ventas y rendición.
const Fila = ({ texto, importe, nota, fuerte }) => (
  <tr className={fuerte ? "fw-semibold" : ""}>
    <td>{texto}{nota && <span className="small text-muted ms-2">{nota}</span>}</td>
    <td className="text-end text-nowrap">{importe == null ? "—" : pesos(importe)}</td>
  </tr>
);

// { inicio: { 20000: "3", ... }, ... } desde la respuesta del back.
const conteosDeCaja = (caja) =>
  Object.fromEntries(
    caja.tiposConteo.map((t) => [
      t.key,
      Object.fromEntries(
        caja.conteos[t.key].filas.map((f) => [
          f.billete,
          (caja.guardado || (t.key === "inicio" && caja.inicioDesde)) && f.cantidad ? String(f.cantidad) : "",
        ])
      ),
    ])
  );

const ForratucCajaPage = () => {
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [caja, setCaja] = useState(null);
  const [conteos, setConteos] = useState({});
  const [observaciones, setObservaciones] = useState("");
  // Gastos pagados con la plata de la caja (2026-11-02): bajan lo que se rinde.
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);

  const cargar = async (f = fecha) => {
    setLoading(true);
    try {
      const c = await obtenerCajaForratuc(f);
      setCaja(c);
      setConteos(conteosDeCaja(c));
      setObservaciones(c.observaciones || "");
      setGastos((c.gastos || []).map((g) => ({ concepto: g.concepto, importe: String(g.importe) })));
      setSinGuardar(false);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar la caja.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { cargar(fecha); }, [fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCantidad = (tipo, billete, valor) => {
    setConteos((c) => ({ ...c, [tipo]: { ...c[tipo], [billete]: valor } }));
    setSinGuardar(true);
  };
  const subtotalDe = (tipo) =>
    (caja?.billetes || []).reduce((a, b) => a + b * (Number(conteos[tipo]?.[b]) || 0), 0);
  // La rendición con lo que se está tipeando, sin esperar a guardar.
  const inicioVivo = subtotalDe("inicio");
  const cierreVivo = subtotalDe("cierre");
  const bolsaVivo = subtotalDe("bolsa");
  const gastosVivo = gastos.reduce((a, g) => a + (Number(g.importe) || 0), 0);
  const aRendirVivo = caja ? Math.round((inicioVivo + caja.medios.efectivo.total - gastosVivo - cierreVivo) * 100) / 100 : null;
  const setGasto = (i, cambios) => {
    setGastos((gs) => gs.map((g, k) => (k === i ? { ...g, ...cambios } : g)));
    setSinGuardar(true);
  };
  const contoAlgo = Boolean(caja) && (caja.guardado || ["cierre", "bolsa"].some((t) => Object.values(conteos[t] || {}).some((v) => v !== "")));
  const controlVivo = contoAlgo ? Math.round((bolsaVivo - aRendirVivo) * 100) / 100 : null;

  const guardar = async () => {
    for (const t of caja.tiposConteo)
      for (const b of caja.billetes) {
        const v = conteos[t.key]?.[b];
        if (v !== "" && v != null && (!Number.isInteger(Number(v)) || Number(v) < 0))
          return Swal.fire("Cantidad inválida", `${t.etiqueta}, billete de $${fmt(b)}: va sin decimales.`, "warning");
      }
    setSaving(true);
    try {
      const c = await guardarCierreCajaForratuc(fecha, {
        conteos: Object.fromEntries(
          caja.tiposConteo.map((t) => [
            t.key,
            caja.billetes
              .filter((b) => conteos[t.key]?.[b] !== "" && conteos[t.key]?.[b] != null)
              .map((b) => ({ billete: b, cantidad: Number(conteos[t.key][b]) })),
          ])
        ),
        observaciones: observaciones.trim(),
        gastos: gastos
          .filter((g) => g.concepto.trim() || g.importe !== "")
          .map((g) => ({ concepto: g.concepto.trim(), importe: Number(g.importe) })),
      });
      setCaja(c);
      setConteos(conteosDeCaja(c));
      setGastos((c.gastos || []).map((g) => ({ concepto: g.concepto, importe: String(g.importe) })));
      setSinGuardar(false);
      Swal.fire({ icon: "success", title: "Cierre guardado", timer: 1300, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const imprimir = () => {
    if (sinGuardar)
      return Swal.fire("Falta guardar", "Guardá el conteo antes de imprimir la planilla.", "warning");
    imprimirCierreCajaForratuc(caja, { operador: localStorage.getItem("nombreUsuario") || "" });
  };

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <button className="btn btn-outline-secondary btn-sm me-2 align-middle" onClick={() => navigate("/forratuc")}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <i className="bi bi-cash-stack me-2 text-success"></i>
            Rendición y cierre de caja
          </h1>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <input type="date" className="form-control form-control-sm" style={{ width: "auto" }}
              value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
            <button className="btn btn-success btn-sm" onClick={guardar} disabled={!caja || saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-check-lg me-1"></i>}
              Guardar conteo
            </button>
            <button className="btn btn-outline-dark btn-sm" onClick={imprimir} disabled={!caja}>
              <i className="bi bi-printer me-1"></i>Imprimir planilla
            </button>
          </div>
        </div>

        {loading && !caja ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : caja && (
          <>
            {caja.guardado ? (
              <div className="alert alert-success py-2 small">
                <i className="bi bi-check-circle me-1"></i>
                Conteo guardado{caja.cerradoPor ? ` por ${caja.cerradoPor}` : ""}.
                {sinGuardar && <strong className="ms-1">Hay cambios sin guardar.</strong>}
              </div>
            ) : (
              <div className="alert alert-light border py-2 small">
                <i className="bi bi-info-circle me-1"></i>
                Contá los billetes que quedan para el día siguiente y los que se rinden, y guardá: lo que hay que
                rendir y el control salen de ahí.
              </div>
            )}

            {/* ── Billetes ── */}
            <div className="row g-3 mb-3">
              {["inicio", "cierre", "bolsa"].map((k) => caja.tiposConteo.find((t) => t.key === k)).filter(Boolean).map((t) => {
                const soloLectura = t.key === "inicio" && Boolean(caja.inicioDesde);
                return (
                <div key={t.key} className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-white fw-semibold">
                      {t.etiqueta}
                      {soloLectura && (
                        <div className="small text-muted fw-normal">Lo que quedó en el cierre del {caja.inicioDesde.split("-").reverse().join("/")}</div>
                      )}
                    </div>
                    <div className="card-body p-2">
                      <table className="table table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr><th>Billetes</th><th>Cantidades</th><th className="text-end">Subtotal</th></tr>
                        </thead>
                        <tbody>
                          {caja.billetes.map((b) => (
                            <tr key={b}>
                              <td className="text-nowrap">$ {fmt(b)}</td>
                              <td style={{ width: 100 }}>
                                <input type="number" min="0" step="1" className={`form-control form-control-sm ${soloLectura ? "bg-light" : ""}`}
                                  readOnly={soloLectura} tabIndex={soloLectura ? -1 : undefined}
                                  value={conteos[t.key]?.[b] ?? ""} onChange={(e) => setCantidad(t.key, b, e.target.value)} />
                              </td>
                              <td className="text-end text-nowrap small">{pesos(b * (Number(conteos[t.key]?.[b]) || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="fw-bold"><td colSpan={2}>Total</td><td className="text-end text-nowrap">{pesos(subtotalDe(t.key))}</td></tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="row g-3">
              {/* Ventas por rubro y detalle de comprobantes: sacados de la pantalla (2026-11-02, pedido del usuario). */}
              <div className="col-12 col-lg-6">
                {/* ── Rendición: inicio + efectivo del día − caja del día siguiente ── */}
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Rendición del efectivo</div>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <Fila texto="Caja inicio" importe={inicioVivo} />
                      <Fila texto="+ Vendido en efectivo" importe={caja.medios.efectivo.ventas} />
                      {caja.medios.efectivo.cobranza > 0 && <Fila texto="+ Cobranza en efectivo" importe={caja.medios.efectivo.cobranza} />}
                      <Fila texto="− Gastos de caja" importe={gastosVivo} />
                      <Fila texto="− Caja para el día siguiente" importe={cierreVivo} />
                      <Fila texto="A rendir" importe={aRendirVivo} fuerte />
                      <Fila texto="Billetes que se rinden" importe={bolsaVivo} />
                      <tr>
                        <td className="fw-semibold">Control</td>
                        <td className="text-end text-nowrap">
                          {controlVivo == null ? (
                            <span className="text-muted small">falta el conteo</span>
                          ) : controlVivo === 0 ? (
                            <span className="badge bg-success">Cierra</span>
                          ) : (
                            <span className={`badge ${controlVivo > 0 ? "bg-warning text-dark" : "bg-danger"}`}>
                              {controlVivo > 0 ? "Sobran" : "Faltan"} {pesos(Math.abs(controlVivo))}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Mercado Pago: se rinde con los tickets ── */}
              <div className="col-12 col-lg-6">
                {/* ── Gastos de caja: lo que se pagó con la plata de la caja ── */}
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center">
                    Gastos de caja
                    <button type="button" className="btn btn-sm btn-outline-primary"
                      onClick={() => { setGastos((gs) => [...gs, { concepto: "", importe: "" }]); setSinGuardar(true); }}>
                      <i className="bi bi-plus-lg me-1"></i>Agregar gasto
                    </button>
                  </div>
                  <div className="card-body p-2">
                    {gastos.length === 0 ? (
                      <div className="small text-muted px-1">Sin gastos en el día.</div>
                    ) : (
                      <>
                        {gastos.map((g, i) => (
                          <div key={i} className="d-flex gap-2 mb-2">
                            <input className="form-control form-control-sm" placeholder="En qué se gastó (ej. lavandina)"
                              value={g.concepto} onChange={(e) => setGasto(i, { concepto: e.target.value })} />
                            <div className="input-group input-group-sm" style={{ maxWidth: 160 }}>
                              <span className="input-group-text">$</span>
                              <input type="number" min="0" step="0.01" className="form-control text-end sin-flechas"
                                value={g.importe} onChange={(e) => setGasto(i, { importe: e.target.value })} />
                            </div>
                            <button type="button" className="btn btn-sm btn-outline-danger border-0" title="Quitar"
                              onClick={() => { setGastos((gs) => gs.filter((_, k) => k !== i)); setSinGuardar(true); }}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        ))}
                        <div className="d-flex justify-content-between small fw-semibold px-1">
                          <span>Total gastos</span><span>{pesos(gastosVivo)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Mercado Pago y cuenta corriente</div>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <Fila texto="Vendido por Mercado Pago" importe={caja.medios.mercadoPago.ventas} />
                      {caja.medios.mercadoPago.cobranza > 0 && <Fila texto="Cobranza por Mercado Pago" importe={caja.medios.mercadoPago.cobranza} />}
                      <Fila texto="Total Mercado Pago" importe={caja.medios.mercadoPago.total}
                        nota={`${caja.ticketsMP.length} ${caja.ticketsMP.length === 1 ? "ticket" : "tickets"} para rendir`} fuerte />
                      {caja.otros > 0 && <Fila texto="Otros medios (anteriores)" importe={caja.otros} />}
                      <Fila texto="Cuenta corriente (no entra plata)" importe={caja.cuentaCorriente} />
                    </tbody>
                  </table>
                </div>

                <label className="form-label fw-semibold small mt-3 mb-1">Observaciones</label>
                <textarea className="form-control" rows={2} value={observaciones}
                  onChange={(e) => { setObservaciones(e.target.value); setSinGuardar(true); }} />
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ForratucCajaPage;
