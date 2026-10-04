import React, { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import {
  obtenerConstantesReproductores,
  obtenerRemitosPendientes,
  obtenerRemitosHuevos,
  recibirRemitoHuevos,
} from "../services/api";
import { formatearFechaLocal } from "../utils/dateUtils";
import {
  formatearNumero,
  textoDesglose,
  TIPOS_HUEVO,
  TIPOS_HUEVO_INCUBABLES,
  CLASES_REMITO,
  etiquetaClaseRemito,
} from "../utils/reproductoresUtils";
import { escapeHtml } from "../utils/escapeHtml";
import Swal from "sweetalert2";

/**
 * Recepción de huevos — la puerta de entrada del huevo a Trigotuc.
 *
 * El remito lo carga la granja: ahí el huevo ya sale del stock de la granja,
 * pero todavía está EN VIAJE y no se puede usar de este lado. Esta pantalla es
 * la que confirma que llegó, y recién entonces las partidas quedan disponibles
 * para incubar o para vender.
 *
 * Desde el 2026-10-04 (antes era "Recepción de API"):
 *   · El API y el consumo viajan en remitos SEPARADOS, porque los controla gente
 *     distinta (hoy Eduardo Robacio el API y Lourdes Bracamonte el consumo). Por
 *     eso la pantalla se divide en dos solapas: la solapa ES de quién es el
 *     remito, la granja no elige destinatario. Lo acepta el responsable (puede
 *     ser cualquiera con permiso) y queda registrado en `recibidoPor`.
 *   · Para recibirlo hay que escribir el CÓDIGO DE ENVÍO que la granja anotó en
 *     el remito de papel. El sistema no lo muestra acá: se lee del papel. Es la
 *     traba que obliga a la granja a cargar el remito el mismo día.
 *   · Los remitos anteriores (API y consumo juntos, sin código) aparecen en las
 *     dos solapas y se reciben sin código.
 */

const incubablesDe = (remito) =>
  (remito.lineas || [])
    .filter((l) => TIPOS_HUEVO_INCUBABLES.includes(l.tipo))
    .reduce((s, l) => s + l.huevos, 0);

const TarjetaRemito = ({ remito, constantes, onRecibido }) => {
  const [saving, setSaving] = useState(false);
  const api = incubablesDe(remito);
  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;
  const clase = CLASES_REMITO.find((c) => c.key === remito.clase);
  // El color de la tarjeta dice de qué es el remito de un vistazo: verde el API,
  // azul el consumo (los mismos colores que en Remitos de Huevos). Los remitos
  // anteriores, con todo junto, quedan en amarillo.
  const color = clase?.clase || "warning";

  // Un remito puede traer varios galpones: se listan para que se pueda
  // controlar contra el papel antes de aceptarlo. Los remitos viejos no
  // guardaban el galpón en la línea: se usa el del plantel.
  const porPlantel = {};
  for (const l of remito.lineas || []) {
    const galpon = l.galpon ?? l.lote?.galpon;
    const n = `${galpon != null ? `Galpón ${galpon} · ` : ""}#${l.lote?.numeroLote ?? "?"}`;
    if (!porPlantel[n]) porPlantel[n] = [];
    porPlantel[n].push(l);
  }

  const handleRecibir = async () => {
    const resumen =
      `Entran <strong>${formatearNumero(remito.huevosTotales)}</strong> huevos a Trigotuc` +
      (remito.clase === "api" || (!remito.clase && api > 0)
        ? ` (${formatearNumero(api)} de API incubable).`
        : ".");

    // Sin código (remito anterior): una confirmación como antes.
    if (!remito.requiereCodigo) {
      const { isConfirmed } = await Swal.fire({
        icon: "question",
        title: `¿Recibir el remito ${escapeHtml(remito.numeroRemito)}?`,
        html: `${resumen}<br/><span class="text-muted">Remito anterior al código de envío.</span>`,
        showCancelButton: true,
        confirmButtonText: "Sí, recibir",
        cancelButtonText: "Cancelar",
      });
      if (!isConfirmed) return;
      setSaving(true);
      try {
        await recibirRemitoHuevos(remito._id);
        await terminar();
      } catch (err) {
        Swal.fire("Error", err.message || "No se pudo recibir el remito.", "error");
        setSaving(false);
      }
      return;
    }

    // Con código: se valida en el mismo cartel, así un error de tipeo no obliga
    // a empezar de nuevo.
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: `Recibir el remito ${escapeHtml(remito.numeroRemito)}`,
      html:
        `${resumen}<br/>` +
        `<span class="text-muted">Escribí el <strong>código de envío</strong> que figura en el remito de papel.</span>`,
      input: "text",
      inputPlaceholder: "Código de envío",
      inputAttributes: {
        autocapitalize: "characters",
        autocomplete: "off",
        maxlength: "12",
        style: "text-transform:uppercase; letter-spacing:.25em; font-family:monospace; text-align:center",
      },
      showCancelButton: true,
      confirmButtonText: "Recibir",
      cancelButtonText: "Cancelar",
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async (codigo) => {
        if (!String(codigo || "").trim()) {
          Swal.showValidationMessage("Escribí el código del remito de papel");
          return false;
        }
        try {
          return await recibirRemitoHuevos(remito._id, codigo);
        } catch (err) {
          Swal.showValidationMessage(err.message || "No se pudo recibir el remito");
          return false;
        }
      },
    });
    if (!isConfirmed) return;
    setSaving(true);
    await terminar();
  };

  const terminar = async () => {
    await onRecibido();
    Swal.fire({
      icon: "success",
      title: `Remito ${remito.numeroRemito} recibido`,
      text: `${formatearNumero(remito.huevosTotales)} huevos disponibles en Trigotuc`,
      timer: 2600,
      showConfirmButton: false,
    });
  };

  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className={`card shadow-sm h-100 border border-2 border-${color}`}>
        <div
          className={`card-header bg-${color} ${clase ? "text-white" : "text-dark"} d-flex justify-content-between align-items-center gap-2 py-1`}
        >
          <span className="fw-bold text-uppercase">
            <i className={`bi ${clase?.icono || "bi-truck"} me-2`}></i>
            {clase ? clase.label : etiquetaClaseRemito(null)}
          </span>
          <span className="d-flex align-items-center gap-2">
            <span className="fw-semibold">Remito {remito.numeroRemito}</span>
            <span className="badge bg-light text-dark">En viaje</span>
          </span>
        </div>
        <div className={`card-body d-flex flex-column bg-${color}-subtle py-2 px-3 small`}>
          <div className="text-muted small mb-2">
            {formatearFechaLocal(remito.fecha)} · desde {remito.origen || "Cañete"}
            {remito.registradoPor?.nombreUsuario && ` · cargó ${remito.registradoPor.nombreUsuario}`}
          </div>

          <div className="row g-2 text-center mb-2">
            <div className="col-6">
              <div className="border rounded px-2 py-1 bg-white lh-sm">
                <div className="text-muted small">Huevos</div>
                <div className="fw-bold fs-6 mb-0">{formatearNumero(remito.huevosTotales)}</div>
                <div className="text-muted" style={{ fontSize: ".75rem" }}>
                  {textoDesglose(remito.huevosTotales, huevosPorCajon)}
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="border rounded px-2 py-1 bg-white lh-sm">
                <div className="text-muted small">API incubable</div>
                <div className="fw-bold fs-6 mb-0 text-success">{formatearNumero(api)}</div>
                <div className="text-muted" style={{ fontSize: ".75rem" }}>
                  el resto va a venta
                </div>
              </div>
            </div>
          </div>

          <div className="table-responsive mb-2">
            <table className="table table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="small">Galpón / plantel</th>
                  <th className="small">Tipo</th>
                  <th className="small text-end">Huevos</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(porPlantel).map(([numeroLote, lineas]) =>
                  lineas.map((l, i) => (
                    <tr key={`${numeroLote}-${l.tipo}`}>
                      {i === 0 && (
                        <td className="fw-semibold text-nowrap" rowSpan={lineas.length}>
                          {numeroLote}
                        </td>
                      )}
                      <td className="small">
                        {TIPOS_HUEVO.find((t) => t.key === l.tipo)?.label || l.tipo}
                        {TIPOS_HUEVO_INCUBABLES.includes(l.tipo) && (
                          <span className="badge bg-success ms-1" style={{ fontSize: ".65rem" }}>
                            API
                          </span>
                        )}
                      </td>
                      <td className="small text-end fw-semibold">{formatearNumero(l.huevos)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {remito.observaciones && (
            <div className="text-muted small mb-3">
              <i className="bi bi-chat-left-text me-1"></i>
              {remito.observaciones}
            </div>
          )}

          <button className={`btn btn-sm btn-${color} mt-auto`} onClick={handleRecibir} disabled={saving}>
            {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
            <i className="bi bi-box-arrow-in-down me-1"></i>Recibir en Trigotuc
          </button>
          <div className="form-text text-center mt-1">
            {remito.requiereCodigo
              ? "Controlá contra el papel y escribí el código de envío"
              : "Controlá contra el papel antes de aceptar"}
          </div>
        </div>
      </div>
    </div>
  );
};

// Las tres solapas: una por clase de remito y el historial.
const SOLAPAS = [
  ...CLASES_REMITO.map((c) => ({ key: c.key, label: c.label, icono: c.icono })),
  { key: "historial", label: "Historial", icono: "bi-clock-history" },
];

const RecepcionHuevosPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [recibidos, setRecibidos] = useState([]);
  const [solapa, setSolapa] = useState("api");
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cons, pend, todos] = await Promise.all([
        obtenerConstantesReproductores(),
        obtenerRemitosPendientes(),
        obtenerRemitosHuevos(),
      ]);
      setConstantes(cons);
      setPendientes(Array.isArray(pend) ? pend : []);
      // El historial es todo lo que ya entró: los que se recibieron por esta
      // pantalla y también los anteriores a la recepción, que entraban solos.
      // Los anulados no entraron nunca, así que quedan afuera.
      setRecibidos(
        (Array.isArray(todos) ? todos : []).filter((r) => !r.anulado && r.recibido !== false)
      );
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudieron cargar los remitos.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Los remitos anteriores (sin clase) llevaban API y consumo juntos: van en las
  // dos solapas, y recibirlos desde cualquiera de las dos es lo mismo.
  const pendientesDe = (clase) => pendientes.filter((r) => !r.clase || r.clase === clase);
  const enSolapa = solapa === "historial" ? [] : pendientesDe(solapa);
  const totalEnViaje = enSolapa.reduce((s, r) => s + (r.huevosTotales || 0), 0);

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-box-arrow-in-down text-warning me-2"></i>Recepción de huevos
            </h1>
            <p className="text-muted mb-0 small">
              Lo que la granja manda por remito entra acá: el API y el consumo, cada uno en su
              remito. Para recibirlo hay que escribir el código de envío del remito de papel.
            </p>
          </div>
          <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>

        <ul className="nav nav-tabs mb-3">
          {SOLAPAS.map((s) => {
            const cuantos = s.key === "historial" ? recibidos.length : pendientesDe(s.key).length;
            return (
              <li className="nav-item" key={s.key}>
                <button
                  className={`nav-link ${solapa === s.key ? "active fw-semibold" : ""}`}
                  onClick={() => setSolapa(s.key)}
                >
                  <i className={`bi ${s.icono} me-1`}></i>
                  {s.key === "historial" ? `Historial (${cuantos})` : s.label}
                  {s.key !== "historial" && cuantos > 0 && (
                    <span className="badge bg-warning text-dark ms-1">{cuantos}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning"></div>
          </div>
        ) : solapa === "historial" ? (
          recibidos.length === 0 ? (
            <div className="card shadow-sm">
              <div className="card-body text-center py-5 text-muted">
                <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                Todavía no se recibió ningún remito.
              </div>
            </div>
          ) : (
            <div className="card shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Recibido</th>
                      <th>Remito</th>
                      <th>Clase</th>
                      <th>Controló</th>
                      <th>Planteles</th>
                      <th className="text-end">API</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recibidos.map((r) => {
                      const planteles = [
                        ...new Set((r.lineas || []).map((l) => l.lote?.numeroLote ?? "?")),
                      ];
                      const clase = CLASES_REMITO.find((c) => c.key === r.clase);
                      return (
                        <tr key={r._id}>
                          <td className="small text-nowrap">
                            {r.fechaRecepcion ? (
                              formatearFechaLocal(r.fechaRecepcion)
                            ) : (
                              <span
                                className="text-muted"
                                title="Cargado antes de que existiera la recepción: entraba directo a stock."
                              >
                                anterior a la recepción
                              </span>
                            )}
                          </td>
                          <td className="fw-semibold">{r.numeroRemito}</td>
                          <td>
                            {clase ? (
                              <span className={`badge bg-${clase.clase}`}>{clase.label}</span>
                            ) : (
                              <span className="badge bg-light text-muted border">anterior</span>
                            )}
                          </td>
                          <td className="small">{r.recibidoPor?.nombreUsuario || "—"}</td>
                          <td className="small">
                            {planteles.map((n) => (
                              <span key={n} className="badge bg-light text-dark border me-1">
                                #{n}
                              </span>
                            ))}
                          </td>
                          <td className="text-end small text-success fw-semibold">
                            {formatearNumero(incubablesDe(r))}
                          </td>
                          <td className="text-end small fw-bold">
                            {formatearNumero(r.huevosTotales)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : enSolapa.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-check2-circle fs-1 d-block mb-2 text-success"></i>
              No hay remitos de {solapa === "api" ? "API" : "consumo"} esperando recepción.
              <div className="small mt-2">Cuando la granja cargue uno nuevo va a aparecer acá.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="row g-2 mb-4">
              <div className="col-6">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Remitos en viaje</div>
                    <div className="h3 fw-bold mb-0">{enSolapa.length}</div>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Huevos</div>
                    <div className="h3 fw-bold mb-0">{formatearNumero(totalEnViaje)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3">
              {enSolapa.map((r) => (
                <TarjetaRemito key={r._id} remito={r} constantes={constantes} onRecibido={cargar} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default RecepcionHuevosPage;
