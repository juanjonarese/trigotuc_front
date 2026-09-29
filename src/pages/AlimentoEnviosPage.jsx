import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerConstantesAlimento,
  obtenerEnviosAlimento,
  crearEnvioAlimento,
  anularEnvioAlimento,
  obtenerCamiones,
  obtenerChoferes,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import { obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import { imprimirRemitoAlimento } from "../utils/imprimirRemitoAlimento";
import Swal from "sweetalert2";

const fmt = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

const ESTADO = {
  en_viaje: { label: "En viaje", clase: "bg-warning text-dark", icono: "bi-truck" },
  aceptado: { label: "Aceptado", clase: "bg-success",           icono: "bi-check2-circle" },
  anulado:  { label: "Anulado",  clase: "bg-secondary",         icono: "bi-x-circle" },
};

// Una línea del formulario. `presentacion` decide qué campos se piden: con bolsas
// los kg se derivan, a granel se cargan directo.
const LINEA_VACIA = { tipo: "", presentacion: "bolsa", bolsas: "", kgPorBolsa: "", kg: "" };

const kgDeLinea = (l) =>
  l.presentacion === "bolsa"
    ? (Number(l.bolsas) || 0) * (Number(l.kgPorBolsa) || 0)
    : Number(l.kg) || 0;

const AlimentoEnviosPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [envios, setEnvios] = useState([]);
  const [camiones, setCamiones] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [form, setForm] = useState({
    destino: "reproductoras",
    fechaEnvio: obtenerFechaHoy(),
    camion: "",
    chofer: "",
    numeroRemito: "",
    observaciones: "",
  });
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, data, cam, cho] = await Promise.all([
        obtenerConstantesAlimento(),
        obtenerEnviosAlimento(),
        obtenerCamiones().catch(() => ({ camiones: [] })),
        obtenerChoferes().catch(() => ({ choferes: [] })),
      ]);
      setConstantes(cons);
      setEnvios(data);
      setCamiones(cam.camiones || []);
      setChoferes(cho.choferes || []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los envíos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const tipos = constantes?.tipos || [];
  const etiquetaTipo = (key) => tipos.find((t) => t.key === key)?.etiqueta || key;

  const etiquetaDestino = (key) =>
    (constantes?.destinos || []).find((d) => d.key === key)?.etiqueta || key;

  // El remito sale por triplicado. Si el navegador bloquea la ventana emergente
  // hay que decirlo: si no, el usuario cree que imprimió y no salió nada.
  // Cómo se nombra cada alimento en el papel. Lo define el back para que el
  // remito y las pantallas no se puedan despegar.
  const detalleTipo = (key) =>
    tipos.find((t) => t.key === key)?.detalleRemito ||
    `ALIMENTO BALANCEADO ${(etiquetaTipo(key) || key).toUpperCase()}`;

  const imprimir = (envio) => {
    const ok = imprimirRemitoAlimento(envio, { detalleTipo, etiquetaDestino });
    if (!ok) {
      Swal.fire(
        "No se pudo abrir la impresión",
        "El navegador bloqueó la ventana. Permitila para este sitio y volvé a tocar Imprimir en la lista.",
        "warning"
      );
    }
  };

  const setLinea = (i, campo, valor) =>
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));

  const kgTotal = lineas.reduce((acc, l) => acc + kgDeLinea(l), 0);
  const lineasValidas = lineas.filter((l) => l.tipo && kgDeLinea(l) > 0);

  const limpiar = () => {
    setForm({
      destino: "reproductoras", fechaEnvio: obtenerFechaHoy(),
      camion: "", chofer: "", numeroRemito: "", observaciones: "",
    });
    setLineas([{ ...LINEA_VACIA }]);
    setMostrarForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lineasValidas.length === 0) {
      Swal.fire("Faltan datos", "Cargá al menos una línea con tipo y cantidad.", "warning");
      return;
    }
    setSaving(true);
    try {
      const envio = await crearEnvioAlimento({
        destino: form.destino,
        fechaEnvio: ajustarFechaParaGuardar(form.fechaEnvio),
        camion: form.camion || null,
        chofer: form.chofer || null,
        numeroRemito: form.numeroRemito || undefined,
        observaciones: form.observaciones || undefined,
        lineas: lineasValidas.map((l) => ({
          tipo: l.tipo,
          presentacion: l.presentacion,
          ...(l.presentacion === "bolsa"
            ? { bolsas: Number(l.bolsas), kgPorBolsa: Number(l.kgPorBolsa) }
            : { kg: Number(l.kg) }),
        })),
      });
      limpiar();
      await cargar();
      // Se imprime apenas se carga, que es como se usa: el papel va con el camión.
      imprimir(envio);
      Swal.fire({
        icon: "success",
        title: `Envío ${envio.numero}`,
        html:
          `${fmt(envio.kgTotales)} kg en camino.` +
          `<br/><span class="text-muted">Se abrió el remito por triplicado para imprimir.</span>` +
          `<br/><span class="text-muted">La granja tiene que aceptarlo para que entre al silo.</span>`,
        timer: 4000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo registrar el envío.", "error");
    } finally {
      setSaving(false);
    }
  };

  const anular = async (envio) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: `¿Anular el envío ${envio.numero}?`,
      html:
        envio.estado === "aceptado"
          ? `Ya fue aceptado: se van a <strong>sacar del silo</strong> sus ${fmt(envio.kgTotalesReales)} kg.` +
            `<br/><span class="text-muted">Si ya se consumió o se ajustó el silo, la operación se rechaza.</span>`
          : "Todavía está en viaje, así que no toca ningún stock.",
      input: "text",
      inputPlaceholder: "Por qué se anula",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Cancelar",
      inputValidator: (v) => (!v ? "Poné el motivo" : undefined),
    });
    if (!isConfirmed) return;
    try {
      await anularEnvioAlimento(envio._id, motivo);
      await cargar();
      Swal.fire("Anulado", `El envío ${envio.numero} quedó anulado.`, "success");
    } catch (err) {
      Swal.fire("No se pudo anular", err.message, "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid py-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h4 className="mb-0">
              <i className="bi bi-truck me-2"></i>Envíos de alimento
            </h4>
            <div className="text-muted small">
              Trigotuc despacha; el alimento entra al silo cuando la granja lo acepta.
            </div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
              <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
            </button>
            <button
              className={`btn ${mostrarForm ? "btn-outline-primary" : "btn-primary"}`}
              onClick={() => (mostrarForm ? limpiar() : setMostrarForm(true))}
            >
              <i className={`bi ${mostrarForm ? "bi-x-lg" : "bi-plus-lg"} me-1`}></i>
              {mostrarForm ? "Cancelar" : "Nuevo envío"}
            </button>
          </div>
        </div>

        {/* ── Formulario ── */}
        {mostrarForm && (
          <form onSubmit={handleSubmit} className="card shadow-sm mb-4">
            <div className="card-header bg-primary text-white py-2">
              <i className="bi bi-plus-circle me-2"></i>Nuevo envío de alimento
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-12 col-md-3">
                  <label className="form-label fw-semibold small mb-1">Destino</label>
                  <select
                    className="form-select form-select-sm"
                    value={form.destino}
                    onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))}
                    disabled={saving}
                  >
                    {(constantes?.destinos || []).map((d) => (
                      <option key={d.key} value={d.key}>{d.etiqueta}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label fw-semibold small mb-1">Fecha de salida</label>
                  <input
                    type="date" className="form-control form-control-sm"
                    value={form.fechaEnvio}
                    onChange={(e) => setForm((f) => ({ ...f, fechaEnvio: e.target.value }))}
                    disabled={saving} required
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label fw-semibold small mb-1">
                    N° de remito <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text" className="form-control form-control-sm"
                    value={form.numeroRemito}
                    onChange={(e) => setForm((f) => ({ ...f, numeroRemito: e.target.value }))}
                    disabled={saving} placeholder="0002 - 00024117" required
                  />
                  <div className="form-text">El del talonario: sale impreso en el remito.</div>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small mb-1">
                    Camión <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={form.camion}
                    onChange={(e) => setForm((f) => ({ ...f, camion: e.target.value }))}
                    disabled={saving}
                  >
                    <option value="">—</option>
                    {camiones.map((c) => (
                      <option key={c._id} value={c._id}>{c.marca} · {c.patente}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold small mb-1">
                    Chofer <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={form.chofer}
                    onChange={(e) => setForm((f) => ({ ...f, chofer: e.target.value }))}
                    disabled={saving}
                  >
                    <option value="">—</option>
                    {choferes.map((c) => (
                      <option key={c._id} value={c._id}>{c.nombreUsuario}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Líneas ── */}
              <label className="form-label fw-semibold small mb-1">
                Qué se manda — cada línea es un tipo, en bolsa o a granel
              </label>
              <div className="table-responsive mb-2">
                <table className="table table-sm table-bordered align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 170 }}>Tipo</th>
                      <th style={{ width: 120 }}>Presentación</th>
                      <th style={{ width: 110 }}>Bolsas</th>
                      <th style={{ width: 110 }}>Kg/bolsa</th>
                      <th style={{ width: 120 }}>Kg</th>
                      <th style={{ width: 48 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => {
                      const esBolsa = l.presentacion === "bolsa";
                      return (
                        <tr key={i}>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={l.tipo}
                              onChange={(e) => setLinea(i, "tipo", e.target.value)}
                              disabled={saving}
                            >
                              <option value="">— Elegí —</option>
                              {tipos.map((t) => (
                                <option key={t.key} value={t.key}>{t.etiqueta}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={l.presentacion}
                              onChange={(e) => setLinea(i, "presentacion", e.target.value)}
                              disabled={saving}
                            >
                              <option value="bolsa">Bolsa</option>
                              <option value="granel">Granel</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number" min="0" step="1"
                              className="form-control form-control-sm text-center"
                              value={esBolsa ? l.bolsas : ""}
                              onChange={(e) => setLinea(i, "bolsas", e.target.value)}
                              disabled={saving || !esBolsa}
                              placeholder={esBolsa ? "0" : "—"}
                            />
                          </td>
                          <td>
                            <input
                              type="number" min="0" step="0.1"
                              className="form-control form-control-sm text-center"
                              value={esBolsa ? l.kgPorBolsa : ""}
                              onChange={(e) => setLinea(i, "kgPorBolsa", e.target.value)}
                              disabled={saving || !esBolsa}
                              placeholder={esBolsa ? "25" : "—"}
                            />
                          </td>
                          <td>
                            {/* Con bolsas los kg NO se escriben: son bolsas × kg/bolsa. */}
                            {esBolsa ? (
                              <div className="form-control form-control-sm text-center bg-light fw-semibold">
                                {kgDeLinea(l) > 0 ? fmt(kgDeLinea(l)) : "—"}
                              </div>
                            ) : (
                              <input
                                type="number" min="0" step="0.1"
                                className="form-control form-control-sm text-center"
                                value={l.kg}
                                onChange={(e) => setLinea(i, "kg", e.target.value)}
                                disabled={saving}
                                placeholder="0"
                              />
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                              disabled={saving || lineas.length === 1}
                              title="Quitar la línea"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={4} className="text-end fw-semibold">Total</td>
                      <td className="text-center fw-bold">{fmt(kgTotal)} kg</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary mb-3"
                onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}
                disabled={saving}
              >
                <i className="bi bi-plus-lg me-1"></i>Agregar línea
              </button>

              <div>
                <label className="form-label fw-semibold small mb-1">
                  Observaciones <span className="text-muted fw-normal">(opcional)</span>
                </label>
                <input
                  type="text" className="form-control form-control-sm"
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="card-footer d-flex justify-content-end gap-2 py-2">
              <button type="button" className="btn btn-outline-secondary" onClick={limpiar} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || lineasValidas.length === 0}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-truck me-1"></i>Despachar {fmt(kgTotal)} kg
              </button>
            </div>
          </form>
        )}

        {/* ── Listado ── */}
        <div className="card shadow-sm">
          <div className="card-header bg-white py-2 fw-semibold">Historial de envíos</div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-4 text-center text-muted">
                <span className="spinner-border spinner-border-sm me-2"></span>Cargando…
              </div>
            ) : envios.length === 0 ? (
              <div className="p-4 text-center text-muted">
                Todavía no se despachó alimento. Tocá <strong>Nuevo envío</strong> para el primero.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>N°</th>
                      <th>Salida</th>
                      <th>Destino</th>
                      <th>Qué</th>
                      <th className="text-end">Enviado</th>
                      <th className="text-end">Recibido</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {envios.map((e) => {
                      const est = ESTADO[e.estado] || {};
                      const dif = e.kgTotalesReales != null ? e.kgTotalesReales - e.kgTotales : null;
                      return (
                        <tr key={e._id} className={e.estado === "anulado" ? "text-muted" : ""}>
                          <td className="fw-semibold">{e.numero}</td>
                          <td>{formatearFechaLocal(e.fechaEnvio)}</td>
                          <td className="text-capitalize">{e.destino}</td>
                          <td className="small">
                            {(e.lineas || []).map((l, i) => (
                              <div key={i}>
                                {etiquetaTipo(l.tipo)} ·{" "}
                                {l.presentacion === "bolsa"
                                  ? `${fmt(l.bolsas)} bolsas de ${fmt(l.kgPorBolsa)} kg`
                                  : `${fmt(l.kg)} kg granel`}
                                {l.reparto?.length ? (
                                  <span className="text-muted">
                                    {" → "}
                                    {l.reparto.length === 1
                                      ? `silo ${l.reparto[0].silo}`
                                      : l.reparto.map((t) => `silo ${t.silo} (${fmt(t.kg)} kg)`).join(" + ")}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </td>
                          <td className="text-end">{fmt(e.kgTotales)} kg</td>
                          <td className="text-end">
                            {e.kgTotalesReales != null ? (
                              <>
                                {fmt(e.kgTotalesReales)} kg
                                {dif !== 0 && (
                                  <div className={`small ${dif < 0 ? "text-danger" : "text-success"}`}>
                                    {dif > 0 ? "+" : ""}{fmt(dif)} kg
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${est.clase}`}>
                              <i className={`bi ${est.icono} me-1`}></i>{est.label}
                            </span>
                          </td>
                          <td className="text-end text-nowrap">
                            <button
                              className="btn btn-sm btn-outline-secondary me-1"
                              onClick={() => imprimir(e)}
                              title="Imprimir el remito por triplicado"
                            >
                              <i className="bi bi-printer"></i>
                            </button>
                            {e.estado !== "anulado" && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => anular(e)}
                                title="Anular el envío"
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AlimentoEnviosPage;
