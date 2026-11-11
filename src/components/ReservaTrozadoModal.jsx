import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { obtenerLotesReservaTrozado, reservarParaTrozar, liberarReservaTrozado } from "../services/api";
import { FilaLote, InputCantidad } from "./TrozarCamaraModal";
import { fmt } from "../utils/camaraLotes";

// Reserva para trozar (2026-11-11): aparta cajones de la cámara de Cañete para
// trozarlos en los días siguientes. Siguen en la cámara pero dejan de ser stock
// vendible. `modo`: "reservar" (disponible → reserva) o "liberar" (al revés).
// Ver services/reservaTrozado.services.js.
export const ReservaTrozadoModal = ({ modo, onClose, onGuardado }) => {
  const reservar = modo === "reservar";
  const [lotes, setLotes] = useState(null);
  const [marcados, setMarcados] = useState({}); // { loteId: { calibre: "n" } }
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerLotesReservaTrozado()
      .then((ls) => setLotes(
        ls.map((l) => ({ ...l, opciones: reservar ? l.calibres : l.reservados }))
          .filter((l) => l.opciones.some((c) => c.cajones > 0))
      ))
      .catch((e) => { Swal.fire("Error", e.message, "error"); setLotes([]); });
  }, [reservar]);

  const partes = useMemo(() => (lotes || [])
    .filter((l) => marcados[l._id])
    .map((l) => ({
      lote: l,
      enteros: l.opciones
        .map((c) => ({ calibre: c.calibre, cajones: Number(marcados[l._id][c.calibre]) || 0, max: c.cajones }))
        .filter((c) => c.cajones > 0),
    }))
    .filter((p) => p.enteros.length), [lotes, marcados]);
  const excedido = partes.some((p) => p.enteros.some((e) => e.cajones > e.max));
  const totalCajones = partes.reduce((a, p) => a + p.enteros.reduce((s, e) => s + e.cajones, 0), 0);

  const marcar = (id, si) => {
    const nuevo = { ...marcados };
    if (si) nuevo[id] = {}; else delete nuevo[id];
    setMarcados(nuevo);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!partes.length) return Swal.fire("Faltan cajones", "Marcá los lotes e indicá los cajones.", "warning");
    if (excedido) return Swal.fire("Cantidad", "Hay calibres con más cajones de los que tiene el lote.", "warning");
    setGuardando(true);
    try {
      const fn = reservar ? reservarParaTrozar : liberarReservaTrozado;
      await fn({
        lotes: partes.map((p) => ({
          lote: p.lote._id,
          enteros: p.enteros.map(({ calibre, cajones }) => ({ calibre, cajones })),
        })),
      });
      Swal.fire("Listo",
        reservar
          ? `${fmt(totalCajones)} cajones reservados para trozar. Ya no figuran en el stock para la venta.`
          : `${fmt(totalCajones)} cajones liberados: vuelven al stock para la venta.`,
        "success");
      onGuardado();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className={`bi ${reservar ? "bi-bookmark-plus" : "bi-bookmark-dash"} me-2 text-warning`}></i>
                {reservar ? "Reservar para trozar" : "Liberar reserva para trozar"} — Cámara Cañete
              </h5>
              <button className="btn-close" onClick={onClose} disabled={guardando}></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-light border small py-2">
                {reservar
                  ? "Los cajones reservados siguen en la cámara, pero salen del stock para la venta hasta que se troza o se libera la reserva. Al trozar, se usa primero lo reservado."
                  : "Los cajones liberados vuelven al stock para la venta."}
              </div>
              {lotes === null ? (
                <p className="text-muted small mb-0">Cargando lotes…</p>
              ) : lotes.length === 0 ? (
                <div className="alert alert-light border mb-0">
                  {reservar ? "No hay pollo entero disponible en Cañete." : "No hay nada reservado para trozar."}
                </div>
              ) : (
                <form id="form-reserva" onSubmit={guardar}>
                  {lotes.map((l) => (
                    <FilaLote key={l._id} lote={l} marcado={!!marcados[l._id]} onMarcar={(si) => marcar(l._id, si)}
                      resumen={l.opciones.map((c) => `cal. ${c.calibre}: ${fmt(c.cajones)} caj${reservar ? "" : " reservados"}`).join(" · ")}>
                      <div className="d-flex flex-wrap gap-3">
                        {l.opciones.map((c) => (
                          <div key={c.calibre}>
                            <div className="small text-muted">Cal. {c.calibre} <span className="ms-1">(hay {fmt(c.cajones)})</span></div>
                            <InputCantidad valor={marcados[l._id]?.[c.calibre]} max={c.cajones}
                              onChange={(v) => setMarcados({ ...marcados, [l._id]: { ...marcados[l._id], [c.calibre]: v } })} />
                          </div>
                        ))}
                      </div>
                    </FilaLote>
                  ))}
                </form>
              )}
            </div>
            <div className="modal-footer">
              {totalCajones > 0 && <span className="me-auto small text-muted">{fmt(totalCajones)} cajones</span>}
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
              <button type="submit" form="form-reserva" className="btn btn-warning"
                disabled={guardando || !partes.length || excedido}>
                {guardando ? "Guardando…" : reservar ? "Reservar" : "Liberar"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

export default ReservaTrozadoModal;
