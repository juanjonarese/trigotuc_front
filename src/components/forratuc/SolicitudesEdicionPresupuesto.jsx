import React, { useState } from "react";

/**
 * Pedidos de edición de presupuestos de Forratuc (2026-11-12, pedido del
 * usuario): el que no es superadmin edita el presupuesto y lo manda; al
 * superadmin le llega una notificación y acá ve lo que cambia (antes →
 * después) y lo acepta o lo rechaza. Los demás ven los suyos y pueden
 * cancelarlos mientras esperan.
 */
const pesos = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(n || 0));
const fmt = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(n || 0));
const fechaHora = (d) => (d ? new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "");

const ESTADO = {
  pendiente: { texto: "Esperando", clase: "bg-warning text-dark" },
  aprobada: { texto: "Aceptada", clase: "bg-success" },
  rechazada: { texto: "Rechazada", clase: "bg-danger" },
  cancelada: { texto: "Cancelada", clase: "bg-secondary" },
};

const textoPago = (foto, mediosPago) =>
  foto.condicionPago === "cuenta_corriente"
    ? "Cuenta corriente"
    : (foto.pagos || []).map((p) => `${mediosPago.find((m) => m.key === p.medio)?.etiqueta || p.medio} ${pesos(p.importe)}`).join(" + ") || "Contado";

// Una columna (antes o después). `otra` es la del otro lado: lo distinto se resalta.
const Foto = ({ titulo, foto, otra, mediosPago, depositos }) => {
  const distinto = (campo) => String(foto?.[campo] ?? "") !== String(otra?.[campo] ?? "");
  const claveLinea = (l) => `${l.codigo}|${l.descripcion}|${l.cantidad}|${l.kg ?? ""}|${l.precioUnitario}`;
  const lineasOtra = new Set((otra?.lineas || []).map(claveLinea));
  const resaltado = "bg-warning-subtle";
  return (
    <div className="col-12 col-lg-6">
      <div className="fw-semibold small text-uppercase text-secondary mb-1">{titulo}</div>
      <div className="small mb-1">
        <span className={distinto("clienteNombre") ? resaltado : ""}><strong>Cliente:</strong> {foto.clienteNombre}</span>
        {foto.deposito && (
          <span className={`ms-2 ${distinto("deposito") ? resaltado : ""}`}>
            · {depositos.find((d) => d.key === foto.deposito)?.etiqueta || foto.deposito}
          </span>
        )}
      </div>
      <table className="table table-sm table-bordered mb-1 small bg-white">
        <tbody>
          {(foto.lineas || []).map((l, i) => (
            <tr key={i} className={lineasOtra.has(claveLinea(l)) ? "" : resaltado}>
              <td className="text-nowrap">{l.codigo}</td>
              <td>
                {fmt(l.cantidad)} {l.unidad} {l.descripcion}
                {l.kg ? <span className="text-muted"> ({fmt(l.kg)} kg)</span> : null}
              </td>
              <td className="text-end text-nowrap">{pesos(l.precioUnitario)}/{l.unidadPrecio === "cajon" ? "cajón" : l.unidadPrecio}</td>
              <td className="text-end text-nowrap">{pesos(l.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small">
        <span className={`fw-bold ${distinto("total") ? resaltado : ""}`}>Total {pesos(foto.total)}</span>
        <span className="ms-2">·</span>
        <span className={`ms-2 ${textoPago(foto, mediosPago) !== textoPago(otra || {}, mediosPago) ? resaltado : ""}`}>
          {textoPago(foto, mediosPago)}
        </span>
      </div>
      {(foto.observaciones || otra?.observaciones) && (
        <div className={`small text-muted ${distinto("observaciones") ? resaltado : ""}`}>Obs.: {foto.observaciones || "—"}</div>
      )}
    </div>
  );
};

const SolicitudesEdicionPresupuesto = ({ solicitudes, esSuperadmin, mediosPago = [], depositos = [], onAprobar, onRechazar, onCancelar }) => {
  const [abierta, setAbierta] = useState(null);
  if (!solicitudes.length) return null;
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;

  return (
    <div className={`card shadow-sm mb-3 ${pendientes ? "border-warning" : "border-0"}`}>
      <div className="card-header bg-white py-2">
        <h6 className="mb-0">
          <i className="bi bi-pencil-square me-2 text-warning"></i>
          {esSuperadmin ? "Pedidos de edición para autorizar" : "Tus pedidos de edición"}
          {pendientes > 0 && <span className="badge bg-warning text-dark ms-2">{pendientes} esperando</span>}
        </h6>
      </div>
      <div className="card-body py-2">
        {solicitudes.map((s) => (
          <div key={s._id} className="border-bottom py-2">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="fw-semibold">Presupuesto {s.numero}</span>
              <span className={`badge ${ESTADO[s.estado]?.clase}`}>{ESTADO[s.estado]?.texto || s.estado}</span>
              <span className="small text-muted">
                {s.antes?.clienteNombre} · {pesos(s.antes?.total)} → <strong>{pesos(s.propuesta?.total)}</strong>
              </span>
              <span className="small text-muted">
                · pidió {s.solicitadoPor?.nombreUsuario || "—"} el {fechaHora(s.createdAt)}
              </span>
              <div className="ms-auto d-flex gap-1">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setAbierta(abierta === s._id ? null : s._id)}>
                  <i className={`bi ${abierta === s._id ? "bi-chevron-up" : "bi-eye"} me-1`}></i>
                  {abierta === s._id ? "Ocultar" : "Ver cambios"}
                </button>
                {s.estado === "pendiente" && esSuperadmin && (
                  <>
                    <button className="btn btn-sm btn-success" onClick={() => onAprobar(s)}>
                      <i className="bi bi-check-lg me-1"></i>Aceptar
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => onRechazar(s)}>
                      <i className="bi bi-x-lg me-1"></i>Rechazar
                    </button>
                  </>
                )}
                {s.estado === "pendiente" && !esSuperadmin && (
                  <button className="btn btn-sm btn-outline-danger" onClick={() => onCancelar(s)}>Cancelar pedido</button>
                )}
              </div>
            </div>
            <div className="small mt-1"><strong>Motivo:</strong> {s.motivo}</div>
            {s.estado !== "pendiente" && s.resueltoPor && (
              <div className="small text-muted">
                {ESTADO[s.estado]?.texto} por {s.resueltoPor.nombreUsuario} el {fechaHora(s.fechaResolucion)}
                {s.motivoRechazo ? ` — ${s.motivoRechazo}` : ""}
              </div>
            )}
            {abierta === s._id && (
              <div className="row g-3 mt-1 bg-light rounded p-2">
                <Foto titulo="Antes (como está)" foto={s.antes} otra={s.propuesta} mediosPago={mediosPago} depositos={depositos} />
                <Foto titulo="Después (lo que se pide)" foto={s.propuesta} otra={s.antes} mediosPago={mediosPago} depositos={depositos} />
                <div className="col-12 small text-muted">
                  <i className="bi bi-info-circle me-1"></i>
                  Lo resaltado es lo que cambia. Al aceptar se devuelve el stock de antes y se descuenta el nuevo, con
                  lo que haya hoy; el número y la fecha no cambian.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SolicitudesEdicionPresupuesto;
