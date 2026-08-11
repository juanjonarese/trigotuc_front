import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { TrozadoTable, trozadosVacios, trozadosAPayload } from "../components/TrozadoTable";
import { crearLote, obtenerOrdenesCarga } from "../services/api";
import { obtenerFechaHoy, ajustarFechaParaGuardar } from "../utils/dateUtils";
import { validarDestinoFaena, advertirRestosDeCajon } from "../utils/faenaValidacion";
import DesgloseFaena from "../components/DesgloseFaena";
import Swal from "sweetalert2";

const fmtNum = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

const FORM_VACIO = {
  fechaIngreso:        obtenerFechaHoy(),
  // Lo que bajó del camión. Las faenadas las deriva el backend restando muertos
  // y, si es faena parcial, los que vuelven a granja.
  unidadesRecibidas:   "",
  kgVivos:             "",
  muertos:             "",
  kgMuertos:           "",
  unidadesDecomisadas: "",
  kgDecomisados:       "",
  unidadesTrozadas:    "",
  kgTrozados:          "",
  observaciones:       "",
  faenaParcial:        false,
  pollosSinFaenar:     "",
};

const VOLVER_A = "/frigorifico/lotes/nuevo";

// ── Página nuevo lote de faena ───────────────────────────────────────────────
const LoteFaenaCrearPage = () => {
  const navigate = useNavigate();

  const rolUsuario = localStorage.getItem("rolUsuario");
  const puedeCrear = rolUsuario === "superadmin" || rolUsuario === "frigorifico";

  const [recepciones, setRecepciones]   = useState([]);
  const [loadingRec, setLoadingRec]     = useState(true);
  const [recepcionSel, setRecepcionSel] = useState(null);
  const [form, setForm]         = useState(FORM_VACIO);
  const [lineas, setLineas]     = useState([]);
  const [trozados, setTrozados] = useState(trozadosVacios());
  const [saving, setSaving]     = useState(false);
  const calibreRef              = useRef(null);
  const recepcionRef            = useRef(null);

  useEffect(() => {
    if (!puedeCrear) {
      navigate(VOLVER_A, { replace: true });
      return;
    }
    setLoadingRec(true);
    obtenerOrdenesCarga({ estado: "entregada", tipo: "pedido_frigorifico" })
      .then((data) => setRecepciones(data.filter((o) => !o.loteAsociado || o.faenaPendiente)))
      .catch(() => {})
      .finally(() => setLoadingRec(false));
  }, [puedeCrear, navigate]);

  useEffect(() => {
    if (!loadingRec && recepcionRef.current) {
      recepcionRef.current.focus();
    }
  }, [loadingRec]);

  const handleSeleccionarRecepcion = (e) => {
    const id = e.target.value;
    if (!id) {
      setRecepcionSel(null);
      setForm((f) => ({ ...f, kgVivos: "", unidadesRecibidas: "" }));
      return;
    }
    const rec = recepciones.find((o) => o._id === id) || null;
    setRecepcionSel(rec);
    if (rec) {
      // kgVivos y unidadesRecibidas no se autofill:
      // esos datos reales solo se conocen al terminar la faena (no en la recepción).
      setForm((f) => ({ ...f, kgVivos: "", unidadesRecibidas: "" }));
    }
  };

  // Totales para preview (sin incluir draft)
  const totalCajones  = lineas.reduce((acc, l) => acc + calcularCajones(l.pollos, l.calibre), 0);
  const totalPollos   = lineas.reduce((acc, l) => acc + Number(l.pollos || 0), 0);
  const totalKg       = totalCajones * 20;
  const kgMenudo      = trozados
    .filter((t) => t.tipo === "menudo")
    .reduce((s, t) => s + (Number(t.cajas) || 0) * (Number(t.kgCaja) || 0), 0);
  const kgTrozadosTotal = (Number(form.kgTrozados) || 0) + kgMenudo;
  const hayTrozados     = kgTrozadosTotal > 0 || trozados.some((t) => Number(t.cajas) > 0);
  // Regla fija: los enteros (por calibre) van directo a cámara; los trozados
  // quedan pendientes (deben congelarse antes de poder venderse y sumar stock).
  const kgACamaraAhora  = totalKg;
  const kgPendiente     = kgTrozadosTotal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Obtiene líneas incluyendo el draft pendiente (si el usuario no clickeó "Aceptar")
    const lineasFinales = calibreRef.current?.getLineas() ?? lineas;
    const calibresPayload = lineasFinales
      .map((l) => ({ calibre: Number(l.calibre), pollos: Number(l.pollos), cajones: calcularCajones(l.pollos, l.calibre) }))
      // Filtra por pollos, NO por cajones: una línea con menos pollos que un cajón
      // (ej. 3 pollos de calibre 9) igual es stock y se perdía al descartarla acá.
      .filter((l) => l.pollos > 0);

    if (!recepcionSel) {
      Swal.fire("Error", "Seleccioná la recepción de granja que vas a faenar. La faena debe partir de un pedido hecho a granja.", "error");
      return;
    }
    if (calibresPayload.length === 0 && !hayTrozados) {
      Swal.fire("Error", "Agregá al menos un calibre con pollos o cargá trozados.", "error");
      return;
    }
    // Todo pollo faenado tiene que tener destino: calibres + trozados + decomisados.
    // Bloqueante — el backend aplica la misma regla.
    const pollosCalibres = calibresPayload.reduce((a, c) => a + c.pollos, 0);
    const coherente = await validarDestinoFaena({
      unidadesRecibidas:   form.unidadesRecibidas,
      muertos:             form.muertos,
      pollosSinFaenar:     form.faenaParcial ? form.pollosSinFaenar : 0,
      pollosCalibres,
      unidadesTrozadas:    form.unidadesTrozadas,
      unidadesDecomisadas: form.unidadesDecomisadas,
    });
    if (!coherente) return;
    // Aviso NO bloqueante: pollos que no completan cajón quedan como stock que no
    // se puede despachar y se arrastra de lote en lote.
    if (!(await advertirRestosDeCajon({ calibres: calibresPayload, confirmText: "Crear igual" }))) return;
    setSaving(true);
    try {

      const totalCajonesF = calibresPayload.reduce((a, c) => a + c.cajones, 0);
      const totalPollosF  = calibresPayload.reduce((a, c) => a + c.pollos, 0);
      const totalKgF      = totalCajonesF * 20;

      const payload = {
        fechaIngreso:    ajustarFechaParaGuardar(form.fechaIngreso),
        calibres:        calibresPayload,
        observaciones:   form.observaciones || undefined,
        // Enteros directo a cámara; trozados quedan pendientes (deben congelarse).
        enterosACamara:  true,
        trozadosACamara: false,
      };
      if (form.kgVivos)             payload.kgVivos             = Number(form.kgVivos);
      // El backend deriva `unidadesFaenadas` restando muertos y sin faenar.
      if (form.unidadesRecibidas)   payload.unidadesRecibidas   = Number(form.unidadesRecibidas);
      if (form.muertos)             payload.muertos             = Number(form.muertos);
      if (form.kgMuertos)           payload.kgMuertos           = Number(form.kgMuertos);
      if (form.unidadesDecomisadas) payload.unidadesDecomisadas = Number(form.unidadesDecomisadas);
      if (form.kgDecomisados)       payload.kgDecomisados       = Number(form.kgDecomisados);
      if (form.unidadesTrozadas)    payload.unidadesTrozadas    = Number(form.unidadesTrozadas);
      if (form.kgTrozados)          payload.kgTrozados          = Number(form.kgTrozados);
      if (recepcionSel)             payload.ordenCarga          = recepcionSel._id;
      if (form.faenaParcial) {
        payload.faenaParcial    = true;
        payload.pollosSinFaenar = Number(form.pollosSinFaenar || 0);
      }

      const trozadosPayload = trozadosAPayload(trozados);
      if (trozadosPayload.length > 0) payload.trozados = trozadosPayload;

      const { lote: loteCreado } = await crearLote(payload);

      await Swal.fire({
        icon:  "success",
        title: `Lote #${loteCreado.numeroLote} creado`,
        html:  (totalCajonesF > 0
                 ? `${fmtNum(totalPollosF)} pollos · ${fmtNum(totalCajonesF)} cajones · ${fmtNum(totalKgF)} kg` +
                   `<br><span class="text-success"><i class="bi bi-snow"></i> Enteros ingresados a cámara Cañete.</span>`
                 : `<span class="text-muted">Faena sin enteros por calibre (solo trozados).</span>`) +
               (kgPendiente > 0
                 ? `<br><span class="text-warning"><i class="bi bi-snow2"></i> ${fmtNum(kgPendiente)} kg de trozados quedan congelando (pendientes de cámara).</span>` +
                   `<br><span class="text-muted small">Pasálos a cámara desde Lotes de Faena → pestaña "Trozados pendientes" cuando estén en condiciones.</span>`
                 : ""),
      });
      navigate(VOLVER_A);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo crear el lote.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container-fluid">

        {/* Encabezado */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h1 className="h3 mb-0">
            <i className="bi bi-plus-circle me-2 text-success"></i>
            Nuevo Lote de Faena
          </h1>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(VOLVER_A)} disabled={saving}>
            <i className="bi bi-arrow-left me-1"></i>Volver a Lotes
          </button>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body">
            {/* Selector de recepción */}
            <div className="mb-3">
              <label className="form-label fw-semibold">
                <i className="bi bi-box-arrow-in-down me-1 text-primary"></i>
                Recepción de granja a faenar <span className="text-danger">*</span>
              </label>
              {loadingRec ? (
                <div className="d-flex align-items-center gap-2 text-muted small">
                  <div className="spinner-border spinner-border-sm"></div>Cargando recepciones...
                </div>
              ) : recepciones.length === 0 ? (
                <div className="alert alert-warning mb-0 py-2 small">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  No hay recepciones de granja pendientes de faena. Para faenar tenés que crear un pedido a granja
                  y recepcionarlo primero.
                  <div className="mt-2">
                    <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => navigate("/frigorifico/pedidos-granja")}>
                      <i className="bi bi-truck me-1"></i>Ir a Pedidos a Granja
                    </button>
                  </div>
                </div>
              ) : (
                <select className="form-select" ref={recepcionRef} value={recepcionSel?._id || ""} onChange={handleSeleccionarRecepcion} required>
                  <option value="">— Seleccioná una recepción —</option>
                  {recepciones.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.numero} · {o.granja === "cañete" ? "Cañete" : "Los Pinos"}{o.galpon ? ` G${o.galpon}` : ""} · ~{fmtNum(o.cantidadEstimada)} pollos{o.faenaPendiente ? " · ⚠ faena parcial" : ""}
                    </option>
                  ))}
                </select>
              )}
              <div className="form-text">
                El lote a faenar debe corresponder a una recepción de un pedido hecho a granja.
              </div>
            </div>

            {/* Banner recepción seleccionada */}
            {recepcionSel && (
              <div className={`alert border-start border-4 mb-3 py-3 ${recepcionSel.faenaPendiente ? "alert-warning border-warning" : "alert-primary border-primary"}`}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-box-arrow-in-down fs-5"></i>
                  <strong>Recepción {recepcionSel.numero}</strong>
                  <span className="text-muted small">
                    — {recepcionSel.granja === "cañete" ? "Cañete" : "Los Pinos"}
                    {recepcionSel.galpon && ` G${recepcionSel.galpon}`}
                  </span>
                  {recepcionSel.faenaPendiente && (
                    <span className="badge bg-warning text-dark ms-1">
                      <i className="bi bi-hourglass-split me-1"></i>Faena parcial — continuación
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <div className="text-center px-3 border-end">
                    <div className="text-muted small">Pollos pedidos (est.)</div>
                    <div className="fw-bold">{fmtNum(recepcionSel.cantidadEstimada)}</div>
                  </div>
                  <div className="text-center px-3 border-end">
                    <div className="text-muted small">Kg estimados</div>
                    <div className="fw-bold">{recepcionSel.pesoEstimadoKg} kg</div>
                  </div>
                  {recepcionSel.cantidadReal != null && (
                    <div className="text-center px-3 border-end">
                      <div className="text-muted small">Real total faena</div>
                      <div className="fw-bold text-success">{fmtNum(recepcionSel.cantidadReal)} pol · {recepcionSel.pesoRealKg} kg</div>
                    </div>
                  )}
                </div>
                {recepcionSel.observacionesEntrega && (
                  <div className="mt-2 small text-muted">
                    <i className="bi bi-chat-left me-1"></i>{recepcionSel.observacionesEntrega}
                  </div>
                )}
              </div>
            )}

            <form id="form-nuevo-lote" onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold">Fecha de faena</label>
                  <input type="date" className="form-control"
                    value={form.fechaIngreso}
                    onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
                    required />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold">Unidades recibidas</label>
                  <input type="number" className="form-control"
                    value={form.unidadesRecibidas}
                    onChange={(e) => setForm({ ...form, unidadesRecibidas: e.target.value })}
                    min="0" placeholder={recepcionSel ? fmtNum(recepcionSel.cantidadReal) : "0"} />
                  <div className="form-text">Todo lo que bajó del camión, muertos incluidos.</div>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label fw-semibold">Kg vivos</label>
                  <input type="number" className="form-control"
                    value={form.kgVivos}
                    onChange={(e) => setForm({ ...form, kgVivos: e.target.value })}
                    min="0" step="0.01" placeholder={recepcionSel ? recepcionSel.pesoRealKg : "0"} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Muertos (u)</label>
                  <input type="number" className="form-control"
                    value={form.muertos}
                    onChange={(e) => setForm({ ...form, muertos: e.target.value })}
                    min="0" placeholder="0" />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Muertos (kg)</label>
                  <input type="number" className="form-control"
                    value={form.kgMuertos}
                    onChange={(e) => setForm({ ...form, kgMuertos: e.target.value })}
                    min="0" step="0.01" placeholder="0" />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Decomisados (u)</label>
                  <input type="number" className="form-control"
                    value={form.unidadesDecomisadas}
                    onChange={(e) => setForm({ ...form, unidadesDecomisadas: e.target.value })}
                    min="0" placeholder="0" />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Decomisados (kg)</label>
                  <input type="number" className="form-control"
                    value={form.kgDecomisados}
                    onChange={(e) => setForm({ ...form, kgDecomisados: e.target.value })}
                    min="0" step="0.01" placeholder="0" />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Trozados (u)</label>
                  <input type="number" className="form-control"
                    value={form.unidadesTrozadas}
                    onChange={(e) => setForm({ ...form, unidadesTrozadas: e.target.value })}
                    min="0" placeholder="0" />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Trozados (kg)</label>
                  <input type="number" className="form-control"
                    value={form.kgTrozados}
                    onChange={(e) => setForm({ ...form, kgTrozados: e.target.value })}
                    min="0" step="0.01" placeholder="0" />
                </div>
                <div className="col-12 col-md-9">
                  <label className="form-label">Observaciones</label>
                  <input type="text" className="form-control"
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                </div>
              </div>

              {/* Faena parcial (solo si hay recepción vinculada) */}
              {recepcionSel && (
                <div className="mb-3 p-3 rounded border border-warning-subtle bg-warning-subtle">
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="faenaParcial"
                      checked={form.faenaParcial}
                      onChange={(e) => setForm({ ...form, faenaParcial: e.target.checked, pollosSinFaenar: "" })}
                    />
                    <label className="form-check-label fw-semibold" htmlFor="faenaParcial">
                      <i className="bi bi-hourglass-split me-1 text-warning"></i>
                      Faena parcial — continúa después
                    </label>
                  </div>
                  {form.faenaParcial && (
                    <div className="mt-2">
                      <label className="form-label fw-semibold small">Pollos sin faenar que vuelven a Granja</label>
                      <input
                        type="number" min="0" className="form-control form-control-sm"
                        placeholder="Cantidad de pollos sobrantes"
                        value={form.pollosSinFaenar}
                        onChange={(e) => setForm({ ...form, pollosSinFaenar: e.target.value })}
                      />
                      <div className="form-text text-warning small">
                        <i className="bi bi-info-circle me-1"></i>
                        Estos pollos quedan registrados como pendientes. Podrás crear un lote de continuación vinculado a esta misma recepción.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cierre de faena en vivo: la resta hecha, para no descubrir el
                  desvío recién al apretar Crear. */}
              <div className="mb-3">
                <DesgloseFaena
                  unidadesRecibidas={form.unidadesRecibidas}
                  muertos={form.muertos}
                  pollosSinFaenar={form.faenaParcial ? form.pollosSinFaenar : 0}
                  pollosCalibres={totalPollos}
                  unidadesTrozadas={form.unidadesTrozadas}
                  unidadesDecomisadas={form.unidadesDecomisadas}
                />
              </div>

              {/* Trozados — desglose por tipo */}
              {(form.kgTrozados || form.unidadesTrozadas) && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-scissors me-1 text-warning"></i>
                    Distribución de trozados
                    <span className="text-muted fw-normal ms-2 small">valores estimados</span>
                  </label>
                  <TrozadoTable
                    lineas={trozados}
                    onChange={setTrozados}
                    kgTrozadosTotal={form.kgTrozados}
                  />
                </div>
              )}

              <label className="form-label fw-semibold">
                Calibres (resultado de la faena)
                {recepcionSel && (
                  <span className="text-muted fw-normal ms-2 small">referencia: {fmtNum(recepcionSel.cantidadReal)} pollos recibidos</span>
                )}
              </label>
              <p className="text-muted small mb-2">El calibre indica cuántos pollos entran en un cajón de 20 kg.</p>
              <CalibreTable ref={calibreRef} lineas={lineas} onChange={setLineas} />

              {/* Destino: regla fija. Enteros → cámara; trozados → pendientes (congelado). */}
              {hayTrozados && (
                <div className="mt-3 p-3 rounded border border-warning-subtle bg-warning-subtle">
                  <div className="fw-semibold mb-1" style={{ color: "#b45309" }}>
                    <i className="bi bi-snow2 me-1"></i>
                    Los trozados quedan congelando
                  </div>
                  <p className="text-muted small mb-0">
                    Los <strong>pollos enteros</strong> entran directo a cámara Cañete. Los <strong>trozados</strong> no
                    suman stock todavía: deben congelarse antes de encajonarse y venderse. Pasálos a cámara desde
                    <em> Lotes de Faena → pestaña "Trozados pendientes"</em> cuando estén en condiciones.
                  </p>
                </div>
              )}

              {totalCajones > 0 && (
                <>
                  <div className="alert alert-info py-2 mt-3 mb-2">
                    <div className="row text-center gx-0 gy-2">
                      <div className="col-6 col-md border-end">
                        <div className="text-muted small">Pollos calibres</div>
                        <div className="fw-bold">{fmtNum(totalPollos)}</div>
                      </div>
                      <div className="col-6 col-md border-end">
                        <div className="text-muted small">Cajones</div>
                        <div className="fw-bold">{fmtNum(totalCajones)}</div>
                      </div>
                      <div className="col-6 col-md border-end">
                        <div className="text-muted small">Kg calibres</div>
                        <div className="fw-bold">{fmtNum(totalKg)}</div>
                      </div>
                      {form.unidadesTrozadas && (
                        <div className="col-6 col-md border-end">
                          <div className="text-muted small">Trozados (u)</div>
                          <div className="fw-bold">{fmtNum(Number(form.unidadesTrozadas))}</div>
                        </div>
                      )}
                      {form.kgTrozados && (
                        <div className="col-6 col-md border-end">
                          <div className="text-muted small">Trozados (kg)</div>
                          <div className="fw-bold">{fmtNum(Number(form.kgTrozados))}</div>
                        </div>
                      )}
                      <div className="col-6 col-md">
                        <div className="text-muted small fw-semibold">Total pollos</div>
                        <div className="fw-bold text-primary">
                          {fmtNum(totalPollos + (Number(form.unidadesTrozadas) || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded px-3 py-2 d-flex justify-content-between align-items-center"
                    style={{ background: "#f0fdf4", border: "2px solid #86efac" }}>
                    <div className="fw-semibold text-success">
                      <i className="bi bi-snow me-2"></i>Kg enteros a cámara ahora
                    </div>
                    <div className="fw-bold fs-5 text-success">{fmtNum(kgACamaraAhora)} kg</div>
                  </div>
                  {kgPendiente > 0 && (
                    <div className="rounded px-3 py-2 mt-2 d-flex justify-content-between align-items-center"
                      style={{ background: "#fffbeb", border: "2px solid #fde68a" }}>
                      <div className="fw-semibold" style={{ color: "#b45309" }}>
                        <i className="bi bi-snow2 me-2"></i>Kg de trozados congelando (pendientes)
                      </div>
                      <div className="fw-bold fs-5" style={{ color: "#b45309" }}>{fmtNum(kgPendiente)} kg</div>
                    </div>
                  )}
                </>
              )}
            </form>
          </div>

          <div className="card-footer bg-white d-flex justify-content-end gap-2 py-3">
            <button className="btn btn-outline-secondary" onClick={() => navigate(VOLVER_A)} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" form="form-nuevo-lote" className="btn btn-success" disabled={saving || !recepcionSel}>
              {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
              <i className="bi bi-plus-circle me-1"></i>Crear Lote
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LoteFaenaCrearPage;
