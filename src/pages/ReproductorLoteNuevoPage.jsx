import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import BotonExcel from "../components/BotonExcel";
import {
  obtenerConstantesReproductores,
  obtenerLotesReproductores,
  crearLoteReproductor,
  actualizarLoteReproductor,
  eliminarLoteReproductor,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import { formatearNumero, ESTADO_LOTE, SECTOR_LABEL, nombreGalpon } from "../utils/reproductoresUtils";
import { exportarTablaExcel } from "../utils/exportarExcel";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

const FORM_VACIO = {
  numeroLote: "",
  galpon: "",
  fechaIngreso: obtenerFechaHoy(),
  hembrasIngreso: "",
  machosIngreso: "",
  bajasIngresoHembras: "",
  bajasIngresoMachos: "",
  motivoBajas: "",
  proveedor: "",
  observaciones: "",
};

// Un plantel ya cargado vuelve al mismo formulario que lo dio de alta.
const formDesdeLote = (lote) => ({
  numeroLote: String(lote.numeroLote ?? ""),
  galpon: lote.galpon ?? "",
  fechaIngreso: lote.fechaIngreso
    ? new Date(lote.fechaIngreso).toISOString().split("T")[0]
    : obtenerFechaHoy(),
  hembrasIngreso: String(lote.hembras?.ingreso ?? ""),
  machosIngreso: String(lote.machos?.ingreso ?? ""),
  bajasIngresoHembras: String(lote.bajasIngresoHembras ?? 0),
  bajasIngresoMachos: String(lote.bajasIngresoMachos ?? 0),
  motivoBajas: lote.motivoBajas || "",
  proveedor: lote.proveedor || "",
  observaciones: lote.observaciones || "",
});

// ── Modal de ingreso / edición de lote reproductor ──────────────────────────
// El lote entra siempre por un galpón de RECRÍA. Cuando esté listo para poner
// se muda a un galpón de postura desde la pantalla de Galpones — por eso al
// editar se ofrecen los galpones del sector donde el lote está hoy.
const LoteModal = ({ lote, onClose, onGuardado, constantes, galponesOcupados, numeroSugerido }) => {
  const esEdicion = Boolean(lote);
  const [form, setForm] = useState(() =>
    esEdicion ? formDesdeLote(lote) : { ...FORM_VACIO, numeroLote: String(numeroSugerido) }
  );
  const [saving, setSaving] = useState(false);

  // Un plantel finalizado ya cerró con su egreso: las cantidades quedan como
  // están y solo se corrigen los datos de cabecera.
  const finalizado = esEdicion && lote.estado === "finalizado";
  const sector = esEdicion ? lote.sector : "recria";
  const galponesSector = constantes?.galpones?.[sector] || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const totalAves =
    (Number(form.hembrasIngreso) || 0) + (Number(form.machosIngreso) || 0);
  const totalBajas =
    (Number(form.bajasIngresoHembras) || 0) + (Number(form.bajasIngresoMachos) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Por ahora el número lo carga el usuario a mano (después será correlativo).
    if (!String(form.numeroLote).trim() || Number(form.numeroLote) <= 0) {
      Swal.fire("Falta el número", "Cargá el número de plantel.", "warning");
      return;
    }
    if (!form.galpon) {
      Swal.fire(
        "Falta el galpón",
        `Elegí en qué galpón de ${SECTOR_LABEL[sector].toLowerCase()} está el plantel.`,
        "warning"
      );
      return;
    }
    if (!finalizado) {
      if (totalAves <= 0) {
        Swal.fire("Faltan aves", "Cargá la cantidad de hembras y/o machos.", "warning");
        return;
      }
      // Igual que en el ingreso de pollitos de crianza: las bajas son obligatorias
      // (se cargan en cero si no hubo), y si hay bajas hay que decir el motivo.
      if (form.bajasIngresoHembras === "" || form.bajasIngresoMachos === "") {
        Swal.fire(
          "Faltan las bajas",
          "Cargá las bajas recibidas de hembras y de machos (cero si no hubo).",
          "warning"
        );
        return;
      }
      if (totalBajas > 0 && !form.motivoBajas.trim()) {
        Swal.fire("Falta el motivo", "Si hay bajas, indicá el motivo.", "warning");
        return;
      }
    }

    const datos = {
      numeroLote: Number(form.numeroLote),
      galpon: Number(form.galpon),
      fechaIngreso: ajustarFechaParaGuardar(form.fechaIngreso),
      proveedor: form.proveedor,
      observaciones: form.observaciones,
    };
    // Un plantel finalizado no manda cantidades: el backend las rechaza porque
    // el saldo ya quedó guardado en el egreso.
    if (!finalizado) {
      datos.hembrasIngreso = Number(form.hembrasIngreso) || 0;
      datos.machosIngreso = Number(form.machosIngreso) || 0;
      datos.bajasIngresoHembras = Number(form.bajasIngresoHembras) || 0;
      datos.bajasIngresoMachos = Number(form.bajasIngresoMachos) || 0;
      datos.motivoBajas = form.motivoBajas;
    }

    setSaving(true);
    try {
      const guardado = esEdicion
        ? await actualizarLoteReproductor(lote._id, datos)
        : await crearLoteReproductor({
            ...datos,
            motivoBajas: form.motivoBajas || undefined,
            proveedor: form.proveedor || undefined,
            observaciones: form.observaciones || undefined,
          });
      onGuardado();
      Swal.fire({
        icon: "success",
        title: `Plantel #${guardado.numeroLote} ${esEdicion ? "actualizado" : "creado"}`,
        text: `${nombreGalpon(constantes?.galpones, guardado.sector, guardado.galpon)} — ${formatearNumero(
          guardado.hembras.actual
        )} hembras / ${formatearNumero(guardado.machos.actual)} machos`,
        timer: 2600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.message || `No se pudo ${esEdicion ? "actualizar" : "crear"} el plantel.`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-dialog-scrollable modal-lg">
          <div className="modal-content">
            <div className={`modal-header text-white ${esEdicion ? "bg-primary" : "bg-success"}`}>
              <h5 className="modal-title">
                <i className={`bi ${esEdicion ? "bi-pencil-square" : "bi-egg"} me-2`}></i>
                {esEdicion ? `Editar plantel #${lote.numeroLote}` : "Nuevo plantel"}
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-lote-reproductor" onSubmit={handleSubmit}>
                {esEdicion ? (
                  <div className="alert alert-light border small mb-3">
                    <i className="bi bi-info-circle me-1"></i>
                    Corregís los datos del ingreso. Cambiar las aves ingresadas o las bajas
                    recalcula el saldo actual del plantel (ingreso menos todas las bajas
                    cargadas). La mudanza a postura se sigue haciendo desde{" "}
                    <strong>Galpones</strong>.
                  </div>
                ) : (
                  <div className="alert alert-light border small mb-3">
                    <i className="bi bi-info-circle me-1"></i>
                    El plantel entra por un galpón de <strong>recría</strong> y conserva su número
                    toda la vida ({constantes?.semanasCicloVida ?? 65} semanas). Cuando esté listo
                    para poner se muda a un galpón de postura desde <strong>Galpones</strong>.
                  </div>
                )}

                {finalizado && (
                  <div className="alert alert-warning small mb-3">
                    <i className="bi bi-lock-fill me-1"></i>
                    El plantel está <strong>finalizado</strong>: las aves y las bajas del ingreso
                    quedan como están. Se pueden corregir el número, la fecha, el proveedor y las
                    observaciones.
                  </div>
                )}

                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">
                      Número de plantel <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number"
                      name="numeroLote"
                      className="form-control"
                      value={form.numeroLote}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      required
                    />
                    <div className="form-text">
                      {esEdicion
                        ? "Se carga a mano — no puede repetirse con otro plantel"
                        : `Se carga a mano por ahora — sugerido: #${numeroSugerido}`}
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Galpón de {SECTOR_LABEL[sector].toLowerCase()}
                  </label>
                  <div className="d-flex flex-wrap gap-2">
                    {galponesSector.map((g) => {
                      // El galpón donde ya está el lote no cuenta como ocupado.
                      const propio = esEdicion && lote.galpon === g.numero;
                      const ocupado = !propio && galponesOcupados.has(`${sector}-${g.numero}`);
                      const seleccionado = Number(form.galpon) === g.numero;
                      const bloqueado = ocupado || finalizado;
                      return (
                        <button
                          key={g.numero}
                          type="button"
                          className={`btn ${
                            ocupado
                              ? "btn-danger disabled"
                              : seleccionado
                              ? "btn-success"
                              : "btn-outline-secondary"
                          }`}
                          disabled={bloqueado}
                          onClick={() => !bloqueado && setForm((prev) => ({ ...prev, galpon: g.numero }))}
                          title={ocupado ? "Galpón ocupado" : g.nombre}
                        >
                          {ocupado ? <i className="bi bi-lock-fill me-1"></i> : null}
                          {g.nombre}
                        </button>
                      );
                    })}
                  </div>
                  {galponesOcupados.size > 0 && (
                    <div className="mt-2 small text-muted">
                      <span className="badge bg-danger me-1">
                        <i className="bi bi-lock-fill"></i>
                      </span>
                      Galpón ocupado — ya tiene un lote activo
                    </div>
                  )}
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Fecha de ingreso</label>
                    <input
                      type="date"
                      name="fechaIngreso"
                      className="form-control"
                      value={form.fechaIngreso}
                      onChange={handleChange}
                      required
                    />
                    {esEdicion && (
                      <div className="form-text">
                        Cambiarla recalcula la semana de las bajas y los pesajes ya cargados.
                      </div>
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">
                      Proveedor <span className="text-muted fw-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      name="proveedor"
                      className="form-control"
                      value={form.proveedor}
                      onChange={handleChange}
                      placeholder="Ej: Cabaña Avícola"
                    />
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mt-4 mb-2">
                  <i className="bi bi-gender-ambiguous me-1"></i>Aves ingresadas
                </h6>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Hembras</label>
                    <input
                      type="number"
                      name="hembrasIngreso"
                      className="form-control"
                      value={form.hembrasIngreso}
                      onChange={handleChange}
                      min="0"
                      placeholder="Ej: 9000"
                      disabled={finalizado}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Machos</label>
                    <input
                      type="number"
                      name="machosIngreso"
                      className="form-control"
                      value={form.machosIngreso}
                      onChange={handleChange}
                      min="0"
                      placeholder="Ej: 900"
                      disabled={finalizado}
                    />
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mt-4 mb-2">
                  <i className="bi bi-exclamation-triangle me-1"></i>Bajas recibidas
                </h6>
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Bajas hembras</label>
                    <input
                      type="number"
                      name="bajasIngresoHembras"
                      className="form-control"
                      value={form.bajasIngresoHembras}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      required
                      disabled={finalizado}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Bajas machos</label>
                    <input
                      type="number"
                      name="bajasIngresoMachos"
                      className="form-control"
                      value={form.bajasIngresoMachos}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      required
                      disabled={finalizado}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className={`form-label fw-semibold ${totalBajas > 0 ? "" : "text-muted"}`}>
                      Motivo {totalBajas > 0 && <span className="text-danger">*</span>}
                    </label>
                    <input
                      type="text"
                      name="motivoBajas"
                      className="form-control"
                      value={form.motivoBajas}
                      onChange={handleChange}
                      disabled={totalBajas === 0 || finalizado}
                      placeholder={totalBajas > 0 ? "Ej: muertas en viaje" : "Sin bajas"}
                    />
                  </div>
                </div>

                {totalAves > 0 && !finalizado && (
                  <div className="alert alert-success py-2 small mb-3">
                    {esEdicion ? "Después de las bajas del ingreso quedan:" : "Quedan en el galpón:"}{" "}
                    <strong>
                      {formatearNumero((Number(form.hembrasIngreso) || 0) - (Number(form.bajasIngresoHembras) || 0))}
                    </strong>{" "}
                    hembras y{" "}
                    <strong>
                      {formatearNumero((Number(form.machosIngreso) || 0) - (Number(form.bajasIngresoMachos) || 0))}
                    </strong>{" "}
                    machos ({formatearNumero(totalAves - totalBajas)} aves)
                    {esEdicion && (
                      <span className="d-block text-muted">
                        Al saldo actual se le siguen restando las bajas cargadas después del ingreso.
                      </span>
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <label className="form-label fw-semibold">
                    Observaciones <span className="text-muted fw-normal">(opcional)</span>
                  </label>
                  <textarea
                    name="observaciones"
                    className="form-control"
                    rows={2}
                    value={form.observaciones}
                    onChange={handleChange}
                  />
                </div>
              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                form="form-lote-reproductor"
                className={`btn ${esEdicion ? "btn-primary" : "btn-success"}`}
                disabled={saving}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-lg me-1"></i>
                {esEdicion ? "Guardar cambios" : "Ingresar plantel"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
const ReproductorLoteNuevoPage = () => {
  const navigate = useNavigate();
  const [constantes, setConstantes] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [loteEditando, setLoteEditando] = useState(null);
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, data] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerLotesReproductores(),
      ]);
      setConstantes(cons);
      setLotes(Array.isArray(data) ? data : []);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los planteles.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Galpones con un lote activo, por sector: "recria-2", "postura-1"…
  // El alta solo mira los de recría; la edición también los de postura.
  const galponesOcupados = new Set(
    lotes
      .filter((l) => l.estado !== "finalizado")
      .map((l) => `${l.sector}-${l.galpon}`)
  );

  const handleEliminar = async (lote) => {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Eliminar el plantel #${lote.numeroLote}?`,
      text: "Se borra el ingreso completo con su mortandad y pesajes. No se puede deshacer.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;

    try {
      await eliminarLoteReproductor(lote._id);
      await cargar();
      Swal.fire({ icon: "success", title: "Plantel eliminado", timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo eliminar el plantel.", "error");
    }
  };

  // Mientras la carga sea manual, sugerimos el siguiente al mayor ya usado.
  const numeroSugerido =
    lotes.reduce((max, l) => Math.max(max, Number(l.numeroLote) || 0), 0) + 1;

  const lotesPagina = lotes.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);
  // Excel: todos los planteles cargados, no solo la página que se está viendo.
  const exportarExcel = () => exportarTablaExcel({
    filas: lotes,
    nombreHoja: "Planteles",
    nombreArchivo: "Reproductoras_planteles",
    columnas: [
      { header: "Plantel",          valor: (l) => l.numeroLote ?? "" },
      { header: "Ubicación",        valor: (l) => nombreGalpon(constantes?.galpones, l.sector, l.galpon) },
      { header: "Sector",           valor: (l) => l.sector },
      { header: "Fecha ingreso",    valor: (l) => formatearFechaLocal(l.fechaIngreso) },
      { header: "Hembras ingreso",  valor: (l) => l.hembras?.ingreso ?? 0 },
      { header: "Hembras actual",   valor: (l) => l.hembras?.actual ?? 0 },
      { header: "Machos ingreso",   valor: (l) => l.machos?.ingreso ?? 0 },
      { header: "Machos actual",    valor: (l) => l.machos?.actual ?? 0 },
      { header: "Aves actuales",    valor: (l) => (l.hembras?.actual || 0) + (l.machos?.actual || 0) },
      { header: "Semana de vida",   valor: (l) => l.semanaVida ?? "" },
      { header: "Estado",           valor: (l) => (ESTADO_LOTE[l.estado]?.label || l.estado) },
      { header: "Proveedor",        valor: (l) => l.proveedor },
      { header: "Observaciones",    valor: (l) => l.observaciones },
    ],
  });


  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-egg text-success me-2"></i>Ingreso de Plantel
            </h1>
            <p className="text-muted mb-0 small">
              Alta de planteles de reproductoras (machos y hembras) en los galpones de recría
            </p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <BotonExcel
              onClick={exportarExcel}
              disabled={lotes.length === 0}
              titulo="Descargar todos los planteles"
            />
            <button className="btn btn-success" onClick={() => setModalAbierto(true)}>
              <i className="bi bi-plus-lg me-1"></i>Nuevo plantel
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : lotes.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              Todavía no hay planteles cargados.
            </div>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="card shadow-sm d-none d-md-block">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Plantel</th>
                      <th>Ubicación</th>
                      <th>Ingreso</th>
                      <th className="text-end">Hembras</th>
                      <th className="text-end">Machos</th>
                      <th className="text-center">Semana</th>
                      <th className="text-center">Estado</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesPagina.map((lote) => {
                      const estado = ESTADO_LOTE[lote.estado] || {};
                      return (
                        <tr key={lote._id}>
                          <td className="fw-bold">#{lote.numeroLote}</td>
                          <td>{nombreGalpon(constantes?.galpones, lote.sector, lote.galpon)}</td>
                          <td>{formatearFechaLocal(lote.fechaIngreso)}</td>
                          <td className="text-end">
                            {formatearNumero(lote.hembras?.actual)}
                            <span className="text-muted small"> / {formatearNumero(lote.hembras?.ingreso)}</span>
                          </td>
                          <td className="text-end">
                            {formatearNumero(lote.machos?.actual)}
                            <span className="text-muted small"> / {formatearNumero(lote.machos?.ingreso)}</span>
                          </td>
                          <td className="text-center">
                            {lote.semanaVida ?? "-"}
                            <span className="text-muted small">/{constantes?.semanasCicloVida ?? 65}</span>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${estado.clase}`}>{estado.label}</span>
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-outline-primary me-1"
                              onClick={() => navigate("/reproductores/galpones")}
                              title="Ver en galpones"
                            >
                              <i className="bi bi-eye"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary me-1"
                              onClick={() => setLoteEditando(lote)}
                              title="Editar plantel"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleEliminar(lote)}
                              title="Eliminar"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="d-md-none">
              {lotesPagina.map((lote) => {
                const estado = ESTADO_LOTE[lote.estado] || {};
                return (
                  <div className="card shadow-sm mb-2" key={lote._id}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="fw-bold mb-0">Plantel #{lote.numeroLote}</h6>
                          <small className="text-muted">
                            {nombreGalpon(constantes?.galpones, lote.sector, lote.galpon)}
                          </small>
                        </div>
                        <span className={`badge ${estado.clase}`}>{estado.label}</span>
                      </div>
                      <div className="row g-2 small">
                        <div className="col-6">
                          <span className="text-muted">Hembras:</span>{" "}
                          <strong>{formatearNumero(lote.hembras?.actual)}</strong>
                        </div>
                        <div className="col-6">
                          <span className="text-muted">Machos:</span>{" "}
                          <strong>{formatearNumero(lote.machos?.actual)}</strong>
                        </div>
                        <div className="col-6">
                          <span className="text-muted">Ingreso:</span>{" "}
                          {formatearFechaLocal(lote.fechaIngreso)}
                        </div>
                        <div className="col-6">
                          <span className="text-muted">Semana:</span> {lote.semanaVida ?? "-"}
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button
                          className="btn btn-sm btn-outline-primary flex-fill"
                          onClick={() => setLoteEditando(lote)}
                        >
                          <i className="bi bi-pencil me-1"></i>Editar
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger flex-fill"
                          onClick={() => handleEliminar(lote)}
                        >
                          <i className="bi bi-trash me-1"></i>Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={pagina}
              totalItems={lotes.length}
              itemsPerPage={ITEMS_POR_PAGINA}
              onPageChange={setPagina}
            />
          </>
        )}
      </div>

      {(modalAbierto || loteEditando) && (
        <LoteModal
          lote={loteEditando}
          constantes={constantes}
          galponesOcupados={galponesOcupados}
          numeroSugerido={numeroSugerido}
          onClose={() => {
            setModalAbierto(false);
            setLoteEditando(null);
          }}
          onGuardado={() => {
            setModalAbierto(false);
            setLoteEditando(null);
            cargar();
          }}
        />
      )}
    </Layout>
  );
};

export default ReproductorLoteNuevoPage;
