import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import BotonExcel from "../components/BotonExcel";
import BuscadorCliente from "../components/BuscadorCliente";
import {
  obtenerPlanPollitos,
  obtenerClientes,
  crearReservaPollitos,
  eliminarReservaPollitos,
  crearOrdenCargaPollitos,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import {
  formatearNumero,
  GRANJAS,
  labelGranja,
  prefijoGranja,
  diasHasta,
  textoDias,
} from "../utils/reproductoresUtils";
import { exportarTablaExcel } from "../utils/exportarExcel";
import Swal from "sweetalert2";

// Plan de Pollitos — la planilla del cliente hecha almanaque.
//
// Un calendario mensual: cada día muestra las CARGAS que nacen ese día, y cada
// carga contesta lo único que importa acá:
//
//     lo que va a nacer  −  lo que ya vendí  −  lo que mando a engorde  =  LIBRE
//
// La unidad es la CARGA `(lote, fechaIngreso)`, no la tanda: una carga son hasta
// 12 carros y partir el bloque en 12 pedazos hace la pantalla inservible para
// decidir. El reparto se hace desde el modal que abre cada carga.
//
// ⚠️ Todo se posiciona por la clave "AAAA-MM-DD" que manda el backend, NUNCA
// parseando la fecha ISO: el server corre en UTC y el navegador argentino en
// UTC−3, así que `new Date(iso).getDate()` corre el almanaque un día para atrás.
// Misma convención que components/Almanaque.jsx.

const VENTANAS = [60, 90, 120];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
// El almanaque argentino arranca el lunes.
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const nombreCliente = (c) => c?.razonSocial || c?.nombre || "Cliente";

const FORM_VACIO = { destino: "cliente", cliente: "", granja: "cañete", galpon: "", cantidad: "" };

// ── Claves de día ───────────────────────────────────────────────────────────
// Se arman y se leen como texto. Nunca pasa por Date, así no hay zona horaria.
const clave = (anio, mes, dia) =>
  `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

const partesClave = (k) => {
  const [anio, mes, dia] = k.split("-").map(Number);
  return { anio, mes: mes - 1, dia };
};

// Lunes = 0 … domingo = 6, que es como se dibuja la grilla.
const columnaDe = (anio, mes, dia) => (new Date(anio, mes, dia).getDay() + 6) % 7;

const diasDelMes = (anio, mes) => new Date(anio, mes + 1, 0).getDate();

// ── El color de una carga ───────────────────────────────────────────────────
// Es el semáforo de la pantalla: sobrevendida manda sobre todo lo demás.
const tonoCarga = (f) => {
  if (f.sobrevendida) return { clase: "border-danger bg-danger-subtle", texto: "text-danger-emphasis" };
  if (f.tipo === "proyectada")
    return { clase: "border-secondary-subtle bg-body-secondary", texto: "text-secondary-emphasis" };
  if (f.libre === 0) return { clase: "border-primary bg-primary-subtle", texto: "text-primary-emphasis" };
  return { clase: "border-success bg-success-subtle", texto: "text-success-emphasis" };
};

// A quién va una línea, en lo más corto que se entienda dentro de una celda.
const nombreCorto = (l) =>
  l.destino === "granja"
    ? `${labelGranja(l.granja)}${l.galpon ? ` ${prefijoGranja(l.granja)}${l.galpon}` : ""}`
    : nombreCliente(l.cliente);

// Cuántos destinos se listan en la celda antes de cortar con "+N más". Con más
// que esto el día se estira y el almanaque deja de leerse de un vistazo; el
// detalle completo está en el modal.
const MAX_LINEAS_CELDA = 4;

// ── Pastilla de una carga dentro de un día ──────────────────────────────────
// Además de los números de la carga muestra A QUIÉN está asignada: sin eso hay
// que abrir el modal de cada carga para saber quién se lleva qué, que es
// justamente lo que el almanaque tiene que evitar.
const Pastilla = ({ fila, onAbrir }) => {
  const tono = tonoCarga(fila);
  const visibles = fila.lineas.slice(0, MAX_LINEAS_CELDA);
  const resto = fila.lineas.length - visibles.length;

  return (
    <button
      type="button"
      className={`btn btn-sm w-100 text-start border rounded p-1 mb-1 ${tono.clase}`}
      onClick={() => onAbrir(fila)}
      title={
        `${fila.tipo === "proyectada" ? "Carga proyectada" : `Plantel #${fila.lote?.numeroLote}`}` +
        ` · a nacer ${formatearNumero(fila.aNacer)} · libre ${formatearNumero(fila.libre)}` +
        (fila.lineas.length
          ? `\n${fila.lineas
              .map((l) => `${nombreCorto(l)}: ${formatearNumero(l.cantidad)}`)
              .join("\n")}`
          : "")
      }
    >
      <div className="d-flex justify-content-between align-items-baseline lh-1">
        <span className={`small fw-semibold ${tono.texto}`}>
          {fila.tipo === "proyectada" ? (
            <>
              <i className="bi bi-hourglass-split me-1"></i>proy.
            </>
          ) : (
            <>#{fila.lote?.numeroLote ?? "?"}</>
          )}
        </span>
        <span className="fw-bold" style={{ fontSize: "0.78rem" }}>
          {formatearNumero(fila.aNacer)}
        </span>
      </div>

      <div className="lh-1 mt-1" style={{ fontSize: "0.72rem" }}>
        {fila.sobrevendida ? (
          <span className="text-danger fw-bold">se pasa {formatearNumero(-fila.libre)}</span>
        ) : fila.libre === 0 ? (
          <span className="text-primary fw-semibold">todo vendido</span>
        ) : (
          <>
            <span className="text-muted">libre </span>
            <span className="fw-bold text-success">{formatearNumero(fila.libre)}</span>
          </>
        )}
      </div>

      {visibles.length > 0 && (
        <div className="border-top mt-1 pt-1" style={{ fontSize: "0.7rem" }}>
          {visibles.map((l) => (
            <div
              key={l._id}
              className="d-flex justify-content-between gap-1 lh-sm"
              style={{ overflow: "hidden" }}
            >
              <span
                className="text-truncate"
                title={nombreCorto(l)}
              >
                <i
                  className={`bi ${
                    l.destino === "granja"
                      ? "bi-house-door text-success"
                      : l.orden
                      ? "bi-truck text-success"
                      : "bi-person text-primary"
                  } me-1`}
                ></i>
                {nombreCorto(l)}
              </span>
              <span className="fw-semibold text-nowrap">{formatearNumero(l.cantidad)}</span>
            </div>
          ))}
          {resto > 0 && <div className="text-muted fst-italic">+{resto} más</div>}
        </div>
      )}
    </button>
  );
};

// ── Modal de una carga: el reparto + el alta ────────────────────────────────
const CargaModal = ({ fila, clientes, onCerrar, onEmitir, onBorrar, onAgregada }) => {
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);

  const setCampo = (campo, valor) => setForm((p) => ({ ...p, [campo]: valor }));
  const galponesDisp = GRANJAS.find((g) => g.key === form.granja)?.galpones || 0;
  const pedidos = Number(form.cantidad) || 0;
  const excede = pedidos > fila.libre;
  const esProy = fila.tipo === "proyectada";

  const agregar = async (e) => {
    e.preventDefault();
    if (!pedidos) return;
    if (form.destino === "cliente" && !form.cliente) {
      Swal.fire("Falta el cliente", "Elegí a quién se le vende.", "warning");
      return;
    }
    setSaving(true);
    try {
      await crearReservaPollitos({
        // Las reservas cuelgan de una tanda; todas las de una carga comparten
        // lote y fecha de ingreso, así que el back las agrupa igual.
        tanda: fila.tandaReferencia,
        destino: form.destino,
        ...(form.destino === "cliente"
          ? { cliente: form.cliente }
          : { granja: form.granja, galpon: form.galpon || null }),
        cantidad: pedidos,
      });
      setForm(FORM_VACIO);
      await onAgregada();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo agregar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        {/* Sin `modal-dialog-scrollable` a propósito: eso le pone overflow al
            body y le corta el desplegable al buscador de clientes. Acá scrollea
            el modal entero. */}
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-egg-fried text-success me-2"></i>
                  {esProy ? "Carga proyectada" : `Plantel #${fila.lote?.numeroLote ?? "?"}`}
                  <span className="text-muted fw-normal">
                    {" · nacen el "}
                    {formatearFechaLocal(fila.fechaNacimiento)}
                  </span>
                </h5>
                <div className="small text-muted mt-1">
                  Entra a la incubadora el {formatearFechaLocal(fila.fechaIngreso)} ·{" "}
                  {formatearNumero(fila.huevosIngresados)} huevos · gordos el{" "}
                  {formatearFechaLocal(fila.fechaGordo)}
                  {!fila.nacio && ` · ${textoDias(diasHasta(fila.fechaNacimiento))}`}
                </div>
              </div>
              <button type="button" className="btn-close" onClick={onCerrar}></button>
            </div>

            <div className="modal-body">
              {/* Los tres números de la carga, que son los que se miran para
                  decidir cuánto más se puede prometer. */}
              <div className="row g-2 mb-3 text-center">
                <div className="col-3">
                  <div className="border rounded py-2">
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                      A nacer{fila.estimado ? " (est.)" : ""}
                    </div>
                    <div className="fw-bold">{formatearNumero(fila.aNacer)}</div>
                  </div>
                </div>
                <div className="col-3">
                  <div className="border rounded py-2">
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Clientes</div>
                    <div className="fw-bold text-primary">{formatearNumero(fila.aClientes)}</div>
                  </div>
                </div>
                <div className="col-3">
                  <div className="border rounded py-2">
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Engorde</div>
                    <div className="fw-bold text-success">{formatearNumero(fila.aGranja)}</div>
                  </div>
                </div>
                <div className="col-3">
                  <div className={`border border-2 rounded py-2 ${fila.sobrevendida ? "border-danger" : "border-success"}`}>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Libre</div>
                    <div className={`fw-bold ${fila.sobrevendida ? "text-danger" : "text-success"}`}>
                      {formatearNumero(fila.libre)}
                    </div>
                  </div>
                </div>
              </div>

              {esProy ? (
                <div className="alert alert-secondary py-2 small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  Esta carga todavía no se hizo: sale de la proyección de huevos de los planteles.
                  Se puede mirar para vender, pero recién se le pueden asignar pollitos cuando se
                  cargue la incubadora.
                </div>
              ) : (
                <>
                  {fila.lineas.length > 0 ? (
                    <div className="table-responsive mb-3">
                      <table className="table table-sm align-middle mb-0">
                        <thead>
                          <tr className="text-muted small">
                            <th>Destino</th>
                            <th className="text-end">Pollitos</th>
                            <th>Estado</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fila.lineas.map((l) => {
                            const esGranja = l.destino === "granja";
                            const puedeEmitir =
                              !esGranja && !l.orden && fila.nacio && l.estado !== "cancelada";
                            return (
                              <tr key={l._id}>
                                <td>
                                  {esGranja ? (
                                    <>
                                      <i className="bi bi-house-door text-success me-1"></i>
                                      <span className="fw-semibold">{labelGranja(l.granja)}</span>
                                      <span className="text-muted small">
                                        {l.galpon
                                          ? ` · ${prefijoGranja(l.granja)}${l.galpon}`
                                          : " · galpón a definir"}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <i className="bi bi-person text-primary me-1"></i>
                                      <span className="fw-semibold">{nombreCliente(l.cliente)}</span>
                                      {l.cliente?.telefono && (
                                        <span className="text-muted small">
                                          {" · "}
                                          {l.cliente.telefono}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>
                                <td className="text-end fw-semibold">
                                  {formatearNumero(l.cantidad)}
                                </td>
                                <td>
                                  {l.orden ? (
                                    <span
                                      className={`badge ${
                                        l.orden.estado === "entregada"
                                          ? "bg-success"
                                          : "bg-warning text-dark"
                                      }`}
                                    >
                                      {l.orden.numero} · {l.orden.estado}
                                    </span>
                                  ) : esGranja ? (
                                    <span className="badge bg-success-subtle text-success-emphasis">
                                      a engorde
                                    </span>
                                  ) : (
                                    <span className="badge bg-secondary-subtle text-secondary-emphasis">
                                      comprometido
                                    </span>
                                  )}
                                </td>
                                <td className="text-end text-nowrap">
                                  {puedeEmitir && (
                                    <button
                                      className="btn btn-sm btn-outline-success me-1"
                                      onClick={() => onEmitir(fila, l)}
                                      title="Emitir la orden de carga de estos pollitos"
                                    >
                                      <i className="bi bi-truck"></i>
                                    </button>
                                  )}
                                  {!l.orden && (
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => onBorrar(l)}
                                      title="Liberar estos pollitos"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted small mb-3">
                      <i className="bi bi-inbox me-1"></i>Esta carga todavía no tiene nada repartido.
                    </p>
                  )}

                  <hr />

                  <form onSubmit={agregar} className="row g-2 align-items-end">
                    <div className="col-6 col-md-3">
                      <label className="form-label small fw-semibold mb-1">Destino</label>
                      <select
                        className="form-select form-select-sm"
                        value={form.destino}
                        onChange={(e) => setCampo("destino", e.target.value)}
                      >
                        <option value="cliente">Cliente</option>
                        <option value="granja">Engorde propio</option>
                      </select>
                    </div>

                    {form.destino === "cliente" ? (
                      <div className="col-md-5">
                        <label className="form-label small fw-semibold mb-1">Cliente</label>
                        <BuscadorCliente
                          clientes={clientes}
                          value={form.cliente}
                          onChange={(id) => setCampo("cliente", id)}
                          size="sm"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="col-6 col-md-3">
                          <label className="form-label small fw-semibold mb-1">Granja</label>
                          <select
                            className="form-select form-select-sm"
                            value={form.granja}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, granja: e.target.value, galpon: "" }))
                            }
                          >
                            {GRANJAS.map((g) => (
                              <option key={g.key} value={g.key}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-6 col-md-2">
                          <label className="form-label small fw-semibold mb-1">Galpón</label>
                          <select
                            className="form-select form-select-sm"
                            value={form.galpon}
                            onChange={(e) => setCampo("galpon", e.target.value)}
                          >
                            <option value="">A definir</option>
                            {Array.from({ length: galponesDisp }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {prefijoGranja(form.granja)}
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="col-6 col-md-2">
                      <label className="form-label small fw-semibold mb-1">Pollitos</label>
                      <input
                        type="number"
                        min="1"
                        className={`form-control form-control-sm ${excede ? "is-invalid" : ""}`}
                        value={form.cantidad}
                        onChange={(e) => setCampo("cantidad", e.target.value)}
                        placeholder={
                          fila.libre > 0 ? `Hasta ${formatearNumero(fila.libre)}` : "Sin saldo"
                        }
                      />
                    </div>

                    <div className="col-6 col-md-2">
                      <button className="btn btn-sm btn-success w-100" disabled={saving || !pedidos}>
                        {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                        <i className="bi bi-plus-lg me-1"></i>Agregar
                      </button>
                    </div>

                    {excede && (
                      <div className="col-12">
                        <div className="alert alert-warning py-1 px-2 small mb-0 mt-1">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Se pasa de lo que va a nacer: quedan {formatearNumero(fila.libre)} libres.
                          Se puede igual, pero la carga queda marcada como sobrevendida.
                        </div>
                      </div>
                    )}
                  </form>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onCerrar}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
    </>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
const PlanPollitosPage = () => {
  const [plan, setPlan] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [dias, setDias] = useState(90);
  const [mes, setMes] = useState(null); // { anio, mes } — se fija al cargar
  const [abierta, setAbierta] = useState(null); // clave de la carga en el modal
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await obtenerPlanPollitos({ dias }));
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el plan.", "error");
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ⚠️ GET /clientes devuelve `{ clientes: [...] }`, no un array pelado.
  useEffect(() => {
    obtenerClientes()
      .then((c) => setClientes(Array.isArray(c) ? c : c?.clientes || []))
      .catch((err) =>
        Swal.fire("Error", err.message || "No se pudieron cargar los clientes.", "error")
      );
  }, []);

  const filas = useMemo(() => plan?.nacimientos || [], [plan]);
  const resumen = plan?.resumen;

  // El mes que se muestra lo maneja el usuario, así que se fija una sola vez
  // cuando llega el plan.
  //
  // ⚠️ Arranca en el mes del PRIMER NACIMIENTO, no en el de hoy: entre que se
  // carga la incubadora y que nace el pollito hay 21 días, así que abrir en el
  // mes corriente muestra un almanaque en blanco más de la mitad de las veces.
  // Si este mes ya tiene nacimientos, se queda en este mes.
  const mesActual = useMemo(() => {
    if (mes) return mes;
    if (!plan?.ventana?.claveHoy) return null;
    const hoy = partesClave(plan.ventana.claveHoy);
    const prefijoHoy = plan.ventana.claveHoy.slice(0, 7);
    const primera = plan.nacimientos?.[0]?.claveNacimiento;
    if (!primera || plan.nacimientos.some((f) => f.claveNacimiento.startsWith(prefijoHoy)))
      return { anio: hoy.anio, mes: hoy.mes };
    const p = partesClave(primera);
    return { anio: p.anio, mes: p.mes };
  }, [mes, plan]);

  // Las cargas de cada día, por clave. Un día puede tener más de una.
  const porDia = useMemo(() => {
    const mapa = new Map();
    for (const f of filas) {
      if (!mapa.has(f.claveNacimiento)) mapa.set(f.claveNacimiento, []);
      mapa.get(f.claveNacimiento).push(f);
    }
    return mapa;
  }, [filas]);

  // Hasta dónde se puede navegar: el primer y el último mes con nacimientos.
  const limites = useMemo(() => {
    if (!filas.length) return null;
    const primera = partesClave(filas[0].claveNacimiento);
    const ultima = partesClave(filas[filas.length - 1].claveNacimiento);
    return {
      min: primera.anio * 12 + primera.mes,
      max: ultima.anio * 12 + ultima.mes,
    };
  }, [filas]);

  const moverMes = (delta) => {
    if (!mesActual) return;
    const total = mesActual.anio * 12 + mesActual.mes + delta;
    setMes({ anio: Math.floor(total / 12), mes: total % 12 });
  };

  const indiceMes = mesActual ? mesActual.anio * 12 + mesActual.mes : 0;
  const puedeAtras = limites && indiceMes > limites.min;
  const puedeAdelante = limites && indiceMes < limites.max;

  // La grilla: semanas de 7 días arrancando el lunes, con los huecos del
  // principio y del final en blanco.
  const semanas = useMemo(() => {
    if (!mesActual) return [];
    const { anio, mes: m } = mesActual;
    const total = diasDelMes(anio, m);
    const celdas = [];
    for (let i = 0; i < columnaDe(anio, m, 1); i++) celdas.push(null);
    for (let d = 1; d <= total; d++) celdas.push(clave(anio, m, d));
    while (celdas.length % 7 !== 0) celdas.push(null);
    return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
  }, [mesActual]);

  // Totales del mes que se está mirando: el resumen de arriba es de la ventana
  // entera, y al navegar hace falta saber qué pasa en ESTE mes.
  const totalesMes = useMemo(() => {
    const vacio = { aNacer: 0, aClientes: 0, aGranja: 0, libre: 0, cargas: 0 };
    if (!mesActual) return vacio;
    const prefijo = `${mesActual.anio}-${String(mesActual.mes + 1).padStart(2, "0")}`;
    return filas
      .filter((f) => f.claveNacimiento.startsWith(prefijo))
      .reduce(
        (acc, f) => ({
          aNacer: acc.aNacer + f.aNacer,
          aClientes: acc.aClientes + f.aClientes,
          aGranja: acc.aGranja + f.aGranja,
          libre: acc.libre + f.libre,
          cargas: acc.cargas + 1,
        }),
        vacio
      );
  }, [filas, mesActual]);

  // La carga del modal se relee del plan en cada render: así, después de
  // agregar o borrar una línea, el modal muestra los números nuevos sin cerrarse.
  const filaAbierta = useMemo(
    () => (abierta ? filas.find((f) => f.clave === abierta) || null : null),
    [abierta, filas]
  );

  const emitirOrden = async (fila, linea) => {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "¿Emitir la orden de carga?",
      html:
        `<strong>${formatearNumero(linea.cantidad)}</strong> pollitos para ` +
        `${nombreCliente(linea.cliente)}.<br>` +
        `<span class="text-muted small">Queda pendiente con su código de retiro. ` +
        `El stock se descuenta recién al entregarla.</span>`,
      showCancelButton: true,
      confirmButtonText: "Sí, emitir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#198754",
    });
    if (!isConfirmed) return;
    try {
      const orden = await crearOrdenCargaPollitos({
        cliente: linea.cliente._id,
        cantidad: linea.cantidad,
        reserva: linea._id,
      });
      await cargar();
      Swal.fire({
        icon: "success",
        title: `Orden ${orden.numero}`,
        html: `Código de retiro: <strong class="fs-4">${orden.codigoRetiro}</strong>`,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo emitir la orden.", "error");
    }
  };

  const borrarLinea = async (linea) => {
    const quien =
      linea.destino === "granja" ? labelGranja(linea.granja) : nombreCliente(linea.cliente);
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Liberar estos pollitos?",
      text: `Vuelven a quedar libres ${formatearNumero(linea.cantidad)} pollitos de ${quien}.`,
      showCancelButton: true,
      confirmButtonText: "Sí, liberar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await eliminarReservaPollitos(linea._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo liberar.", "error");
    }
  };

  // Excel: una fila por línea del reparto, con la carga a la que pertenece.
  const exportarExcel = () =>
    exportarTablaExcel({
      filas: filas.flatMap((f) => (f.lineas.length ? f.lineas.map((l) => ({ f, l })) : [{ f, l: null }])),
      nombreHoja: "Plan de pollitos",
      nombreArchivo: "Reproductoras_plan_pollitos",
      columnas: [
        { header: "Nace", valor: ({ f }) => formatearFechaLocal(f.fechaNacimiento) },
        { header: "Gordo", valor: ({ f }) => formatearFechaLocal(f.fechaGordo) },
        { header: "Ingreso incubadora", valor: ({ f }) => formatearFechaLocal(f.fechaIngreso) },
        { header: "Plantel", valor: ({ f }) => f.lote?.numeroLote ?? "proyectada" },
        { header: "Huevos", valor: ({ f }) => f.huevosIngresados },
        { header: "A nacer", valor: ({ f }) => f.aNacer },
        { header: "Estimado", valor: ({ f }) => (f.estimado ? "Sí" : "No") },
        { header: "A clientes", valor: ({ f }) => f.aClientes },
        { header: "A engorde", valor: ({ f }) => f.aGranja },
        { header: "Libre", valor: ({ f }) => f.libre },
        {
          header: "Destino",
          valor: ({ l }) => (!l ? "" : l.destino === "granja" ? "Engorde propio" : "Cliente"),
        },
        {
          header: "Quién",
          valor: ({ l }) =>
            !l ? "" : l.destino === "granja" ? labelGranja(l.granja) : nombreCliente(l.cliente),
        },
        {
          header: "Galpón",
          valor: ({ l }) =>
            l?.destino === "granja" && l.galpon ? `${prefijoGranja(l.granja)}${l.galpon}` : "",
        },
        { header: "Pollitos", valor: ({ l }) => l?.cantidad ?? "" },
        { header: "Orden de carga", valor: ({ l }) => l?.orden?.numero ?? "" },
        { header: "Estado orden", valor: ({ l }) => l?.orden?.estado ?? "" },
      ],
    });

  const claveHoy = plan?.ventana?.claveHoy;

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-calendar3 text-success me-2"></i>Plan de Pollitos
            </h1>
            <p className="text-muted mb-0 small">
              Cuándo nace cada carga, cuánto está vendido, cuánto va a engorde y cuánto queda libre.
              Clic en una carga para repartirla.
            </p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <select
              className="form-select form-select-sm w-auto"
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
            >
              {VENTANAS.map((d) => (
                <option key={d} value={d}>
                  Próximos {d} días
                </option>
              ))}
            </select>
            <BotonExcel onClick={exportarExcel} disabled={filas.length === 0} titulo="Descargar el plan" />
            <button className="btn btn-outline-secondary btn-sm" onClick={cargar} disabled={loading}>
              <i className="bi bi-arrow-clockwise me-1"></i>Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : (
          <>
            {/* Resumen de la ventana entera. "Libre para vender" va aparte y más
                grande: es el número por el que se abre esta pantalla. */}
            <div className="row g-2 mb-3">
              {[
                { label: "A nacer", valor: resumen?.aNacer, clase: "" },
                { label: "Vendido a clientes", valor: resumen?.aClientes, clase: "text-primary" },
                { label: "A engorde propio", valor: resumen?.aGranja, clase: "text-success" },
              ].map((t) => (
                <div className="col-6 col-lg-3" key={t.label}>
                  <div className="card shadow-sm h-100">
                    <div className="card-body text-center py-2">
                      <div className="text-muted small">{t.label}</div>
                      <div className={`h4 fw-bold mb-0 ${t.clase}`}>
                        {formatearNumero(t.valor || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="col-6 col-lg-3">
                <div
                  className={`card shadow-sm h-100 border-2 ${
                    (resumen?.libre || 0) < 0 ? "border-danger" : "border-success"
                  }`}
                >
                  <div className="card-body text-center py-2">
                    <div className="text-muted small fw-semibold">LIBRE PARA VENDER</div>
                    <div
                      className={`h3 fw-bold mb-0 ${
                        (resumen?.libre || 0) < 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {formatearNumero(resumen?.libre || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {resumen?.sobrevendidas > 0 && (
              <div className="alert alert-warning py-2 small">
                <i className="bi bi-exclamation-triangle me-1"></i>
                Hay <strong>{resumen.sobrevendidas}</strong> carga(s) con más pollitos comprometidos
                de los que se esperan.
              </div>
            )}

            {/* ── El almanaque ── */}
            <div className="card shadow-sm">
              <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => moverMes(-1)}
                    disabled={!puedeAtras}
                    title="Mes anterior"
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>
                  <h5 className="mb-0 fw-bold" style={{ minWidth: 190, textAlign: "center" }}>
                    {mesActual ? `${MESES[mesActual.mes]} ${mesActual.anio}` : "—"}
                  </h5>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => moverMes(1)}
                    disabled={!puedeAdelante}
                    title="Mes siguiente"
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
                <div className="d-flex flex-wrap gap-3 small">
                  <span>
                    <span className="text-muted">Nacen </span>
                    <strong>{formatearNumero(totalesMes.aNacer)}</strong>
                  </span>
                  <span>
                    <span className="text-muted">Clientes </span>
                    <strong className="text-primary">{formatearNumero(totalesMes.aClientes)}</strong>
                  </span>
                  <span>
                    <span className="text-muted">Engorde </span>
                    <strong className="text-success">{formatearNumero(totalesMes.aGranja)}</strong>
                  </span>
                  <span>
                    <span className="text-muted">Libre </span>
                    <strong className={totalesMes.libre < 0 ? "text-danger" : "text-success"}>
                      {formatearNumero(totalesMes.libre)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Un mes sin nacimientos se ve igual que un error de carga, así
                  que lo dice y ofrece el atajo al primero que hay. */}
              {totalesMes.cargas === 0 && filas.length > 0 && (
                <div className="alert alert-info d-flex flex-wrap align-items-center gap-2 m-3 mb-0 py-2 small">
                  <i className="bi bi-info-circle"></i>
                  <span>
                    En {mesActual ? MESES[mesActual.mes].toLowerCase() : "este mes"} no nace ninguna
                    carga. El primer nacimiento es el{" "}
                    <strong>{formatearFechaLocal(filas[0].fechaNacimiento)}</strong>.
                  </span>
                  <button
                    className="btn btn-sm btn-info ms-auto"
                    onClick={() => {
                      const p = partesClave(filas[0].claveNacimiento);
                      setMes({ anio: p.anio, mes: p.mes });
                    }}
                  >
                    Ir ahí
                  </button>
                </div>
              )}

              <div className="card-body p-0">
                <div className="table-responsive">
                  {/* El almanaque entra en el ancho que haya: un scroll
                      horizontal rompe la lectura de un mes de un vistazo. Los
                      nombres que no entran se cortan con `text-truncate` y se
                      leen enteros en el tooltip o en el modal. El minWidth es
                      solo el piso para que en un celular no se aplaste. */}
                  <table className="table table-bordered mb-0" style={{ tableLayout: "fixed", minWidth: 680 }}>
                    <thead className="table-light">
                      <tr>
                        {DIAS_SEMANA.map((d) => (
                          <th key={d} className="text-center small py-1" style={{ width: "14.28%" }}>
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {semanas.map((semana, i) => (
                        <tr key={i}>
                          {semana.map((k, j) => {
                            if (!k) return <td key={j} className="bg-body-tertiary"></td>;
                            const cargas = porDia.get(k) || [];
                            const esHoy = k === claveHoy;
                            const { dia } = partesClave(k);
                            // El total del día: con dos cargas el mismo día,
                            // sumarlas de cabeza mirando la pantalla es
                            // exactamente lo que no hay que pedirle al usuario.
                            const nacenHoy = cargas.reduce((a, f) => a + f.aNacer, 0);
                            return (
                              <td
                                key={j}
                                className={`align-top p-1 ${esHoy ? "bg-warning-subtle" : ""}`}
                                // minHeight, no height: un día puede tener más
                                // de una carga y la celda tiene que crecer.
                                style={{ minHeight: 118, height: 118, verticalAlign: "top" }}
                              >
                                <div className="d-flex justify-content-between align-items-baseline mb-1">
                                  <span
                                    className={`small ${
                                      esHoy ? "fw-bold text-warning-emphasis" : "text-muted"
                                    }`}
                                  >
                                    {dia}
                                    {esHoy && <span className="ms-1">hoy</span>}
                                  </span>
                                  {nacenHoy > 0 && (
                                    <span
                                      className="badge bg-dark-subtle text-dark-emphasis"
                                      title={`Nacen ${formatearNumero(nacenHoy)} pollitos en ${
                                        cargas.length
                                      } carga(s)`}
                                    >
                                      {formatearNumero(nacenHoy)}
                                    </span>
                                  )}
                                </div>
                                {cargas.map((f) => (
                                  <Pastilla key={f.clave} fila={f} onAbrir={(x) => setAbierta(x.clave)} />
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card-footer bg-white small text-muted d-flex flex-wrap gap-3">
                <span>
                  <span className="badge border border-success bg-success-subtle me-1">&nbsp;</span>
                  queda libre
                </span>
                <span>
                  <span className="badge border border-primary bg-primary-subtle me-1">&nbsp;</span>
                  todo vendido
                </span>
                <span>
                  <span className="badge border border-danger bg-danger-subtle me-1">&nbsp;</span>
                  sobrevendida
                </span>
                <span>
                  <span className="badge border border-secondary-subtle bg-body-secondary me-1">
                    &nbsp;
                  </span>
                  proyectada (todavía no se cargó la incubadora)
                </span>
                <span className="ms-auto">
                  <span className="badge bg-dark-subtle text-dark-emphasis me-1">0.000</span>
                  nacen ese día ·{" "}
                  <i className="bi bi-person text-primary"></i> cliente ·{" "}
                  <i className="bi bi-truck text-success"></i> con orden emitida ·{" "}
                  <i className="bi bi-house-door text-success"></i> engorde propio
                </span>
              </div>
            </div>

            <p className="text-muted small mt-3 mb-0">
              <i className="bi bi-info-circle me-1"></i>
              Las cargas que no nacieron se cuentan al{" "}
              {plan?.parametros?.rendimientoEstimado ?? 80}% de los huevos, igual que la planilla.
            </p>
          </>
        )}
      </div>

      {filaAbierta && (
        <CargaModal
          fila={filaAbierta}
          clientes={clientes}
          onCerrar={() => setAbierta(null)}
          onEmitir={emitirOrden}
          onBorrar={borrarLinea}
          onAgregada={cargar}
        />
      )}
    </Layout>
  );
};

export default PlanPollitosPage;
