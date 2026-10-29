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
 * A mano se cargan solo los BILLETES (caja de inicio, bolsa y caja de cierre).
 * Ventas por rubro, cobranza, Mercado Pago, cuenta corriente, el efectivo y el
 * control los calcula el back de los presupuestos y cobros del día
 * (GET /caja-forratuc/:fecha). ⚠️ La fórmula del efectivo vive SOLO en el back
 * (`efectivoDeLaPlanilla`): acá se muestra la que devuelve al guardar.
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
      Object.fromEntries(caja.conteos[t.key].filas.map((f) => [f.billete, caja.guardado && f.cantidad ? String(f.cantidad) : ""])),
    ])
  );

const ForratucCajaPage = () => {
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [caja, setCaja] = useState(null);
  const [conteos, setConteos] = useState({});
  const [observaciones, setObservaciones] = useState("");
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
      });
      setCaja(c);
      setConteos(conteosDeCaja(c));
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
                Cargá los billetes de la caja de inicio, la bolsa y la caja de cierre, y guardá: el efectivo y el control
                salen de ahí.
              </div>
            )}

            {/* ── Billetes ── */}
            <div className="row g-3 mb-3">
              {caja.tiposConteo.map((t) => (
                <div key={t.key} className="col-12 col-md-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-header bg-white fw-semibold">{t.etiqueta}</div>
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
                                <input type="number" min="0" step="1" className="form-control form-control-sm"
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
              ))}
            </div>

            <div className="row g-3">
              {/* ── Ventas y cobranza ── */}
              <div className="col-12 col-lg-5">
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-header bg-white fw-semibold">Ventas</div>
                  <table className="table table-sm mb-0">
                    <tbody>
                      {caja.ventas.map((v) => <Fila key={v.key} texto={v.etiqueta} importe={v.importe} />)}
                      <Fila texto="Total ventas" importe={caja.totalVentas} fuerte />
                      <Fila texto="Cobranza" importe={caja.totalCobranza} nota="cobros de cuenta corriente" />
                    </tbody>
                  </table>
                </div>

                {/* ── Rendición ── */}
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Rendición</div>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <Fila texto="Efectivo" importe={caja.efectivoPlanilla} nota="Caja inicio + Bolsa − Caja cierre" fuerte />
                      <Fila texto="Efectivo según comprobantes" importe={caja.medios.efectivo.total}
                        nota={`ventas ${pesos(caja.medios.efectivo.ventas)} + cobranza ${pesos(caja.medios.efectivo.cobranza)}`} />
                      <Fila texto="Mercado Pago" importe={caja.medios.mercadoPago.total}
                        nota={`ventas ${pesos(caja.medios.mercadoPago.ventas)} + cobranza ${pesos(caja.medios.mercadoPago.cobranza)}`} />
                      {caja.otros > 0 && <Fila texto="Otros medios (anteriores)" importe={caja.otros} />}
                      <Fila texto="Cuenta corriente" importe={caja.cuentaCorriente} />
                      <tr>
                        <td className="fw-semibold">Control</td>
                        <td className="text-end text-nowrap">
                          {caja.control == null ? (
                            <span className="text-muted small">falta el conteo</span>
                          ) : caja.control === 0 ? (
                            <span className="badge bg-success">Cierra</span>
                          ) : (
                            <span className={`badge ${caja.control > 0 ? "bg-warning text-dark" : "bg-danger"}`}>
                              {caja.control > 0 ? "Sobran" : "Faltan"} {pesos(Math.abs(caja.control))}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <label className="form-label fw-semibold small mt-3 mb-1">Observaciones</label>
                <textarea className="form-control" rows={2} value={observaciones}
                  onChange={(e) => { setObservaciones(e.target.value); setSinGuardar(true); }} />
              </div>

              {/* ── Detalle de comprobantes ── */}
              <div className="col-12 col-lg-7">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white fw-semibold">Detalle de comprobantes</div>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr><th>Comprobante</th><th>Cliente</th><th>Forma de pago</th><th>Operador</th><th className="text-end">Importe</th></tr>
                      </thead>
                      <tbody>
                        {caja.detalle.length === 0 ? (
                          <tr><td colSpan={5} className="text-muted text-center py-3">Sin comprobantes en el día.</td></tr>
                        ) : caja.detalle.map((d) => (
                          <tr key={`${d.tipo}-${d.numero}`} className={d.anulado ? "text-muted" : ""}>
                            <td className="text-nowrap">
                              {d.tipo === "cobro" ? "Recibo" : "Presupuesto"} {d.numero}
                              {d.anulado && <span className="badge bg-danger ms-1">Anulado</span>}
                            </td>
                            <td>{d.cliente}</td>
                            <td className="small">{d.forma}</td>
                            <td className="small">{d.operador || "—"}</td>
                            <td className={`text-end text-nowrap ${d.anulado ? "text-decoration-line-through" : ""}`}>{pesos(d.importe)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ForratucCajaPage;
