import React, { useState } from "react";
import { aceptarEnvioAlimento, editarRecepcionAlimento } from "../services/api";
import { obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";

const fmt = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

/**
 * Recibir un envío de alimento en la granja, donde están los silos.
 *
 * ⚠️ Lo que entra al silo es lo PESADO acá (el camión se pesa en la granja), no
 * lo despachado — también en las líneas en bolsa (2026-09-30). Si no coincide,
 * se pide el motivo y la diferencia queda registrada en el envío.
 *
 * Arranca precargado con lo que salió, porque el caso normal es que venga
 * completo: así solo hay que tocar lo que no coincide.
 *
 * Lo que no se puede adivinar es a qué galpón va cada línea. Al elegirlo, los
 * kg se reparten solos entre SUS silos llenando el que tiene lugar (14.000 kg
 * cada uno) y el resto al siguiente; el reparto queda editable.
 */
const RecepcionAlimentoModal = ({ envio, silos, grupos, stock, etiquetaTipo, onClose, onHecho }) => {
  // Si el envío ya está recibido, el modal CORRIGE esa recepción (2026-09-30):
  // arranca con lo que se cargó y al guardar el back la deshace y la rehace.
  const edicion = envio.estado === "aceptado";
  const grupoDeReparto = (reparto = []) =>
    reparto.length ? grupos.find((g) => g.silos.includes(reparto[0].silo))?.clave || "" : "";

  const [fecha, setFecha] = useState(
    edicion && envio.fechaAcepta ? String(envio.fechaAcepta).split("T")[0] : obtenerFechaHoy()
  );
  const [motivo, setMotivo] = useState(edicion ? envio.motivoDiferencia || "" : "");
  const [saving, setSaving] = useState(false);
  const [lineas, setLineas] = useState(() =>
    (envio.lineas || []).map((l) => ({
      _id: l._id,
      tipo: l.tipo,
      presentacion: l.presentacion,
      bolsas: l.bolsas,
      kgPorBolsa: l.kgPorBolsa,
      kgEnviados: l.kg,
      // Nuevo: precargado con lo enviado. Corrección: con lo que se pesó.
      kgReales: String(edicion ? l.kgReales ?? 0 : l.kg ?? ""),
      grupo: edicion ? grupoDeReparto(l.reparto) : "",
      reparto: edicion
        ? Object.fromEntries((l.reparto || []).map((t) => [t.silo, String(t.kg)]))
        : {}, // { [silo]: "kg" }
    }))
  );

  const kgRecibidosDe = (l) => Number(l.kgReales) || 0;

  // Lo que este mismo envío ocupa hoy en cada silo: al corregir se devuelve antes
  // de volver a cargarlo, así que cuenta como lugar libre.
  const ocupaEsteEnvio = (silo) =>
    edicion
      ? (envio.lineas || []).reduce(
          (acc, l) => acc + (l.reparto || []).filter((t) => t.silo === silo).reduce((a, t) => a + t.kg, 0),
          0
        )
      : 0;

  const capacidadDe = (silo) => silos.find((s) => s.numero === silo)?.capacidadKg ?? 0;
  const libreEnStock = (silo) =>
    ((stock?.silos || []).find((s) => s.silo === silo)?.libreKg ?? capacidadDe(silo)) + ocupaEsteEnvio(silo);

  // Lo libre de un silo descontando lo que YA le asignaron las otras líneas.
  const libreParaLinea = (todas, idx, silo) =>
    libreEnStock(silo) -
    todas.reduce((acc, l, j) => (j === idx ? acc : acc + (Number(l.reparto[silo]) || 0)), 0);

  // Llena los silos del grupo en orden: el primero hasta donde entra y el resto
  // al siguiente. Lo que no entra en ninguno queda en el último, para que el
  // aviso de "no entra" lo muestre en vez de perderse.
  const autollenar = (todas, idx) => {
    const l = todas[idx];
    const g = grupos.find((x) => x.clave === l.grupo);
    if (!g) return { ...l, reparto: {} };
    let resta = kgRecibidosDe(l);
    const reparto = {};
    g.silos.forEach((silo, k) => {
      const ultimo = k === g.silos.length - 1;
      const entra = ultimo ? resta : Math.max(0, Math.min(resta, libreParaLinea(todas, idx, silo)));
      reparto[silo] = entra > 0 ? String(Math.round(entra * 100) / 100) : "";
      resta -= entra;
    });
    return { ...l, reparto };
  };

  const setLinea = (i, campo, valor) =>
    setLineas((prev) => {
      const nuevas = prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l));
      // Cambiar el galpón o lo pesado rehace el reparto; tocar un silo a mano no.
      if (["grupo", "kgReales"].includes(campo)) {
        nuevas[i] = { ...nuevas[i], reparto: {} };
        nuevas[i] = autollenar(nuevas, i);
      }
      return nuevas;
    });

  const setRepartoSilo = (i, silo, valor) =>
    setLineas((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, reparto: { ...l.reparto, [silo]: valor } } : l))
    );

  const sumaReparto = (l) =>
    Object.values(l.reparto).reduce((acc, v) => acc + (Number(v) || 0), 0);

  // Lo que entra a cada silo sumando todas las líneas, contra su lugar libre.
  const entraPorSilo = {};
  for (const l of lineas)
    for (const [silo, v] of Object.entries(l.reparto))
      entraPorSilo[silo] = (entraPorSilo[silo] || 0) + (Number(v) || 0);
  const silosPasados = Object.entries(entraPorSilo)
    .filter(([silo, kg]) => kg > libreEnStock(Number(silo)) + 0.01)
    .map(([silo]) => Number(silo));

  const kgTotalReal = lineas.reduce((acc, l) => acc + kgRecibidosDe(l), 0);
  const diferencia = Math.round((kgTotalReal - envio.kgTotales) * 100) / 100;
  const hayDiferencia = Math.abs(diferencia) > 0.01;
  const faltaMotivo = hayDiferencia && !motivo.trim();
  const faltaGalpon = lineas.some((l) => kgRecibidosDe(l) > 0 && !l.grupo);
  const repartoDescuadrado = lineas.some(
    (l) => kgRecibidosDe(l) > 0 && l.grupo && Math.abs(sumaReparto(l) - kgRecibidosDe(l)) > 0.01
  );
  const nadaRecibido = kgTotalReal <= 0;
  const bloqueado =
    nadaRecibido || faltaGalpon || repartoDescuadrado || silosPasados.length > 0 || faltaMotivo;

  const nombreSilo = (n) => silos.find((s) => s.numero === n)?.nombre || `Silo ${n}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (bloqueado) return;
    setSaving(true);
    try {
      const guardar = edicion ? editarRecepcionAlimento : aceptarEnvioAlimento;
      const actualizado = await guardar(envio._id, {
        fechaAcepta: ajustarFechaParaGuardar(fecha),
        motivoDiferencia: hayDiferencia ? motivo.trim() : undefined,
        lineas: lineas.map((l) => ({
          _id: l._id,
          kgReales: kgRecibidosDe(l),
          reparto: Object.entries(l.reparto)
            .map(([silo, kg]) => ({ silo: Number(silo), kg: Number(kg) || 0 }))
            .filter((t) => t.kg > 0),
        })),
      });
      await onHecho();
      Swal.fire({
        icon: "success",
        title: `${envio.numero} ${edicion ? "corregido" : "recibido"}`,
        html:
          `Entraron <strong>${fmt(actualizado.kgTotalesReales)} kg</strong> a los silos.` +
          (hayDiferencia
            ? `<br/><span class="text-muted">Quedó registrada una diferencia de ${diferencia > 0 ? "+" : ""}${fmt(diferencia)} kg.</span>`
            : ""),
        timer: 3500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || (edicion ? "No se pudo corregir la recepción." : "No se pudo recibir el envío."), "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white py-2">
              <h5 className="modal-title fs-6">
                <i className={`bi ${edicion ? "bi-pencil" : "bi-box-arrow-in-down"} me-2`}></i>
                {edicion ? `Corregir la recepción de ${envio.numero}` : `Recibir ${envio.numero}`}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>
            {/* El form es hijo de modal-content (flex column): sin d-flex y
                minHeight 0 el body no scrollea y el footer queda cortado. */}
            <form
              onSubmit={handleSubmit}
              className="d-flex flex-column flex-grow-1"
              style={{ minHeight: 0 }}
            >
              <div className="modal-body py-2">
                {edicion && (
                  <div className="alert alert-warning py-2 small">
                    <i className="bi bi-info-circle me-1"></i>
                    Al guardar se deshace la recepción anterior y se carga esta en su lugar.
                    Solo se puede mientras no se haya usado alimento de este envío.
                  </div>
                )}
                <p className="small text-muted">
                  Cargá los <strong>kg que marcó la balanza</strong> al pesar el camión: eso es lo
                  que entra al silo. Viene precargado con lo que salió. Elegí a qué{" "}
                  <strong>galpón</strong> va cada línea y se reparte sola en sus silos.
                </p>

                <label className="form-label fw-semibold small mb-1">Fecha de recepción</label>
                <input
                  type="date" className="form-control form-control-sm mb-3"
                  value={fecha} onChange={(ev) => setFecha(ev.target.value)}
                  disabled={saving} required
                />

                {lineas.map((l, i) => {
                  const esBolsa = l.presentacion === "bolsa";
                  const kgRec = kgRecibidosDe(l);
                  const dif = Math.round((kgRec - l.kgEnviados) * 100) / 100;
                  const g = grupos.find((x) => x.clave === l.grupo);
                  const suma = sumaReparto(l);
                  const descuadre = g && kgRec > 0 && Math.abs(suma - kgRec) > 0.01;
                  return (
                    <div key={l._id} className="border rounded p-2 mb-2">
                      <div className="row g-2 align-items-start">
                        <div className="col-12 col-md-4">
                          <div className="small fw-semibold">{etiquetaTipo(l.tipo)}</div>
                          <div className="text-muted" style={{ fontSize: ".72rem" }}>
                            Salió: {esBolsa
                              ? `${fmt(l.bolsas)} bolsas de ${fmt(l.kgPorBolsa)} kg (${fmt(l.kgEnviados)} kg)`
                              : `${fmt(l.kgEnviados)} kg a granel`}
                          </div>
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label small mb-0">Pesado (kg)</label>
                          <input
                            type="number" min="0" step="0.1"
                            className="form-control form-control-sm text-center"
                            value={l.kgReales}
                            onChange={(ev) => setLinea(i, "kgReales", ev.target.value)}
                            disabled={saving}
                            placeholder="0"
                          />
                          {dif !== 0 && (
                            <div className={`small text-end ${dif < 0 ? "text-danger" : "text-success"}`}>
                              {dif > 0 ? "+" : ""}{fmt(dif)} kg
                            </div>
                          )}
                        </div>
                        <div className="col-6 col-md-5">
                          <label className="form-label small mb-0">Va al</label>
                          <select
                            className={`form-select form-select-sm ${kgRec > 0 && !l.grupo ? "is-invalid" : ""}`}
                            value={l.grupo}
                            onChange={(ev) => setLinea(i, "grupo", ev.target.value)}
                            disabled={saving || kgRec <= 0}
                          >
                            <option value="">— Elegí el galpón —</option>
                            {grupos.map((gr) => (
                              <option key={gr.clave} value={gr.clave}>
                                {gr.nombre} ({gr.silos.length === 1 ? "1 silo" : `${gr.silos.length} silos`})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {g && kgRec > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          {g.silos.map((silo) => {
                            const pasado = silosPasados.includes(silo);
                            return (
                              <div key={silo} style={{ minWidth: 170, flex: "1 1 170px" }}>
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text">{nombreSilo(silo)}</span>
                                  <input
                                    type="number" min="0" step="0.1"
                                    className={`form-control text-end ${pasado ? "is-invalid" : ""}`}
                                    value={l.reparto[silo] ?? ""}
                                    onChange={(ev) => setRepartoSilo(i, silo, ev.target.value)}
                                    disabled={saving}
                                    placeholder="0"
                                  />
                                  <span className="input-group-text">kg</span>
                                </div>
                                <div className={pasado ? "text-danger" : "text-muted"} style={{ fontSize: ".72rem" }}>
                                  {pasado
                                    ? `No entra: tiene lugar para ${fmt(libreEnStock(silo))} kg`
                                    : `libre ${fmt(libreEnStock(silo))} de ${fmt(capacidadDe(silo))} kg`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {descuadre && (
                        <div className="text-danger small mt-1">
                          El reparto suma {fmt(suma)} kg y se pesaron {fmt(kgRec)} kg.
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── Diferencia contra lo despachado ── */}
                <div className={`border rounded p-2 mt-3 ${hayDiferencia ? "border-warning bg-warning-subtle" : "bg-light"}`}>
                  <div className="d-flex flex-wrap justify-content-between small">
                    <span>Despachado: <strong>{fmt(envio.kgTotales)} kg</strong></span>
                    <span>Pesado: <strong>{fmt(kgTotalReal)} kg</strong></span>
                    <span>
                      Diferencia:{" "}
                      <strong className={hayDiferencia ? (diferencia < 0 ? "text-danger" : "text-success") : ""}>
                        {hayDiferencia ? `${diferencia > 0 ? "+" : ""}${fmt(diferencia)} kg` : "ninguna"}
                      </strong>
                    </span>
                  </div>
                  {hayDiferencia && (
                    <div className="mt-2">
                      <label className="form-label small fw-semibold mb-1">
                        Motivo de la diferencia <span className="text-danger">*</span>
                      </label>
                      <textarea
                        className={`form-control form-control-sm ${faltaMotivo ? "is-invalid" : ""}`}
                        rows={2}
                        value={motivo}
                        onChange={(ev) => setMotivo(ev.target.value)}
                        disabled={saving}
                        placeholder="Ej.: bolsas rotas en el viaje, diferencia de balanza…"
                      />
                      <div className="text-muted mt-1" style={{ fontSize: ".72rem" }}>
                        Queda registrado en el envío, junto con la diferencia.
                      </div>
                    </div>
                  )}
                </div>

                {bloqueado && (
                  <div className="alert alert-secondary py-2 mt-2 mb-0 small">
                    {nadaRecibido
                      ? "Cargá cuánto pesó cada línea."
                      : faltaGalpon
                        ? "Falta decir a qué galpón va alguna de las líneas."
                        : repartoDescuadrado
                          ? "El reparto en los silos no coincide con lo pesado en alguna línea."
                          : silosPasados.length > 0
                            ? `No entra en ${silosPasados.map(nombreSilo).join(", ")}: pasá lo que sobra al otro silo del galpón.`
                            : "Anotá el motivo de la diferencia."}
                  </div>
                )}
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={saving || bloqueado}>
                  {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-check2-circle me-1"></i>{edicion ? "Guardar corrección" : "Confirmar recepción"}
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

export default RecepcionAlimentoModal;
