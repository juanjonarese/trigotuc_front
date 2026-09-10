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
} from "../utils/reproductoresUtils";
import Swal from "sweetalert2";

/**
 * Recepción de API — la puerta de entrada del huevo a Trigotuc.
 *
 * El remito lo carga la granja: ahí el huevo ya sale del stock de la granja,
 * pero todavía está EN VIAJE y no se puede usar de este lado. Esta pantalla es
 * la que confirma que llegó, y recién entonces las partidas quedan disponibles
 * para incubar o para vender.
 *
 * La sección se llama "de API" porque es lo que importa acá, pero el remito
 * llega entero: se recibe todo lo que trajo el camión, incluido el huevo de
 * venta que venga en el mismo viaje.
 */

const incubablesDe = (remito) =>
  (remito.lineas || [])
    .filter((l) => TIPOS_HUEVO_INCUBABLES.includes(l.tipo))
    .reduce((s, l) => s + l.huevos, 0);

const TarjetaRemito = ({ remito, constantes, onRecibido }) => {
  const [saving, setSaving] = useState(false);
  const api = incubablesDe(remito);
  const huevosPorCajon = constantes?.huevosPorCajon ?? 144;

  // Un remito puede traer varios planteles: se listan para que se pueda
  // controlar contra el papel antes de aceptarlo.
  const porPlantel = {};
  for (const l of remito.lineas || []) {
    const n = l.lote?.numeroLote ?? "?";
    if (!porPlantel[n]) porPlantel[n] = [];
    porPlantel[n].push(l);
  }

  const handleRecibir = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: `¿Recibir el remito ${remito.numeroRemito}?`,
      html:
        `Entran <strong>${formatearNumero(remito.huevosTotales)}</strong> huevos a Trigotuc` +
        (api > 0
          ? `, de los cuales <strong>${formatearNumero(api)}</strong> son API incubable.`
          : ".") +
        `<br/><span class="text-muted">Recién después de recibirlo se puede incubar o vender.</span>`,
      showCancelButton: true,
      confirmButtonText: "Sí, recibir",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;

    setSaving(true);
    try {
      await recibirRemitoHuevos(remito._id);
      await onRecibido();
      Swal.fire({
        icon: "success",
        title: `Remito ${remito.numeroRemito} recibido`,
        text: `${formatearNumero(remito.huevosTotales)} huevos disponibles en Trigotuc`,
        timer: 2600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", err.message || "No se pudo recibir el remito.", "error");
      setSaving(false);
    }
  };

  return (
    <div className="col-12 col-lg-6">
      <div className="card shadow-sm h-100 border-warning">
        <div className="card-header bg-warning-subtle d-flex justify-content-between align-items-center">
          <span className="fw-bold">
            <i className="bi bi-truck me-2"></i>Remito {remito.numeroRemito}
          </span>
          <span className="badge bg-secondary">En viaje</span>
        </div>
        <div className="card-body d-flex flex-column">
          <div className="text-muted small mb-2">
            {formatearFechaLocal(remito.fecha)} · desde {remito.origen || "Cañete"}
          </div>

          <div className="row g-2 text-center mb-3">
            <div className="col-6">
              <div className="border rounded p-2">
                <div className="text-muted small">Huevos</div>
                <div className="fw-bold h5 mb-0">
                  {formatearNumero(remito.huevosTotales)}
                </div>
                <div className="text-muted" style={{ fontSize: ".75rem" }}>
                  {textoDesglose(remito.huevosTotales, huevosPorCajon)}
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="border rounded p-2">
                <div className="text-muted small">API incubable</div>
                <div className="fw-bold h5 mb-0 text-success">{formatearNumero(api)}</div>
                <div className="text-muted" style={{ fontSize: ".75rem" }}>
                  el resto va a venta
                </div>
              </div>
            </div>
          </div>

          <div className="table-responsive mb-3">
            <table className="table table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="small">Plantel</th>
                  <th className="small">Tipo</th>
                  <th className="small text-end">Huevos</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(porPlantel).map(([numeroLote, lineas]) =>
                  lineas.map((l, i) => (
                    <tr key={`${numeroLote}-${l.tipo}`}>
                      {i === 0 && (
                        <td className="fw-semibold" rowSpan={lineas.length}>
                          #{numeroLote}
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
                      <td className="small text-end fw-semibold">
                        {formatearNumero(l.huevos)}
                      </td>
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

          <button
            className="btn btn-warning mt-auto"
            onClick={handleRecibir}
            disabled={saving}
          >
            {saving && <span className="spinner-border spinner-border-sm me-1"></span>}
            <i className="bi bi-box-arrow-in-down me-1"></i>Recibir en Trigotuc
          </button>
          <div className="form-text text-center mt-1">
            Controlá contra el papel antes de aceptar
          </div>
        </div>
      </div>
    </div>
  );
};

const RecepcionApiPage = () => {
  const [constantes, setConstantes] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [recibidos, setRecibidos] = useState([]);
  const [solapa, setSolapa] = useState("pendientes");
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

  const totalEnViaje = pendientes.reduce((s, r) => s + (r.huevosTotales || 0), 0);
  const apiEnViaje = pendientes.reduce((s, r) => s + incubablesDe(r), 0);

  return (
    <Layout>
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h1 className="h3 fw-bold mb-1">
              <i className="bi bi-box-arrow-in-down text-warning me-2"></i>Recepción de API
            </h1>
            <p className="text-muted mb-0 small">
              Lo que la granja manda por remito entra acá. Hasta que no se recibe no se puede
              incubar ni vender.
            </p>
          </div>
          <button className="btn btn-outline-secondary" onClick={cargar} disabled={loading}>
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${solapa === "pendientes" ? "active fw-semibold" : ""}`}
              onClick={() => setSolapa("pendientes")}
            >
              <i className="bi bi-truck me-1"></i>Por recibir
              {pendientes.length > 0 && (
                <span className="badge bg-warning text-dark ms-1">{pendientes.length}</span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${solapa === "historial" ? "active fw-semibold" : ""}`}
              onClick={() => setSolapa("historial")}
            >
              <i className="bi bi-clock-history me-1"></i>Historial ({recibidos.length})
            </button>
          </li>
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
                      <th>Planteles</th>
                      <th className="text-end">API</th>
                      <th className="text-end">Total</th>
                      <th>Recibió</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recibidos.map((r) => {
                      const planteles = [
                        ...new Set((r.lineas || []).map((l) => l.lote?.numeroLote ?? "?")),
                      ];
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
                          <td className="small text-muted">
                            {r.recibidoPor?.nombreUsuario || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : pendientes.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-check2-circle fs-1 d-block mb-2 text-success"></i>
              No hay remitos esperando recepción.
              <div className="small mt-2">
                Cuando la granja cargue uno nuevo va a aparecer acá.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="row g-2 mb-4">
              <div className="col-6 col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Remitos en viaje</div>
                    <div className="h3 fw-bold mb-0">{pendientes.length}</div>
                  </div>
                </div>
              </div>
              <div className="col-6 col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">Huevos</div>
                    <div className="h3 fw-bold mb-0">{formatearNumero(totalEnViaje)}</div>
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body text-center py-3">
                    <div className="text-muted small">De eso, API incubable</div>
                    <div className="h3 fw-bold mb-0 text-success">
                      {formatearNumero(apiEnViaje)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3">
              {pendientes.map((r) => (
                <TarjetaRemito
                  key={r._id}
                  remito={r}
                  constantes={constantes}
                  onRecibido={cargar}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default RecepcionApiPage;
