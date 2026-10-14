import React, { useMemo, useState } from "react";
import Swal from "sweetalert2";
import BuscadorCliente from "./BuscadorCliente";
import { crearReservaPollitos, actualizarReservaPollitos, pasarReservaPollitos } from "../services/api";
import { formatearNumero, GRANJAS, labelGranja, prefijoGranja } from "../utils/reproductoresUtils";
import { nombreCliente, partesClave, textoClave, textoLotes } from "../utils/planPollitos";

// Plan de Pollitos — solapa "Por destino" (2026-10-14).
//
// La otra punta del mismo reparto: en vez de entrar por el DÍA (almanaque) y
// repartir esa carga entre clientes y granjas, se entra por el CLIENTE o la
// GRANJA y se le va sumando de las cargas que vienen, eligiendo a mano de cuál
// sale cada parte (pedido del usuario: se asigna a 6 meses lo que está por
// venir, y quién decide de qué carga es la persona, no el sistema).
//
// No hay datos propios: todo sale del mismo `GET /reservas-pollitos/plan` que
// el almanaque (cada fila trae su libre y sus `lineas`), y cada parte se graba
// como una reserva común contra esa carga — la tanda de referencia si es real,
// la fecha de nacimiento si es proyectada. Así las dos solapas no se pueden
// desincronizar: son dos vistas de las mismas reservas.
//
// ⚠️ Lo que se lista es lo que entra en la ventana del plan (selector de
// arriba). Una reserva de una carga que ya salió de la ventana no aparece.

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// De qué carga es una fila, en corto.
const textoCarga = (f) =>
  f.tipo === "real"
    ? `${textoLotes(f)}${f.nacio ? " · nacida" : ""}`
    : f.tipo === "sin_carga"
    ? "sin carga (a pasar)"
    : f.tipo === "no_alcanza"
    ? "no nacen"
    : "proyectada";

// Las cargas a las que se les puede sumar: las reales y las proyectadas que
// todavía no nacieron, más las ya nacidas que conservan pollitos libres.
const esAsignable = (f, claveHoy) =>
  (f.tipo === "real" || f.tipo === "proyectada") &&
  (f.claveNacimiento >= claveHoy || (f.nacio && f.libre > 0));

const BadgeEstado = ({ l }) =>
  l.proyectada ? (
    <span className="badge bg-secondary-subtle text-secondary-emphasis">
      <i className="bi bi-hourglass-split me-1"></i>a futuro
    </span>
  ) : l.orden ? (
    <span className={`badge ${l.orden.estado === "entregada" ? "bg-success" : "bg-warning text-dark"}`}>
      {l.orden.numero} · {l.orden.estado}
    </span>
  ) : l.estado === "entregada" ? (
    <span className="badge bg-success">entregada</span>
  ) : l.destino === "granja" ? (
    <span className="badge bg-success-subtle text-success-emphasis">a engorde</span>
  ) : (
    <span className="badge bg-secondary-subtle text-secondary-emphasis">comprometido</span>
  );

// ── Modal: nueva asignación ─────────────────────────────────────────────────
// Se elige el destino y después, carga por carga, se escribe cuántos pollitos
// salen de cada una y se CONFIRMA con el ✓: el input queda bloqueado (el lápiz lo
// reabre si hubo un error) y la cantidad se suma al "Asignado" de arriba. Solo
// se graba lo confirmado (pedido del usuario, 2026-10-14).
const FORM_VACIO = { destino: "cliente", cliente: "", granja: "cañete", galpon: "" };

const AsignarModal = ({ filas, clientes, claveHoy, inicial, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({ ...FORM_VACIO, ...inicial });
  const [cantidades, setCantidades] = useState({}); // clave de carga → texto del input
  const [confirmadas, setConfirmadas] = useState({}); // clave de carga → true
  const [soloConLibre, setSoloConLibre] = useState(true);
  const [saving, setSaving] = useState(false);

  const setCampo = (campo, valor) => setForm((p) => ({ ...p, [campo]: valor }));
  const galponesDisp = GRANJAS.find((g) => g.key === form.granja)?.galpones || 0;

  const asignables = useMemo(() => filas.filter((f) => esAsignable(f, claveHoy)), [filas, claveHoy]);
  // Una carga con algo cargado se sigue viendo aunque se quede sin libre.
  const visibles = asignables.filter(
    (f) => !soloConLibre || f.libre > 0 || Number(cantidades[f.clave]) > 0 || confirmadas[f.clave]
  );

  // Agrupadas por mes de nacimiento, que es como se piensa a 6 meses.
  const porMes = useMemo(() => {
    const grupos = [];
    for (const f of visibles) {
      const pref = f.claveNacimiento.slice(0, 7);
      if (!grupos.length || grupos[grupos.length - 1].pref !== pref) {
        const { anio, mes } = partesClave(f.claveNacimiento);
        grupos.push({ pref, titulo: `${MESES[mes]} ${anio}`, filas: [] });
      }
      grupos[grupos.length - 1].filas.push(f);
    }
    return grupos;
  }, [visibles]);

  // Lo asignado es solo lo confirmado: lo que está escrito sin confirmar todavía
  // se puede estar tipeando.
  const total = Object.keys(confirmadas).reduce((a, k) => a + (Number(cantidades[k]) || 0), 0);
  const cargasConfirmadas = Object.keys(confirmadas).length;

  const setCantidad = (k, v) => setCantidades((p) => ({ ...p, [k]: v }));

  const confirmar = (f) => {
    if (!(Number(cantidades[f.clave]) > 0)) return;
    setConfirmadas((p) => ({ ...p, [f.clave]: true }));
  };
  const editar = (f) =>
    setConfirmadas((p) => {
      const n = { ...p };
      delete n[f.clave];
      return n;
    });

  const guardar = async () => {
    if (form.destino === "cliente" && !form.cliente) {
      Swal.fire("Falta el cliente", "Elegí a quién se le asignan los pollitos.", "warning");
      return;
    }
    const partes = asignables
      .filter((f) => confirmadas[f.clave])
      .map((f) => ({ f, cantidad: Number(cantidades[f.clave]) || 0 }))
      .filter((p) => p.cantidad > 0);
    if (!partes.length) {
      Swal.fire(
        "Nada confirmado",
        "Escribí cuántos pollitos salen de una carga y confirmalo con ✓.",
        "warning"
      );
      return;
    }
    // Lo escrito sin confirmar no se graba: se avisa para que no se pierda.
    const sinConfirmar = asignables.filter(
      (f) => !confirmadas[f.clave] && Number(cantidades[f.clave]) > 0
    );
    if (sinConfirmar.length) {
      const { isConfirmed } = await Swal.fire({
        icon: "question",
        title: "Hay cantidades sin confirmar",
        html:
          sinConfirmar
            .map((f) => `${textoClave(f.claveNacimiento)}: ${formatearNumero(Number(cantidades[f.clave]))}`)
            .join("<br>") + "<br><br>Esas no se van a asignar.",
        showCancelButton: true,
        confirmButtonText: "Asignar solo lo confirmado",
        cancelButtonText: "Revisar",
      });
      if (!isConfirmed) return;
    }
    const sobrevendidas = partes.filter((p) => p.cantidad > p.f.libre);
    if (sobrevendidas.length) {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "Se pasa de lo que va a nacer",
        html:
          sobrevendidas
            .map(
              (p) =>
                `${textoClave(p.f.claveNacimiento)}: ${formatearNumero(p.cantidad)} con ${formatearNumero(
                  p.f.libre
                )} libres`
            )
            .join("<br>") + "<br><br>Se puede igual, pero esas cargas quedan sobrevendidas.",
        showCancelButton: true,
        confirmButtonText: "Asignar igual",
        cancelButtonText: "Revisar",
      });
      if (!isConfirmed) return;
    }

    setSaving(true);
    // Una reserva por carga. Si una falla, las anteriores ya quedaron: se avisa
    // cuáles, y lo que se grabó ya se ve en el plan al recargar.
    const hechas = [];
    try {
      for (const { f, cantidad } of partes) {
        await crearReservaPollitos({
          ...(f.tipo === "proyectada"
            ? { fechaNacimiento: f.claveNacimiento }
            : { tanda: f.tandaReferencia }),
          destino: form.destino,
          ...(form.destino === "cliente"
            ? { cliente: form.cliente }
            : { granja: form.granja, galpon: form.galpon || null }),
          cantidad,
        });
        hechas.push(f);
      }
      await onGuardado();
      onCerrar();
      Swal.fire({
        icon: "success",
        title: "Asignado",
        text: `${formatearNumero(total)} pollitos en ${partes.length} carga(s).`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      await onGuardado();
      Swal.fire(
        "Error",
        `${err.message || "No se pudo asignar."}` +
          (hechas.length
            ? ` Ya quedaron grabadas ${hechas.length} de ${partes.length} carga(s): ${hechas
                .map((f) => textoClave(f.claveNacimiento))
                .join(", ")}.`
            : ""),
        "error"
      );
      // Lo que se grabó no se vuelve a mandar.
      const sacar = (p) => {
        const n = { ...p };
        for (const f of hechas) delete n[f.clave];
        return n;
      };
      setCantidades(sacar);
      setConfirmadas(sacar);
      setSaving(false);
      return;
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        {/* Sin `modal-dialog-scrollable`: le cortaría el desplegable al
            buscador de clientes. Lo que scrollea es la lista de cargas. */}
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title mb-0">
                <i className="bi bi-person-plus text-success me-2"></i>Nueva asignación
              </h5>
              <button type="button" className="btn-close" onClick={onCerrar} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <div className="row g-2 align-items-end mb-3">
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
                  <div className="col-md-6">
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
                        onChange={(e) => setForm((p) => ({ ...p, granja: e.target.value, galpon: "" }))}
                      >
                        {GRANJAS.map((g) => (
                          <option key={g.key} value={g.key}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6 col-md-3">
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
                {/* La suma de lo confirmado: no se escribe, se va armando. */}
                <div className="col-6 col-md-3">
                  <label className="form-label small fw-semibold mb-1">
                    Asignado{" "}
                    <span className="text-muted fw-normal">
                      ({cargasConfirmadas} carga{cargasConfirmadas === 1 ? "" : "s"})
                    </span>
                  </label>
                  <div
                    className={`form-control form-control-sm fw-bold text-end ${
                      total > 0 ? "border-success text-success" : "text-muted"
                    } bg-body-tertiary`}
                  >
                    {formatearNumero(total)}
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small fw-semibold">¿De qué cargas salen?</span>
                <div className="form-check form-switch small mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="soloConLibre"
                    checked={soloConLibre}
                    onChange={(e) => setSoloConLibre(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="soloConLibre">
                    Solo las que tienen libre
                  </label>
                </div>
              </div>

              <div className="border rounded" style={{ maxHeight: "45vh", overflowY: "auto" }}>
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr className="small text-muted">
                      <th>Nace</th>
                      <th>Carga</th>
                      <th className="text-end">A nacer</th>
                      <th className="text-end">Libre</th>
                      <th style={{ width: 150 }}>Pollitos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porMes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted small py-3">
                          No hay cargas con pollitos libres en la ventana del plan.
                        </td>
                      </tr>
                    )}
                    {porMes.map((g) => (
                      <React.Fragment key={g.pref}>
                        <tr className="table-secondary">
                          <td colSpan={5} className="small fw-semibold py-1">
                            {g.titulo}
                          </td>
                        </tr>
                        {g.filas.map((f) => {
                          const n = Number(cantidades[f.clave]) || 0;
                          const excede = n > f.libre;
                          const ok = !!confirmadas[f.clave];
                          return (
                            <tr key={f.clave} className={ok ? "table-success" : ""}>
                              <td className="small text-nowrap fw-semibold">{textoClave(f.claveNacimiento)}</td>
                              <td className="small">
                                {f.tipo === "proyectada" ? (
                                  <span className="text-secondary">
                                    <i className="bi bi-hourglass-split me-1"></i>proyectada
                                  </span>
                                ) : (
                                  textoCarga(f)
                                )}
                              </td>
                              <td className="small text-end">{formatearNumero(f.aNacer)}</td>
                              <td
                                className={`small text-end fw-semibold ${
                                  f.libre > 0 ? "text-success" : "text-danger"
                                }`}
                              >
                                {formatearNumero(f.libre)}
                              </td>
                              <td>
                                <div className="input-group input-group-sm">
                                  <input
                                    type="number"
                                    min="0"
                                    className={`form-control ${excede ? "is-invalid" : ""}`}
                                    value={cantidades[f.clave] || ""}
                                    onChange={(e) => setCantidad(f.clave, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        confirmar(f);
                                      }
                                    }}
                                    disabled={saving || ok}
                                  />
                                  {ok ? (
                                    <button
                                      type="button"
                                      className="btn btn-outline-secondary"
                                      onClick={() => editar(f)}
                                      disabled={saving}
                                      title="Corregir la cantidad"
                                    >
                                      <i className="bi bi-pencil"></i>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-success"
                                      onClick={() => confirmar(f)}
                                      disabled={saving || n <= 0}
                                      title="Confirmar esta cantidad"
                                    >
                                      <i className="bi bi-check-lg"></i>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer justify-content-between">
              <div className="small">
                Asignando <strong>{formatearNumero(total)}</strong> pollitos en {cargasConfirmadas}{" "}
                carga{cargasConfirmadas === 1 ? "" : "s"}
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-secondary" onClick={onCerrar} disabled={saving}>
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={guardar} disabled={saving || total <= 0}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-check-lg me-1"></i>Asignar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
    </>
  );
};

// ── Modal: editar una asignación ────────────────────────────────────────────
// Cantidad, a quién va (otro cliente, u otra granja/galpón) y de qué carga sale.
// No se cambia de cliente a granja ni al revés: eso es liberar y asignar de
// nuevo. Cambiar la carga es el mismo "pasar" del modal del calendario.
//
// Solo se edita lo que está `reservada` y sin orden de carga: con orden, la
// cantidad ya la fija la orden (anulala primero).
const EditarModal = ({ fila, linea, filas, clientes, claveHoy, onCerrar, onGuardado }) => {
  const esGranja = linea.destino === "granja";
  const [cantidad, setCantidad] = useState(String(linea.cantidad));
  const [cliente, setCliente] = useState(linea.cliente?._id || "");
  const [granja, setGranja] = useState(linea.granja || "cañete");
  const [galpon, setGalpon] = useState(linea.galpon ? String(linea.galpon) : "");
  const [carga, setCarga] = useState(fila.clave);
  const [saving, setSaving] = useState(false);

  const galponesDisp = GRANJAS.find((g) => g.key === granja)?.galpones || 0;
  // La carga actual siempre está entre las opciones, aunque ya no sea asignable.
  const opciones = useMemo(() => {
    const lista = filas.filter((f) => esAsignable(f, claveHoy));
    return lista.some((f) => f.clave === fila.clave) ? lista : [fila, ...lista];
  }, [filas, claveHoy, fila]);
  const destinoCarga = opciones.find((f) => f.clave === carga) || fila;
  const cambiaCarga = carga !== fila.clave;
  // Lo libre para esta reserva: en su misma carga, lo que ya tiene vuelve a
  // estar disponible.
  const libre = destinoCarga.libre + (cambiaCarga ? 0 : linea.cantidad);
  const n = Number(cantidad) || 0;

  const guardar = async () => {
    if (!n || n <= 0) {
      Swal.fire("Cantidad inválida", "La cantidad tiene que ser mayor a cero.", "warning");
      return;
    }
    if (!esGranja && !cliente) {
      Swal.fire("Falta el cliente", "Elegí a quién se le asignan los pollitos.", "warning");
      return;
    }
    if (n > libre) {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "Se pasa de lo que va a nacer",
        text: `Quedan ${formatearNumero(libre)} libres en esa carga. Se puede igual, pero queda sobrevendida.`,
        showCancelButton: true,
        confirmButtonText: "Guardar igual",
        cancelButtonText: "Revisar",
      });
      if (!isConfirmed) return;
    }
    setSaving(true);
    try {
      await actualizarReservaPollitos(linea._id, {
        cantidad: n,
        ...(esGranja ? { granja, galpon: galpon || null } : { cliente }),
      });
      if (cambiaCarga)
        await pasarReservaPollitos(
          linea._id,
          destinoCarga.tipo === "proyectada"
            ? { fechaNacimiento: destinoCarga.claveNacimiento }
            : { tanda: destinoCarga.tandaReferencia }
        );
      await onGuardado();
      onCerrar();
      Swal.fire({ icon: "success", title: "Asignación editada", timer: 1600, showConfirmButton: false });
    } catch (err) {
      // Si falló el paso de carga, lo demás ya quedó: se recarga para verlo.
      await onGuardado();
      Swal.fire("Error", err.message || "No se pudo editar la asignación.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title mb-0">
                <i className="bi bi-pencil text-primary me-2"></i>Editar asignación
              </h5>
              <button type="button" className="btn-close" onClick={onCerrar} disabled={saving}></button>
            </div>
            <div className="modal-body">
              {esGranja ? (
                <div className="row g-2 mb-3">
                  <div className="col-7">
                    <label className="form-label small fw-semibold mb-1">Granja</label>
                    <select
                      className="form-select form-select-sm"
                      value={granja}
                      onChange={(e) => {
                        setGranja(e.target.value);
                        setGalpon("");
                      }}
                    >
                      {GRANJAS.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-5">
                    <label className="form-label small fw-semibold mb-1">Galpón</label>
                    <select
                      className="form-select form-select-sm"
                      value={galpon}
                      onChange={(e) => setGalpon(e.target.value)}
                    >
                      <option value="">A definir</option>
                      {Array.from({ length: galponesDisp }, (_, i) => i + 1).map((g) => (
                        <option key={g} value={g}>
                          {prefijoGranja(granja)}
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label small fw-semibold mb-1">Cliente</label>
                  <BuscadorCliente clientes={clientes} value={cliente} onChange={setCliente} size="sm" />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label small fw-semibold mb-1">Carga</label>
                <select
                  className="form-select form-select-sm"
                  value={carga}
                  onChange={(e) => setCarga(e.target.value)}
                >
                  {opciones.map((f) => (
                    <option key={f.clave} value={f.clave}>
                      {`Nace ${textoClave(f.claveNacimiento)} · ${textoCarga(f)} · libre ${formatearNumero(
                        f.libre + (f.clave === fila.clave ? linea.cantidad : 0)
                      )}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label small fw-semibold mb-1">Pollitos</label>
                <input
                  type="number"
                  min="1"
                  className={`form-control form-control-sm ${n > libre ? "is-invalid" : ""}`}
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
                <div className={`small mt-1 ${n > libre ? "text-danger" : "text-muted"}`}>
                  Libres en esa carga para esta asignación: {formatearNumero(libre)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onCerrar} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-lg me-1"></i>Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
    </>
  );
};

// ── La solapa ───────────────────────────────────────────────────────────────
const PlanPorDestino = ({ filas, clientes, claveHoy, onAbrirCarga, onEmitir, onBorrar, onRecargar }) => {
  const [filtro, setFiltro] = useState("todos"); // todos | cliente | granja
  const [texto, setTexto] = useState("");
  const [modal, setModal] = useState(null); // null | valores iniciales del form
  const [editando, setEditando] = useState(null); // null | { f, l }

  // Cada reserva viva con su carga, agrupada por a quién va.
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const f of filas) {
      for (const l of f.lineas || []) {
        if (l.estado === "cancelada") continue;
        const key = l.destino === "granja" ? `granja|${l.granja}` : `cliente|${l.cliente?._id}`;
        if (!mapa.has(key))
          mapa.set(key, {
            key,
            destino: l.destino,
            nombre: l.destino === "granja" ? labelGranja(l.granja) : nombreCliente(l.cliente),
            telefono: l.cliente?.telefono,
            clienteId: l.cliente?._id,
            granja: l.granja,
            items: [],
          });
        mapa.get(key).items.push({ f, l });
      }
    }
    return [...mapa.values()]
      .map((g) => {
        const futuras = g.items.filter(({ f }) => f.claveNacimiento >= claveHoy);
        return {
          ...g,
          total: g.items.reduce((a, { l }) => a + l.cantidad, 0),
          aFuturo: futuras.reduce((a, { l }) => a + l.cantidad, 0),
          proximo: futuras[0]?.f.claveNacimiento || null,
        };
      })
      .sort((a, b) =>
        a.destino !== b.destino ? (a.destino === "cliente" ? -1 : 1) : a.nombre.localeCompare(b.nombre)
      );
  }, [filas, claveHoy]);

  const busqueda = texto.trim().toLowerCase();
  const visibles = grupos.filter(
    (g) =>
      (filtro === "todos" || g.destino === filtro) &&
      (!busqueda || g.nombre.toLowerCase().includes(busqueda))
  );
  const totalVisible = visibles.reduce((a, g) => a + g.total, 0);

  return (
    <div className="card shadow-sm border-top-0 rounded-top-0">
      <div className="card-header bg-white d-flex flex-wrap align-items-center gap-3 px-3 py-3">
        <button className="btn btn-success btn-sm" onClick={() => setModal({})}>
          <i className="bi bi-plus-lg me-1"></i>Nueva asignación
        </button>
        <div className="btn-group btn-group-sm" role="group" aria-label="Filtro de destino">
          {[
            ["todos", "Todos"],
            ["cliente", "Clientes"],
            ["granja", "Engorde propio"],
          ].map(([v, t]) => (
            <button
              key={v}
              type="button"
              className={`btn ${filtro === v ? "btn-secondary" : "btn-outline-secondary"}`}
              onClick={() => setFiltro(v)}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="form-control form-control-sm"
          style={{ maxWidth: 260 }}
          placeholder="Buscar cliente o granja…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <span className="small text-muted ms-auto">
          {visibles.length} destino(s) · <strong>{formatearNumero(totalVisible)}</strong> pollitos
        </span>
      </div>

      <div className="card-body p-3">
        {visibles.length === 0 ? (
          <p className="text-muted small text-center py-4 mb-0">
            <i className="bi bi-inbox me-1"></i>
            {grupos.length === 0
              ? "Todavía no hay pollitos asignados en la ventana del plan."
              : "Ningún destino coincide con el filtro."}
          </p>
        ) : (
          visibles.map((g) => (
            <div key={g.key} className="border rounded mb-3 overflow-hidden">
              <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 bg-body-tertiary border-bottom">
                <i
                  className={`bi ${
                    g.destino === "granja" ? "bi-house-door text-success" : "bi-person text-primary"
                  }`}
                ></i>
                <span className="fw-bold">{g.nombre}</span>
                {g.telefono && <span className="text-muted small">{g.telefono}</span>}
                <span className="small text-muted ms-auto">
                  {formatearNumero(g.total)} pollitos en {g.items.length} carga(s)
                  {g.proximo && ` · próximo nacimiento ${textoClave(g.proximo)}`}
                </span>
                <button
                  className="btn btn-sm btn-outline-success"
                  title="Sumarle pollitos de otras cargas"
                  onClick={() =>
                    setModal(
                      g.destino === "granja"
                        ? { destino: "granja", granja: g.granja }
                        : { destino: "cliente", cliente: g.clienteId }
                    )
                  }
                >
                  <i className="bi bi-plus-lg"></i> Sumar
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    {g.items.map(({ f, l }) => {
                      const puedeEmitir =
                        l.destino === "cliente" && !l.orden && f.nacio && l.estado !== "cancelada";
                      return (
                        <tr key={l._id}>
                          <td className="ps-4 small text-nowrap fw-semibold" style={{ width: 110 }}>
                            {textoClave(f.claveNacimiento)}
                          </td>
                          <td className="small text-muted">
                            {textoCarga(f)}
                            {l.destino === "granja" &&
                              (l.galpon ? ` · ${prefijoGranja(l.granja)}${l.galpon}` : " · galpón a definir")}
                          </td>
                          <td className="text-end fw-semibold" style={{ width: 110 }}>
                            {formatearNumero(l.cantidad)}
                          </td>
                          <td style={{ width: 170 }}>
                            <BadgeEstado l={l} />
                          </td>
                          <td className="text-end text-nowrap pe-3" style={{ width: 180 }}>
                            <button
                              className="btn btn-sm btn-outline-secondary me-1"
                              onClick={() => onAbrirCarga(f)}
                              title="Abrir la carga (ver el reparto, pasar a otra carga)"
                            >
                              <i className="bi bi-box-arrow-up-right"></i>
                            </button>
                            {!l.orden && l.estado === "reservada" && (
                              <button
                                className="btn btn-sm btn-outline-primary me-1"
                                onClick={() => setEditando({ f, l })}
                                title="Editar la asignación (cantidad, destino o carga)"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            )}
                            {puedeEmitir && (
                              <button
                                className="btn btn-sm btn-outline-success me-1"
                                onClick={() => onEmitir(f, l)}
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
            </div>
          ))
        )}
      </div>

      {editando && (
        <EditarModal
          fila={editando.f}
          linea={editando.l}
          filas={filas}
          clientes={clientes}
          claveHoy={claveHoy}
          onCerrar={() => setEditando(null)}
          onGuardado={onRecargar}
        />
      )}

      {modal && (
        <AsignarModal
          filas={filas}
          clientes={clientes}
          claveHoy={claveHoy}
          inicial={modal}
          onCerrar={() => setModal(null)}
          onGuardado={async () => {
            await onRecargar();
          }}
        />
      )}
    </div>
  );
};

export default PlanPorDestino;
