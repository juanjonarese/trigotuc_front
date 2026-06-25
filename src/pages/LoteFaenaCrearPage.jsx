import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CalibreTable, { calcularCajones } from "../components/CalibreTable";
import { TrozadoTable, DestinoGrupo, TROZADO_TIPOS, trozadosVacios, trozadosAPayload } from "../components/TrozadoTable";
import { crearLote, obtenerOrdenesCarga } from "../services/api";
import { obtenerFechaHoy } from "../utils/dateUtils";
import { confirmarCoherenciaFaena } from "../utils/faenaValidacion";
import Swal from "sweetalert2";

const fmtNum = (n) =>
  n != null ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n) : "—";

const FORM_VACIO = {
  fechaIngreso:        obtenerFechaHoy(),
  unidadesFaenadas:    "",
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
  const [trozados, setTrozados] = useState(
    TROZADO_TIPOS.map((t) => ({ ...t, kgCaja: t.kgCajaDefault, cajas: "" }))
  );
  // Destino al terminar la faena. Sin elegir por defecto (null): hay que marcar
  // "camara" o "pendiente" para cada grupo antes de crear el lote.
  const [enterosDestino, setEnterosDestino]   = useState(null);
  const [trozadosDestino, setTrozadosDestino] = useState(null);
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
      setForm((f) => ({ ...f, kgVivos: "", unidadesFaenadas: "" }));
      return;
    }
    const rec = recepciones.find((o) => o._id === id) || null;
    setRecepcionSel(rec);
    if (rec) {
      // kgVivos y unidadesFaenadas no se autofill:
      // esos datos reales solo se conocen al terminar la faena (no en la recepción).
      setForm((f) => ({ ...f, kgVivos: "", unidadesFaenadas: "" }));
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
  const kgTotalCamara   = totalKg + kgTrozadosTotal;
  const hayTrozados     = kgTrozadosTotal > 0 || trozados.some((t) => Number(t.cajas) > 0);
  const hayEnteros      = totalCajones > 0;
  const kgACamaraAhora  = (enterosDestino === "camara" ? totalKg : 0) + (trozadosDestino === "camara" ? kgTrozadosTotal : 0);
  const kgPendiente     = (enterosDestino === "pendiente" ? totalKg : 0) + (trozadosDestino === "pendiente" ? kgTrozadosTotal : 0);
  // Falta definir destino de algún grupo con contenido
  const destinoIncompleto = (hayEnteros && !enterosDestino) || (hayTrozados && !trozadosDestino);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Obtiene líneas incluyendo el draft pendiente (si el usuario no clickeó "Aceptar")
    const lineasFinales = calibreRef.current?.getLineas() ?? lineas;
    const calibresPayload = lineasFinales
      .map((l) => ({ calibre: Number(l.calibre), pollos: Number(l.pollos), cajones: calcularCajones(l.pollos, l.calibre) }))
      .filter((l) => l.cajones > 0);

    if (!recepcionSel) {
      Swal.fire("Error", "Seleccioná la recepción de granja que vas a faenar. La faena debe partir de un pedido hecho a granja.", "error");
      return;
    }
    if (calibresPayload.length === 0) {
      Swal.fire("Error", "Agregá al menos un calibre con pollos en la tabla de calibres.", "error");
      return;
    }
    if (hayEnteros && !enterosDestino) {
      Swal.fire("Falta el destino", "Elegí si los pollos enteros van a cámara ahora o quedan pendientes.", "warning");
      return;
    }
    if (hayTrozados && !trozadosDestino) {
      Swal.fire("Falta el destino", "Elegí si los trozados van a cámara ahora o quedan pendientes.", "warning");
      return;
    }
    // Coherencia: faenadas = calibres + trozados (u) + decomisados (u). Advierte y confirma.
    const pollosCalibres = calibresPayload.reduce((a, c) => a + c.pollos, 0);
    const coherente = await confirmarCoherenciaFaena({
      unidadesFaenadas:    form.unidadesFaenadas,
      pollosCalibres,
      unidadesTrozadas:    form.unidadesTrozadas,
      unidadesDecomisadas: form.unidadesDecomisadas,
    });
    if (!coherente) return;
    setSaving(true);
    try {

      const totalCajonesF = calibresPayload.reduce((a, c) => a + c.cajones, 0);
      const totalPollosF  = calibresPayload.reduce((a, c) => a + c.pollos, 0);
      const totalKgF      = totalCajonesF * 20;

      const payload = {
        fechaIngreso:    form.fechaIngreso,
        calibres:        calibresPayload,
        observaciones:   form.observaciones || undefined,
        enterosACamara:  enterosDestino === "camara",
        trozadosACamara: trozadosDestino === "camara",
      };
      if (form.kgVivos)             payload.kgVivos             = Number(form.kgVivos);
      if (form.unidadesFaenadas)    payload.unidadesFaenadas    = Number(form.unidadesFaenadas);
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

      const trozadosPayload = trozados
        .filter((t) => Number(t.cajas) > 0)
        .map((t) => ({ tipo: t.tipo, kgCaja: Number(t.kgCaja), cajas: Number(t.cajas), kgTotal: Number(t.cajas) * Number(t.kgCaja) }));
      if (trozadosPayload.length > 0) payload.trozados = trozadosPayload;

      const { lote: loteCreado } = await crearLote(payload);

      await Swal.fire({
        icon:  "success",
        title: `Lote #${loteCreado.numeroLote} creado`,
        html:  `${fmtNum(totalPollosF)} pollos · ${fmtNum(totalCajonesF)} cajones · ${fmtNum(totalKgF)} kg` +
               (kgPendiente > 0
                 ? `<br><span class="text-warning"><i class="bi bi-hourglass-split"></i> ${fmtNum(kgPendiente)} kg quedan pendientes de cámara.</span>` +
                   `<br><span class="text-muted small">Enviálos desde Lotes de Faena cuando termines el proceso.</span>`
                 : `<br><span class="text-success"><i class="bi bi-snow"></i> Todo ingresó a cámara.</span>`),
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
                  <label className="form-label fw-semibold">Unidades faenadas</label>
                  <input type="number" className="form-control"
                    value={form.unidadesFaenadas}
                    onChange={(e) => setForm({ ...form, unidadesFaenadas: e.target.value })}
                    min="0" placeholder={recepcionSel ? fmtNum(recepcionSel.cantidadReal) : "0"} />
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

              {/* Destino al terminar la faena: qué entra a cámara ahora y qué queda pendiente */}
              {(hayEnteros || hayTrozados) && (
                <div className="mt-3 p-3 rounded border">
                  <div className="fw-semibold mb-1">
                    <i className="bi bi-box-arrow-in-down me-1 text-primary"></i>
                    Destino al terminar la faena
                  </div>
                  <p className="text-muted small mb-3">
                    Elegí qué entra a cámara ahora. Lo que dejes <strong>pendiente</strong> no suma stock
                    hasta que lo envíes desde <em>Lotes de Faena</em> (lo podés hacer al otro día).
                  </p>
                  <div className="d-flex flex-column gap-3">
                    {hayEnteros && (
                      <DestinoGrupo
                        titulo="Pollos enteros"
                        kg={totalKg}
                        destino={enterosDestino}
                        onChange={setEnterosDestino}
                      />
                    )}
                    {hayTrozados && (
                      <DestinoGrupo
                        titulo="Trozados"
                        kg={kgTrozadosTotal}
                        destino={trozadosDestino}
                        onChange={setTrozadosDestino}
                      />
                    )}
                  </div>
                  {destinoIncompleto && (
                    <div className="text-danger small mt-2">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Elegí el destino de cada grupo para poder crear el lote.
                    </div>
                  )}
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
                      <i className="bi bi-snow me-2"></i>Kg a cámara ahora
                    </div>
                    <div className="fw-bold fs-5 text-success">{fmtNum(kgACamaraAhora)} kg</div>
                  </div>
                  {kgPendiente > 0 && (
                    <div className="rounded px-3 py-2 mt-2 d-flex justify-content-between align-items-center"
                      style={{ background: "#fffbeb", border: "2px solid #fde68a" }}>
                      <div className="fw-semibold" style={{ color: "#b45309" }}>
                        <i className="bi bi-hourglass-split me-2"></i>Kg que quedan pendientes de cámara
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
            <button type="submit" form="form-nuevo-lote" className="btn btn-success" disabled={saving || !recepcionSel || destinoIncompleto}>
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
