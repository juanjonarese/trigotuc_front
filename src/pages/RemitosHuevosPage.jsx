import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import Pagination from "../components/Pagination";
import BotonExcel from "../components/BotonExcel";
import {
  obtenerConstantesReproductores,
  obtenerRemitosHuevos,
  obtenerStockGranja,
  obtenerStockTrigotuc,
  crearRemitoHuevos,
  anularRemitoHuevos,
} from "../services/api";
import { formatearFechaLocal, ajustarFechaParaGuardar, obtenerFechaHoy } from "../utils/dateUtils";
import {
  formatearNumero,
  textoDesglose,
  TIPOS_HUEVO,
  TIPOS_HUEVO_KEYS,
  etiquetaTipoHuevo,
  sumarTiposHuevo,
} from "../utils/reproductoresUtils";
import { exportarTablaExcel } from "../utils/exportarExcel";
import Swal from "sweetalert2";

const ITEMS_POR_PAGINA = 15;

const tiposVacios = () => TIPOS_HUEVO_KEYS.reduce((acc, k) => ({ ...acc, [k]: "" }), {});

// ── Modal: carga de un remito ───────────────────────────────────────────────
// El remito es el papel con el que los huevos salen de la granja y entran a
// Trigotuc. Puede llevar varios planteles; de cada uno se dice cuánto va de cada
// tipo. El número es el del talonario: lo carga el usuario.
//
// De cada plantel solo se puede mandar lo que tiene en la granja: el backend
// consume FIFO por fecha de recolección (primero el huevo más viejo).
const RemitoModal = ({ stockGranja, constantes, onClose, onGuardado }) => {
  const [numeroRemito, setNumeroRemito] = useState("");
  const [fecha, setFecha] = useState(obtenerFechaHoy());
  const [observaciones, setObservaciones] = useState("");
  // { [loteId]: { api: "", dobleYema: "", regular: "", bebe: "" } }
  const [cantidades, setCantidades] = useState({});
  const [saving, setSaving] = useState(false);

  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  const huevosPorBandeja = constantes?.huevosPorBandeja ?? 12;

  const valor = (loteId, tipo) => cantidades[loteId]?.[tipo] ?? "";
  const cantidad = (loteId, tipo) => Number(valor(loteId, tipo)) || 0;

  const handleCantidad = (loteId, tipo, value) =>
    setCantidades((prev) => ({
      ...prev,
      [loteId]: { ...(prev[loteId] || tiposVacios()), [tipo]: value },
    }));

  // Carga de una vez todo lo que ese plantel tiene en la granja.
  const cargarTodo = (entrada) =>
    setCantidades((prev) => ({
      ...prev,
      [entrada.lote]: TIPOS_HUEVO_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: entrada.porTipo[k] ? String(entrada.porTipo[k]) : "" }),
        {}
      ),
    }));

  // Líneas efectivas del remito y control de que ninguna supere lo disponible.
  const lineas = [];
  const excedidos = [];
  for (const entrada of stockGranja) {
    for (const tipo of TIPOS_HUEVO_KEYS) {
      const huevos = cantidad(entrada.lote, tipo);
      if (huevos <= 0) continue;
      if (huevos > (entrada.porTipo[tipo] || 0))
        excedidos.push(`#${entrada.numeroLote} ${etiquetaTipoHuevo(tipo)}`);
      lineas.push({ lote: entrada.lote, numeroLote: entrada.numeroLote, tipo, huevos });
    }
  }

  const totalesPorTipo = TIPOS_HUEVO_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: lineas.filter((l) => l.tipo === k).reduce((s, l) => s + l.huevos, 0) }),
    {}
  );
  const huevosTotales = sumarTiposHuevo(totalesPorTipo);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!numeroRemito.trim()) {
      Swal.fire("Falta el número", "Cargá el número del remito de papel.", "warning");
      return;
    }
    if (lineas.length === 0) {
      Swal.fire("Remito vacío", "Cargá cuántos huevos salen de al menos un plantel.", "warning");
      return;
    }
    if (excedidos.length > 0) {
      Swal.fire(
        "Más de lo que hay",
        `No hay tantos huevos en la granja: ${excedidos.join(", ")}.`,
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      const remito = await crearRemitoHuevos({
        numeroRemito: numeroRemito.trim(),
        fecha: ajustarFechaParaGuardar(fecha),
        lineas: lineas.map(({ lote, tipo, huevos }) => ({ lote, tipo, huevos })),
        observaciones: observaciones || undefined,
      });
      await onGuardado();
      Swal.fire({
        icon: "success",
        title: `Remito ${remito.numeroRemito} cargado`,
        text: `${formatearNumero(remito.huevosTotales)} huevos entraron a Trigotuc`,
        timer: 2600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo cargar el remito.", "error");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal show d-block" tabIndex="-1">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="bi bi-truck me-2"></i>Nuevo remito a Trigotuc
              </h5>
              <button className="btn-close btn-close-white" onClick={onClose} disabled={saving}></button>
            </div>

            <div className="modal-body">
              <form id="form-remito-huevos" onSubmit={handleSubmit}>
                <div className="alert alert-light border small mb-3">
                  <i className="bi bi-info-circle me-1"></i>
                  Cargá cuántos huevos salen de cada plantel. De cada plantel sale primero el
                  huevo más viejo. Lo que no cargues sigue en la granja para el próximo remito.
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">
                      Número de remito <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={numeroRemito}
                      onChange={(e) => setNumeroRemito(e.target.value)}
                      placeholder="Ej: 0001-00012345"
                      required
                    />
                    <div className="form-text">El del talonario de papel</div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">
                      Observaciones <span className="text-muted fw-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                    />
                  </div>
                </div>

                <h6 className="fw-bold text-secondary mb-2">Huevos en la granja</h6>

                {stockGranja.length === 0 ? (
                  <div className="alert alert-warning small">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    No hay huevos en la granja sin remitir. Cargá primero la recolección.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Plantel</th>
                          {TIPOS_HUEVO.map((t) => (
                            <th className="text-center" key={t.key} style={{ minWidth: 130 }}>
                              {t.label}
                            </th>
                          ))}
                          <th className="text-end">En granja</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockGranja.map((entrada) => (
                          <tr key={entrada.lote}>
                            <td>
                              <span className="fw-bold">#{entrada.numeroLote}</span>
                              <span className="text-muted small d-block">G{entrada.galpon}</span>
                            </td>
                            {TIPOS_HUEVO.map((t) => {
                              const disponible = entrada.porTipo[t.key] || 0;
                              const cargado = cantidad(entrada.lote, t.key);
                              const excede = cargado > disponible;
                              return (
                                <td key={t.key}>
                                  <input
                                    type="number"
                                    className={`form-control form-control-sm ${excede ? "is-invalid" : ""}`}
                                    min="0"
                                    max={disponible}
                                    value={valor(entrada.lote, t.key)}
                                    onChange={(e) =>
                                      handleCantidad(entrada.lote, t.key, e.target.value)
                                    }
                                    placeholder="0"
                                    disabled={disponible === 0}
                                  />
                                  <div className={`form-text ${excede ? "text-danger" : ""}`}>
                                    {disponible > 0 ? `hay ${formatearNumero(disponible)}` : "sin stock"}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="text-end fw-semibold">
                              {formatearNumero(entrada.huevosDisponibles)}
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => cargarTodo(entrada)}
                                title="Mandar todo lo que hay de este plantel"
                              >
                                Todo
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {huevosTotales > 0 && (
                  <div className={`alert py-2 mt-3 ${excedidos.length ? "alert-danger" : "alert-success"}`}>
                    <div className="row g-2 small">
                      <div className="col-12">
                        <strong>Van en el remito:</strong> {formatearNumero(huevosTotales)} huevos
                        <span className="text-muted">
                          {" "}
                          ({textoDesglose(huevosTotales, huevosPorCajon, huevosPorBandeja)}) en{" "}
                          {lineas.length} {lineas.length === 1 ? "línea" : "líneas"}
                        </span>
                      </div>
                      {TIPOS_HUEVO.filter((t) => totalesPorTipo[t.key] > 0).map((t) => (
                        <div className="col-md-3" key={t.key}>
                          <strong className={t.clase}>{t.label}:</strong>{" "}
                          {formatearNumero(totalesPorTipo[t.key])}
                        </div>
                      ))}
                    </div>
                    {excedidos.length > 0 && (
                      <div className="mt-2 pt-2 border-top small">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        Hay líneas que piden más de lo que hay en la granja:{" "}
                        {excedidos.join(", ")}.
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                form="form-remito-huevos"
                className="btn btn-success"
                disabled={saving || huevosTotales === 0 || excedidos.length > 0}
              >
                {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
                <i className="bi bi-check-lg me-1"></i>Cargar remito
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show"></div>
    </>
  );
};

// ── Modal: detalle de un remito ─────────────────────────────────────────────
const DetalleRemitoModal = ({ remito, onClose }) => (
  <>
    <div className="modal show d-block" tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className={`modal-header text-white ${remito.anulado ? "bg-secondary" : "bg-primary"}`}>
            <h5 className="modal-title">
              <i className="bi bi-file-earmark-text me-2"></i>Remito {remito.numeroRemito}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row g-2 small mb-3">
              <div className="col-md-4">
                <span className="text-muted">Fecha:</span> {formatearFechaLocal(remito.fecha)}
              </div>
              <div className="col-md-4">
                <span className="text-muted">Origen:</span> {remito.origen || "Cañete"}
              </div>
              <div className="col-md-4">
                <span className="text-muted">Total:</span>{" "}
                <strong>{formatearNumero(remito.huevosTotales)}</strong> huevos
              </div>
              {remito.observaciones && (
                <div className="col-12">
                  <span className="text-muted">Observaciones:</span> {remito.observaciones}
                </div>
              )}
              {remito.anulado && (
                <div className="col-12">
                  <span className="badge bg-secondary">Anulado</span>{" "}
                  {remito.motivoAnulado && (
                    <span className="text-muted">— {remito.motivoAnulado}</span>
                  )}
                </div>
              )}
            </div>

            <table className="table table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>Plantel</th>
                  <th>Tipo</th>
                  <th className="text-end">Huevos</th>
                  <th>Recolecciones de origen</th>
                </tr>
              </thead>
              <tbody>
                {remito.lineas.map((l, i) => (
                  <tr key={i}>
                    <td className="fw-bold">#{l.numeroLote ?? l.lote?.numeroLote ?? "?"}</td>
                    <td>{etiquetaTipoHuevo(l.tipo)}</td>
                    <td className="text-end">{formatearNumero(l.huevos)}</td>
                    <td className="small text-muted">
                      {l.consumos?.length
                        ? l.consumos
                            .map((c) => `${formatearFechaLocal(c.fecha)} (${formatearNumero(c.huevos)})`)
                            .join(" · ")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
    <div className="modal-backdrop show"></div>
  </>
);

// ── Página ──────────────────────────────────────────────────────────────────
const RemitosHuevosPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [remitos, setRemitos] = useState([]);
  const [stockGranja, setStockGranja] = useState([]);
  const [stockTrigotuc, setStockTrigotuc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, rems, granja, trigotuc] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerRemitosHuevos(),
        obtenerStockGranja(),
        obtenerStockTrigotuc(),
      ]);
      setConstantes(cons);
      setRemitos(Array.isArray(rems) ? rems : []);
      setStockGranja(Array.isArray(granja) ? granja : []);
      setStockTrigotuc(trigotuc);
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los remitos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleAnular = async (remito) => {
    const { isConfirmed, value } = await Swal.fire({
      icon: "warning",
      title: `¿Anular el remito ${remito.numeroRemito}?`,
      text: "Los huevos vuelven al stock de la granja. Solo se puede si ninguno se incubó ni se vendió.",
      input: "text",
      inputPlaceholder: "Motivo (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
    });
    if (!isConfirmed) return;
    try {
      await anularRemitoHuevos(remito._id, value || undefined);
      await cargar();
      Swal.fire({ icon: "success", title: "Remito anulado", timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire("No se puede anular", err.message, "error");
    }
  };

  // Totales de lo que sigue en la granja, por tipo.
  const granjaPorTipo = TIPOS_HUEVO_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: stockGranja.reduce((s, e) => s + (e.porTipo[k] || 0), 0) }),
    {}
  );
  const totalGranja = sumarTiposHuevo(granjaPorTipo);

  const remitosPagina = remitos.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  const exportarExcel = () =>
    exportarTablaExcel({
      filas: remitos,
      nombreHoja: "Remitos",
      nombreArchivo: "Reproductoras_remitos_huevos",
      columnas: [
        { header: "Remito",   valor: (r) => r.numeroRemito },
        { header: "Fecha",    valor: (r) => formatearFechaLocal(r.fecha) },
        { header: "Origen",   valor: (r) => r.origen || "" },
        { header: "Planteles", valor: (r) => [...new Set(r.lineas.map((l) => `#${l.numeroLote}`))].join(" ") },
        ...TIPOS_HUEVO.map((t) => ({
          header: t.label,
          valor: (r) => r.totales?.[t.key] ?? 0,
        })),
        { header: "Total huevos", valor: (r) => r.huevosTotales ?? 0 },
        { header: "Estado",       valor: (r) => (r.anulado ? "Anulado" : "Vigente") },
        { header: "Observaciones", valor: (r) => r.observaciones },
      ],
    });

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-truck text-success me-2"></i>Remitos de Huevos
            </h1>
            <p className="text-muted mb-0 small">
              Envío de la granja a Trigotuc — lo que no se envía queda en stock en la granja
            </p>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <BotonExcel
              onClick={exportarExcel}
              disabled={remitos.length === 0}
              titulo="Descargar los remitos"
            />
            <button
              className="btn btn-success"
              onClick={() => setModalAbierto(true)}
              disabled={loading || totalGranja === 0}
              title={totalGranja === 0 ? "No hay huevos en la granja sin remitir" : "Cargar un remito"}
            >
              <i className="bi bi-plus-lg me-1"></i>Nuevo remito
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success"></div>
          </div>
        ) : (
          <>
            {/* Dónde está el huevo hoy: en la granja o ya en Trigotuc */}
            <div className="row g-3 mb-4">
              <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                  <div className="card-header bg-white fw-bold">
                    <i className="bi bi-house me-1"></i>En la granja
                    <span className="text-muted fw-normal small ms-2">sin remitir</span>
                  </div>
                  <div className="card-body">
                    <div className="h4 fw-bold mb-2">{formatearNumero(totalGranja)} huevos</div>
                    <div className="row g-2 small">
                      {TIPOS_HUEVO.map((t) => (
                        <div className="col-6" key={t.key}>
                          <span className="text-muted">{t.label}:</span>{" "}
                          <strong className={t.clase}>{formatearNumero(granjaPorTipo[t.key])}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                  <div className="card-header bg-white fw-bold">
                    <i className="bi bi-building me-1"></i>En Trigotuc
                    <span className="text-muted fw-normal small ms-2">recibido, sin usar</span>
                  </div>
                  <div className="card-body">
                    <div className="h4 fw-bold mb-2">
                      {formatearNumero(stockTrigotuc?.total || 0)} huevos
                    </div>
                    <div className="row g-2 small">
                      {(stockTrigotuc?.porTipo || []).map((t) => (
                        <div className="col-6" key={t.tipo}>
                          <span className="text-muted">{t.etiqueta}:</span>{" "}
                          <strong>{formatearNumero(t.cantidad)}</strong>
                        </div>
                      ))}
                      {stockTrigotuc?.sinTipo > 0 && (
                        <div className="col-12 text-muted">
                          Descarte de inoculación: {formatearNumero(stockTrigotuc.sinTipo)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <h5 className="fw-bold text-secondary mb-3">Remitos cargados</h5>
            {remitos.length === 0 ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                  Todavía no se cargó ningún remito.
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
                          <th>Remito</th>
                          <th>Fecha</th>
                          <th>Planteles</th>
                          {TIPOS_HUEVO.map((t) => (
                            <th className="text-end" key={t.key} title={t.label}>
                              {t.corto}
                            </th>
                          ))}
                          <th className="text-end">Total</th>
                          <th className="text-center">Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {remitosPagina.map((r) => (
                          <tr key={r._id} className={r.anulado ? "text-muted" : ""}>
                            <td className="fw-bold">{r.numeroRemito}</td>
                            <td>{formatearFechaLocal(r.fecha)}</td>
                            <td className="small">
                              {[...new Set(r.lineas.map((l) => l.numeroLote))]
                                .map((n) => `#${n}`)
                                .join(" ")}
                            </td>
                            {TIPOS_HUEVO.map((t) => (
                              <td className="text-end" key={t.key}>
                                {formatearNumero(r.totales?.[t.key] || 0)}
                              </td>
                            ))}
                            <td className="text-end fw-semibold">
                              {formatearNumero(r.huevosTotales)}
                            </td>
                            <td className="text-center">
                              {r.anulado ? (
                                <span className="badge bg-secondary">Anulado</span>
                              ) : (
                                <span className="badge bg-success">Vigente</span>
                              )}
                            </td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => setDetalle(r)}
                                  title="Ver detalle"
                                >
                                  <i className="bi bi-eye"></i>
                                </button>
                                {!r.anulado && (
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => handleAnular(r)}
                                    title="Anular"
                                  >
                                    <i className="bi bi-x-circle"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile */}
                <div className="d-md-none">
                  {remitosPagina.map((r) => (
                    <div className="card shadow-sm mb-2" key={r._id}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between mb-2">
                          <strong>{r.numeroRemito}</strong>
                          {r.anulado ? (
                            <span className="badge bg-secondary">Anulado</span>
                          ) : (
                            <span className="badge bg-success">Vigente</span>
                          )}
                        </div>
                        <div className="row g-2 small">
                          <div className="col-6">
                            <span className="text-muted">Fecha:</span>{" "}
                            {formatearFechaLocal(r.fecha)}
                          </div>
                          <div className="col-6">
                            <span className="text-muted">Total:</span>{" "}
                            <strong>{formatearNumero(r.huevosTotales)}</strong>
                          </div>
                          <div className="col-12">
                            <span className="text-muted">Planteles:</span>{" "}
                            {[...new Set(r.lineas.map((l) => l.numeroLote))]
                              .map((n) => `#${n}`)
                              .join(" ")}
                          </div>
                          {TIPOS_HUEVO.filter((t) => r.totales?.[t.key] > 0).map((t) => (
                            <div className="col-6" key={t.key}>
                              <span className="text-muted">{t.label}:</span>{" "}
                              <strong className={t.clase}>
                                {formatearNumero(r.totales[t.key])}
                              </strong>
                            </div>
                          ))}
                        </div>
                        <div className="d-flex gap-2 mt-3">
                          <button
                            className="btn btn-sm btn-outline-primary flex-fill"
                            onClick={() => setDetalle(r)}
                          >
                            <i className="bi bi-eye me-1"></i>Detalle
                          </button>
                          {!r.anulado && (
                            <button
                              className="btn btn-sm btn-outline-danger flex-fill"
                              onClick={() => handleAnular(r)}
                            >
                              <i className="bi bi-x-circle me-1"></i>Anular
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={pagina}
                  totalItems={remitos.length}
                  itemsPerPage={ITEMS_POR_PAGINA}
                  onPageChange={setPagina}
                />
              </>
            )}
          </>
        )}
      </div>

      {modalAbierto && (
        <RemitoModal
          stockGranja={stockGranja}
          constantes={constantes}
          onClose={() => setModalAbierto(false)}
          onGuardado={async () => {
            setModalAbierto(false);
            await cargar();
          }}
        />
      )}

      {detalle && <DetalleRemitoModal remito={detalle} onClose={() => setDetalle(null)} />}
    </Layout>
  );
};

export default RemitosHuevosPage;
