import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import BotonExcel from "../components/BotonExcel";
import BuscadorCliente from "../components/BuscadorCliente";
import {
  obtenerPlanPollitos,
  moverCargaIncubadora,
  obtenerClientes,
  crearReservaPollitos,
  eliminarReservaPollitos,
  pasarReservaPollitos,
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
// Un calendario mensual: cada día muestra la CARGA que nace ese día, y cada
// carga contesta lo único que importa acá:
//
//     lo que va a nacer  −  lo que ya vendí  −  lo que mando a engorde  =  LIBRE
//
// La unidad es el DÍA DE CARGA, con todos sus planteles juntos (pedido del
// cliente, 2026-10-04: el total del día, no partido por plantel ni por tanda).
// El reparto se hace desde el modal que abre cada carga.
//
// Las cargas que vienen son los LUNES y JUEVES, como en la planilla P7 del
// cliente: si el saldo de huevos no llena la máquina, ese día no se carga y 21
// días después NO NACE NADA (pastilla "no alcanza"). Cada carga se puede correr
// un día para un lado o el otro desde su modal, y los feriados se ven en el
// almanaque.
//
// Desde el 2026-10-01 también se reparten las cargas PROYECTADAS: la empresa
// vende a futuro contando con lo que va a nacer. Esas reservas van ancladas a la
// fecha de nacimiento y, cuando se hace la carga real, se PASAN A MANO (botón
// "Pasar" de cada línea). Si la carga proyectada de ese día desaparece antes de
// pasarlas, quedan en una fila "sin carga" en rojo.
//
// ⚠️ Todo se posiciona por la clave "AAAA-MM-DD" que manda el backend, NUNCA
// parseando la fecha ISO: el server corre en UTC y el navegador argentino en
// UTC−3, así que `new Date(iso).getDate()` corre el almanaque un día para atrás.
// Misma convención que components/Almanaque.jsx.

// Por defecto 6 meses (pedido del usuario, 2026-10-04): las cargas se venden con
// meses de anticipación.
const VENTANAS = [60, 90, 120, 180];
const VENTANA_POR_DEFECTO = 180;

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

// Correr una clave n días, sin pasar por ISO (se arma la fecha local).
const correrClave = (k, n) => {
  const { anio, mes, dia } = partesClave(k);
  const d = new Date(anio, mes, dia + n);
  return clave(d.getFullYear(), d.getMonth(), d.getDate());
};

const NOMBRE_DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// "lun 05/10", a partir de la clave.
const textoClave = (k) => {
  if (!k) return "-";
  const { anio, mes, dia } = partesClave(k);
  const nombre = NOMBRE_DIA[new Date(anio, mes, dia).getDay()];
  return `${nombre} ${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
};

// Los planteles de una carga real: "#29 · #30".
const textoLotes = (f) =>
  f.lotes?.length ? f.lotes.map((l) => `#${l.numeroLote ?? "?"}`).join(" · ") : "";

// ── El color de una carga ───────────────────────────────────────────────────
// Es el semáforo de la pantalla: sobrevendida manda sobre todo lo demás.
const tonoCarga = (f) => {
  if (f.tipo === "sin_carga") return { clase: "border-danger border-2 bg-danger-subtle", texto: "text-danger-emphasis" };
  if (f.tipo === "no_alcanza")
    return { clase: "border-danger bg-body-tertiary", texto: "text-danger-emphasis", punteado: true };
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
      style={tono.punteado ? { borderStyle: "dashed" } : undefined}
      onClick={() => onAbrir(fila)}
      title={
        `${
          fila.tipo === "sin_carga"
            ? "Compromisos sin carga: hay que pasarlos a la carga real"
            : fila.tipo === "no_alcanza"
            ? `No alcanza el huevo para cargar el ${textoClave(fila.claveIngreso)}: hay ${formatearNumero(
                fila.carga?.huevosDisponibles || 0
              )}`
            : fila.tipo === "proyectada"
            ? `Carga proyectada · entra el ${textoClave(fila.claveIngreso)}`
            : `Planteles ${textoLotes(fila)}`
        }` +
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
          {fila.tipo === "sin_carga" ? (
            <>
              <i className="bi bi-exclamation-octagon me-1"></i>sin carga
            </>
          ) : fila.tipo === "no_alcanza" ? (
            <>
              <i className="bi bi-x-octagon me-1"></i>no nacen
            </>
          ) : fila.tipo === "proyectada" ? (
            <>
              <i className="bi bi-hourglass-split me-1"></i>proyección
              {fila.carga?.motivo && (
                <i
                  className="bi bi-arrow-left-right ms-1"
                  title={fila.carga.motivo === "feriado" ? "Corrida por feriado" : "Movida a mano"}
                ></i>
              )}
            </>
          ) : (
            <>{textoLotes(fila)}</>
          )}
        </span>
        <span className="fw-bold" style={{ fontSize: "0.78rem" }}>
          {fila.tipo === "no_alcanza" ? "0" : formatearNumero(fila.aNacer)}
        </span>
      </div>

      <div className="lh-1 mt-1" style={{ fontSize: "0.72rem" }}>
        {fila.tipo === "sin_carga" ? (
          <span className="text-danger fw-bold">pasar {formatearNumero(fila.comprometido)}</span>
        ) : fila.tipo === "no_alcanza" && !fila.comprometido ? (
          <span className="text-danger">
            no alcanza el huevo
          </span>
        ) : fila.sobrevendida ? (
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
                    l.proyectada
                      ? "bi-hourglass-split text-secondary"
                      : l.destino === "granja"
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
// ── La carga de lunes/jueves: saldo de huevos y mover el día ────────────────
// Solo para las cargas que todavía no se hicieron. Es lo que en la planilla P7
// del cliente es la columna "Saldo Huevos" + el "NO se puede".
const BloqueCarga = ({ fila, onMover }) => {
  const [moviendo, setMoviendo] = useState(false);
  const c = fila.carga;
  if (!c) return null;
  const noAlcanza = c.estado === "no_alcanza";

  const mover = async (fecha) => {
    setMoviendo(true);
    try {
      await onMover(c.fechaHabitual, fecha);
    } finally {
      setMoviendo(false);
    }
  };

  return (
    <div className={`border rounded p-2 mb-3 small ${noAlcanza ? "border-danger bg-danger-subtle" : "bg-body-tertiary"}`}>
      {noAlcanza ? (
        <div className="text-danger-emphasis mb-2">
          <i className="bi bi-x-octagon me-1"></i>
          <strong>No alcanza el huevo para cargar el {textoClave(c.claveIngreso)}.</strong> Hay{" "}
          <strong>{formatearNumero(c.huevosDisponibles)}</strong> huevos incubables y hacen falta{" "}
          {formatearNumero(57600)}
          {c.carrosPosibles > 0 && ` (alcanza para ${c.carrosPosibles} carros)`}. Si no se carga, este
          día <strong>no nacen pollitos</strong>; el huevo queda para la carga siguiente.
        </div>
      ) : (
        <div className="mb-2">
          <i className="bi bi-egg me-1 text-success"></i>
          Huevos incubables para cargar el {textoClave(c.claveIngreso)}:{" "}
          <strong>{formatearNumero(c.huevosDisponibles)}</strong> · después de cargar quedan{" "}
          <strong>{formatearNumero(c.saldoDespues)}</strong>
        </div>
      )}

      {c.naceEnFeriado && (
        <div className="text-warning-emphasis mb-2">
          <i className="bi bi-exclamation-triangle me-1"></i>
          Nace en feriado ({c.naceEnFeriado}). Si ese día no se puede sacar, mové la carga.
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="text-muted">
          Día de carga: <strong>{textoClave(c.claveIngreso)}</strong>
          {c.motivo === "feriado" && ` (el ${textoClave(c.fechaHabitual)} es feriado: ${c.feriadoHabitual})`}
          {c.motivo === "manual" && ` (movida; le tocaba el ${textoClave(c.fechaHabitual)})`}
        </span>
        <div className="btn-group btn-group-sm ms-auto">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={moviendo}
            onClick={() => mover(correrClave(c.claveIngreso, -1))}
            title="Cargar un día antes"
          >
            <i className="bi bi-chevron-left"></i> Un día antes
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={moviendo}
            onClick={() => mover(correrClave(c.claveIngreso, 1))}
            title="Cargar un día después"
          >
            Un día después <i className="bi bi-chevron-right"></i>
          </button>
        </div>
        {c.motivo === "manual" && (
          <button
            type="button"
            className="btn btn-sm btn-link p-0"
            disabled={moviendo}
            onClick={() => mover(null)}
          >
            Volver a su día
          </button>
        )}
      </div>
    </div>
  );
};

const CargaModal = ({ fila, destinos, clientes, onCerrar, onEmitir, onBorrar, onPasar, onAgregada, onMover }) => {
  const [form, setForm] = useState(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  // La línea que se está pasando a otra carga, y a cuál.
  const [pasando, setPasando] = useState(null);
  const [destinoPaso, setDestinoPaso] = useState("");

  const setCampo = (campo, valor) => setForm((p) => ({ ...p, [campo]: valor }));
  const galponesDisp = GRANJAS.find((g) => g.key === form.granja)?.galpones || 0;
  const pedidos = Number(form.cantidad) || 0;
  const excede = pedidos > fila.libre;
  const esProy = fila.tipo === "proyectada";
  const sinCarga = fila.tipo === "sin_carga";
  const noAlcanza = fila.tipo === "no_alcanza";

  // A dónde se puede pasar una reserva: cualquier carga real, u otra proyectada.
  const opcionesPaso = destinos.filter(
    (f) => f.clave !== fila.clave && f.tipo !== "sin_carga" && f.tipo !== "no_alcanza"
  );

  const abrirPaso = (l) => {
    // Se sugiere la carga real que nace el mismo día que se prometió, que es el
    // caso normal: se hizo la carga y hay que pasarle lo comprometido.
    const mismoDia = opcionesPaso.find(
      (f) => f.tipo === "real" && f.claveNacimiento === l.claveNacimientoProyectada
    );
    setDestinoPaso(mismoDia?.clave || "");
    setPasando(l);
  };

  const confirmarPaso = async () => {
    const dest = opcionesPaso.find((f) => f.clave === destinoPaso);
    if (!dest || !pasando) return;
    setSaving(true);
    try {
      await onPasar(
        pasando,
        dest.tipo === "real" ? { tanda: dest.tandaReferencia } : { fechaNacimiento: dest.claveNacimiento }
      );
      setPasando(null);
    } finally {
      setSaving(false);
    }
  };

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
        // lote y fecha de ingreso, así que el back las agrupa igual. Una carga
        // proyectada no tiene tanda: la reserva va contra el día en que nace.
        ...(esProy ? { fechaNacimiento: fila.claveNacimiento } : { tanda: fila.tandaReferencia }),
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
                  {sinCarga
                    ? "Compromisos sin carga"
                    : noAlcanza
                    ? "No nacen pollitos"
                    : esProy
                    ? "Carga proyectada"
                    : `Planteles ${textoLotes(fila)}`}
                  <span className="text-muted fw-normal">
                    {" · "}
                    {noAlcanza || sinCarga ? "el " : "nacen el "}
                    {textoClave(fila.claveNacimiento)}
                  </span>
                </h5>
                {!sinCarga && !noAlcanza && (
                  <div className="small text-muted mt-1">
                    Entra a la incubadora el {textoClave(fila.claveIngreso)} ·{" "}
                    {formatearNumero(fila.huevosIngresados)} huevos · gordos el{" "}
                    {textoClave(fila.claveGordo)}
                    {!fila.nacio && ` · ${textoDias(diasHasta(fila.fechaNacimiento))}`}
                  </div>
                )}
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
                      A nacer
                      {fila.estimado
                        ? ` (est.${fila.rendimiento ? ` ${Math.round(fila.rendimiento)}%` : ""})`
                        : ""}
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

              {(esProy || noAlcanza) && <BloqueCarga fila={fila} onMover={onMover} />}

              {sinCarga && (
                <div className="alert alert-danger py-2 small">
                  <i className="bi bi-exclamation-octagon me-1"></i>
                  Estos pollitos se comprometieron sobre una carga proyectada que nacía este día, y esa
                  carga ya no está (se hizo la real o la proyección se corrió). Pasalos a la carga
                  real con <i className="bi bi-arrow-right-square"></i>, o a otro día proyectado.
                </div>
              )}
              {esProy && (
                <div className="alert alert-secondary py-2 small">
                  <i className="bi bi-info-circle me-1"></i>
                  Esta carga todavía no se hizo: sale de la proyección de huevos de los planteles. Lo
                  que comprometas acá queda para este día y, cuando se cargue la incubadora, lo pasás a
                  la carga real con <i className="bi bi-arrow-right-square"></i>.
                </div>
              )}
              {noAlcanza && fila.lineas.length > 0 && (
                <div className="alert alert-danger py-2 small">
                  <i className="bi bi-exclamation-octagon me-1"></i>
                  Hay pollitos comprometidos para un día en que no nace nada. Mové la carga a un día
                  en que alcance el huevo, o pasá cada reserva a otra carga con{" "}
                  <i className="bi bi-arrow-right-square"></i>.
                </div>
              )}

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
                              {l.proyectada ? (
                                <span className="badge bg-secondary-subtle text-secondary-emphasis">
                                  <i className="bi bi-hourglass-split me-1"></i>a futuro
                                </span>
                              ) : l.orden ? (
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
                              {l.proyectada && l.estado === "reservada" && (
                                <button
                                  className="btn btn-sm btn-outline-primary me-1"
                                  onClick={() => abrirPaso(l)}
                                  title="Pasar a la carga real (o a otro día)"
                                >
                                  <i className="bi bi-arrow-right-square"></i>
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
              ) : noAlcanza ? null : (
                <p className="text-muted small mb-3">
                  <i className="bi bi-inbox me-1"></i>Esta carga todavía no tiene nada repartido.
                </p>
              )}

              {pasando && (
                <div className="border border-primary rounded p-2 mb-3 bg-primary-subtle">
                  <div className="small fw-semibold mb-2">
                    Pasar {formatearNumero(pasando.cantidad)} pollitos de {nombreCorto(pasando)} a:
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <select
                      className="form-select form-select-sm flex-grow-1 w-auto"
                      value={destinoPaso}
                      onChange={(e) => setDestinoPaso(e.target.value)}
                      disabled={saving}
                    >
                      <option value="">— Elegí la carga —</option>
                      {opcionesPaso.map((f) => (
                        <option key={f.clave} value={f.clave}>
                          {`Nace ${textoClave(f.claveNacimiento)} · ${
                            f.tipo === "real" ? `${textoLotes(f)} (real)` : "proyectada"
                          } · libre ${formatearNumero(f.libre)}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={confirmarPaso}
                      disabled={saving || !destinoPaso}
                    >
                      Pasar
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setPasando(null)}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!sinCarga && !noAlcanza && (
                <>
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

// ── Vista de lista ──────────────────────────────────────────────────────────
// La otra forma de ver el mes, pedida por el cliente (2026-10-04): como su
// Excel "Programación Pollitos", los días para abajo y la información a la
// derecha. Una fila por carga, más los feriados del mes, para ver de corrido
// qué nace, a quién va y qué queda libre. El clic abre el mismo modal.
const CLAVE_VISTA = "planPollitos.vista";

const ListaMes = ({ filas, feriados, prefijoMes, claveHoy, onAbrir }) => {
  // Los feriados del mes que no tienen carga también van, como fila suelta:
  // son justamente los días en que hay que mover algo.
  const conCarga = new Set(filas.map((f) => f.claveNacimiento));
  const soloFeriados = [...feriados.entries()]
    .filter(([k]) => prefijoMes && k.startsWith(prefijoMes) && !conCarga.has(k))
    .map(([k, nombre]) => ({ feriado: true, clave: `fer|${k}`, claveNacimiento: k, nombre }));
  const renglones = [...filas, ...soloFeriados].sort((a, b) =>
    a.claveNacimiento < b.claveNacimiento ? -1 : a.claveNacimiento > b.claveNacimiento ? 1 : 0
  );

  if (!renglones.length)
    return <p className="text-muted small m-3">No nace ninguna carga este mes.</p>;

  return (
    <div className="card-body p-0">
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0" style={{ minWidth: 900 }}>
          <thead className="table-light small">
            <tr>
              <th>Nace</th>
              <th>Entra</th>
              <th>Gordo</th>
              <th>Carga</th>
              <th className="text-end">Huevos</th>
              <th className="text-end">A nacer</th>
              <th className="text-center" style={{ minWidth: 240 }}>A quién va</th>
              <th className="text-end">Clientes</th>
              <th className="text-end">Engorde</th>
              <th className="text-end">Libre</th>
            </tr>
          </thead>
          <tbody>
            {renglones.map((f) => {
              if (f.feriado)
                return (
                  <tr key={f.clave} className="table-danger">
                    <td className="fw-semibold text-nowrap">{textoClave(f.claveNacimiento)}</td>
                    <td colSpan={9} className="small text-danger-emphasis">
                      <i className="bi bi-flag-fill me-1"></i>Feriado: {f.nombre}
                    </td>
                  </tr>
                );

              const noAlcanza = f.tipo === "no_alcanza";
              const sinCarga = f.tipo === "sin_carga";
              const feriado = feriados.get(f.claveNacimiento);
              const esHoy = f.claveNacimiento === claveHoy;
              return (
                <tr
                  key={f.clave}
                  className={noAlcanza || sinCarga ? "table-danger" : esHoy ? "table-warning" : ""}
                  style={{ cursor: "pointer" }}
                  onClick={() => onAbrir(f)}
                >
                  <td className="fw-semibold text-nowrap">
                    {textoClave(f.claveNacimiento)}
                    {esHoy && <span className="badge bg-warning text-dark ms-1">hoy</span>}
                    {feriado && (
                      <div className="small text-danger-emphasis fw-normal" title={feriado}>
                        <i className="bi bi-flag-fill me-1"></i>feriado
                      </div>
                    )}
                  </td>
                  <td className="text-nowrap small">
                    {sinCarga ? "—" : textoClave(f.claveIngreso)}
                    {f.carga?.motivo && (
                      <i
                        className="bi bi-arrow-left-right ms-1 text-muted"
                        title={f.carga.motivo === "feriado" ? "Corrida por feriado" : "Movida a mano"}
                      ></i>
                    )}
                  </td>
                  <td className="text-nowrap small text-muted">
                    {noAlcanza || sinCarga ? "—" : textoClave(f.claveGordo)}
                  </td>
                  <td className="small text-nowrap">
                    {sinCarga ? (
                      <span className="text-danger fw-semibold">
                        <i className="bi bi-exclamation-octagon me-1"></i>sin carga
                      </span>
                    ) : noAlcanza ? (
                      <span className="text-danger fw-semibold">
                        <i className="bi bi-x-octagon me-1"></i>no alcanza el huevo
                      </span>
                    ) : f.tipo === "proyectada" ? (
                      <span className="text-secondary">
                        <i className="bi bi-hourglass-split me-1"></i>proyectada
                      </span>
                    ) : (
                      <span>
                        {textoLotes(f)}
                        {f.nacio && <span className="badge bg-success ms-1">nació</span>}
                      </span>
                    )}
                  </td>
                  <td className="text-end small">
                    {noAlcanza ? (
                      <span className="text-danger" title="Huevos que había para cargar">
                        hay {formatearNumero(f.carga?.huevosDisponibles || 0)}
                      </span>
                    ) : sinCarga ? (
                      "—"
                    ) : (
                      formatearNumero(f.huevosIngresados)
                    )}
                  </td>
                  <td className="text-end fw-bold text-nowrap">
                    {formatearNumero(f.aNacer)}
                    {f.estimado && f.rendimiento ? (
                      <div className="small text-muted fw-normal">{Math.round(f.rendimiento)}% est.</div>
                    ) : null}
                  </td>
                  <td className="small">
                    {f.lineas.length === 0 ? (
                      <div className="text-center text-muted fst-italic">sin asignar</div>
                    ) : (
                      f.lineas.map((l) => (
                        <div key={l._id} className="d-flex justify-content-between gap-2">
                          <span className="text-truncate" title={nombreCorto(l)}>
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
                      ))
                    )}
                  </td>
                  <td className="text-end text-primary">{formatearNumero(f.aClientes)}</td>
                  <td className="text-end text-success">{formatearNumero(f.aGranja)}</td>
                  <td
                    className={`text-end fw-bold ${
                      f.libre < 0 ? "text-danger" : f.libre === 0 ? "text-primary" : "text-success"
                    }`}
                  >
                    {formatearNumero(f.libre)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
const PlanPollitosPage = () => {
  const [plan, setPlan] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [dias, setDias] = useState(VENTANA_POR_DEFECTO);
  const [mes, setMes] = useState(null); // { anio, mes } — se fija al cargar
  const [abierta, setAbierta] = useState(null); // clave de la carga en el modal
  // Almanaque o lista. Se recuerda en el navegador: es preferencia de quien mira.
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_VISTA) === "lista" ? "lista" : "almanaque";
    } catch {
      return "almanaque";
    }
  });
  const cambiarVista = (v) => {
    setVista(v);
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Sin almacenamiento la vista vuelve al almanaque al recargar; no importa.
    }
  };
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const nuevo = await obtenerPlanPollitos({ dias });
      setPlan(nuevo);
      return nuevo;
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

  // Los feriados del almanaque, por clave.
  const feriados = useMemo(
    () => new Map((plan?.feriados || []).map((f) => [f.clave, f.nombre])),
    [plan]
  );

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
  const prefijoMes = mesActual
    ? `${mesActual.anio}-${String(mesActual.mes + 1).padStart(2, "0")}`
    : null;
  // Las cargas que nacen en el mes que se está mirando: las usan los totales y
  // la vista de lista.
  const filasMes = useMemo(
    () => (prefijoMes ? filas.filter((f) => f.claveNacimiento.startsWith(prefijoMes)) : []),
    [filas, prefijoMes]
  );

  const totalesMes = useMemo(() => {
    const vacio = { aNacer: 0, aClientes: 0, aGranja: 0, libre: 0, cargas: 0 };
    if (!mesActual) return vacio;
    return filasMes
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
  }, [filasMes, mesActual]);

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

  // Pasar una reserva a otra carga: lo comprometido sobre una proyectada, a la
  // carga real cuando se hace (o a otro día si la proyección se corrió).
  const pasarLinea = async (linea, destino) => {
    try {
      await pasarReservaPollitos(linea._id, destino);
      await cargar();
      Swal.fire({ icon: "success", title: "Reserva pasada", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo pasar la reserva.", "error");
      throw err;
    }
  };

  // Mover una carga de lunes/jueves. Al moverla cambia su clave (es el día), así
  // que el modal se vuelve a enganchar buscando la carga por su día habitual.
  const moverCarga = async (fechaHabitual, fecha) => {
    try {
      const r = await moverCargaIncubadora(fechaHabitual, fecha);
      const nuevo = await cargar();
      const f = nuevo?.nacimientos?.find((x) => x.carga?.fechaHabitual === fechaHabitual);
      if (f) {
        const pc = partesClave(f.claveNacimiento);
        setMes({ anio: pc.anio, mes: pc.mes });
        setAbierta(f.clave);
      } else {
        setAbierta(null);
      }
      if (r.reservasMovidas)
        Swal.fire({
          icon: "info",
          title: "Carga movida",
          text: `Se movieron con ella ${r.reservasMovidas} reserva(s).`,
          timer: 2200,
          showConfirmButton: false,
        });
    } catch (err) {
      Swal.fire("No se pudo mover", err.message || "Error al mover la carga.", "error");
    }
  };

  // Excel: una fila por línea del reparto, con la carga a la que pertenece.
  const exportarExcel = () =>
    exportarTablaExcel({
      filas: filas.flatMap((f) => (f.lineas.length ? f.lineas.map((l) => ({ f, l })) : [{ f, l: null }])),
      nombreHoja: "Plan de pollitos",
      nombreArchivo: "Reproductoras_plan_pollitos",
      columnas: [
        { header: "Nace", valor: ({ f }) => textoClave(f.claveNacimiento) },
        { header: "Gordo", valor: ({ f }) => textoClave(f.claveGordo) },
        { header: "Ingreso incubadora", valor: ({ f }) => textoClave(f.claveIngreso) },
        {
          header: "Planteles",
          valor: ({ f }) =>
            f.tipo === "real"
              ? textoLotes(f)
              : f.tipo === "sin_carga"
              ? "sin carga (a pasar)"
              : f.tipo === "no_alcanza"
              ? "no alcanza el huevo"
              : "proyectada",
        },
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
        { header: "A futuro", valor: ({ l }) => (l?.proyectada ? "Sí" : "") },
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
                  {d === 180 ? "Próximos 6 meses" : `Próximos ${d} días`}
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

            {/* Compromisos tomados sobre cargas proyectadas que ya no están: no se
                pasan solos a la carga real (decisión del usuario), así que se avisa
                arriba de todo para que no queden olvidados. */}
            {resumen?.pendientesDePasar > 0 && (
              <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2 py-2 small">
                <i className="bi bi-exclamation-octagon"></i>
                <span>
                  Hay <strong>{formatearNumero(resumen.pendientesDePasar)}</strong> pollitos comprometidos
                  sobre cargas proyectadas que ya no están ({resumen.diasPendientesDePasar} día(s)).
                  Pasalos a la carga real.
                </span>
                <button
                  className="btn btn-sm btn-danger ms-auto"
                  onClick={() => {
                    const f = filas.find((x) => x.tipo === "sin_carga");
                    if (!f) return;
                    const pc = partesClave(f.claveNacimiento);
                    setMes({ anio: pc.anio, mes: pc.mes });
                    setAbierta(f.clave);
                  }}
                >
                  Ver el primero
                </button>
              </div>
            )}

            {/* Los días en que NO nacen pollitos porque no alcanzó el huevo para
                la carga de 21 días antes. Es lo que el cliente necesita saber de
                antemano (pedido del usuario, 2026-10-04): cada uno lleva al día. */}
            {plan?.cargas &&
              (() => {
                const sinNacimiento = plan.cargas.filter((c) => c.estado === "no_alcanza");
                if (sinNacimiento.length === 0)
                  return (
                    <div className="alert alert-success d-flex align-items-center gap-2 py-2 small">
                      <i className="bi bi-check2-circle"></i>
                      <span>
                        En {dias === 180 ? "los próximos 6 meses" : `los próximos ${dias} días`} no
                        hay días sin nacimientos por falta de huevo.
                      </span>
                    </div>
                  );
                return (
                  <div className="alert alert-danger py-2 small">
                    <div className="fw-semibold mb-1">
                      <i className="bi bi-x-octagon me-1"></i>
                      {sinNacimiento.length === 1
                        ? "1 día sin nacimientos por falta de huevo:"
                        : `${sinNacimiento.length} días sin nacimientos por falta de huevo:`}
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      {sinNacimiento.map((c) => (
                        <button
                          key={c.fechaHabitual}
                          type="button"
                          className="btn btn-sm btn-outline-danger bg-white"
                          title={`La carga del ${textoClave(c.claveIngreso)} no llena la máquina: hay ${formatearNumero(
                            c.huevosDisponibles
                          )} huevos (${c.carrosPosibles} carros)`}
                          onClick={() => {
                            const pc = partesClave(c.claveNacimiento);
                            setMes({ anio: pc.anio, mes: pc.mes });
                            setAbierta(`noalc|${c.claveIngreso}`);
                          }}
                        >
                          <strong>{textoClave(c.claveNacimiento)}/{c.claveNacimiento.slice(2, 4)}</strong>
                          <span className="text-muted ms-1">
                            · carga {textoClave(c.claveIngreso)} · hay {formatearNumero(c.huevosDisponibles)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
                  <div className="btn-group btn-group-sm ms-2" role="group" aria-label="Vista">
                    <button
                      type="button"
                      className={`btn ${vista === "almanaque" ? "btn-success" : "btn-outline-success"}`}
                      onClick={() => cambiarVista("almanaque")}
                    >
                      <i className="bi bi-calendar3 me-1"></i>Almanaque
                    </button>
                    <button
                      type="button"
                      className={`btn ${vista === "lista" ? "btn-success" : "btn-outline-success"}`}
                      onClick={() => cambiarVista("lista")}
                    >
                      <i className="bi bi-list-ul me-1"></i>Lista
                    </button>
                  </div>
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

              {vista === "lista" ? (
                <ListaMes
                  filas={filasMes}
                  feriados={feriados}
                  prefijoMes={prefijoMes}
                  claveHoy={claveHoy}
                  onAbrir={(x) => setAbierta(x.clave)}
                />
              ) : (
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
                            const feriado = feriados.get(k);
                            return (
                              <td
                                key={j}
                                className={`align-top p-1 ${
                                  esHoy ? "bg-warning-subtle" : feriado ? "bg-danger-subtle" : ""
                                }`}
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
                                {feriado && (
                                  <div
                                    className="text-danger-emphasis text-truncate mb-1"
                                    style={{ fontSize: "0.68rem" }}
                                    title={`Feriado: ${feriado}`}
                                  >
                                    <i className="bi bi-flag-fill me-1"></i>
                                    {feriado}
                                  </div>
                                )}
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
              )}

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
                <span>
                  <span
                    className="badge border border-danger bg-body-tertiary me-1"
                    style={{ borderStyle: "dashed" }}
                  >
                    &nbsp;
                  </span>
                  no nacen (no alcanza el huevo)
                </span>
                <span>
                  <span className="badge bg-danger-subtle me-1">&nbsp;</span>
                  feriado
                </span>
                <span>
                  <span className="badge border border-danger border-2 bg-danger-subtle me-1">&nbsp;</span>
                  sin carga (compromisos a pasar)
                </span>
                <span className="ms-auto">
                  <span className="badge bg-dark-subtle text-dark-emphasis me-1">0.000</span>
                  nacen ese día ·{" "}
                  <i className="bi bi-person text-primary"></i> cliente ·{" "}
                  <i className="bi bi-truck text-success"></i> con orden emitida ·{" "}
                  <i className="bi bi-hourglass-split text-secondary"></i> a futuro ·{" "}
                  <i className="bi bi-house-door text-success"></i> engorde propio
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {filaAbierta && (
        <CargaModal
          fila={filaAbierta}
          destinos={filas}
          clientes={clientes}
          onPasar={pasarLinea}
          onCerrar={() => setAbierta(null)}
          onEmitir={emitirOrden}
          onBorrar={borrarLinea}
          onAgregada={cargar}
          onMover={moverCarga}
        />
      )}
    </Layout>
  );
};

export default PlanPollitosPage;
