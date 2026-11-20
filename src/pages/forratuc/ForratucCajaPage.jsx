import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { obtenerFechaHoy } from "../../utils/dateUtils";
import { escapeHtml } from "../../utils/escapeHtml";
import { imprimirCierreCajaForratuc, imprimirProductosVendidosForratuc } from "../../utils/forratuc/imprimirForratuc";
import {
  obtenerMiCajaForratuc, abrirCajaForratuc, obtenerCajaForratuc, listarCajasForratuc,
  guardarConteoCajaForratuc, cerrarCajaForratuc, reabrirCajaForratuc,
} from "../../services/api";

/**
 * Caja de Forratuc POR USUARIO, con apertura y cierre (2026-11-20, pedido del
 * usuario: "que haya apertura y cierre de caja, y que cada uno tenga su caja";
 * hoy Salvador y Lourdes). Hasta el 19/11 era una planilla por día.
 *
 *   · Arriba, MI caja: si está cerrada, se abre contando los billetes con que
 *     arranco (se propone lo que dejé en mi último cierre). Si está abierta, la
 *     rendición de siempre: lo vendido y cobrado con ella, la caja para el día
 *     siguiente, los billetes que se rinden y los gastos; se guarda a medias y
 *     se CIERRA. Sin caja abierta el back no deja vender ni cobrar.
 *   · Abajo, las cajas del período (las mías; el superadmin, las de todos): se
 *     abren para verlas o reimprimirlas. El superadmin además cierra la de otro,
 *     corrige una cerrada y reabre la última cerrada por error.
 *
 * ⚠️ La fórmula del efectivo es la del back (`efectivoARendir`); acá se repite
 * SOLO para mostrarla en vivo mientras se tipean los billetes.
 */

const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const fmt = (n) => new Intl.NumberFormat("es-AR").format(Number(n || 0));
const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
};

const Fila = ({ texto, importe, nota, fuerte }) => (
  <tr className={fuerte ? "fw-semibold" : ""}>
    <td>{texto}{nota && <span className="small text-muted ms-2">{nota}</span>}</td>
    <td className="text-end text-nowrap">{importe == null ? "—" : pesos(importe)}</td>
  </tr>
);

const BadgeControl = ({ control }) =>
  control == null ? (
    <span className="text-muted small">—</span>
  ) : control === 0 ? (
    <span className="badge bg-success">Cierra</span>
  ) : (
    <span className={`badge ${control > 0 ? "bg-warning text-dark" : "bg-danger"}`}>
      {control > 0 ? "Sobran" : "Faltan"} {pesos(Math.abs(control))}
    </span>
  );

// Tabla de billetes (cantidades a mano, subtotal y total).
const TablaBilletes = ({ titulo, subtitulo, billetes, valores, onChange, soloLectura }) => {
  const total = billetes.reduce((a, b) => a + b * (Number(valores?.[b]) || 0), 0);
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-header bg-white fw-semibold">
        {titulo}
        {subtitulo && <div className="small text-muted fw-normal">{subtitulo}</div>}
      </div>
      <div className="card-body p-2">
        <table className="table table-sm align-middle mb-0">
          <thead className="table-light">
            <tr><th>Billetes</th><th>Cantidades</th><th className="text-end">Subtotal</th></tr>
          </thead>
          <tbody>
            {billetes.map((b) => (
              <tr key={b}>
                <td className="text-nowrap">$ {fmt(b)}</td>
                <td style={{ width: 100 }}>
                  <input type="number" min="0" step="1" className={`form-control form-control-sm ${soloLectura ? "bg-light" : ""}`}
                    readOnly={soloLectura} tabIndex={soloLectura ? -1 : undefined}
                    value={valores?.[b] ?? ""} onChange={(e) => onChange?.(b, e.target.value)} />
                </td>
                <td className="text-end text-nowrap small">{pesos(b * (Number(valores?.[b]) || 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-bold"><td colSpan={2}>Total</td><td className="text-end text-nowrap">{pesos(total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// { 20000: "3", ... } desde las filas del back ([{ billete, cantidad }]).
const valoresDe = (filas = []) => Object.fromEntries(filas.map((f) => [f.billete, f.cantidad ? String(f.cantidad) : ""]));
const listaDe = (billetes, valores) =>
  billetes.filter((b) => valores?.[b] !== "" && valores?.[b] != null).map((b) => ({ billete: b, cantidad: Number(valores[b]) }));
const billetesInvalidos = (billetes, valores) =>
  billetes.find((b) => {
    const v = valores?.[b];
    return v !== "" && v != null && (!Number.isInteger(Number(v)) || Number(v) < 0);
  });

// ── Abrir mi caja ──────────────────────────────────────────────────────────
const AbrirCaja = ({ mia, onAbierta }) => {
  const [valores, setValores] = useState(() => valoresDe(mia.inicioPropuesto?.conteo?.filas));
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const total = mia.billetes.reduce((a, b) => a + b * (Number(valores[b]) || 0), 0);
  const propuesto = mia.inicioPropuesto?.conteo?.total ?? null;

  const abrir = async () => {
    const mal = billetesInvalidos(mia.billetes, valores);
    if (mal) return Swal.fire("Cantidad inválida", `Billete de $${fmt(mal)}: va sin decimales.`, "warning");
    const dif = propuesto == null ? 0 : total - propuesto;
    const { isConfirmed } = await Swal.fire({
      title: "¿Abrir la caja?",
      html: `Arrancás con <b>${pesos(total)}</b>.${dif !== 0 ? `<br><span class="text-danger">${dif > 0 ? "Hay" : "Faltan"} ${escapeHtml(pesos(Math.abs(dif)))} ${dif > 0 ? "más de" : "contra"} lo que dejaste en el último cierre.</span>` : ""}`,
      icon: "question", showCancelButton: true, confirmButtonText: "Abrir caja", cancelButtonText: "Volver",
    });
    if (!isConfirmed) return;
    setSaving(true);
    try {
      await abrirCajaForratuc({ conteos: { inicio: listaDe(mia.billetes, valores) }, observaciones: observaciones.trim() });
      Swal.fire({ icon: "success", title: "Caja abierta", text: "Ya podés vender y cobrar.", timer: 1500, showConfirmButton: false });
      onAbierta();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo abrir la caja.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body">
        <div className="d-flex flex-wrap gap-3 align-items-start">
          <div className="flex-grow-1" style={{ minWidth: 260 }}>
            <h5 className="mb-1"><i className="bi bi-lock me-2 text-secondary"></i>Tu caja está cerrada</h5>
            <p className="text-muted small mb-3">
              Para vender o cobrar tenés que abrirla. Contá los billetes con los que arrancás.
              {mia.inicioPropuesto
                ? <> Te propongo lo que dejaste al cerrar la <strong>{mia.inicioPropuesto.numero}</strong> ({pesos(propuesto)}).</>
                : <> Es tu primera caja: cargá lo que tenés.</>}
            </p>
            <label className="form-label small fw-semibold mb-1">Observaciones (opcional)</label>
            <textarea className="form-control form-control-sm mb-3" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            <div className="d-flex align-items-center gap-3">
              <button className="btn btn-success" onClick={abrir} disabled={saving}>
                {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-unlock me-1"></i>}
                Abrir caja con {pesos(total)}
              </button>
              {propuesto != null && total !== propuesto && (
                <span className="small text-danger">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  {total > propuesto ? "+" : "−"}{pesos(Math.abs(total - propuesto))} contra el último cierre
                </span>
              )}
            </div>
          </div>
          <div style={{ width: 340, maxWidth: "100%" }}>
            <TablaBilletes titulo="Caja inicio" billetes={mia.billetes} valores={valores}
              onChange={(b, v) => setValores((x) => ({ ...x, [b]: v }))} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── La rendición de una caja (la mía abierta, o una de la lista) ────────────
const RendicionCaja = ({ caja: inicial, esSuper, esMia, onCambio }) => {
  const [caja, setCaja] = useState(inicial);
  const [conteos, setConteos] = useState({});
  const [gastos, setGastos] = useState([]);
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [sinGuardar, setSinGuardar] = useState(false);

  const cargarEstado = (c) => {
    setCaja(c);
    setConteos(Object.fromEntries(c.tiposConteo.map((t) => [t.key, valoresDe(c.conteos[t.key].filas)])));
    setGastos((c.gastos || []).map((g) => ({ concepto: g.concepto, importe: String(g.importe) })));
    setObservaciones(c.observaciones || "");
    setSinGuardar(false);
  };
  useEffect(() => { cargarEstado(inicial); }, [inicial]);

  const abierta = caja.estado === "abierta";
  // Cuenta billetes el dueño mientras está abierta; el superadmin, siempre.
  const editable = esSuper || (abierta && esMia);
  const subtotal = (t) => caja.billetes.reduce((a, b) => a + b * (Number(conteos[t]?.[b]) || 0), 0);
  const inicio = subtotal("inicio");
  const cierre = subtotal("cierre");
  const bolsa = subtotal("bolsa");
  const totalGastos = gastos.reduce((a, g) => a + (Number(g.importe) || 0), 0);
  const aRendir = Math.round((inicio + caja.medios.efectivo.total - totalGastos - cierre) * 100) / 100;
  const contoAlgo = !abierta || ["cierre", "bolsa"].some((t) => Object.values(conteos[t] || {}).some((v) => v !== ""));
  const control = contoAlgo ? Math.round((bolsa - aRendir) * 100) / 100 : null;

  const setCantidad = (t, b, v) => { setConteos((c) => ({ ...c, [t]: { ...c[t], [b]: v } })); setSinGuardar(true); };
  const setGasto = (i, cambios) => { setGastos((gs) => gs.map((g, k) => (k === i ? { ...g, ...cambios } : g))); setSinGuardar(true); };

  const datos = () => ({
    conteos: Object.fromEntries(
      caja.tiposConteo
        .filter((t) => t.key !== "inicio" || esSuper)
        .map((t) => [t.key, listaDe(caja.billetes, conteos[t.key])])
    ),
    observaciones: observaciones.trim(),
    gastos: gastos.filter((g) => g.concepto.trim() || g.importe !== "").map((g) => ({ concepto: g.concepto.trim(), importe: Number(g.importe) })),
  });
  const validar = () => {
    for (const t of caja.tiposConteo) {
      const mal = billetesInvalidos(caja.billetes, conteos[t.key]);
      if (mal) { Swal.fire("Cantidad inválida", `${t.etiqueta}, billete de $${fmt(mal)}: va sin decimales.`, "warning"); return false; }
    }
    return true;
  };

  const guardar = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      cargarEstado(await guardarConteoCajaForratuc(caja.id, datos()));
      Swal.fire({ icon: "success", title: "Conteo guardado", timer: 1200, showConfirmButton: false });
      onCambio?.();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const cerrar = async () => {
    if (!validar()) return;
    const sinContar = !["cierre", "bolsa"].some((t) => Object.values(conteos[t] || {}).some((v) => v !== ""));
    const { isConfirmed } = await Swal.fire({
      title: `¿Cerrar la caja ${escapeHtml(caja.numero)}?`,
      html: `A rendir: <b>${escapeHtml(pesos(aRendir))}</b> · Billetes que se rinden: <b>${escapeHtml(pesos(bolsa))}</b><br>` +
        (control === 0 ? `<span class="text-success">Cierra justo.</span>` :
          `<span class="text-danger">${control > 0 ? "Sobran" : "Faltan"} ${escapeHtml(pesos(Math.abs(control || 0)))}.</span>`) +
        (sinContar ? `<br><br><b>No contaste ningún billete del cierre.</b>` : "") +
        `<br><br>Cerrada, ya no se vende con ella${esMia ? "" : ` (es la caja de ${escapeHtml(caja.usuario.nombre || "")})`}.`,
      icon: "warning", showCancelButton: true, confirmButtonText: "Cerrar caja", cancelButtonText: "Volver", confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    setSaving(true);
    try {
      const c = await cerrarCajaForratuc(caja.id, datos());
      cargarEstado(c);
      onCambio?.(c);
      const { isConfirmed: imprimirYa } = await Swal.fire({
        icon: "success", title: "Caja cerrada", text: "¿Imprimís la rendición para entregar con la plata?",
        showCancelButton: true, confirmButtonText: "Imprimir", cancelButtonText: "Ahora no",
      });
      if (imprimirYa) imprimirCierreCajaForratuc(c, { operador: c.usuario.nombre || "" });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cerrar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const reabrir = async () => {
    const { isConfirmed } = await Swal.fire({
      title: `¿Reabrir la caja ${escapeHtml(caja.numero)}?`,
      text: `Vuelve a quedar abierta para ${caja.usuario.nombre || "su usuario"}, que va a poder seguir vendiendo con ella.`,
      icon: "question", showCancelButton: true, confirmButtonText: "Reabrir", cancelButtonText: "Volver",
    });
    if (!isConfirmed) return;
    try {
      const c = await reabrirCajaForratuc(caja.id);
      cargarEstado(c);
      onCambio?.(c);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo reabrir.", "error");
    }
  };

  const imprimir = (modo = "resumen") => {
    if (sinGuardar) return Swal.fire("Falta guardar", "Guardá el conteo antes de imprimir.", "warning");
    imprimirCierreCajaForratuc(caja, { operador: caja.usuario.nombre || "", modo });
  };

  return (
    <>
      {/* ── Encabezado de la caja ── */}
      <div className={`alert ${abierta ? "alert-success" : "alert-secondary"} py-2 d-flex flex-wrap gap-2 align-items-center justify-content-between`}>
        <div className="small">
          <span className={`badge ${abierta ? "bg-success" : "bg-secondary"} me-2`}>{abierta ? "ABIERTA" : "CERRADA"}</span>
          <strong>{caja.numero}</strong> · {caja.usuario.nombre} · abierta {fechaHora(caja.abiertaEn)}
          {!abierta && <> · cerrada {fechaHora(caja.cerradaEn)}{caja.cerradaPor && caja.cerradaPor !== caja.usuario.nombre ? ` por ${caja.cerradaPor}` : ""}</>}
          {caja.diferenciaInicio ? (
            <span className="text-danger ms-2">
              <i className="bi bi-exclamation-triangle me-1"></i>
              Arrancó con {pesos(Math.abs(caja.diferenciaInicio))} {caja.diferenciaInicio > 0 ? "más" : "menos"} de lo que dejó en la {caja.inicioAnterior.numero}
            </span>
          ) : null}
          {sinGuardar && <strong className="ms-2">Hay cambios sin guardar.</strong>}
        </div>
        <div className="d-flex flex-wrap gap-2">
          {editable && (
            <button className="btn btn-outline-success btn-sm" onClick={guardar} disabled={saving}>
              <i className="bi bi-check-lg me-1"></i>Guardar conteo
            </button>
          )}
          {abierta && (esMia || esSuper) && (
            <button className="btn btn-danger btn-sm" onClick={cerrar} disabled={saving}>
              {saving ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-lock me-1"></i>}
              Cerrar caja
            </button>
          )}
          {!abierta && esSuper && (
            <button className="btn btn-outline-secondary btn-sm" onClick={reabrir}>
              <i className="bi bi-unlock me-1"></i>Reabrir
            </button>
          )}
          <div className="btn-group">
            <button className="btn btn-outline-dark btn-sm" onClick={() => imprimir()}
              title="Billetes, rendición del efectivo (con los gastos) y rendición de Mercado Pago">
              <i className="bi bi-printer me-1"></i>Imprimir resumen
            </button>
            <button type="button" className="btn btn-outline-dark btn-sm dropdown-toggle dropdown-toggle-split"
              data-bs-toggle="dropdown" aria-expanded="false">
              <span className="visually-hidden">Más impresiones</span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <button className="dropdown-item" onClick={() => imprimir("completa")}>
                  <i className="bi bi-list-ul me-2"></i>Planilla completa (ventas, cheques y comprobantes)
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={() => imprimirProductosVendidosForratuc(caja, { operador: caja.usuario.nombre || "" })}>
                  <i className="bi bi-box-seam me-2"></i>Productos vendidos (cantidad y $)
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Billetes ── */}
      <div className="row g-3 mb-3">
        {["inicio", "cierre", "bolsa"].map((k) => caja.tiposConteo.find((t) => t.key === k)).filter(Boolean).map((t) => (
          <div key={t.key} className="col-12 col-md-4">
            <TablaBilletes
              titulo={t.etiqueta}
              subtitulo={t.key === "inicio" ? "Contado al abrir la caja" : null}
              billetes={caja.billetes}
              valores={conteos[t.key]}
              soloLectura={!editable || (t.key === "inicio" && !esSuper)}
              onChange={(b, v) => setCantidad(t.key, b, v)}
            />
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold">Rendición del efectivo</div>
            <table className="table table-sm mb-0">
              <tbody>
                <Fila texto="Caja inicio" importe={inicio} />
                <Fila texto="+ Vendido en efectivo" importe={caja.medios.efectivo.ventas} />
                {caja.medios.efectivo.cobranza > 0 && <Fila texto="+ Cobranza en efectivo" importe={caja.medios.efectivo.cobranza} />}
                <Fila texto="− Gastos de caja" importe={totalGastos} />
                <Fila texto="− Caja para el día siguiente" importe={cierre} />
                <Fila texto="A rendir" importe={aRendir} fuerte />
                <Fila texto="Billetes que se rinden" importe={bolsa} />
                <tr>
                  <td className="fw-semibold">Control</td>
                  <td className="text-end text-nowrap">
                    {control == null ? <span className="text-muted small">falta el conteo</span> : <BadgeControl control={control} />}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="card-footer bg-white small text-muted">
              {caja.detalle.filter((d) => !d.anulado).length} comprobantes · ventas {pesos(caja.totalVentas)}
              {caja.totalCobranza > 0 && <> · cobranza {pesos(caja.totalCobranza)}</>}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center">
              Gastos de caja
              {editable && (
                <button type="button" className="btn btn-sm btn-outline-primary"
                  onClick={() => { setGastos((gs) => [...gs, { concepto: "", importe: "" }]); setSinGuardar(true); }}>
                  <i className="bi bi-plus-lg me-1"></i>Agregar gasto
                </button>
              )}
            </div>
            <div className="card-body p-2">
              {gastos.length === 0 ? (
                <div className="small text-muted px-1">Sin gastos.</div>
              ) : (
                <>
                  {gastos.map((g, i) => (
                    <div key={i} className="d-flex gap-2 mb-2">
                      <input className="form-control form-control-sm" placeholder="En qué se gastó (ej. lavandina)" readOnly={!editable}
                        value={g.concepto} onChange={(e) => setGasto(i, { concepto: e.target.value })} />
                      <div className="input-group input-group-sm" style={{ maxWidth: 160 }}>
                        <span className="input-group-text">$</span>
                        <input type="number" min="0" step="0.01" className="form-control text-end sin-flechas" readOnly={!editable}
                          value={g.importe} onChange={(e) => setGasto(i, { importe: e.target.value })} />
                      </div>
                      {editable && (
                        <button type="button" className="btn btn-sm btn-outline-danger border-0" title="Quitar"
                          onClick={() => { setGastos((gs) => gs.filter((_, k) => k !== i)); setSinGuardar(true); }}>
                          <i className="bi bi-x-lg"></i>
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="d-flex justify-content-between small fw-semibold px-1">
                    <span>Total gastos</span><span>{pesos(totalGastos)}</span>
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
                {(caja.otrosPorMedio || []).map((m) => (
                  <Fila key={m.medio} texto={`Cobrado con ${m.etiqueta.toLowerCase()}`} importe={m.importe}
                    nota={["cheque", "echeq"].includes(m.medio) ? "se rinde el cheque, no la plata" : undefined} />
                ))}
                <Fila texto="Cuenta corriente (no entra plata)" importe={caja.cuentaCorriente} />
              </tbody>
            </table>
            {(caja.cheques || []).length > 0 && (
              <div className="card-body pt-2">
                <div className="small fw-semibold mb-1">Cheques para rendir</div>
                <table className="table table-sm small mb-0">
                  <thead><tr><th>Recibo</th><th>Cliente</th><th>Banco y n°</th><th>Cobro</th><th className="text-end">Importe</th></tr></thead>
                  <tbody>
                    {caja.cheques.map((c, i) => (
                      <tr key={i}>
                        <td>{c.numero}</td>
                        <td>{c.cliente}</td>
                        <td>{c.medio} {c.banco} {c.serie ? `serie ${c.serie}` : ""} {c.numeroCheque ? `n° ${c.numeroCheque}` : ""}</td>
                        <td className="text-nowrap">{c.fechaCobro ? String(c.fechaCobro).slice(0, 10).split("-").reverse().join("/") : "—"}</td>
                        <td className="text-end">{pesos(c.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <label className="form-label fw-semibold small mt-3 mb-1">Observaciones</label>
          <textarea className="form-control" rows={2} value={observaciones} readOnly={!editable}
            onChange={(e) => { setObservaciones(e.target.value); setSinGuardar(true); }} />
        </div>
      </div>
    </>
  );
};

// ── La página ──────────────────────────────────────────────────────────────
const ForratucCajaPage = () => {
  const navigate = useNavigate();
  const esSuper = localStorage.getItem("rolUsuario") === "superadmin";
  const [mia, setMia] = useState(null);
  const [vista, setVista] = useState(null); // null = mi caja; si no, la caja de la lista que se está mirando
  const [cajas, setCajas] = useState([]);
  const [filtros, setFiltros] = useState({ desde: haceDias(7), hasta: obtenerFechaHoy(), usuario: "" });
  const [loading, setLoading] = useState(true);
  // Los usuarios que aparecieron en la lista (el filtro no se achica al elegir uno).
  const [usuariosVistos, setUsuariosVistos] = useState({});

  const cargarMia = useCallback(async () => {
    try {
      setMia(await obtenerMiCajaForratuc());
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo leer tu caja.", "error");
    } finally {
      setLoading(false);
    }
  }, []);
  const cargarCajas = useCallback(async () => {
    try {
      const lista = await listarCajasForratuc(filtros);
      setCajas(lista);
      setUsuariosVistos((u) => ({ ...u, ...Object.fromEntries(lista.map((c) => [c.usuario.id, c.usuario.nombre])) }));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron listar las cajas.", "error");
    }
  }, [filtros]);
  useEffect(() => { cargarMia(); }, [cargarMia]);
  useEffect(() => { cargarCajas(); }, [cargarCajas]);

  const ver = async (id) => {
    if (mia?.abierta?.id === id) return setVista(null);
    try {
      setVista(await obtenerCajaForratuc(id));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo abrir la caja.", "error");
    }
  };
  const alCambiar = () => { cargarMia(); cargarCajas(); };
  const usuariosLista = Object.entries(usuariosVistos);

  return (
    <Layout>
      <div className="container-fluid">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
          <h1 className="h3 mb-0">
            <button className="btn btn-outline-secondary btn-sm me-2 align-middle" onClick={() => navigate("/forratuc")}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <i className="bi bi-cash-stack me-2 text-success"></i>
            Caja
          </h1>
          {vista && (
            <button className="btn btn-outline-primary btn-sm" onClick={() => setVista(null)}>
              <i className="bi bi-arrow-left me-1"></i>Volver a mi caja
            </button>
          )}
        </div>

        {loading && !mia ? (
          <div className="text-center p-4"><div className="spinner-border text-primary" role="status"></div></div>
        ) : vista ? (
          <RendicionCaja key={vista.id} caja={vista} esSuper={esSuper} esMia={vista.id === mia?.abierta?.id} onCambio={alCambiar} />
        ) : mia?.abierta ? (
          <RendicionCaja key={mia.abierta.id} caja={mia.abierta} esSuper={esSuper} esMia onCambio={alCambiar} />
        ) : mia ? (
          <AbrirCaja key={mia.inicioPropuesto?.numero || "primera"} mia={mia} onAbierta={alCambiar} />
        ) : null}

        {/* ── Las cajas del período ── */}
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header bg-white d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <span className="fw-semibold">{esSuper ? "Cajas" : "Mis cajas"}</span>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <input type="date" className="form-control form-control-sm" style={{ width: "auto" }} value={filtros.desde}
                onChange={(e) => e.target.value && setFiltros((f) => ({ ...f, desde: e.target.value }))} />
              <span className="small text-muted">a</span>
              <input type="date" className="form-control form-control-sm" style={{ width: "auto" }} value={filtros.hasta}
                onChange={(e) => e.target.value && setFiltros((f) => ({ ...f, hasta: e.target.value }))} />
              {esSuper && (
                <select className="form-select form-select-sm" style={{ width: "auto" }} value={filtros.usuario}
                  onChange={(e) => setFiltros((f) => ({ ...f, usuario: e.target.value }))}>
                  <option value="">Todos</option>
                  {usuariosLista.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Caja</th>
                  {esSuper && <th>Usuario</th>}
                  <th>Abierta</th>
                  <th>Cerrada</th>
                  <th className="text-end">Ventas</th>
                  <th className="text-end">Efectivo</th>
                  <th className="text-end">Mercado Pago</th>
                  <th className="text-end">A rendir</th>
                  <th className="text-center">Control</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cajas.length === 0 ? (
                  <tr><td colSpan={esSuper ? 10 : 9} className="text-center text-muted small py-3">Sin cajas en el período.</td></tr>
                ) : cajas.map((c) => (
                  <tr key={c.id} className={vista?.id === c.id ? "table-active" : ""} style={{ cursor: "pointer" }} onClick={() => ver(c.id)}>
                    <td className="text-nowrap">
                      <strong>{c.numero}</strong>
                      {c.estado === "abierta" && <span className="badge bg-success ms-2">abierta</span>}
                    </td>
                    {esSuper && <td>{c.usuario.nombre}</td>}
                    <td className="text-nowrap small">{fechaHora(c.abiertaEn)}</td>
                    <td className="text-nowrap small">{fechaHora(c.cerradaEn)}</td>
                    <td className="text-end text-nowrap">{pesos(c.totalVentas)}</td>
                    <td className="text-end text-nowrap">{pesos(c.efectivo)}</td>
                    <td className="text-end text-nowrap">{pesos(c.mercadoPago)}</td>
                    <td className="text-end text-nowrap">{pesos(c.aRendir)}</td>
                    <td className="text-center"><BadgeControl control={c.control} /></td>
                    <td className="text-end"><i className="bi bi-chevron-right text-muted"></i></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ForratucCajaPage;
