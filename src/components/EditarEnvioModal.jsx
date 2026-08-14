import React, { useState, useMemo } from "react";
import CalibreTable, { calcularCajones } from "./CalibreTable";
import { trozadoLabel } from "./TrozadoTable";
import { editarEnvioCamara } from "../services/api";
import { ajustarFechaParaGuardar } from "../utils/dateUtils";
import Swal from "sweetalert2";

const camaraLabel = (v) => (v === "cañete" ? "Cañete" : v === "trigotuc" ? "Trigotuc" : v);
const formatNum   = (n) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
const trozKey     = (t) => `${t.tipo}|${t.clase || "A"}`;

/**
 * Modal para corregir un envío entre cámaras ya cargado.
 *
 * El backend ajusta el stock por DIFERENCIA contra lo guardado, así que acá solo
 * se manda el contenido final; no hace falta calcular nada del delta.
 *
 * Se monta solo cuando hay un envío para editar, y el padre le pasa `key={envio._id}`
 * para que cambiar de envío lo remonte con el estado inicial correcto.
 *
 * Props:
 *   envio      — envío a editar
 *   camiones, choferes — para los selects
 *   resumen    — resultado de obtenerResumenStock(), para los topes por línea
 *   onCerrar   — () => void
 *   onGuardado — () => void, tras guardar bien (el padre recarga su lista)
 */
const EditarEnvioModal = ({ envio, camiones = [], choferes = [], resumen, onCerrar, onGuardado }) => {
  const [form, setForm] = useState(() => ({
    // La fecha se guarda a las 12:00 UTC, así que el día calendario sale entero.
    fecha:         new Date(envio.fecha).toISOString().split("T")[0],
    camion:        envio.camion?._id || "",
    chofer:        envio.chofer?._id || "",
    observaciones: envio.observaciones || "",
  }));
  const [lineas, setLineas] = useState(() =>
    (envio.calibres || []).map((c) => ({ calibre: c.calibre, pollos: c.pollos, cajones: c.cajones }))
  );
  const [trozados, setTrozados] = useState(() =>
    (envio.trozados || []).map((t) => ({
      tipo: t.tipo, clase: t.clase || "A", kgCaja: t.kgCaja, cajas: String(t.cajas),
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  // El techo de cada línea es lo que queda en origen MÁS lo que este envío ya se
  // llevó: ese stock salió de origen al cargarlo, así que mantener la cantidad
  // actual tiene que seguir siendo posible.
  // useMemo, no un cálculo suelto: CalibreTable tiene un efecto que depende de la
  // identidad de `stockCalibres` y un array nuevo por render lo dispara de más.
  const stockCalibres = useMemo(() => {
    const base = envio.camaraOrigen === "cañete"
      ? (resumen?.stockCañete   || [])
      : (resumen?.stockTrigotuc || []);
    const mapa = new Map(base.map((s) => [s.calibre, s.cajones]));
    for (const c of envio.calibres || []) {
      mapa.set(c.calibre, (mapa.get(c.calibre) || 0) + c.cajones);
    }
    return [...mapa].map(([calibre, cajones]) => ({ calibre, cajones }));
  }, [envio, resumen]);

  // Unión de los trozados con stock en origen y los que el envío ya trae: si un
  // tipo quedó en cero en origen porque se lo llevó este mismo envío, igual tiene
  // que aparecer en la tabla para poder corregirlo.
  const trozadosDisponibles = useMemo(() => {
    const base = envio.camaraOrigen === "cañete"
      ? (resumen?.trozadosCañeteDetalle   || [])
      : (resumen?.trozadosTrigotucDetalle || []);
    const mapa = new Map();
    for (const t of base) {
      if (t.cajas > 0) mapa.set(trozKey(t), { tipo: t.tipo, clase: t.clase || "A", kgCaja: t.kgCaja, cajas: t.cajas });
    }
    for (const t of envio.trozados || []) {
      const prev = mapa.get(trozKey(t));
      mapa.set(trozKey(t), {
        tipo:  t.tipo,
        clase: t.clase || "A",
        // El kg/caja del envío manda sobre el de la cámara: así una línea que no se
        // toca vuelve idéntica y el backend no la ve como un cambio.
        kgCaja: t.kgCaja,
        cajas:  (prev?.cajas || 0) + t.cajas,
      });
    }
    return [...mapa.values()];
  }, [envio, resumen]);

  const handleGuardar = async (ev) => {
    ev.preventDefault();
    const lineasValidas = lineas
      .map((l) => ({ ...l, cajones: l.cajones ?? calcularCajones(l.pollos, l.calibre) }))
      .filter((l) => l.cajones > 0);
    const trozadosValidos = trozados.filter((t) => Number(t.cajas) > 0 && Number(t.kgCaja) > 0);

    if (lineasValidas.length === 0 && trozadosValidos.length === 0) {
      Swal.fire("Error", "El envío tiene que quedar con al menos un calibre o un trozado.", "error");
      return;
    }

    if (envio.estado === "recibido") {
      const confirm = await Swal.fire({
        title: "¿Guardar la corrección?",
        html:
          `El envío <strong>${envio.numeroEnvio}</strong> ya está recibido en ` +
          `<strong>${camaraLabel(envio.camaraDestino)}</strong>. Se va a ajustar solo la diferencia: ` +
          `lo que agregues sale de ${camaraLabel(envio.camaraOrigen)} y lo que quites vuelve desde ` +
          `${camaraLabel(envio.camaraDestino)}.<br><br>⚠️ Si lo que quitás ya se vendió o despachó, ` +
          "la operación se rechaza y no se toca nada.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, guardar",
        cancelButtonText: "Cancelar",
      });
      if (!confirm.isConfirmed) return;
    }

    setSubmitting(true);
    try {
      await editarEnvioCamara(envio._id, {
        fecha:         ajustarFechaParaGuardar(form.fecha),
        camion:        form.camion || null,
        chofer:        form.chofer || null,
        observaciones: form.observaciones,
        calibres:      lineasValidas.map(({ calibre, pollos, cajones }) => ({
          calibre: Number(calibre), pollos: Number(pollos), cajones,
        })),
        trozados:      trozadosValidos.map((t) => ({
          tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas), clase: t.clase || "A",
        })),
      });
      const numero = envio.numeroEnvio;
      onCerrar();
      Swal.fire("Guardado", `El envío ${numero} fue corregido y el stock ajustado.`, "success");
      onGuardado?.();
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo guardar la corrección.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            {/* El form es el flex-item de .modal-content, así que tiene que ser él
                la columna flexible y poder encogerse (min-height:0). Si queda como
                bloque normal, el .modal-body nunca recibe una altura acotada, su
                overflow-y:auto no llega a activarse y el contenido se corta contra
                el overflow:hidden del content. */}
            <form onSubmit={handleGuardar} className="d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-pencil me-2 text-warning"></i>
                  Editar envío <span className="badge bg-dark ms-1">{envio.numeroEnvio}</span>
                </h5>
                <button type="button" className="btn-close" onClick={onCerrar}></button>
              </div>

              <div className="modal-body">
                {/* El sentido del envío no se puede cambiar: daría vuelta todo el
                    stock que ya movió. Para eso se borra y se carga de nuevo. */}
                <div className="alert alert-secondary py-2 d-flex align-items-center gap-2">
                  <i className="bi bi-arrow-left-right"></i>
                  <div>
                    <span className="badge bg-secondary">{camaraLabel(envio.camaraOrigen)}</span>
                    <i className="bi bi-arrow-right text-muted mx-1"></i>
                    <span className="badge bg-secondary">{camaraLabel(envio.camaraDestino)}</span>
                    <div className="small text-muted mt-1">
                      El sentido del envío no se puede cambiar. Si está mal, eliminá el envío y cargalo de nuevo.
                    </div>
                  </div>
                </div>

                {envio.estado === "recibido" && (
                  <div className="alert alert-warning py-2">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Este envío ya fue <strong>recibido en {camaraLabel(envio.camaraDestino)}</strong>.
                    Se ajusta solo la diferencia: lo que agregues sale de {camaraLabel(envio.camaraOrigen)} y
                    lo que quites vuelve desde {camaraLabel(envio.camaraDestino)}. Si eso ya se vendió, se rechaza.
                  </div>
                )}

                {envio.preparado && (
                  <div className="alert alert-info py-2">
                    <i className="bi bi-info-circle me-2"></i>
                    El envío ya estaba <strong>preparado</strong>. Si cambiás el contenido vuelve a
                    pendiente de preparación para que frigorífico reimprima la orden.
                  </div>
                )}

                <div className="row g-3 mb-3">
                  <div className="col-12 col-sm-4">
                    <label className="form-label">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.fecha}
                      onChange={(ev) => setForm((p) => ({ ...p, fecha: ev.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-12 col-sm-4">
                    <label className="form-label">Camión</label>
                    <select
                      className="form-select"
                      value={form.camion}
                      onChange={(ev) => setForm((p) => ({ ...p, camion: ev.target.value }))}
                    >
                      <option value="">— Sin especificar —</option>
                      {camiones.map((c) => (
                        <option key={c._id} value={c._id}>{c.marca} — {c.patente}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-sm-4">
                    <label className="form-label">Chofer</label>
                    <select
                      className="form-select"
                      value={form.chofer}
                      onChange={(ev) => setForm((p) => ({ ...p, chofer: ev.target.value }))}
                    >
                      <option value="">— Sin especificar —</option>
                      {choferes.map((c) => (
                        <option key={c._id} value={c._id}>{c.nombreUsuario}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Observaciones</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.observaciones}
                      onChange={(ev) => setForm((p) => ({ ...p, observaciones: ev.target.value }))}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Cajones por calibre</label>
                  {/* El disponible que se muestra ya incluye lo que este envío se
                      llevó, así que mantener la cantidad actual siempre entra. */}
                  <CalibreTable
                    lineas={lineas}
                    onChange={setLineas}
                    inputCajones
                    showPollos={false}
                    stockCalibres={stockCalibres}
                  />
                </div>

                {trozadosDisponibles.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Trozados</label>
                    <table className="table table-sm table-bordered align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Tipo</th>
                          <th>Clase</th>
                          <th className="text-end">Disponible (cajas)</th>
                          <th style={{ width: "9rem" }}>Cajas a enviar</th>
                          <th className="text-muted small">kg/caja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trozadosDisponibles.map((t) => {
                          const linea = trozados.find((l) => l.tipo === t.tipo && (l.clase || "A") === t.clase)
                            || { tipo: t.tipo, clase: t.clase, cajas: "", kgCaja: t.kgCaja };
                          return (
                            <tr key={`${t.tipo}-${t.clase}`}>
                              <td className="fw-semibold">{trozadoLabel(t.tipo)}</td>
                              <td><span className="badge bg-secondary">Clase {t.clase}</span></td>
                              <td className="text-end text-muted">{formatNum(t.cajas)}</td>
                              <td>
                                <input
                                  type="number" min="0" max={t.cajas} step="1"
                                  className="form-control form-control-sm text-center"
                                  placeholder="0"
                                  value={linea.cajas}
                                  onChange={(ev) => {
                                    const val = ev.target.value;
                                    setTrozados((prev) => {
                                      const idx = prev.findIndex((l) => l.tipo === t.tipo && (l.clase || "A") === t.clase);
                                      const nueva = { tipo: t.tipo, clase: t.clase, cajas: val, kgCaja: t.kgCaja };
                                      if (idx === -1) return [...prev, nueva];
                                      return prev.map((l, i) => (i === idx ? nueva : l));
                                    });
                                  }}
                                />
                              </td>
                              <td className="text-muted small">{t.kgCaja} kg</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onCerrar} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-warning" disabled={submitting}>
                  {submitting && <span className="spinner-border spinner-border-sm me-1"></span>}
                  <i className="bi bi-check-lg me-1"></i>
                  Guardar corrección
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

export default EditarEnvioModal;
