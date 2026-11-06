import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { normalizarWhatsapp } from "../utils/whatsappUtils";
import { obtenerFechaHoy } from "../utils/dateUtils";
import { nombreCliente, textoClave, partesClave } from "../utils/planPollitos";

/**
 * Informe a clientes de la programación (2026-11-04, observación del cliente):
 * a cada cliente, un PDF con sus pollitos reservados que vienen (fecha de
 * nacimiento, cantidad y estado) para mandarle por WhatsApp.
 *
 * Decisión del usuario: se tildan los clientes (o todos) y el sistema arma el
 * PDF de cada uno y abre su chat con el mensaje escrito. WhatsApp NO deja
 * adjuntar un archivo desde un link (wa.me), así que el PDF se descarga y se
 * adjunta a mano; en el celular, "Compartir" lo manda directo. Se va de a un
 * cliente por vez: el navegador no deja abrir muchas ventanas juntas.
 *
 * Los datos son los mismos del Plan (`plan.nacimientos[].lineas`): lo que el
 * cliente ve es lo que está cargado.
 */

const ESTADO = { reservada: "Reservado", entregada: "Entregado" };
const fmt = (n) => Number(n || 0).toLocaleString("es-AR");
// "lun 05/10/2026"
const fechaLarga = (k) => `${textoClave(k)}/${partesClave(k).anio}`;
const hoyTexto = () => {
  const k = obtenerFechaHoy();
  const { anio, mes, dia } = partesClave(k);
  return `${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}/${anio}`;
};
const nombreArchivo = (cliente) =>
  `Programacion_pollitos_${nombreCliente(cliente).replace(/[^\p{L}\p{N}]+/gu, "_")}_${obtenerFechaHoy()}.pdf`;

// Las reservas de cada cliente, desde hoy, agrupadas y ordenadas por fecha.
const reservasPorCliente = (filas) => {
  const hoy = obtenerFechaHoy();
  const porCliente = new Map();
  for (const f of filas || []) {
    if (f.feriado || !f.claveNacimiento || f.claveNacimiento < hoy) continue;
    for (const l of f.lineas || []) {
      if (l.destino !== "cliente" || !l.cliente || l.estado === "cancelada") continue;
      const id = String(l.cliente._id);
      if (!porCliente.has(id)) porCliente.set(id, { cliente: l.cliente, reservas: [] });
      porCliente.get(id).reservas.push({
        clave: f.claveNacimiento,
        cantidad: l.cantidad,
        estado: l.estado,
        estimada: Boolean(l.proyectada),
      });
    }
  }
  return [...porCliente.values()]
    .map((c) => ({ ...c, reservas: c.reservas.sort((a, b) => (a.clave < b.clave ? -1 : 1)) }))
    .sort((a, b) => nombreCliente(a.cliente).localeCompare(nombreCliente(b.cliente)));
};

const armarPdf = ({ cliente, reservas }) => {
  const doc = new jsPDF();
  const izq = 18;
  let y = 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Trigotuc Avícola", izq, y);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Emitido el ${hoyTexto()}`, 192, y, { align: "right" });
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Programación de pollitos BB", izq, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Cliente: ${nombreCliente(cliente)}`, izq, y);
  y += 10;

  // Tabla
  doc.setFillColor(235, 240, 235);
  doc.rect(izq, y - 5, 174, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Fecha de nacimiento", izq + 2, y);
  doc.text("Pollitos", 140, y, { align: "right" });
  doc.text("Estado", 150, y);
  doc.setFont("helvetica", "normal");
  y += 8;
  let total = 0;
  for (const r of reservas) {
    if (y > 270) {
      doc.addPage();
      y = 22;
    }
    doc.text(fechaLarga(r.clave) + (r.estimada ? " (estimada)" : ""), izq + 2, y);
    doc.text(fmt(r.cantidad), 140, y, { align: "right" });
    doc.text(ESTADO[r.estado] || r.estado, 150, y);
    doc.setDrawColor(225);
    doc.line(izq, y + 2.5, izq + 174, y + 2.5);
    total += r.cantidad;
    y += 8;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Total", izq + 2, y);
  doc.text(fmt(total), 140, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 12;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    "Las fechas de nacimiento son estimadas y pueden variar un día. Ante cualquier duda, comuníquese con nosotros.",
    izq, y, { maxWidth: 174 }
  );
  return doc;
};

const mensaje = ({ cliente, reservas }) => {
  const total = reservas.reduce((a, r) => a + r.cantidad, 0);
  return (
    `Hola ${nombreCliente(cliente)}, te enviamos la programación de tus pollitos BB al ${hoyTexto()}: ` +
    `${fmt(total)} pollitos en ${reservas.length} fecha${reservas.length === 1 ? "" : "s"}. Te adjuntamos el PDF con el detalle. ` +
    "Trigotuc Avícola."
  );
};

const InformeClientesPlan = ({ filas, onClose }) => {
  const clientes = useMemo(() => reservasPorCliente(filas), [filas]);
  const [elegidos, setElegidos] = useState(() => new Set(clientes.map((c) => String(c.cliente._id))));
  // Envío en curso: la cola de clientes y en cuál va.
  const [cola, setCola] = useState(null);
  const [enviados, setEnviados] = useState(() => new Set());

  const todos = clientes.length > 0 && elegidos.size === clientes.length;
  const alternar = (id) =>
    setElegidos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const alternarTodos = () => setElegidos(todos ? new Set() : new Set(clientes.map((c) => String(c.cliente._id))));

  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  const descargar = (c) => armarPdf(c).save(nombreArchivo(c.cliente));

  // Descarga el PDF y abre el chat del cliente con el mensaje escrito.
  const enviar = (c) => {
    descargar(c);
    const tel = normalizarWhatsapp(c.cliente.telefono);
    if (tel) window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje(c))}`, "_blank", "noopener");
    setEnviados((prev) => new Set(prev).add(String(c.cliente._id)));
  };

  // En el celular: el PDF va directo a WhatsApp (se elige el contacto).
  const compartir = async (c) => {
    const archivo = new File([armarPdf(c).output("blob")], nombreArchivo(c.cliente), { type: "application/pdf" });
    if (!navigator.canShare({ files: [archivo] })) return enviar(c);
    try {
      await navigator.share({ files: [archivo], text: mensaje(c) });
      setEnviados((prev) => new Set(prev).add(String(c.cliente._id)));
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  };

  const empezar = () => setCola(clientes.filter((c) => elegidos.has(String(c.cliente._id))));
  const actual = cola?.find((c) => !enviados.has(String(c.cliente._id)));

  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-whatsapp text-success me-2"></i>Informe a clientes de la programación
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {clientes.length === 0 ? (
                <div className="text-muted text-center py-4">
                  No hay clientes con pollitos reservados de hoy en adelante.
                </div>
              ) : !cola ? (
                <>
                  <p className="small text-muted">
                    A cada cliente tildado se le arma un PDF con sus pollitos reservados que vienen (fecha de
                    nacimiento, cantidad y estado) y se abre su WhatsApp con el mensaje escrito.
                  </p>
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: "2rem" }}>
                          <input type="checkbox" className="form-check-input" checked={todos} onChange={alternarTodos} title="Todos" />
                        </th>
                        <th>Cliente</th>
                        <th className="text-end">Fechas</th>
                        <th className="text-end">Pollitos</th>
                        <th>WhatsApp</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => {
                        const id = String(c.cliente._id);
                        const tel = normalizarWhatsapp(c.cliente.telefono);
                        return (
                          <tr key={id}>
                            <td>
                              <input type="checkbox" className="form-check-input" checked={elegidos.has(id)} onChange={() => alternar(id)} />
                            </td>
                            <td>{nombreCliente(c.cliente)}</td>
                            <td className="text-end">{c.reservas.length}</td>
                            <td className="text-end">{fmt(c.reservas.reduce((a, r) => a + r.cantidad, 0))}</td>
                            <td className="small">
                              {tel ? c.cliente.telefono : <span className="text-danger">sin teléfono</span>}
                            </td>
                            <td className="text-end">
                              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => descargar(c)} title="Ver el PDF">
                                <i className="bi bi-file-earmark-pdf"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : actual ? (
                <div className="text-center py-3">
                  <div className="small text-muted mb-1">
                    Cliente {cola.indexOf(actual) + 1} de {cola.length}
                  </div>
                  <h5 className="mb-1">{nombreCliente(actual.cliente)}</h5>
                  <div className="small text-muted mb-3">
                    {fmt(actual.reservas.reduce((a, r) => a + r.cantidad, 0))} pollitos en {actual.reservas.length} fecha
                    {actual.reservas.length === 1 ? "" : "s"}
                    {!normalizarWhatsapp(actual.cliente.telefono) && (
                      <span className="text-danger"> · sin teléfono: solo se descarga el PDF</span>
                    )}
                  </div>
                  <div className="d-flex flex-wrap gap-2 justify-content-center">
                    <button type="button" className="btn btn-success" onClick={() => enviar(actual)}>
                      <i className="bi bi-whatsapp me-1"></i>Descargar PDF y abrir WhatsApp
                    </button>
                    {puedeCompartir && (
                      <button type="button" className="btn btn-outline-success" onClick={() => compartir(actual)}>
                        <i className="bi bi-share me-1"></i>Compartir (celular)
                      </button>
                    )}
                    <button type="button" className="btn btn-outline-secondary"
                      onClick={() => setEnviados((prev) => new Set(prev).add(String(actual.cliente._id)))}>
                      Saltear
                    </button>
                  </div>
                  <div className="form-text mt-3">
                    En el chat que se abre, adjuntá el PDF que se descargó (WhatsApp no deja adjuntarlo solo) y enviá.
                    Después volvé acá para el siguiente.
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <i className="bi bi-check-circle text-success fs-1"></i>
                  <div className="mt-2">Listo: se preparó el informe de {cola.length} cliente{cola.length === 1 ? "" : "s"}.</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!cola ? (
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cerrar</button>
                  <button type="button" className="btn btn-success" disabled={elegidos.size === 0} onClick={empezar}>
                    <i className="bi bi-whatsapp me-1"></i>Enviar a {elegidos.size} cliente{elegidos.size === 1 ? "" : "s"}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                  {actual ? "Terminar después" : "Cerrar"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default InformeClientesPlan;
