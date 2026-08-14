import React, { useState, useEffect, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import AlmanaqueFaena from "../components/AlmanaqueFaena";
import ConfigGalponesModal from "../components/ConfigGalponesModal";
import {
  obtenerRepartoPollitos,
  obtenerClientes,
  obtenerAlmanaqueFaena,
  crearReservaPollitos,
  actualizarReservaPollitos,
  eliminarReservaPollitos,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import {
  formatearNumero,
  formatearMoneda,
  ESTADO_TANDA,
  GRANJAS,
  labelGranja,
  prefijoGranja,
  diasHasta,
  textoDias,
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

// "mar 12 ago" — encabezado de la tarjeta, que es lo primero que se mira.
const fechaLarga = (fecha) =>
  new Date(fecha).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const FORM_VACIO = {
  destino: "granja",
  cliente: "",
  granja: "",
  galpon: "",
  cantidad: "",
  precioUnitario: "",
  anticipo: "",
  observaciones: "",
};

// ── Modal: dar curso a pollitos de una fecha ────────────────────────────────
// Se elige el destino (granja propia o cliente) y la cantidad; esa cantidad se
// descuenta de los disponibles de esa fecha.
const AsignarModal = ({ reparto, reserva, clientes, galponesFuera, onClose, onGuardado }) => {
  const edicion = !!reserva;
  const [form, setForm] = useState(
    edicion
      ? {
          destino: reserva.destino,
          cliente: reserva.cliente?._id || "",
          granja: reserva.granja || "",
          galpon: reserva.galpon ? String(reserva.galpon) : "",
          cantidad: String(reserva.cantidad),
          precioUnitario: reserva.precioUnitario != null ? String(reserva.precioUnitario) : "",
          anticipo: reserva.anticipo ? String(reserva.anticipo) : "",
          observaciones: reserva.observaciones || "",
        }
      : FORM_VACIO
  );
  const [saving, setSaving] = useState(false);

  const cantidad = Number(form.cantidad) || 0;
  // El formulario de precio se sacó de la pantalla, pero los valores siguen
  // viajando en el form: en una edición hay que devolver los que la reserva ya
  // tenía en vez de borrárselos.
  const precio = form.precioUnitario === "" ? null : Number(form.precioUnitario);
  const anticipo = Number(form.anticipo) || 0;
  const total = precio != null ? precio * cantidad : 0;

  // Lo que queda libre en esta fecha si se guarda esto.
  const yaAsignado = reparto.comprometidos - (edicion ? reserva.cantidad : 0);
  const libre = reparto.disponibles - yaAsignado;
  const restante = libre - cantidad;
  const seExcede = cantidad > libre;

  const setCampo = (campo, valor) => setForm((p) => ({ ...p, [campo]: valor }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.destino === "cliente" && !form.cliente) {
      Swal.fire("Falta el cliente", "Elegí a quién se le reservan los pollitos.", "warning");
      return;
    }
    if (form.destino === "granja" && !form.granja) {
      Swal.fire("Falta la granja", "Elegí a qué granja van los pollitos.", "warning");
      return;
    }
    if (cantidad <= 0) {
      Swal.fire("Falta la cantidad", "Cargá cuántos pollitos se asignan.", "warning");
      return;
    }
    if (precio != null && anticipo > total) {
      Swal.fire("Anticipo inválido", "El anticipo no puede superar el total.", "warning");
      return;
    }

    if (seExcede) {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "Te pasás de lo estimado",
        html: `Quedan <strong>${formatearNumero(libre)}</strong> pollitos disponibles para esa fecha y estás asignando <strong>${formatearNumero(cantidad)}</strong>.<br><br>Quedaría comprometida de más en <strong>${formatearNumero(cantidad - libre)}</strong>.`,
        showCancelButton: true,
        confirmButtonText: "Asignar igual",
        cancelButtonText: "Corregir",
      });
      if (!isConfirmed) return;
    }

    const payload = {
      destino: form.destino,
      cantidad,
      observaciones: form.observaciones || undefined,
      ...(form.destino === "cliente"
        ? { cliente: form.cliente, precioUnitario: form.precioUnitario, anticipo }
        : { granja: form.granja, galpon: form.galpon || null }),
    };

    setSaving(true);
    try {
      if (edicion) await actualizarReservaPollitos(reserva._id, payload);
      else await crearReservaPollitos({ ...payload, tanda: reparto.tanda._id });
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const galponesDisp = GRANJAS.find((g) => g.key === form.granja)?.galpones || 0;
  // Un galpón fuera de servicio no puede recibir pollitos. Se deja en la lista
  // pero deshabilitado y con el motivo al lado: sacarlo del todo hacía que el
  // usuario se preguntara por qué le faltaba un número en el medio.
  const estaFuera = (n) => !!galponesFuera?.[form.granja]?.has(n);

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <div>
                <h5 className="modal-title mb-0">
                  <i className="bi bi-arrow-right-circle me-2"></i>
                  {edicion ? "Editar asignación" : "Asignar pollitos"}
                </h5>
                <div className="small opacity-75 mt-1">
                  Nacen el {formatearFechaLocal(reparto.tanda.fechaNacimiento)} · tanda #
                  {reparto.tanda.numeroTanda}
                </div>
              </div>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Disponible de la fecha, siempre a la vista */}
                <div className="d-flex justify-content-between border rounded px-3 py-2 mb-3 small">
                  <span>
                    <span className="text-muted">Disponibles</span>{" "}
                    <strong>{formatearNumero(libre)}</strong>
                  </span>
                  <span>
                    <span className="text-muted">Asignás</span>{" "}
                    <strong className="text-primary">{formatearNumero(cantidad)}</strong>
                  </span>
                  <span>
                    <span className="text-muted">Quedan</span>{" "}
                    <strong className={restante < 0 ? "text-danger" : "text-success"}>
                      {formatearNumero(restante)}
                    </strong>
                  </span>
                </div>

                <label className="form-label fw-semibold small">¿A dónde van?</label>
                <div className="btn-group w-100 mb-3">
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      form.destino === "granja" ? "btn-success" : "btn-outline-secondary"
                    }`}
                    onClick={() => setCampo("destino", "granja")}
                  >
                    <i className="bi bi-house-door me-1"></i>Granja propia
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      form.destino === "cliente" ? "btn-primary" : "btn-outline-secondary"
                    }`}
                    onClick={() => setCampo("destino", "cliente")}
                  >
                    <i className="bi bi-person me-1"></i>Cliente
                  </button>
                </div>

                {form.destino === "cliente" ? (
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Cliente</label>
                    <select
                      className="form-select"
                      value={form.cliente}
                      onChange={(e) => setCampo("cliente", e.target.value)}
                    >
                      <option value="">Elegí el cliente…</option>
                      {clientes.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.razonSocial}
                          {c.telefono ? ` — ${c.telefono}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold small">Granja</label>
                      <select
                        className="form-select"
                        value={form.granja}
                        onChange={(e) => setForm((p) => ({ ...p, granja: e.target.value, galpon: "" }))}
                      >
                        <option value="">Elegí la granja…</option>
                        {GRANJAS.map((g) => (
                          <option key={g.key} value={g.key}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold small">
                        Galpón <span className="text-muted fw-normal">(opcional)</span>
                      </label>
                      <select
                        className="form-select"
                        value={form.galpon}
                        disabled={!form.granja}
                        onChange={(e) => setCampo("galpon", e.target.value)}
                      >
                        <option value="">A definir</option>
                        {Array.from({ length: galponesDisp }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n} disabled={estaFuera(n)}>
                            {prefijoGranja(form.granja)}
                            {n}
                            {estaFuera(n) ? " — fuera de servicio" : ""}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        Se puede definir después, cuando se sepa cuál se libera.
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-semibold small">Cantidad de pollitos</label>
                  <input
                    type="number"
                    className={`form-control ${seExcede ? "border-warning" : ""}`}
                    min="1"
                    value={form.cantidad}
                    onChange={(e) => setCampo("cantidad", e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Acá había un bloque de precio por pollito + anticipo para las
                    reservas a cliente. Se sacó a pedido del usuario el
                    2026-08-12: el precio del pollito todavía no está definido y
                    cargar plata desde este modal confundía más de lo que servía.
                    El modelo `reservaPollitos` conserva los campos y el service
                    los sigue aceptando, así que volver a mostrarlo es sumar el
                    formulario de nuevo — no hace falta migrar nada. */}

                <div className="mt-3">
                  <label className="form-label fw-semibold small">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.observaciones}
                    onChange={(e) => setCampo("observaciones", e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  {edicion ? "Guardar cambios" : "Asignar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Tarjeta de una fecha de nacimiento ──────────────────────────────────────
// La fecha manda: cuántos pollitos vamos a tener ese día, a dónde ya se
// destinaron y cuántos quedan libres para decidir.
const FechaCard = ({ reparto, onAsignar, onEditar, onBorrar }) => {
  const t = reparto.tanda;
  const estado = ESTADO_TANDA[t.estado] || {};
  const dias = diasHasta(t.fechaNacimiento);
  const libre = reparto.saldo;
  const pctAsignado = reparto.disponibles
    ? Math.min(100, (reparto.comprometidos / reparto.disponibles) * 100)
    : 0;

  return (
    <div className={`card shadow-sm mb-3 ${libre < 0 ? "border-danger" : ""}`}>
      <div className="card-body">
        <div className="row g-3 align-items-center">
          {/* Fecha */}
          <div className="col-12 col-md-3">
            <div className="text-uppercase text-muted small">
              {t.nacio ? "Nacieron" : "Nacen"}
            </div>
            <div className="h4 fw-bold mb-0 text-capitalize">{fechaLarga(t.fechaNacimiento)}</div>
            <div className={`small ${!t.nacio && dias <= 7 ? "text-primary fw-semibold" : "text-muted"}`}>
              {textoDias(dias)} · {formatearFechaLocal(t.fechaNacimiento)}
            </div>
            <div className="mt-2 d-flex flex-wrap gap-1">
              {/* Pollitos que ya existen y no tienen a dónde ir: es lo único
                  de esta pantalla que no puede esperar. */}
              {t.nacio && libre > 0 && (
                <span className="badge bg-danger">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                  ya nacieron · sin destino
                </span>
              )}
              <span className={`badge ${estado.clase}`}>{estado.label}</span>
              <span className="badge bg-light text-dark border">Tanda #{t.numeroTanda}</span>
              <span className="badge bg-light text-dark border">
                Lote #{t.lote?.numeroLote ?? "?"}
              </span>
            </div>
          </div>

          {/* Números */}
          <div className="col-12 col-md-5">
            <div className="row g-2">
              <div className="col-4">
                <div className="border rounded p-2 text-center h-100">
                  <div className="text-muted" style={{ fontSize: ".75rem" }}>
                    {t.nacio ? "Nacidos" : "Estimados"}
                  </div>
                  <div className="fw-bold">{formatearNumero(reparto.disponibles)}</div>
                  {!t.nacio && (
                    <div className="text-muted" style={{ fontSize: ".7rem" }}>
                      {reparto.rendimientoEstimado}% de la carga
                    </div>
                  )}
                </div>
              </div>
              <div className="col-4">
                <div className="border rounded p-2 text-center h-100">
                  <div className="text-muted" style={{ fontSize: ".75rem" }}>
                    Asignados
                  </div>
                  <div className="fw-bold text-primary">
                    {formatearNumero(reparto.comprometidos)}
                  </div>
                  <div className="text-muted" style={{ fontSize: ".7rem" }}>
                    {formatearNumero(reparto.aGranja)} granja ·{" "}
                    {formatearNumero(reparto.aClientes)} clientes
                  </div>
                </div>
              </div>
              <div className="col-4">
                <div
                  className={`border rounded p-2 text-center h-100 ${
                    libre < 0 ? "border-danger" : libre === 0 ? "border-success" : "border-warning"
                  }`}
                >
                  <div className="text-muted" style={{ fontSize: ".75rem" }}>
                    {libre < 0 ? "De más" : "Disponibles"}
                  </div>
                  <div className={`fw-bold ${libre < 0 ? "text-danger" : "text-warning"}`}>
                    {formatearNumero(Math.abs(libre))}
                  </div>
                </div>
              </div>
            </div>
            <div className="progress mt-2" style={{ height: "6px" }}>
              <div
                className={`progress-bar ${libre < 0 ? "bg-danger" : "bg-primary"}`}
                style={{ width: `${pctAsignado}%` }}
              ></div>
            </div>
          </div>

          {/* Acción */}
          <div className="col-12 col-md-4 text-md-end">
            <button className="btn btn-success" onClick={() => onAsignar(reparto)}>
              <i className="bi bi-arrow-right-circle me-1"></i>Asignar pollitos
            </button>
          </div>
        </div>

        {/* A dónde se dio curso */}
        {reparto.reservas.length > 0 && (
          <div className="mt-3 pt-3 border-top">
            <div className="text-muted small mb-2">Ya asignados</div>
            {reparto.reservas.map((r) => (
              <div
                key={r._id}
                className={`d-flex flex-wrap align-items-center gap-2 py-1 ${
                  r.estado === "cancelada" ? "text-muted text-decoration-line-through" : ""
                }`}
              >
                {r.destino === "granja" ? (
                  <>
                    <i className="bi bi-house-door text-success"></i>
                    <span>
                      {labelGranja(r.granja)}
                      {r.galpon ? ` · ${prefijoGranja(r.granja)}${r.galpon}` : " · galpón a definir"}
                    </span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-person text-primary"></i>
                    <span>{r.cliente?.razonSocial || "Cliente"}</span>
                    {r.cliente?.telefono && (
                      <span className="text-muted small">{r.cliente.telefono}</span>
                    )}
                  </>
                )}
                <strong className="ms-auto">{formatearNumero(r.cantidad)}</strong>
                {r.total > 0 && (
                  <span className="text-muted small">{formatearMoneda(r.total)}</span>
                )}
                {r.estado === "entregada" && (
                  <span className="badge bg-info text-dark">Entregada</span>
                )}
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => onEditar(reparto, r)}
                  title="Editar"
                >
                  <i className="bi bi-pencil"></i>
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onBorrar(r)}
                  title="Liberar"
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
const ReservaPollitosPage = () => {
  const [repartos, setRepartos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [almanaque, setAlmanaque] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { reparto, reserva? }
  const [showConfig, setShowConfig] = useState(false);
  const esSuperAdmin = localStorage.getItem("rolUsuario") === "superadmin";
  // El almanaque es la vista principal desde el rediseño: es la foto de la
  // situación. El reparto por tanda pasa a ser el detalle.
  const [vista, setVista] = useState("almanaque");

  const cargar = useCallback(async () => {
    try {
      // El estado de los galpones ya lo muestra el almanaque, que además dice
      // cuándo se libera cada uno: el panel viejo quedó de más.
      const [data, cli, alm] = await Promise.all([
        obtenerRepartoPollitos(),
        obtenerClientes(),
        obtenerAlmanaqueFaena(),
      ]);
      setRepartos(Array.isArray(data) ? data : []);
      const listaClientes = Array.isArray(cli) ? cli : cli?.clientes || [];
      setClientes(listaClientes.filter((c) => c.activo !== false));
      setAlmanaque(alm);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el panorama.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // { cañete: Set(1), los_pinos: Set(3) }. Sale del almanaque, que ya trae los
  // 14 galpones con su config: no hace falta pedirla por separado.
  const galponesFuera = useMemo(() => {
    const mapa = {};
    for (const g of almanaque?.galpones || []) {
      if (!g.fueraDeServicio) continue;
      if (!mapa[g.granja]) mapa[g.granja] = new Set();
      mapa[g.granja].add(g.galpon);
    }
    return mapa;
  }, [almanaque]);

  // Lo próximo primero: la decisión que corre es la de la fecha más cercana.
  //
  // Antes se escondía TODA tanda que ya hubiera nacido ("acá se decide sobre lo
  // que viene"), y eso tapaba el caso más urgente que hay: pollitos que ya
  // existen, están vivos y todavía no tienen a dónde ir. Pasó de verdad el
  // 2026-08-12 — la tanda #1 nació con 12.000 pollitos sin asignar y no se veía
  // por ningún lado. Ahora se esconde solo la tanda nacida que YA está repartida
  // entera, que es la que efectivamente no pide nada.
  const visibles = useMemo(() => {
    const pendiente = (r) => r.disponibles - r.aGranja - r.aClientes > 0;
    return repartos
      .filter((r) => !r.tanda.nacio || pendiente(r))
      .sort((a, b) => {
        // Lo ya nacido y sin destino va arriba de todo: los pollitos están
        // comiendo mientras se decide.
        const urgA = a.tanda.nacio ? 0 : 1;
        const urgB = b.tanda.nacio ? 0 : 1;
        if (urgA !== urgB) return urgA - urgB;
        return new Date(a.tanda.fechaNacimiento) - new Date(b.tanda.fechaNacimiento);
      });
  }, [repartos]);

  const totales = useMemo(
    () =>
      visibles.reduce(
        (acc, r) => ({
          estimados: acc.estimados + r.disponibles,
          aGranja: acc.aGranja + r.aGranja,
          aClientes: acc.aClientes + r.aClientes,
        }),
        { estimados: 0, aGranja: 0, aClientes: 0 }
      ),
    [visibles]
  );
  const disponibles = totales.estimados - totales.aGranja - totales.aClientes;

  const borrar = async (reserva) => {
    const quien =
      reserva.destino === "granja" ? labelGranja(reserva.granja) : reserva.cliente?.razonSocial;
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Liberar estos pollitos?",
      text: `Vuelven a quedar disponibles ${reserva.cantidad} pollitos de ${quien}.`,
      showCancelButton: true,
      confirmButtonText: "Sí, liberar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await eliminarReservaPollitos(reserva._id);
      await cargar();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo liberar.", "error");
    }
  };

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-0">
              <i className="bi bi-graph-up-arrow text-success me-2"></i>Proyección
            </h1>
          </div>
          {/* La capacidad y el fuera de servicio cambian todos los números del
              almanaque, así que los edita solo el superadmin — igual que el PUT
              del backend. */}
          {esSuperAdmin && (
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setShowConfig(true)}
              disabled={!almanaque?.galpones}
            >
              <i className="bi bi-sliders me-1"></i>Capacidades
            </button>
          )}
        </div>

        {/* El almanaque contesta "¿voy a tener pollos todos los días para
            faenar?"; el reparto, "¿a quién le doy los pollitos de esta tanda?".
            Son dos preguntas distintas y por eso son dos vistas. */}
        {!loading && (
          <ul className="nav nav-tabs mb-3">
            {[
              { id: "almanaque", icono: "calendar3", texto: "Almanaque de faena" },
              { id: "reparto", icono: "list-check", texto: "Reparto por tanda" },
            ].map((t) => (
              <li className="nav-item" key={t.id}>
                <button
                  className={`nav-link ${vista === t.id ? "active fw-semibold" : ""}`}
                  onClick={() => setVista(t.id)}
                >
                  <i className={`bi bi-${t.icono} me-1`}></i>
                  {t.texto}
                </button>
              </li>
            ))}
          </ul>
        )}

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : vista === "almanaque" ? (
          almanaque ? (
            <AlmanaqueFaena data={almanaque} />
          ) : (
            <div className="card shadow-sm">
              <div className="card-body text-center py-5 text-muted">
                No se pudo armar el almanaque.
              </div>
            </div>
          )
        ) : visibles.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              No hay nacimientos previstos. Cargá una tanda en Incubadora.
            </div>
          </div>
        ) : (
          <>
            {/* La foto de conjunto: cuánto viene y cuánto queda sin destino */}
            <div className="row g-2 mb-4">
              <div className="col-6 col-lg-3">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Pollitos que vienen</div>
                    <div className="h4 fw-bold mb-0">{formatearNumero(totales.estimados)}</div>
                    <div className="text-muted" style={{ fontSize: ".75rem" }}>
                      en {visibles.length} fecha{visibles.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">A granja propia</div>
                    <div className="h4 fw-bold text-success mb-0">
                      {formatearNumero(totales.aGranja)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Reservados a clientes</div>
                    <div className="h4 fw-bold text-primary mb-0">
                      {formatearNumero(totales.aClientes)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-3">
                <div
                  className={`card shadow-sm h-100 ${
                    disponibles < 0 ? "border-danger" : "border-warning"
                  }`}
                >
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">
                      {disponibles < 0 ? "Comprometidos de más" : "Sin asignar"}
                    </div>
                    <div
                      className={`h4 fw-bold mb-0 ${
                        disponibles < 0 ? "text-danger" : "text-warning"
                      }`}
                    >
                      {formatearNumero(Math.abs(disponibles))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {visibles.map((r) => (
              <FechaCard
                key={r.tanda._id}
                reparto={r}
                onAsignar={(rep) => setModal({ reparto: rep })}
                onEditar={(rep, res) => setModal({ reparto: rep, reserva: res })}
                onBorrar={borrar}
              />
            ))}
          </>
        )}

      </div>

      {modal && (
        <AsignarModal
          reparto={modal.reparto}
          reserva={modal.reserva}
          clientes={clientes}
          galponesFuera={galponesFuera}
          onClose={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}

      {showConfig && almanaque?.galpones && (
        <ConfigGalponesModal
          // El almanaque ya devuelve los 14 galpones con etiqueta, capacidad y
          // fueraDeServicio, que es exactamente lo que el modal necesita.
          galpones={almanaque.galpones}
          onClose={() => setShowConfig(false)}
          onGuardado={() => {
            setShowConfig(false);
            cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default ReservaPollitosPage;
